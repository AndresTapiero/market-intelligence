#!/usr/bin/env node
/**
 * analyze.js v3 — Nueva arquitectura Supabase-first
 *
 * Flujo:
 *   1. Lee posiciones actuales desde Supabase (inv_journal)
 *   2. Llama Anthropic API con web_search para obtener precios y análisis
 *   3. Guarda en Supabase: portfolio_history + portfolio_assets
 *   4. Regenera tabs/resumen.html con el análisis fresco
 *   5. Git push de tabs/resumen.html (NO toca latest-report.html)
 *
 * Secrets requeridos en GitHub Actions:
 *   ANTHROPIC_API_KEY      — clave de Anthropic
 *   SUPABASE_SERVICE_KEY   — service role key (bypass RLS)
 *   PORTFOLIO_USER_ID      — UUID del usuario en Supabase
 */

import Anthropic            from '@anthropic-ai/sdk';
import { createClient }     from '@supabase/supabase-js';
import { buildHoldings }    from './js/baseline.js';
import { writeFileSync }    from 'fs';
import { pathToFileURL }    from 'url';
import { exec as execCb }   from 'child_process';
import { promisify }        from 'util';

const exec = promisify(execCb);

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL        = 'https://mfixkkqtjyjcigeqhlvz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const USER_ID             = process.env.PORTFOLIO_USER_ID;

// Sonnet 5 en vez de Opus: el análisis corre una vez al mes y la diferencia de
// coste no compensa aquí. Cambiar a 'claude-opus-5' si la calidad no alcanza.
export const MODEL = 'claude-sonnet-5';

// Activos que reciben análisis narrativo completo (accionables).
// Esto sí es una decisión de estrategia, no un dato — se queda como constante.
const ACCIONABLES = ['btc', 'voo', 'qqq', 'nvda'];
const WATCHLIST   = ['schd', 'vti'];

// La lista de tickers a analizar YA NO es una constante: se deriva de las
// posiciones reales en Supabase (ver deriveKeys). Antes era fija y por eso
// cualquier activo comprado desde la app —META, IREN— nunca recibía precio
// del análisis mensual y se quedaba congelado en su costAvg para siempre.
//
// El baseline de posiciones vive en js/baseline.js, compartido con la app.

/** Tickers con posición abierta, en orden estable (prompt cacheable). */
function deriveKeys(positions) {
  return Object.entries(positions)
    .filter(([, a]) => a.qty > 0)
    .map(([k]) => k)
    .sort();
}

// ─── SCHEMA DE SALIDA ─────────────────────────────────────────────────────────
/**
 * JSON Schema del análisis.
 *
 * Los activos van como LISTA con el ticker dentro de cada elemento, no como un
 * objeto indexado por ticker. Es la única forma que satisface las dos
 * restricciones de la API, que se descubrieron una tras otra:
 *
 *   1. Enumerar un sub-schema por ticker →
 *        400 The compiled grammar is too large [...] Simplify your tool schemas
 *      Con 16 activos son 16 copias del mismo objeto.
 *
 *   2. Un mapa dinámico con additionalProperties: <sub-schema> →
 *        400 For 'object' type, 'additionalProperties: object' is not supported.
 *            Please set 'additionalProperties' to false
 *      Structured outputs exige objetos cerrados.
 *
 * Una lista resuelve ambas: un solo `items` (gramática pequeña, y que no crece
 * al comprar activos nuevos) y todos los objetos cerrados. Se convierte a mapa
 * en código con assetsFromList().
 *
 * `price` sigue siendo number, que es lo que impedía que los precios llegaran al
 * dashboard (ver toNumber y la fase 1).
 *
 * El schema es constante: no depende de los tickers del mes, así que el prefijo
 * de la petición se mantiene estable entre corridas.
 */
