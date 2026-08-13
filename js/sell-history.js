// sell-history.js — SELL_HISTORY array and renderSellHistory function
// Classic script (not a module) — loaded with <script src defer>

window.SELL_HISTORY = [];

function renderSellHistory() {
  const card = document.getElementById('sellHistoryCard');
  const body = document.getElementById('sellHistoryBody');
  if (!card || !body) return;
  if (!window.SELL_HISTORY.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  let totalPnL = 0, totalComm = 0, winners = 0;
  const pcts = [];
  window.SELL_HISTORY.forEach(function(s) {
    totalPnL  += s.pnl;
    totalComm += s.commission;
    if (s.pnl >= 0) winners++;
    pcts.push(s.pnlPct);
  });
  const n = window.SELL_HISTORY.length;
  const avgReturn = pcts.reduce(function(a, b) { return a + b; }, 0) / n;
  const winRate = Math.round(winners / n * 100);
  const isPnLPos = totalPnL >= 0;

  const fmt = function(v) { return '$' + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); };

  const el = function(id) { return document.getElementById(id); };
  el('summaryPnL').textContent   = (isPnLPos ? '+' : '-') + fmt(totalPnL);
  el('summaryPnL').style.color   = isPnLPos ? 'var(--green)' : 'var(--red)';
  el('summaryPnLSub').textContent = 'en ' + n + (n === 1 ? ' venta' : ' ventas');
  el('summaryComm').textContent   = totalComm > 0 ? '-' + fmt(totalComm) : '$0.00';
  el('summaryCommSub').textContent = totalComm > 0
    ? ((totalComm / Math.abs(totalPnL + totalComm)) * 100).toFixed(1) + '% del bruto'
    : 'sin comisiones';
  el('summaryWinRate').textContent   = winners + '/' + n;
  el('summaryWinRate').style.color   = winRate >= 50 ? 'var(--green)' : 'var(--red)';
  el('summaryWinSub').textContent    = winRate + '% de efectividad';
  el('summaryAvgReturn').textContent = (avgReturn >= 0 ? '+' : '') + avgReturn.toFixed(1) + '%';
  el('summaryAvgReturn').style.color = avgReturn >= 0 ? 'var(--green)' : 'var(--red)';

  body.innerHTML = '';
  window.SELL_HISTORY.slice().reverse().forEach(function(s) {
    const isPos = s.pnl >= 0;
    const color = (window.ASSET_COLORS || {})[s.key] || 'var(--accent)';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="mono">' + s.date + '</td>' +
      '<td><span class="mono" style="color:' + color + ';font-weight:700">' + s.ticker + '</span></td>' +
      '<td class="mono num">' + window.formatQty(s.qty) + '</td>' +
      '<td class="mono num">' + (s.costAvg ? window.fmtPrice(s.costAvg) : '—') + '</td>' +
      '<td class="mono num">' + window.fmtPrice(s.price) + '</td>' +
      '<td class="mono num">$' + s.gross.toFixed(2) + '</td>' +
      '<td class="mono num" style="color:var(--red)">' + (s.commission > 0 ? '-$' + s.commission.toFixed(2) : '—') + '</td>' +
      '<td class="mono num">$' + s.net.toFixed(2) + '</td>' +
      '<td class="mono num ' + (isPos ? 'pos' : 'neg') + '" style="font-weight:700">' + (isPos ? '+$' : '-$') + Math.abs(s.pnl).toFixed(2) + '</td>' +
      '<td class="mono num ' + (isPos ? 'pos' : 'neg') + '">' + (isPos ? '+' : '') + s.pnlPct.toFixed(1) + '%</td>';
    body.appendChild(tr);
  });
}
window.renderSellHistory = renderSellHistory;
