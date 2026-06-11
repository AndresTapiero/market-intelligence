#!/usr/bin/env node
/**
 * Market Intelligence — Análisis semanal de portafolio
 * Andrés Tapiero · Corre cada lunes automáticamente
 *
 * Uso manual:  node analyze.js
 * Con cron:    configurado via setup-cron.sh
 */

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { generateHTML } from "./generate-report.js";
import { saveHistory, loadHistory } from "./history.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exec = promisify(execCb);

// ─── PORTAFOLIO DE ANDRÉS (actualizar cuando cambie) ──────────────────────────
const PORTFOLIO = {
  crypto: {
    btc: { qty: 0.01303, costAvg: 82716 },
    eth: { qty: 0.1733, note: "posicion con perdida, no vender" },
  },
  stocks: {
    voo:  { val: 244.79, gainPct: 30 },
    qqq:  { val: 105.28, gainPct: 26 },
    nvda: { val: 219.99, gainPct: 67 },
    nu:   { val: 14.42,  gainPct: 76 },
  },
  debt: {
    davivienda: 1559681,
    rappi: 3580796,
    note: "Prioridad #1: eliminar deuda antes de incrementar DCA",
  },
  dca: {
    btc:    "inicio de cada mes (proximo: julio 2026)",
    stocks: "fin de cada mes (proximo: junio 30 2026)",
    amount: "$50 USD cada uno",
  },
  rules: [
    "No comprar altcoins — todo capital fresco a BTC y acciones",
    "No vender crypto con perdida",
    "DCA sistematico independiente del precio",
    "Orden: liquidar TC > fondo emergencia > cuota vivienda > moto > vehiculo",
  ],
};

// ─── PROMPT ───────────────────────────────────────────────────────────────────
function buildPrompt() {
  const today = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `Eres el analista financiero personal de Andres Tapiero. Hoy es ${today}.

Busca en la web los precios actuales y contexto de mercado de esta semana para: BTC, ETH, VOO, QQQ, NVDA, NU (Nubank).

PORTAFOLIO ACTUAL:
- BTC: ${PORTFOLIO.crypto.btc.qty} BTC, costo promedio $${PORTFOLIO.crypto.btc.costAvg} USD
- ETH: ${PORTFOLIO.crypto.eth.qty} ETH — ${PORTFOLIO.crypto.eth.note}
- VOO: valor $${PORTFOLIO.stocks.voo.val}, ganancia +${PORTFOLIO.stocks.voo.gainPct}%
- QQQ: valor $${PORTFOLIO.stocks.qqq.val}, ganancia +${PORTFOLIO.stocks.qqq.gainPct}%
- NVDA: valor $${PORTFOLIO.stocks.nvda.val}, ganancia +${PORTFOLIO.stocks.nvda.gainPct}%
- NU: valor $${PORTFOLIO.stocks.nu.val}, ganancia +${PORTFOLIO.stocks.nu.gainPct}%
- Deuda Davivienda TC: $${PORTFOLIO.debt.davivienda.toLocaleString()} COP
- Deuda Rappi Card: $${PORTFOLIO.debt.rappi.toLocaleString()} COP
- ${PORTFOLIO.debt.note}
- DCA BTC: ${PORTFOLIO.dca.btc}
- DCA acciones: ${PORTFOLIO.dca.stocks}
- Monto DCA: ${PORTFOLIO.dca.amount}

REGLAS DE INVERSION:
${PORTFOLIO.rules.map((r) => `- ${r}`).join("\n")}

INSTRUCCIONES CRITICAS DE FORMATO:
Responde UNICAMENTE con JSON valido. Sin texto antes ni despues. Sin backticks. Sin markdown.
Usa solo caracteres ASCII en los valores de texto (sin tildes, sin comillas tipograficas).
Valores de signal: solo BUY, HOLD o WAIT.

{"date":"fecha","analystOpinion":"opinion de analista senior con 10 anos de experiencia: evaluacion del portafolio completo, que esta funcionando, que riesgo hay, recomendacion concreta para este mes en ASCII sin tildes ni caracteres especiales (3-4 oraciones directas como lo diria un CFA)","btc":{"price":"$X,XXX","change7d":"+X.X%","signal":"BUY","context":"que paso esta semana y por que esa senal para Andres. Sin caracteres especiales."},"eth":{"price":"$X,XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"voo":{"price":"$XXX","change7d":"+X.X%","signal":"BUY","context":"texto ASCII"},"qqq":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"nvda":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"nu":{"price":"$XX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"macro":{"usdcop":"$X,XXX COP","fedrate":"X.XX%","btcDominance":"XX%","fearGreed":"XX","fearGreedLabel":"etiqueta ASCII","narrative":"contexto macro en ASCII sin tildes"},"actions":[{"num":"01","text":"accion concreta sin caracteres especiales"},{"num":"02","text":"accion concreta"},{"num":"03","text":"accion concreta"},{"num":"04","text":"accion concreta"}]}`;
}