const ANALYSIS_SCHEMA = (() => {
  const assetSchema = {
    type: 'object', additionalProperties: false,
    properties: {
      ticker:   { type: 'string', description: 'Ticker en minusculas, tal como se pidio.' },
      price:    { type: 'number', description: 'Precio actual en USD. Solo el numero, sin simbolo de moneda ni separadores de miles.' },
      change7d: { type: 'string', description: 'Variacion a 7 dias, por ejemplo "+1.4%" o "-3.2%".' },
      signal:   { type: 'string', enum: ['BUY', 'HOLD', 'WAIT'] },
      context:  { type: 'string', description: 'Solo para los activos accionables: 2 oraciones de analisis en ASCII. En el resto, cadena vacia.' },
    },
    required: ['ticker', 'price', 'change7d', 'signal', 'context'],
  };

  const watchSchema = {
    type: 'object', additionalProperties: false,
    properties: {
      ticker:   { type: 'string', description: 'Ticker en minusculas.' },
      price:    { type: 'number' },
      change7d: { type: 'string' },
      signal:   { type: 'string', enum: ['BUY', 'WAIT'] },
      note:     { type: 'string', description: '1 oracion evaluando la entrada, en ASCII.' },
    },
    required: ['ticker', 'price', 'change7d', 'signal', 'note'],
  };

  return {
    type: 'object',
    additionalProperties: false,
    // Structured outputs exige que `required` cubra TODAS las properties
    // declaradas. newOpportunities y watchlist pueden venir como lista vacía,
    // pero tienen que venir.
    required: ['analystOpinion', 'riskProfile', 'assets', 'macro', 'newOpportunities', 'watchlist', 'actions'],
    properties: {
      analystOpinion: { type: 'string', description: '3-4 oraciones ASCII: que funciona, que arrastra, recomendacion del mes.' },
      riskProfile:    { type: 'string' },
      assets: {
        type: 'array',
        description: 'Un elemento por cada ticker solicitado.',
        items: assetSchema,
      },
      macro: {
        type: 'object', additionalProperties: false,
        properties: {
          usdcop:         { type: 'number', description: 'TRM en pesos por dolar. Solo el numero, ej 4150.32' },
          fedrate:        { type: 'string', description: 'Rango de la tasa FED, ej "4.25%-4.50%"' },
          btcDominance:   { type: 'string', description: 'Dominancia de BTC, ej "56.4%"' },
          fearGreed:      { type: 'number', description: 'Indice Fear & Greed de 0 a 100.' },
          fearGreedLabel: { type: 'string', description: 'Etiqueta en espanol, ej "Miedo".' },
          narrative:      { type: 'string', description: '2 oraciones de contexto macro en ASCII.' },
        },
        required: ['usdcop', 'fedrate', 'btcDominance', 'fearGreed', 'fearGreedLabel', 'narrative'],
      },
      newOpportunities: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            asset:  { type: 'string' },
            reason: { type: 'string', description: 'Por que tiene sentido ahora, 1-2 oraciones ASCII.' },
            risk:   { type: 'string', description: 'Riesgo principal, en ASCII.' },
          },
          required: ['asset', 'reason', 'risk'],
        },
      },
      watchlist: {
        type: 'array',
        description: 'Un elemento por cada ticker de la watchlist.',
        items: watchSchema,
      },
      actions: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            num:  { type: 'string', description: 'Numero de dos digitos, ej "01".' },
            text: { type: 'string', description: 'Accion concreta, en ASCII.' },
          },
          required: ['num', 'text'],
        },
      },
    },
  };
})();

/**
 * Convierte la lista de activos del modelo en el mapa {ticker: datos} que
 * consume el resto del script. El schema obliga a lista (ver ANALYSIS_SCHEMA);
 * el mapa es más cómodo para cruzar contra las posiciones.
 *
 * Normaliza el ticker a minúsculas y descarta duplicados quedándose con el
 * primero, para que un modelo que repita una entrada no pise datos buenos.
 */
