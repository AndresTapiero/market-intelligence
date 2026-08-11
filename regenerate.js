#!/usr/bin/env node
/**
 * regenerate.js
 * Regenera el HTML con el último análisis guardado en history.json
 * Sin llamar la API de Anthropic — costo $0
 */

import dotenv from "dotenv";
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { detectAndLogDCA } from "./dca-log.js";

dotenv.config();

// Placeholder para generateHTML (será generada en el navegador)
function generateHTML(data, history, portfolio) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report</title></head><body>
  <h1>Dashboard - ${new Date().toLocaleDateString()}</h1>
  <p>Dashboard generado localmente. Abre en navegador para ver interface completa.</p>
  </body></html>`;
}

// Funciones locales para cargar datos (sin dependencias de Supabase)
async function loadJournalEntries() {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return [];
    }

    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client
      .from("inv_journal")
      .select("*")
      .order("fecha", { ascending: false });

    return error ? [] : data || [];
  } catch (err) {
    console.warn("⚠️  No se pudo cargar inv_journal");
    return [];
  }
}

async function loadExitEntries() {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return [];
    }

    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client
      .from("inv_journal_exits")
      .select("*")
      .order("fecha_salida", { ascending: false });

    return error ? [] : data || [];
  } catch (err) {
    console.warn("⚠️  No se pudo cargar inv_journal_exits");
    return [];
  }
}

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
  console.log("\n♻️  Actualizando dashboard...\n");

  const reportsDir = join(__dirname, "reports");

  // Buscar el último reporte generado
  if (!existsSync(reportsDir)) {
    console.log("❌ No hay reportes generados aún. Necesitas ejecutar analyze.js primero.");
    process.exit(1);
  }

  const allFiles = readdirSync(reportsDir);
  const files = allFiles
    .filter(f => f.startsWith("report-") && f.endsWith(".html"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log("❌ No hay reportes en la carpeta reports/");
    process.exit(1);
  }

  const latestReportFile = files[0];
  const latestReportPath = join(reportsDir, latestReportFile);
  const latestPath = join(__dirname, "latest-report.html");

  // Copiar el último reporte a latest-report.html
  copyFileSync(latestReportPath, latestPath);

  console.log(`  📅 Usando reporte: ${latestReportFile}`);
  console.log(`\n✅ Dashboard actualizado: latest-report.html`);
  console.log(`   Visible en: https://andrestapiero.github.io/market-intelligence/`);
  console.log(`   Local: http://localhost:3000\n`);

  // Abrir en browser
  exec(`open "${latestPath}" 2>/dev/null || xdg-open "${latestPath}" 2>/dev/null`);
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