// ─── SANITIZAR & PARSEAR JSON ─────────────────────────────────────────────────
function sanitizeAndParse(raw) {
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  text = text
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  const start = text.indexOf("{");
  if (start === -1) throw new Error("No se encontro JSON en la respuesta");

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) throw new Error("JSON incompleto — verifica max_tokens");

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    console.error("JSON problematico (primeros 400 chars):", text.slice(start, start + 400));
    throw e;
  }
}

// ─── GIT PUSH ─────────────────────────────────────────────────────────────────
async function gitPush(weekLabel) {
  try {
    await exec(
      `git add reports/ latest-report.html history.json && git commit -m "report: ${weekLabel}" && git push`,
      { cwd: __dirname }
    );
    console.log("📤 Reporte subido a GitHub exitosamente");
    console.log(`🌐 Ver en: https://andrestapiero.github.io/market-intelligence/latest-report.html`);
  } catch (err) {
    console.log("⚠️  Git push fallo:", err.message);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔍 Market Intelligence — Iniciando analisis semanal...");
  console.log(`📅 ${new Date().toLocaleString("es-CO")}\n`);

  const client = new Anthropic();

  console.log("🌐 Consultando mercado en tiempo real...");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: buildPrompt() }],
  });

  const textBlocks = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text);

  const rawText = textBlocks.join("");

  if (!rawText.trim()) {
    throw new Error("Respuesta vacia del modelo");
  }

  console.log("🧠 Procesando analisis...");
  const data = sanitizeAndParse(rawText);

  const historyEntry = {
    timestamp: new Date().toISOString(),
    week: getWeekLabel(),
    data,
  };

  saveHistory(historyEntry);
  const history = loadHistory();

  const reportsDir = join(__dirname, "reports");
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

  const weekLabel = getWeekLabel();
  const filename = `report-${weekLabel}.html`;
  const filepath = join(reportsDir, filename);
  const latestPath = join(__dirname, "latest-report.html");

  const html = generateHTML(data, history, PORTFOLIO);
  writeFileSync(filepath, html, "utf8");
  writeFileSync(latestPath, html, "utf8");

  console.log(`\n✅ Analisis completado exitosamente`);
  console.log(`📊 Reporte guardado: reports/${filename}`);
  console.log(`🔗 Acceso rapido: latest-report.html\n`);

  printSummary(data);

  // Push a GitHub
  await gitPush(weekLabel);

  // Abrir en browser
  execCb(`open "${latestPath}" 2>/dev/null || xdg-open "${latestPath}" 2>/dev/null`);

  return data;
}

function getWeekLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function printSummary(d) {
  const signalEmoji = { BUY: "🟢", HOLD: "🟡", WAIT: "🔴" };
  const assets = ["btc", "eth", "voo", "qqq", "nvda", "nu"];

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SENALES DE LA SEMANA");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  for (const a of assets) {
    if (d[a]) {
      const emoji = signalEmoji[d[a].signal] || "⚪";
      const ticker = a.toUpperCase().padEnd(5);
      const price = (d[a].price || "—").padEnd(12);
      const change = (d[a].change7d || "—").padEnd(8);
      console.log(`  ${emoji} ${ticker} ${price} ${change} → ${d[a].signal}`);
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (d.macro) {
    console.log(`  USD/COP: ${d.macro.usdcop}  |  Fear&Greed: ${d.macro.fearGreed} (${d.macro.fearGreedLabel})`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n  ACCIONES ESTA SEMANA:");
  if (d.actions) {
    d.actions.forEach((a) => console.log(`  ${a.num}. ${a.text}`));
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
