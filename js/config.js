/**
 * config.js
 * Configuración centralizada de Supabase y credenciales
 */

export const SUPABASE_CONFIG = {
  url: 'https://mglcfwkmwblihbpnjuwb.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbGNmd2ttd2JsaWhicG5qdXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAyMDY0MDksImV4cCI6MjAzNTc4MjQwOX0.bBYDgKt0S3pKvI0-U5PzwRaHBn9GjNuW3MH7MvFzlXc'
};

export const AUTH_CONFIG = {
  devEmail: 'andrestapiero@gmail.com',
  devPassword: 'TestPassword123!' // Cambiar en producción
};

export const TABLES = {
  JOURNAL: 'inv_journal'
};
