#!/usr/bin/env node
/**
 * regenerate.js
 * Regenera el HTML con el último análisis guardado en history.json
 * Sin llamar la API de Anthropic — costo $0
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { generateHTML } from "./generate-report.js";
import { detectAndLogDCA } from "./dca-log.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPortfolio() {
  return JSON.parse(readFileSync(join(__dirname, "portfolio.json"), "utf8"));
}

function loadHistory() {
  const path = join(__dirname, "history.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8"));
}

function buildPortfolio(raw, analysisData) {
  function getPrice(key) {
    return parseFloat((analysisData[key]?.price || "0").replace(/[$,]/g, "")) || 0;
  }
  const crypto = {};
  for (const [key, c] of Object.entries(raw.crypto || {})) {
    const price = getPrice(key);
    crypto[key] = { qty: c.qty, costAvg: c.costAvg, currentVal: price > 0 ? +(c.qty * price).toFixed(2) : 0 };
  }
  const stocks = {};
  for (const [key, s] of Object.entries(raw.stocks || {})) {
    const price = getPrice(key);
    const currentVal = price > 0 ? +(s.shares * price).toFixed(2) : 0;
    const gainPct = s.costAvg > 0 && price > 0 ? +((price - s.costAvg) / s.costAvg * 100).toFixed(1) : 0;
    stocks[key] = { val: currentVal, gainPct, shares: s.shares, costAvg: s.costAvg };
  }
  stocks.cash = { val: raw.cash?.hapi || 0 };
  return {
    crypto, stocks,
    dca: { btc: raw.dca?.btc, stocks: raw.dca?.stocks, amount: `$${raw.dca?.amount} USD` },
    rules: [],
  };
}

function getWeekLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

async function main() {
  console.log("\n♻️  Regenerando reporte sin llamar la API...\n");

  const history = loadHistory();
  if (history.length === 0) {
    console.log("❌ history.json vacío — necesitas correr analyze.js al menos una vez");
    process.exit(1);
  }

  // Usar el último análisis guardado
  const last = history[history.length - 1];
  const analysisData = last.data;
  console.log(`  📅 Usando datos del análisis: ${last.week} (${last.timestamp?.slice(0,10) || "fecha desconocida"})`);

  const raw = loadPortfolio();
  const portfolio = buildPortfolio(raw, analysisData);
  portfolio.dcaLog = detectAndLogDCA(raw);
  portfolio.targets = raw.targets || null;
  portfolio.watchlistData = analysisData.watchlist || {};
  portfolio.cashUpdated = raw.cash?._updated || null;
  portfolio.watchlistNotes = Object.fromEntries(Object.entries(raw.watchlist || {}).map(([k,v]) => [k, v.note || ""]));

  // Calcular totales para log
  const totalCrypto = Object.values(portfolio.crypto).reduce((s,a) => s+(a.currentVal||0), 0);
  const totalStocks = Object.values(portfolio.stocks).filter(s=>s.val!=null).reduce((s,a) => s+(a.val||0), 0);
  console.log(`  💰 Crypto: $${totalCrypto.toFixed(0)} · Acciones: $${totalStocks.toFixed(0)} · Total: $${(totalCrypto+totalStocks+(raw.cash?.hapi||0)).toFixed(0)}`);

  // Generar HTML
  const html = generateHTML(analysisData, history, portfolio);

  // Guardar
  const reportsDir = join(__dirname, "reports");
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

  const weekLabel = getWeekLabel();
  const filename  = `report-${weekLabel}.html`;
  writeFileSync(join(reportsDir, filename), html, "utf8");
  writeFileSync(join(__dirname, "latest-report.html"), html, "utf8");

  console.log(`\n✅ Reporte regenerado: reports/${filename}`);
  console.log(`  Diseño: v6 completo (sticky header, score, indicadores separados)`);
  console.log(`  Costo API: $0.00\n`);

  // Abrir en browser
  exec(`open "${join(__dirname, "latest-report.html")}" 2>/dev/null || xdg-open "${join(__dirname, "latest-report.html")}" 2>/dev/null`);
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
