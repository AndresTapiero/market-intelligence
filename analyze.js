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
import { exec as execCb }   from 'child_process';
import { promisify }        from 'util';

const exec = promisify(execCb);

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL        = 'https://mfixkkqtjyjcigeqhlvz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const USER_ID             = process.env.PORTFOLIO_USER_ID;

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

  const assetsTemplate = keys.map(key => {
    if (ACCIONABLES.includes(key)) {
      return `"${key}":{"price":"$X","change7d":"+X.X%","signal":"BUY","context":"2 oraciones de analisis ASCII"}`;
    }
    return `"${key}":{"price":"$X","change7d":"+X.X%","signal":"HOLD"}`;
  }).join(',');

  const watchTemplate = WATCHLIST.length > 0
    ? `,"watchlist":{${WATCHLIST.map(k =>
        `"${k}":{"price":"$X","change7d":"+X.X%","signal":"BUY o WAIT","note":"1 oracion evaluacion de entrada"}`
      ).join(',')}}`
    : '';

  return `Eres el analista financiero personal de Andres Tapiero. Hoy es ${today}.

Busca en la web los precios ACTUALES de hoy de: ${tickersList}.
Busca tambien la TRM oficial de Colombia (USD/COP) de HOY del Banco de la Republica o fuentes colombianas confiables.
Haz maximo 7 busquedas agrupando tickers cuando sea posible.

PORTAFOLIO ACTUAL (posiciones activas):
${activeAssets}
Cash disponible en Hapi: $${cash} USD

REGLAS DEL INVERSIONISTA:
- DCA mensual: $50 BTC + $50 acciones (VOO/QQQ)
- No comprar altcoins nuevas
- No vender crypto con perdida
- Prioridad: eliminar deuda de tarjeta antes de nuevas posiciones
- Altcoins en HOLD permanente: solo precio, sin analisis narrativo
- Analisis narrativo SOLO para activos accionables: BTC, VOO, QQQ, NVDA
- Perfil: moderado-agresivo (volatilidad crypto aceptada, disciplina DCA)

FORMATO: Responde UNICAMENTE JSON valido. Sin texto extra, sin backticks, sin markdown. Solo ASCII en todos los textos.

{"date":"fecha de hoy","analystOpinion":"opinion experta 3-4 oraciones ASCII: que funciona, que arrastra, recomendacion del mes","riskProfile":"Moderado-Agresivo",${assetsTemplate},"macro":{"usdcop":"$X,XXX.XX COP","fedrate":"X%","btcDominance":"XX%","fearGreed":"XX","fearGreedLabel":"etiqueta en espanol","narrative":"2 oraciones contexto macro ASCII"},"newOpportunities":[{"asset":"ticker","reason":"por que tiene sentido ahora 1-2 oraciones ASCII","risk":"riesgo principal ASCII"},{"asset":"ticker","reason":"ASCII","risk":"ASCII"}]${watchTemplate},"actions":[{"num":"01","text":"accion concreta ASCII"},{"num":"02","text":"accion concreta ASCII"},{"num":"03","text":"accion concreta ASCII"}]}`;
}

// ─── PARSER JSON TOLERANTE ────────────────────────────────────────────────────
function sanitizeAndParse(raw) {
  let text = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  text = text
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/–|—/g, '-')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const start = text.indexOf('{');
  if (start === -1) throw new Error('No se encontró JSON en la respuesta');

  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }

  if (end !== -1) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (_) {}
  }

  // Modo recuperación: cortar en el último campo válido
  const body = text.slice(start);
  const closeCommaRe = /("|\})\s*,/g;
  let match, lastClose = -1;
  while ((match = closeCommaRe.exec(body)) !== null) lastClose = match.index + match[1].length - 1;
  if (lastClose === -1) throw new Error('JSON incompleto y sin campos recuperables');

  const truncated = body.slice(0, lastClose + 1);
  let open = 0, close = 0;
  for (const ch of truncated) { if (ch === '{') open++; else if (ch === '}') close++; }
  return JSON.parse(truncated + '}'.repeat(Math.max(open - close, 0)));
}

// ─── CALCULAR SNAPSHOT DEL PORTAFOLIO ────────────────────────────────────────
function computeSnapshot(positions, analysisData, cash) {
  let totalCrypto = 0, totalStocks = 0, costBase = 0;

  Object.entries(positions).forEach(([key, pos]) => {
    if (pos.qty <= 0) return;
    const price = toNumber(analysisData[key]?.price) ?? 0;
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
  <div class="macro-item"><div class="macro-label">TRM hoy</div><div class="macro-value">${macro.usdcop || '—'}</div></div>
  <div class="macro-item"><div class="macro-label">Tasa FED</div><div class="macro-value">${macro.fedrate || '—'}</div></div>
  <div class="macro-item"><div class="macro-label">Dominancia BTC<span class="info-icon" data-tooltip-key="btc_dominance">ⓘ</span></div><div class="macro-value">${macro.btcDominance || '—'}</div></div>
  <div class="macro-item"><div class="macro-label">Fear &amp; Greed<span class="info-icon" data-tooltip-key="fear_greed">ⓘ</span></div><div class="macro-value">${macro.fearGreed || '—'} <span style="font-size:11px;color:var(--text-muted)">${macro.fearGreedLabel || ''}</span></div></div>
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
  const response = await anthropic.messages.create({
    model:      'claude-opus-4-8',
    max_tokens: 6000,
    tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
    messages:   [{ role: 'user', content: buildPrompt(positions, cash, activeKeys) }],
  });

  const rawText = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  if (!rawText.trim()) throw new Error('Respuesta vacía del modelo');

  console.log('🧠 Procesando análisis...');
  const analysisData = sanitizeAndParse(rawText);

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
    .map(key => ({ key, priceNum: toNumber(analysisData[key]?.price) }))
    .filter(({ key, priceNum }) => {
      if (!analysisData[key]?.price) return false;
      if (priceNum === null || priceNum <= 0) {
        console.warn(`⚠️ Precio no parseable para ${key.toUpperCase()}: ${JSON.stringify(analysisData[key].price)} — se omite`);
        return false;
      }
      return true;
    });

  const assetRows = parsedAssets.map(({ key, priceNum }) => ({
    report_id: histRow.id,
    asset_key: key,
    price:     analysisData[key].price,   // original, para auditoría
    price_num: priceNum,                  // el que consume la app
    change_7d: analysisData[key].change7d || null,
    signal:    analysisData[key].signal   || 'HOLD',
    context:   analysisData[key].context  || null,
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
    const d = analysisData[key];
    if (d) {
      const e = emoji[d.signal] || '⚪';
      console.log(`  ${e} ${key.toUpperCase().padEnd(9)} ${(d.price||'—').padEnd(14)} ${(d.change7d||'—').padEnd(9)} ${d.signal||'HOLD'}`);
    }
  });
  if (analysisData.macro) {
    console.log(`\n  USD/COP: ${analysisData.macro.usdcop}`);
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

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
