import { describe, it, expect } from 'vitest';
import {
  applyJournal, computePortfolio, weightedCostAvg, sellPnl, esEquity,
} from '../js/portfolio-model.js';

const compra = (ticker, qty, precio, fecha = '2026-01-01', tipo = 'crypto') =>
  ({ ticker, numero_acciones: qty, precio_entrada: precio, fecha, tipo, fecha_venta: null });

const venta = (ticker, qty, fecha = '2026-02-01') =>
  ({ ticker, numero_acciones: qty, precio_entrada: 0, fecha, fecha_venta: fecha });

const baseline = () => ({
  btc:  { qty: 1,   costAvg: 100, type: 'crypto', label: 'Bitcoin' },
  voo:  { qty: 2,   costAvg: 500, type: 'etf',    label: 'VOO' },
  nvda: { qty: 0,   costAvg: 0,   type: 'stock',  label: 'NVIDIA' },
});

describe('weightedCostAvg', () => {
  it('promedia sin comisión', () => {
    // 1 a $100 + 1 a $200 → $150
    expect(weightedCostAvg(1, 100, 1, 200)).toBe(150);
  });

  it('mete la comisión en el costo, no en la cantidad', () => {
    // 1 a $100 + (1 a $200 + $10 de fee) = $310 / 2 unidades
    expect(weightedCostAvg(1, 100, 1, 200, 10)).toBe(155);
  });

  it('con posición previa en cero usa el precio efectivo de la compra', () => {
    expect(weightedCostAvg(0, 0, 2, 50, 10)).toBe(55); // (100+10)/2
  });

  it('devuelve 0 si no queda cantidad', () => {
    expect(weightedCostAvg(0, 0, 0, 50)).toBe(0);
  });
});

describe('sellPnl', () => {
  it('calcula ganancia', () => {
    const r = sellPnl(2, 150, 100);
    expect(r.pnl).toBe(100);
    expect(r.pnlPct).toBe(50);
  });

  it('calcula pérdida', () => {
    expect(sellPnl(2, 50, 100).pnl).toBe(-100);
  });

  it('la comisión puede convertir una ganancia bruta en pérdida neta', () => {
    // bruto 210, costo 200 → +10 bruto; con $25 de fee → -15 neto
    const r = sellPnl(2, 105, 100, 25);
    expect(r.bruto).toBe(210);
    expect(r.pnl).toBe(-15);
    expect(r.pnlPct).toBeLessThan(0);
  });

  it('con costAvg 0 devuelve 0%, no Infinity', () => {
    const r = sellPnl(1, 50, 0);
    expect(Number.isFinite(r.pnlPct)).toBe(true);
    expect(r.pnlPct).toBe(0);
  });
});

describe('applyJournal', () => {
  it('crea un ticker que no está en el baseline', () => {
    const r = applyJournal(baseline(), [compra('IREN', 1.18, 42.5, '2026-08-20', 'stock')]);
    expect(r.iren.qty).toBe(1.18);
    expect(r.iren.costAvg).toBe(42.5);
    expect(r.iren.type).toBe('stock');   // del campo `tipo`, no un fallback a crypto
  });

  it('acumula sobre un ticker existente', () => {
    const r = applyJournal(baseline(), [compra('BTC', 1, 200)]);
    expect(r.btc.qty).toBe(2);
    expect(r.btc.costAvg).toBe(150);
  });

  it('dos compras seguidas del mismo ticker promedian bien', () => {
    // el caso que más veces se ha roto
    const r = applyJournal(baseline(), [
      compra('BTC', 1, 200, '2026-01-01'),
      compra('BTC', 2, 400, '2026-01-02'),
    ]);
    expect(r.btc.qty).toBe(4);                    // 1 + 1 + 2
    expect(r.btc.costAvg).toBe((100 + 200 + 800) / 4);  // 275
  });

  it('una venta parcial resta cantidad y NO toca el costo promedio', () => {
    const r = applyJournal(baseline(), [venta('BTC', 0.4)]);
    expect(r.btc.qty).toBeCloseTo(0.6, 10);
    expect(r.btc.costAvg).toBe(100);
  });

  it('una venta total deja la cantidad en cero', () => {
    const r = applyJournal(baseline(), [venta('BTC', 1)]);
    expect(r.btc.qty).toBe(0);
  });

  it('no permite cantidades negativas al vender de más', () => {
    expect(applyJournal(baseline(), [venta('BTC', 99)]).btc.qty).toBe(0);
  });

  it('ignora la venta de un ticker que no existe', () => {
    const r = applyJournal(baseline(), [venta('DOGE', 5)]);
    expect(r.doge).toBeUndefined();
  });

  it('aplica en orden cronológico aunque el journal llegue desordenado', () => {
    const desordenado = applyJournal(baseline(), [
      compra('BTC', 2, 400, '2026-01-02'),
      compra('BTC', 1, 200, '2026-01-01'),
    ]);
    const ordenado = applyJournal(baseline(), [
      compra('BTC', 1, 200, '2026-01-01'),
      compra('BTC', 2, 400, '2026-01-02'),
    ]);
    expect(desordenado.btc.costAvg).toBe(ordenado.btc.costAvg);
  });

  it('es idempotente: no muta el baseline recibido', () => {
    const base = baseline();
    applyJournal(base, [compra('BTC', 5, 100)]);
    expect(base.btc.qty).toBe(1);   // el original intacto
  });

  it('llamarla dos veces da el mismo resultado', () => {
    // la regresión del bug de duplicación
    const journal = [compra('BTC', 1, 200)];
    const a = applyJournal(baseline(), journal);
    const b = applyJournal(baseline(), journal);
    expect(a.btc.qty).toBe(b.btc.qty);
    expect(a.btc.qty).toBe(2);
  });

  it('tolera un journal vacío o ausente', () => {
    expect(applyJournal(baseline(), []).btc.qty).toBe(1);
    expect(applyJournal(baseline(), null).btc.qty).toBe(1);
  });
});

