// ui-utils.js — Global utility functions for UI interactions
// Classic script (not a module) — loaded with <script src defer>

// ---- TOOLTIPS ----
var TOOLTIPS = {
  pnl: "P&L (Profit and Loss): la diferencia entre lo que invertiste y el valor actual de tu posicion.",
  risk_profile: "Perfil de riesgo: el nivel de volatilidad y posibles perdidas que estas dispuesto a aceptar buscando mayor retorno.",
  trm: "TRM: Tasa Representativa del Mercado, el valor oficial del dolar en pesos colombianos publicado por el Banco de la Republica.",
  btc_dominance: "Dominancia BTC: el porcentaje del valor total del mercado crypto que representa Bitcoin.",
  fear_greed: "Fear & Greed Index: mide el sentimiento del mercado crypto del 0 (miedo extremo) al 100 (codicia extrema).",
  health_score: "Score de salud: medida del 1 al 10 que evalua diversificacion, rendimiento y disciplina de tu portafolio.",
  breakeven: "Break-even: el precio al que tu posicion vuelve a estar en cero, ni ganancia ni perdida.",
  annualized_return: "Retorno anualizado: proyecta el rendimiento actual como si se mantuviera durante un año completo.",
  dca: "DCA (Dollar Cost Average): estrategia de invertir un monto fijo periodicamente, sin importar el precio del momento.",
  precio_objetivo: "El precio al que llegarias promediando tus 3 fuentes de valoracion (formula tipo Peter Lynch, consenso de analistas/DCF, y tu propio calculo). Sirve de ancla contra el panico cuando el mercado corrige.",
  margen_seguridad: "Margen de seguridad: diferencia entre el precio objetivo (promedio de tus 3 valoraciones) y el precio actual. Si el precio esta 20% o mas por debajo del objetivo, hay margen real de compra. Solo aplica a acciones con flujo de caja, no a cripto."
};

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('info-icon')) {
    var key = e.target.dataset.tooltipKey;
    if (TOOLTIPS[key]) showToast(e.target, TOOLTIPS[key]);
  }
});

// ---- TOAST ----
var toastTimeout;
function showToast(el, text) {
  var toast = document.getElementById('infoToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'infoToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function() { toast.classList.remove('show'); }, 3500);
}
window.showToast = showToast;

// ---- LOG FILTER ----
function filterLogByMonth(month) {
  var rows = document.querySelectorAll('#logScroll .log-row');
  var visibleCount = 0;
  rows.forEach(function(row) {
    var show = month === 'all' || row.dataset.month === month;
    row.style.display = show ? 'grid' : 'none';
    if (show) visibleCount++;
  });
  var emptyEl = document.getElementById('logEmpty');
  if (emptyEl) emptyEl.style.display = visibleCount === 0 ? 'block' : 'none';
}
window.filterLogByMonth = filterLogByMonth;

// ---- PDF EXPORT ----
function exportPDF() {
  var btn = document.querySelector('.pdf-btn');
  btn.textContent = '⏳ Generando...';
  var opt = {
    margin: 8,
    filename: 'market-intelligence-agosto-de-2026.pdf',
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, backgroundColor: '#0a0c10', useCORS: true },
    jsPDF: { unit: 'mm', format: 'a3', orientation: 'portrait' }
  };
  var el = document.body.cloneNode(true);
  var stickyClone = el.querySelector('.sticky-bar'); if (stickyClone) stickyClone.remove();
  var tabsNavClone = el.querySelector('.tabs-nav-wrap'); if (tabsNavClone) tabsNavClone.remove();
  el.style.paddingTop = '20px';
  el.querySelectorAll('.tab-panel').forEach(function(p) { p.style.display = 'block'; });
  el.querySelectorAll('.modal-overlay').forEach(function(m) { m.remove(); });
  html2pdf().set(opt).from(el).save()
    .then(function() { btn.textContent = '⬇ PDF'; })
    .catch(function() { btn.textContent = '⬇ PDF'; });
}
window.exportPDF = exportPDF;

// ---- REG MODAL ----
var regAction = 'buy';

function openRegModal() {
  if (regAction === 'buy') openBuyModal(); else openSellModal();
}
window.openRegModal = openRegModal;

function switchRegModal(action) {
  if (action === regAction) return;
  regAction = action;
  if (action === 'sell') {
    closeBuyModal();
    openSellModal();
  } else {
    closeSellModal();
    openBuyModal();
  }
}
window.switchRegModal = switchRegModal;

// ---- BUY MODAL ----
function openBuyModal() { document.getElementById('buyModalOverlay').classList.add('show'); }
function closeBuyModal() { document.getElementById('buyModalOverlay').classList.remove('show'); }
window.openBuyModal = openBuyModal;
window.closeBuyModal = closeBuyModal;

// ---- SELL MODAL ----
function openSellModal() { document.getElementById('sellModalOverlay').classList.add('show'); }
function closeSellModal() { document.getElementById('sellModalOverlay').classList.remove('show'); }
window.openSellModal = openSellModal;
window.closeSellModal = closeSellModal;

