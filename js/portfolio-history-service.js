/**
 * PortfolioHistoryService.js
 * Gestiona datos históricos del portafolio desde history.json
 */

import { TABLES } from './config.js';

export class PortfolioHistoryService {
  constructor(supabaseClient, authService) {
    this.supabase = supabaseClient;
    this.authService = authService;
  }

  /**
   * Carga reportes históricos del portafolio
   */
  async loadHistoricalReports() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        console.warn('⚠️ No hay usuario autenticado');
        return [];
      }

      const { data, error } = await this.supabase
        .from(TABLES.PORTFOLIO_HISTORY)
        .select('*')
        .eq('user_id', user.id)
        .order('report_date', { ascending: false });

      if (error) throw error;

      console.log(`✅ ${data?.length || 0} reportes históricos cargados`);
      return data || [];
    } catch (err) {
      console.warn('⚠️ Error cargando reportes históricos:', err.message);
      return [];
    }
  }

  /**
   * Obtiene el reporte más reciente
   */
  async getLatestReport() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return null;

      const { data, error } = await this.supabase
        .from(TABLES.PORTFOLIO_HISTORY)
        .select('*')
        .eq('user_id', user.id)
        .order('report_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (err) {
      console.warn('⚠️ Error obteniendo último reporte:', err.message);
      return null;
    }
  }

  /**
   * Obtiene reporte para una fecha específica
   */
  async getReportByDate(date) {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return null;

      const { data, error } = await this.supabase
        .from(TABLES.PORTFOLIO_HISTORY)
        .select('*')
        .eq('user_id', user.id)
        .eq('report_date', date)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (err) {
      console.warn('⚠️ Error obteniendo reporte:', err.message);
      return null;
    }
  }

  /**
   * Carga composición de portafolio (assets con precio, cantidad, etc)
   */
  async loadPortfolioComposition(reportId) {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.PORTFOLIO_ASSETS)
        .select('*')
        .eq('report_id', reportId)
        .order('asset_key', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.warn('⚠️ Error cargando composición:', err.message);
      return [];
    }
  }
}
