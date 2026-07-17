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
import { detectAndLogDCA, loadDcaLog } from "./dca-log.js";

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

// ─── PROMPT OPTIMIZADO ────────────────────────────────────────────────────────
// Activos accionables (BTC, VOO, QQQ, NVDA): analisis completo con contexto.
// Altcoins en HOLD permanente: solo precio y cambio, sin narrativa (ahorra tokens).
function buildPrompt(raw) {
  const today = new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Activos que SI reciben analisis narrativo completo
  const ACCIONABLES = ["btc", "voo", "qqq", "nvda"];
  // El resto solo trae precio + cambio + senal corta

  const cryptoKeys = Object.keys(raw.crypto || {});
  const stockKeys  = Object.keys(raw.stocks || {});
  const allKeys    = [...cryptoKeys, ...stockKeys];
  const watchKeys  = Object.keys(raw.watchlist || {});

  const tickersList = [...allKeys, ...watchKeys].join(", ").toUpperCase();

  // Construir template JSON: accionables con context, resto sin context
  function assetTemplate(key) {
    if (ACCIONABLES.includes(key)) {
      return `"${key}":{"price":"$X","change7d":"+X.X%","signal":"BUY","context":"2 oraciones de analisis ASCII"}`;
    }
    return `"${key}":{"price":"$X","change7d":"+X.X%","signal":"HOLD"}`;
  }

  const assetsTemplate = allKeys.map(assetTemplate).join(",");

  const watchTemplate = watchKeys.length > 0
    ? `,"watchlist":{` + watchKeys.map(k =>
        `"${k}":{"price":"$X","change7d":"+X.X%","entrySignal":"BUY o WAIT","note":"1 oracion: es buen punto de entrada ahora o no y por que"}`
      ).join(",") + `}`
    : "";

  return `Eres el analista financiero personal de Andres Tapiero. Hoy es ${today}.

Busca en la web los precios actuales de: ${tickersList}.
Busca tambien la TRM oficial de Colombia (USD/COP) de HOY especificamente -- no estimes ni redondees, usa el valor oficial publicado por Banco de la Republica o fuentes financieras colombianas confiables.
Haz maximo 7 busquedas (agrupa varios tickers por busqueda cuando sea posible).

CONTEXTO:
- Portafolio diversificado crypto + acciones USA. Estrategia DCA mensual de $${raw.dca?.amount || 50} en BTC y $${raw.dca?.amount || 50} en acciones (VOO/QQQ).
- Reglas: no comprar altcoins, no vender con perdida, prioridad eliminar deuda TC.
- Las altcoins (ETH, SOL, TAO, UNI, BNB, SUI, SEI, ENA, AVAX) estan en HOLD permanente: solo necesito su precio actual, sin analisis.
- Analisis narrativo SOLO para: BTC, VOO, QQQ, NVDA (los activos accionables).
- Perfil de riesgo de Andres: moderado-agresivo (acepta volatilidad crypto pero prioriza disciplina DCA y eliminar deuda antes de nuevas posiciones).
${watchKeys.length > 0 ? `- WATCHLIST (activos que Andres NO posee pero considera comprar): ${watchKeys.join(", ").toUpperCase()}. Para cada uno: precio, cambio 7d, y evaluacion corta de si es buen punto de entrada.` : ""}

Tambien sugiere 2-3 OPORTUNIDADES NUEVAS de inversion (acciones, BTC adicional, o ETFs) basadas en el comportamiento actual del mercado y el perfil de riesgo de Andres. No sugieras altcoins nuevas. Cada sugerencia debe tener: el activo, por que tiene sentido ahora, y el riesgo principal.

FORMATO: Responde UNICAMENTE JSON valido. Sin texto extra, sin backticks, sin markdown.
Solo ASCII en los textos. Signals: BUY, HOLD o WAIT.
El campo usdcop debe ser la TRM oficial real de HOY, con el valor numerico exacto (ej: "$3,433.71 COP"), no una estimacion.

{"date":"fecha","analystOpinion":"opinion experta del portafolio completo en 3-4 oraciones ASCII, mencionando que funciona, que arrastra, y la recomendacion del mes","riskProfile":"Moderado-Agresivo",${assetsTemplate},"macro":{"usdcop":"$X,XXX.XX COP","fedrate":"X%","btcDominance":"XX%","fearGreed":"XX","fearGreedLabel":"etiqueta","narrative":"2 oraciones macro ASCII"},"newOpportunities":[{"asset":"ticker","reason":"por que tiene sentido ahora en 1-2 oraciones ASCII","risk":"riesgo principal en 1 oracion ASCII"},{"asset":"ticker","reason":"texto ASCII","risk":"texto ASCII"}]${watchTemplate},"actions":[{"num":"01","text":"accion concreta"},{"num":"02","text":"accion concreta"},{"num":"03","text":"accion concreta"}]}`;
}

