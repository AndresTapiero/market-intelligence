#!/usr/bin/env node
/**
 * reparse-cache.js
 * Reprocesa la ULTIMA respuesta cruda del modelo (guardada en
 * .raw-response-cache.json) sin volver a llamar la API ni gastar en
 * busquedas web. Util cuando el problema esta en el codigo (parser,
 * plantilla del reporte, etc.) y no en la respuesta del modelo en si.
 *
 * Costo: $0.00
 *
 * Uso: node reparse-cache.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadRawCache, processRawResponse } from "./analyze.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPortfolio() {
  return JSON.parse(readFileSync(join(__dirname, "portfolio.json"), "utf8"));
}

async function main() {
  console.log("\n♻️  Reprocesando desde cache — sin llamar la API\n");

  const cache = loadRawCache();
  if (!cache) {
    console.log("❌ No hay cache disponible (.raw-response-cache.json no existe).");
    console.log("   Corre node analyze.js al menos una vez para generar el cache.");
    process.exit(1);
  }

  const edadMin = ((new Date() - new Date(cache.timestamp)) / 60000).toFixed(0);
  console.log(`  📦 Cache del: ${cache.timestamp} (hace ${edadMin} minutos)`);

  const rawPortfolio = loadPortfolio();
  const { weekLabel } = processRawResponse(rawPortfolio, cache.rawText);

  console.log(`\n✅ Reprocesado exitosamente — costo: $0.00`);
  console.log(`   Revisa latest-report.html. Si se ve bien, haz:`);
  console.log(`   git add . && git commit -m "fix: reprocesar reporte (sin gasto API)" && git push\n`);
}

main().catch(err => {
  console.error("\n❌ Error al reprocesar:", err.message);
  process.exit(1);
});
