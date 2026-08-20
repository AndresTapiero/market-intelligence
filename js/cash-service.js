/**
 * CashService.js
 * Responsabilidad única: leer y escribir el cash disponible en Supabase.
 *
 * Antes el cash vivía en DOS sitios que nunca se hablaban:
 *   - la app escribía en auth.user_metadata.cash_amount
 *   - analyze.js leía de portfolio_history.portfolio_snapshot.cash,
 *     que sólo escribe él mismo
 *
 * Resultado: cada reporte mensual arrastraba el cash del reporte anterior,
 * así que el campo `total` de todo el histórico estaba mal — y la gráfica de
 * evolución del portafolio se dibuja sobre esos totales.
 *
 * Ahora la tabla portfolio_cash es el único almacén. El `cash` que analyze.js
 * sigue escribiendo dentro de portfolio_snapshot es un dato HISTÓRICO
 * («cuánto cash había el día del reporte»), no estado actual.
 */

import { TABLES } from './config.js';

export class CashService {
  constructor(supabaseClient, authService) {
    this.supabase = supabaseClient;
    this.authService = authService;
  }

  /**
   * Cash actual. Devuelve null si no se pudo leer, para que quien llama
   * distinga «no hay dato» de «el cash es cero».
   */
  async get() {
    const user = this.authService.getCurrentUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from(TABLES.CASH)
      .select('amount')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ No se pudo leer el cash:', error.message,
        '— ¿corriste scripts/migration-cash-table.sql?');
      return null;
    }
    if (!data) return null;

    const amount = Number(data.amount);
    return Number.isFinite(amount) ? amount : null;
  }

  /** Guarda el cash. Devuelve true si se persistió. */
  async set(amount) {
    const user = this.authService.getCurrentUser();
    if (!user) return false;

    const value = Math.max(0, Number(amount) || 0);

    const { error } = await this.supabase
      .from(TABLES.CASH)
      .upsert(
        { user_id: user.id, amount: value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.warn('⚠️ No se pudo guardar el cash:', error.message);
      return false;
    }

    console.log('✅ Cash guardado:', value);
    return true;
  }
}
