import { describe, it, expect } from 'vitest';
import { monthlyHistory } from '../js/portfolio-model.js';

const reporte = (fecha, total, pnl, pnlPct, extra = {}) => ({
  report_date: fecha,
  portfolio_snapshot: { total, pnl, pnlPct, cash: 100, totalCrypto: 0, totalStocks: 0, ...extra },
});

describe('monthlyHistory', () => {
  it('devuelve una fila por reporte con su propio P&L', () => {
    const filas = monthlyHistory([reporte('2026-08-27', 2847, 412, 16.9)]);
    expect(filas).toHaveLength(1);
    expect(filas[0].total).toBe(2847);
    expect(filas[0].pnl).toBe(412);
    expect(filas[0].pnlPct).toBe(16.9);
  });

  it('ordena por fecha descendente sin asumir el orden de entrada', () => {
    const filas = monthlyHistory([
      reporte('2026-07-20', 2435, 180, 8.0),
      reporte('2026-08-27', 2847, 412, 16.9),
    ]);
    expect(filas[0].reportDate).toBe('2026-08-27');
    expect(filas[1].reportDate).toBe('2026-07-20');
  });

  it('calcula el delta contra el mes anterior, no contra el costo', () => {
    const filas = monthlyHistory([
      reporte('2026-08-27', 2847, 412, 16.9),
      reporte('2026-07-20', 2435, 180, 8.0),
    ]);
    expect(filas[0].deltaVsMesAnterior).toBe(2847 - 2435);
    expect(filas[1].deltaVsMesAnterior).toBeNull();   // no hay uno más viejo
  });

  it('el primer reporte histórico no tiene delta', () => {
    const filas = monthlyHistory([reporte('2026-08-27', 2847, 412, 16.9)]);
    expect(filas[0].deltaVsMesAnterior).toBeNull();
  });

  it('un reporte sin pnl guardado muestra null, no revienta', () => {
    const filas = monthlyHistory([reporte('2026-08-11', 2255, undefined, undefined)]);
    expect(filas[0].pnl).toBeNull();
    expect(filas[0].pnlPct).toBeNull();
    expect(filas[0].total).toBe(2255);   // el total sí está y sí se muestra
  });

  it('descarta un reporte sin total (dato corrupto o vacío)', () => {
    const filas = monthlyHistory([
      { report_date: '2026-08-01', portfolio_snapshot: {} },
      reporte('2026-08-27', 2847, 412, 16.9),
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].reportDate).toBe('2026-08-27');
  });

  it('tolera un historial vacío o ausente', () => {
    expect(monthlyHistory([])).toEqual([]);
    expect(monthlyHistory(undefined)).toEqual([]);
    expect(monthlyHistory(null)).toEqual([]);
  });

  it('una perdida se refleja con pnl negativo, no como texto raro', () => {
    const filas = monthlyHistory([reporte('2026-08-27', 1800, -300, -14.3)]);
    expect(filas[0].pnl).toBe(-300);
    expect(filas[0].pnlPct).toBe(-14.3);
  });
});
