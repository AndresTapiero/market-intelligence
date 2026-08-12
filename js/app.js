/**
 * app.js
 * Facade Pattern - Orquestador principal
 * Coordina todos los servicios y expone interfaz simple al HTML
 */

import { SUPABASE_CONFIG } from './config.js';
import { AuthService } from './auth-service.js';
import { PortfolioService } from './portfolio-service.js';
import { PortfolioHistoryService } from './portfolio-history-service.js';
import { TransactionService } from './transaction-service.js';
import { UIManager } from './ui-manager.js';

class InvestmentApp {
  constructor() {
    this.supabase = null;
    this.authService = null;
    this.portfolioService = null;
    this.portfolioHistoryService = null;
    this.transactionService = null;
    this.uiManager = null;
  }

  /**
   * Inicializa la aplicación
   */
  async initialize() {
    try {
      // Cargar SDK de Supabase
      const { createClient } = window.supabase;
      this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

      // Crear servicios (Dependency Injection)
      this.authService = new AuthService(this.supabase);
      this.portfolioService = new PortfolioService(this.supabase, this.authService);
      this.portfolioHistoryService = new PortfolioHistoryService(this.supabase, this.authService);
      this.transactionService = new TransactionService(this.supabase, this.authService);
      this.uiManager = new UIManager(this.authService);

      console.log('✅ Supabase inicializado');

      // Intentar obtener sesión existente
      const session = await this.authService.getSession();
      if (session) {
        await this.afterLogin();
      } else {
        document.getElementById('login-gate').style.display = 'flex';
        document.getElementById('login-email').focus();
      }
    } catch (err) {
      console.error('❌ Error inicializando app:', err.message);
    }
  }

  async afterLogin() {
    document.getElementById('login-gate').style.display = 'none';
    await this.portfolioService.loadTransactions();
    await this.portfolioHistoryService.loadHistoricalReports();
    this.uiManager.updateAuthStatus();
  }

