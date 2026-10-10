import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { spliceResumen } from '../analyze.js';

const shell = readFileSync(new URL('../tabs/resumen.html', import.meta.url), 'utf8');
const meta = { today: 'lunes, 1 de octubre de 2026', monthYear: 'octubre de 2026' };
const sections = {
  analyst:   '<article class="analyst-card">NUEVO ANALISIS</article>',
  decisions: '<div class="decision-card mb">NUEVAS DECISIONES</div>',
  opps:      '<div class="opp-grid mb">NUEVAS OPPS</div>',
};

describe('spliceResumen', () => {
  it('reemplaza las secciones del reporte y la fecha', () => {
    const out = spliceResumen(shell, sections, meta);
    expect(out).toContain('NUEVO ANALISIS');
    expect(out).toContain('NUEVAS DECISIONES');
    expect(out).toContain('NUEVAS OPPS');
    expect(out).toContain('lunes, 1 de octubre de 2026');
    expect(out).toContain('octubre de 2026</div>');
  });

  it('conserva la gráfica, el historial mensual y los ids que llena la app', () => {
    const out = spliceResumen(shell, sections, meta);
    for (const id of ['chartSvgWrap', 'monthHistory', 'chartCurrentVal', 'resumeTotal', 'resumeMarket', 'resumePnl', 'scoreItems']) {
      expect(out).toContain(`id="${id}"`);
    }
  });

  it('es idempotente: correrlo dos veces da lo mismo', () => {
    const una = spliceResumen(shell, sections, meta);
    expect(spliceResumen(una, sections, meta)).toBe(una);
  });

  it('falla fuerte, sin devolver HTML roto, si falta un marcador', () => {
    const roto = shell.replace('<!--REPORT:opps-->', '');
    expect(() => spliceResumen(roto, sections, meta)).toThrow(/REPORT:opps/);
  });
});
