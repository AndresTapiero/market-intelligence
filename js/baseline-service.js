/**
 * BaselineService.js
 * Responsabilidad única: leer el baseline de posiciones desde Supabase.
 *
 * Antes esto era un archivo de código (js/baseline.js) — la única de las
 * fuentes de datos del proyecto que no vivía en Supabase. Corregir un dato
 * (un costAvg mal cargado, por ejemplo) exigía un commit y un deploy, cuando
 * todo lo demás (cash, tipo, precios) se corrige con un UPDATE de SQL.
 *
 * Mismo patrón de resiliencia que CashService y el price_num de la fase 1:
 * intenta Supabase primero, y si la tabla no existe o está vacía —por
 * ejemplo, si aún no se corrió la migración— cae al archivo local y avisa
 * por consola. La app nunca se rompe por no haber migrado todavía.
 */

import { TABLES } from './config.js';
import { BASELINE as BASELINE_LOCAL } from './baseline.js';

export class BaselineService {
  constructor(supabaseClient, authService) {
    this.supabase = supabaseClient;
    this.authService = authService;
  }

  /**
   * @returns {{ holdings: object, assetData: Array, colors: object, fromSupabase: boolean }}
   */
  async load() {
    const filas = await this._fetchRows();
    if (filas) return this._build(filas, true);

    console.warn(
      '⚠️ portfolio_baseline no disponible — usando js/baseline.js local. ' +
      'Corre scripts/migration-baseline-table.sql para editar el baseline sin desplegar.'
    );
    return this._build(
      Object.entries(BASELINE_LOCAL).map(([ticker, a]) => ({ ticker, ...a })),
      false
    );
  }

  async _fetchRows() {
    const user = this.authService.getCurrentUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from(TABLES.BASELINE)
      .select('ticker, qty, cost_avg, type, label, icon, color, seed_price')
      .eq('user_id', user.id);

    if (error || !data?.length) return null;

    return data.map(r => ({
      ticker:    r.ticker,
      qty:       Number(r.qty) || 0,
      costAvg:   Number(r.cost_avg) || 0,
      type:      r.type,
      label:     r.label,
      icon:      r.icon,
      color:     r.color,
      seedPrice: Number(r.seed_price) || 0,
    }));
  }

  /** Misma forma que antes producían buildHoldings/buildAssetData/buildColors. */
  _build(filas, fromSupabase) {
    const holdings = {};
    const colors   = {};
    const assetData = [];

    for (const a of filas) {
      holdings[a.ticker] = { qty: a.qty, costAvg: a.costAvg, type: a.type, label: a.label, fundamento: '' };
      colors[a.ticker]   = a.color;
      assetData.push({
        ticker:  a.ticker.toUpperCase(),
        label:   a.label,
        icon:    a.icon,
        type:    a.type,
        signal:  'hold',
        price:   a.seedPrice,
        change:  '0%',
        costAvg: a.costAvg,
        current: a.seedPrice,
        invested: 0,
        actual:   0,
        delta:   '0',
        context: '—',
        class:   'asset-' + a.ticker,
      });
    }

    return { holdings, assetData, colors, fromSupabase };
  }
}
