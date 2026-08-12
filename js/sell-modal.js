// sell-modal.js — Sell modal interaction: asset selection, qty input, preview
// Classic script (not a module) — loaded with <script src defer>

function onSellAssetChange() {
  const key = document.getElementById('sellAssetSelect')?.value;
  const asset = key && window.EXISTING_ASSETS[key];
  const hint = document.getElementById('sellQtyHint');
  const qtyEl = document.getElementById('sellQty');
  const costAvgEl = document.getElementById('sellCostAvg');
  if (hint) hint.textContent = asset ? 'Disponible: ' + window.formatQty(asset.qty) + ' unidades' : '';
  if (qtyEl) { qtyEl.value = ''; qtyEl.max = asset ? asset.qty : ''; }
  if (costAvgEl) costAvgEl.value = asset ? asset.costAvg : '';
  document.getElementById('sellPreview').style.display = 'none';
}
window.onSellAssetChange = onSellAssetChange;

function sellSelectAll() {
  const key = document.getElementById('sellAssetSelect')?.value;
  const asset = key && window.EXISTING_ASSETS[key];
  if (!asset || asset.qty <= 0) return;
  const qtyEl = document.getElementById('sellQty');
  if (qtyEl) { qtyEl.value = asset.qty; calcSellPreview(); }
}
window.sellSelectAll = sellSelectAll;

function onSellQtyInput() {
  const key = document.getElementById('sellAssetSelect')?.value;
  const asset = key && window.EXISTING_ASSETS[key];
  const qtyEl = document.getElementById('sellQty');
  if (asset && qtyEl && parseFloat(qtyEl.value) > asset.qty) qtyEl.value = asset.qty;
  calcSellPreview();
}
window.onSellQtyInput = onSellQtyInput;

function calcSellPreview() {
  const key      = document.getElementById('sellAssetSelect')?.value;
  const asset    = key && window.EXISTING_ASSETS[key];
  const qty      = parseFloat(document.getElementById('sellQty')?.value) || 0;
  const price    = parseFloat(document.getElementById('sellPrice')?.value) || 0;
  const costAvg  = parseFloat(document.getElementById('sellCostAvg')?.value) || (asset?.costAvg || 0);
  const comm     = parseFloat(document.getElementById('sellCommission')?.value) || 0;
  const preview  = document.getElementById('sellPreview');

  if (!asset || qty <= 0 || price <= 0 || qty > asset.qty) {
    if (preview) preview.style.display = 'none';
    return;
  }

  const gross    = qty * price;
  const net      = gross - comm;
  const cost     = qty * costAvg;
  const pnl      = net - cost;
  const pnlPct   = cost > 0 ? (pnl / cost * 100) : 0;
  const isPos    = pnl >= 0;
  const color    = isPos ? 'var(--green)' : 'var(--red)';
  const remaining = asset.qty - qty;

  const fmt  = function(v) { return '$' + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); };
  const fmtU = function(v) {
    const a = Math.abs(v);
    return '$' + (a >= 1000 ? a.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})
                : a >= 1    ? a.toFixed(2)
                : a >= 0.01 ? a.toFixed(4) : a.toFixed(6));
  };

  const el = function(id) { return document.getElementById(id); };

  const roiCard = el('roiCard');
  if (roiCard) roiCard.className = 'roi-card ' + (isPos ? 'pos' : 'neg');

  const pnlEl = el('sellPreviewPnL');
  if (pnlEl) { pnlEl.textContent = (isPos ? '+' : '-') + fmt(pnl); pnlEl.style.color = color; }

  const pnlPctEl = el('sellPreviewPnLPct');
  if (pnlPctEl) { pnlPctEl.textContent = (isPos ? '+' : '') + pnlPct.toFixed(2) + '%'; pnlPctEl.style.color = color; }

  const labelEl = el('sellPreviewPnLLabel');
  if (labelEl) labelEl.textContent = isPos ? 'Ganancia' : 'Pérdida';

  const arrowEl = el('roiArrow');
  if (arrowEl) arrowEl.textContent = fmtU(costAvg) + ' → ' + fmtU(price) + ' por unidad';

  if (el('sellPreviewTotal'))      el('sellPreviewTotal').textContent = fmt(gross);
  if (el('sellPreviewCommission')) el('sellPreviewCommission').textContent = comm > 0 ? '-' + fmt(comm) : '$0.00';
  if (el('sellPreviewNet'))        el('sellPreviewNet').textContent = fmt(net);
  if (el('sellPreviewRemaining'))  el('sellPreviewRemaining').textContent =
    remaining.toLocaleString('en-US', {maximumFractionDigits: 8});

  if (preview) preview.style.display = 'flex';
}
window.calcSellPreview = calcSellPreview;
