/**
 * history.js
 * Guarda y carga el historial de análisis semanales en JSON local
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = join(__dirname, "history.json");
const MAX_ENTRIES = 52; // 1 año de historial

export function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    const raw = readFileSync(HISTORY_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHistory(entry) {
  const history = loadHistory();

  // Evitar duplicados de la misma semana (sobrescribir si ya existe)
  const idx = history.findIndex((h) => h.week === entry.week);
  if (idx !== -1) {
    history[idx] = entry;
    console.log(`  📝 Semana ${entry.week} actualizada en historial`);
  } else {
    history.push(entry);
    console.log(`  📝 Semana ${entry.week} guardada en historial (total: ${history.length})`);
  }

  // Mantener solo las últimas MAX_ENTRIES semanas
  if (history.length > MAX_ENTRIES) {
    history.splice(0, history.length - MAX_ENTRIES);
  }

  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
  return history;
}
