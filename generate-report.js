/**
 * generate-report.js — v7
 * Rediseño visual premium · Comparación mes anterior · Gráfico línea · Export PDF
 */

export function generateHTML(data, history, portfolio) {
  const d   = data;
  const now = new Date().toLocaleString("es-CO", { dateStyle: "full", timeStyle: "short" });

  const signalLabel = { BUY: "COMPRAR", HOLD: "MANTENER", WAIT: "ESPERAR" };
  const signalClass = { BUY: "signal-buy", HOLD: "signal-hold", WAIT: "signal-wait" };

  function fmt(n)      { return Math.abs(n) < 1 ? Math.abs(n).toFixed(2) : parseInt(Math.abs(n)).toLocaleString(); }
  function fmtD(n)     { return Math.abs(n) < 10 ? Math.abs(n).toFixed(2) : fmt(n); }
  function sign(n)     { return parseFloat(n) >= 0 ? "+" : "-"; }
  function cls(n)      { return parseFloat(n) >= 0 ? "pos" : "neg"; }
  function pct(n)      { return (parseFloat(n) >= 0 ? "+" : "") + parseFloat(n).toFixed(1) + "%"; }
  function pnlPct(c,i) { return i > 0 ? (((c-i)/i)*100).toFixed(1) : "0"; }
  function pnlBar(v)   {
    const w = Math.min(Math.abs(parseFloat(v)), 100);
    const c = parseFloat(v) >= 0 ? "var(--green)" : "var(--red)";
    return `<div class="pnl-bar-wrap"><div class="pnl-bar" style="width:${w}%;background:${c}"></div></div>`;
  }

  // ─── META ─────────────────────────────────────────────────────────────────────
  const cryptoMeta = {
    btc:{label:"Bitcoin",icon:"₿",color:"#f7931a"}, eth:{label:"Ethereum",icon:"Ξ",color:"#627eea"},
    sol:{label:"Solana",icon:"◎",color:"#9945ff"}, tao:{label:"Bittensor",icon:"τ",color:"#38bdf8"},
    uni:{label:"Uniswap",icon:"U",color:"#ff007a"}, bnb:{label:"BNB",icon:"B",color:"#f3ba2f"},
    sui:{label:"SUI",icon:"S",color:"#6fbcf0"}, sei:{label:"SEI",icon:"s",color:"#e84142"},
    ena:{label:"Ethena",icon:"E",color:"#00d4ff"}, avax:{label:"Avalanche",icon:"A",color:"#e84142"},
  };
  const stockMeta = {
    voo:{label:"VOO",icon:"V",color:"#00d4a0"}, qqq:{label:"QQQ",icon:"Q",color:"#4d8fff"},
    nvda:{label:"NVIDIA",icon:"N",color:"#76b900"}, nu:{label:"Nubank",icon:"N",color:"#8250ff"},
    tsla:{label:"Tesla",icon:"T",color:"#e31937"},
  };

  // ─── COMPARACIÓN VS MES ANTERIOR ──────────────────────────────────────────────
  // Busca el valor de cada activo en el penúltimo reporte del historial
  function getPrevValue(key, isCrypto) {
    if (!history || history.length < 2) return null;
    const prev = history[history.length - 2];
    const prevPrice = parseFloat((prev.data?.[key]?.price || "0").replace(/[$,]/g, "")) || 0;
    if (prevPrice <= 0) return null;
    if (isCrypto) {
      const qty = portfolio.crypto[key]?.qty || 0;
      return prevPrice * qty;
    } else {
      const shares = portfolio.stocks[key]?.shares || 0;
      return prevPrice * shares;
    }
  }

  // ─── BUILD ASSETS ─────────────────────────────────────────────────────────────
  const cryptoAssets = Object.keys(cryptoMeta).map(key => {
    const c = portfolio.crypto[key] || {};
    const cur = c.currentVal || 0;
    const inv = (c.qty||0) * (c.costAvg||0);
    const prevVal = getPrevValue(key, true);
    const monthDelta = prevVal !== null ? cur - prevVal : null;
    const buyPrice = c.costAvg || 0;
    const marketPrice = parseFloat((d[key]?.price||"0").replace(/[$,]/g,"")) || 0;
    const priceGain = buyPrice > 0 && marketPrice > 0 ? ((marketPrice-buyPrice)/buyPrice*100).toFixed(1) : null;
    return { key, ...cryptoMeta[key], ic:key, qty:`${c.qty||0} ${key.toUpperCase()}`, invested:inv, current:cur, pnlV:cur-inv, pnlP:pnlPct(cur,inv), monthDelta, buyPrice, marketPrice, priceGain };
  });

  const stockAssets = Object.keys(stockMeta).map(key => {
    const s = portfolio.stocks[key] || {};
    const cur = s.val || 0;
    const inv = cur / (1 + (s.gainPct||0)/100);
    const prevVal = getPrevValue(key, false);
    const monthDelta = prevVal !== null ? cur - prevVal : null;
    const buyPrice = s.costAvg || 0;
    const marketPrice = parseFloat((d[key]?.price||"0").replace(/[$,]/g,"")) || 0;
    const priceGain = buyPrice > 0 && marketPrice > 0 ? ((marketPrice-buyPrice)/buyPrice*100).toFixed(1) : null;
    return { key, ...stockMeta[key], ic:key, qty:`${s.shares||0} ${key.toUpperCase()}`, invested:inv, current:cur, pnlV:cur-inv, pnlP:pnlPct(cur,inv), monthDelta, buyPrice, marketPrice, priceGain };
  });

  const cashVal = portfolio.stocks.cash?.val || 0;

  // ─── TOTALES ──────────────────────────────────────────────────────────────────
  const totalCryptoInvested = cryptoAssets.reduce((s,a)=>s+a.invested,0);
  const totalCryptoVal      = cryptoAssets.reduce((s,a)=>s+a.current,0);
  const totalCryptoPnL      = totalCryptoVal - totalCryptoInvested;
  const totalCryptoPnLPct   = pnlPct(totalCryptoVal, totalCryptoInvested);

  const totalStocksInvested = stockAssets.reduce((s,a)=>s+a.invested,0);
  const totalStocksVal      = stockAssets.reduce((s,a)=>s+a.current,0);
  const totalStocksPnL      = totalStocksVal - totalStocksInvested;
  const totalStocksPnLPct   = pnlPct(totalStocksVal, totalStocksInvested);

  const totalInvested = totalCryptoInvested + totalStocksInvested;
  const totalVal      = totalCryptoVal + totalStocksVal + cashVal;
  const totalPnL      = totalCryptoVal + totalStocksVal - totalInvested;
  const totalPnLPct   = pnlPct(totalCryptoVal+totalStocksVal, totalInvested);

  const copRate = parseFloat((d.macro?.usdcop||"3433.71").replace(/[$, COP]/g,"")) || 3433.71;
  function fmtCOPval(usd){ return Math.round(usd*copRate).toLocaleString("es-CO"); }
  const cryptoRatio = ((totalCryptoVal/(totalCryptoVal+totalStocksVal))*100).toFixed(0);
  const stocksRatio = (100 - parseFloat(cryptoRatio)).toFixed(0);

  // ─── VARIACIÓN TOTAL VS MES ANTERIOR ──────────────────────────────────────────
  let prevTotal = null, monthChange = null;
  if (history && history.length >= 2) {
    const prevCryptoVal = cryptoAssets.reduce((s,a) => {
      const pv = getPrevValue(a.key, true); return s + (pv||a.current);
    }, 0);
    const prevStocksVal = stockAssets.reduce((s,a) => {
      const pv = getPrevValue(a.key, false); return s + (pv||a.current);
    }, 0);
    prevTotal = prevCryptoVal + prevStocksVal + cashVal;
    if (prevTotal > 0) monthChange = ((totalVal - prevTotal) / prevTotal * 100).toFixed(1);
  }

  // ─── INSIGHTS ─────────────────────────────────────────────────────────────────
  function withChangeFn(arr) {
    return arr.map(a => ({ ...a, change7dNum: parseFloat((d[a.key]?.change7d||"0").replace(/[+%]/g,""))||0 }));
  }
  const cryptoWC = withChangeFn(cryptoAssets);
  const stocksWC = withChangeFn(stockAssets);
  const bestCrypto  = [...cryptoWC].sort((a,b)=>b.change7dNum-a.change7dNum)[0];
  const worstCrypto = [...cryptoWC].sort((a,b)=>a.change7dNum-b.change7dNum)[0];
  const bestStock   = [...stocksWC].sort((a,b)=>b.change7dNum-a.change7dNum)[0];
  const worstStock  = [...stocksWC].sort((a,b)=>a.change7dNum-b.change7dNum)[0];

  const btcCostAvg   = portfolio.crypto.btc?.costAvg || 82716;
  const btcPrice     = parseFloat((d.btc?.price||"0").replace(/[$,]/g,"")) || 0;
  const btcBreakEven = btcPrice > 0 ? (((btcCostAvg-btcPrice)/btcPrice)*100).toFixed(1) : null;
  const btcConc      = totalVal > 0 ? ((totalCryptoVal/totalVal)*100).toFixed(1) : 0;

  // ─── SCORE ────────────────────────────────────────────────────────────────────
  let score = 10;
  if (parseFloat(btcConc) > 65) score -= 2; else if (parseFloat(btcConc) > 50) score -= 1;
  if (parseFloat(totalCryptoPnLPct) < -40) score -= 2; else if (parseFloat(totalCryptoPnLPct) < -20) score -= 1;
  if (parseFloat(totalStocksPnLPct) > 20) score += 1;
  if (history && history.length > 0) score += 1;
  if (cashVal > 50) score += 0.5;
  score = Math.min(10, Math.max(1, Math.round(score * 2) / 2));
  const scoreColor = score >= 7 ? "var(--green)" : score >= 5 ? "var(--yellow)" : "var(--red)";
  const scoreLabel = score >= 7 ? "Saludable" : score >= 5 ? "Moderado" : "Requiere atención";

  // ─── RETORNO ANUALIZADO ───────────────────────────────────────────────────────
  let annualizedReturn = null;
  if (history && history.length >= 2) {
    const first = history[0], last = history[history.length-1];
    const days = (first.timestamp && last.timestamp)
      ? (new Date(last.timestamp)-new Date(first.timestamp))/86400000 : history.length*30;
    if (days > 7 && totalInvested > 0)
      annualizedReturn = ((Math.pow(1+parseFloat(totalPnLPct)/100, 365/days)-1)*100).toFixed(1);
  }

  // ─── DELTA INDICATOR (flecha mes anterior) ────────────────────────────────────
  function deltaIndicator(delta) {
    if (delta === null || delta === undefined) return "";
    const arrow = delta >= 0 ? "↑" : "↓";
    const c = delta >= 0 ? "pos" : "neg";
    return `<span class="delta ${c}">${arrow} $${fmtD(delta)}</span>`;
  }

  // ─── P&L ROWS ─────────────────────────────────────────────────────────────────
  function infoIcon(term) {
    const defs = {
      "pnl": "P&L (Profit and Loss): la diferencia entre lo que invertiste y el valor actual de tu posicion.",
      "dca": "DCA (Dollar Cost Average): estrategia de invertir un monto fijo periodicamente, sin importar el precio del momento.",
      "breakeven": "Break-even: el precio al que tu posicion vuelve a estar en cero, ni ganancia ni perdida.",
      "feargreed": "Fear & Greed Index: mide el sentimiento del mercado crypto del 0 (miedo extremo) al 100 (codicia extrema).",
      "trm": "TRM: Tasa Representativa del Mercado, el valor oficial del dolar en pesos colombianos publicado por el Banco de la Republica.",
      "dominance": "Dominancia BTC: el porcentaje del valor total del mercado crypto que representa Bitcoin.",
      "annualized": "Retorno anualizado: proyecta el rendimiento actual como si se mantuviera durante un año completo.",
      "score": "Score de salud: medida del 1 al 10 que evalua diversificacion, rendimiento y disciplina de tu portafolio.",
      "riskprofile": "Perfil de riesgo: el nivel de volatilidad y posibles perdidas que estas dispuesto a aceptar buscando mayor retorno."
    };
    const text = (defs[term] || "").replace(/"/g, "&quot;");
    return `<span class="info-icon" onclick="showToast(this, '${text}')" title="${text}">ⓘ</span>`;
  }

  function fmtPrice(n){ return n < 1 ? n.toFixed(4) : (n < 100 ? n.toFixed(2) : fmt(n)); }

  function pnlRows(arr) {
    const rows = arr.map(r => `
      <div class="pnl-row">
        <div class="pnl-asset">
          <div class="asset-icon-sm" style="background:${r.color}22;color:${r.color}">${r.icon}</div>
          <div><div class="pnl-name">${r.label}</div><div class="pnl-qty">${r.qty}</div></div>
        </div>
        <div class="pnl-nums">
          <div class="pnl-trio"><span class="label-xs">Compra</span><span class="mono num">$${fmtPrice(r.buyPrice)}</span></div>
          <div class="pnl-trio"><span class="label-xs">Mercado</span><span class="mono num">$${fmtPrice(r.marketPrice)}</span></div>
          <div class="pnl-trio"><span class="label-xs">Invertido</span><span class="mono num">$${fmt(r.invested)}</span></div>
          <div class="pnl-trio"><span class="label-xs">Actual</span><span class="mono num">$${fmt(r.current)}</span></div>
          <div class="pnl-trio"><span class="label-xs">vs mes</span>${r.monthDelta !== null ? deltaIndicator(r.monthDelta) : '<span class="mono num text-muted">—</span>'}</div>
          <div class="pnl-trio">
            <span class="label-xs">P&L</span>
            <span class="mono num ${cls(r.pnlV)}">${sign(r.pnlV)}$${fmtD(r.pnlV)}</span>
            <span class="mono num ${cls(r.pnlV)} small">${pct(r.pnlP)}</span>
            ${pnlBar(r.pnlP)}
          </div>
        </div>
      </div>`).join("");
    // Scroll si hay mas de 5 activos para no alargar el reporte
    // Siempre scroll, asi Acciones y Crypto se ven visualmente identicos
    return `<div class="pnl-scroll">${rows}</div>`;
  }

  // ─── COMPOSICIÓN SCROLL ───────────────────────────────────────────────────────
  function compBarsScroll(assets, total) {
    const rows = assets.filter(a=>a.current>0).sort((a,b)=>b.current-a.current).map(a => {
      const p = ((a.current/total)*100).toFixed(1);
      return `<div class="comp-row">
        <div class="comp-label"><span class="comp-dot" style="background:${a.color}"></span><span class="mono">${a.key.toUpperCase()}</span></div>
        <div class="comp-bar-wrap"><div class="comp-bar" style="width:${Math.max(parseFloat(p),1)}%;background:${a.color}"></div></div>
        <div class="comp-pct mono num">${p}%</div>
        <div class="comp-val mono num">$${fmt(a.current)}</div>
      </div>`;
    }).join("");
    return `<div class="comp-scroll">${rows}</div>`;
  }

  // ─── ASSET CARDS ──────────────────────────────────────────────────────────────
  function assetCardGroup(assets, gridClass) {
    return `<div class="${gridClass}">${assets.map(a => {
      const asset = d[a.key] || {};
      const isPos = (asset.change7d||"").startsWith("+");
      const sig = asset.signal || "HOLD";
      return `
      <div class="asset-card" style="--asset-color:${a.color}">
        <div class="asset-header">
          <div class="asset-name">
            <div class="asset-icon" style="background:${a.color}22;color:${a.color}">${a.icon}</div>
            <div><div class="asset-ticker">${a.key.toUpperCase()}</div><div class="asset-label">${a.label}</div></div>
          </div>
          <span class="signal-badge ${signalClass[sig]}">${signalLabel[sig]||sig}</span>
        </div>
        <div class="asset-price num">${asset.price||"—"}</div>
        <div class="asset-change num ${isPos?"pos":"neg"}">${asset.change7d||"—"} <span class="asset-change-label">semana</span></div>
        <div class="price-compare">
          <div class="pc-item"><span class="pc-label">Compra</span><span class="mono num">$${a.buyPrice < 1 ? a.buyPrice.toFixed(4) : (a.buyPrice < 100 ? a.buyPrice.toFixed(2) : fmt(a.buyPrice))}</span></div>
          <span class="pc-arrow">→</span>
          <div class="pc-item"><span class="pc-label">Mercado</span><span class="mono num">$${a.marketPrice < 1 ? a.marketPrice.toFixed(4) : (a.marketPrice < 100 ? a.marketPrice.toFixed(2) : fmt(a.marketPrice))}</span></div>
          ${a.priceGain !== null ? `<span class="pc-gain ${cls(a.priceGain)}">${pct(a.priceGain)}</span>` : ""}
        </div>
        <div class="port-mini">
          <span class="num">$${fmt(a.current)}</span>
          <span class="num ${cls(a.pnlV)}">${pct(a.pnlP)}</span>
        </div>
        ${a.monthDelta !== null ? `<div class="asset-delta">${deltaIndicator(a.monthDelta)} <span class="asset-delta-label">vs mes anterior</span></div>` : ""}
        <div class="asset-context">${asset.context||"—"}</div>
      </div>`;
    }).join("")}</div>`;
  }

  // ─── DCA TRACKER ──────────────────────────────────────────────────────────────
  function dcaTracker() {
    const count = history?.length || 0;
    return `
    <div class="dca-grid">
      <div class="dca-item">
        <div class="asset-icon-sm" style="background:#f7931a22;color:#f7931a">₿</div>
        <div class="dca-info"><div class="dca-name">DCA Bitcoin</div><div class="dca-amount mono">$50 USD / mes</div><div class="dca-next">Próximo: ${portfolio.dca?.btc||"inicio de mes"}</div></div>
        <div class="dca-stats"><div class="mono pos">+${count}</div><div class="mono text-muted">$${count*50}</div></div>
      </div>
      <div class="dca-item">
        <div class="asset-icon-sm" style="background:#00d4a022;color:#00d4a0">📈</div>
        <div class="dca-info"><div class="dca-name">DCA Acciones</div><div class="dca-amount mono">$50 USD / mes</div><div class="dca-next">Próximo: ${portfolio.dca?.stocks||"fin de mes"}</div></div>
        <div class="dca-stats"><div class="mono pos">+${count}</div><div class="mono text-muted">$${count*50}</div></div>
      </div>
      ${cashVal > 0 ? `<div class="dca-item">
        <div class="asset-icon-sm" style="background:rgba(90,96,128,0.15);color:var(--text-muted);font-size:13px">$</div>
        <div class="dca-info"><div class="dca-name">Cash disponible (Hapi)</div><div class="dca-amount mono">$${fmt(cashVal)} USD</div><div class="dca-next">Listo para próximo DCA</div></div>
      </div>` : ""}
    </div>`;
  }

  // ─── BITÁCORA DCA ─────────────────────────────────────────────────────────────
  function dcaLog() {
    const entries = Array.isArray(portfolio.dcaLog) ? portfolio.dcaLog : [];
    if (entries.length === 0) {
      return `<div class="no-history" style="padding:12px 0;font-size:11px">Las compras DCA se registrarán automáticamente al actualizar las cantidades en portfolio.json.</div>`;
    }
    const rows = entries.slice(-8).reverse().map(e => `
      <div class="log-row">
        <div class="log-date mono">${e.date}</div>
        <div class="log-asset"><span class="mono" style="color:${(cryptoMeta[e.asset]||stockMeta[e.asset])?.color||'var(--text)'}">${e.asset.toUpperCase()}</span></div>
        <div class="log-qty mono">+${e.qtyAdded}</div>
        <div class="log-note text-muted">${e.note||""}</div>
      </div>`).join("");
    return `<div class="log-list">${rows}</div>`;
  }

  // ─── GRÁFICO DE LÍNEA ─────────────────────────────────────────────────────────
  function portfolioChart() {
    if (!history || history.length < 1) {
      return `<div class="no-history" style="padding:30px 0">El gráfico de evolución se construirá mes a mes.</div>`;
    }
    // Construir puntos: usar snapshot REAL guardado si existe, sino estimar con precio BTC
    const points = history.slice(-12).map(h => {
      const label = h.timestamp
        ? new Date(h.timestamp).toLocaleDateString("es-CO",{month:"short",year:"2-digit"})
        : h.week;
      // Snapshot real (nuevo formato) — preferido
      if (h.portfolioSnapshot?.total) {
        return { label, val: Math.round(h.portfolioSnapshot.total) };
      }
      // Fallback para historial antiguo sin snapshot: estimar solo con BTC
      const bP = parseFloat((h.data?.btc?.price||"0").replace(/[$,]/g,"")) || 0;
      const btcQty = portfolio.crypto.btc?.qty || 0;
      const estTotal = bP > 0 ? (bP * btcQty + totalStocksVal + totalCryptoVal - (portfolio.crypto.btc?.currentVal||0)) : totalVal;
      return { label, val: Math.round(estTotal) };
    });
    // Añadir punto actual
    points.push({ label: "Hoy", val: Math.round(totalVal) });

    if (points.length < 2) {
      return `<div class="chart-single">
        <div class="chart-single-val num">$${fmt(totalVal)}</div>
        <div class="chart-single-label">Punto de partida · ${new Date().toLocaleDateString("es-CO",{month:"long",year:"numeric"})}</div>
        <div class="chart-single-sub">El gráfico mostrará la tendencia desde el próximo reporte</div>
      </div>`;
    }

    const W = 600, H = 200, pad = 36;
    const vals = points.map(p => p.val);
    const minV = Math.min(...vals) * 0.95;
    const maxV = Math.max(...vals) * 1.05;
    const range = maxV - minV || 1;
    const stepX = (W - pad*2) / (points.length - 1);

    const coords = points.map((p,i) => ({
      x: pad + i*stepX,
      y: H - pad - ((p.val - minV)/range)*(H - pad*2),
      ...p
    }));

    const linePath = coords.map((c,i) => `${i===0?"M":"L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const areaPath = linePath + ` L${coords[coords.length-1].x.toFixed(1)},${H-pad} L${coords[0].x.toFixed(1)},${H-pad} Z`;

    const dots = coords.map(c => {
      const valLabel = c.val >= 1000 ? "$" + (c.val/1000).toFixed(1) + "k" : "$" + c.val;
      return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="var(--accent)"/>
       <text x="${c.x.toFixed(1)}" y="${(c.y-10).toFixed(1)}" text-anchor="middle" class="chart-val-label">${valLabel}</text>
       <text x="${c.x.toFixed(1)}" y="${(H-pad+18)}" text-anchor="middle" class="chart-x-label">${c.label}</text>`;
    }).join("");

    const lastVal = coords[coords.length-1];
    const firstVal = coords[0];
    const growth = ((lastVal.val - firstVal.val)/firstVal.val*100).toFixed(1);

    return `
    <div class="chart-header">
      <div>
        <div class="chart-current num">$${fmt(totalVal)}</div>
        <div class="chart-growth ${cls(growth)}">${pct(growth)} desde inicio del seguimiento</div>
      </div>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#areaGrad)"/>
      <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  }

  // ─── HISTORIAL TABLA ──────────────────────────────────────────────────────────
  function monthlyEvolution() {
    if (!history||history.length<1) {
      return `<div class="no-history">Punto de partida: ${getMonthLabel()} · Total $${fmt(totalVal)}. La comparación mes a mes empezará en el próximo reporte.</div>`;
    }
    const byMonth = {};
    history.forEach(h => {
      const label = h.timestamp ? new Date(h.timestamp).toLocaleDateString("es-CO",{month:"short",year:"numeric"}) : h.week;
      if (!byMonth[label]) byMonth[label]=[];
      byMonth[label].push(h);
    });
    const months = Object.keys(byMonth).slice(-6);

    // Calcular el valor total estimado del portafolio en cada mes historico
    // usando el precio BTC de ese mes (proxy) + valor actual de acciones (no varia retroactivamente)
    let prevTotalEst = null;
    const rows = months.map((month, idx) => {
      const last = byMonth[month][byMonth[month].length-1];
      let totalEstThatMonth;
      if (last.portfolioSnapshot?.total) {
        totalEstThatMonth = last.portfolioSnapshot.total;
      } else {
        const bP = parseFloat((last.data?.btc?.price||"0").replace(/[$,]/g,"")) || 0;
        const btcQty = portfolio.crypto.btc?.qty || 0;
        const cryptoEstThatMonth = bP > 0 ? bP*btcQty + (totalCryptoVal - (portfolio.crypto.btc?.currentVal||0)) : totalCryptoVal;
        totalEstThatMonth = cryptoEstThatMonth + totalStocksVal;
      }

      let deltaStr = "—", deltaCls = "";
      if (prevTotalEst !== null && prevTotalEst > 0) {
        const d2 = ((totalEstThatMonth - prevTotalEst)/prevTotalEst*100).toFixed(1);
        deltaStr = (d2>=0?"+":"")+d2+"%";
        deltaCls = d2>=0?"pos":"neg";
      }
      prevTotalEst = totalEstThatMonth;

      const chg = last.data?.btc?.change7d||"—";
      const isP = chg.startsWith("+");
      return `<tr>
        <td class="mono">${month}</td>
        <td class="mono num">$${fmt(totalEstThatMonth)}</td>
        <td class="mono num ${deltaCls}">${deltaStr}</td>
        <td class="mono num">${last.data?.btc?.price||"—"}</td>
        <td class="mono num ${isP?"pos":"neg"}">${chg}</td>
        <td class="mono num">${last.data?.macro?.fearGreed||"—"}</td>
      </tr>`;
    }).join("");

    // Fila actual (hoy)
    let todayDelta = "—", todayCls = "";
    if (prevTotalEst !== null && prevTotalEst > 0) {
      const d3 = ((totalVal - prevTotalEst)/prevTotalEst*100).toFixed(1);
      todayDelta = (d3>=0?"+":"")+d3+"%";
      todayCls = d3>=0?"pos":"neg";
    }
    const todayRow = `<tr style="font-weight:700">
      <td class="mono">Hoy</td>
      <td class="mono num">$${fmt(totalVal)}</td>
      <td class="mono num ${todayCls}">${todayDelta}</td>
      <td class="mono num">${d.btc?.price||"—"}</td>
      <td class="mono num ${(d.btc?.change7d||"").startsWith("+")?"pos":"neg"}">${d.btc?.change7d||"—"}</td>
      <td class="mono num">${d.macro?.fearGreed||"—"}</td>
    </tr>`;

    return `<div class="history-wrap"><table class="history-table">
      <thead><tr><th>Mes</th><th>Total Portafolio</th><th>vs mes ant.</th><th>BTC</th><th>BTC 7d</th><th>F&G</th></tr></thead>
      <tbody>${rows}${todayRow}</tbody>
    </table></div>`;
  }

  function newOpportunities() {
    const opps = d.newOpportunities || [];
    if (opps.length === 0) return `<div class="no-history" style="padding:10px 0">Sin nuevas oportunidades sugeridas este mes.</div>`;
    return opps.map(o => `
      <div class="opp-card">
        <div class="opp-asset">${o.asset}</div>
        <div class="opp-reason">${o.reason}</div>
        <div class="opp-risk">⚠ ${o.risk}</div>
      </div>`).join("");
  }

  function actionItems() {
    if (!d.actions) return "";
    return d.actions.map(a=>`<div class="action-item"><span class="action-num">${a.num}</span><span class="action-text">${a.text}</span></div>`).join("");
  }

  const calendario = d.calendario || [
    { fecha:"Jun 18", evento:"Decisión FED — tasas de interés", tipo:"macro" },
    { fecha:"Jun 25", evento:"Earnings NVDA Q2 (estimado)", tipo:"earning" },
    { fecha:"Jun 30", evento:"DCA Acciones — VOO/QQQ $50", tipo:"dca" },
    { fecha:"Jul 1",  evento:"DCA Bitcoin $50", tipo:"dca" },
  ];
  const calColors = { macro:"var(--blue)", earning:"var(--yellow)", dca:"var(--accent)", crypto:"var(--orange)" };
  function calRow(item) {
    const color = calColors[item.tipo] || "var(--text-muted)";
    return `<div class="cal-row"><div class="cal-fecha mono" style="color:${color}">${item.fecha}</div><div class="cal-dot" style="background:${color}"></div><div class="cal-evento">${item.evento}</div></div>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Market Intelligence · ${getMonthLabel()}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  :root{
    --bg:#0a0c10;--surface:#13161d;--surface2:#1a1e27;--border:#232838;--border-subtle:#1a1e2a;
    --text:#eef0f7;--text-muted:#646b85;--text-dim:#9aa2bd;
    --green:#00d9a3;--green-dim:rgba(0,217,163,0.1);
    --red:#ff5575;--red-dim:rgba(255,85,117,0.1);
    --yellow:#f5c842;--yellow-dim:rgba(245,200,66,0.1);
    --blue:#4d8fff;--blue-dim:rgba(77,143,255,0.1);
    --accent:#8b6dff;--accent-dim:rgba(139,109,255,0.12);
    --orange:#ff9838;--orange-dim:rgba(255,152,56,0.1);
    --mono:'JetBrains Mono',monospace;--sans:'Inter',sans-serif;
    --r:14px;--r-sm:10px;--g:16px;--g-lg:20px;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:var(--sans);padding:24px;padding-top:80px;min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased}
  .num{font-variant-numeric:tabular-nums}
  .mono{font-family:var(--mono)} .pos{color:var(--green)} .neg{color:var(--red)}
  .text-muted{color:var(--text-muted)} .small{font-size:10px}
  .label-xs{font-size:9px;letter-spacing:.7px;text-transform:uppercase;color:var(--text-muted);font-family:var(--mono);display:block;margin-bottom:3px}
  .section-title{font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--text-dim);font-family:var(--mono);margin-bottom:14px;margin-top:4px}
  .card{background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r);padding:22px 24px}
  .mb{margin-bottom:var(--g-lg)}

  /* DELTA */
  .delta{font-size:11px;font-weight:600;font-family:var(--mono)}

  /* STICKY */
  .sticky-bar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(10,12,16,0.85);backdrop-filter:blur(16px);border-bottom:1px solid var(--border-subtle);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
  .sticky-logo{font-size:14px;font-weight:800;letter-spacing:-.4px;white-space:nowrap}
  .sticky-logo span{color:var(--accent)}
  .sticky-stats{display:flex;gap:24px;align-items:center;flex-wrap:wrap}
  .sticky-stat{display:flex;flex-direction:column;align-items:flex-end}
  .sticky-stat-label{font-size:8px;text-transform:uppercase;letter-spacing:.9px;color:var(--text-muted);font-family:var(--mono);margin-bottom:1px}
  .sticky-stat-val{font-size:14px;font-weight:700;font-family:var(--mono);line-height:1.1}
  .pdf-btn{background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent);padding:6px 14px;border-radius:8px;font-size:11px;font-weight:600;font-family:var(--sans);cursor:pointer;white-space:nowrap;transition:all .2s}
  .pdf-btn:hover{background:var(--accent);color:white}
  .header-actions{display:flex;gap:8px;align-items:center}
  .refresh-btn{background:var(--green-dim);color:var(--green);border:1px solid var(--green);padding:6px 14px;border-radius:8px;font-size:11px;font-weight:600;font-family:var(--sans);cursor:pointer;white-space:nowrap;transition:all .2s;text-decoration:none;display:inline-flex;align-items:center;gap:5px}
  .refresh-btn:hover{background:var(--green);color:white}

  /* HEADER */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap;gap:12px}
  .header h1{font-size:24px;font-weight:800;letter-spacing:-.6px}
  .header-sub{font-size:12px;color:var(--text-muted);font-family:var(--mono);margin-top:5px}
  .header-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
  .week-badge{background:var(--accent-dim);color:var(--accent);font-family:var(--mono);font-size:11px;font-weight:600;padding:6px 14px;border-radius:8px;border:1px solid rgba(139,109,255,.25)}
  .analyst-badge{font-size:10px;color:var(--text-muted);font-family:var(--mono)}

  /* TOTALES */
  .totals-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--g);margin-bottom:var(--g-lg)}
  .total-card{background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r);padding:20px 22px}
  .total-card.highlight{border-color:var(--accent);background:linear-gradient(135deg,var(--accent-dim),transparent)}
  .total-label{font-size:9px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:var(--text-muted);font-family:var(--mono);margin-bottom:10px}
  .total-value{font-size:28px;font-weight:800;font-family:var(--mono);letter-spacing:-1px;line-height:1}
  .total-card.highlight .total-value{font-size:32px}
  .total-sub{font-size:11px;color:var(--text-muted);font-family:var(--mono);margin-top:6px}
  .total-sub-cop{font-size:10px;color:var(--accent);font-family:var(--mono);margin-top:3px;opacity:0.85}
  .total-breakdown{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
  .total-breakdown span{font-size:10px;font-family:var(--mono);color:var(--text-muted)}

  /* INSIGHTS */
  .insights-top{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:var(--g);margin-bottom:var(--g)}
  .insights-mid{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--g);margin-bottom:var(--g-lg)}
  .insight-card{background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r);padding:18px 20px;display:flex;flex-direction:column;gap:7px}
  .insight-card.alert-orange{border-color:rgba(255,152,56,.3);background:linear-gradient(135deg,var(--orange-dim),transparent)}
  .insight-card.alert-red{border-color:rgba(255,85,117,.3);background:linear-gradient(135deg,var(--red-dim),transparent)}
  .insight-card.good{border-color:rgba(0,217,163,.3);background:linear-gradient(135deg,var(--green-dim),transparent)}
  .insight-label{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:var(--mono);color:var(--text-muted)}
  .insight-value{font-size:22px;font-weight:800;font-family:var(--mono);line-height:1}
  .insight-sub{font-size:10px;color:var(--text-muted);font-family:var(--mono);line-height:1.5}

  /* SCORE */
  .score-card{background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r);padding:18px 20px}
  .score-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .score-num{font-size:42px;font-weight:800;font-family:var(--mono);line-height:1}
  .score-denom{font-size:16px;color:var(--text-muted);font-family:var(--mono)}
  .score-label-badge{font-size:10px;font-weight:700;padding:4px 11px;border-radius:6px;font-family:var(--mono)}
  .score-bar-wrap{height:7px;background:var(--surface2);border-radius:4px;margin-bottom:12px;overflow:hidden}
  .score-bar{height:7px;border-radius:4px;transition:width .6s cubic-bezier(.4,0,.2,1)}
  .score-items{display:flex;flex-direction:column;gap:4px}
  .score-item{font-size:10px;color:var(--text-muted);font-family:var(--mono)}
  .ratio-bar{display:flex;height:20px;border-radius:6px;overflow:hidden;margin:10px 0 0}
  .ratio-crypto{display:flex;align-items:center;justify-content:center;background:#f7931a}
  .ratio-stocks{display:flex;align-items:center;justify-content:center;background:var(--green)}
  .ratio-label{font-size:9px;font-weight:700;color:white;white-space:nowrap;padding:0 5px}

  /* ANALISTA */
  .analyst-card{background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r);padding:22px 24px;margin-bottom:var(--g-lg)}
  .analyst-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .analyst-avatar{width:40px;height:40px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
  .analyst-name{font-size:14px;font-weight:700} .analyst-title{font-size:10px;color:var(--text-muted);font-family:var(--mono);margin-top:1px}
  .risk-badge{display:inline-block;margin-top:7px;font-size:10px;font-weight:700;font-family:var(--mono);color:var(--accent);background:var(--accent-dim);padding:3px 10px;border-radius:5px;border:1px solid rgba(139,109,255,.3)}

  /* OPORTUNIDADES */
  .opp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--g)}
  .opp-card{background:var(--surface);border:1px solid var(--border-subtle);border-left:3px solid var(--green);border-radius:var(--r-sm);padding:14px 16px}
  .opp-asset{font-size:14px;font-weight:700;font-family:var(--mono);color:var(--green);margin-bottom:6px}
  .opp-reason{font-size:12px;color:var(--text-dim);line-height:1.55;margin-bottom:8px}
  .opp-risk{font-size:10px;color:var(--orange);font-family:var(--mono)}
  .analyst-opinion{font-size:14px;line-height:1.75;color:var(--text-dim);padding:16px 18px;background:var(--surface2);border-radius:var(--r-sm);border-left:3px solid var(--accent)}

  /* GRÁFICO */
  .chart-card{background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r);padding:22px 24px;margin-bottom:var(--g-lg)}
  .chart-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
  .chart-current{font-size:30px;font-weight:800;font-family:var(--mono);letter-spacing:-1px}
  .chart-growth{font-size:12px;font-family:var(--mono);margin-top:3px}
  .chart-svg{width:100%;height:auto;display:block;margin-top:8px;overflow:visible}
  .chart-x-label{font-size:9px;fill:var(--text-muted);font-family:var(--mono)}
  .chart-val-label{font-size:11px;font-weight:700;fill:var(--accent);font-family:var(--mono)}
  .chart-single{text-align:center;padding:24px 0}
  .chart-single-val{font-size:34px;font-weight:800;font-family:var(--mono);letter-spacing:-1px}
  .chart-single-label{font-size:12px;color:var(--text-dim);font-family:var(--mono);margin-top:6px}
  .chart-single-sub{font-size:11px;color:var(--text-muted);margin-top:4px}

  /* SEÑALES */
  .signals-group{margin-bottom:18px}
  .signals-group-title{font-size:12px;font-weight:700;color:var(--text-dim);margin-bottom:12px;display:flex;align-items:center;gap:10px}
  .signals-group-title::after{content:"";flex:1;height:1px;background:var(--border-subtle)}
  .assets-grid-stocks{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--g)}
  .assets-grid-crypto{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--g)}
  .asset-card{background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r-sm);padding:16px 17px;border-top:2px solid var(--asset-color,var(--border))}
  .asset-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .asset-name{display:flex;align-items:center;gap:8px}
  .asset-icon{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:var(--mono);font-size:13px;flex-shrink:0}
  .asset-ticker{font-size:14px;font-weight:700;font-family:var(--mono)} .asset-label{font-size:9px;color:var(--text-muted);margin-top:1px}
  .signal-badge{font-size:8px;font-weight:700;letter-spacing:.7px;padding:3px 7px;border-radius:4px;font-family:var(--mono)}
  .signal-buy{background:var(--green-dim);color:var(--green)} .signal-hold{background:var(--yellow-dim);color:var(--yellow)} .signal-wait{background:var(--red-dim);color:var(--red)}
  .asset-price{font-size:19px;font-weight:700;font-family:var(--mono);letter-spacing:-.4px;margin-bottom:4px}
  .asset-change{font-size:11px;font-family:var(--mono);margin-bottom:9px}
  .asset-change-label{color:var(--text-muted);font-size:9px}
  .asset-change.pos{color:var(--green)} .asset-change.neg{color:var(--red)}
  .port-mini{display:flex;justify-content:space-between;font-size:11px;font-family:var(--mono);padding:6px 9px;background:var(--surface2);border-radius:6px;margin-bottom:7px;color:var(--text-muted)}
  .asset-delta{font-size:10px;font-family:var(--mono);margin-bottom:8px;display:flex;align-items:center;gap:5px}
  .asset-delta-label{color:var(--text-muted);font-size:9px}
  .asset-context{font-size:10px;line-height:1.55;color:var(--text-dim);padding:8px 10px;background:var(--surface2);border-radius:6px;border-left:2px solid var(--border)}
  .price-compare{display:flex;align-items:center;gap:7px;padding:6px 9px;background:var(--surface2);border-radius:6px;margin-bottom:7px}
  .pc-item{display:flex;flex-direction:column}
  .pc-label{font-size:8px;letter-spacing:.5px;text-transform:uppercase;color:var(--text-muted);font-family:var(--mono)}
  .pc-item .mono{font-size:11px;font-weight:600}
  .pc-arrow{color:var(--text-muted);font-size:11px}
  .pc-gain{font-size:10px;font-weight:700;font-family:var(--mono);margin-left:auto}

  /* P&L */
  .pnl-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--g);margin-bottom:var(--g-lg)}
  .pnl-card{background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--r);padding:22px 24px}
  .pnl-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px}
  .pnl-title{font-size:14px;font-weight:700}
  .pnl-total-badge{font-size:12px;font-weight:700;font-family:var(--mono);padding:4px 11px;border-radius:6px}
  .pnl-total-badge.pos{background:var(--green-dim);color:var(--green)} .pnl-total-badge.neg{background:var(--red-dim);color:var(--red)}
  .pnl-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--border-subtle);gap:10px}
  .pnl-row:last-of-type{border-bottom:none}
  .pnl-asset{display:flex;align-items:center;gap:9px;min-width:95px}
  .asset-icon-sm{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:var(--mono);font-size:11px;flex-shrink:0}
  .pnl-nums{display:flex;gap:14px;flex-wrap:wrap}
  .pnl-trio{display:flex;flex-direction:column;min-width:58px}
  .pnl-name{font-size:13px;font-weight:600} .pnl-qty{font-size:10px;color:var(--text-muted);font-family:var(--mono)}
  .pnl-bar-wrap{height:3px;background:var(--border);border-radius:2px;margin-top:4px;width:100%}
  .pnl-bar{height:3px;border-radius:2px;transition:width .5s ease}
  .pnl-subtotal{display:flex;justify-content:space-between;padding:13px 0 0;border-top:2px solid var(--border);margin-top:5px;font-size:13px;font-weight:700;flex-wrap:wrap;gap:8px}

  /* COMPOSICIÓN */
  .comp-pair{display:grid;grid-template-columns:1fr 1fr;gap:var(--g);margin-bottom:var(--g-lg)}
  .comp-scroll{max-height:175px;overflow-y:auto;padding-right:6px}
  .pnl-scroll{max-height:320px;overflow-y:auto;padding-right:6px}
  .pnl-scroll::-webkit-scrollbar{width:4px} .pnl-scroll::-webkit-scrollbar-track{background:var(--surface2);border-radius:2px} .pnl-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
  .comp-scroll::-webkit-scrollbar{width:4px} .comp-scroll::-webkit-scrollbar-track{background:var(--surface2);border-radius:2px} .comp-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
  .comp-row{display:grid;grid-template-columns:62px 1fr 44px 62px;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border-subtle)}
  .comp-row:last-child{border-bottom:none}
  .comp-label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
  .comp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .comp-bar-wrap{height:6px;background:var(--surface2);border-radius:3px;overflow:hidden}
  .comp-bar{height:6px;border-radius:3px;transition:width .5s ease}
  .comp-pct{font-size:11px;text-align:right} .comp-val{font-size:10px;text-align:right;color:var(--text-muted)}

  /* MACRO + DECISIONES */
  .bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--g);margin-bottom:var(--g-lg)}
  .macro-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
  .macro-item{background:var(--surface2);border-radius:var(--r-sm);padding:12px 14px}
  .macro-item-label{font-size:9px;color:var(--text-muted);font-family:var(--mono);letter-spacing:.9px;text-transform:uppercase;margin-bottom:4px}
  .macro-item-value{font-size:18px;font-weight:700;font-family:var(--mono)}
  .macro-item-sub{font-size:9px;color:var(--text-muted);font-family:var(--mono);margin-top:3px}
  .macro-narrative{font-size:12px;line-height:1.65;color:var(--text-dim);padding:12px;background:var(--surface2);border-radius:var(--r-sm)}
  .decision-card{background:var(--surface);border:1px solid var(--accent);border-radius:var(--r);padding:22px 24px}
  .decision-header{display:flex;align-items:center;gap:9px;margin-bottom:16px}
  .decision-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent);flex-shrink:0}
  .decision-title{font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--accent);font-family:var(--mono)}
  .action-item{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--border-subtle)}
  .action-item:last-child{border-bottom:none}
  .action-num{font-size:11px;font-weight:700;font-family:var(--mono);color:var(--accent);min-width:20px;padding-top:1px}
  .action-text{font-size:13px;line-height:1.55;color:var(--text-dim)}

  /* DCA */
  .dca-grid{display:flex;flex-direction:column;gap:10px}
  .dca-item{display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface2);border-radius:var(--r-sm)}
  .dca-info{flex:1} .dca-name{font-size:12px;font-weight:600}
  .dca-amount{font-size:11px;color:var(--accent);font-family:var(--mono);margin-top:2px}
  .dca-next{font-size:10px;color:var(--text-muted);margin-top:2px}
  .dca-stats{text-align:right} .dca-stats div{font-size:11px}

  /* BITÁCORA */
  .log-list{display:flex;flex-direction:column;gap:2px}
  .log-row{display:grid;grid-template-columns:70px 50px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:11px}
  .log-row:last-child{border-bottom:none}
  .log-date{color:var(--text-muted)} .log-qty{color:var(--green);font-weight:600}
  .log-note{font-size:10px}

  /* CALENDARIO */
  .cal-grid{display:flex;flex-direction:column;gap:7px}
  .cal-row{display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid var(--border-subtle)}
  .cal-row:last-child{border-bottom:none}
  .cal-fecha{font-size:11px;font-weight:600;min-width:52px}
  .cal-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .cal-evento{font-size:12px;color:var(--text-dim)}

  /* HISTORIAL */
  .history-wrap{overflow-x:auto}
  .history-table{width:100%;border-collapse:collapse;font-size:11px;min-width:300px}
  .history-table th{text-align:left;font-size:9px;color:var(--text-muted);font-family:var(--mono);letter-spacing:.9px;text-transform:uppercase;padding:0 8px 10px 0;border-bottom:1px solid var(--border)}
  .history-table td{padding:9px 8px 9px 0;border-bottom:1px solid var(--border-subtle);color:var(--text-dim)}
  .history-table tr:last-child td{border-bottom:none}
  .no-history{font-size:12px;color:var(--text-muted);padding:10px 0;text-align:center}

  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:var(--g);margin-bottom:var(--g-lg)}
  .three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--g);margin-bottom:var(--g-lg)}
  /* CONVERSOR USD/COP */
  .cop-widget{display:flex;flex-direction:column;gap:16px}
  .cop-header{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px}
  .cop-current-rate{font-size:13px;font-weight:600;color:var(--text)}
  .cop-sub{font-size:11px;color:var(--text-muted);margin-top:3px}
  .cop-reset{background:var(--surface2);color:var(--text-dim);border:1px solid var(--border);padding:5px 12px;border-radius:6px;font-size:10px;font-family:var(--sans);cursor:pointer;white-space:nowrap}
  .cop-reset:hover{background:var(--border)}
  .cop-slider{width:100%;height:6px;border-radius:3px;background:var(--surface2);outline:none;-webkit-appearance:none;cursor:pointer}
  .cop-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--accent);cursor:pointer;box-shadow:0 0 0 4px var(--accent-dim)}
  .cop-slider::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--accent);cursor:pointer;border:none;box-shadow:0 0 0 4px var(--accent-dim)}
  .cop-rate-display{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .cop-rate-label{font-size:11px;color:var(--text-muted)}
  .cop-rate-value{font-size:22px;font-weight:800;color:var(--accent)}
  .cop-rate-diff{font-size:11px;font-family:var(--mono)}
  .cop-results{display:flex;align-items:center;gap:14px;padding:16px;background:var(--surface2);border-radius:var(--r-sm);flex-wrap:wrap}
  .cop-result-item{flex:1;min-width:140px}
  .cop-result-item.highlight .cop-result-value{color:var(--green);font-size:24px}
  .cop-result-label{font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:var(--text-muted);font-family:var(--mono);margin-bottom:4px}
  .cop-result-value{font-size:20px;font-weight:800}
  .cop-result-arrow{font-size:18px;color:var(--text-muted)}
  .cop-breakdown{display:flex;gap:16px;flex-wrap:wrap;padding-top:4px}
  .cop-breakdown-item{display:flex;gap:6px;font-size:11px;color:var(--text-muted)}
  .cop-breakdown-item .mono{color:var(--text-dim);font-weight:600}

  /* INFO ICON + TOAST */
  .info-icon{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:var(--surface2);color:var(--text-muted);font-size:10px;margin-left:5px;cursor:help;vertical-align:middle;transition:all .15s}
  .info-icon:hover{background:var(--accent);color:white}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--accent);border-radius:var(--r-sm);padding:12px 18px;font-size:12px;color:var(--text);max-width:320px;text-align:left;box-shadow:0 8px 24px rgba(0,0,0,.4);z-index:200;opacity:0;pointer-events:none;transition:all .25s ease}
  .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

  .footer{margin-top:24px;text-align:center;font-size:10px;color:var(--text-muted);font-family:var(--mono);padding-top:18px;border-top:1px solid var(--border-subtle)}

  /* RESPONSIVE */
  @media(max-width:1100px){
    .assets-grid-crypto{grid-template-columns:repeat(4,1fr)}
    .assets-grid-stocks{grid-template-columns:repeat(3,1fr)}
    .insights-top{grid-template-columns:1fr}
    .insights-mid{grid-template-columns:1fr 1fr}
    .three-col{grid-template-columns:1fr}
  }
  @media(max-width:768px){
    body{padding:14px;padding-top:76px}
    .totals-bar{grid-template-columns:1fr 1fr}
    .insights-mid{grid-template-columns:1fr 1fr}
    .pnl-grid{grid-template-columns:1fr}
    .comp-pair{grid-template-columns:1fr}
    .assets-grid-crypto{grid-template-columns:repeat(2,1fr)}
    .assets-grid-stocks{grid-template-columns:repeat(2,1fr)}
    .bottom-grid{grid-template-columns:1fr}
    .two-col{grid-template-columns:1fr}
    .total-value{font-size:22px} .total-card.highlight .total-value{font-size:24px}
    .header h1{font-size:20px}
    .sticky-stats{gap:14px}
  }
  @media(max-width:480px){
    body{padding:12px;padding-top:72px}
    .totals-bar{grid-template-columns:1fr 1fr}
    .assets-grid-crypto{grid-template-columns:1fr 1fr}
    .assets-grid-stocks{grid-template-columns:1fr 1fr}
    .total-value{font-size:19px}
    .pnl-row{flex-direction:column;align-items:flex-start}
    .pnl-nums{width:100%}
    .sticky-stat:nth-child(n+3){display:none}
    .comp-row{grid-template-columns:52px 1fr 38px 52px}
  }
  @media print{ .sticky-bar,.pdf-btn{display:none!important} body{padding-top:20px} }