// ─── SANITIZAR & PARSEAR JSON ─────────────────────────────────────────────────
// Si el JSON viene cortado (max_tokens insuficiente, corte de red, etc.) en vez
// de descartar toda la respuesta, recupera los campos completos que si llegaron.
function sanitizeAndParse(raw) {
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  text = text
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  const start = text.indexOf("{");
  if (start === -1) throw new Error("No se encontro JSON en la respuesta");

  // Buscar el cierre del bloque {...} contando llaves
  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }

  // Caso normal: el bloque {...} esta completo (depth volvio a 0)
  if (end !== -1) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      console.error("JSON problematico (completo pero invalido):", text.slice(start, start + 400));
      // si ni siquiera el bloque "completo" parsea, caemos al modo de recuperacion
    }
  } else {
    console.error("JSON incompleto (respuesta cortada) — intentando recuperar campos parciales");
  }

  // ── MODO RECUPERACION: cortar en la ultima propiedad valida ────────────────
  const body = text.slice(start);

  // Ultima ocurrencia de CUALQUIER propiedad cerrada: objeto `},` o string simple `",`
  // (antes solo detectaba objetos, por lo que perdia campos como analystOpinion
  // si el corte ocurria justo despues de un texto simple, antes del primer objeto)
  const closeCommaRe = /("|\})\s*,/g;
  let match, lastCloseEnd = -1;
  while ((match = closeCommaRe.exec(body)) !== null) {
    lastCloseEnd = match.index + match[1].length - 1; // indice del ultimo caracter de cierre (" o })
  }

  if (lastCloseEnd === -1) {
    throw new Error("JSON incompleto y sin propiedades recuperables");
  }

  const truncated = body.slice(0, lastCloseEnd + 1); // se queda hasta el "}" inclusive

  // Cerrar las llaves que quedaron abiertas (contando { vs })
  let openCount = 0, closeCount = 0;
  for (const ch of truncated) {
    if (ch === "{") openCount++;
    else if (ch === "}") closeCount++;
  }
  const missing = openCount - closeCount;
  const repaired = truncated + "}".repeat(Math.max(missing, 0));

  try {
    const parsed = JSON.parse(repaired);
    console.error("Recuperados campos parciales del JSON cortado");
    return parsed;
  } catch (e) {
    console.error("JSON problematico (recuperacion fallida):", repaired.slice(0, 400));
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
    model: "claude-sonnet-5",
    max_tokens: 3800,
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

  // 4b. Detectar y registrar compras DCA con precios de mercado actuales
  const marketPrices = {};
  const allAssetKeys = [...Object.keys(rawPortfolio.crypto||{}), ...Object.keys(rawPortfolio.stocks||{})];
  for (const key of allAssetKeys) {
    const price = parseFloat((analysisData[key]?.price||"0").replace(/[$,]/g,"")) || 0;
    if (price > 0) marketPrices[key] = price;
  }
  const dcaLog = detectAndLogDCA(rawPortfolio, marketPrices);
  PORTFOLIO.dcaLog = dcaLog;
  PORTFOLIO.targets = rawPortfolio.targets || null;
  PORTFOLIO.watchlistData = analysisData.watchlist || {};
  PORTFOLIO.cashUpdated = rawPortfolio.cash?._updated || null;
  PORTFOLIO.watchlistNotes = Object.fromEntries(Object.entries(rawPortfolio.watchlist || {}).map(([k,v]) => [k, v.note || ""]));

  // Log valores calculados
  const totalCrypto = Object.values(PORTFOLIO.crypto).reduce((s,a) => s + (a.currentVal||0), 0);
  const totalStocks = Object.values(PORTFOLIO.stocks).filter(s => !s.shares === false || s.val).reduce((s,a) => s + (a.val||0), 0);
  console.log(`  💰 Crypto: $${totalCrypto.toFixed(0)} · Acciones: $${totalStocks.toFixed(0)}`);

  // 5. Guardar historial
  // Calcular totales REALES de este momento para guardar snapshot del portafolio
  const totalCryptoSnapshot = Object.values(PORTFOLIO.crypto).reduce((s,a) => s + (a.currentVal||0), 0);
  const totalStocksSnapshot = Object.values(PORTFOLIO.stocks).filter(s => s.val != null).reduce((s,a) => s + (a.val||0), 0);
  const cashSnapshot = PORTFOLIO.stocks.cash?.val || 0;
  const totalSnapshot = totalCryptoSnapshot + totalStocksSnapshot + cashSnapshot;

  const historyEntry = {
    timestamp: new Date().toISOString(),
    week: getWeekLabel(),
    data: analysisData,
    portfolioSnapshot: {
      totalCrypto: +totalCryptoSnapshot.toFixed(2),
      totalStocks: +totalStocksSnapshot.toFixed(2),
      cash: +cashSnapshot.toFixed(2),
      total: +totalSnapshot.toFixed(2),
    }
  };
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
