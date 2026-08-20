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
    // La app ya tiene toasts; alert() bloquea el hilo y rompe la estetica en movil.
    if (typeof window.showToast === 'function') window.showToast(null, '❌ ' + message);
    else console.error(message);
  }
}
