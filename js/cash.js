// cash.js — Cash management
// Fuente de verdad: Supabase (portfolio_history.portfolio_snapshot.cash)
// Sin localStorage — funciona igual en móvil y desktop

window.CURRENT_CASH = 200; // valor temporal hasta que Supabase cargue en afterLogin()

function updateCashDisplay(delta) {
  const amountEl = document.getElementById('cashDisplayAmount');
  const dateEl   = document.getElementById('cashDisplayDate');
  if (amountEl) amountEl.textContent = '$' + window.CURRENT_CASH.toFixed(2) + ' USD';
  if (dateEl) {
    const now = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
    if (delta !== undefined) {
      const sign = delta >= 0 ? '+' : '';
      dateEl.textContent = sign + '$' + Math.abs(delta).toFixed(2) + ' · ' + now;
    } else {
      dateEl.textContent = 'Actualizado ' + now;
    }
  }
}

function updateCashAfterTrade(delta) {
  window.CURRENT_CASH = Math.max(0, window.CURRENT_CASH + delta);
  updateCashDisplay(delta);
  _syncCashToResumen();
  // Persistir en Supabase vía app.js
  if (window.saveCashToSupabase) window.saveCashToSupabase(window.CURRENT_CASH);
}
window.updateCashAfterTrade = updateCashAfterTrade;

function _syncCashToResumen() {
  const fmtD = n => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 });
  const rc = document.getElementById('resumeCash');
  if (rc) rc.textContent = fmtD(window.CURRENT_CASH);
  if (window.app && typeof window.app._updateResumenCards === 'function') {
    window.app._updateResumenCards();
  }
}

function openCashModal() {
  const registered = document.getElementById('cashRegistered');
  const real       = document.getElementById('cashReal');
  const preview    = document.getElementById('cashPreview');
  if (registered) registered.value = '$' + window.CURRENT_CASH.toFixed(2);
  if (real)    real.value = '';
  if (preview) preview.style.display = 'none';
  document.getElementById('cashModalOverlay').classList.add('show');
}
window.openCashModal = openCashModal;

function closeCashModal() {
  document.getElementById('cashModalOverlay').classList.remove('show');
}
window.closeCashModal = closeCashModal;

function updateCashPreview() {
  const real    = parseFloat(document.getElementById('cashReal').value) || 0;
  const diff    = real - window.CURRENT_CASH;
  const diffEl  = document.getElementById('cashDiff');
  const preview = document.getElementById('cashPreview');
  if (diffEl) {
    diffEl.textContent = (diff >= 0 ? '+' : '') + '$' + diff.toFixed(2);
    diffEl.style.color = diff >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (preview) preview.style.display = 'flex';
}
window.updateCashPreview = updateCashPreview;

function saveCash() {
  const real = parseFloat(document.getElementById('cashReal').value);
  if (isNaN(real) || real < 0) return;

  window.CURRENT_CASH = real;
  updateCashDisplay();
  _syncCashToResumen();
  closeCashModal();

  // Guardar en Supabase (única fuente de verdad)
  if (window.saveCashToSupabase) window.saveCashToSupabase(real);
}
window.saveCash = saveCash;

function updateCashDisplayPublic() { updateCashDisplay(); }
window.updateCashDisplayPublic = updateCashDisplayPublic;

document.addEventListener('DOMContentLoaded', function() { updateCashDisplay(); });
