/**
 * Portfolio.js
 * Clase que gestiona las operaciones del portafolio
 * Responsabilidad única: gestionar estado del portafolio
 */

export class Portfolio {
  constructor(data) {
    this.crypto = data.crypto || {};
    this.stocks = data.stocks || {};
    this._updated = data._updated || new Date().toISOString().split('T')[0];
  }

  /**
   * Registra una compra
   * @param {string} ticker
   * @param {number} quantity
   * @param {number} price
   * @param {string} type - 'crypto' o 'stocks'
   * @param {string} fundamento - opcional
   */
  recordBuy(ticker, quantity, price, type, fundamento = null) {
    const section = type === 'crypto' ? this.crypto : this.stocks;
    const key = ticker.toLowerCase();
    const qtyField = type === 'crypto' ? 'qty' : 'shares';

    const existing = section[key];
    const oldQty = existing ? existing[qtyField] : 0;
    const oldCostAvg = existing ? existing.costAvg : 0;

    const newQty = parseFloat((oldQty + quantity).toFixed(8));
    const newCostAvg = oldQty > 0
      ? parseFloat((((oldQty * oldCostAvg) + (quantity * price)) / newQty).toFixed(6))
      : price;

    if (!section[key]) {
      section[key] = {};
    }

    section[key][qtyField] = newQty;
    section[key].costAvg = newCostAvg;
    if (fundamento) section[key].fundamento = fundamento;

    this._updated = new Date().toISOString().split('T')[0];

    return {
      nuevoSaldo: newQty,
      nuevoCostAvg: newCostAvg
    };
  }

  /**
   * Registra una venta
   * @param {string} ticker
   * @param {number} quantity
   * @param {number} price
   */
  recordSell(ticker, quantity, price) {
    const tickerLower = ticker.toLowerCase();
    const crypto = this.crypto[tickerLower];
    const stock = this.stocks[tickerLower];
    const asset = crypto || stock;

    if (!asset) {
      throw new Error(`No encontré ${ticker} en portafolio`);
    }

    const isCrypto = !!crypto;
    const qtyField = isCrypto ? 'qty' : 'shares';
    const currentQty = asset[qtyField];
    const costAvg = asset.costAvg;

    if (quantity <= 0 || quantity > currentQty) {
      throw new Error(`Cantidad inválida (tienes ${currentQty})`);
    }

    const montoBruto = quantity * price;
    const costoBase = quantity * costAvg;
    const gananciaBruta = montoBruto - costoBase;
    const gananciaPct = costAvg > 0
      ? ((gananciaBruta / costoBase) * 100).toFixed(2)
      : '0';

    const newQty = currentQty - quantity;
    if (isCrypto) {
      this.crypto[tickerLower].qty = parseFloat(newQty.toFixed(8));
    } else {
      this.stocks[tickerLower].shares = parseFloat(newQty.toFixed(8));
    }

    this._updated = new Date().toISOString().split('T')[0];

    return {
      montoBruto,
      costoBase,
      gananciaBruta,
      gananciaPct: parseFloat(gananciaPct),
      nuevoSaldo: newQty
    };
  }

  /**
   * Obtiene saldo actual de un activo
   */
  getBalance(ticker, type) {
    const tickerLower = ticker.toLowerCase();
    const section = type === 'crypto' ? this.crypto : this.stocks;
    const asset = section[tickerLower];

    if (!asset) return 0;

    return type === 'crypto' ? asset.qty : asset.shares;
  }

  /**
   * Obtiene costo promedio de un activo
   */
  getCostAvg(ticker) {
    const tickerLower = ticker.toLowerCase();
    const crypto = this.crypto[tickerLower];
    const stock = this.stocks[tickerLower];
    const asset = crypto || stock;

    return asset ? asset.costAvg : 0;
  }

  /**
   * Serializa para guardar
   */
  toJSON() {
    return {
      crypto: this.crypto,
      stocks: this.stocks,
      _updated: this._updated
    };
  }
}