</style>
</head>
<body>

<div class="sticky-bar">
  <div class="sticky-logo">Market<span>Intel</span></div>
  <div class="sticky-stats">
    <div class="sticky-stat"><div class="sticky-stat-label">Total</div><div class="sticky-stat-val num">$${fmt(totalVal)}</div></div>
    <div class="sticky-stat"><div class="sticky-stat-label">P&L</div><div class="sticky-stat-val num ${cls(totalPnL)}">${sign(totalPnL)}$${fmt(totalPnL)}</div></div>
    <div class="sticky-stat"><div class="sticky-stat-label">BTC</div><div class="sticky-stat-val num">${d.btc?.price||"—"}</div></div>
    ${monthChange ? `<div class="sticky-stat"><div class="sticky-stat-label">vs mes</div><div class="sticky-stat-val num ${cls(monthChange)}">${pct(monthChange)}</div></div>` : ""}
  </div>
  <div class="header-actions">
    <a class="refresh-btn" href="https://github.com/AndresTapiero/market-intelligence/actions/workflows/weekly-analysis.yml" target="_blank" rel="noopener" title="Lanzar nuevo analisis en GitHub Actions">↻ Actualizar datos</a>
    <button class="pdf-btn" onclick="exportPDF()">⬇ PDF</button>
  </div>