describe('computePortfolio', () => {
  const holdings = {
    btc:  { qty: 2, costAvg: 100, type: 'crypto', label: 'Bitcoin' },
    voo:  { qty: 1, costAvg: 500, type: 'etf',    label: 'VOO' },
    nvda: { qty: 1, costAvg: 200, type: 'stock',  label: 'NVIDIA' },
    zero: { qty: 0, costAvg: 999, type: 'crypto', label: 'Vendido' },
  };
  const prices = { btc: 150, voo: 600, nvda: 250 };

  it('excluye los activos con cantidad cero', () => {
    const p = computePortfolio(holdings, prices, 0);
    expect(p.byAsset.find(a => a.key === 'zero')).toBeUndefined();
    expect(p.byAsset).toHaveLength(3);
  });

  it('suma valor y costo correctamente', () => {
    const p = computePortfolio(holdings, prices, 100);
    expect(p.totals.market).toBe(2 * 150 + 600 + 250);   // 1150
    expect(p.totals.cost).toBe(2 * 100 + 500 + 200);     // 900
    expect(p.totals.pnl).toBe(250);
  });

  it('grandTotal es mercado más cash', () => {
    const p = computePortfolio(holdings, prices, 100);
    expect(p.totals.grandTotal).toBe(p.totals.market + 100);
  });

  it('etf y stock suman ambos al bloque de acciones', () => {
    const p = computePortfolio(holdings, prices, 0);
    expect(p.byType.stocks.market).toBe(600 + 250);
    expect(p.byType.stocks.count).toBe(2);
    expect(p.byType.crypto.market).toBe(300);
  });

  it('la asignación separa BTC del resto de cripto', () => {
    const conAlt = { ...holdings, sol: { qty: 10, costAvg: 5, type: 'crypto', label: 'Solana' } };
    const p = computePortfolio(conAlt, { ...prices, sol: 10 }, 0);
    expect(p.allocation.btc).toBeGreaterThan(0);
    expect(p.allocation.alt).toBeGreaterThan(0);
    expect(p.allocation.btc + p.allocation.alt)
      .toBeCloseTo(p.ratios.cryptoPct, 6);   // sin cash, cripto = btc + alt
  });

  it('con costo cero el porcentaje es 0, nunca NaN ni Infinity', () => {
    const p = computePortfolio(
      { x: { qty: 1, costAvg: 0, type: 'crypto', label: 'X' } }, { x: 50 }, 0
    );
    expect(p.byAsset[0].pnlPct).toBe(0);
    expect(Number.isFinite(p.totals.pnlPct)).toBe(true);
  });

  it('un activo sin precio vale 0, no NaN', () => {
    const p = computePortfolio(holdings, { btc: 150 }, 0);
    const voo = p.byAsset.find(a => a.key === 'voo');
    expect(voo.market).toBe(0);
    expect(Number.isFinite(p.totals.market)).toBe(true);
  });

  it('un portafolio vacío no revienta', () => {
    const p = computePortfolio({}, {}, 0);
    expect(p.totals.grandTotal).toBe(0);
    expect(p.totals.pnlPct).toBe(0);
    expect(p.byAsset).toEqual([]);
  });

  it('ordena los activos por valor de mercado descendente', () => {
    const p = computePortfolio(holdings, prices, 0);
    const valores = p.byAsset.map(a => a.market);
    expect(valores).toEqual([...valores].sort((a, b) => b - a));
  });
});

describe('esEquity', () => {
  it('agrupa stock y etf, excluye crypto', () => {
    expect(esEquity('stock')).toBe(true);
    expect(esEquity('etf')).toBe(true);
    expect(esEquity('crypto')).toBe(false);
  });
});
