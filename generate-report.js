/**
 * generate-report.js — v6 FINAL
 * Diseño premium · Sticky header mobile · Score salud · Calendario · Variación mes
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

  // ─── CRYPTO META ──────────────────────────────────────────────────────────────
  const cryptoMeta = {
    btc:  { label:"Bitcoin",   icon:"₿", color:"#f7931a" },
    eth:  { label:"Ethereum",  icon:"Ξ", color:"#627eea" },
    sol:  { label:"Solana",    icon:"◎", color:"#9945ff" },
    tao:  { label:"Bittensor", icon:"τ", color:"#38bdf8" },
    uni:  { label:"Uniswap",   icon:"U", color:"#ff007a" },
    bnb:  { label:"BNB",       icon:"B", color:"#f3ba2f" },
    sui:  { label:"SUI",       icon:"S", color:"#6fbcf0" },
    sei:  { label:"SEI",       icon:"s", color:"#e84142" },
    ena:  { label:"Ethena",    icon:"E", color:"#00d4ff" },
    avax: { label:"Avalanche", icon:"A", color:"#e84142" },
  };

  const stockMeta = {
    voo:  { label:"VOO",    icon:"V", color:"#00d4a0" },
    qqq:  { label:"QQQ",    icon:"Q", color:"#4d8fff" },
    nvda: { label:"NVIDIA", icon:"N", color:"#76b900" },
    nu:   { label:"Nubank", icon:"N", color:"#8250ff" },
    tsla: { label:"Tesla",  icon:"T", color:"#e31937" },
  };

  // ─── BUILD ASSETS ─────────────────────────────────────────────────────────────
  const cryptoAssets = Object.keys(cryptoMeta).map(key => {
    const c = portfolio.crypto[key] || {};
    const cur = c.currentVal || 0;
    const inv = (c.qty||0) * (c.costAvg||0);
    return { key, ...cryptoMeta[key], ic:key, qty:`${c.qty||0} ${key.toUpperCase()}`, invested:inv, current:cur, pnlV:cur-inv, pnlP:pnlPct(cur,inv) };
  });

  const stockAssets = Object.keys(stockMeta).map(key => {
    const s = portfolio.stocks[key] || {};
    const cur = s.val || 0;
    const inv = cur / (1 + (s.gainPct||0)/100);
    return { key, ...stockMeta[key], ic:key, qty:"posicion", invested:inv, current:cur, pnlV:cur-inv, pnlP:pnlPct(cur,inv) };
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

  const cryptoRatio = ((totalCryptoVal/(totalCryptoVal+totalStocksVal))*100).toFixed(0);
  const stocksRatio = (100 - parseFloat(cryptoRatio)).toFixed(0);

  // ─── VARIACIÓN VS MES ANTERIOR ────────────────────────────────────────────────
  let prevTotal = null;
  let monthChange = null;
  if (history && history.length >= 2) {
    const prev = history[history.length - 2];
    const prevBtcPrice = parseFloat((prev.data?.btc?.price||"0").replace(/[$,]/g,"")) || 0;
    if (prevBtcPrice > 0) {
      prevTotal = prevBtcPrice * (portfolio.crypto.btc?.qty||0) + totalStocksVal;
      monthChange = ((totalVal - prevTotal) / prevTotal * 100).toFixed(1);
    }
  }

  // ─── INSIGHTS ─────────────────────────────────────────────────────────────────
  const allAssets = [...cryptoAssets, ...stockAssets];

  function withChangeFn(arr) {
    return arr.map(a => ({
      ...a, change7dNum: parseFloat((d[a.key]?.change7d||"0").replace(/[+%]/g,""))||0
    }));
  }

  const cryptoWithChange = withChangeFn(cryptoAssets);
  const stocksWithChange = withChangeFn(stockAssets);

  const bestCrypto  = [...cryptoWithChange].sort((a,b)=>b.change7dNum-a.change7dNum)[0];
  const worstCrypto = [...cryptoWithChange].sort((a,b)=>a.change7dNum-b.change7dNum)[0];
  const bestStock   = [...stocksWithChange].sort((a,b)=>b.change7dNum-a.change7dNum)[0];
  const worstStock  = [...stocksWithChange].sort((a,b)=>a.change7dNum-b.change7dNum)[0];

  const btcCostAvg  = portfolio.crypto.btc?.costAvg || 82716;
  const btcPrice    = parseFloat((d.btc?.price||"0").replace(/[$,]/g,"")) || 0;
  const btcBreakEven = btcPrice > 0 ? (((btcCostAvg-btcPrice)/btcPrice)*100).toFixed(1) : null;
  const btcConc     = totalVal > 0 ? ((totalCryptoVal/totalVal)*100).toFixed(1) : 0;
  const showAlert   = parseFloat(btcConc) > 65;

  // ─── SCORE DE SALUD ───────────────────────────────────────────────────────────
  let score = 10;
  // Diversificación: penalizar si BTC > 40% del total
  if (parseFloat(btcConc) > 65) score -= 2;
  else if (parseFloat(btcConc) > 50) score -= 1;
  // P&L crypto: penalizar pérdidas profundas
  if (parseFloat(totalCryptoPnLPct) < -40) score -= 2;
  else if (parseFloat(totalCryptoPnLPct) < -20) score -= 1;
  // Acciones positivas: sumar punto
  if (parseFloat(totalStocksPnLPct) > 20) score += 1;
  // DCA activo
  if (history && history.length > 0) score += 1;
  // Cash disponible para DCA
  if (cashVal > 50) score += 0.5;
  score = Math.min(10, Math.max(1, Math.round(score * 2) / 2));

  const scoreColor = score >= 7 ? "var(--green)" : score >= 5 ? "var(--yellow)" : "var(--red)";
  const scoreLabel = score >= 7 ? "Saludable" : score >= 5 ? "Moderado" : "Requiere atención";
  const scoreBar   = (score / 10 * 100).toFixed(0);

  // ─── RETORNO ANUALIZADO ───────────────────────────────────────────────────────
  let annualizedReturn = null;
  if (history && history.length >= 2) {
    const first = history[0];
    const last  = history[history.length-1];
    const days  = (first.timestamp && last.timestamp)
      ? (new Date(last.timestamp)-new Date(first.timestamp))/86400000
      : history.length * 30;
    if (days > 7 && totalInvested > 0) {
      annualizedReturn = ((Math.pow(1+parseFloat(totalPnLPct)/100, 365/days)-1)*100).toFixed(1);
    }
  }

  // ─── P&L ROWS ─────────────────────────────────────────────────────────────────
  function pnlRows(arr) {
    return arr.map(r => `
      <div class="pnl-row">
        <div class="pnl-asset">
          <div class="asset-icon-sm ${r.ic}" style="background:${r.color}22;color:${r.color}">${r.icon}</div>
          <div><div class="pnl-name">${r.label}</div><div class="pnl-qty">${r.qty}</div></div>
        </div>
        <div class="pnl-nums">
          <div class="pnl-trio"><span class="label-xs">Invertido</span><span class="mono">$${fmt(r.invested)}</span></div>
          <div class="pnl-trio"><span class="label-xs">Actual</span><span class="mono">$${fmt(r.current)}</span></div>
          <div class="pnl-trio">
            <span class="label-xs">P&L</span>
            <span class="mono ${cls(r.pnlV)}">${sign(r.pnlV)}$${fmtD(r.pnlV)}</span>
            <span class="mono ${cls(r.pnlV)} small">${pct(r.pnlP)}</span>
            ${pnlBar(r.pnlP)}
          </div>
        </div>
      </div>`).join("");
  }

  // ─── COMPOSICIÓN CON SCROLL ───────────────────────────────────────────────────
  function compBarsScroll(assets, total) {
    const rows = assets
      .filter(a=>a.current>0)
      .sort((a,b)=>b.current-a.current)
      .map(a => {
        const p = ((a.current/total)*100).toFixed(1);
        return `<div class="comp-row">
          <div class="comp-label"><span class="comp-dot" style="background:${a.color}"></span><span class="mono">${a.key.toUpperCase()}</span></div>
          <div class="comp-bar-wrap"><div class="comp-bar" style="width:${Math.max(parseFloat(p),1)}%;background:${a.color}"></div></div>
          <div class="comp-pct mono">${p}%</div>
          <div class="comp-val mono">$${fmt(a.current)}</div>
        </div>`;
      }).join("");
    return `<div class="comp-scroll">${rows}</div>`;
  }

  // ─── ASSET CARDS ─────────────────────────────────────────────────────────────
  function assetCardGroup(assets, gridClass) {
    return `<div class="${gridClass}">${assets.map(a => {
      const asset = d[a.key] || {};
      const isPos = (asset.change7d||"").startsWith("+");
      const sig   = asset.signal || "HOLD";
      return `
      <div class="asset-card" style="--accent-asset:${a.color}">
        <div class="asset-header">
          <div class="asset-name">
            <div class="asset-icon" style="background:${a.color}22;color:${a.color}">${a.icon}</div>
            <div><div class="asset-ticker">${a.key.toUpperCase()}</div><div class="asset-label">${a.label}</div></div>
          </div>
          <span class="signal-badge ${signalClass[sig]}">${signalLabel[sig]||sig}</span>
        </div>
        <div class="asset-price">${asset.price||"—"}</div>
        <div class="asset-change ${isPos?"pos":"neg"}">${asset.change7d||"—"} esta semana</div>
        <div class="port-mini">
          <span>$${fmt(a.current)}</span>
          <span class="${cls(a.pnlV)}">${pct(a.pnlP)} P&L</span>
        </div>
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
        <div class="dca-info">
          <div class="dca-name">DCA Bitcoin</div>
          <div class="dca-amount mono">$50 USD / mes</div>
          <div class="dca-next">Próximo: ${portfolio.dca?.btc||"inicio de mes"}</div>
        </div>
        <div class="dca-stats">
          <div class="mono pos">+${count} ciclos</div>
          <div class="mono text-muted">$${count*50} acum.</div>
        </div>
      </div>
      <div class="dca-item">
        <div class="asset-icon-sm" style="background:#00d4a022;color:#00d4a0">📈</div>
        <div class="dca-info">
          <div class="dca-name">DCA Acciones (VOO/QQQ)</div>
          <div class="dca-amount mono">$50 USD / mes</div>
          <div class="dca-next">Próximo: ${portfolio.dca?.stocks||"fin de mes"}</div>
        </div>
        <div class="dca-stats">
          <div class="mono pos">+${count} ciclos</div>
          <div class="mono text-muted">$${count*50} acum.</div>
        </div>
      </div>
      ${cashVal > 0 ? `
      <div class="dca-item">
        <div class="asset-icon-sm" style="background:rgba(90,96,128,0.15);color:var(--text-muted);font-size:13px">$</div>
        <div class="dca-info">
          <div class="dca-name">Cash disponible (Hapi)</div>
          <div class="dca-amount mono">$${fmt(cashVal)} USD</div>
          <div class="dca-next">Listo para próximo DCA</div>
        </div>
      </div>` : ""}
    </div>`;
  }

  // ─── HISTORIAL ────────────────────────────────────────────────────────────────
  function monthlyEvolution() {
    const entries = history && history.length > 0 ? history : [];
    if (entries.length < 1) {
      return `<div class="no-history">
        <div style="font-size:11px;color:var(--text-muted);text-align:center;padding:16px 0">
          Punto de partida establecido · ${getMonthLabel()}<br>
          <span style="font-family:var(--mono);color:var(--accent)">Crypto $${fmt(totalCryptoVal)} · Acciones $${fmt(totalStocksVal)} · Total $${fmt(totalVal)}</span>
        </div>
      </div>`;
    }
    const byMonth = {};
    entries.forEach(h => {
      const label = h.timestamp
        ? new Date(h.timestamp).toLocaleDateString("es-CO",{month:"short",year:"numeric"})
        : h.week;
      if (!byMonth[label]) byMonth[label]=[];
      byMonth[label].push(h);
    });
    const months = Object.keys(byMonth).slice(-6);
    const rows = months.map(month => {
      const last = byMonth[month][byMonth[month].length-1];
      const chg  = last.data?.btc?.change7d||"—";
      const isP  = chg.startsWith("+");
      const bP   = parseFloat((last.data?.btc?.price||"0").replace(/[$,]/g,""))||0;
      const approxTotal = bP > 0 ? "$"+fmt(bP*(portfolio.crypto.btc?.qty||0)+totalStocksVal) : "—";
      return `<tr>
        <td class="mono">${month}</td>
        <td class="mono">${last.data?.btc?.price||"—"}</td>
        <td class="mono ${isP?"pos":"neg"}">${chg}</td>
        <td class="mono">${last.data?.macro?.fearGreed||"—"}</td>
        <td class="mono">${approxTotal}</td>
      </tr>`;
    }).join("");
    return `<div class="history-wrap"><table class="history-table">
      <thead><tr><th>Mes</th><th>BTC precio</th><th>BTC 7d</th><th>F&G</th><th>Total aprox.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function actionItems() {
    if (!d.actions) return "";
    return d.actions.map(a=>`<div class="action-item"><span class="action-num">${a.num}</span><span class="action-text">${a.text}</span></div>`).join("");
  }

  // ─── CALENDARIO ───────────────────────────────────────────────────────────────
  const calendario = d.calendario || [
    { fecha:"Jun 18", evento:"Decisión FED — tasas de interés", tipo:"macro" },
    { fecha:"Jun 25", evento:"Earnings NVDA Q2 (estimado)", tipo:"earning" },
    { fecha:"Jun 30", evento:"DCA Acciones — VOO/QQQ $50", tipo:"dca" },
    { fecha:"Jul 1",  evento:"DCA Bitcoin $50", tipo:"dca" },
  ];

  const calColors = { macro:"var(--blue)", earning:"var(--yellow)", dca:"var(--accent)", crypto:"var(--orange)" };

  function calRow(item) {
    const color = calColors[item.tipo] || "var(--text-muted)";
    return `<div class="cal-row">
      <div class="cal-fecha mono" style="color:${color}">${item.fecha}</div>
      <div class="cal-dot" style="background:${color}"></div>
      <div class="cal-evento">${item.evento}</div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Market Intelligence · ${getMonthLabel()}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  :root{
    --bg:#0a0c10;--surface:#111318;--surface2:#181b23;--border:#1e2230;
    --text:#e8eaf2;--text-muted:#5a6080;--text-dim:#8890aa;
    --green:#00d4a0;--green-dim:rgba(0,212,160,0.12);
    --red:#ff4d6a;--red-dim:rgba(255,77,106,0.12);
    --yellow:#f5c842;--yellow-dim:rgba(245,200,66,0.12);
    --blue:#4d8fff;--blue-dim:rgba(77,143,255,0.12);
    --accent:#7c5cfc;--accent-dim:rgba(124,92,252,0.15);
    --orange:#ff8c00;--orange-dim:rgba(255,140,0,0.12);
    --mono:'JetBrains Mono',monospace;--sans:'Inter',sans-serif;
    --r:10px;--g:12px;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:var(--sans);padding:20px;min-height:100vh;padding-top:72px}
  .mono{font-family:var(--mono)} .pos{color:var(--green)} .neg{color:var(--red)}
  .text-muted{color:var(--text-muted)} .small{font-size:10px}
  .label-xs{font-size:9px;letter-spacing:.6px;text-transform:uppercase;color:var(--text-muted);font-family:var(--mono);display:block;margin-bottom:2px}
  .section-title{font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-muted);font-family:var(--mono);margin-bottom:10px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px}
  .mb{margin-bottom:var(--g)}

  /* STICKY HEADER */
  .sticky-bar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(10,12,16,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .sticky-logo{font-size:13px;font-weight:700;letter-spacing:-.3px;white-space:nowrap}
  .sticky-logo span{color:var(--accent)}
  .sticky-stats{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
  .sticky-stat{display:flex;flex-direction:column;align-items:flex-end}
  .sticky-stat-label{font-size:8px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-family:var(--mono)}
  .sticky-stat-val{font-size:13px;font-weight:700;font-family:var(--mono);line-height:1.2}
  .sticky-month{font-size:10px;color:var(--text-muted);font-family:var(--mono);white-space:nowrap}

  /* HEADER */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:10px}
  .header h1{font-size:18px;font-weight:700;letter-spacing:-.3px}
  .header-sub{font-size:11px;color:var(--text-muted);font-family:var(--mono);margin-top:3px}
  .header-right{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
  .week-badge{background:var(--accent-dim);color:var(--accent);font-family:var(--mono);font-size:11px;font-weight:600;padding:5px 12px;border-radius:6px;border:1px solid rgba(124,92,252,.3)}
  .analyst-badge{font-size:10px;color:var(--text-muted);font-family:var(--mono)}

  /* TOTALES */
  .totals-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--g);margin-bottom:var(--g)}
  .total-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px}
  .total-card.highlight{border-color:var(--accent);background:var(--accent-dim)}
  .total-label{font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);font-family:var(--mono);margin-bottom:6px}
  .total-value{font-size:20px;font-weight:700;font-family:var(--mono);letter-spacing:-.5px}
  .total-sub{font-size:10px;color:var(--text-muted);font-family:var(--mono);margin-top:3px}
  .total-breakdown{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
  .total-breakdown span{font-size:10px;font-family:var(--mono);color:var(--text-muted)}

  /* SCORE + INSIGHTS */
  .insights-top{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:var(--g);margin-bottom:var(--g)}
  .insights-mid{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--g);margin-bottom:var(--g)}
  .insight-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;display:flex;flex-direction:column;gap:5px}
  .insight-card.alert-orange{border-color:var(--orange);background:var(--orange-dim)}
  .insight-card.alert-red{border-color:var(--red);background:var(--red-dim)}
  .insight-card.good{border-color:var(--green);background:var(--green-dim)}
  .insight-label{font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;font-family:var(--mono);color:var(--text-muted)}
  .insight-value{font-size:18px;font-weight:700;font-family:var(--mono)}
  .insight-sub{font-size:10px;color:var(--text-muted);font-family:var(--mono);line-height:1.4}

  /* SCORE */
  .score-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px}
  .score-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .score-num{font-size:36px;font-weight:700;font-family:var(--mono);line-height:1}
  .score-denom{font-size:14px;color:var(--text-muted);font-family:var(--mono)}
  .score-label-badge{font-size:10px;font-weight:600;padding:3px 9px;border-radius:4px;font-family:var(--mono)}
  .score-bar-wrap{height:6px;background:var(--surface2);border-radius:3px;margin-bottom:8px}
  .score-bar{height:6px;border-radius:3px;transition:width .4s}
  .score-items{display:flex;flex-direction:column;gap:3px}
  .score-item{font-size:10px;color:var(--text-muted);font-family:var(--mono)}

  /* RATIO BAR */
  .ratio-bar{display:flex;height:18px;border-radius:4px;overflow:hidden;margin:6px 0}
  .ratio-crypto{display:flex;align-items:center;justify-content:center;background:#f7931a}
  .ratio-stocks{display:flex;align-items:center;justify-content:center;background:var(--green)}
  .ratio-label{font-size:9px;font-weight:700;color:white;white-space:nowrap;padding:0 4px}

  /* ANALISTA */
  .analyst-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px;margin-bottom:var(--g)}
  .analyst-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
  .analyst-avatar{width:34px;height:34px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
  .analyst-name{font-size:13px;font-weight:600} .analyst-title{font-size:10px;color:var(--text-muted);font-family:var(--mono)}
  .analyst-opinion{font-size:13px;line-height:1.7;color:var(--text-dim);padding:12px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--accent)}

  /* SEÑALES */
  .signals-section{margin-bottom:var(--g)}
  .signals-group{margin-bottom:14px}
  .signals-group-title{font-size:11px;font-weight:700;color:var(--text-dim);margin-bottom:8px;display:flex;align-items:center;gap:8px}
  .signals-group-title::after{content:"";flex:1;height:1px;background:var(--border)}
  .assets-grid-stocks{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--g)}
  .assets-grid-crypto{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--g)}
  .asset-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:13px 14px;border-top:2px solid var(--accent-asset,var(--border))}
  .asset-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .asset-name{display:flex;align-items:center;gap:7px}
  .asset-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:var(--mono);font-size:12px;flex-shrink:0}
  .asset-ticker{font-size:13px;font-weight:700;font-family:var(--mono)} .asset-label{font-size:9px;color:var(--text-muted)}
  .signal-badge{font-size:8px;font-weight:700;letter-spacing:.6px;padding:2px 6px;border-radius:3px;font-family:var(--mono)}
  .signal-buy{background:var(--green-dim);color:var(--green)} .signal-hold{background:var(--yellow-dim);color:var(--yellow)} .signal-wait{background:var(--red-dim);color:var(--red)}
  .asset-price{font-size:16px;font-weight:700;font-family:var(--mono);letter-spacing:-.3px;margin-bottom:3px}
  .asset-change{font-size:10px;font-family:var(--mono);margin-bottom:6px}
  .asset-change.pos{color:var(--green)} .asset-change.neg{color:var(--red)}
  .port-mini{display:flex;justify-content:space-between;font-size:9px;font-family:var(--mono);padding:4px 6px;background:var(--surface2);border-radius:4px;margin-bottom:6px;color:var(--text-muted);flex-wrap:wrap;gap:2px}
  .asset-context{font-size:9px;line-height:1.5;color:var(--text-dim);padding:6px 8px;background:var(--surface2);border-radius:5px;border-left:2px solid var(--border)}

  /* P&L */
  .pnl-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--g);margin-bottom:var(--g)}
  .pnl-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px}
  .pnl-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:6px}
  .pnl-title{font-size:13px;font-weight:700}
  .pnl-total-badge{font-size:11px;font-weight:700;font-family:var(--mono);padding:3px 9px;border-radius:4px}
  .pnl-total-badge.pos{background:var(--green-dim);color:var(--green)} .pnl-total-badge.neg{background:var(--red-dim);color:var(--red)}
  .pnl-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);gap:8px}
  .pnl-row:last-of-type{border-bottom:none}
  .pnl-asset{display:flex;align-items:center;gap:7px;min-width:90px}
  .asset-icon-sm{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:var(--mono);font-size:10px;flex-shrink:0}
  .pnl-nums{display:flex;gap:10px;flex-wrap:wrap}
  .pnl-trio{display:flex;flex-direction:column;min-width:52px}
  .pnl-name{font-size:12px;font-weight:600} .pnl-qty{font-size:9px;color:var(--text-muted);font-family:var(--mono)}
  .pnl-bar-wrap{height:3px;background:var(--border);border-radius:2px;margin-top:3px;width:100%}
  .pnl-bar{height:3px;border-radius:2px}
  .pnl-subtotal{display:flex;justify-content:space-between;padding:10px 0 0;border-top:2px solid var(--border);margin-top:4px;font-size:12px;font-weight:600;flex-wrap:wrap;gap:6px}

  /* COMPOSICIÓN CON SCROLL */
  .comp-pair{display:grid;grid-template-columns:1fr 1fr;gap:var(--g);margin-bottom:var(--g)}
  .comp-scroll{max-height:160px;overflow-y:auto;padding-right:4px}
  .comp-scroll::-webkit-scrollbar{width:3px} .comp-scroll::-webkit-scrollbar-track{background:var(--surface2)} .comp-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
  .comp-row{display:grid;grid-template-columns:56px 1fr 40px 56px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)}
  .comp-row:last-child{border-bottom:none}
  .comp-label{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600}
  .comp-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
  .comp-bar-wrap{height:5px;background:var(--surface2);border-radius:3px}
  .comp-bar{height:5px;border-radius:3px}
  .comp-pct{font-size:10px;text-align:right} .comp-val{font-size:9px;text-align:right;color:var(--text-muted)}

  /* MACRO + DECISIONES */
  .bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--g);margin-bottom:var(--g)}
  .macro-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
  .macro-item{background:var(--surface2);border-radius:6px;padding:9px 11px}
  .macro-item-label{font-size:9px;color:var(--text-muted);font-family:var(--mono);letter-spacing:.8px;text-transform:uppercase;margin-bottom:3px}
  .macro-item-value{font-size:16px;font-weight:700;font-family:var(--mono)}
  .macro-item-sub{font-size:9px;color:var(--text-muted);font-family:var(--mono);margin-top:2px}
  .macro-narrative{font-size:12px;line-height:1.6;color:var(--text-dim);padding:10px;background:var(--surface2);border-radius:6px}
  .decision-card{background:var(--surface);border:1px solid var(--accent);border-radius:var(--r);padding:16px 18px}
  .decision-header{display:flex;align-items:center;gap:8px;margin-bottom:14px}
  .decision-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent);flex-shrink:0}
  .decision-title{font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--accent);font-family:var(--mono)}
  .action-item{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border)}
  .action-item:last-child{border-bottom:none}
  .action-num{font-size:10px;font-weight:700;font-family:var(--mono);color:var(--accent);min-width:18px;padding-top:1px}
  .action-text{font-size:12px;line-height:1.5;color:var(--text-dim)}

  /* DCA */
  .dca-grid{display:flex;flex-direction:column;gap:9px}
  .dca-item{display:flex;align-items:center;gap:11px;padding:10px;background:var(--surface2);border-radius:8px}
  .dca-info{flex:1} .dca-name{font-size:12px;font-weight:600}
  .dca-amount{font-size:11px;color:var(--accent);font-family:var(--mono);margin-top:2px}
  .dca-next{font-size:10px;color:var(--text-muted);margin-top:2px}
  .dca-stats{text-align:right} .dca-stats div{font-size:11px}

  /* CALENDARIO */
  .cal-grid{display:flex;flex-direction:column;gap:6px}
  .cal-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)}
  .cal-row:last-child{border-bottom:none}
  .cal-fecha{font-size:11px;font-weight:600;min-width:48px}
  .cal-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .cal-evento{font-size:12px;color:var(--text-dim)}

  /* HISTORIAL */
  .history-wrap{overflow-x:auto}
  .history-table{width:100%;border-collapse:collapse;font-size:11px;min-width:360px}
  .history-table th{text-align:left;font-size:9px;color:var(--text-muted);font-family:var(--mono);letter-spacing:.8px;text-transform:uppercase;padding:0 8px 8px 0;border-bottom:1px solid var(--border)}
  .history-table td{padding:8px 8px 8px 0;border-bottom:1px solid var(--border);color:var(--text-dim)}
  .history-table tr:last-child td{border-bottom:none}
  .no-history{font-size:12px;color:var(--text-muted);padding:8px 0}

  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:var(--g);margin-bottom:var(--g)}
  .three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--g);margin-bottom:var(--g)}
  .footer{margin-top:18px;text-align:center;font-size:10px;color:var(--text-muted);font-family:var(--mono);padding-top:14px;border-top:1px solid var(--border)}

  /* ── RESPONSIVE ─────────────────────────────────────────────────────────── */
  @media(max-width:1100px){
    .assets-grid-crypto{grid-template-columns:repeat(4,1fr)}
    .assets-grid-stocks{grid-template-columns:repeat(3,1fr)}
    .insights-top{grid-template-columns:1fr 1fr}
    .insights-mid{grid-template-columns:1fr 1fr}
    .three-col{grid-template-columns:1fr 1fr}
  }
  @media(max-width:768px){
    body{padding:12px;padding-top:70px}
    .totals-bar{grid-template-columns:1fr 1fr}
    .insights-top{grid-template-columns:1fr 1fr}
    .insights-mid{grid-template-columns:1fr 1fr}
    .pnl-grid{grid-template-columns:1fr}
    .comp-pair{grid-template-columns:1fr}
    .assets-grid-crypto{grid-template-columns:repeat(3,1fr)}
    .assets-grid-stocks{grid-template-columns:repeat(3,1fr)}
    .bottom-grid{grid-template-columns:1fr}
    .two-col{grid-template-columns:1fr}
    .three-col{grid-template-columns:1fr}
    .total-value{font-size:17px}
    .sticky-stats{gap:12px}
  }
  @media(max-width:480px){
    body{padding:10px;padding-top:68px}
    .totals-bar{grid-template-columns:1fr 1fr}
    .assets-grid-crypto{grid-template-columns:1fr 1fr}
    .assets-grid-stocks{grid-template-columns:1fr 1fr}
    .total-value{font-size:15px}
    .asset-price{font-size:15px}
    .header h1{font-size:16px}
    .pnl-row{flex-direction:column;align-items:flex-start}
    .pnl-nums{width:100%}
    .sticky-stat:nth-child(n+3){display:none}
  }
