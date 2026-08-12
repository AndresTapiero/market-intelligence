/**
 * TransactionService.js
 * Responsabilidad única: registrar compras y ventas en Supabase
 */

import { TABLES } from './config.js';

export class TransactionService {
  constructor(supabaseClient, authService) {
    this.supabase = supabaseClient;
    this.authService = authService;
  }

  /**
   * Registra una compra
   */
  async recordBuy(ticker, quantity, price, fundamento = null, date = null, targetPrice = null, assetType = 'crypto') {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('No autenticado');

    const categoria = assetType === 'stock' || assetType === 'etf' ? 'core' : 'satelite';

    const entry = {
      user_id: user.id,
      fecha: date || new Date().toISOString().split('T')[0],
      ticker: ticker.toUpperCase(),
      categoria,
      inversion_monto: quantity * price,
      numero_acciones: quantity,
      precio_entrada: price,
      tesis_inversion: fundamento || null,
      precio_objetivo: targetPrice || null
    };

    try {
      const { data, error } = await this.supabase
        .from(TABLES.JOURNAL)
        .insert([entry])
        .select();

      if (error) throw error;

      console.log('✅ Compra registrada:', data);
      return { success: true, data: data[0] };
    } catch (err) {
      console.warn('⚠️ Error registrando compra:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Registra una venta
   */
  async recordSale(ticker, quantity, price, reason = 'Otro', observations = null, date = null, commission = 0, costAvg = 0, pnlPct = null) {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('No autenticado');

    const montoBruto = quantity * price;
    const montoNeto = montoBruto - commission;

    const entry = {
      user_id: user.id,
      fecha: date || new Date().toISOString().split('T')[0],
      ticker: ticker.toUpperCase(),
      categoria: 'venta',
      inversion_monto: montoBruto,
      numero_acciones: quantity,
      precio_entrada: costAvg || 0,
      precio_salida: price,
      ganancia_perdida_pct: pnlPct !== null ? parseFloat(pnlPct.toFixed(2)) : null,
      fecha_venta: date || new Date().toISOString().split('T')[0],
      razon_venta: reason || null,
      comision: commission > 0 ? commission : null,
      monto_neto: montoNeto,
      tesis_inversion: observations || null
    };

    try {
      const { data, error } = await this.supabase
        .from(TABLES.JOURNAL)
        .insert([entry])
        .select();

      if (error) throw error;

      console.log('✅ Venta registrada:', data);
      return { success: true, data: data[0] };
    } catch (err) {
      console.warn('⚠️ Error registrando venta:', err.message);
      return { success: false, error: err.message };
    }
  }
}