</div>

<div class="header" id="report-content">
  <div>
    <h1>Market Intelligence</h1>
    <div class="header-sub">Reporte de inversiones · ${now}</div>
  </div>
  <div class="header-right">
    <div class="week-badge">${getMonthLabel()}</div>
    <div class="analyst-badge">Analista Senior · 10 años · CFA L2</div>
  </div>
</div>

<!-- 1. PORTAFOLIO TOTAL -->
<div class="section-title">Portafolio Total</div>
<div class="totals-bar mb">
  <div class="total-card">
    <div class="total-label">Capital Invertido</div>
    <div class="total-value num">$${fmt(totalInvested)}</div>
    <div class="total-sub">costo base USD</div>
    <div class="total-sub-cop">≈ $${fmtCOPval(totalInvested)} COP</div>
    <div class="total-breakdown"><span>Crypto $${fmt(totalCryptoInvested)}</span><span>Acc. $${fmt(totalStocksInvested)}</span></div>
  </div>
  <div class="total-card">
    <div class="total-label">Valor de Mercado</div>
    <div class="total-value num">$${fmt(totalCryptoVal+totalStocksVal)}</div>
    <div class="total-sub">a precios actuales</div>
    <div class="total-sub-cop">≈ $${fmtCOPval(totalCryptoVal+totalStocksVal)} COP</div>
    <div class="total-breakdown"><span>Crypto $${fmt(totalCryptoVal)}</span><span>Acc. $${fmt(totalStocksVal)}</span></div>
  </div>
  <div class="total-card">
    <div class="total-label">Resultado P&L${infoIcon("pnl")}</div>
    <div class="total-value num ${cls(totalPnL)}">${sign(totalPnL)}$${fmt(totalPnL)}</div>
    <div class="total-sub ${cls(totalPnL)}">${pct(totalPnLPct)} sobre capital</div>
    <div class="total-sub-cop ${cls(totalPnL)}">≈ ${sign(totalPnL)}$${fmtCOPval(Math.abs(totalPnL))} COP</div>
    <div class="total-breakdown"><span class="${cls(totalCryptoPnL)}">Crypto ${pct(totalCryptoPnLPct)}</span><span class="${cls(totalStocksPnL)}">Acc. ${pct(totalStocksPnLPct)}</span></div>
  </div>
  <div class="total-card highlight">
    <div class="total-label">Total Portafolio</div>
    <div class="total-value num">$${fmt(totalVal)}</div>
    <div class="total-sub">activos + cash${monthChange ? ` · <span class="${cls(monthChange)}">${pct(monthChange)} vs mes</span>` : ""}</div>
    <div class="total-breakdown"><span>Cash $${fmt(cashVal)}</span>${annualizedReturn ? `<span class="${cls(annualizedReturn)}">Ann. ${pct(annualizedReturn)}</span>` : ""}</div>
  </div>
