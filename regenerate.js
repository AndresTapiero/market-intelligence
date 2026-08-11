#!/usr/bin/env node
/**
 * regenerate.js
 * Copia el reporte más reciente a latest-report.html
 * Los datos de Supabase se cargan en el navegador
 */

import dotenv from "dotenv";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  console.log(`   Visible en: https://andrestapiero.github.io/market-intelligence/latest-report.html`);
  console.log(`   Local: http://localhost:3000\n`);

  // Abrir en browser
  exec(`open "${latestPath}" 2>/dev/null || xdg-open "${latestPath}" 2>/dev/null`);
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
