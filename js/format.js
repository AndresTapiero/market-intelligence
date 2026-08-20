// format.js — Formateo de números para toda la app.
//
// Antes cada función definía sus propios helpers: fmtD, fmt, fmtP, fmtU,
// fmtUnit, fmtK, fmtCOP, fmtPrice, formatQty… repetidos con variaciones
// sutiles en app.js, portfolio-ui.js, sell-modal.js, ui-manager.js y cash.js.
//
// Todas las funciones toleran null, undefined y NaN: nunca devuelven "NaN"
// ni "undefined" en pantalla.

/** Convierte a número finito, o null. Puerta de entrada de todo lo demás. */
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string')  return null;
  const cleaned = v.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Monto en dólares, sin decimales por defecto: $1,234 */
export function fmtUSD(v, decimals = 0) {
  const n = num(v);
  if (n === null) return '—';
  return '$' + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
}

/** Igual que fmtUSD pero conservando el signo: -$1,234 */
export function fmtSigned(v, decimals = 0) {
  const n = num(v);
  if (n === null) return '—';
  return (n < 0 ? '-' : '+') + fmtUSD(n, decimals);
}

/**
 * Precio unitario, con decimales según magnitud. Un token a $0.0023 necesita
 * seis decimales; BTC a $63,736.05 solo dos.
 */
export function fmtPrice(v) {
  const n = num(v);
  if (n === null) return '—';
  const a = Math.abs(n);
  const dec = a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
}

/** Cantidad de unidades, con decimales según magnitud. */
export function fmtQty(v) {
  const n = num(v);
  if (n === null) return '—';
  const a = Math.abs(n);
  const dec = a >= 1000 ? 0 : a >= 1 ? 4 : 6;
  return n.toLocaleString('es-CO', { maximumFractionDigits: dec });
}

/** Porcentaje con signo: +1.4% / -3.2% */
export function fmtPct(v, decimals = 1) {
  const n = num(v);
  if (n === null) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%';
}

/** Pesos colombianos, sin decimales: 14.164.932 */
export function fmtCOP(v) {
  const n = num(v);
  if (n === null) return '—';
  return Math.round(n).toLocaleString('es-CO');
}

/** Compacto para ejes de gráficas: $1.2k */
export function fmtCompact(v) {
  const n = num(v);
  if (n === null) return '—';
  return Math.abs(n) >= 1000
    ? '$' + (n / 1000).toFixed(1) + 'k'
    : '$' + Math.round(n);
}

/** Clase CSS según signo, para pintar en verde o rojo. */
export function signClass(v) {
  const n = num(v);
  return n !== null && n >= 0 ? 'pos' : 'neg';
}
