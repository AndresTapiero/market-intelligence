#!/usr/bin/env node
/**
 * register-exit.js
 * Registra una VENTA (exit) en inv_journal_exits.
 * Actualiza portfolio.json automáticamente.
 *
 * Uso:
 *   node register-exit.js NVDA
 *   → Prompt interactivo: cantidad, precio, razón, observaciones
 */

import dotenv from "dotenv";
import * as readline from "readline";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { insertExitEntry, loadJournalEntries } from "./supabase-client.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPortfolio() {
  return JSON.parse(readFileSync(join(__dirname, "portfolio.json"), "utf8"));
}

function savePortfolio(data) {
  writeFileSync(join(__dirname, "portfolio.json"), JSON.stringify(data, null, 2));
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const ticker = process.argv[2]?.toUpperCase();
  if (!ticker) {
    console.log("❌ Uso: node register-exit.js TICKER");
    process.exit(1);
  }

  const portfolio = loadPortfolio();
  const stock = portfolio.stocks?.[ticker.toLowerCase()];
  const crypto = portfolio.crypto?.[ticker.toLowerCase()];
  const asset = stock || crypto;

  if (!asset) {
    console.log(`❌ No encontré ${ticker} en portfolio.json`);
    process.exit(1);
  }

  const isCrypto = !!crypto;
  const qty = isCrypto ? asset.qty : asset.shares;
  const costAvg = asset.costAvg;

  console.log(`\n📤 Registrando venta de ${ticker}`);
  console.log(`  Cantidad actual: ${qty} ${isCrypto ? "unidades" : "acciones"}`);
  console.log(`  Costo promedio: $${costAvg}\n`);

  const quantityStr = await prompt("¿Cuánto vendes? ");
  const quantity = parseFloat(quantityStr);
  if (quantity <= 0 || quantity > qty) {
    console.log(`❌ Cantidad inválida (tienes ${qty})`);
    process.exit(1);
  }

  const priceStr = await prompt("¿A qué precio por unidad? ");
  const price = parseFloat(priceStr);
  if (price <= 0) {
    console.log(`❌ Precio inválido`);
    process.exit(1);
  }

  const razones = [
    "1. Toma de ganancias",
    "2. Stop loss / Reducción de pérdida",
    "3. Rebalanceo de portafolio",
    "4. Necesidad de liquidez",
    "5. Cambio de tesis",
    "6. Otro",
  ];
  console.log("\n¿Razón de venta?");
  razones.forEach((r) => console.log(`  ${r}`));
  const reasonIdx = await prompt("Selecciona (1-6): ");
  const reasonMap = {
    "1": "Toma de ganancias",
    "2": "Stop loss",
    "3": "Rebalanceo",
    "4": "Liquidez",
    "5": "Cambio de tesis",
    "6": "Otro",
  };
  const reason = reasonMap[reasonIdx] || "Otro";

  const obs = await prompt("Observaciones (opcional): ");

  // Calcular P&L
  const montoBruto = quantity * price;
  const costoBase = quantity * costAvg;
  const gananciaBruta = montoBruto - costoBase;
  const gananciaPct = costAvg > 0 ? ((gananciaBruta / costoBase) * 100).toFixed(2) : "0";

  console.log(`\n📊 Resumen de venta:`);
  console.log(`  Monto bruto: $${montoBruto.toFixed(2)}`);
  console.log(`  Costo base: $${costoBase.toFixed(2)}`);
  console.log(`  Ganancia: $${gananciaBruta.toFixed(2)} (${gananciaPct}%)\n`);

  const confirm = await prompt("¿Confirmar? (s/n): ");
  if (confirm.toLowerCase() !== "s") {
    console.log("❌ Cancelado");
    process.exit(0);
  }

  // Insertar en Supabase
  const exitEntry = {
    user_id: "56272fef-8fd2-4adf-af86-ff9ed10cbed1", // Tu user_id
    fecha_salida: new Date().toISOString().split("T")[0],
    ticker: ticker,
    numero_acciones_vendidas: quantity,
    precio_salida: price,
    monto_bruto: montoBruto,
    costo_base: costoBase,
    ganancia_bruta: gananciaBruta,
    ganancia_pct: parseFloat(gananciaPct),
    razon_venta: reason,
    observaciones: obs || null,
  };

  try {
    const inserted = await insertExitEntry(exitEntry);
    console.log(`✅ Venta registrada en Supabase (id: ${inserted.id})`);
  } catch (err) {
    console.log(`❌ Error en Supabase: ${err.message}`);
    process.exit(1);
  }

  // Actualizar portfolio.json
  const newQty = qty - quantity;
  const key = ticker.toLowerCase();

  if (isCrypto) {
    portfolio.crypto[key].qty = parseFloat(newQty.toFixed(8));
    // Recalcular costAvg (promedio ponderado de lo que queda)
    // Si vendiste TODO, costAvg se mantiene (para historial)
    if (newQty > 0) {
      // costAvg no cambia: es el costo histórico
      // Lo que cambia es el cantidad
    }
  } else {
    portfolio.stocks[key].shares = parseFloat(newQty.toFixed(8));
  }

  portfolio._updated = new Date().toISOString().split("T")[0];
  savePortfolio(portfolio);

  console.log(`✅ portfolio.json actualizado: ${key}.qty/shares = ${newQty}`);
  console.log(`\n📝 Próximo paso: git add . && git commit -m "portfolio: venta ${ticker} ${new Date().toISOString().split("T")[0]}, ${gananciaPct}%"`);
}

main().catch((err) => {
  console.error(`\n❌ Error inesperado: ${err.message}`);
  process.exit(1);
});
