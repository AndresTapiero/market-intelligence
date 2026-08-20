// portfolio-ui.js — Render PnL, composition tables, and asset selects
// Classic script (not a module) — loaded with <script src defer>

function fmtPrice(v) {
  if (v >= 1000) return '$' + v.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2});
  if (v >= 1)    return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(4);
  return '$' + v.toFixed(6);
}
window.fmtPrice = fmtPrice;

function formatQty(qty) {
  if (qty >= 1000) return qty.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  if (qty >= 1) return qty.toLocaleString('es-CO', { maximumFractionDigits: 4 });
  return qty.toLocaleString('es-CO', { maximumFractionDigits: 6 });
}
window.formatQty = formatQty;

function renderPnl() {
  const stocksEl = document.getElementById('stocksPnlContainer');
  const cryptoEl = document.getElementById('cryptoPnlContainer');
  const tmpl = document.getElementById('pnlRowTemplate');
  if (!stocksEl || !cryptoEl || !tmpl) return;

  // Consume window.PORTFOLIO, calculado una sola vez por app._recomputeModel().
  // Antes esta funcion recorria ASSET_DATA y EXISTING_ASSETS por su cuenta,
  // duplicando el calculo que ya hacian otras cinco funciones.
  var P = window.PORTFOLIO;
  if (!P) return;

  var meta = {};
  (window.ASSET_DATA || []).forEach(function(a) { meta[a.ticker.toLowerCase()] = a; });

  P.byAsset.forEach(function(a) {
    var color = (window.ASSET_COLORS || {})[a.key] || 'var(--accent)';
    var m = meta[a.key] || {};
    var isPos = a.pnl >= 0;

    var clone = tmpl.content.cloneNode(true);
    var icon = clone.querySelector('.asset-icon-sm');
    icon.textContent = m.icon || a.ticker[0];
    icon.style.background = color + '22';
    icon.style.color = color;

    clone.querySelector('.pnl-name').textContent = a.ticker;
    clone.querySelector('.pnl-qty').textContent = window.formatQty(a.qty);

    var badge = clone.querySelector('.pnl-type-badge');
    if (badge) {
      if (a.type === 'etf')        { badge.textContent = 'ETF';    badge.className = 'pnl-type-badge etf'; }
      else if (a.type === 'stock') { badge.textContent = 'Accion'; badge.className = 'pnl-type-badge stock'; }
      else                         { badge.style.display = 'none'; }
    }

    var investedEl = clone.querySelector('.pnl-invested');
    var costUnitEl = clone.querySelector('.pnl-cost-unit');
    if (investedEl) investedEl.textContent = '$' + a.cost.toFixed(0);
    if (costUnitEl) costUnitEl.textContent = '@ ' + fmtPrice(a.costAvg);

    var actualEl     = clone.querySelector('.pnl-actual');
    var marketUnitEl = clone.querySelector('.pnl-market-unit');
    if (actualEl)     actualEl.textContent     = '$' + a.market.toFixed(0);
    if (marketUnitEl) marketUnitEl.textContent = '@ ' + fmtPrice(a.price);

    var dollarEl = clone.querySelector('.pnl-dollar');
    var pctEl    = clone.querySelector('.pnl-pct');
    dollarEl.textContent = (isPos ? '+$' : '-$') + Math.abs(a.pnl).toFixed(0);
    dollarEl.className   = 'mono num pnl-dollar ' + (isPos ? 'pos' : 'neg');
    pctEl.textContent    = (isPos ? '+' : '') + a.pnlPct.toFixed(1) + '%';
    pctEl.className      = 'mono num small pnl-pct ' + (isPos ? 'pos' : 'neg');

    (a.type === 'crypto' ? cryptoEl : stocksEl).appendChild(clone);
  });

  var sInv = P.byType.stocks.cost,  sAct = P.byType.stocks.market;
  var cInv = P.byType.crypto.cost,  cAct = P.byType.crypto.market;
  var sCount = P.byType.stocks.count, cCount = P.byType.crypto.count;

  var setEl = function(id, text, cls) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (cls) el.className = 'mono num ' + cls;
  };
  var sPnl = sAct - sInv, cPnl = cAct - cInv;
  setEl('stocksSubInvested', '$' + sInv.toFixed(0));
  setEl('stocksSubActual',   '$' + sAct.toFixed(0));
  setEl('stocksSubPnl', (sPnl >= 0 ? '+$' : '-$') + Math.abs(sPnl).toFixed(0), sPnl >= 0 ? 'pos' : 'neg');
  setEl('cryptoSubInvested', '$' + cInv.toFixed(0));
  setEl('cryptoSubActual',   '$' + cAct.toFixed(0));
  setEl('cryptoSubPnl', (cPnl >= 0 ? '+$' : '-$') + Math.abs(cPnl).toFixed(0), cPnl >= 0 ? 'pos' : 'neg');

  var sPct = sInv > 0 ? (sPnl / sInv * 100).toFixed(1) : '0.0';
  var cPct = cInv > 0 ? (cPnl / cInv * 100).toFixed(1) : '0.0';

  // Update title counts
  var sTitleEl = document.getElementById('stocksPnlTitle');
  var cTitleEl = document.getElementById('cryptoPnlTitle');
  if (sTitleEl) sTitleEl.textContent = 'Acc. / ETFs · ' + sCount;
  if (cTitleEl) cTitleEl.textContent = 'Crypto · ' + cCount;

  // Update badges
  var sBadge = document.getElementById('stocksPnlBadge');
  var cBadge = document.getElementById('cryptoPnlBadge');
  if (sBadge) { sBadge.textContent = (sPnl >= 0 ? '+$' : '-$') + Math.abs(sPnl).toFixed(0) + ' (' + (sPnl >= 0 ? '+' : '') + sPct + '%)'; sBadge.className = 'pnl-total-badge ' + (sPnl >= 0 ? 'pos' : 'neg'); }
  if (cBadge) { cBadge.textContent = (cPnl >= 0 ? '+$' : '-$') + Math.abs(cPnl).toFixed(0) + ' (' + (cPnl >= 0 ? '+' : '') + cPct + '%)'; cBadge.className = 'pnl-total-badge ' + (cPnl >= 0 ? 'pos' : 'neg'); }
}
window.renderPnl = renderPnl;