</div>


<!-- 1b. CONVERSOR INTERACTIVO USD/COP -->
<div class="section-title">Simulador de conversión a pesos</div>
<div class="card mb">
  <div class="cop-widget">
    <div class="cop-header">
      <div>
        <div class="cop-current-rate">TRM actual: <span class="mono num" id="copBaseRate">$0</span> COP</div>
        <div class="cop-sub">Desliza para simular distintos escenarios de tasa de cambio</div>
      </div>
      <button class="cop-reset" onclick="resetCopRate()">↺ Restablecer</button>
    </div>
    <input type="range" id="copSlider" class="cop-slider" min="2800" max="4500" step="1" value="3433">
    <div class="cop-rate-display">
      <span class="cop-rate-label">Tasa simulada:</span>
      <span class="mono num cop-rate-value" id="copRateValue">$3,433.71</span>
      <span class="cop-rate-diff" id="copRateDiff"></span>
    </div>
    <div class="cop-results">
      <div class="cop-result-item">
        <div class="cop-result-label">Total Portafolio (USD)</div>
        <div class="mono num cop-result-value" id="copUsdVal">$0</div>
      </div>
      <div class="cop-result-arrow">→</div>
      <div class="cop-result-item highlight">
        <div class="cop-result-label">Equivalente en COP</div>
        <div class="mono num cop-result-value" id="copValue">$0</div>
      </div>
    </div>
    <div class="cop-breakdown">
      <div class="cop-breakdown-item"><span>Crypto</span><span class="mono num" id="copCrypto">$0</span></div>
      <div class="cop-breakdown-item"><span>Acciones</span><span class="mono num" id="copStocks">$0</span></div>
      <div class="cop-breakdown-item"><span>Cash</span><span class="mono num" id="copCash">$0</span></div>
    </div>
  </div>
