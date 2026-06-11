#!/usr/bin/env node
/**
 * test-dry-run.js
 * Valida toda la cadena sin consumir API de Anthropic.
 * Usa datos mock para probar: portfolio.json, generate-report.js, git, GitHub Pages.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { generateHTML } from "./generate-report.js";
import { saveHistory, loadHistory } from "./history.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exec = promisify(execCb);

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

let errors = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  ${PASS} ${label}`);
  } else {
    console.log(`  ${FAIL} ${label}${detail ? " — " + detail : ""}`);
    errors++;
  }
}

async function run() {
  console.log("\n🔬 Market Intelligence — Dry Run Test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── 1. ARCHIVOS REQUERIDOS ─────────────────────────────────────────────────
  console.log("📁 Verificando archivos del proyecto...");
  const required = ["analyze.js", "generate-report.js", "history.js", "portfolio.json", "package.json"];
  for (const f of required) {
    check(f, existsSync(join(__dirname, f)));
  }

  // ── 2. PORTFOLIO.JSON ──────────────────────────────────────────────────────
  console.log("\n📊 Verificando portfolio.json...");
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(__dirname, "portfolio.json"), "utf8"));
    check("JSON válido", true);
    check(`Cryptos: ${Object.keys(raw.crypto).length} activos`, Object.keys(raw.crypto).length > 0);
    check(`Acciones: ${Object.keys(raw.stocks).length} activos`, Object.keys(raw.stocks).length > 0);
    check("Cash configurado", typeof raw.cash?.hapi === "number");
    check("DCA configurado", !!raw.dca?.btc && !!raw.dca?.stocks);

    // Validar que cada crypto tiene qty y costAvg
    for (const [key, c] of Object.entries(raw.crypto)) {
      check(`${key.toUpperCase()}: qty=${c.qty} costAvg=$${c.costAvg}`,
        c.qty > 0 && c.costAvg > 0);
    }
    for (const [key, s] of Object.entries(raw.stocks)) {
      check(`${key.toUpperCase()}: shares=${s.shares} costAvg=$${s.costAvg}`,
        s.shares > 0 && s.costAvg > 0);
    }
  } catch (e) {
    check("portfolio.json legible", false, e.message);
  }

  // ── 3. API KEY ─────────────────────────────────────────────────────────────
  console.log("\n🔑 Verificando API key...");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  check("ANTHROPIC_API_KEY configurada", !!apiKey,
    apiKey ? "" : "ejecuta: export ANTHROPIC_API_KEY=sk-ant-...");
  if (apiKey) {
    check("Formato correcto (sk-ant-...)", apiKey.startsWith("sk-ant-"));
    check("Longitud válida (>40 chars)", apiKey.length > 40);
  }

  // ── 4. GENERATE-REPORT CON DATOS MOCK ─────────────────────────────────────
  console.log("\n🖼  Probando generación de HTML con datos mock...");
  try {
    const mockData = {
      date: "junio 2026",
      analystOpinion: "Test dry run. Portafolio validado correctamente.",
      btc:  { price: "$63,700",  change7d: "+5.2%",  signal: "BUY",  context: "Test BTC context" },
      eth:  { price: "$1,679",   change7d: "-1.8%",  signal: "HOLD", context: "Test ETH context" },
      sol:  { price: "$66.80",   change7d: "+2.1%",  signal: "HOLD", context: "Test SOL context" },
      tao:  { price: "$211",     change7d: "-3.2%",  signal: "HOLD", context: "Test TAO context" },
      uni:  { price: "$2.51",    change7d: "+1.4%",  signal: "HOLD", context: "Test UNI context" },
      bnb:  { price: "$604",     change7d: "+0.8%",  signal: "HOLD", context: "Test BNB context" },
      sui:  { price: "$0.756",   change7d: "+3.5%",  signal: "HOLD", context: "Test SUI context" },
      sei:  { price: "$0.0495",  change7d: "-2.1%",  signal: "HOLD", context: "Test SEI context" },
      ena:  { price: "$0.0762",  change7d: "+1.2%",  signal: "HOLD", context: "Test ENA context" },
      avax: { price: "$6.59",    change7d: "-1.5%",  signal: "HOLD", context: "Test AVAX context" },
      voo:  { price: "$558",     change7d: "+2.1%",  signal: "HOLD", context: "Test VOO context" },
      qqq:  { price: "$498",     change7d: "+3.4%",  signal: "HOLD", context: "Test QQQ context" },
      nvda: { price: "$138",     change7d: "+4.8%",  signal: "HOLD", context: "Test NVDA context" },
      nu:   { price: "$11.91",   change7d: "+2.3%",  signal: "HOLD", context: "Test NU context" },
      tsla: { price: "$282",     change7d: "+1.9%",  signal: "HOLD", context: "Test TSLA context" },
      macro: {
        usdcop: "$4,180 COP", fedrate: "4.25%", btcDominance: "61.3%",
        fearGreed: "72", fearGreedLabel: "Codicia",
        narrative: "Test macro narrative."
      },
      actions: [
        { num: "01", text: "Test accion 1" },
        { num: "02", text: "Test accion 2" },
        { num: "03", text: "Test accion 3" },
        { num: "04", text: "Test accion 4" },
      ]
    };

    // Simular buildPortfolioForReport
    function getPrice(key) {
      return parseFloat((mockData[key]?.price || "0").replace(/[$,]/g, "")) || 0;
    }
    const crypto = {};
    for (const [key, c] of Object.entries(raw.crypto)) {
      const price = getPrice(key);
      crypto[key] = { qty: c.qty, costAvg: c.costAvg, currentVal: price > 0 ? +(c.qty * price).toFixed(2) : 0 };
    }
    const stocks = {};
    for (const [key, s] of Object.entries(raw.stocks)) {
      const price = getPrice(key);
      const currentVal = price > 0 ? +(s.shares * price).toFixed(2) : 0;
      const gainPct = s.costAvg > 0 && price > 0 ? +((price - s.costAvg) / s.costAvg * 100).toFixed(1) : 0;
      stocks[key] = { val: currentVal, gainPct, shares: s.shares, costAvg: s.costAvg };
    }
    stocks.cash = { val: raw.cash?.hapi || 0 };

    const mockPortfolio = {
      crypto, stocks,
      dca: { btc: raw.dca.btc, stocks: raw.dca.stocks, amount: `$${raw.dca.amount} USD` },
      rules: []
    };

    const html = generateHTML(mockData, [], mockPortfolio);
    check("HTML generado sin errores", html.length > 1000);
    check("HTML contiene sticky header", html.includes("sticky-bar"));
    check("HTML contiene score de salud", html.includes("score-card"));
    check("HTML contiene sección crypto", html.includes("Señales Crypto") || html.includes("crypto"));
    check("HTML contiene sección acciones", html.includes("Acciones"));
    check("HTML es responsive", html.includes("@media"));

    // Guardar HTML de prueba
    const testPath = join(__dirname, "test-output.html");
    writeFileSync(testPath, html, "utf8");
    check(`HTML guardado en test-output.html (${(html.length/1024).toFixed(0)}KB)`, true);

    // Calcular totales para verificar
    const totalCrypto = Object.values(crypto).reduce((s,a) => s+(a.currentVal||0), 0);
    const totalStocks = Object.values(stocks).filter(s=>s.val).reduce((s,a) => s+(a.val||0), 0);
    console.log(`\n  💰 Totales calculados con precios mock:`);
    console.log(`     Crypto: $${totalCrypto.toFixed(0)} | Acciones: $${totalStocks.toFixed(0)} | Total: $${(totalCrypto+totalStocks+raw.cash.hapi).toFixed(0)}`);

  } catch (e) {
    check("Generación de HTML", false, e.message);
  }

  // ── 5. HISTORIAL ──────────────────────────────────────────────────────────
  console.log("\n📅 Verificando sistema de historial...");
  try {
    const history = loadHistory();
    check(`history.json legible (${history.length} entradas)`, true);
  } catch (e) {
    check("history.json", false, e.message);
  }

  // ── 6. GIT ────────────────────────────────────────────────────────────────
  console.log("\n🔗 Verificando Git...");
  try {
    const { stdout: remote } = await exec("git remote get-url origin", { cwd: __dirname });
    check(`Remote configurado: ${remote.trim()}`, remote.includes("github"));
    const { stdout: branch } = await exec("git branch --show-current", { cwd: __dirname });
    check(`Branch activo: ${branch.trim()}`, branch.trim() === "main");
    const { stdout: status } = await exec("git status --porcelain", { cwd: __dirname });
    const pending = status.trim().split("\n").filter(Boolean).length;
    check(`Archivos sin commitear: ${pending}`, true); // solo informativo
  } catch (e) {
    check("Git configurado", false, e.message);
  }

  // ── 7. NODE MODULES ───────────────────────────────────────────────────────
  console.log("\n📦 Verificando dependencias...");
  try {
    await import("@anthropic-ai/sdk");
    check("@anthropic-ai/sdk instalado", true);
  } catch (e) {
    check("@anthropic-ai/sdk", false, "ejecuta: npm install");
  }

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (errors === 0) {
    console.log(`${PASS} Todo listo — puedes correr node analyze.js de forma segura`);
    console.log(`\n  Abre test-output.html para previsualizar el reporte con datos mock`);
    console.log(`  Una vez validado visualmente, corre: node analyze.js\n`);
  } else {
    console.log(`${FAIL} ${errors} problema(s) encontrado(s) — corrige antes de correr analyze.js`);
    console.log("");
    process.exitCode = 1; // salir con error para que CI bloquee el análisis
  }
}

run().catch(err => {
  console.error("\n❌ Error inesperado:", err.message);
  process.exit(1);
});