function assetsFromList(list) {
  const out = {};
  for (const item of Array.isArray(list) ? list : []) {
    const key = String(item?.ticker ?? '').trim().toLowerCase();
    if (!key) continue;
    if (out[key]) {
      console.warn(`⚠️ ${key.toUpperCase()} repetido en la respuesta — se ignora la copia`);
      continue;
    }
    out[key] = item;
  }
  return out;
}

/**
 * Comprueba que el modelo devolvió los activos pedidos.
 *
 * Reemplaza la garantía que daba enumerar los tickers en el schema, que hubo
 * que quitar porque la gramática compilada se pasaba de tamaño. Avisa por cada
 * ticker ausente en vez de tumbar la corrida entera: perder el precio de un
 * activo un mes es molesto, perder el reporte completo lo es más.
 */
function validateAssets(assets, keys) {
  const faltan = keys.filter(k => !assets[k]);
  if (faltan.length) {
    console.warn(`⚠️ El modelo no devolvió: ${faltan.join(', ').toUpperCase()}`);
  }
  const sobran = Object.keys(assets).filter(k => !keys.includes(k));
  if (sobran.length) {
    console.warn(`⚠️ Activos no solicitados, se ignoran: ${sobran.join(', ').toUpperCase()}`);
  }
  if (faltan.length === keys.length) {
    throw new Error('El modelo no devolvió ningún activo de los solicitados');
  }
  const sinContexto = keys.filter(k => ACCIONABLES.includes(k) && assets[k] && !assets[k].context);
  if (sinContexto.length) {
    console.warn(`⚠️ Sin análisis narrativo: ${sinContexto.join(', ').toUpperCase()}`);
  }
}

