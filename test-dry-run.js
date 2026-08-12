#!/usr/bin/env node
/**
 * test-dry-run.js — Valida env vars y conectividad antes de correr analyze.js
 */
import { createClient } from '@supabase/supabase-js';
import Anthropic        from '@anthropic-ai/sdk';

const SUPABASE_URL = 'https://mfixkkqtjyjcigeqhlvz.supabase.co';

const REQUIRED = ['ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_KEY', 'PORTFOLIO_USER_ID'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ Faltan variables de entorno:', missing.join(', '));
  process.exit(1);
}

console.log('✓ Variables de entorno presentes');

// Validar Anthropic key (instancia sin llamada de red)
try { new Anthropic(); console.log('✓ ANTHROPIC_API_KEY válida'); }
catch (e) { console.error('❌ ANTHROPIC_API_KEY inválida:', e.message); process.exit(1); }

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
console.log('\n✅ Dry-run OK — listo para ejecutar analyze.js\n');
