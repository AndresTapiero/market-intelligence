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

    document.getElementById('buyQty').value = '';
    document.getElementById('buyPrice').value = '';
    document.getElementById('buyFundamento').value = '';
    document.getElementById('buyPreview').style.display = 'none';
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

    document.getElementById('sellQty').value = '';
    document.getElementById('sellPrice').value = '';
    document.getElementById('sellReason').value = 'Toma de ganancias';
    document.getElementById('sellObservations').value = '';
    document.getElementById('sellPreview').style.display = 'none';
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
    const qtyEl = document.getElementById('buyQty');
    const priceEl = document.getElementById('buyPrice');
    const previewEl = document.getElementById('buyPreview');

    const qty = parseFloat(qtyEl?.value) || 0;
    const price = parseFloat(priceEl?.value) || 0;

    if (qty > 0 && price > 0) {
      const total = qty * price;
      const previewTotal = document.getElementById('previewTotal');
      if (previewTotal) {
        previewTotal.textContent = '$' + total.toLocaleString('en-US', { maximumFractionDigits: 2 });
        previewEl.style.display = 'flex';
      }
    } else if (previewEl) {
      previewEl.style.display = 'none';
    }
  }

  /**
   * Actualiza preview de venta
   */
  updateSellPreview(availableQuantity) {
    const qtyEl = document.getElementById('sellQty');
    const priceEl = document.getElementById('sellPrice');
    const previewEl = document.getElementById('sellPreview');

    const qty = parseFloat(qtyEl?.value) || 0;
    const price = parseFloat(priceEl?.value) || 0;

    if (qty > 0 && price > 0 && qty <= availableQuantity) {
      const total = qty * price;
      const remaining = availableQuantity - qty;

      const previewTotal = document.getElementById('sellPreviewTotal');
      const previewRemaining = document.getElementById('sellPreviewRemaining');

      if (previewTotal) previewTotal.textContent = '$' + total.toLocaleString('en-US', { maximumFractionDigits: 2 });
      if (previewRemaining) previewRemaining.textContent = remaining.toFixed(8);

      previewEl.style.display = 'flex';
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

    if (qtyOptionsEl && hintEl) {
      qtyOptionsEl.style.display = 'flex';
      hintEl.textContent = 'Tienes: ' + availableQuantity.toFixed(availableQuantity < 1 ? 8 : 2) + ' unidades';
    }

    this.setSellQuantityType('partial');
  }

  /**
   * Establece tipo de cantidad a vender
   */
  setSellQuantityType(type, availableQuantity = 0) {
    this.sellQuantityType = type;
    const allBtn = document.querySelector('.sell-qty-btn:nth-child(1)');
    const partialBtn = document.querySelector('.sell-qty-btn:nth-child(2)');
    const qtyEl = document.getElementById('sellQty');

    if (type === 'all') {
      if (allBtn) allBtn.classList.add('active');
      if (partialBtn) partialBtn.classList.remove('active');
      if (qtyEl) {
        qtyEl.value = availableQuantity;
        this.updateSellPreview(availableQuantity);
      }
    } else {
      if (partialBtn) partialBtn.classList.add('active');
      if (allBtn) allBtn.classList.remove('active');
      if (qtyEl) qtyEl.value = '';
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