</div>



<!-- 2. ANALISTA -->
<div class="analyst-card">
  <div class="analyst-header">
    <div class="analyst-avatar">📊</div>
    <div><div class="analyst-name">Analista Senior de Portafolio</div><div class="analyst-title">10 años · Renta Variable & Activos Digitales · CFA Level II</div>${d.riskProfile ? `<div class="risk-badge">Perfil de riesgo: ${d.riskProfile}${infoIcon("riskprofile")}</div>` : ""}</div>
  </div>
  <div class="analyst-opinion">${d.analystOpinion||"Analisis no disponible."}</div>
</div>


<!-- 2b. NUEVAS OPORTUNIDADES -->
<div class="section-title">Oportunidades de inversión sugeridas</div>
<div class="opp-grid mb">
  ${newOpportunities()}
</div>


<!-- 3. MACRO ECONÓMICO -->
<div class="section-title">Contexto Macroeconómico</div>
<div class="card mb">
  <div class="macro-grid">
    <div class="macro-item"><div class="macro-item-label">USD/COP${infoIcon("trm")}</div><div class="macro-item-value num">${d.macro?.usdcop||"—"}</div><div class="macro-item-sub">tasa ARQ</div></div>
    <div class="macro-item"><div class="macro-item-label">FED Rate</div><div class="macro-item-value num">${d.macro?.fedrate||"—"}</div><div class="macro-item-sub">política</div></div>
    <div class="macro-item"><div class="macro-item-label">BTC Dom.${infoIcon("dominance")}</div><div class="macro-item-value num">${d.macro?.btcDominance||"—"}</div><div class="macro-item-sub">dominancia</div></div>
    <div class="macro-item"><div class="macro-item-label">Fear & Greed${infoIcon("feargreed")}</div><div class="macro-item-value num">${d.macro?.fearGreed||"—"}</div><div class="macro-item-sub">${d.macro?.fearGreedLabel||"sentimiento"}</div></div>
  </div>
  <div class="macro-narrative">${d.macro?.narrative||""}</div>