// ---- ASSET SELECT CHANGE ----
function onAssetSelectChange() {
  var val = document.getElementById('buyAssetSelect').value;
  var typeSelect = document.getElementById('buyNewType');
  var newTickerField = document.getElementById('newTickerField');
  var previewEl = document.getElementById('buyPreview');
  if (previewEl) previewEl.style.display = 'none';

  if (val === '__new__') {
    typeSelect.disabled = false;
    typeSelect.style.opacity = '1';
    newTickerField.style.display = '';
  } else if (val) {
    var asset = window.EXISTING_ASSETS[val];
    if (asset) {
      typeSelect.value = asset.type === 'stock' ? 'stock' : 'crypto';
      typeSelect.disabled = true;
      typeSelect.style.opacity = '.7';
    }
    newTickerField.style.display = 'none';
    if (typeof window.updateBuyPreview === 'function') window.updateBuyPreview();
  } else {
    typeSelect.disabled = true;
    typeSelect.style.opacity = '.7';
    newTickerField.style.display = 'none';
  }
}
window.onAssetSelectChange = onAssetSelectChange;

// ---- BUY PREVIEW ----
// Note: the real updateBuyPreview is provided by app.js (window.updateBuyPreview = () => app.updateBuyPreview())
// This is a fallback no-op in case app hasn't loaded yet
if (!window.updateBuyPreview) {
  window.updateBuyPreview = function() {};
}

// ---- GET SELECTED ASSET KEY ----
window.getSelectedAssetKey = function() {
  var val = document.getElementById('buyAssetSelect').value;
  if (val === '__new__') {
    return document.getElementById('buyNewTicker').value.trim().toLowerCase();
  }
  return val;
};

// ---- COPY COMMAND (stub) ----
function copyCommand() {}
window.copyCommand = copyCommand;

function generateCashCommand() {}
window.generateCashCommand = generateCashCommand;

function copyCashCommand() {}
window.copyCashCommand = copyCashCommand;

// ---- STICKY HEIGHTS ----
function measureStickyHeights() {
  var stickyBar = document.querySelector('.sticky-bar');
  var tabsWrap = document.querySelector('.tabs-nav-wrap');
  if (!stickyBar || !tabsWrap) return;
  var stickyH = stickyBar.offsetHeight;
  tabsWrap.style.top = stickyH + 'px';
  document.body.style.paddingTop = (stickyH + tabsWrap.offsetHeight + 16) + 'px';
}
window.measureStickyHeights = measureStickyHeights;

window.addEventListener('load', measureStickyHeights);
window.addEventListener('resize', function() {
  clearTimeout(window._stickyResizeT);
  window._stickyResizeT = setTimeout(measureStickyHeights, 120);
});
document.addEventListener('DOMContentLoaded', measureStickyHeights);

// ---- COP WIDGET ----
var COP_DATA = {
  baseRate: 3230.44,
  totalUsd: 3131.7999999999997,
  cryptoUsd: 2295.0599999999995,
  stocksUsd: 636.7400000000001,
  cashUsd: 200
};

function fmtCOP(n) {
  return Math.round(n).toLocaleString('es-CO');
}

function updateCopWidget(rate) {
  var rateValueEl = document.getElementById('copRateValue');
  if (rateValueEl) rateValueEl.textContent = '$' + Number(rate).toLocaleString('es-CO', {minimumFractionDigits:2, maximumFractionDigits:2});
  var diff = ((rate - COP_DATA.baseRate) / COP_DATA.baseRate * 100);
  var diffEl = document.getElementById('copRateDiff');
  if (diffEl) {
    if (Math.abs(diff) < 0.05) {
      diffEl.textContent = '(tasa actual)';
      diffEl.className = 'cop-rate-diff text-muted';
    } else {
      diffEl.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '% vs TRM real';
      diffEl.className = 'cop-rate-diff ' + (diff >= 0 ? 'pos' : 'neg');
    }
  }
  var usdEl = document.getElementById('copUsdVal');
  if (usdEl) usdEl.textContent = '$' + Math.round(COP_DATA.totalUsd).toLocaleString('en-US');
  var valEl = document.getElementById('copValue');
  if (valEl) valEl.textContent = '$' + fmtCOP(COP_DATA.totalUsd * rate) + ' COP';
  var cryptoEl = document.getElementById('copCrypto');
  if (cryptoEl) cryptoEl.textContent = '$' + fmtCOP(COP_DATA.cryptoUsd * rate) + ' COP';
  var stocksEl = document.getElementById('copStocks');
  if (stocksEl) stocksEl.textContent = '$' + fmtCOP(COP_DATA.stocksUsd * rate) + ' COP';
  var cashEl = document.getElementById('copCash');
  if (cashEl) cashEl.textContent = '$' + fmtCOP(COP_DATA.cashUsd * rate) + ' COP';
}
window.updateCopWidget = updateCopWidget;

function resetCopRate() {
  var slider = document.getElementById('copSlider');
  if (slider) slider.value = COP_DATA.baseRate;
  updateCopWidget(COP_DATA.baseRate);
}
window.resetCopRate = resetCopRate;