</style>
</head>
<body>

<!-- STICKY HEADER -->
<div class="sticky-bar">
  <div class="sticky-logo">Market<span>Intel</span></div>
  <div class="sticky-stats">
    <div class="sticky-stat">
      <div class="sticky-stat-label">Total</div>
      <div class="sticky-stat-val">$${fmt(totalVal)}</div>
    </div>
    <div class="sticky-stat">
      <div class="sticky-stat-label">P&L</div>
      <div class="sticky-stat-val ${cls(totalPnL)}">${sign(totalPnL)}$${fmt(totalPnL)}</div>
    </div>
    <div class="sticky-stat">
      <div class="sticky-stat-label">BTC</div>
      <div class="sticky-stat-val">${d.btc?.price||"—"}</div>
    </div>
    ${monthChange ? `<div class="sticky-stat">
      <div class="sticky-stat-label">vs mes ant.</div>
      <div class="sticky-stat-val ${cls(monthChange)}">${pct(monthChange)}</div>
    </div>` : ""}
  </div>
  <div class="sticky-month">${getMonthLabel()}</div>
</div>

<!-- HEADER -->
<div class="header">
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
    <div class="total-value">$${fmt(totalInvested)}</div>
    <div class="total-sub">costo base USD</div>
    <div class="total-breakdown">
      <span>Crypto $${fmt(totalCryptoInvested)}</span>
      <span>Acciones $${fmt(totalStocksInvested)}</span>
    </div>
  </div>
  <div class="total-card">
    <div class="total-label">Valor de Mercado</div>
    <div class="total-value">$${fmt(totalCryptoVal+totalStocksVal)}</div>
    <div class="total-sub">activos a precios actuales</div>
    <div class="total-breakdown">
      <span>Crypto $${fmt(totalCryptoVal)}</span>
      <span>Acciones $${fmt(totalStocksVal)}</span>
    </div>
  </div>
  <div class="total-card">
    <div class="total-label">Resultado P&L</div>
    <div class="total-value ${cls(totalPnL)}">${sign(totalPnL)}$${fmt(totalPnL)}</div>
    <div class="total-sub ${cls(totalPnL)}">${pct(totalPnLPct)} sobre capital</div>
    <div class="total-breakdown">
      <span class="${cls(totalCryptoPnL)}">Crypto ${pct(totalCryptoPnLPct)}</span>
      <span class="${cls(totalStocksPnL)}">Acc. ${pct(totalStocksPnLPct)}</span>
    </div>
  </div>
  <div class="total-card highlight">
    <div class="total-label">Total Portafolio</div>
    <div class="total-value">$${fmt(totalVal)}</div>
    <div class="total-sub">activos + cash disponible</div>
    <div class="total-breakdown">
      <span>Cash $${fmt(cashVal)}</span>
      ${annualizedReturn ? `<span class="${cls(annualizedReturn)}">Ann. ${pct(annualizedReturn)}</span>` : ""}
    </div>
  </div>
