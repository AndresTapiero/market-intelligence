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

  // Asignación objetivo: BTC va aparte del resto de cripto, y los ETFs aparte
  // de las acciones individuales. Los porcentajes son sobre el total CON cash.
  const valorDe = filtro => byAsset.filter(filtro).reduce((s, a) => s + a.market, 0);
  const pctDe   = v => (grandTotal > 0 ? (v / grandTotal) * 100 : 0);

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
    allocation: {
      btc:   pctDe(valorDe(a => a.key === 'btc')),
      alt:   pctDe(valorDe(a => a.type === 'crypto' && a.key !== 'btc')),
      etf:   pctDe(valorDe(a => a.type === 'etf')),
      stock: pctDe(valorDe(a => a.type === 'stock')),
      cash:  pctDe(efectivo),
    },
  };
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