</div>

<!-- 4. GRÁFICO -->
<div class="section-title">Evolución del portafolio</div>
<div class="chart-card mb">
  ${portfolioChart()}
</div>


<!-- 5. INDICADORES -->
<div class="section-title">Indicadores clave</div>
<div class="insights-top mb">
  <div class="score-card">
    <div class="section-title" style="margin-bottom:10px">Score de salud${infoIcon("score")}</div>
    <div class="score-top">
      <div><span class="score-num" style="color:${scoreColor}">${score}</span><span class="score-denom">/10</span></div>
      <span class="score-label-badge" style="background:${scoreColor}22;color:${scoreColor}">${scoreLabel}</span>
    </div>
    <div class="score-bar-wrap"><div class="score-bar" style="width:${(score/10*100).toFixed(0)}%;background:${scoreColor}"></div></div>
    <div class="score-items">
      <div class="score-item">📊 Balance ${cryptoRatio}/${stocksRatio} crypto/acc.</div>
      <div class="score-item ${cls(totalCryptoPnLPct)}">₿ Crypto P&L ${pct(totalCryptoPnLPct)}</div>
      <div class="score-item ${cls(totalStocksPnLPct)}">📈 Acciones P&L ${pct(totalStocksPnLPct)}</div>
      <div class="score-item pos">✓ DCA activo · ${history?.length||0} ciclos</div>
    </div>
    <div class="ratio-bar">
      <div class="ratio-crypto" style="width:${cryptoRatio}%"><span class="ratio-label">Crypto ${cryptoRatio}%</span></div>
      <div class="ratio-stocks" style="width:${stocksRatio}%"><span class="ratio-label">Acc. ${stocksRatio}%</span></div>
    </div>
  </div>
  <div class="insight-card ${btcBreakEven && parseFloat(btcBreakEven) > 0 ? "alert-orange" : "good"}">
    <div class="insight-label">📍 BTC Break-even${infoIcon("breakeven")}</div>
    ${btcBreakEven
      ? `<div class="insight-value" style="${parseFloat(btcBreakEven) > 0 ? "color:var(--orange)" : "color:var(--green)"}">${parseFloat(btcBreakEven) > 0 ? "+" : "✓ "}${btcBreakEven}%</div>
         <div class="insight-sub">Costo avg: <strong>$${fmt(btcCostAvg)}</strong><br>Precio: <strong>$${fmt(btcPrice)}</strong><br>${parseFloat(btcBreakEven) > 0 ? `Falta ${btcBreakEven}% para break-even` : "Posicion rentable"}</div>`
      : `<div class="insight-value text-muted">—</div><div class="insight-sub">Precio no disponible</div>`}
  </div>
  <div class="insight-card ${annualizedReturn && parseFloat(annualizedReturn) > 0 ? "good" : ""}">
    <div class="insight-label">📅 Retorno anualizado${infoIcon("annualized")}</div>
    ${annualizedReturn
      ? `<div class="insight-value ${cls(annualizedReturn)}">${pct(annualizedReturn)}</div><div class="insight-sub">Proyección sobre ${history?.length||0} reportes de historial real</div>`
      : `<div class="insight-value text-muted">—</div><div class="insight-sub">Disponible desde el 2do reporte</div>`}
  </div>