</div>

<!-- 2. SCORE + INSIGHTS -->
<div class="section-title">Indicadores clave</div>

<!-- Fila 1: Score + BTC Break-even + Ratio -->
<div class="insights-top mb">

  <!-- SCORE DE SALUD -->
  <div class="score-card">
    <div class="section-title" style="margin-bottom:8px">Score de salud del portafolio</div>
    <div class="score-top">
      <div><span class="score-num" style="color:${scoreColor}">${score}</span><span class="score-denom">/10</span></div>
      <span class="score-label-badge" style="background:${scoreColor}22;color:${scoreColor}">${scoreLabel}</span>
    </div>
    <div class="score-bar-wrap"><div class="score-bar" style="width:${scoreBar}%;background:${scoreColor}"></div></div>
    <div class="score-items">
      <div class="score-item">📊 Balance crypto/acciones ${cryptoRatio}/${stocksRatio}</div>
      <div class="score-item ${cls(totalCryptoPnLPct)}">₿ Crypto P&L ${pct(totalCryptoPnLPct)}</div>
      <div class="score-item ${cls(totalStocksPnLPct)}">📈 Acciones P&L ${pct(totalStocksPnLPct)}</div>
      <div class="score-item pos">✓ DCA activo · ${history?.length||0} ciclos completados</div>
      ${cashVal > 50 ? `<div class="score-item pos">✓ Cash disponible $${fmt(cashVal)}</div>` : ""}
    </div>
    <div class="ratio-bar" style="margin-top:8px">
      <div class="ratio-crypto" style="width:${cryptoRatio}%"><span class="ratio-label">Crypto ${cryptoRatio}%</span></div>
      <div class="ratio-stocks" style="width:${stocksRatio}%"><span class="ratio-label">Acc. ${stocksRatio}%</span></div>
    </div>
  </div>

  <!-- BTC BREAK-EVEN -->
  <div class="insight-card ${btcBreakEven && parseFloat(btcBreakEven) > 0 ? "alert-orange" : "good"}">
    <div class="insight-label" style="${btcBreakEven && parseFloat(btcBreakEven) > 0 ? "color:var(--orange)" : ""}">📍 BTC Break-even</div>
    ${btcBreakEven
      ? `<div class="insight-value" style="${parseFloat(btcBreakEven) > 0 ? "color:var(--orange)" : "color:var(--green)"}">${parseFloat(btcBreakEven) > 0 ? "+" : "✓ "}${btcBreakEven}%</div>
         <div class="insight-sub">
           Costo promedio: <strong>$${fmt(btcCostAvg)}</strong><br>
           Precio actual: <strong>$${fmt(btcPrice)}</strong><br>
           ${parseFloat(btcBreakEven) > 0
             ? `Necesita subir <strong>${btcBreakEven}%</strong> para break-even`
             : `En verde — posicion rentable`}
         </div>`
      : `<div class="insight-value text-muted">—</div><div class="insight-sub">Precio BTC no disponible</div>`
    }
  </div>

  <!-- RETORNO ANUALIZADO -->
  <div class="insight-card ${annualizedReturn && parseFloat(annualizedReturn) > 0 ? "good" : ""}">
    <div class="insight-label">📅 Retorno anualizado est.</div>
    ${annualizedReturn
      ? `<div class="insight-value ${cls(annualizedReturn)}">${pct(annualizedReturn)}</div>
         <div class="insight-sub">Basado en ${history?.length||0} reportes · ${history?.length > 1 ? "proyección sobre historial real" : "datos insuficientes aún"}</div>`
      : `<div class="insight-value text-muted">—</div>
         <div class="insight-sub">Disponible desde el segundo reporte mensual</div>`
    }
  </div>
