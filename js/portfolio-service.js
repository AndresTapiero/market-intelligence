/**
 * PortfolioService.js
 * Responsabilidad única: cargar y gestionar datos del portafolio
 */

import { TABLES } from './config.js';

export class PortfolioService {
  constructor(supabaseClient, authService) {
    this.supabase = supabaseClient;
    this.authService = authService;
    this.transactions = [];
  }

  /**
   * Carga todas las transacciones del usuario actual
   */
  async loadTransactions() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        console.warn('⚠️ No hay usuario autenticado');
        return [];
      }

      const { data, error } = await this.supabase
        .from(TABLES.JOURNAL)
        .select('*')
        .eq('user_id', user.id)
        .order('fecha', { ascending: false });

      if (error) throw error;

      this.transactions = data || [];
      console.log(`✅ ${this.transactions.length} transacciones cargadas`);

      return this.transactions;
    } catch (err) {
      console.warn('⚠️ Error cargando transacciones:', err.message);
      return [];
    }
  }

  /**
   * Obtiene todas las transacciones en caché
   */
  getTransactions() {
    return this.transactions;
  }

  /**
   * Obtiene transacciones de un ticker específico
   */
  getTickerTransactions(ticker) {
    return this.transactions.filter(t => t.ticker === ticker.toUpperCase());
  }
}
