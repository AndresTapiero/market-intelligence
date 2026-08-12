/**
 * config.js
 * Configuración centralizada de Supabase y credenciales
 */

export const SUPABASE_CONFIG = {
  url: 'https://mfixkkqtjyjcigeqhlvz.supabase.co',
  anonKey: 'sb_publishable_l9nDbU6-a3lB6RKWEXA8UQ_ndrUICBx'
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
