// portfolio-model.js — Todo el cálculo financiero, en funciones puras.
//
// Sin DOM, sin `window`, sin Supabase: todo entra por parámetros y sale por
// el valor de retorno. Esa es la razón de existir del archivo — es lo que
// hace el proyecto testeable.
//
// Antes el bucle "recorrer ASSET_DATA, cruzar con EXISTING_ASSETS y acumular
// valor y coste por categoría" estaba reescrito, con variaciones sutiles, en
// seis sitios: app.js (_renderPortfolioChart, _updateAnalisisTab,
// _updateResumenCards, _updateStickyBar) y portfolio-ui.js (renderPnl,
// renderComp). Seis lugares que podían divergir con cualquier cambio de regla.
//
// analyze.js importa este mismo módulo, así que el reporte mensual y el
// dashboard no pueden discrepar por construcción.

/** Un activo cuenta como acción/ETF si no es cripto. */
export const esEquity = tipo => tipo === 'stock' || tipo === 'etf';

/**
 * Costo promedio ponderado tras una compra. La comisión entra en el costo,
 * no en la cantidad: pagas más por las mismas unidades.
 */
export function weightedCostAvg(prevQty, prevCostAvg, addQty, addPrice, fee = 0) {
  const costoTotal = addQty * addPrice + fee;
  const nuevaQty   = prevQty + addQty;
  if (nuevaQty <= 0) return 0;
  if (prevQty <= 0)  return costoTotal / addQty;
  return (prevQty * prevCostAvg + costoTotal) / nuevaQty;
}

/** P&L de una venta. La comisión se resta del bruto. */
export function sellPnl(qty, price, costAvg, fee = 0) {
  const bruto = qty * price;
  const neto  = bruto - fee;
  const costo = qty * costAvg;
  const pnl   = neto - costo;
  return {
    bruto, neto, costo, pnl,
    pnlPct: costo > 0 ? (pnl / costo) * 100 : 0,
  };
}

/**
 * Reconstruye las posiciones aplicando el journal sobre el baseline.
 *
 * Es idempotente por diseño: `baseline` no se muta y el resultado depende sólo
 * de los argumentos. Llamarla N veces con lo mismo da lo mismo — lo contrario
 * causaba que las cantidades se duplicaran en cada sincronización.
 *
 * @param {object} baseline - clave → {qty, costAvg, type, label}
 * @param {Array}  journal  - filas de inv_journal
 */
export function applyJournal(baseline, journal) {
  const out = {};
  for (const [k, a] of Object.entries(baseline ?? {})) out[k] = { ...a };

  // Orden cronológico: el costo promedio ponderado depende de la secuencia.
  const filas = [...(journal ?? [])].sort(
    (a, b) => new Date(a.fecha ?? 0) - new Date(b.fecha ?? 0)
  );

  for (const row of filas) {
    const ticker = String(row.ticker ?? '').toLowerCase();
    if (!ticker) continue;

    const qty   = parseFloat(row.numero_acciones) || 0;
    const price = parseFloat(row.precio_entrada)  || 0;
    const esVenta = !!row.fecha_venta;

    if (esVenta) {
      // Una venta resta cantidad y NO altera el costo promedio: lo que queda
      // se compró al mismo precio medio que antes.
      if (out[ticker]) out[ticker].qty = Math.max(0, out[ticker].qty - qty);
      continue;
    }

    if (out[ticker]) {
      out[ticker].costAvg = weightedCostAvg(out[ticker].qty, out[ticker].costAvg, qty, price);
      out[ticker].qty     = out[ticker].qty + qty;
    } else {
      out[ticker] = {
        qty, costAvg: price,
        type:  row.tipo || 'crypto',
        label: ticker.toUpperCase(),
        fundamento: '',
      };
    }
  }
  return out;
}

/**
 * Calcula todos los agregados del portafolio de una sola vez.
 *
 * @param {object} holdings - salida de applyJournal
 * @param {object} prices   - clave → precio actual (número)
 * @param {number} cash
 */