function renderComp() {
  const stocksEl = document.getElementById('stocksCompContainer');
  const cryptoEl = document.getElementById('cryptoCompContainer');
  const tmpl = document.getElementById('compRowTemplate');
  if (!stocksEl || !cryptoEl || !tmpl) return;

  var P = window.PORTFOLIO;
  if (!P) return;

  var stocks = [], cryptos = [];
  var sTotal = P.byType.stocks.market, cTotal = P.byType.crypto.market;

  P.byAsset.forEach(function(a) {
    var entry = { ticker: a.ticker, actual: a.market, color: (window.ASSET_COLORS || {})[a.key] || 'var(--accent)' };
    (a.type === 'crypto' ? cryptos : stocks).push(entry);
  });

  stocks.sort(function(a,b) { return b.actual - a.actual; });
  cryptos.sort(function(a,b) { return b.actual - a.actual; });

  function fill(container, items, groupTotal) {
    items.forEach(function(item) {
      const pct = groupTotal > 0 ? item.actual / groupTotal * 100 : 0;
      const clone = tmpl.content.cloneNode(true);
      clone.querySelector('.comp-dot').style.background = item.color;
      clone.querySelector('.comp-label .mono').textContent = item.ticker;
      const bar = clone.querySelector('.comp-bar');
      bar.style.background = item.color;
      bar.style.width = pct.toFixed(1) + '%';
      clone.querySelector('.comp-pct').textContent = pct.toFixed(1) + '%';
      clone.querySelector('.comp-val').textContent = '$' + item.actual.toFixed(0);
      container.appendChild(clone);
    });
  }

  fill(stocksEl, stocks, sTotal);
  fill(cryptoEl, cryptos, cTotal);

  const sCard = stocksEl.closest('.card');
  const cCard = cryptoEl.closest('.card');
  if (sCard) sCard.querySelector('.section-title').textContent = 'Acc. / ETFs · $' + sTotal.toFixed(0);
  if (cCard) cCard.querySelector('.section-title').textContent = 'Crypto · $' + cTotal.toFixed(0);
}
window.renderComp = renderComp;

function populateAssetSelects() {
  const groups = {
    buyGroupCrypto:  document.getElementById('buyGroupCrypto'),
    buyGroupStocks:  document.getElementById('buyGroupStocks'),
    sellGroupCrypto: document.getElementById('sellGroupCrypto'),
    sellGroupStocks: document.getElementById('sellGroupStocks'),
  };
  Object.values(groups).forEach(function(g) { if (g) g.innerHTML = ''; });

  Object.entries(window.EXISTING_ASSETS).forEach(function(entry) {
    var key = entry[0], asset = entry[1];
    if (asset.qty <= 0) return;

    const buyOpt = document.createElement('option');
    buyOpt.value = key;
    buyOpt.textContent = asset.label + ' (' + key.toUpperCase() + ')';

    const sellOpt = document.createElement('option');
    sellOpt.value = key;
    sellOpt.textContent = asset.label + ' (' + key.toUpperCase() + ') — ' + formatQty(asset.qty);

    if (asset.type === 'crypto') {
      if (groups.buyGroupCrypto) groups.buyGroupCrypto.appendChild(buyOpt);
      if (groups.sellGroupCrypto) groups.sellGroupCrypto.appendChild(sellOpt);
    } else {
      if (groups.buyGroupStocks) groups.buyGroupStocks.appendChild(buyOpt);
      if (groups.sellGroupStocks) groups.sellGroupStocks.appendChild(sellOpt);
    }
  });
}
window.populateAssetSelects = populateAssetSelects;
