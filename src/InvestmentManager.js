/**
 * InvestmentManager.js
 * Orquestador principal que coordina todas las operaciones
 * Patrón Facade: expone interfaz simple, coordina Portfolio + TransactionService + StorageService
 */

import { Portfolio } from './Portfolio.js';
import { TransactionService } from './TransactionService.js';
import { StorageService } from './StorageService.js';

export class InvestmentManager {
  constructor(supabaseClient = null, apiBaseUrl = null) {
    this.storage = new StorageService(apiBaseUrl);
    this.transactions = new TransactionService(supabaseClient);
    this.portfolio = null;
    this.history = [];
    this.dcaLog = [];
  }

  /**
   * Inicializa el manager cargando datos
   */
  async initialize() {
    const portfolioData = await this.storage.loadPortfolio();
    this.portfolio = new Portfolio(portfolioData);
    this.history = await this.storage.loadHistory();
    this.dcaLog = await this.storage.loadDCALog();

    return {
      portfolio: this.portfolio,
      history: this.history,
      dcaLog: this.dcaLog
    };
  }

  /**
   * Registra una compra (coordinada)
   */
  async buyAsset(ticker, quantity, price, type, fundamento = null) {
    if (!this.portfolio) throw new Error('Manager no inicializado');

    // 1. Actualizar portfolio local
    const result = this.portfolio.recordBuy(ticker, quantity, price, type, fundamento);

    // 2. Registrar en Supabase (si está disponible)
    try {
      await this.transactions.recordPurchase(ticker, quantity, price, fundamento);
    } catch (err) {
      console.warn('⚠️  No se registró en Supabase, pero portfolio local fue actualizado');
    }

    // 3. Guardar portfolio
    await this.storage.savePortfolio(this.portfolio.toJSON());

    return result;
  }

  /**
   * Registra una venta (coordinada)
   */
  async sellAsset(ticker, quantity, price, reason, observations = null) {
    if (!this.portfolio) throw new Error('Manager no inicializado');

    // 1. Calcular P&L y actualizar portfolio local
    const result = this.portfolio.recordSell(ticker, quantity, price);

    // 2. Registrar en Supabase (si está disponible)
    try {
      await this.transactions.recordSale(ticker, quantity, price, reason, observations);
    } catch (err) {
      console.warn('⚠️  No se registró en Supabase, pero portfolio local fue actualizado');
    }

    // 3. Guardar portfolio
    await this.storage.savePortfolio(this.portfolio.toJSON());

    return result;
  }

  /**
   * Obtiene saldo actual
   */
  getBalance(ticker, type) {
    if (!this.portfolio) throw new Error('Manager no inicializado');
    return this.portfolio.getBalance(ticker, type);
  }

  /**
   * Obtiene costo promedio
   */
  getCostAvg(ticker) {
    if (!this.portfolio) throw new Error('Manager no inicializado');
    return this.portfolio.getCostAvg(ticker);
  }

  /**
   * Exporta estado actual
   */
  export() {
    return {
      portfolio: this.portfolio.toJSON(),
      history: this.history,
      dcaLog: this.dcaLog
    };
  }
}
