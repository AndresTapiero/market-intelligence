// tab-loader.js — Lazy tab loading via fetch (sin caché — siempre fresco)
// Classic script (not a module) — loaded with <script src defer>

(function() {

  /**
   * Load a tab's HTML content into its container via fetch.
   * Fires a custom 'tabloaded' event once injected.
   */
  function loadTab(name) {
    var container = document.getElementById('tab-' + name);
    if (!container) return Promise.resolve();

    // Ya cargado en esta sesión de página
    if (container.dataset.loaded === '1') return Promise.resolve();

    function inject(html) {
      container.innerHTML = html;
      container.dataset.loaded = '1';
      var evt = new CustomEvent('tabloaded', { bubbles: true, detail: { tab: name } });
      container.dispatchEvent(evt);
    }

    return fetch('tabs/' + name + '.html')
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' loading tab ' + name);
        return res.text();
      })
      .then(function(html) { inject(html); })
      .catch(function(err) {
        console.error('tab-loader: failed to load', name, err);
        container.innerHTML = '<div style="padding:20px;color:var(--red)">Error cargando esta sección. ' + err.message + '</div>';
      });
  }

  /**
   * Switch to a tab: activate button + panel, load HTML if needed.
   */
  function switchTab(name) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(function(b) {
      var isActive = b.getAttribute('aria-controls') === 'tab-' + name;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(function(p) {
      p.classList.toggle('active', p.dataset.tab === name);
    });

    // Load content (lazy)
    loadTab(name);
  }

  // Expose globally
  window.loadTab = loadTab;
  window.switchTab = switchTab;

  // Load resumen immediately on DOM ready (not lazy)
  document.addEventListener('DOMContentLoaded', function() {
    loadTab('resumen');
  });

  // Re-render cuando el sync de Supabase completa
  document.addEventListener('portfolio-synced', function() {
    // Sticky bar y cards del resumen
    if (window.app) {
      if (typeof window.app._updateStickyBar      === 'function') window.app._updateStickyBar();
      if (typeof window.app._updateResumenCards   === 'function') window.app._updateResumenCards();
      if (typeof window.app._updateAnalisisTab    === 'function') window.app._updateAnalisisTab();
      if (typeof window.app._renderPortfolioChart === 'function') window.app._renderPortfolioChart();
    }
    // Activos tab
    var activosEl = document.getElementById('tab-activos');
    if (activosEl && activosEl.dataset.loaded === '1') {
      ['stocksPnlContainer','cryptoPnlContainer','stocksCompContainer','cryptoCompContainer']
        .forEach(function(id) { var el = document.getElementById(id); if (el) el.innerHTML = ''; });
      if (typeof window.renderPnl  === 'function') window.renderPnl();
      if (typeof window.renderComp === 'function') window.renderComp();
    }
    if (typeof window.populateAssetSelects === 'function') window.populateAssetSelects();
    if (typeof window.renderSellHistory    === 'function') window.renderSellHistory();
  });

  // After activos tab loads, render PnL and composition
  document.addEventListener('tabloaded', function(e) {
    if (e.detail && e.detail.tab === 'resumen') {
      if (window.app && typeof window.app._updateStickyBar       === 'function') window.app._updateStickyBar();
      if (window.app && typeof window.app._updateResumenCards    === 'function') window.app._updateResumenCards();
      if (window.app && typeof window.app._renderPortfolioChart  === 'function') window.app._renderPortfolioChart();
    }
    if (e.detail && e.detail.tab === 'activos') {
      if (typeof window.renderPnl === 'function') window.renderPnl();
      if (typeof window.renderComp === 'function') window.renderComp();
      if (typeof window.loadPortfolioComposition === 'function') window.loadPortfolioComposition();
    }
    if (e.detail && e.detail.tab === 'transacciones') {
      // Re-initialize log filter and cash display after tab loads
      var select = document.getElementById('logMonthFilter');
      if (select && typeof window.filterLogByMonth === 'function') window.filterLogByMonth(select.value);
      if (typeof window.updateCashDisplayPublic === 'function') window.updateCashDisplayPublic();
      if (typeof window.renderSellHistory === 'function') window.renderSellHistory();
      if (window.app && typeof window.app._loadBuyHistory === 'function') window.app._loadBuyHistory();
    }
    if (e.detail && e.detail.tab === 'analisis') {
      if (window.app && typeof window.app._updateAnalisisTab === 'function') window.app._updateAnalisisTab();
      else if (typeof window.initCopWidget === 'function') window.initCopWidget();
    }
  });
})();