export function computePortfolio(holdings, prices = {}, cash = 0) {
  const efectivo = Number(cash) || 0;
  const byAsset = [];

  for (const [key, h] of Object.entries(holdings ?? {})) {
    // Un activo sin unidades no existe para ningún agregado.
    if (!h || !(h.qty > 0)) continue;

    const price   = Number(prices[key]);
    const precio  = Number.isFinite(price) && price > 0 ? price : 0;
    const costAvg = Number(h.costAvg) || 0;
    const cost    = h.qty * costAvg;
    const market  = h.qty * precio;
    const pnl     = market - cost;

    byAsset.push({
      key,
      ticker: key.toUpperCase(),
      label:  h.label || key.toUpperCase(),
      type:   h.type,
      qty:    h.qty,
      costAvg, price: precio, cost, market, pnl,
      // Sin costo no hay porcentaje posible: 0 en vez de NaN o Infinity.
      pnlPct: cost > 0 ? (pnl / cost) * 100 : 0,
    });
  }

  byAsset.sort((a, b) => b.market - a.market);

  const acumular = filtro => {
    const items  = byAsset.filter(filtro);
    const market = items.reduce((s, a) => s + a.market, 0);
    const cost   = items.reduce((s, a) => s + a.cost, 0);
    const pnl    = market - cost;
    return { market, cost, pnl, pnlPct: cost > 0 ? (pnl / cost) * 100 : 0, count: items.length };
  };

  const crypto = acumular(a => a.type === 'crypto');
  const stocks = acumular(a => esEquity(a.type));

  const market = crypto.market + stocks.market;
  const cost   = crypto.cost + stocks.cost;
  const pnl    = market - cost;
  const grandTotal = market + efectivo;

  // El porcentaje de asignación es sobre lo INVERTIDO, no sobre el total con
  // cash: unos objetivos que suman 100% serían inalcanzables por definición si
  // el cash entrara en el denominador. El cash se reporta aparte, sobre el
  // gran total, que es como tiene sentido leerlo.
  const valorDe = filtro => byAsset.filter(filtro).reduce((s, a) => s + a.market, 0);
  const pctDe   = v => (market > 0 ? (v / market) * 100 : 0);

  return {
    totals: {
      market, cost, pnl,
      pnlPct: cost > 0 ? (pnl / cost) * 100 : 0,
      cash: efectivo,
      grandTotal,
    },
    byType: { crypto, stocks },
    byAsset,
    ratios: {
      cryptoPct: market > 0 ? (crypto.market / market) * 100 : 0,
      stocksPct: market > 0 ? (stocks.market / market) * 100 : 0,
    },
    // BTC y ETH tienen objetivo propio; `alt` es todo el resto de cripto.
    allocation: {
      btc:   pctDe(valorDe(a => a.key === 'btc')),
      eth:   pctDe(valorDe(a => a.key === 'eth')),
      alt:   pctDe(valorDe(a => a.type === 'crypto' && a.key !== 'btc' && a.key !== 'eth')),
      etf:   pctDe(valorDe(a => a.type === 'etf')),
      stock: pctDe(valorDe(a => a.type === 'stock')),
      cash:  grandTotal > 0 ? (efectivo / grandTotal) * 100 : 0,
    },
  };
}

// ─── ASIGNACIÓN OBJETIVO ──────────────────────────────────────────────────────
// Estrategia: girar hacia renta variable y concentrar la cripto en BTC y ETH.
// Las altcoins quedan en salida gradual (5%), sin forzar ventas.
// Suman 100% porque se miden sobre lo invertido, no sobre el total con cash.
export const ALLOCATION_TARGETS = [
  { key: 'stock', label: 'Acciones indiv.', target: 35, color: '#4d8fff' },
  { key: 'etf',   label: 'ETFs',            target: 25, color: '#00d4a0' },
  { key: 'btc',   label: 'Bitcoin',         target: 25, color: '#f7931a' },
  { key: 'eth',   label: 'Ethereum',        target: 10, color: '#627eea' },
  { key: 'alt',   label: 'Altcoins',        target:  5, color: '#8b6dff' },
];

// ─── DCA ──────────────────────────────────────────────────────────────────────
// La estrategia: $50 en BTC y $50 en acciones cada mes. `dia` es cuándo toca.
export const DCA_TARGETS = [
  { id: 'btc',     label: 'DCA Bitcoin',  icon: '₿',  color: '#f7931a', tickers: ['btc'],               monto: 50, dia: 1  },
  { id: 'stocks',  label: 'DCA Acciones', icon: '📈', color: '#00d4a0', tickers: ['voo', 'qqq'],        monto: 50, dia: 30 },
];