// ─── LLAMADA A LA API ─────────────────────────────────────────────────────────
/** Reintenta sólo lo que tiene sentido reintentar: rate limits y 5xx. */
async function callWithRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err instanceof Anthropic.RateLimitError
        || (err instanceof Anthropic.APIError && err.status >= 500);
      if (!retryable || i === attempts - 1) throw err;
      const wait = 2 ** i * 5000;
      console.warn(`⚠️ ${err.status ?? '?'} de Anthropic — reintento en ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

/**
 * Ejecuta el análisis manejando `stop_reason`.
 *
 * web_search corre en el servidor de Anthropic y puede devolver `pause_turn`
 * para que continúes la conversación. Antes eso no se manejaba: llegaba una
 * respuesta parcial y un parser tolerante la remendaba cerrando llaves a mano.
 */
async function runAnalysis(anthropic, params) {
  let messages = params.messages;

  for (let turn = 0; turn < 5; turn++) {
    const response = await callWithRetry(() => anthropic.messages.create({ ...params, messages }));

    switch (response.stop_reason) {
      case 'pause_turn':
        messages = [...messages, { role: 'assistant', content: response.content }];
        console.log(`   … búsqueda en curso, reanudando (turno ${turn + 2})`);
        continue;
      case 'max_tokens':
        throw new Error('Respuesta truncada por max_tokens — súbelo o reduce el alcance del prompt');
      case 'refusal':
        throw new Error(`El modelo rechazó la petición: ${response.stop_details?.explanation ?? 'sin detalle'}`);
      default:
        return response;
    }
  }
  throw new Error('Demasiados pause_turn consecutivos — la búsqueda no converge');
}

// ─── PARSEO DE PRECIOS ────────────────────────────────────────────────────────
/**
 * Convierte a número lo que devuelva el modelo para un precio.
 *   "$63,736.05" → 63736.05    "63,736.05" → 63736.05
 *   206.83       → 206.83      "N/A" | "" | null → null
 *
 * Existe porque `parseFloat` es una trampa aquí: sobre "$63,736.05" da NaN,
 * y sobre "63,736.05" da 63 — se detiene en la coma. Guardar ese 63 como
 * precio de BTC arrasaría la valoración del portafolio sin lanzar un error.
 * Por eso se limpian los separadores ANTES de parsear, y se devuelve null
 * en vez de un número dudoso.
 */
function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string')  return null;
  const cleaned = v.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** La TRM ahora llega como número (schema): se formatea al renderizar. */
function fmtTRM(v) {
  const n = toNumber(v);
  return n === null
    ? '—'
    : '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' COP';
}

// ─── POSICIONES DESDE SUPABASE ────────────────────────────────────────────────
async function getPositions(supabase) {
  const { data, error } = await supabase
    .from('inv_journal')
    .select('ticker, tipo, numero_acciones, precio_entrada, fecha_venta, fecha')
    .eq('user_id', USER_ID)
    .order('fecha', { ascending: true });

  if (error) throw new Error(`Error leyendo inv_journal: ${error.message}`);

  const computed = buildHoldings();   // baseline compartido con la app

  (data || []).forEach(row => {
    const ticker = row.ticker.toLowerCase();
    const qty    = parseFloat(row.numero_acciones) || 0;
    const price  = parseFloat(row.precio_entrada)  || 0;
    const isSell = !!row.fecha_venta;

    if (isSell) {
      if (computed[ticker]) computed[ticker].qty = Math.max(0, computed[ticker].qty - qty);
    } else {
      if (computed[ticker]) {
        const nq = computed[ticker].qty + qty;
        computed[ticker].costAvg = nq > 0
          ? (computed[ticker].qty * computed[ticker].costAvg + qty * price) / nq
          : price;
        computed[ticker].qty = nq;
      } else {
        // Ticker fuera del baseline: el tipo sale de la columna `tipo`
        // (fase 0), no de un fallback a 'crypto' que clasificaba mal.
        computed[ticker] = {
          qty, costAvg: price,
          type:  row.tipo || 'crypto',
          label: ticker.toUpperCase(),
        };
      }
    }
  });

  return computed;
}

// ─── PROMPT PARA ANTHROPIC ───────────────────────────────────────────────────
function buildPrompt(positions, cash, keys) {
  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const tickersList = [...keys, ...WATCHLIST].join(', ').toUpperCase();

  const activeAssets = keys
    .map(k => `${k.toUpperCase()} (qty: ${positions[k].qty.toFixed(6)}, costAvg: $${positions[k].costAvg.toFixed(4)})`)
    .join(', ');

  const accionablesActivos = keys.filter(k => ACCIONABLES.includes(k)).join(', ').toUpperCase();

  // La forma de la respuesta la impone ANALYSIS_SCHEMA, así que
  // el prompt no lleva plantilla ni instrucciones de formato: solo el encargo.
  return `Eres el analista financiero personal de Andres Tapiero. Hoy es ${today}.

Busca en la web los precios ACTUALES de hoy de: ${tickersList}.
Busca tambien la TRM oficial de Colombia (USD/COP) de HOY del Banco de la Republica o fuentes colombianas confiables.
Agrupa tickers en la misma busqueda cuando sea posible.

PORTAFOLIO ACTUAL (posiciones activas):
${activeAssets}
Cash disponible en Hapi: $${cash} USD

REGLAS DEL INVERSIONISTA:
- DCA mensual: $50 BTC + $50 acciones (VOO/QQQ)
- No comprar altcoins nuevas
- No vender crypto con perdida
- Prioridad: eliminar deuda de tarjeta antes de nuevas posiciones
- Altcoins en HOLD permanente: solo precio, sin analisis narrativo
- Analisis narrativo SOLO para los activos accionables: ${accionablesActivos}
- Perfil: moderado-agresivo (volatilidad crypto aceptada, disciplina DCA)

"assets" es una lista con EXACTAMENTE ${keys.length} elementos, uno por cada uno de estos
tickers, sin anadir ni omitir ninguno. Pon el ticker en minusculas en el campo "ticker":
${keys.join(', ')}

El campo "context" llevalo solo en los accionables (${accionablesActivos.toLowerCase() || 'ninguno'}); en el resto dejalo como cadena vacia.
Los precios van como numero puro, sin simbolo de moneda ni separadores de miles.
Usa solo ASCII en todos los textos.`;
}

// ─── CALCULAR SNAPSHOT DEL PORTAFOLIO ────────────────────────────────────────
function computeSnapshot(positions, analysisData, cash) {
  const marketData = analysisData.assets ?? {};
  let totalCrypto = 0, totalStocks = 0, costBase = 0;

  Object.entries(positions).forEach(([key, pos]) => {
    if (pos.qty <= 0) return;
    const price = toNumber(marketData[key]?.price) ?? 0;
    const val   = pos.qty * price;
    const cost     = pos.qty * pos.costAvg;
    if (pos.type === 'crypto') totalCrypto += val;
    else                       totalStocks += val;
    costBase += cost;
  });

  const assets = totalCrypto + totalStocks;
  const total  = assets + (cash || 0);
  const pnl    = assets - costBase;

  return {
    total:        +total.toFixed(2),
    totalCrypto:  +totalCrypto.toFixed(2),
    totalStocks:  +totalStocks.toFixed(2),
    cash:         cash || 0,
    costBase:     +costBase.toFixed(2),
    pnl:          +pnl.toFixed(2),
    pnlPct:       costBase > 0 ? +(pnl / costBase * 100).toFixed(2) : 0,
    analystOpinion:   analysisData.analystOpinion   || '',
    riskProfile:      analysisData.riskProfile      || 'Moderado-Agresivo',
    macro:            analysisData.macro             || {},
    actions:          analysisData.actions           || [],
    newOpportunities: analysisData.newOpportunities || [],
    watchlist:        analysisData.watchlist         || {},
  };
}

// ─── GENERAR tabs/resumen.html ────────────────────────────────────────────────
function generateResumenHTML(snapshot, analysisData) {
  const f   = n => Math.abs(n) >= 1000
    ? Math.abs(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
    : Math.abs(n).toFixed(2);
  const sgn = n => n >= 0 ? '+' : '-';
  const cls = n => n >= 0 ? 'pos' : 'neg';

  const today     = new Date().toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const monthYear = new Date().toLocaleDateString('es-CO', { month:'long', year:'numeric' });
  const macro     = snapshot.macro || {};

  const actionsHTML = (snapshot.actions || []).map(a =>
    `<div class="decision-item"><span class="decision-num">${a.num}</span><span>${a.text}</span></div>`
  ).join('\n  ');

  const oppsHTML = (snapshot.newOpportunities || []).map(o => `
  <div class="opp-card">
    <div class="opp-asset">${o.asset}</div>
    <div class="opp-reason">${o.reason}</div>
    <div class="opp-risk">⚠ ${o.risk}</div>
  </div>`).join('');

  return `<header class="header" id="report-content">
  <h1>Market Intelligence</h1>
  <div class="header-sub" id="reportDateLine">Reporte de inversiones · ${today}</div>
  <div class="header-right">
    <div class="week-badge">${monthYear}</div>
    <div class="analyst-badge">Analista Senior · 10 años · CFA L2</div>
  </div>
</header>

<h2 class="section-title">Portafolio total</h2>
<div class="totals-bar mb">
  <div class="total-card">
    <div class="total-label">Capital Invertido</div>
    <div class="total-value num">$${f(snapshot.costBase)}</div>
    <div class="total-sub">costo base USD</div>
    <div class="total-breakdown"><span>Crypto + Acc.</span></div>
  </div>
  <div class="total-card">
    <div class="total-label">Valor de Mercado</div>
    <div class="total-value num">$${f(snapshot.totalCrypto + snapshot.totalStocks)}</div>
    <div class="total-sub">a precios actuales</div>
    <div class="total-breakdown"><span>Crypto $${f(snapshot.totalCrypto)}</span><span>Acc. $${f(snapshot.totalStocks)}</span></div>
  </div>
  <div class="total-card">
    <div class="total-label">Resultado P&amp;L</div>
    <div class="total-value num ${cls(snapshot.pnl)}">${sgn(snapshot.pnl)}$${f(snapshot.pnl)}</div>
    <div class="total-sub ${cls(snapshot.pnl)}">${sgn(snapshot.pnlPct)}${Math.abs(snapshot.pnlPct).toFixed(1)}% sobre capital</div>
    <div class="total-breakdown"><span class="${cls(snapshot.totalCrypto - snapshot.costBase * (snapshot.totalCrypto/(snapshot.totalCrypto+snapshot.totalStocks||1)))}">Crypto</span><span>Acc.</span></div>
  </div>
  <div class="total-card highlight">
    <div class="total-label">Total Portafolio</div>
    <div class="total-value num">$${f(snapshot.total)}</div>
    <div class="total-sub">activos + cash</div>
    <div class="total-breakdown"><span>Cash $${f(snapshot.cash)}</span></div>
  </div>
</div>

<article class="analyst-card">
  <div class="analyst-header">
    <div class="analyst-avatar">📊</div>
    <div>
      <div class="analyst-name">Tu Asesor Financiero</div>
      <div class="analyst-title">Analisis mensual de tu portafolio · Renta Variable &amp; Activos Digitales</div>
      <div class="risk-badge">Perfil de riesgo: ${snapshot.riskProfile}<span class="info-icon" data-tooltip-key="risk_profile">ⓘ</span></div>
    </div>
  </div>
  <div class="analyst-opinion">${snapshot.analystOpinion || 'Sin analisis disponible.'}</div>
</article>

<h2 class="section-title">Contexto macroeconómico</h2>
<div class="macro-grid mb">
  <div class="macro-item"><div class="macro-label">TRM hoy</div><div class="macro-value">${fmtTRM(macro.usdcop)}</div></div>
  <div class="macro-item"><div class="macro-label">Tasa FED</div><div class="macro-value">${macro.fedrate || '—'}</div></div>
  <div class="macro-item"><div class="macro-label">Dominancia BTC<span class="info-icon" data-tooltip-key="btc_dominance">ⓘ</span></div><div class="macro-value">${macro.btcDominance || '—'}</div></div>
  <div class="macro-item"><div class="macro-label">Fear &amp; Greed<span class="info-icon" data-tooltip-key="fear_greed">ⓘ</span></div><div class="macro-value">${macro.fearGreed ?? '—'} <span style="font-size:11px;color:var(--text-muted)">${macro.fearGreedLabel || ''}</span></div></div>
</div>
${macro.narrative ? `<div class="macro-narrative card mb" style="font-size:13px;line-height:1.6;padding:16px 20px;color:var(--text-dim)">${macro.narrative}</div>` : ''}

<h2 class="section-title">Decisiones para este mes</h2>
<div class="decision-card mb">
  <div class="decision-header"><div class="decision-dot"></div><div class="decision-title">Acciones recomendadas</div></div>
  <div class="decision-body">
    ${actionsHTML || '<div class="decision-empty">Continúa el plan: DCA sin cambios.</div>'}
  </div>
</div>

<h2 class="section-title">Oportunidades de inversión sugeridas</h2>
<div class="opp-grid mb">${oppsHTML || '<div style="color:var(--text-muted)">Sin oportunidades identificadas este mes.</div>'}</div>
`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍 Market Intelligence v3 — Iniciando análisis...');
  console.log(`📅 ${new Date().toLocaleString('es-CO')}\n`);

  if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY no configurado');
  if (!USER_ID)              throw new Error('PORTFOLIO_USER_ID no configurado');

  const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const anthropic = new Anthropic();

  // 1. Cash actual desde portfolio_cash — el único almacén.
  // Antes se leía de portfolio_history.portfolio_snapshot.cash, que sólo
  // escribe este mismo script: cada reporte arrastraba el cash del anterior
  // y nunca reflejaba los ajustes hechos desde la app.
  const { data: cashRow, error: cashErr } = await supabase
    .from('portfolio_cash')
    .select('amount')
    .eq('user_id', USER_ID)
    .maybeSingle();

  if (cashErr) {
    throw new Error(
      `No se pudo leer portfolio_cash: ${cashErr.message}. ` +
      `¿Corriste scripts/migration-cash-table.sql?`
    );
  }
  if (!cashRow) {
    throw new Error(
      'portfolio_cash no tiene fila para este usuario. ' +
      'Siembra el cash real antes de correr el análisis (ver la migración).'
    );
  }

  const cash = Number(cashRow.amount);
  if (!Number.isFinite(cash)) throw new Error(`Cash inválido en portfolio_cash: ${cashRow.amount}`);
  console.log(`💵 Cash disponible: $${cash}`);

  // 2. Posiciones actuales desde inv_journal
  console.log('📂 Leyendo posiciones desde Supabase...');
  const positions  = await getPositions(supabase);
  const activeKeys = deriveKeys(positions);
  if (!activeKeys.length) throw new Error('No hay posiciones abiertas que analizar');
  console.log(`   ${activeKeys.length} activos con posición abierta: ${activeKeys.join(', ').toUpperCase()}`);

  // 3. Llamar Anthropic API con web_search
  console.log('🌐 Consultando mercado en tiempo real...');
  const response = await runAnalysis(anthropic, {
    model:      MODEL,
    // La primera corrida real gastó 15.413 tokens de salida con 18 activos:
    // un 96% de los 16.000 que había antes. Al siguiente activo habría
    // truncado. El margen no cuesta nada — sólo se paga lo que se genera.
    max_tokens: 32000,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: ANALYSIS_SCHEMA },
    },
    tools:    [{ type: 'web_search_20260209', name: 'web_search', max_uses: 7 }],
    messages: [{ role: 'user', content: buildPrompt(positions, cash, activeKeys) }],
  });

  const u = response.usage;
  console.log(`💸 tokens — entrada ${u.input_tokens} · salida ${u.output_tokens}` +
              (u.cache_read_input_tokens ? ` · cache ${u.cache_read_input_tokens}` : ''));

  // El schema garantiza JSON válido: ya no hace falta el parser tolerante que
  // normalizaba comillas y cerraba llaves a mano cuando la respuesta se cortaba.
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock?.text?.trim()) throw new Error('Respuesta sin bloque de texto');

  console.log('🧠 Procesando análisis...');
  const analysisData = JSON.parse(textBlock.text);
  const assets       = assetsFromList(analysisData.assets);
  validateAssets(assets, activeKeys);

  // El resto del script (y el snapshot que se guarda) trabaja con el mapa.
  analysisData.assets = assets;

  // 4. Calcular snapshot del portafolio con los precios frescos
  const snapshot = computeSnapshot(positions, analysisData, cash);
  console.log(`   💰 Total: $${snapshot.total.toFixed(0)} · P&L: ${snapshot.pnl >= 0 ? '+' : ''}$${snapshot.pnl.toFixed(0)} (${snapshot.pnlPct >= 0 ? '+' : ''}${snapshot.pnlPct.toFixed(1)}%)`);

  // 5. Guardar en Supabase
  const reportDate = new Date().toISOString().split('T')[0];

  // 5a. portfolio_history (con snapshot completo incluyendo análisis)
  const { data: histRow, error: histErr } = await supabase
    .from('portfolio_history')
    .insert({ user_id: USER_ID, report_date: reportDate, portfolio_snapshot: snapshot })
    .select('id')
    .single();
  if (histErr) throw new Error(`portfolio_history: ${histErr.message}`);
  console.log(`✅ portfolio_history guardado (id: ${histRow.id})`);

  // 5b. portfolio_assets (precio, señal, contexto por activo)
  // El precio se guarda como número en price_num — es lo que lee la app.
  // Un activo cuyo precio no sea parseable se DESCARTA: mejor quedarse sin
  // precio ese mes que escribir uno corrupto en la fuente de verdad.
  const parsedAssets = activeKeys
    .map(key => ({ key, priceNum: toNumber(assets[key]?.price) }))
    .filter(({ key, priceNum }) => {
      if (assets[key]?.price === undefined) return false;
      if (priceNum === null || priceNum <= 0) {
        console.warn(`⚠️ Precio no parseable para ${key.toUpperCase()}: ${JSON.stringify(assets[key].price)} — se omite`);
        return false;
      }
      return true;
    });

  const assetRows = parsedAssets.map(({ key, priceNum }) => ({
    report_id: histRow.id,
    asset_key: key,
    price:     String(assets[key].price),  // original, para auditoría
    price_num: priceNum,                  // el que consume la app
    change_7d: assets[key].change7d || null,
    signal:    assets[key].signal   || 'HOLD',
    context:   assets[key].context  || null,
  }));

  const { error: assetsErr } = await supabase.from('portfolio_assets').insert(assetRows);
  if (assetsErr) console.warn('⚠️ portfolio_assets:', assetsErr.message);
  else           console.log(`✅ portfolio_assets: ${assetRows.length} activos guardados`);

  // 6. Regenerar tabs/resumen.html
  const resumenHTML = generateResumenHTML(snapshot, analysisData);
  writeFileSync('tabs/resumen.html', resumenHTML, 'utf8');
  console.log('✅ tabs/resumen.html actualizado');

  // 7. Imprimir resumen de señales
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SEÑALES DEL MERCADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const emoji = { BUY:'🟢', HOLD:'🟡', WAIT:'🔴' };
  activeKeys.forEach(key => {
    const d = assets[key];
    if (d) {
      const e = emoji[d.signal] || '⚪';
      // `price` es number desde que lo impone el schema: hay que formatearlo
      // antes de alinear. Antes era string y se hacia padEnd directamente.
      const precio = typeof d.price === 'number'
        ? '$' + d.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: d.price < 1 ? 6 : 2 })
        : String(d.price ?? '—');
      console.log(`  ${e} ${key.toUpperCase().padEnd(9)} ${precio.padEnd(14)} ${String(d.change7d ?? '—').padEnd(9)} ${d.signal || 'HOLD'}`);
    }
  });
  if (analysisData.macro) {
    console.log(`\n  USD/COP: ${fmtTRM(analysisData.macro.usdcop)}`);
    console.log(`  Fear & Greed: ${analysisData.macro.fearGreed} — ${analysisData.macro.fearGreedLabel}`);
    console.log(`  BTC Dominance: ${analysisData.macro.btcDominance} · FED: ${analysisData.macro.fedrate}`);
  }
  console.log('\n  ACCIONES DEL MES:');
  (analysisData.actions || []).forEach(a => console.log(`  ${a.num}. ${a.text}`));

  // 8. Git push (solo tabs/resumen.html — el shell latest-report.html NO se toca)
  try {
    await exec(
      `git add tabs/resumen.html && git commit -m "report: análisis ${reportDate}" && git push`,
    );
    console.log(`\n📤 Reporte subido → tabs/resumen.html`);
    console.log('🌐 El dashboard carga el análisis desde Supabase al hacer login\n');
  } catch (err) {
    console.warn('⚠️ Git push falló (puede que no haya cambios):', err.message?.split('\n')[0]);
  }

  console.log('✅ Análisis completado\n');
}

// Sólo ejecuta si se invoca directamente (`node analyze.js`), no al importarlo.
// Así el dry-run y los tests pueden leer MODEL y las funciones puras sin
// disparar un análisis real.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('\n❌ Error fatal:', err.message);
    process.exit(1);
  });
}
