#!/usr/bin/env node
/**
 * Market Intelligence — Análisis mensual de portafolio
 * Andrés Tapiero · Lee portfolio.json como fuente única de verdad
 * Uso manual: node analyze.js
 */

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { generateHTML } from "./generate-report.js";
import { saveHistory, loadHistory } from "./history.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exec = promisify(execCb);

// ─── LEER PORTAFOLIO DESDE JSON ───────────────────────────────────────────────
function loadPortfolio() {
  const path = join(__dirname, "portfolio.json");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`No se pudo leer portfolio.json: ${e.message}`);
  }
}

// Extrae precios del JSON de análisis y calcula valores actuales
function buildPortfolioForReport(raw, analysisData) {
  function getPrice(key) {
    return parseFloat((analysisData[key]?.price || "0").replace(/[$,]/g, "")) || 0;
  }

  const crypto = {};
  for (const [key, c] of Object.entries(raw.crypto || {})) {
    const price = getPrice(key);
    const currentVal = price > 0 ? +(c.qty * price).toFixed(2) : 0;
    crypto[key] = { qty: c.qty, costAvg: c.costAvg, currentVal };
  }

  const stocks = {};
  for (const [key, s] of Object.entries(raw.stocks || {})) {
    const price = getPrice(key);
    const currentVal = price > 0 ? +(s.shares * price).toFixed(2) : 0;
    const gainPct = s.costAvg > 0 && price > 0
      ? +((price - s.costAvg) / s.costAvg * 100).toFixed(1) : 0;
    stocks[key] = { val: currentVal, gainPct, shares: s.shares, costAvg: s.costAvg };
  }

  stocks.cash = { val: raw.cash?.hapi || 0 };

  return {
    crypto,
    stocks,
    dca: {
      btc:    raw.dca?.btc    || "inicio de mes",
      stocks: raw.dca?.stocks || "fin de mes",
      amount: `$${raw.dca?.amount || 50} USD`,
    },
    rules: [
      "No comprar altcoins — todo capital fresco a BTC y acciones",
      "No vender crypto con perdida",
      "DCA sistematico independiente del precio",
      "Orden: liquidar TC > fondo emergencia > cuota vivienda > moto > vehiculo",
    ],
  };
}

