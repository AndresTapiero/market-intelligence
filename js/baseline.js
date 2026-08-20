// baseline.js — Fuente de verdad ÚNICA de las posiciones de partida.
//
// Antes esto vivía en tres sitios que ya habían divergido:
//   - js/data.js  → EXISTING_ASSETS  (cantidades y costo promedio)
//   - js/data.js  → ASSET_DATA       (label, icono, precio, tipo)
//   - analyze.js  → BASELINE         (su propia copia, sin META ni IREN,
//                                     y con VOO/QQQ como 'stock' en vez de 'etf')
//
// Ese desacuerdo hacía que el dashboard y el reporte mensual calcularan la
// asignación objetivo (ETFs 30% / Acciones 25%) sobre clasificaciones distintas.
//
// Es un módulo ES, no JSON, por dos razones:
//   1. Los módulos se ejecutan ANTES de DOMContentLoaded, así que app.js puede
//      poblar los globals de forma síncrona. Un fetch de JSON llegaría tarde:
//      tab-loader.js pinta el Resumen en DOMContentLoaded y se vería un
//      parpadeo de ceros.
//   2. analyze.js (Node) lo importa igual, sin leer ni parsear archivos.
//
// `qty` y `costAvg` son la posición ANTERIOR a la app. Todo lo registrado desde
// el modal vive en inv_journal y se aplica encima (ver applyJournal / el sync).
// Un activo comprado desde la app va aquí con qty 0 — sólo aporta metadatos.
//
// `seedPrice` es el último precio conocido, usado como valor de arranque hasta
// que Supabase entrega el precio real del reporte. No es un dato de mercado.

export const BASELINE = {
  // ── Crypto ────────────────────────────────────────────────────────────────
  btc:     { qty: 0.016271, costAvg: 76370.002869, type: 'crypto', label: 'Bitcoin',   icon: '₿', color: '#f7931a', seedPrice: 63736.05 },
  eth:     { qty: 0.1736,   costAvg: 2532.66,      type: 'crypto', label: 'Ethereum',  icon: 'Ξ', color: '#627eea', seedPrice: 1868.43  },
  sol:     { qty: 4.179,    costAvg: 173.74,       type: 'crypto', label: 'Solana',    icon: '◎', color: '#9945ff', seedPrice: 73.32    },
  tao:     { qty: 0.7369,   costAvg: 350.93,       type: 'crypto', label: 'Bittensor', icon: 'τ', color: '#38bdf8', seedPrice: 190.52   },
  uni:     { qty: 30.68,    costAvg: 9.191,        type: 'crypto', label: 'Uniswap',   icon: 'U', color: '#ff007a', seedPrice: 3.86     },
  bnb:     { qty: 0.1075,   costAvg: 673,          type: 'crypto', label: 'BNB',       icon: 'B', color: '#f3ba2f', seedPrice: 592.23   },
  sui:     { qty: 60.86,    costAvg: 3.688,        type: 'crypto', label: 'SUI',       icon: 'S', color: '#6fbcf0', seedPrice: 1.85     },
  sei:     { qty: 466.62,   costAvg: 0.2916,       type: 'crypto', label: 'SEI',       icon: 's', color: '#e84142', seedPrice: 0.19     },
  ena:     { qty: 249.59,   costAvg: 0.2802,       type: 'crypto', label: 'Ethena',    icon: 'E', color: '#00d4ff', seedPrice: 0.28     },
  avax:    { qty: 2.428,    costAvg: 18.93,        type: 'crypto', label: 'Avalanche', icon: 'A', color: '#e84142', seedPrice: 6.87     },
  giga:    { qty: 873.2,    costAvg: 0.06385,      type: 'crypto', label: 'GIGA',      icon: 'G', color: '#00d4ff', seedPrice: 0.0023   },
  trump:   { qty: 1.151,    costAvg: 36.07,        type: 'crypto', label: 'TRUMP',     icon: 'T', color: '#8250ff', seedPrice: 1.48     },
  spx6900: { qty: 37.87,    costAvg: 1.149,        type: 'crypto', label: 'SPX6900',   icon: 'S', color: '#00d4a0', seedPrice: 0.35     },

  // ── ETFs ──────────────────────────────────────────────────────────────────
  // Son 'etf', no 'stock': analyze.js los tenía mal y por eso la asignación
  // objetivo no cuadraba entre el dashboard y el reporte.
  voo:     { qty: 0.36947,  costAvg: 508.99,       type: 'etf',    label: 'VOO',       icon: 'V', color: '#00d4a0', seedPrice: 696.41   },
  qqq:     { qty: 0.15618,  costAvg: 533.7,        type: 'etf',    label: 'QQQ',       icon: 'Q', color: '#4d8fff', seedPrice: 612.35   },

  // ── Acciones ──────────────────────────────────────────────────────────────
  nvda:    { qty: 1.10855,  costAvg: 119.11,       type: 'stock',  label: 'NVIDIA',    icon: 'N', color: '#76b900', seedPrice: 206.83   },
  // Compradas desde la app: qty 0 en el baseline, la posición real sale del journal.
  meta:    { qty: 0,        costAvg: 0,            type: 'stock',  label: 'META',      icon: 'M', color: '#0081fb', seedPrice: 586.21   },
  iren:    { qty: 0,        costAvg: 0,            type: 'stock',  label: 'IREN',      icon: 'I', color: '#ff6b35', seedPrice: 42.04    },
};

/** Posiciones de partida: clave → {qty, costAvg, type, label, fundamento}. */
export function buildHoldings() {
  const out = {};
  for (const [key, a] of Object.entries(BASELINE)) {
    out[key] = { qty: a.qty, costAvg: a.costAvg, type: a.type, label: a.label, fundamento: '' };
  }
  return out;
}

/**
 * Metadatos de mercado por activo (lo que los renderizadores llaman ASSET_DATA).
 * `price` arranca en seedPrice y lo sobrescribe el precio real del reporte.
 */
export function buildAssetData() {
  return Object.entries(BASELINE).map(([key, a]) => ({
    ticker:  key.toUpperCase(),
    label:   a.label,
    icon:    a.icon,
    type:    a.type,
    signal:  'hold',
    price:   a.seedPrice,
    change:  '0%',
    costAvg: a.costAvg,
    current: a.seedPrice,
    invested: 0,
    actual:   0,
    delta:   '0',
    context: '—',
    class:   'asset-' + key,
  }));
}

/** Clave → color, para gráficas y badges. */
export function buildColors() {
  const out = {};
  for (const [key, a] of Object.entries(BASELINE)) out[key] = a.color;
  return out;
}