/** Primer día del mes de `fecha`, en horario local. */
const inicioDeMes = fecha => new Date(fecha.getFullYear(), fecha.getMonth(), 1);

/**
 * Estado del DCA del mes en curso, derivado del journal.
 *
 * Antes el tracker mostraba "$50 USD / mes", "Próximo: agosto 1, 2026" y unos
 * contadores "+4 / $200" escritos a mano que nunca se movían. Ahora sale de las
 * compras reales: si este mes ya pusiste los $50, la ficha se marca cumplida.
 *
 * @param {Array}  journal  filas de inv_journal
 * @param {Date}   hoy
 * @param {Array}  targets  por defecto DCA_TARGETS
 */
export function dcaStatus(journal, hoy = new Date(), targets = DCA_TARGETS) {
  const desde = inicioDeMes(hoy);

  const delMes = (journal ?? []).filter(row => {
    if (row.fecha_venta) return false;            // las ventas no cuentan como DCA
    const f = new Date(row.fecha);
    return !Number.isNaN(+f) && f >= desde && f <= hoy;
  });

  return targets.map(t => {
    const invertido = delMes
      .filter(r => t.tickers.includes(String(r.ticker ?? '').toLowerCase()))
      .reduce((s, r) => {
        const monto = parseFloat(r.inversion_monto);
        if (Number.isFinite(monto)) return s + monto;
        // Fallback si falta inversion_monto: cantidad × precio
        return s + (parseFloat(r.numero_acciones) || 0) * (parseFloat(r.precio_entrada) || 0);
      }, 0);

    const completo = invertido >= t.monto;
    return {
      ...t,
      invertido,
      completo,
      falta: Math.max(0, t.monto - invertido),
      // Parcial: puso algo pero no lo suficiente.
      parcial: invertido > 0 && !completo,
      proxima: proximaFecha(t.dia, hoy, completo),
    };
  });
}

/**
 * Próxima fecha en que toca un DCA.
 *
 * Si ya está cumplido este mes, apunta al mes siguiente. `dia` se recorta al
 * último día real del mes, para que "día 30" funcione en febrero.
 */
export function proximaFecha(dia, hoy = new Date(), yaCumplido = false) {
  const candidato = mes => {
    const ultimo = new Date(hoy.getFullYear(), mes + 1, 0).getDate();
    return new Date(hoy.getFullYear(), mes, Math.min(dia, ultimo));
  };

  let f = candidato(hoy.getMonth());
  if (yaCumplido || f < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
    f = candidato(hoy.getMonth() + 1);
  }
  return f;
}

/**
 * Eventos futuros ordenados: los del DCA (calculados aquí) más los de mercado
 * que trae el análisis mensual.
 *
 * @param {Array} dca            salida de dcaStatus
 * @param {Array} eventosMercado [{ fecha: 'YYYY-MM-DD', tipo, texto }]
 * @param {Date}  hoy
 * @param {number} limite
 */
export function upcomingEvents(dca = [], eventosMercado = [], hoy = new Date(), limite = 5) {
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const deDca = dca.map(t => ({
    fecha: t.proxima,
    tipo:  'dca',
    texto: `${t.label} $${t.monto}`,
    color: t.color,
  }));

  const deMercado = (eventosMercado ?? [])
    .map(e => {
      const f = new Date(e.fecha + 'T00:00:00');
      return Number.isNaN(+f) ? null : { fecha: f, tipo: e.tipo || 'evento', texto: e.texto, color: null };
    })
    .filter(Boolean);

  return [...deDca, ...deMercado]
    .filter(e => e.fecha >= hoySinHora)
    .sort((a, b) => a.fecha - b.fecha)
    .slice(0, limite);
}

/** Mapa clave → precio a partir de la lista de metadatos de mercado. */
export function pricesFromAssetData(assetData = []) {
  const out = {};
  for (const a of assetData) {
    const p = Number(a?.price);
    if (a?.ticker && Number.isFinite(p) && p > 0) out[a.ticker.toLowerCase()] = p;
  }
  return out;
}
