/**
 * get-user-id.js
 * Script para obtener tu user_id desde Supabase
 * Uso: node scripts/get-user-id.js
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const SUPABASE_URL = 'https://mglcfwkmwblihbpnjuwb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbGNmd2ttd2JsaWhicG5qdXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAyMDY0MDksImV4cCI6MjAzNTc4MjQwOX0.bBYDgKt0S3pKvI0-U5PzwRaHBn9GjNuW3MH7MvFzlXc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function getUserId() {
  return new Promise((resolve) => {
    rl.question('Email: ', async (email) => {
      rl.question('Password: ', async (password) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) {
            console.error('❌ Error de autenticación:', error.message);
            resolve(null);
          } else {
            const userId = data.user.id;
            console.log('\n✅ Tu user_id es:');
            console.log(`\n  ${userId}\n`);
            console.log('Cópialo y actualiza el script migrate-history-to-supabase.js:\n');
            console.log(`  const USER_ID = '${userId}';`);
            resolve(userId);
          }
        } catch (err) {
          console.error('❌ Error:', err.message);
          resolve(null);
        }
        rl.close();
      });
    });
  });
}

getUserId();
