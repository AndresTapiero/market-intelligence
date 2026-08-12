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

  let sInv = 0, sAct = 0, cInv = 0, cAct = 0;

  window.ASSET_DATA.forEach(function(asset) {
    const key = asset.ticker.toLowerCase();
    const holding = window.EXISTING_ASSETS[key];
    if (!holding || holding.qty <= 0) return;

    const costAvg = holding.costAvg;
    const qty = holding.qty;
    const currentPrice = asset.price;
    const invested = qty * costAvg;
    const actual = qty * currentPrice;
    const pnlD = actual - invested;
    const pnlP = (currentPrice - costAvg) / costAvg * 100;
    const isPos = pnlD >= 0;
    const color = (window.ASSET_COLORS || {})[key] || 'var(--accent)';

    const clone = tmpl.content.cloneNode(true);
    const icon = clone.querySelector('.asset-icon-sm');
    icon.textContent = asset.icon;
    icon.style.background = color + '22';
    icon.style.color = color;

    clone.querySelector('.pnl-name').textContent = asset.ticker;
    clone.querySelector('.pnl-qty').textContent = formatQty(qty);

    const trios = clone.querySelectorAll('.pnl-trio');
    trios[0].querySelector('.mono').textContent = fmtPrice(costAvg);
    trios[1].querySelector('.mono').textContent = fmtPrice(currentPrice);

    const dollarEl = clone.querySelector('.pnl-dollar');
    const pctEl   = clone.querySelector('.pnl-pct');
    dollarEl.textContent = (isPos ? '+$' : '-$') + Math.abs(pnlD).toFixed(0);
    dollarEl.className   = 'mono num pnl-dollar ' + (isPos ? 'pos' : 'neg');
    pctEl.textContent    = (isPos ? '+' : '') + pnlP.toFixed(1) + '%';
    pctEl.className      = 'mono num small pnl-pct ' + (isPos ? 'pos' : 'neg');

    if (asset.type === 'stock') {
      stocksEl.appendChild(clone);
      sInv += invested; sAct += actual;
    } else {
      cryptoEl.appendChild(clone);
      cInv += invested; cAct += actual;
    }
  });

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

  var sPct = (sPnl / sInv * 100).toFixed(1);
  var cPct = (cPnl / cInv * 100).toFixed(1);
  var sBadge = document.querySelector('#stocksPnlContainer')?.closest('.pnl-card')?.querySelector('.pnl-total-badge');
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

  const stocks = [], cryptos = [];
  let sTotal = 0, cTotal = 0;

  window.ASSET_DATA.forEach(function(asset) {
    const key = asset.ticker.toLowerCase();
    const holding = window.EXISTING_ASSETS[key];
    if (!holding || holding.qty <= 0) return;
    const actual = holding.qty * asset.price;
    const entry = { ticker: asset.ticker, actual: actual, color: (window.ASSET_COLORS || {})[key] || 'var(--accent)' };
    if (asset.type === 'stock') { stocks.push(entry); sTotal += actual; }
    else { cryptos.push(entry); cTotal += actual; }
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
  if (sCard) sCard.querySelector('.section-title').textContent = 'Acciones · $' + sTotal.toFixed(0);
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
