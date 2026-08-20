// data.js — Margen de seguridad por activo
// Classic script (not a module) — loaded with <script src defer>
//
// EXISTING_ASSETS, ASSET_DATA y ASSET_COLORS ya NO viven aquí: son una sola
// definición en js/baseline.js, que app.js importa y publica en window antes
// de DOMContentLoaded. Ver el comentario de cabecera de ese archivo.

// Margen de seguridad (solo acciones/ETFs con flujo de caja, no cripto).
const VALUATIONS = {
  // voo: { lynch: 0, consenso: 0, propio: 0 },
  // nvda: { lynch: 0, consenso: 0, propio: 0 },
};
window.VALUATIONS = VALUATIONS;
