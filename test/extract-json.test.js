import { describe, it, expect } from 'vitest';
import { extractAnalysisJSON } from '../analyze.js';

const json = { assets: [{ ticker: 'btc', price: 80473 }], actions: [] };

describe('extractAnalysisJSON', () => {
  it('ignora el texto suelto previo a las búsquedas (el bug del primer bloque)', () => {
    const content = [
      { type: 'text', text: 'Voy a buscar los precios actuales.' },
      { type: 'server_tool_use', name: 'web_search', input: {} },
      { type: 'web_search_tool_result', content: [] },
      { type: 'text', text: JSON.stringify(json) },
    ];
    expect(extractAnalysisJSON(content)).toEqual(json);
  });

  it('une el JSON partido en varios bloques por citas', () => {
    const s = JSON.stringify(json);
    const content = [
      { type: 'web_search_tool_result', content: [] },
      { type: 'text', text: s.slice(0, 10) },
      { type: 'text', text: s.slice(10) },
    ];
    expect(extractAnalysisJSON(content)).toEqual(json);
  });

  it('funciona sin búsquedas y con thinking antes', () => {
    const content = [{ type: 'thinking', thinking: '...' }, { type: 'text', text: JSON.stringify(json) }];
    expect(extractAnalysisJSON(content)).toEqual(json);
  });

  it('rescata el JSON si viene rodeado de texto', () => {
    const content = [{ type: 'text', text: `Aquí está:\n${JSON.stringify(json)}\nListo.` }];
    expect(extractAnalysisJSON(content)).toEqual(json);
  });

  it('da un error legible si no hay JSON', () => {
    expect(() => extractAnalysisJSON([{ type: 'text', text: 'no pude buscar' }])).toThrow(/no es JSON válido.*no pude buscar/);
    expect(() => extractAnalysisJSON([{ type: 'web_search_tool_result' }])).toThrow(/sin bloque de texto/);
  });
});
