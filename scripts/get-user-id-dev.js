/**
 * get-user-id-dev.js
 * Obtiene user_id usando credenciales de desarrollo
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mglcfwkmwblihbpnjuwb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbGNmd2ttd2JsaWhicG5qdXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAyMDY0MDksImV4cCI6MjAzNTc4MjQwOX0.bBYDgKt0S3pKvI0-U5PzwRaHBn9GjNuW3MH7MvFzlXc';
const DEV_EMAIL = 'andrestapiero@gmail.com';
const DEV_PASSWORD = 'TestPassword123!';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getUserId() {
  try {
    console.log('🔐 Autenticando con credenciales de desarrollo...');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD
    });

    if (error) {
      console.error('❌ Error de autenticación:', error.message);
      return;
    }

    const userId = data.user.id;
    console.log('\n✅ Usuario autenticado exitosamente');
    console.log('\n📋 Tu user_id es:\n');
    console.log(`   ${userId}\n`);
    console.log('📝 Actualiza migrate-history-to-supabase.js con:\n');
    console.log(`   const USER_ID = '${userId}';\n`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

getUserId();