</div>

<div class="insights-mid mb">
  <div class="insight-card good">
    <div class="insight-label">🏆 Mejor acción</div>
    <div class="insight-value pos">${bestStock?.key?.toUpperCase()||"—"}</div>
    <div class="insight-value" style="font-size:15px;color:var(--green)">${d[bestStock?.key]?.change7d||"—"}</div>
    <div class="insight-sub">${bestStock?.label||""}<br>Valor: $${fmt(bestStock?.current||0)}<br>P&L: <strong class="pos">${pct(bestStock?.pnlP||"0")}</strong></div>
  </div>
  <div class="insight-card alert-red">
    <div class="insight-label" style="color:var(--red)">⚠️ Peor acción</div>
    <div class="insight-value neg">${worstStock?.key?.toUpperCase()||"—"}</div>
    <div class="insight-value" style="font-size:15px;color:var(--red)">${d[worstStock?.key]?.change7d||"—"}</div>
    <div class="insight-sub">${worstStock?.label||""}<br>Valor: $${fmt(worstStock?.current||0)}<br>P&L: <strong class="${cls(worstStock?.pnlV||0)}">${pct(worstStock?.pnlP||"0")}</strong></div>
  </div>
  <div class="insight-card good">
    <div class="insight-label">🏆 Mejor crypto</div>
    <div class="insight-value pos">${bestCrypto?.key?.toUpperCase()||"—"}</div>
    <div class="insight-value" style="font-size:15px;color:var(--green)">${d[bestCrypto?.key]?.change7d||"—"}</div>
    <div class="insight-sub">${bestCrypto?.label||""}<br>Valor: $${fmt(bestCrypto?.current||0)}<br>P&L: <strong class="${cls(bestCrypto?.pnlV||0)}">${pct(bestCrypto?.pnlP||"0")}</strong></div>
  </div>
  <div class="insight-card alert-red">
    <div class="insight-label" style="color:var(--red)">⚠️ Peor crypto</div>
    <div class="insight-value neg">${worstCrypto?.key?.toUpperCase()||"—"}</div>
    <div class="insight-value" style="font-size:15px;color:var(--red)">${d[worstCrypto?.key]?.change7d||"—"}</div>
    <div class="insight-sub">${worstCrypto?.label||""}<br>Valor: $${fmt(worstCrypto?.current||0)}<br>P&L: <strong class="${cls(worstCrypto?.pnlV||0)}">${pct(worstCrypto?.pnlP||"0")}</strong></div>
  </div>
