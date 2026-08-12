/**
 * config.js
 * Configuración centralizada de Supabase y credenciales
 */

export const SUPABASE_CONFIG = {
  url: 'https://mfixkkqtjyjcigeqhlvz.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maXhra3F0anlqY2lnZXFobHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDIyNjksImV4cCI6MjEwMTE3ODI2OX0.pOUEIF-xT0zaQGTiFc9MHTvwmMVmKt5iMb2jzJ4pWog'
};

export const AUTH_CONFIG = {
  devEmail: 'andrestapiero@gmail.com',
  devPassword: 'TestPassword123!' // Cambiar en producción
};

export const TABLES = {
  JOURNAL: 'inv_journal',
  PORTFOLIO_HISTORY: 'portfolio_history',
  PORTFOLIO_ASSETS: 'portfolio_assets'
};
