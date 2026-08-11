/**
 * supabase-client.js
 * Cliente de Supabase para el diario de inversiones (tabla inv_journal).
 * Usa la service_role key — SOLO se corre desde backend/local, nunca desde
 * el navegador. Sigue el mismo patron de seguridad que centro-financiero.
 */

import { createClient } from "@supabase/supabase-js";

let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno."
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}

export async function insertJournalEntry(entry) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("inv_journal").insert(entry).select();
  if (error) throw new Error(`Error insertando en inv_journal: ${error.message}`);
  return data[0];
}

export async function loadJournalEntries() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inv_journal")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) throw new Error(`Error leyendo inv_journal: ${error.message}`);
  return data;
}

export async function updateJournalEntry(id, changes) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inv_journal")
    .update(changes)
    .eq("id", id)
    .select();
  if (error) throw new Error(`Error actualizando inv_journal: ${error.message}`);
  return data[0];
}

export async function insertExitEntry(entry) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("inv_journal_exits").insert(entry).select();
  if (error) throw new Error(`Error insertando en inv_journal_exits: ${error.message}`);
  return data[0];
}

export async function loadExitEntries() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inv_journal_exits")
    .select("*")
    .order("fecha_salida", { ascending: false });
  if (error) throw new Error(`Error leyendo inv_journal_exits: ${error.message}`);
  return data;
}
