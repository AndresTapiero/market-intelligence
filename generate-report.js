/**
 * generate-report.js
 * Genera el HTML del reporte mensual con totales de portafolio y análisis experto
 */

export function generateHTML(data, history, portfolio) {
  const d = data;
  const now = new Date().toLocaleString("es-CO", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const assets = [
    { key: "btc",  label: "Bitcoin",  icon: "₿",  iconClass: "btc" },
    { key: "eth",  label: "Ethereum", icon: "Ξ",  iconClass: "eth" },
    { key: "voo",  label: "VOO",      icon: "V",  iconClass: "voo" },
    { key: "qqq",  label: "QQQ",      icon: "Q",  iconClass: "qqq" },
    { key: "nvda", label: "NVIDIA",   icon: "N",  iconClass: "nvda" },
    { key: "nu",   label: "Nubank",   icon: "N",  iconClass: "nu" },
  ];

  const signalLabel = { BUY: "COMPRAR", HOLD: "MANTENER", WAIT: "ESPERAR" };
  const signalClass = { BUY: "signal-buy", HOLD: "signal-hold", WAIT: "signal-wait" };

  // ─── CALCULAR TOTALES DEL PORTAFOLIO ────────────────────────────────────────
  function calcPortfolioTotals() {
    // Capital invertido original (costo base)
    const btcInvested   = portfolio.crypto.btc.qty * portfolio.crypto.btc.costAvg;
    const ethInvested   = portfolio.crypto.eth.qty * 3200; // costo promedio estimado ETH
    const vooInvested   = portfolio.stocks.voo.val / (1 + portfolio.stocks.voo.gainPct / 100);
    const qqqInvested   = portfolio.stocks.qqq.val / (1 + portfolio.stocks.qqq.gainPct / 100);
    const nvdaInvested  = portfolio.stocks.nvda.val / (1 + portfolio.stocks.nvda.gainPct / 100);
    const nuInvested    = portfolio.stocks.nu.val / (1 + portfolio.stocks.nu.gainPct / 100);
    const totalInvested = btcInvested + ethInvested + vooInvested + qqqInvested + nvdaInvested + nuInvested;

    // Valor actual a precios de mercado
    let btcCurrentVal = portfolio.crypto.btc.qty * portfolio.crypto.btc.costAvg; // fallback
    if (d.btc?.price) {
      const btcPrice = parseFloat(d.btc.price.replace(/[$,]/g, ""));
      if (!isNaN(btcPrice)) btcCurrentVal = portfolio.crypto.btc.qty * btcPrice;
    }

    let ethCurrentVal = ethInvested; // fallback
    if (d.eth?.price) {
      const ethPrice = parseFloat(d.eth.price.replace(/[$,]/g, ""));
      if (!isNaN(ethPrice)) ethCurrentVal = portfolio.crypto.eth.qty * ethPrice;
    }

    const vooCurrentVal  = portfolio.stocks.voo.val;
    const qqqCurrentVal  = portfolio.stocks.qqq.val;
    const nvdaCurrentVal = portfolio.stocks.nvda.val;
    const nuCurrentVal   = portfolio.stocks.nu.val;

    const totalCurrentVal = btcCurrentVal + ethCurrentVal + vooCurrentVal + qqqCurrentVal + nvdaCurrentVal + nuCurrentVal;
    const totalPnL        = totalCurrentVal - totalInvested;
    const totalPnLPct     = ((totalPnL / totalInvested) * 100).toFixed(1);

    return {
      totalInvested:   totalInvested.toFixed(0),
      totalCurrentVal: totalCurrentVal.toFixed(0),
      totalPnL:        totalPnL.toFixed(0),
      totalPnLPct,
      isProfit: totalPnL >= 0,
      breakdown: {
        crypto: (btcCurrentVal + ethCurrentVal).toFixed(0),
        cryptoInvested: (btcInvested + ethInvested).toFixed(0),
        stocks: (vooCurrentVal + qqqCurrentVal + nvdaCurrentVal + nuCurrentVal).toFixed(0),
        stocksInvested: (vooInvested + qqqInvested + nvdaInvested + nuInvested).toFixed(0),
      }
    };
  }

  // ─── HISTORIAL MENSUAL ──────────────────────────────────────────────────────
  function monthlyEvolution() {
    if (!history || history.length < 1) {
      return `<div class="no-history">El historial mensual se construirá con cada reporte. Este es el punto de partida.</div>`;
    }

    // Agrupar por mes
    const byMonth = {};
    history.forEach((h) => {
      const month = h.week.slice(0, 7).replace("-W", "-").slice(0, 7);
      const label = h.timestamp
        ? new Date(h.timestamp).toLocaleDateString("es-CO", { month: "short", year: "numeric" })
        : h.week;
      if (!byMonth[label]) byMonth[label] = [];
      byMonth[label].push(h);
    });

    const months = Object.keys(byMonth).slice(-6);
    if (months.length < 1) return `<div class="no-history">Acumulando datos...</div>`;

    const rows = months.map((month) => {
      const entries = byMonth[month];
      const last = entries[entries.length - 1];
      const btcPrice = parseFloat((last.data?.btc?.price || "0").replace(/[$,]/g, "")) || 0;
      const btcVal = btcPrice > 0 ? (btcPrice * portfolio.crypto.btc.qty).toFixed(0) : "—";
      const totalStocks = (portfolio.stocks.voo.val + portfolio.stocks.qqq.val + portfolio.stocks.nvda.val + portfolio.stocks.nu.val).toFixed(0);
      const approxTotal = btcPrice > 0
        ? (parseFloat(btcVal) + parseFloat(totalStocks)).toLocaleString()
        : "—";
      const fg = last.data?.macro?.fearGreed || "—";
      const btcChange = last.data?.btc?.change7d || "—";
      const isPos = btcChange.startsWith("+");

      return `<tr>
        <td class="mono">${month}</td>
        <td class="mono">${last.data?.btc?.price || "—"}</td>
        <td class="mono">$${btcVal !== "—" ? parseInt(btcVal).toLocaleString() : "—"}</td>
        <td class="mono">$${parseFloat(totalStocks).toLocaleString()}</td>
        <td class="mono ${isPos ? "pos" : "neg"}">${btcChange}</td>
        <td class="mono">${fg}</td>
      </tr>`;
    }).join("");

    return `<table class="history-table">
      <thead>
        <tr>
          <th>Mes</th>
          <th>BTC Precio</th>
          <th>Valor Crypto</th>
          <th>Valor Acciones</th>
          <th>BTC 7d</th>
          <th>Fear&Greed</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function assetCards() {
    return assets.map((a) => {
      const asset = d[a.key] || {};
      const isPos = (asset.change7d || "").startsWith("+");
      const sig = asset.signal || "HOLD";

      let portValue = "";
      if (a.key === "btc" && asset.price && portfolio.crypto.btc) {
        const price = parseFloat(asset.price.replace(/[$,]/g, ""));
        if (!isNaN(price)) {
          const val = (price * portfolio.crypto.btc.qty).toFixed(0);
          const pnlPct = (((price - portfolio.crypto.btc.costAvg) / portfolio.crypto.btc.costAvg) * 100).toFixed(1);
          const pnlClass = price > portfolio.crypto.btc.costAvg ? "port-green" : "port-red";
          portValue = `<div class="port-mini">
            <span>${portfolio.crypto.btc.qty} BTC = $${parseInt(val).toLocaleString()}</span>
            <span class="${pnlClass}">${pnlPct > 0 ? "+" : ""}${pnlPct}% vs costo</span>
          </div>`;
        }
      } else if (a.key === "eth" && asset.price && portfolio.crypto.eth) {
        const price = parseFloat(asset.price.replace(/[$,]/g, ""));
        if (!isNaN(price)) {
          const val = (price * portfolio.crypto.eth.qty).toFixed(0);
          portValue = `<div class="port-mini">
            <span>${portfolio.crypto.eth.qty} ETH = $${parseInt(val).toLocaleString()}</span>
            <span class="port-red">holding largo plazo</span>
          </div>`;
        }
      } else if (portfolio.stocks[a.key]) {
        const s = portfolio.stocks[a.key];
        portValue = `<div class="port-mini">
          <span>Valor: $${s.val}</span>
          <span class="port-green">+${s.gainPct}% vs costo</span>
        </div>`;
      }

      return `
      <div class="asset-card">
        <div class="asset-header">
          <div class="asset-name">
            <div class="asset-icon ${a.iconClass}">${a.icon}</div>
            <div>
              <div class="asset-ticker">${a.key.toUpperCase()}</div>
              <div class="asset-label">${a.label}</div>
            </div>
          </div>
          <span class="signal-badge ${signalClass[sig]}">${signalLabel[sig] || sig}</span>
        </div>
        <div class="asset-price">${asset.price || "—"}</div>
        <div class="asset-change ${isPos ? "pos" : "neg"}">${asset.change7d || "—"} esta semana</div>
        ${portValue}
        <div class="asset-context">${asset.context || ""}</div>
      </div>`;
    }).join("");
  }

  function actionItems() {
    if (!d.actions) return "";
    return d.actions.map((a) =>
      `<div class="action-item">
        <span class="action-num">${a.num}</span>
        <span class="action-text">${a.text}</span>
      </div>`
    ).join("");
  }

  // Calcular totales
  const totals = calcPortfolioTotals();
  const pnlClass = totals.isProfit ? "port-green" : "port-red";
  const pnlSign  = totals.isProfit ? "+" : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Market Intelligence · ${getMonthLabel()}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  :root {
    --bg:#0a0c10;--surface:#111318;--surface2:#181b23;--border:#1e2230;
    --text:#e8eaf2;--text-muted:#5a6080;--text-dim:#8890aa;
    --green:#00d4a0;--green-dim:rgba(0,212,160,0.12);
    --red:#ff4d6a;--red-dim:rgba(255,77,106,0.12);
    --yellow:#f5c842;--yellow-dim:rgba(245,200,66,0.12);
    --blue:#4d8fff;--accent:#7c5cfc;--accent-dim:rgba(124,92,252,0.15);
    --mono:'JetBrains Mono',monospace;--sans:'Inter',sans-serif;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:var(--sans);padding:28px;min-height:100vh}

  /* HEADER */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)}
  .header h1{font-size:20px;font-weight:700;letter-spacing:-0.3px}
  .header-sub{font-size:12px;color:var(--text-muted);font-family:var(--mono);margin-top:4px}
  .header-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
  .week-badge{background:var(--accent-dim);color:var(--accent);font-family:var(--mono);font-size:12px;font-weight:600;padding:6px 14px;border-radius:6px;border:1px solid rgba(124,92,252,0.3)}
  .analyst-badge{font-size:10px;color:var(--text-muted);font-family:var(--mono);text-align:right}

  /* TOTALES — sección principal */
  .totals-bar{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px}
  .total-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 20px}
  .total-card.highlight{border-color:var(--accent);background:var(--accent-dim)}
  .total-label{font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);font-family:var(--mono);margin-bottom:8px}
  .total-value{font-size:24px;font-weight:700;font-family:var(--mono);letter-spacing:-0.5px}
  .total-sub{font-size:11px;color:var(--text-muted);font-family:var(--mono);margin-top:4px}
  .total-breakdown{display:flex;gap:12px;margin-top:8px}
  .total-breakdown span{font-size:11px;font-family:var(--mono);color:var(--text-muted)}

  /* ASSETS GRID */
  .assets-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px}
  .asset-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 20px}
  .asset-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  .asset-name{display:flex;align-items:center;gap:10px}
  .asset-icon{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;font-family:var(--mono)}
  .asset-icon.btc{background:rgba(247,147,26,0.15);color:#f7931a}
  .asset-icon.eth{background:rgba(98,126,234,0.15);color:#627eea}
  .asset-icon.voo{background:var(--green-dim);color:var(--green)}
  .asset-icon.qqq{background:rgba(77,143,255,0.12);color:var(--blue)}
  .asset-icon.nvda{background:rgba(118,185,0,0.12);color:#76b900}
  .asset-icon.nu{background:rgba(130,80,255,0.12);color:#8250ff}
  .asset-ticker{font-size:15px;font-weight:700;font-family:var(--mono)}
  .asset-label{font-size:11px;color:var(--text-muted)}
  .signal-badge{font-size:10px;font-weight:700;letter-spacing:0.8px;padding:3px 9px;border-radius:4px;font-family:var(--mono)}
  .signal-buy{background:var(--green-dim);color:var(--green)}
  .signal-hold{background:var(--yellow-dim);color:var(--yellow)}
  .signal-wait{background:var(--red-dim);color:var(--red)}
  .asset-price{font-size:22px;font-weight:700;font-family:var(--mono);letter-spacing:-0.5px;margin-bottom:4px}
  .asset-change{font-size:12px;font-family:var(--mono);margin-bottom:10px}
  .asset-change.pos{color:var(--green)} .asset-change.neg{color:var(--red)}
  .port-mini{display:flex;justify-content:space-between;font-size:11px;font-family:var(--mono);padding:6px 10px;background:var(--surface2);border-radius:5px;margin-bottom:10px;color:var(--text-muted)}
  .port-green{color:var(--green)} .port-red{color:var(--red)}
  .asset-context{font-size:12px;line-height:1.6;color:var(--text-dim);padding:10px 12px;background:var(--surface2);border-radius:6px;border-left:2px solid var(--border)}

  /* BOTTOM GRID */
  .bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 20px}
  .card-label{font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:14px;font-family:var(--mono)}

  /* MACRO */
  .macro-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
  .macro-item{background:var(--surface2);border-radius:6px;padding:10px 12px}
  .macro-item-label{font-size:10px;color:var(--text-muted);font-family:var(--mono);letter-spacing:0.8px;text-transform:uppercase;margin-bottom:4px}
  .macro-item-value{font-size:18px;font-weight:700;font-family:var(--mono)}
  .macro-item-sub{font-size:10px;color:var(--text-muted);font-family:var(--mono);margin-top:2px}
  .macro-narrative{font-size:12px;line-height:1.65;color:var(--text-dim);padding:12px;background:var(--surface2);border-radius:6px}

  /* DECISIONES */
  .decision-card{background:var(--surface);border:1px solid var(--accent);border-radius:10px;padding:18px 20px}
  .decision-header{display:flex;align-items:center;gap:8px;margin-bottom:16px}
  .decision-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent)}
  .decision-title{font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--accent);font-family:var(--mono)}
  .action-item{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)}
  .action-item:last-child{border-bottom:none}
  .action-num{font-size:11px;font-weight:700;font-family:var(--mono);color:var(--accent);min-width:20px;padding-top:1px}
  .action-text{font-size:13px;line-height:1.5;color:var(--text-dim)}

  /* HISTORIAL */
  .history-table{width:100%;border-collapse:collapse;font-size:12px}
  .history-table th{text-align:left;font-size:10px;color:var(--text-muted);font-family:var(--mono);letter-spacing:0.8px;text-transform:uppercase;padding:0 8px 10px 0;border-bottom:1px solid var(--border)}
  .history-table td{padding:9px 8px 9px 0;border-bottom:1px solid var(--border);color:var(--text-dim)}
  .history-table tr:last-child td{border-bottom:none}
  .mono{font-family:var(--mono)}
  .pos{color:var(--green)} .neg{color:var(--red)}
  .signal-badge-sm{font-size:9px;font-weight:700;letter-spacing:0.6px;padding:2px 7px;border-radius:3px;font-family:var(--mono)}
  .no-history{font-size:12px;color:var(--text-muted);padding:20px 0;text-align:center}

  /* ANALISTA */
  .analyst-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 20px;margin-bottom:14px}
  .analyst-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .analyst-avatar{width:36px;height:36px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:16px}
  .analyst-name{font-size:13px;font-weight:600;color:var(--text)}
  .analyst-title{font-size:11px;color:var(--text-muted);font-family:var(--mono)}
  .analyst-opinion{font-size:13px;line-height:1.7;color:var(--text-dim);padding:14px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--accent)}

  /* FOOTER */
  .footer{margin-top:20px;text-align:center;font-size:11px;color:var(--text-muted);font-family:var(--mono);padding-top:16px;border-top:1px solid var(--border)}
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>Market Intelligence</h1>
    <div class="header-sub">Reporte mensual de portafolio · ${now}</div>
  </div>
  <div class="header-right">
    <div class="week-badge">${getMonthLabel()}</div>
    <div class="analyst-badge">Analista Senior · 10 años exp.</div>
  </div>
</div>

<!-- SECCIÓN TOTALES -->
<div class="totals-bar">
  <div class="total-card">
    <div class="total-label">Capital Invertido</div>
    <div class="total-value">$${parseInt(totals.totalInvested).toLocaleString()}</div>
    <div class="total-sub">costo base total USD</div>
    <div class="total-breakdown">
      <span>Crypto: $${parseInt(totals.breakdown.cryptoInvested).toLocaleString()}</span>
      <span>Acciones: $${parseInt(totals.breakdown.stocksInvested).toLocaleString()}</span>
    </div>
  </div>
  <div class="total-card">
    <div class="total-label">Valor de Mercado</div>
    <div class="total-value">$${parseInt(totals.totalCurrentVal).toLocaleString()}</div>
    <div class="total-sub">a precios actuales</div>
    <div class="total-breakdown">
      <span>Crypto: $${parseInt(totals.breakdown.crypto).toLocaleString()}</span>
      <span>Acciones: $${parseInt(totals.breakdown.stocks).toLocaleString()}</span>
    </div>
  </div>
  <div class="total-card">
    <div class="total-label">Resultado (P&L)</div>
    <div class="total-value ${pnlClass}">${pnlSign}$${parseInt(Math.abs(totals.totalPnL)).toLocaleString()}</div>
    <div class="total-sub ${pnlClass}">${pnlSign}${totals.totalPnLPct}% sobre capital invertido</div>
  </div>
  <div class="total-card highlight">
    <div class="total-label">Portafolio Total</div>
    <div class="total-value">$${parseInt(totals.totalCurrentVal).toLocaleString()}</div>
    <div class="total-sub">Capital + Resultados</div>
    <div class="total-breakdown">
      <span class="${pnlClass}">${pnlSign}${totals.totalPnLPct}% retorno</span>
    </div>
  </div>
</div>

<!-- ANÁLISIS EXPERTO -->
<div class="analyst-card">
  <div class="analyst-header">
    <div class="analyst-avatar">📊</div>
    <div>
      <div class="analyst-name">Analista Senior de Portafolio</div>
      <div class="analyst-title">10 años · Renta Variable & Activos Digitales · CFA Level II</div>
    </div>
  </div>
  <div class="analyst-opinion" id="analyst-opinion">
    ${d.analystOpinion || `Portafolio con exposicion diversificada entre crypto y renta variable americana.
    BTC como reserva de valor representa el nucleo de la posicion digital, complementado con ETH en hold estrategico.
    Las posiciones en VOO y QQQ proveen exposicion al mercado americano con solida trayectoria.
    NVDA con +${portfolio.stocks.nvda.gainPct}% refleja la tesis de IA validada; NU con +${portfolio.stocks.nu.gainPct}% muestra fortaleza del fintech latinoamericano.
    Recomendacion principal: mantener disciplina de DCA y priorizar liquidacion de deuda en COP antes de incrementar posiciones.
    El ratio deuda/portafolio debe reducirse — cada peso pagado en TC al 25% E.A. es retorno garantizado superior a cualquier activo del portafolio.`}
  </div>
</div>

<!-- ACTIVOS -->
<div class="assets-grid">
  ${assetCards()}
</div>

<div class="bottom-grid">
  <div class="card">
    <div class="card-label">Contexto Macroeconómico</div>
    <div class="macro-grid">
      <div class="macro-item">
        <div class="macro-item-label">USD/COP</div>
        <div class="macro-item-value">${d.macro?.usdcop || "—"}</div>
        <div class="macro-item-sub">tasa ARQ estimada</div>
      </div>
      <div class="macro-item">
        <div class="macro-item-label">FED Rate</div>
        <div class="macro-item-value">${d.macro?.fedrate || "—"}</div>
        <div class="macro-item-sub">política monetaria</div>
      </div>
      <div class="macro-item">
        <div class="macro-item-label">BTC Dominance</div>
        <div class="macro-item-value">${d.macro?.btcDominance || "—"}</div>
        <div class="macro-item-sub">mercado crypto</div>
      </div>
      <div class="macro-item">
        <div class="macro-item-label">Fear & Greed</div>
        <div class="macro-item-value">${d.macro?.fearGreed || "—"}</div>
        <div class="macro-item-sub">${d.macro?.fearGreedLabel || "sentimiento"}</div>
      </div>
    </div>
    <div class="macro-narrative">${d.macro?.narrative || ""}</div>
  </div>

  <div class="decision-card">
    <div class="decision-header">
      <div class="decision-dot"></div>
      <div class="decision-title">Acciones este mes</div>
    </div>
    ${actionItems()}
  </div>
</div>

<!-- EVOLUCIÓN MENSUAL -->
<div class="card">
  <div class="card-label">Evolución mensual del portafolio</div>
  ${monthlyEvolution()}
</div>

<div class="footer">
  Generado por Market Intelligence · Perfil: Analista Senior 10 años · Solo informativo, no es asesoría financiera regulada · ${now}
</div>

</body>
</html>`;
}

function getWeekLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getMonthLabel() {
  const now = new Date();
  return now.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