// ─── PROMPT ───────────────────────────────────────────────────────────────────
function buildPrompt(raw) {
  const today = new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Construir lista de posiciones desde portfolio.json
  const cryptoLines = Object.entries(raw.crypto || {}).map(([key, c]) =>
    `- ${key.toUpperCase()}: ${c.qty} unidades, costo promedio $${c.costAvg} USD`
  ).join("\n");

  const stockLines = Object.entries(raw.stocks || {}).map(([key, s]) =>
    `- ${key.toUpperCase()}: ${s.shares} acciones, costo promedio $${s.costAvg} USD`
  ).join("\n");

  const cryptoKeys = Object.keys(raw.crypto || {}).join(", ").toUpperCase();
  const stockKeys  = Object.keys(raw.stocks || {}).join(", ").toUpperCase();

  return `Eres el analista financiero personal de Andres Tapiero. Hoy es ${today}.

Busca en la web los precios actuales de mercado para: ${cryptoKeys}, ${stockKeys}.

POSICIONES ACTUALES (cantidades reales):
CRYPTO:
${cryptoLines}

ACCIONES:
${stockLines}

Cash disponible en Hapi: $${raw.cash?.hapi || 0} USD

REGLAS DE INVERSION:
- No comprar altcoins — todo capital fresco a BTC y acciones (VOO/QQQ)
- No vender crypto con perdida
- DCA sistematico: $${raw.dca?.amount || 50} USD BTC el ${raw.dca?.btc || "inicio de mes"}, $${raw.dca?.amount || 50} USD acciones el ${raw.dca?.stocks || "fin de mes"}
- Prioridad: eliminar deuda TC antes de incrementar DCA

INSTRUCCIONES CRITICAS DE FORMATO:
Responde UNICAMENTE con JSON valido. Sin texto extra. Sin backticks. Sin markdown.
Solo caracteres ASCII en valores de texto. Signals: solo BUY, HOLD o WAIT.
Incluye precio actual de CADA activo listado arriba.

{"date":"fecha","analystOpinion":"opinion experta 3-4 oraciones ASCII","btc":{"price":"$X,XXX","change7d":"+X.X%","signal":"BUY","context":"texto ASCII"},"eth":{"price":"$X,XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"sol":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"tao":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"uni":{"price":"$X.XX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"bnb":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"sui":{"price":"$X.XX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"sei":{"price":"$X.XX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"ena":{"price":"$X.XX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"avax":{"price":"$X.XX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"voo":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"qqq":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"nvda":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"nu":{"price":"$XX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"tsla":{"price":"$XXX","change7d":"+X.X%","signal":"HOLD","context":"texto ASCII"},"macro":{"usdcop":"$X,XXX COP","fedrate":"X.XX%","btcDominance":"XX%","fearGreed":"XX","fearGreedLabel":"etiqueta ASCII","narrative":"contexto macro ASCII"},"actions":[{"num":"01","text":"accion concreta"},{"num":"02","text":"accion concreta"},{"num":"03","text":"accion concreta"},{"num":"04","text":"accion concreta"}]}`;
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

  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }

  if (end === -1) throw new Error("JSON incompleto");

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    console.error("JSON problematico:", text.slice(start, start + 400));
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
    console.log("📤 Reporte subido a GitHub");
    console.log("🌐 https://andrestapiero.github.io/market-intelligence/latest-report.html");
  } catch (err) {
    console.log("⚠️  Git push fallo:", err.message);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔍 Market Intelligence — Iniciando analisis...");
  console.log(`📅 ${new Date().toLocaleString("es-CO")}\n`);

  // 1. Leer portafolio desde JSON
  const rawPortfolio = loadPortfolio();
  console.log(`📂 Portafolio cargado: ${Object.keys(rawPortfolio.crypto).length} cryptos · ${Object.keys(rawPortfolio.stocks).length} acciones`);

  // 2. Obtener precios y análisis de mercado
  const client = new Anthropic();
  console.log("🌐 Consultando mercado en tiempo real...");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2500,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: buildPrompt(rawPortfolio) }],
  });

  const rawText = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  if (!rawText.trim()) throw new Error("Respuesta vacia del modelo");

  // 3. Parsear análisis
  console.log("🧠 Procesando analisis...");
  const analysisData = sanitizeAndParse(rawText);

  // 4. Calcular valores actuales con precios reales
  const PORTFOLIO = buildPortfolioForReport(rawPortfolio, analysisData);

  // Log valores calculados
  const totalCrypto = Object.values(PORTFOLIO.crypto).reduce((s,a) => s + (a.currentVal||0), 0);
  const totalStocks = Object.values(PORTFOLIO.stocks).filter(s => !s.shares === false || s.val).reduce((s,a) => s + (a.val||0), 0);
  console.log(`  💰 Crypto: $${totalCrypto.toFixed(0)} · Acciones: $${totalStocks.toFixed(0)}`);

  // 5. Guardar historial
  const historyEntry = { timestamp: new Date().toISOString(), week: getWeekLabel(), data: analysisData };
  saveHistory(historyEntry);
  const history = loadHistory();

  // 6. Generar reporte HTML
  const reportsDir = join(__dirname, "reports");
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

  const weekLabel  = getWeekLabel();
  const filename   = `report-${weekLabel}.html`;
  const latestPath = join(__dirname, "latest-report.html");

  const html = generateHTML(analysisData, history, PORTFOLIO);
  writeFileSync(join(reportsDir, filename), html, "utf8");
  writeFileSync(latestPath, html, "utf8");

  console.log(`\n✅ Analisis completado`);
  console.log(`📊 Reporte: reports/${filename}`);
  printSummary(analysisData);

  // 7. Push a GitHub
  await gitPush(weekLabel);

  // 8. Abrir en browser
  execCb(`open "${latestPath}" 2>/dev/null || xdg-open "${latestPath}" 2>/dev/null`);
}

function getWeekLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function printSummary(d) {
  const emoji = { BUY:"🟢", HOLD:"🟡", WAIT:"🔴" };
  const assets = ["btc","eth","sol","tao","uni","bnb","sui","sei","ena","avax","voo","qqq","nvda","nu","tsla"];
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SEÑALES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const a of assets) {
    if (d[a]) {
      const e = emoji[d[a].signal] || "⚪";
      console.log(`  ${e} ${a.toUpperCase().padEnd(5)} ${(d[a].price||"—").padEnd(12)} ${(d[a].change7d||"—").padEnd(8)} → ${d[a].signal}`);
    }
  }
  if (d.macro) console.log(`\n  USD/COP: ${d.macro.usdcop} · Fear&Greed: ${d.macro.fearGreed} (${d.macro.fearGreedLabel})`);
  console.log("\n  ACCIONES ESTE MES:");
  if (d.actions) d.actions.forEach(a => console.log(`  ${a.num}. ${a.text}`));
  console.log("");
}

main().catch(err => { console.error("\n❌ Error:", err.message); process.exit(1); });