  async doLogin() {
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    errEl.style.display = 'none';
    if (!email || !password) {
      errEl.textContent = 'Ingresa tu correo y contraseña para continuar.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Conectando…';
    try {
      await this.authService.signInWithPassword(email, password);
      await this.afterLogin();
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('invalid login credentials')) {
        errEl.textContent = 'Correo o contraseña incorrectos.';
      } else if (msg.includes('email not confirmed')) {
        errEl.textContent = 'Confirma tu correo antes de continuar — revisa tu bandeja de entrada.';
      } else if (msg.includes('network') || msg.includes('fetch')) {
        errEl.textContent = 'Sin conexión. Verifica tu red e intenta de nuevo.';
      } else {
        errEl.textContent = 'No se pudo iniciar sesión. Intenta de nuevo.';
      }
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  /**
   * Expone métodos públicos para el HTML
   */

  // === Modales ===
  openBuyModal() {
    this.uiManager.openBuyModal();
  }

  closeBuyModal() {
    this.uiManager.closeBuyModal();
  }

  openSellModal() {
    this.uiManager.openSellModal();
  }

  closeSellModal() {
    this.uiManager.closeSellModal();
  }

  // === Previews ===
  updateBuyPreview() {
    this.uiManager.updateBuyPreview();
  }

  updateSellPreview() {
    const assetKey = document.getElementById('sellAssetSelect')?.value;
    if (!assetKey) return;

    // Obtener cantidad disponible (del EXISTING_ASSETS global)
    const asset = window.EXISTING_ASSETS?.[assetKey];
    if (asset) {
      this.uiManager.updateSellPreview(asset.qty);
    }
  }

  updateSellQtyButtons() {
    const assetKey = document.getElementById('sellAssetSelect')?.value;
    if (!assetKey) return;

    const asset = window.EXISTING_ASSETS?.[assetKey];
    if (asset) {
      this.uiManager.updateSellQtyOptions(asset.qty);
      document.getElementById('sellQty').value = '';
      document.getElementById('sellPreview').style.display = 'none';
    }
  }

  setSellQuantityType(type) {
    const assetKey = document.getElementById('sellAssetSelect')?.value;
    const asset = window.EXISTING_ASSETS?.[assetKey];
    if (asset) {
      this.uiManager.setSellQuantityType(type, asset.qty);
    }
  }

  // === Historial ===
  async getHistoricalReports() {
    return await this.portfolioHistoryService.loadHistoricalReports();
  }

  async getLatestReport() {
    return await this.portfolioHistoryService.getLatestReport();
  }

  async getPortfolioComposition(reportId) {
    return await this.portfolioHistoryService.loadPortfolioComposition(reportId);
  }

  // === Transacciones ===
  async submitBuy() {
    try {
      const key = window.getSelectedAssetKey?.();
      const qty = parseFloat(document.getElementById('buyQty')?.value) || 0;
      const price = parseFloat(document.getElementById('buyPrice')?.value) || 0;
      const fundamento = document.getElementById('buyFundamento')?.value.trim();

      if (!key || qty <= 0 || price <= 0) {
        this.uiManager.showError('Completa el activo, la cantidad y el precio.');
        return;
      }

      this.uiManager.setButtonLoading('#buyModalOverlay .modal-submit', true);

      const result = await this.transactionService.recordBuy(key, qty, price, 'stocks', fundamento);

      if (result.success) {
        this.uiManager.setButtonSuccess('#buyModalOverlay .modal-submit');
        setTimeout(() => {
          this.closeBuyModal();
          location.reload();
        }, 1500);
      } else {
        this.uiManager.showError(result.error);
        this.uiManager.setButtonLoading('#buyModalOverlay .modal-submit', false);
      }
    } catch (err) {
      this.uiManager.showError(err.message);
      this.uiManager.setButtonLoading('#buyModalOverlay .modal-submit', false);
    }
  }

  async submitSale() {
    try {
      const key = document.getElementById('sellAssetSelect')?.value;
      const qty = parseFloat(document.getElementById('sellQty')?.value) || 0;
      const price = parseFloat(document.getElementById('sellPrice')?.value) || 0;
      const reason = document.getElementById('sellReason')?.value || 'Otro';
      const observations = document.getElementById('sellObservations')?.value.trim();

      if (!key || qty <= 0 || price <= 0) {
        this.uiManager.showError('Completa el activo, la cantidad y el precio.');
        return;
      }

      const asset = window.EXISTING_ASSETS?.[key];
      if (!asset || asset.qty < qty) {
        this.uiManager.showError(`No tienes suficientes unidades. Tienes: ${asset?.qty?.toFixed(8) || 0}`);
        return;
      }

      this.uiManager.setButtonLoading('#sellModalOverlay .modal-submit', true);

      const result = await this.transactionService.recordSale(key, qty, price, reason, observations);

      if (result.success) {
        this.uiManager.setButtonSuccess('#sellModalOverlay .modal-submit');
        setTimeout(() => {
          this.closeSellModal();
          location.reload();
        }, 1500);
      } else {
        this.uiManager.showError(result.error);
        this.uiManager.setButtonLoading('#sellModalOverlay .modal-submit', false);
      }
    } catch (err) {
      this.uiManager.showError(err.message);
      this.uiManager.setButtonLoading('#sellModalOverlay .modal-submit', false);
    }
  }
}

// Crear instancia global y exponer al window
const app = new InvestmentApp();
window.app = app;

// Inicializar cuando carga el DOM
window.addEventListener('load', () => app.initialize());

// Exponer métodos globales para onclick del HTML
window.openBuyModal = () => app.openBuyModal();
window.closeBuyModal = () => app.closeBuyModal();
window.openSellModal = () => app.openSellModal();
window.closeSellModal = () => app.closeSellModal();
window.updateBuyPreview = () => app.updateBuyPreview();
window.updateSellPreview = () => app.updateSellPreview();
window.updateSellQtyButtons = () => app.updateSellQtyButtons();
window.setSellQuantityType = (type) => app.setSellQuantityType(type);
window.submitBuy = () => app.submitBuy();
window.submitSale = () => app.submitSale();
