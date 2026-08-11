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
  async recordBuy(ticker, quantity, price, fundamento = null) {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('No autenticado');

    const entry = {
      user_id: user.id,
      fecha: new Date().toISOString().split('T')[0],
      ticker: ticker.toUpperCase(),
      categoria: 'satelite',
      inversion_monto: quantity * price,
      numero_acciones: quantity,
      precio_entrada: price,
      tesis_inversion: fundamento,
      fuentes_valoracion: null,
      precio_objetivo: null,
      margen_seguridad_pct: null
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
  async recordSale(ticker, quantity, price, reason = 'Otro', observations = null) {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('No autenticado');

    const montoBruto = quantity * price;

    const entry = {
      user_id: user.id,
      fecha_salida: new Date().toISOString().split('T')[0],
      ticker: ticker.toUpperCase(),
      numero_acciones_vendidas: quantity,
      precio_salida: price,
      monto_bruto: montoBruto,
      costo_base: 0,
      ganancia_bruta: 0,
      ganancia_pct: 0,
      razon_venta: reason,
      observaciones: observations
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
