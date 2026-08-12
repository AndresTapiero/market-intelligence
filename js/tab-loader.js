// tab-loader.js — Lazy tab loading via fetch + sessionStorage cache
// Classic script (not a module) — loaded with <script src defer>

(function() {
  var SESSION_KEY_PREFIX = 'tab_html_';

  /**
   * Load a tab's HTML content into its container.
   * Returns a Promise that resolves when the content is injected.
   * Fires a custom 'tabloaded' event on the container once done.
   */
  function loadTab(name) {
    var container = document.getElementById('tab-' + name);
    if (!container) return Promise.resolve();

    // Already loaded (has real content, not empty)
    if (container.dataset.loaded === '1') return Promise.resolve();

    // Try sessionStorage first
    var cached = null;
    try { cached = sessionStorage.getItem(SESSION_KEY_PREFIX + name); } catch(e) {}

    function inject(html) {
      container.innerHTML = html;
      container.dataset.loaded = '1';
      // Notify listeners that this tab's DOM is ready
      var evt = new CustomEvent('tabloaded', { bubbles: true, detail: { tab: name } });
      container.dispatchEvent(evt);
    }

    if (cached) {
      inject(cached);
      return Promise.resolve();
    }

    return fetch('tabs/' + name + '.html')
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' loading tab ' + name);
        return res.text();
      })
      .then(function(html) {
        try { sessionStorage.setItem(SESSION_KEY_PREFIX + name, html); } catch(e) {}
        inject(html);
      })
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

  // After activos tab loads, render PnL and composition
  document.addEventListener('tabloaded', function(e) {
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
    }
    if (e.detail && e.detail.tab === 'analisis') {
      // Initialize COP widget after analisis tab loads
      if (typeof window.initCopWidget === 'function') window.initCopWidget();
    }
  });
})();