</div>

<!-- Fila 2: Mejor/Peor por categoría (4 cards) -->
<div class="insights-mid mb">

  <!-- MEJOR ACCIÓN -->
  <div class="insight-card good">
    <div class="insight-label">🏆 Mejor acción</div>
    <div class="insight-value pos">${bestStock?.key?.toUpperCase()||"—"}</div>
    <div class="insight-value" style="font-size:14px;color:var(--green)">${d[bestStock?.key]?.change7d||"—"} esta semana</div>
    <div class="insight-sub">${bestStock?.label||""}<br>Valor: $${fmt(bestStock?.current||0)}<br>P&L acum: <strong class="pos">${pct(bestStock?.pnlP||"0")}</strong></div>
  </div>

  <!-- PEOR ACCIÓN -->
  <div class="insight-card alert-red">
    <div class="insight-label" style="color:var(--red)">⚠️ Peor acción</div>
    <div class="insight-value neg">${worstStock?.key?.toUpperCase()||"—"}</div>
    <div class="insight-value" style="font-size:14px;color:var(--red)">${d[worstStock?.key]?.change7d||"—"} esta semana</div>
    <div class="insight-sub">${worstStock?.label||""}<br>Valor: $${fmt(worstStock?.current||0)}<br>P&L acum: <strong class="${cls(worstStock?.pnlV||0)}">${pct(worstStock?.pnlP||"0")}</strong></div>
  </div>

  <!-- MEJOR CRYPTO -->
  <div class="insight-card good">
    <div class="insight-label">🏆 Mejor crypto</div>
    <div class="insight-value pos">${bestCrypto?.key?.toUpperCase()||"—"}</div>
    <div class="insight-value" style="font-size:14px;color:var(--green)">${d[bestCrypto?.key]?.change7d||"—"} esta semana</div>
    <div class="insight-sub">${bestCrypto?.label||""}<br>Valor: $${fmt(bestCrypto?.current||0)}<br>P&L acum: <strong class="${cls(bestCrypto?.pnlV||0)}">${pct(bestCrypto?.pnlP||"0")}</strong></div>
  </div>

  <!-- PEOR CRYPTO -->
  <div class="insight-card alert-red">
    <div class="insight-label" style="color:var(--red)">⚠️ Peor crypto</div>
    <div class="insight-value neg">${worstCrypto?.key?.toUpperCase()||"—"}</div>
    <div class="insight-value" style="font-size:14px;color:var(--red)">${d[worstCrypto?.key]?.change7d||"—"} esta semana</div>
    <div class="insight-sub">${worstCrypto?.label||""}<br>Valor: $${fmt(worstCrypto?.current||0)}<br>P&L acum: <strong class="${cls(worstCrypto?.pnlV||0)}">${pct(worstCrypto?.pnlP||"0")}</strong></div>
  </div>
