/**
 * StorageService.js
 * Servicio para persistencia de datos (JSON local o API)
 * Responsabilidad única: guardar y cargar datos
 */

export class StorageService {
  constructor(apiBaseUrl = null) {
    this.apiBaseUrl = apiBaseUrl || '';
  }

  /**
   * Carga portfolio desde servidor/API
   */
  async loadPortfolio() {
    try {
      if (this.apiBaseUrl) {
        // Cargar desde API (dev-server)
        const response = await fetch(`${this.apiBaseUrl}/api/portfolio`);
        if (response.ok) {
          return await response.json();
        }
      }

      // Fallback: cargar desde archivo local
      const response = await fetch('./portfolio.json');
      if (!response.ok) throw new Error('No se pudo cargar portfolio.json');
      return await response.json();
    } catch (err) {
      console.error('Error cargando portfolio:', err);
      return { crypto: {}, stocks: {} };
    }
  }

  /**
   * Guarda portfolio en servidor/API
   */
  async savePortfolio(portfolio) {
    try {
      if (this.apiBaseUrl) {
        // Guardar via API (dev-server)
        const response = await fetch(`${this.apiBaseUrl}/api/portfolio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(portfolio)
        });

        if (!response.ok) throw new Error('Error guardando via API');
        return true;
      }

      console.warn('⚠️  Guardado local no disponible en esta sesión');
      return false;
    } catch (err) {
      console.error('Error guardando portfolio:', err);
      return false;
    }
  }

  /**
   * Carga historial de análisis
   */
  async loadHistory() {
    try {
      const response = await fetch('./history.json');
      if (!response.ok) throw new Error('No se pudo cargar history.json');
      return await response.json();
    } catch (err) {
      console.warn('⚠️  No hay historial disponible');
      return [];
    }
  }

  /**
   * Carga DCA log
   */
  async loadDCALog() {
    try {
      const response = await fetch('./dca-log.json');
      if (!response.ok) throw new Error('No se pudo cargar dca-log.json');
      return await response.json();
    } catch (err) {
      console.warn('⚠️  No hay DCA log disponible');
      return [];
    }
  }
}
