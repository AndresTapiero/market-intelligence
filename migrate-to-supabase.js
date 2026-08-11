#!/usr/bin/env node
/**
 * migrate-to-supabase.js
 * Script de UN SOLO USO — corre localmente, fuera de control de versiones
 * (agregalo a .gitignore junto a run-weekly.sh).
 *
 * Migra las posiciones de stock-picking individual (NVDA, TSLA, NU) al
 * diario de inversiones en Supabase (inv_journal). BTC/VOO/QQQ NO se migran
 * aqui porque son DCA sistematico sin tesis individual — esos ya viven en
 * dca-log.json / portfolio.json.
 *
 * tesis_inversion y fuentes_valoracion quedan en null porque estas 3
 * posiciones se compraron ANTES de definir el metodo de 3 fuentes.
 *
 * IMPORTANTE: reemplaza las fechas "FECHA_PENDIENTE" con las fechas reales
 * de compra (las que Andres busque en Hapi) antes de correr este script.
 *
 * Uso:
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   node migrate-to-supabase.js
 */

import { insertJournalEntry } from "./supabase-client.js";

// ─── DATOS A MIGRAR — reemplaza las fechas antes de correr ────────────────
const USER_ID = "56272fef-8fd2-4adf-af86-ff9ed10cbed1";

const POSICIONES_A_MIGRAR = [
  {
    user_id: USER_ID,
    fecha: "2025-01-28",
    ticker: "NVDA",
    categoria: "satelite",           // ajusta si prefieres 'core' o 'legado'
    inversion_monto: 132.04,
    numero_acciones: 1.10855,
    precio_entrada: 119.11,
    tesis_inversion: null,
    fuentes_valoracion: null,
    precio_objetivo: null,
    margen_seguridad_pct: null,
  },
  {
    user_id: USER_ID,
    fecha: "2025-06-09",
    ticker: "TSLA",
    categoria: "satelite",
    inversion_monto: 39.00,
    numero_acciones: 0.12903,
    precio_entrada: 302.24,
    tesis_inversion: null,
    fuentes_valoracion: null,
    precio_objetivo: null,
    margen_seguridad_pct: null,
  },
  {
    user_id: USER_ID,
    fecha: "2023-12-07",
    ticker: "NU",
    categoria: "satelite",
    inversion_monto: 8.18,
    numero_acciones: 1.0,
    precio_entrada: 8.18,
    tesis_inversion: null,
    fuentes_valoracion: null,
    precio_objetivo: null,
    margen_seguridad_pct: null,
  },
];

async function main() {
  console.log("\n📤 Migrando posiciones a inv_journal en Supabase...\n");

  const pendientes = POSICIONES_A_MIGRAR.filter(p => p.fecha === "FECHA_PENDIENTE");
  if (pendientes.length > 0) {
    console.log(`❌ Faltan fechas reales para: ${pendientes.map(p => p.ticker).join(", ")}`);
    console.log("   Edita este archivo y reemplaza FECHA_PENDIENTE por la fecha real (formato YYYY-MM-DD) antes de correr.\n");
    process.exit(1);
  }

  for (const pos of POSICIONES_A_MIGRAR) {
    try {
      const inserted = await insertJournalEntry(pos);
      console.log(`  ✅ ${pos.ticker} migrado — id: ${inserted.id}`);
    } catch (err) {
      console.log(`  ❌ ${pos.ticker} falló: ${err.message}`);
    }
  }

  console.log("\n✅ Migración completada. Verifica en Supabase Table Editor → inv_journal.\n");
}

main().catch(err => {
  console.error("\n❌ Error inesperado:", err.message);
  process.exit(1);
});