function initCopWidget() {
  var slider = document.getElementById('copSlider');
  var baseRateEl = document.getElementById('copBaseRate');
  if (slider) {
    slider.value = COP_DATA.baseRate;
    slider.min = Math.max(2000, Math.round(COP_DATA.baseRate * 0.7));
    slider.max = Math.round(COP_DATA.baseRate * 1.3);
    if (baseRateEl) baseRateEl.textContent = '$' + Number(COP_DATA.baseRate).toLocaleString('es-CO', {minimumFractionDigits:2});
    updateCopWidget(COP_DATA.baseRate);
    slider.addEventListener('input', function(e) { updateCopWidget(e.target.value); });
  }
}
window.initCopWidget = initCopWidget;

// ---- PORTFOLIO COMPOSITION (Supabase) ----
async function loadPortfolioComposition() {
  var container = document.getElementById('composicionContainer');
  if (!container) return;
  if (!window.app || !window.app.portfolioHistoryService) {
    container.innerHTML = '<div style="color:var(--text-muted)">Datos no disponibles</div>';
    return;
  }

  try {
    var latestReport = await window.app.getLatestReport();
    if (!latestReport) {
      container.innerHTML = '<div style="color:var(--text-muted)">Sin datos históricos</div>';
      return;
    }

    var assets = await window.app.getPortfolioComposition(latestReport.id);
    var snapshot = latestReport.portfolio_snapshot || {};
    var date = new Date(latestReport.report_date).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    var html = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Última actualización:</div>
            <div style="font-size:13px;font-weight:600">${date}</div>
          </div>
          <div style="display:flex;gap:16px">
            <div style="text-align:right">
              <div style="font-size:11px;color:var(--text-muted)">TOTAL</div>
              <div class="mono" style="font-size:16px;font-weight:700">$${snapshot.total?.toFixed(2) || '0'}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:var(--text-muted)">CAMBIO SEMANA</div>
              <div class="mono pos" style="font-size:16px;font-weight:700">+$36.12</div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
          <div style="background:var(--surface2);padding:14px;border-radius:8px">
            <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600">Crypto</div>
            <div class="mono" style="font-size:15px;font-weight:700">$${snapshot.totalCrypto?.toFixed(0) || '0'}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${snapshot.totalCrypto > 0 ? ((snapshot.totalCrypto / snapshot.total) * 100).toFixed(0) : 0}% del portafolio</div>
          </div>
          <div style="background:var(--surface2);padding:14px;border-radius:8px">
            <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600">Acciones</div>
            <div class="mono" style="font-size:15px;font-weight:700">$${snapshot.totalStocks?.toFixed(0) || '0'}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${snapshot.totalStocks > 0 ? ((snapshot.totalStocks / snapshot.total) * 100).toFixed(0) : 0}% del portafolio</div>
          </div>
          <div style="background:var(--surface2);padding:14px;border-radius:8px">
            <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600">Cash</div>
            <div class="mono" style="font-size:15px;font-weight:700">$${snapshot.cash?.toFixed(0) || '0'}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${snapshot.cash > 0 ? ((snapshot.cash / snapshot.total) * 100).toFixed(0) : 0}% del portafolio</div>
          </div>
        </div>

      </div>
    `;

    container.innerHTML = html;
  } catch (err) {
    console.error('Error cargando composición:', err);
    container.innerHTML = '<div style="color:var(--red);padding:20px">Error: ' + err.message + '</div>';
  }
}
window.loadPortfolioComposition = loadPortfolioComposition;

// ---- URL PARAMS ----
(function applyTabFromUrl() {
  var params = new URLSearchParams(window.location.search);
  var tab = params.get('tab');
  var action = params.get('action');
  if (tab) document.addEventListener('DOMContentLoaded', function() { window.switchTab(tab); });
  if (action === 'sell') document.addEventListener('DOMContentLoaded', function() { regAction = 'sell'; openSellModal(); });
})();

// ---- SERVICE WORKER ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('service-worker.js').catch(function(err) {
      console.log('No se pudo registrar el service worker:', err);
    });
  });
}

// ---- PASSWORD ENTER KEY ----
document.addEventListener('DOMContentLoaded', function() {
  var pwEl = document.getElementById('login-password');
  if (pwEl) {
    pwEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') window.app && window.app.doLogin();
    });
  }

  // Set today's date in buy/sell modals
  var today = new Date().toISOString().split('T')[0];
  var buyDateEl = document.getElementById('buyDate');
  var sellDateEl = document.getElementById('sellDate');
  if (buyDateEl) buyDateEl.value = today;
  if (sellDateEl) sellDateEl.value = today;

  // Populate asset selects once DOM and data are ready
  if (typeof window.populateAssetSelects === 'function') window.populateAssetSelects();
});

// Supabase composition load after app ready
window.addEventListener('load', function() {
  setTimeout(function() {
    // Only call if activos tab has been loaded
    var activosContainer = document.getElementById('tab-activos');
    if (activosContainer && activosContainer.dataset.loaded === '1') {
      if (typeof window.loadPortfolioComposition === 'function') window.loadPortfolioComposition();
    }
  }, 1000);
});
