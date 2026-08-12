/**
 * UIManager.js
 * Responsabilidad única: gestionar UI (modales, botones, estado)
 */

export class UIManager {
  constructor(authService) {
    this.authService = authService;
    this.sellQuantityType = 'partial';
  }

  /**
   * Actualiza el estado de autenticación en la UI
   */
  updateAuthStatus() {
    const statusEl = document.getElementById('authStatus');
    if (!statusEl) return;

    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      statusEl.textContent = `👤 ${user.email}`;
      statusEl.style.cursor = 'pointer';
      statusEl.onclick = () => this.logout();
    } else {
      statusEl.textContent = '⚠️ No autenticado';
    }
  }

  /**
   * Logout desde UI
   */
  async logout() {
    await this.authService.logout();
    location.reload();
  }

  /**
   * Abre modal de compra
   */
  openBuyModal() {
    const modal = document.getElementById('buyModalOverlay');
    if (!modal) return;

    document.getElementById('buyAssetSelect').value = '';
    document.getElementById('buyQty').value = '';
    document.getElementById('buyPrice').value = '';
    document.getElementById('buyFundamento').value = '';
    document.getElementById('buyTargetPrice').value = '';
    document.getElementById('buyPreview').style.display = 'none';
    // Reset type selector
    const typeSelect = document.getElementById('buyNewType');
    if (typeSelect) { typeSelect.value = 'crypto'; typeSelect.disabled = true; typeSelect.style.opacity = '.7'; }
    const newTickerField = document.getElementById('newTickerField');
    if (newTickerField) newTickerField.style.display = 'none';
    const newTicker = document.getElementById('buyNewTicker');
    if (newTicker) newTicker.value = '';
    const today = new Date().toISOString().split('T')[0];
    const buyDateEl = document.getElementById('buyDate');
    if (buyDateEl && !buyDateEl.value) buyDateEl.value = today;
    modal.classList.add('show');
  }

  /**
   * Cierra modal de compra
   */
  closeBuyModal() {
    const modal = document.getElementById('buyModalOverlay');
    if (modal) modal.classList.remove('show');
  }

  /**
   * Abre modal de venta
   */
  openSellModal() {
    const modal = document.getElementById('sellModalOverlay');
    if (!modal) return;

    document.getElementById('sellAssetSelect').value = '';
    document.getElementById('sellQty').value = '';
    document.getElementById('sellPrice').value = '';
    document.getElementById('sellCostAvg').value = '';
    document.getElementById('sellCommission').value = '';
    document.getElementById('sellReason').value = 'Toma de ganancias';
    document.getElementById('sellObservations').value = '';
    document.getElementById('sellPreview').style.display = 'none';
    document.getElementById('sellQtyHint').textContent = '';
    const today = new Date().toISOString().split('T')[0];
    const sellDateEl = document.getElementById('sellDate');
    if (sellDateEl) sellDateEl.value = today;
    modal.classList.add('show');
  }

  /**
   * Cierra modal de venta
   */
  closeSellModal() {
    const modal = document.getElementById('sellModalOverlay');
    if (modal) modal.classList.remove('show');
  }

  /**
   * Actualiza preview de compra
   */
  updateBuyPreview() {
    const qty = parseFloat(document.getElementById('buyQty')?.value) || 0;
    const price = parseFloat(document.getElementById('buyPrice')?.value) || 0;
    const previewEl = document.getElementById('buyPreview');

    if (qty > 0 && price > 0) {
      const total = qty * price;
      const assetKey = window.getSelectedAssetKey?.();
      const existing = window.EXISTING_ASSETS?.[assetKey];

      document.getElementById('previewTotal').textContent =
        '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const newQty = existing ? existing.qty + qty : qty;
      const newCostAvg = existing
        ? (existing.qty * existing.costAvg + qty * price) / newQty
        : price;

      const fmtP = v => v >= 1000
        ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '$' + v.toFixed(v >= 1 ? 2 : v >= 0.01 ? 4 : 6);

      document.getElementById('previewNewQty').textContent =
        newQty.toLocaleString('en-US', { maximumFractionDigits: 8 });
      document.getElementById('previewNewCostAvg').textContent = fmtP(newCostAvg);

      if (previewEl) previewEl.style.display = 'flex';
    } else if (previewEl) {
      previewEl.style.display = 'none';
    }
  }

  /**
   * Actualiza preview de venta
   */
  updateSellPreview(availableQuantity, costAvgParam = 0) {
    const qty = parseFloat(document.getElementById('sellQty')?.value) || 0;
    const price = parseFloat(document.getElementById('sellPrice')?.value) || 0;
    const commission = parseFloat(document.getElementById('sellCommission')?.value) || 0;
    const costAvg = parseFloat(document.getElementById('sellCostAvg')?.value) || costAvgParam;
    const previewEl = document.getElementById('sellPreview');

    if (qty > 0 && price > 0 && qty <= availableQuantity) {
      const gross = qty * price;
      const net = gross - commission;
      const cost = qty * costAvg;
      const pnl = net - cost;
      const pnlPct = cost > 0 ? (pnl / cost * 100) : 0;
      const isPos = pnl >= 0;
      const remaining = availableQuantity - qty;

      const fmt = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.getElementById('sellPreviewTotal').textContent = fmt(gross);
      document.getElementById('sellPreviewCommission').textContent = commission > 0 ? '-' + fmt(commission) : '$0.00';
      document.getElementById('sellPreviewNet').textContent = fmt(net);
      document.getElementById('sellPreviewRemaining').textContent =
        remaining.toLocaleString('en-US', { maximumFractionDigits: 8 });

      const pnlEl = document.getElementById('sellPreviewPnL');
      const pnlPctEl = document.getElementById('sellPreviewPnLPct');
      const pnlLabelEl = document.getElementById('sellPreviewPnLLabel');
      if (pnlEl) {
        pnlEl.textContent = (isPos ? '+' : '') + fmt(pnl);
        pnlEl.className = 'mono num ' + (isPos ? 'pos' : 'neg');
      }
      if (pnlPctEl) {
        pnlPctEl.textContent = (isPos ? '+' : '') + pnlPct.toFixed(2) + '%';
        pnlPctEl.className = 'mono num ' + (isPos ? 'pos' : 'neg');
        pnlPctEl.style.fontSize = '10px';
      }
      if (pnlLabelEl) {
        pnlLabelEl.textContent = isPos ? '📈 Ganancia' : '📉 Pérdida';
      }

      if (previewEl) previewEl.style.display = 'flex';
    } else if (previewEl) {
      previewEl.style.display = 'none';
    }
  }

  /**
   * Actualiza opciones de cantidad de venta
   */
  updateSellQtyOptions(availableQuantity) {
    const qtyOptionsEl = document.getElementById('sellQtyOptions');
    const hintEl = document.getElementById('sellQtyHint');
    const qtyInput = document.getElementById('sellQty');

    if (qtyOptionsEl && hintEl) {
      qtyOptionsEl.style.display = 'flex';
      hintEl.textContent = 'Disponible: ' + availableQuantity.toLocaleString('en-US', { maximumFractionDigits: 8 }) + ' unidades';
    }
    if (qtyInput) {
      qtyInput.max = availableQuantity;
      qtyInput.oninput = () => {
        if (parseFloat(qtyInput.value) > availableQuantity) qtyInput.value = availableQuantity;
        window.updateSellPreview();
      };
    }

    this.setSellQuantityType('partial');
  }

  /**
   * Establece tipo de cantidad a vender
   */
  setSellQuantityType(type, availableQuantity = 0, costAvg = 0) {
    this.sellQuantityType = type;
    const qtyEl = document.getElementById('sellQty');
    if (type === 'all' && qtyEl) {
      qtyEl.value = availableQuantity;
      this.updateSellPreview(availableQuantity, costAvg);
    } else if (qtyEl) {
      qtyEl.value = '';
    }
  }

  /**
   * Muestra indicador de carga en botón
   */
  setButtonLoading(selector, isLoading) {
    const btn = document.querySelector(selector);
    if (!btn) return;

    if (isLoading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = '⏳ Registrando...';
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.originalText || 'Registrar';
      btn.disabled = false;
    }
  }

  /**
   * Muestra éxito en botón
   */
  setButtonSuccess(selector) {
    const btn = document.querySelector(selector);
    if (!btn) return;

    btn.textContent = '✅ Registrado';
    setTimeout(() => {
      btn.textContent = btn.dataset.originalText || 'Registrar';
      btn.disabled = false;
    }, 1500);
  }

  /**
   * Muestra error
   */
  showError(message) {
    alert('❌ ' + message);
  }
}
