/**
 * dca-log.js
 * Detecta cambios de cantidad en portfolio.json y los registra como compras DCA.
 * Guarda precio unitario y monto en USD de cada compra.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_FILE = join(__dirname, ".portfolio-snapshot.json");
const DCA_LOG_FILE  = join(__dirname, "dca-log.json");

export function loadDcaLog() {
  if (!existsSync(DCA_LOG_FILE)) return [];
  try { return JSON.parse(readFileSync(DCA_LOG_FILE, "utf8")); }
  catch { return []; }
}

function loadSnapshot() {
  if (!existsSync(SNAPSHOT_FILE)) return null;
  try { return JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")); }
  catch { return null; }
}

function saveSnapshot(portfolio) {
  const snap = { crypto: {}, stocks: {} };
  for (const [k, v] of Object.entries(portfolio.crypto || {})) snap.crypto[k] = v.qty;
  for (const [k, v] of Object.entries(portfolio.stocks || {})) snap.stocks[k] = v.shares;
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snap, null, 2), "utf8");
}

/**
 * Compara el portfolio actual con el snapshot anterior.
 * Si detecta aumento de cantidad, lo registra como compra DCA.
 * marketPrices: { btc: 63700, eth: 1679, voo: 673.20, ... }
 */
export function detectAndLogDCA(portfolio, marketPrices = {}) {
  const snapshot = loadSnapshot();
  const log = loadDcaLog();
  const today = new Date().toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric"
  });

  // Primera vez: solo guardar snapshot
  if (!snapshot) {
    saveSnapshot(portfolio);
    return log;
  }

  let changes = 0;

  // Crypto
  for (const [key, c] of Object.entries(portfolio.crypto || {})) {
    const prevQty = snapshot.crypto?.[key] || 0;
    const newQty  = c.qty || 0;
    if (newQty > prevQty + 0.0000001) {
      const added      = +(newQty - prevQty).toFixed(8);
      const unitPrice  = marketPrices[key] || c.costAvg || 0;
      const amountUSD  = +(added * unitPrice).toFixed(2);
      const entry = {
        date: today,
        asset: key,
        qtyAdded: added,
        unitPrice: unitPrice,
        amountUSD: amountUSD,
        note: "DCA / compra",
        type: "crypto"
      };
      log.push(entry);
      console.log(`  💰 DCA detectado: +${added} ${key.toUpperCase()} @ $${unitPrice} = $${amountUSD}`);
      changes++;
    }
  }

  // Acciones
  for (const [key, s] of Object.entries(portfolio.stocks || {})) {
    if (key === "cash") continue;
    const prevSh = snapshot.stocks?.[key] || 0;
    const newSh  = s.shares || 0;
    if (newSh > prevSh + 0.0000001) {
      const added     = +(newSh - prevSh).toFixed(6);
      const unitPrice = marketPrices[key] || s.costAvg || 0;
      const amountUSD = +(added * unitPrice).toFixed(2);
      const entry = {
        date: today,
        asset: key,
        qtyAdded: added,
        unitPrice: unitPrice,
        amountUSD: amountUSD,
        note: "DCA / compra",
        type: "stock"
      };
      log.push(entry);
      console.log(`  💰 DCA detectado: +${added} ${key.toUpperCase()} @ $${unitPrice} = $${amountUSD}`);
      changes++;
    }
  }

  if (changes > 0) {
    writeFileSync(DCA_LOG_FILE, JSON.stringify(log, null, 2), "utf8");
    console.log(`  📒 ${changes} compra(s) registrada(s) en bitacora`);
  }

  saveSnapshot(portfolio);
  return log;
}
