/**
 * TransactionService.js
 * Servicio para registrar transacciones en Supabase
 * Responsabilidad única: comunicarse con Supabase
 */

export class TransactionService {
  constructor(supabaseClient = null) {
    this.client = supabaseClient;
    this.userId = '56272fef-8fd2-4adf-af86-ff9ed10cbed1';
  }

  /**
   * Registra una venta en Supabase
   */
  async recordSale(ticker, quantity, price, reason, observations = null) {
    if (!this.client) {
      console.warn('⚠️  Supabase no disponible');
      return { id: 'local-' + Date.now() };
    }

    const montoBruto = quantity * price;
    const gananciaBruta = montoBruto; // Se calcula en Portfolio

    const exitEntry = {
      user_id: this.userId,
      fecha_salida: new Date().toISOString().split('T')[0],
      ticker: ticker.toUpperCase(),
      numero_acciones_vendidas: quantity,
      precio_salida: price,
      monto_bruto: montoBruto,
      costo_base: 0, // Se calcula en Portfolio
      ganancia_bruta: gananciaBruta,
      ganancia_pct: 0, // Se calcula en Portfolio
      razon_venta: reason,
      observaciones: observations
    };

    try {
      const { data, error } = await this.client
        .from('inv_journal_exits')
        .insert(exitEntry)
        .select();

      if (error) throw error;
      return data[0];
    } catch (err) {
      console.error('Error registrando venta en Supabase:', err);
      throw err;
    }
  }

  /**
   * Registra una compra en Supabase
   */
  async recordPurchase(ticker, quantity, price, tesis = null, fuentes = null) {
    if (!this.client) {
      console.warn('⚠️  Supabase no disponible');
      return { id: 'local-' + Date.now() };
    }

    const purchaseEntry = {
      user_id: this.userId,
      fecha: new Date().toISOString().split('T')[0],
      ticker: ticker.toUpperCase(),
      categoria: 'satelite',
      inversion_monto: quantity * price,
      numero_acciones: quantity,
      precio_entrada: price,
      tesis_inversion: tesis,
      fuentes_valoracion: fuentes,
      precio_objetivo: null,
      margen_seguridad_pct: null
    };

    try {
      const { data, error } = await this.client
        .from('inv_journal')
        .insert(purchaseEntry)
        .select();

      if (error) throw error;
      return data[0];
    } catch (err) {
      console.error('Error registrando compra en Supabase:', err);
      throw err;
    }
  }

  /**
   * Carga todas las transacciones
   */
  async loadTransactions() {
    if (!this.client) return [];

    try {
      const { data, error } = await this.client
        .from('inv_journal_exits')
        .select('*')
        .order('fecha_salida', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error cargando transacciones:', err);
      return [];
    }
  }
}