</div>

<!-- 3. ANALISTA -->
<div class="analyst-card">
  <div class="analyst-header">
    <div class="analyst-avatar">📊</div>
    <div>
      <div class="analyst-name">Analista Senior de Portafolio</div>
      <div class="analyst-title">10 años · Renta Variable & Activos Digitales · CFA Level II</div>
    </div>
  </div>
  <div class="analyst-opinion">${d.analystOpinion||"Analisis no disponible."}</div>
</div>

<!-- 4. SEÑALES — ACCIONES PRIMERO -->
<div class="signals-section">
  <div class="signals-group">
    <div class="signals-group-title">📈 Señales Acciones</div>
    ${assetCardGroup(stockAssets, "assets-grid-stocks")}
  </div>
  <div class="signals-group">
    <div class="signals-group-title">🔶 Señales Crypto</div>
    ${assetCardGroup(cryptoAssets, "assets-grid-crypto")}
  </div>
</div>

<!-- 5. P&L DETALLADO (debajo de señales) -->
<div class="section-title">Rendimiento detallado</div>
<div class="pnl-grid mb">
  <div class="pnl-card">
    <div class="pnl-header">
      <div class="pnl-title">Acciones · ${stockAssets.length} activos</div>
      <div class="pnl-total-badge ${cls(totalStocksPnL)}">${sign(totalStocksPnL)}$${fmt(totalStocksPnL)} (${pct(totalStocksPnLPct)})</div>
    </div>
    ${pnlRows(stockAssets)}
    <div class="pnl-subtotal">
      <span class="text-muted">Total</span>
      <span class="mono">$${fmt(totalStocksInvested)}</span>
      <span class="mono">$${fmt(totalStocksVal)}</span>
      <span class="mono ${cls(totalStocksPnL)}">${sign(totalStocksPnL)}$${fmt(totalStocksPnL)}</span>
    </div>
  </div>
  <div class="pnl-card">
    <div class="pnl-header">
      <div class="pnl-title">Crypto · ${cryptoAssets.length} activos</div>
      <div class="pnl-total-badge ${cls(totalCryptoPnL)}">${sign(totalCryptoPnL)}$${fmt(totalCryptoPnL)} (${pct(totalCryptoPnLPct)})</div>
    </div>
    ${pnlRows(cryptoAssets)}
    <div class="pnl-subtotal">
      <span class="text-muted">Total</span>
      <span class="mono">$${fmt(totalCryptoInvested)}</span>
      <span class="mono">$${fmt(totalCryptoVal)}</span>
      <span class="mono ${cls(totalCryptoPnL)}">${sign(totalCryptoPnL)}$${fmt(totalCryptoPnL)}</span>
    </div>
  </div>
