#!/usr/bin/env node
/**
 * test-dry-run.js — Valida env vars y conectividad antes de correr analyze.js
 */
import { createClient } from '@supabase/supabase-js';
import Anthropic        from '@anthropic-ai/sdk';
import { MODEL }        from './analyze.js';

const SUPABASE_URL = 'https://mfixkkqtjyjcigeqhlvz.supabase.co';

const REQUIRED = ['ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_KEY', 'PORTFOLIO_USER_ID'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ Faltan variables de entorno:', missing.join(', '));
  process.exit(1);
}

console.log('✓ Variables de entorno presentes');

// Validar la key de verdad. `new Anthropic()` sólo construye un objeto en
// memoria: no toca la red, así que una key caducada pasaba el dry-run y
// reventaba un minuto después con el análisis ya arrancado.
// models.retrieve es una llamada real y sin coste de tokens, y de paso
// confirma que la cuenta tiene acceso al modelo que usa analyze.js.
try {
  const client = new Anthropic();
  const model  = await client.models.retrieve(MODEL);
  console.log(`✓ ANTHROPIC_API_KEY válida · modelo disponible: ${model.id}`);
} catch (e) {
  console.error(`❌ Anthropic (${MODEL}):`, e.message);
  process.exit(1);
}

// Validar Supabase connection
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const { error } = await supabase
  .from('portfolio_history')
  .select('id')
  .eq('user_id', process.env.PORTFOLIO_USER_ID)
  .limit(1);

if (error) {
  console.error('❌ Conexión a Supabase falló:', error.message);
  process.exit(1);
}

console.log('✓ Supabase conectado y portfolio_history accesible');

// Las migraciones deben estar corridas: si falta cualquiera de estas, el
// análisis fallaría a mitad, después de haber pagado la llamada a Anthropic.
const { error: priceErr } = await supabase
  .from('portfolio_assets').select('price_num').limit(1);
if (priceErr) {
  console.error('❌ Falta portfolio_assets.price_num — corre scripts/migration-price-numeric.sql');
  process.exit(1);
}
console.log('✓ portfolio_assets.price_num existe');

const { data: cashRow, error: cashErr } = await supabase
  .from('portfolio_cash')
  .select('amount')
  .eq('user_id', process.env.PORTFOLIO_USER_ID)
  .maybeSingle();

if (cashErr) {
  console.error('❌ Falta la tabla portfolio_cash — corre scripts/migration-cash-table.sql');
  process.exit(1);
}
if (!cashRow) {
  console.error('❌ portfolio_cash no tiene fila para este usuario — siembra el cash real');
  process.exit(1);
}
console.log(`✓ portfolio_cash accesible · cash actual $${cashRow.amount}`);

const { error: tipoErr } = await supabase
  .from('inv_journal').select('tipo').limit(1);
if (tipoErr) {
  console.error('❌ Falta inv_journal.tipo — corre scripts/migration-add-tipo-column.sql');
  process.exit(1);
}
console.log('✓ inv_journal.tipo existe');

console.log('\n✅ Dry-run OK — listo para ejecutar analyze.js\n');
