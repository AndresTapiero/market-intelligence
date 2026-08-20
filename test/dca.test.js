import { describe, it, expect } from 'vitest';
import { dcaStatus, proximaFecha, upcomingEvents, DCA_TARGETS } from '../js/portfolio-model.js';

const HOY = new Date(2026, 7, 20);   // 20 de agosto de 2026

const compra = (ticker, monto, fecha) =>
  ({ ticker, inversion_monto: monto, numero_acciones: 1, precio_entrada: monto, fecha, fecha_venta: null });

describe('dcaStatus', () => {
  it('marca cumplido cuando el mes ya llegó al objetivo', () => {
    const [btc] = dcaStatus([compra('BTC', 50, '2026-08-05')], HOY);
    expect(btc.completo).toBe(true);
    expect(btc.invertido).toBe(50);
    expect(btc.falta).toBe(0);
  });

  it('marca parcial cuando puso algo pero no lo suficiente', () => {
    const [btc] = dcaStatus([compra('BTC', 20, '2026-08-05')], HOY);
    expect(btc.completo).toBe(false);
    expect(btc.parcial).toBe(true);
    expect(btc.falta).toBe(30);
  });

  it('sin compras el mes está pendiente', () => {
    const [btc] = dcaStatus([], HOY);
    expect(btc.invertido).toBe(0);
    expect(btc.parcial).toBe(false);
    expect(btc.falta).toBe(50);
  });

  it('ignora las compras de meses anteriores', () => {
    const [btc] = dcaStatus([compra('BTC', 50, '2026-07-05')], HOY);
    expect(btc.invertido).toBe(0);
  });

  it('ignora las compras futuras', () => {
    const [btc] = dcaStatus([compra('BTC', 50, '2026-08-28')], HOY);
    expect(btc.invertido).toBe(0);
  });

  it('acumula varias compras del mismo mes', () => {
    const [btc] = dcaStatus([
      compra('BTC', 20, '2026-08-03'),
      compra('BTC', 35, '2026-08-14'),
    ], HOY);
    expect(btc.invertido).toBe(55);
    expect(btc.completo).toBe(true);
  });

  it('el DCA de acciones suma VOO y QQQ juntos', () => {
    const [, stocks] = dcaStatus([
      compra('VOO', 25, '2026-08-04'),
      compra('QQQ', 25, '2026-08-04'),
    ], HOY);
    expect(stocks.invertido).toBe(50);
    expect(stocks.completo).toBe(true);
  });

  it('una compra de otro activo no cuenta para el DCA', () => {
    const [btc, stocks] = dcaStatus([compra('IREN', 50, '2026-08-20')], HOY);
    expect(btc.invertido).toBe(0);
    expect(stocks.invertido).toBe(0);
  });

  it('las ventas no cuentan como aporte', () => {
    const v = { ...compra('BTC', 50, '2026-08-05'), fecha_venta: '2026-08-05' };
    expect(dcaStatus([v], HOY)[0].invertido).toBe(0);
  });

  it('cae a cantidad × precio si falta inversion_monto', () => {
    const sinMonto = { ticker: 'BTC', numero_acciones: 2, precio_entrada: 30, fecha: '2026-08-05', fecha_venta: null };
    expect(dcaStatus([sinMonto], HOY)[0].invertido).toBe(60);
  });

  it('devuelve una entrada por objetivo configurado', () => {
    expect(dcaStatus([], HOY)).toHaveLength(DCA_TARGETS.length);
  });
});

describe('proximaFecha', () => {
  it('si el día del mes aún no pasó, es este mes', () => {
    const f = proximaFecha(30, HOY, false);
    expect(f.getMonth()).toBe(7);     // agosto
    expect(f.getDate()).toBe(30);
  });

  it('si el día ya pasó, salta al mes siguiente', () => {
    const f = proximaFecha(1, HOY, false);
    expect(f.getMonth()).toBe(8);     // septiembre
    expect(f.getDate()).toBe(1);
  });

  it('si ya está cumplido, salta al mes siguiente aunque el día no haya pasado', () => {
    const f = proximaFecha(30, HOY, true);
    expect(f.getMonth()).toBe(8);
  });

  it('recorta el día al último real del mes', () => {
    // 30 de febrero no existe: debe caer en el 28
    const f = proximaFecha(30, new Date(2026, 1, 1), false);
    expect(f.getMonth()).toBe(1);
    expect(f.getDate()).toBe(28);
  });
});

describe('upcomingEvents', () => {
  const dca = dcaStatus([], HOY);

  it('mezcla eventos de DCA y de mercado, ordenados por fecha', () => {
    const ev = upcomingEvents(dca, [
      { fecha: '2026-09-17', tipo: 'fed', texto: 'Decisión FED' },
      { fecha: '2026-08-25', tipo: 'earnings', texto: 'Earnings NVDA' },
    ], HOY);
    const fechas = ev.map(e => +e.fecha);
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));
    expect(ev.some(e => e.tipo === 'dca')).toBe(true);
    expect(ev.some(e => e.tipo === 'fed')).toBe(true);
  });

  it('descarta los eventos ya pasados', () => {
    const ev = upcomingEvents([], [
      { fecha: '2026-06-18', tipo: 'fed', texto: 'FED de junio' },
    ], HOY);
    expect(ev).toHaveLength(0);
  });

  it('respeta el límite', () => {
    const muchos = Array.from({ length: 20 }, (_, i) =>
      ({ fecha: `2026-09-${String(i + 1).padStart(2, '0')}`, tipo: 'x', texto: `E${i}` }));
    expect(upcomingEvents(dca, muchos, HOY, 5)).toHaveLength(5);
  });

  it('tolera fechas inválidas y listas ausentes', () => {
    expect(() => upcomingEvents(dca, [{ fecha: 'no-es-fecha', texto: 'x' }], HOY)).not.toThrow();
    expect(upcomingEvents(dca, null, HOY).length).toBeGreaterThan(0);
    expect(upcomingEvents(undefined, undefined, HOY)).toEqual([]);
  });

  it('incluye el evento de hoy mismo', () => {
    const ev = upcomingEvents([], [{ fecha: '2026-08-20', tipo: 'x', texto: 'Hoy' }], HOY);
    expect(ev).toHaveLength(1);
  });
});
