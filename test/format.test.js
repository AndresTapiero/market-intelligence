import { describe, it, expect } from 'vitest';
import { num, fmtUSD, fmtSigned, fmtPrice, fmtQty, fmtPct, fmtCOP, fmtCompact, signClass }
  from '../js/format.js';

describe('num', () => {
  it('limpia separadores antes de parsear', () => {
    // El bug de la fase 1: parseFloat("63,736.05") devuelve 63, no 63736.05
    expect(num('$63,736.05')).toBe(63736.05);
    expect(num('63,736.05')).toBe(63736.05);
    expect(num('$1,234,567.89')).toBe(1234567.89);
  });

  it('acepta números tal cual', () => {
    expect(num(206.83)).toBe(206.83);
    expect(num(0)).toBe(0);
  });

  it('devuelve null en vez de un número dudoso', () => {
    for (const v of ['N/A', '', '—', '$', '.', '-', null, undefined, NaN, Infinity, {}]) {
      expect(num(v)).toBeNull();
    }
  });
});

describe('formateadores', () => {
  it('fmtUSD sin decimales por defecto', () => {
    expect(fmtUSD(1234.56)).toBe('$1,235');
    expect(fmtUSD(1234.56, 2)).toBe('$1,234.56');
  });

  it('fmtSigned conserva el signo', () => {
    expect(fmtSigned(1234)).toBe('+$1,234');
    expect(fmtSigned(-1234)).toBe('-$1,234');
  });

  it('fmtPrice escala decimales según magnitud', () => {
    expect(fmtPrice(63736.05)).toBe('$63,736.05');
    expect(fmtPrice(1.5)).toBe('$1.50');
    expect(fmtPrice(0.0234)).toBe('$0.0234');
    expect(fmtPrice(0.0023)).toBe('$0.002300');
  });

  it('fmtPct pone signo en positivos y no lo duplica en negativos', () => {
    expect(fmtPct(1.44)).toBe('+1.4%');
    expect(fmtPct(-3.21)).toBe('-3.2%');
    expect(fmtPct(0)).toBe('+0.0%');
  });

  it('fmtCOP usa separador colombiano', () => {
    expect(fmtCOP(14164932)).toBe('14.164.932');
  });

  it('fmtCompact abrevia miles', () => {
    expect(fmtCompact(7244)).toBe('$7.2k');
    expect(fmtCompact(500)).toBe('$500');
  });

  it('fmtQty escala decimales', () => {
    expect(fmtQty(0.016271)).toBe('0,016271');
    expect(fmtQty(466.62)).toBe('466,62');
  });

  it('signClass distingue positivo de negativo', () => {
    expect(signClass(1)).toBe('pos');
    expect(signClass(0)).toBe('pos');
    expect(signClass(-1)).toBe('neg');
  });
});

describe('robustez ante datos ausentes', () => {
  const fns = { fmtUSD, fmtSigned, fmtPrice, fmtQty, fmtPct, fmtCOP, fmtCompact };

  it('ningún formateador devuelve NaN, undefined ni null en pantalla', () => {
    for (const [nombre, fn] of Object.entries(fns)) {
      for (const v of [null, undefined, NaN, 'basura', {}]) {
        const salida = fn(v);
        expect(typeof salida, `${nombre}(${String(v)})`).toBe('string');
        expect(salida, `${nombre}(${String(v)})`).not.toMatch(/NaN|undefined|null/);
      }
    }
  });

  it('el cero se formatea como cero, no como guion', () => {
    expect(fmtUSD(0)).toBe('$0');
    expect(fmtPct(0)).toBe('+0.0%');
    expect(fmtCOP(0)).toBe('0');
  });
});