</div>


<!-- 6. SEÑALES -->
<div class="section-title">Señales de mercado</div>
<div class="signals-group">
  <div class="signals-group-title">📈 Acciones</div>
  ${assetCardGroup(stockAssets, "assets-grid-stocks")}
</div>
<div class="signals-group">
  <div class="signals-group-title">🔶 Crypto</div>
  ${assetCardGroup(cryptoAssets, "assets-grid-crypto")}
</div>


<!-- 7. P&L -->
<div class="section-title">Rendimiento detallado</div>
<div class="pnl-grid mb">
  <div class="pnl-card">
    <div class="pnl-header"><div class="pnl-title">Acciones · ${stockAssets.length}</div><div class="pnl-total-badge ${cls(totalStocksPnL)}">${sign(totalStocksPnL)}$${fmt(totalStocksPnL)} (${pct(totalStocksPnLPct)})</div></div>
    ${pnlRows(stockAssets)}
    <div class="pnl-subtotal"><span class="text-muted">Total</span><span class="mono num">$${fmt(totalStocksInvested)}</span><span class="mono num">$${fmt(totalStocksVal)}</span><span class="mono num ${cls(totalStocksPnL)}">${sign(totalStocksPnL)}$${fmt(totalStocksPnL)}</span></div>
  </div>
  <div class="pnl-card">
    <div class="pnl-header"><div class="pnl-title">Crypto · ${cryptoAssets.length}</div><div class="pnl-total-badge ${cls(totalCryptoPnL)}">${sign(totalCryptoPnL)}$${fmt(totalCryptoPnL)} (${pct(totalCryptoPnLPct)})</div></div>
    ${pnlRows(cryptoAssets)}
    <div class="pnl-subtotal"><span class="text-muted">Total</span><span class="mono num">$${fmt(totalCryptoInvested)}</span><span class="mono num">$${fmt(totalCryptoVal)}</span><span class="mono num ${cls(totalCryptoPnL)}">${sign(totalCryptoPnL)}$${fmt(totalCryptoPnL)}</span></div>
  </div>
</div>


<!-- 8. COMPOSICIÓN -->
<div class="section-title">Composición del portafolio</div>
<div class="comp-pair">
  <div class="card"><div class="section-title">Acciones · $${fmt(totalStocksVal)}</div>${compBarsScroll(stockAssets, totalStocksVal)}</div>
  <div class="card"><div class="section-title">Crypto · $${fmt(totalCryptoVal)}</div>${compBarsScroll(cryptoAssets, totalCryptoVal)}</div>
</div>


<!-- 9. DECISIONES DEL MES -->
<div class="section-title">Decisiones para este mes</div>
<div class="decision-card mb">
  <div class="decision-header"><div class="decision-dot"></div><div class="decision-title">Acciones recomendadas</div></div>
  ${actionItems()}
</div>

<!-- 10. DCA + BITÁCORA + CALENDARIO -->
<div class="three-col">
  <div class="card"><div class="section-title">DCA Tracker${infoIcon("dca")}</div>${dcaTracker()}</div>
  <div class="card"><div class="section-title">Bitácora de compras</div>${dcaLog()}</div>
  <div class="card"><div class="section-title">Próximos eventos</div><div class="cal-grid">${calendario.map(calRow).join("")}</div></div>
</div>

<div class="footer">Market Intelligence v7 · Analista Senior 10 años · Solo informativo, no es asesoría financiera regulada · ${now}</div>

<script>
// ─── CONVERSOR INTERACTIVO USD/COP ─────────────────────────────────────────
const COP_DATA = {
  baseRate: ${parseFloat((d.macro?.usdcop||"3433.71").replace(/[$, COP]/g,"")) || 3433.71},
  totalUsd: ${totalVal},
  cryptoUsd: ${totalCryptoVal},
  stocksUsd: ${totalStocksVal},
  cashUsd: ${cashVal}
};

function fmtCOP(n) {
  return Math.round(n).toLocaleString('es-CO');
}

function updateCopWidget(rate) {
  document.getElementById('copRateValue').textContent = '$' + Number(rate).toLocaleString('es-CO', {minimumFractionDigits:2, maximumFractionDigits:2});

  const diff = ((rate - COP_DATA.baseRate) / COP_DATA.baseRate * 100);
  const diffEl = document.getElementById('copRateDiff');
  if (Math.abs(diff) < 0.05) {
    diffEl.textContent = '(tasa actual)';
    diffEl.className = 'cop-rate-diff text-muted';
  } else {
    diffEl.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '% vs TRM real';
    diffEl.className = 'cop-rate-diff ' + (diff >= 0 ? 'pos' : 'neg');
  }

  document.getElementById('copUsdVal').textContent = '$' + Math.round(COP_DATA.totalUsd).toLocaleString('en-US');
  document.getElementById('copValue').textContent = '$' + fmtCOP(COP_DATA.totalUsd * rate) + ' COP';
  document.getElementById('copCrypto').textContent = '$' + fmtCOP(COP_DATA.cryptoUsd * rate) + ' COP';
  document.getElementById('copStocks').textContent = '$' + fmtCOP(COP_DATA.stocksUsd * rate) + ' COP';
  document.getElementById('copCash').textContent = '$' + fmtCOP(COP_DATA.cashUsd * rate) + ' COP';
}

function resetCopRate() {
  const slider = document.getElementById('copSlider');
  slider.value = COP_DATA.baseRate;
  updateCopWidget(COP_DATA.baseRate);
}

document.addEventListener('DOMContentLoaded', function() {
  const slider = document.getElementById('copSlider');
  const baseRateEl = document.getElementById('copBaseRate');
  if (slider) {
    slider.value = COP_DATA.baseRate;
    slider.min = Math.max(2000, Math.round(COP_DATA.baseRate * 0.7));
    slider.max = Math.round(COP_DATA.baseRate * 1.3);
    baseRateEl.textContent = '$' + Number(COP_DATA.baseRate).toLocaleString('es-CO', {minimumFractionDigits:2});
    updateCopWidget(COP_DATA.baseRate);
    slider.addEventListener('input', (e) => updateCopWidget(e.target.value));
  }
});

let toastTimeout;
function showToast(el, text) {
  let toast = document.getElementById('infoToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'infoToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

function exportPDF() {
  const btn = document.querySelector('.pdf-btn');
  btn.textContent = '⏳ Generando...';
  const opt = {
    margin: 8,
    filename: 'market-intelligence-${getMonthLabel().replace(/ /g,"-")}.pdf',
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, backgroundColor: '#0a0c10', useCORS: true },
    jsPDF: { unit: 'mm', format: 'a3', orientation: 'portrait' }
  };
  const el = document.body.cloneNode(true);
  const stickyClone = el.querySelector('.sticky-bar'); if (stickyClone) stickyClone.remove();
  html2pdf().set(opt).from(el).save().then(() => { btn.textContent = '⬇ PDF'; }).catch(() => { btn.textContent = '⬇ PDF'; });
}
</script>
</body>
</html>`;
}

function getMonthLabel() {
  return new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