</div>

<!-- 6. COMPOSICIÓN CON SCROLL -->
<div class="section-title">Composición del portafolio</div>
<div class="comp-pair">
  <div class="card">
    <div class="section-title">Acciones · $${fmt(totalStocksVal)}</div>
    ${compBarsScroll(stockAssets, totalStocksVal)}
  </div>
  <div class="card">
    <div class="section-title">Crypto · $${fmt(totalCryptoVal)}</div>
    ${compBarsScroll(cryptoAssets, totalCryptoVal)}
  </div>
</div>

<!-- 7. MACRO + DECISIONES -->
<div class="bottom-grid">
  <div class="card">
    <div class="section-title">Contexto Macroeconómico</div>
    <div class="macro-grid">
      <div class="macro-item"><div class="macro-item-label">USD/COP</div><div class="macro-item-value">${d.macro?.usdcop||"—"}</div><div class="macro-item-sub">tasa ARQ</div></div>
      <div class="macro-item"><div class="macro-item-label">FED Rate</div><div class="macro-item-value">${d.macro?.fedrate||"—"}</div><div class="macro-item-sub">política monetaria</div></div>
      <div class="macro-item"><div class="macro-item-label">BTC Dom.</div><div class="macro-item-value">${d.macro?.btcDominance||"—"}</div><div class="macro-item-sub">dominancia crypto</div></div>
      <div class="macro-item"><div class="macro-item-label">Fear & Greed</div><div class="macro-item-value">${d.macro?.fearGreed||"—"}</div><div class="macro-item-sub">${d.macro?.fearGreedLabel||"sentimiento"}</div></div>
    </div>
    <div class="macro-narrative">${d.macro?.narrative||""}</div>
  </div>
  <div class="decision-card">
    <div class="decision-header"><div class="decision-dot"></div><div class="decision-title">Acciones este mes</div></div>
    ${actionItems()}
  </div>
</div>

<!-- 8. DCA + CALENDARIO + HISTORIAL -->
<div class="three-col">
  <div class="card">
    <div class="section-title">DCA Tracker</div>
    ${dcaTracker()}
  </div>
  <div class="card">
    <div class="section-title">Próximos eventos</div>
    <div class="cal-grid">
      ${calendario.map(calRow).join("")}
    </div>
  </div>
  <div class="card">
    <div class="section-title">Evolución mensual</div>
    ${monthlyEvolution()}
  </div>
</div>

<div class="footer">
  Market Intelligence v6 · Analista Senior 10 años · Solo informativo, no es asesoría financiera regulada · ${now}
</div>
</body>
</html>`;
}

function getMonthLabel() {
  return new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
