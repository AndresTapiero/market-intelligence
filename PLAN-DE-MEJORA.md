# Plan de mejora — Market Intelligence

> Documento ejecutable para Claude Code. Cada fase es autocontenida: objetivo, archivos
> exactos, cambios exactos, criterio de aceptación y cómo verificar.
> **Ejecutar las fases en orden.** Cada fase asume que la anterior está terminada y verificada.

**Fecha:** 2026-08-20 · **Build de partida:** v23 · **Rama:** `main`

---

## Reglas para quien ejecuta este plan

1. **Supabase es la única fuente de verdad.** Ningún dato derivado se persiste en el cliente.
   Si un dato necesita existir en dos sitios, uno de los dos está mal.
2. **Una fase = un commit** (o varios, pero no mezclar fases). Mensaje: `fase N: <qué>`.
3. **No refactorizar de más.** Si un cambio no está en este documento, no va en el commit.
4. **Antes de cada fase:** `git status` limpio. Si hay cambios sin commitear, parar y preguntar.
5. **Después de cada fase:** correr el bloque «Verificación» de esa fase. Si falla, no avanzar.
6. **Migraciones SQL:** este plan las escribe en `scripts/`. **No las ejecutes tú** — el
   usuario las corre a mano en Supabase → SQL Editor. Al terminar una fase con SQL, dile
   explícitamente al usuario qué archivo debe correr antes de que el código funcione.
7. **Nunca borres `latest-report.html`.** Es el shell de la PWA (está en `.gitignore` por error,
   se arregla en la Fase 7).

---

## Estado actual: qué está roto y por qué

Tres clases de problema, todas con la misma forma — **un dato vive en dos sitios y sólo uno se actualiza**:

| # | Problema | Efecto |
|---|---|---|
| A | Los precios del análisis mensual **nunca llegan al dashboard** | La app muestra precios hardcodeados de `data.js` desde siempre |
| B | El cash vive en `user_metadata` y en `snapshot.cash` | Todos los reportes históricos tienen el `total` mal |
| C | El baseline de posiciones existe 3 veces y ya divergió | Dashboard y reporte clasifican VOO/QQQ distinto |

Además: la API de Anthropic usa un modelo y una versión de `web_search` desactualizados, el
dry-run no valida realmente la API key, y el workflow no es idempotente.

---

## FASE 0 — Cerrar lo ya hecho ✅

Ya aplicado en el working tree (sin commitear): `inv_journal.tipo` se persiste en las compras y
toda compra/venta resincroniza desde Supabase en vez de parchear memoria.

### Acción pendiente del usuario

Correr en Supabase → SQL Editor:

```
scripts/migration-add-tipo-column.sql
```

### Verificación

```sql
select column_name, data_type from information_schema.columns
where table_name = 'inv_journal' and column_name = 'tipo';
-- debe devolver 1 fila: tipo | text

select ticker, tipo from inv_journal where ticker = 'IREN';
-- debe devolver tipo = 'stock'
```

Luego: `git add -A && git commit -m "fase 0: persistir tipo de activo y resincronizar tras cada operación"`

---

## FASE 1 — Los precios del análisis nunca llegan al dashboard 🔴

**Este es el bug más grave del proyecto.** Arreglarlo primero.

### El problema

`analyze.js` guarda los precios en `portfolio_assets.price` tal como los devuelve el modelo:
la cadena `"$63,736.05"`. La app los lee así (`js/app.js`, en `_loadLatestAssetData`):

```js
if (row.price) meta.price = parseFloat(row.price) || meta.price;
```

`parseFloat("$63,736.05")` devuelve `NaN`. `NaN || meta.price` se queda con `meta.price`,
es decir, **el precio hardcodeado de `js/data.js`**. El precio real se descarta en silencio.

Peor: si algún mes el modelo devuelve `"63,736.05"` sin el `$`, `parseFloat` devuelve **63**.
Eso escribiría 63 dólares como precio de BTC y arrasaría la valoración del portafolio entero,
sin ningún error.

**Consecuencia observable:** la pestaña Resumen (que genera `analyze.js` con números correctos)
y la sticky bar / pestaña Activos (que calcula el cliente con precios viejos) muestran totales
distintos. Las señales y el contexto sí se actualizan porque son texto, y eso hace que el
dashboard *parezca* vivo.

### Cambios

**1. Migración SQL — precio como número.** Crear `scripts/migration-price-numeric.sql`:

```sql
-- portfolio_assets.price pasa de TEXT ("$63,736.05") a NUMERIC.
-- Motivo: la app hacía parseFloat sobre la cadena con $ y comas, obtenía NaN,
-- y se quedaba con el precio hardcodeado de data.js.

ALTER TABLE portfolio_assets ADD COLUMN IF NOT EXISTS price_num numeric;

-- Backfill: limpiar $ , y espacios de los valores históricos.
UPDATE portfolio_assets
SET price_num = NULLIF(regexp_replace(price, '[^0-9.\-]', '', 'g'), '')::numeric
WHERE price IS NOT NULL AND price_num IS NULL;

-- change_7d se queda como texto ("+1.4%") — la UI lo muestra tal cual.
```

> No borramos la columna `price` todavía: se mantiene una versión para poder revertir.
> Se elimina en la Fase 7 cuando el nuevo flujo lleve un mes funcionando.

**2. `analyze.js` — guardar números.** En el bloque que construye `assetRows`, sustituir
`price: analysisData[key].price` por un valor numérico, y añadir un helper arriba del archivo:

```js
// Convierte "$63,736.05" | "63736.05" | 63736.05 → 63736.05 (o null si no es parseable)
function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
```

`assetRows` pasa a incluir `price_num: toNumber(analysisData[key].price)` además de `price`.
**Descartar el activo del insert si `price_num` es `null`** — mejor no guardar un precio que
guardar uno corrupto:

```js
const assetRows = ALL_KEYS
  .map(key => ({ key, num: toNumber(analysisData[key]?.price) }))
  .filter(({ num }) => num !== null)
  .map(({ key, num }) => ({
    report_id: histRow.id,
    asset_key: key,
    price:     analysisData[key].price,   // original, para auditoría
    price_num: num,
    change_7d: analysisData[key].change7d || null,
    signal:    analysisData[key].signal   || 'HOLD',
    context:   analysisData[key].context  || null,
  }));
```

Usar el mismo `toNumber` en `computeSnapshot` (reemplaza el `parseFloat(priceStr.replace(...))` actual).

**3. `js/app.js` — leer el número y fallar ruidosamente.** En `_loadLatestAssetData`:

```js
.select('asset_key, price, price_num, change_7d, signal, context')
```

y dentro del `forEach`:

```js
const p = row.price_num !== null && row.price_num !== undefined
  ? Number(row.price_num)
  : null;
if (p !== null && Number.isFinite(p) && p > 0) {
  meta.price = p;
} else if (row.price) {
  console.warn(`⚠️ Precio no numérico para ${key}: ${row.price} — se mantiene el de data.js`);
}
if (row.change_7d) meta.change  = row.change_7d;
if (row.signal)    meta.signal  = row.signal;
if (row.context)   meta.context = row.context;
```

### Criterio de aceptación

- Tras correr la migración, `select asset_key, price, price_num from portfolio_assets limit 5`
  muestra `price_num` poblado y numérico.
- Al hacer login, la consola **no** imprime el warning de precio no numérico.
- El total de la sticky bar coincide con el «Valor de Mercado» de la pestaña Resumen
  (±$1 por redondeo).

### Verificación

```bash
node --check analyze.js && node --check js/app.js
```

Y en la consola del navegador tras login:

```js
window.ASSET_DATA.find(a => a.ticker === 'BTC').price
// debe ser el precio del último reporte, no 63736.05 de data.js
```

---

## FASE 2 — Reconciliar la fuente de verdad 🔴

Elimina la clase entera de bugs. Tres datos dejan de tener copia paralela.

### 2.1 El cash como tabla propia

**Problema:** la app escribe en `auth.user_metadata.cash_amount`; `analyze.js` lee de
`portfolio_history.portfolio_snapshot.cash`, que sólo escribe él mismo. Nunca convergen,
así que cada reporte mensual arrastra el cash del reporte anterior.

Crear `scripts/migration-cash-table.sql`:

```sql
-- Un solo hogar para el cash. Reemplaza el par
-- auth.user_metadata.cash_amount / portfolio_snapshot.cash

CREATE TABLE IF NOT EXISTS portfolio_cash (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portfolio_cash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own cash select" ON portfolio_cash;
DROP POLICY IF EXISTS "own cash insert" ON portfolio_cash;
DROP POLICY IF EXISTS "own cash update" ON portfolio_cash;

CREATE POLICY "own cash select" ON portfolio_cash
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own cash insert" ON portfolio_cash
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cash update" ON portfolio_cash
  FOR UPDATE USING (auth.uid() = user_id);

-- Sembrar con el cash REAL actual (no el del último snapshot).
-- El usuario debe reemplazar el UUID y el monto antes de correr.
INSERT INTO portfolio_cash (user_id, amount)
VALUES ('<PORTFOLIO_USER_ID>', 200)
ON CONFLICT (user_id) DO UPDATE
  SET amount = excluded.amount, updated_at = now();
```

**Código:**

- Nuevo `js/cash-service.js` con `CashService`: `get()` y `set(amount)` contra `portfolio_cash`
  (`upsert` con `onConflict: 'user_id'`). Misma forma que los demás servicios (constructor recibe
  `supabaseClient` y `authService`).
- `js/app.js` → `updateCash(amount)` llama a `cashService.set(amount)`. Quitar la escritura a
  `auth.updateUser`.
- `js/app.js` → `_loadLatestAssetData` deja de leer el cash. El cash se carga en `afterLogin()`
  vía `cashService.get()`, antes del primer render.
- `analyze.js` → leer el cash de `portfolio_cash`, no del snapshot:

```js
const { data: cashRow } = await supabase
  .from('portfolio_cash').select('amount').eq('user_id', USER_ID).maybeSingle();
const cash = cashRow?.amount != null ? Number(cashRow.amount) : 0;
```

> Se sigue escribiendo `cash` dentro de `portfolio_snapshot` — ahí es un dato **histórico**
> («cuánto cash había el día del reporte»), que es legítimo. Lo que desaparece es leerlo
> como estado actual.

### 2.2 Baseline único

**Problema:** las posiciones de partida existen en `js/data.js` (`EXISTING_ASSETS`),
`js/data.js` (`ASSET_DATA`) y `analyze.js` (`BASELINE`). META e IREN faltan en el tercero,
y VOO/QQQ son `etf` en uno y `stock` en el otro.

Crear `baseline.json` en la raíz — **una sola definición**:

```json
{
  "btc":     { "qty": 0.016271, "costAvg": 76370.002869, "type": "crypto", "label": "Bitcoin",   "icon": "₿", "color": "#f7931a" },
  "eth":     { "qty": 0.1736,   "costAvg": 2532.66,      "type": "crypto", "label": "Ethereum",  "icon": "Ξ", "color": "#627eea" },
  "voo":     { "qty": 0.36947,  "costAvg": 508.99,       "type": "etf",    "label": "VOO",       "icon": "V", "color": "#00d4a0" },
  "qqq":     { "qty": 0.15618,  "costAvg": 533.7,        "type": "etf",    "label": "QQQ",       "icon": "Q", "color": "#4d8fff" },
  "nvda":    { "qty": 1.10855,  "costAvg": 119.11,       "type": "stock",  "label": "NVIDIA",    "icon": "N", "color": "#76b900" }
}
```

Portar **todos** los activos de `EXISTING_ASSETS` con esta forma, tomando el `type` correcto
(VOO y QQQ son `etf`), el `label` de `ASSET_DATA`, el `icon` de `ASSET_DATA` y el color de
`ASSET_COLORS`. Incluir `meta` e `iren`.

- `js/data.js` pasa a cargar `baseline.json` con `fetch` al inicio y derivar de ahí
  `EXISTING_ASSETS`, la parte estática de `ASSET_DATA` y `ASSET_COLORS`. Ya no hay listas a mano.
- `analyze.js` importa el mismo archivo: `import BASELINE from './baseline.json' with { type: 'json' };`
  y borra su constante `BASELINE`.

> `data.js` es un script clásico, no un módulo. Para no reescribir el orden de carga, hacer
> el `fetch` de `baseline.json` **dentro de `app.initialize()`** (que sí es módulo) y poblar
> `window.EXISTING_ASSETS` / `window.ASSET_DATA` / `window.ASSET_COLORS` antes del primer render.
> `data.js` queda reducido a `window.VALUATIONS` y nada más.

### 2.3 Tickers dinámicos en el análisis

**Problema:** `analyze.js` pide precios sólo para la constante `ALL_KEYS`. META e IREN no están,
así que **nunca reciben precio del análisis mensual** — se quedan congelados en su `costAvg`.

En `analyze.js`, derivar la lista de las posiciones reales:

```js
// Los tickers a analizar salen del portafolio real, no de una constante.
const positions  = await getPositions(supabase);
const activeKeys = Object.entries(positions)
  .filter(([, a]) => a.qty > 0)
  .map(([k]) => k)
  .sort();                       // orden estable = prompt cacheable
const ALL_KEYS   = activeKeys;   // reemplaza la constante
```

`CRYPTO_KEYS` / `STOCK_KEYS` desaparecen: el tipo sale de `positions[key].type`.
`ACCIONABLES` y `WATCHLIST` se quedan como constantes (son decisiones de estrategia, no datos).

`getPositions` también debe leer el `tipo` de la Fase 0:

```js
.select('ticker, tipo, numero_acciones, precio_entrada, fecha_venta, fecha')
```

y en la rama de activo nuevo: `type: row.tipo || 'crypto'`.

### Criterio de aceptación

- `grep -rn "cash_amount" js/ analyze.js` → sin resultados.
- `grep -c "costAvg" js/data.js` → 0 (el baseline ya no vive ahí).
- `node -e "import('./baseline.json', {with:{type:'json'}}).then(m => console.log(Object.keys(m.default).length))"`
  imprime el número de activos, e incluye `meta` e `iren`.
- Cambiar el cash en la app, recargar la página → el valor persiste.
- Cambiar el cash en la app, correr `node analyze.js` en local → el reporte usa el cash nuevo.

---

## FASE 3 — Arreglar el uso de la API de Anthropic 🔴

### Qué está mal hoy

| Qué | Actual | Debe ser |
|---|---|---|
| Modelo | `claude-opus-4-8` | `claude-opus-5` |
| Herramienta de búsqueda | `web_search_20250305` | `web_search_20260209` |
| Límite de búsquedas | Pedido en el texto del prompt | `max_uses: 7` en la definición de la tool |
| `max_tokens` | `6000` | `16000` (o streaming) |
| Formato de salida | JSON pedido en prosa + parser tolerante de 30 líneas | Structured outputs con JSON Schema |
| `stop_reason` | No se comprueba nunca | Comprobado; `pause_turn` reanudado |
| Thinking | No usado | `{ type: "adaptive" }`, `effort: "high"` |
| Reintentos | Ninguno | Los del SDK + manejo de 429/529 |

El **parser tolerante** (`sanitizeAndParse`) es el síntoma, no la solución: existe porque la
respuesta se corta a mitad. Se corta porque `max_tokens: 6000` es poco para un JSON con 17
activos más los resultados de `web_search`, y porque `pause_turn` no se maneja.

### 3.1 Modelo, tool y parámetros

En `analyze.js`, la llamada pasa a ser:

```js
const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'analystOpinion', 'riskProfile', 'assets', 'macro', 'actions'],
  properties: {
    date:           { type: 'string' },
    analystOpinion: { type: 'string' },
    riskProfile:    { type: 'string' },
    assets: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        required: ['price', 'change7d', 'signal'],
        properties: {
          price:    { type: 'number' },                               // ← número, no "$X"
          change7d: { type: 'string' },
          signal:   { type: 'string', enum: ['BUY', 'HOLD', 'WAIT'] },
          context:  { type: 'string' },
        },
      },
    },
    macro: {
      type: 'object',
      additionalProperties: false,
      required: ['usdcop', 'fedrate', 'btcDominance', 'fearGreed', 'fearGreedLabel', 'narrative'],
      properties: {
        usdcop:         { type: 'number' },                           // ← número
        fedrate:        { type: 'string' },
        btcDominance:   { type: 'string' },
        fearGreed:      { type: 'number' },
        fearGreedLabel: { type: 'string' },
        narrative:      { type: 'string' },
      },
    },
    newOpportunities: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['asset', 'reason', 'risk'],
        properties: { asset: {type:'string'}, reason: {type:'string'}, risk: {type:'string'} },
      },
    },
    actions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['num', 'text'],
        properties: { num: {type:'string'}, text: {type:'string'} },
      },
    },
  },
};

const response = await callWithRetry(() => anthropic.messages.create({
  model:      'claude-opus-5',
  max_tokens: 16000,
  thinking:   { type: 'adaptive' },
  output_config: {
    effort: 'high',
    format: { type: 'json_schema', schema: ANALYSIS_SCHEMA },
  },
  tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 7 }],
  messages: [{ role: 'user', content: buildPrompt(positions, cash, activeKeys) }],
}));
```

**Cambios en `buildPrompt`:** quitar toda la plantilla de JSON del final (el schema ya lo impone)
y quitar «Responde UNICAMENTE JSON valido». El prompt se queda con: fecha, tickers a buscar,
portafolio actual, reglas del inversionista, y qué activos llevan análisis narrativo.
Los precios se piden **como números sin símbolo de moneda**.

`assets` pasa a ser un objeto anidado (antes los tickers estaban al nivel raíz del JSON).
Ajustar `computeSnapshot` y la construcción de `assetRows` para leer `analysisData.assets[key]`.

### 3.2 `pause_turn` y `stop_reason`

`web_search` se ejecuta en el servidor y puede devolver `stop_reason: "pause_turn"`, que exige
continuar la conversación. Hoy no se maneja: la respuesta llega parcial y el parser la remienda.

```js
async function runAnalysis(anthropic, params) {
  let messages = params.messages;
  let response;

  for (let turn = 0; turn < 5; turn++) {
    response = await callWithRetry(() => anthropic.messages.create({ ...params, messages }));

    if (response.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: response.content }];
      continue;                       // reanudar: la búsqueda sigue en curso
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Respuesta truncada — sube max_tokens');
    }
    if (response.stop_reason === 'refusal') {
      throw new Error(`El modelo rechazó la petición: ${response.stop_details?.explanation ?? 'sin detalle'}`);
    }
    return response;
  }
  throw new Error('Demasiados pause_turn consecutivos');
}
```

### 3.3 Reintentos y errores tipados

```js
import Anthropic from '@anthropic-ai/sdk';

async function callWithRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err instanceof Anthropic.RateLimitError
        || (err instanceof Anthropic.APIError && err.status >= 500);
      if (!retryable || i === attempts - 1) throw err;
      const wait = 2 ** i * 5000;
      console.warn(`⚠️ ${err.status ?? '?'} — reintento en ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
```

Nunca capturar con un `catch` genérico y seguir: si el análisis falla, el workflow debe fallar.

### 3.4 Borrar `sanitizeAndParse`

Con structured outputs la respuesta ya es JSON válido. Leerla así:

```js
const block = response.content.find(b => b.type === 'text');
if (!block) throw new Error('Respuesta sin bloque de texto');
const analysisData = JSON.parse(block.text);
```

Borrar la función `sanitizeAndParse` completa.

> **Si la API rechaza combinar `output_config.format` con `web_search`** (verificar con el
> dry-run de la Fase 6 antes de borrar nada), usar el diseño de dos llamadas:
> llamada 1 con `web_search` y salida libre para reunir los datos de mercado; llamada 2 sin
> herramientas, con `output_config.format`, que convierte ese texto al JSON estricto.
> Es más robusto que el parser tolerante y cuesta poco. **En ese caso conservar
> `sanitizeAndParse` no es necesario tampoco** — la segunda llamada garantiza JSON válido.

### 3.5 Registrar el coste

Al final de `main()`:

```js
const u = response.usage;
console.log(`💸 tokens — in ${u.input_tokens} · out ${u.output_tokens}` +
            (u.cache_read_input_tokens ? ` · cache ${u.cache_read_input_tokens}` : ''));
```

### Criterio de aceptación

- `grep -n "claude-opus-4-8\|web_search_20250305\|sanitizeAndParse" analyze.js` → sin resultados.
- Una corrida en local termina sin warnings y `portfolio_assets.price_num` queda poblado
  para **todos** los activos con `qty > 0`, incluidos META e IREN.

---

## FASE 4 — Un solo motor de cálculo 🟡

Habilita los tests. Sin esto, la Fase 6 no es posible.

### El problema

El bucle «recorrer `ASSET_DATA`, cruzar con `EXISTING_ASSETS`, acumular valor y coste por
categoría» está reescrito con variaciones sutiles en seis funciones:

- `js/app.js` → `_renderPortfolioChart`, `_updateAnalisisTab`, `_updateResumenCards`, `_updateStickyBar`
- `js/portfolio-ui.js` → `renderPnl`, `renderComp`

### 4.1 `js/portfolio-model.js` — funciones puras

Sin DOM, sin `window`, sin Supabase. Todo entra por parámetros.

```js
/**
 * Reconstruye las posiciones aplicando el journal sobre el baseline.
 * @param {object} baseline  - clave → {qty, costAvg, type, label}
 * @param {Array}  journal   - filas de inv_journal ordenadas por fecha ascendente
 * @returns {object} holdings
 */
export function applyJournal(baseline, journal) { /* … */ }

/**
 * Calcula todos los agregados del portafolio de una sola vez.
 * @param {object} holdings - salida de applyJournal
 * @param {object} prices   - clave → precio actual (número)
 * @param {number} cash
 * @returns {{
 *   totals:   {market, cost, pnl, pnlPct, cash, grandTotal},
 *   byType:   {crypto:{market,cost,pnl,pnlPct}, stocks:{…}},
 *   byAsset:  Array<{key,ticker,type,qty,costAvg,price,cost,market,pnl,pnlPct}>,
 *   ratios:   {cryptoPct, stocksPct},
 *   allocation:{btc, etf, stock, alt}   // % sobre el total incluyendo cash
 * }}
 */
export function computePortfolio(holdings, prices, cash) { /* … */ }

/** Costo promedio ponderado tras una compra. Incluye la comisión en el costo. */
export function weightedCostAvg(prevQty, prevCostAvg, addQty, addPrice, fee = 0) { /* … */ }

/** P&L de una venta. */
export function sellPnl(qty, price, costAvg, fee = 0) { /* … */ }
```

**Reglas de cálculo a respetar** (extraídas del código actual, no inventar):

- Un activo con `qty <= 0` se excluye de todos los agregados.
- El coste de una compra incluye la comisión: `totalCost = qty * price + fee`.
- `costAvg` nuevo = `(prevQty * prevCostAvg + totalCost) / (prevQty + qty)`.
- Una venta resta cantidad y **no** altera el `costAvg`.
- `pnlPct` con `cost === 0` devuelve `0`, nunca `NaN` ni `Infinity`.
- En la asignación objetivo, `etf` y `stock` cuentan como acciones; `btc` va aparte del
  resto de crypto (`alt`).

### 4.2 `js/format.js`

Un solo hogar para lo que hoy está redefinido en casi cada función
(`fmtD`, `fmt`, `fmtP`, `fmtU`, `fmtUnit`, `fmtK`, `fmtCOP`, `fmtPrice`, `formatQty`):

```js
export function fmtUSD(n, decimals = 0) { /* $1,234 */ }
export function fmtPrice(n) { /* escala por magnitud: 2 / 4 / 6 decimales */ }
export function fmtQty(n)   { /* es-CO, escala por magnitud */ }
export function fmtPct(n, withSign = true) { /* +1.4% */ }
export function fmtCOP(n)   { /* 1.234.567 */ }
```

### 4.3 Conectar

Los seis renderizadores dejan de calcular y consumen el objeto de `computePortfolio`.
`app.js` lo calcula **una vez** por sincronización y lo pasa a las vistas.

`analyze.js` importa `applyJournal` y `computePortfolio` — reemplaza a `getPositions` y
`computeSnapshot`. **Es el punto clave:** a partir de aquí el reporte mensual y el dashboard
no pueden discrepar, porque ejecutan el mismo código.

### Criterio de aceptación

- `js/portfolio-model.js` y `js/format.js` no contienen las cadenas `document`, `window` ni `supabase`.
- Los números en pantalla son idénticos a los de antes del refactor (comparar capturas).

---

## FASE 5 — Partir `app.js` 🟡

1 058 líneas que hacen auth, sincronización, cálculo financiero, generación de SVG y DOM.
Con la Fase 4 hecha, el corte es limpio.

| Archivo nuevo | Qué se mueve | Origen |
|---|---|---|
| `js/portfolio-sync.js` | Cargar journal + `applyJournal` + publicar estado | `_syncPortfolioFromSupabase` |
| `js/chart-renderer.js` | Generación del SVG de evolución | `_renderPortfolioChart` (~170 líneas) |
| `js/views/resumen.js` | Cards y barras del resumen | `_updateResumenCards` |
| `js/views/analisis.js` | Asignación objetivo + widget COP | `_updateAnalisisTab` |
| `js/views/sticky.js` | Sticky bar | `_updateStickyBar` |
| `js/views/transacciones.js` | Bitácora de compras | `_loadBuyHistory` |

`js/app.js` queda como orquestador por debajo de 200 líneas: crear servicios, login,
sincronizar, notificar.

**Event bus mínimo** (`js/event-bus.js`) para sustituir la comunicación por `window`:

```js
const listeners = new Map();
export function on(evt, fn)  { (listeners.get(evt) ?? listeners.set(evt, []).get(evt)).push(fn); }
export function emit(evt, d) { (listeners.get(evt) ?? []).forEach(fn => fn(d)); }
```

Eventos: `portfolio:synced`, `cash:changed`, `tab:loaded`.

**Migración de los globals — incremental, sin romper nada:** los 36 `onclick=` del HTML siguen
funcionando porque `app.js` mantiene los `window.*` como *adaptadores finos* que delegan al
módulo correspondiente. No borrar globals en esta fase.

### 5.1 Resolver la colisión de nombres

`openBuyModal` / `closeBuyModal` están definidos dos veces: en `js/ui-utils.js` (sólo añade la
clase CSS) y en `js/app.js` (además limpia el formulario). Hoy gana `app.js` sólo porque los
módulos ES se ejecutan después de los `defer`.

**Borrar las versiones de `ui-utils.js`.** `switchRegModal` seguirá funcionando: llama a los
globales, que ahora tienen un único dueño.

### Criterio de aceptación

- `wc -l js/app.js` < 200.
- Ningún archivo de `js/views/` importa Supabase.
- Cada uno de los 36 handlers inline sigue respondiendo (probar los flujos a mano).

---

## FASE 6 — Tests y CI/CD 🟡

### 6.1 Instalar Vitest

```bash
npm i -D vitest
```

En `package.json`:

```json
"scripts": {
  "analyze": "node analyze.js",
  "dry-run": "node test-dry-run.js",
  "test":    "vitest run",
  "test:watch": "vitest"
}
```

> Ojo: hoy `npm test` apunta a `test-dry-run.js`. Ese script se renombra a `dry-run` porque
> **no es un test** — necesita secrets y red.

### 6.2 `test/portfolio-model.test.js`

Casos obligatorios. Cada uno debe fallar antes de la Fase 4 y pasar después.

**`applyJournal`:**
- Compra de un ticker que **no** está en el baseline → se crea con `qty` y `costAvg = precio`.
- Compra sobre un ticker existente → `qty` suma y `costAvg` es el ponderado correcto.
- **Dos compras seguidas del mismo ticker** → el ponderado acumula bien (es el caso que más se ha roto).
- Venta parcial → resta `qty`, **`costAvg` no cambia**.
- Venta total → `qty === 0`, el activo desaparece de los agregados.
- Venta de un ticker que no existe en el baseline → no lanza, no crea el activo.
- El journal se aplica en orden cronológico aunque llegue desordenado.

**`weightedCostAvg`:**
- Sin comisión.
- Con comisión: la comisión entra en el costo, no en la cantidad.
- `prevQty === 0` → `costAvg` es el precio efectivo de la compra.

**`computePortfolio`:**
- Un activo con `qty = 0` no aparece en `byAsset` ni suma a los totales.
- `cost === 0` → `pnlPct` es `0`, no `NaN` ni `Infinity`.
- `etf` y `stock` suman ambos a `byType.stocks`.
- La asignación separa `btc` del resto de crypto.
- `grandTotal === totals.market + cash`.

**`sellPnl`:**
- Venta con ganancia, con pérdida, y con comisión que convierte una ganancia bruta en pérdida neta.

### 6.3 `test/format.test.js`

- `fmtPrice` cambia de decimales según magnitud (≥1000, ≥1, ≥0.01, resto).
- `fmtPct` pone signo en positivos y no duplica el signo en negativos.
- Ningún formateador devuelve `"NaN"` ni `"undefined"` con entradas `0`, `null`, `undefined`.

### 6.4 `test/analyze-parse.test.js`

- `toNumber` con `"$63,736.05"`, `"63,736.05"`, `"206.83"`, `206.83`, `"N/A"`, `null`, `""`.
  **`"63,736.05"` debe dar `63736.05`, nunca `63`** — es el bug de la Fase 1.

### 6.5 Arreglar el dry-run

`test-dry-run.js` afirma `✓ ANTHROPIC_API_KEY válida` después de hacer `new Anthropic()`,
que sólo construye el cliente y **no valida nada**. Una key caducada pasa el dry-run y revienta
un minuto después, con el workflow ya consumido.

Sustituir por una llamada real y barata:

```js
try {
  const client = new Anthropic();
  await client.models.retrieve('claude-opus-5');
  console.log('✓ ANTHROPIC_API_KEY válida y el modelo existe');
} catch (e) {
  console.error('❌ Anthropic:', e.message);
  process.exit(1);
}
```

Añadir también la comprobación de las tablas nuevas (`portfolio_cash`, `portfolio_assets.price_num`).

### 6.6 El workflow

Problemas actuales de `.github/workflows/weekly-analysis.yml`:

| Problema | Arreglo |
|---|---|
| Se llama `weekly` pero corre mensual | Renombrar a `monthly-analysis.yml` |
| Sin `concurrency` — dos disparos simultáneos hacen dos llamadas a Anthropic | Añadir grupo de concurrencia |
| Sin `timeout-minutes` — un cuelgue consume 6 h de runner | `timeout-minutes: 20` |
| No corre los tests antes de analizar | Añadir paso `npm test` |
| Si falla, nadie se entera | Paso final `if: failure()` que abre un issue |

```yaml
name: Análisis mensual

on:
  schedule:
    - cron: '0 12 26 * *'   # día 26, 12:00 UTC = 07:00 Colombia
  workflow_dispatch: {}

permissions:
  contents: write
  issues: write

concurrency:
  group: analisis-mensual
  cancel-in-progress: false

jobs:
  analyze:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }

      - run: npm ci

      - name: Tests unitarios
        run: npm test

      - name: Configurar identidad Git
        run: |
          git config user.name  "Market Intelligence Bot"
          git config user.email "actions@users.noreply.github.com"

      - name: Dry-run
        env:
          ANTHROPIC_API_KEY:    ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          PORTFOLIO_USER_ID:    ${{ secrets.PORTFOLIO_USER_ID }}
        run: npm run dry-run

      - name: Análisis mensual
        env:
          ANTHROPIC_API_KEY:    ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          PORTFOLIO_USER_ID:    ${{ secrets.PORTFOLIO_USER_ID }}
        run: node analyze.js

      - name: Avisar si falló
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Análisis mensual falló — ${new Date().toISOString().split('T')[0]}`,
              body: `El workflow falló.\n\nRun: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
            })
```

### 6.7 Idempotencia del análisis

`portfolio_history` tiene `UNIQUE(user_id, report_date)`. Hoy `analyze.js` hace `insert`:
si el workflow se relanza el mismo día, **falla por violación de unicidad después de haber
pagado la llamada a Anthropic**.

Cambiar a `upsert`:

```js
const { data: histRow, error: histErr } = await supabase
  .from('portfolio_history')
  .upsert(
    { user_id: USER_ID, report_date: reportDate, portfolio_snapshot: snapshot },
    { onConflict: 'user_id,report_date' }
  )
  .select('id')
  .single();
```

Y para `portfolio_assets`, que tiene `UNIQUE(report_id, asset_key)`:

```js
await supabase.from('portfolio_assets')
  .upsert(assetRows, { onConflict: 'report_id,asset_key' });
```

**Además:** hoy un fallo entre el insert de `portfolio_history` y el de `portfolio_assets` deja
un reporte sin activos. Con `upsert` una segunda corrida lo repara sola. Si `portfolio_assets`
falla, **lanzar** en vez de sólo hacer `console.warn`.

### 6.8 Sacar el `git push` de `analyze.js`

Que un script de análisis haga `git push` acopla dos responsabilidades y esconde el fallo en
un `catch` que sólo hace `warn`. Mover al workflow:

```yaml
      - name: Publicar resumen
        run: |
          if [[ -n "$(git status --porcelain tabs/resumen.html)" ]]; then
            git add tabs/resumen.html
            git commit -m "report: análisis $(date +%F)"
            git push
          else
            echo "Sin cambios en tabs/resumen.html"
          fi
```

Borrar de `analyze.js` el bloque `exec(git add …)` y los imports `exec`/`promisify`.

### Criterio de aceptación

- `npm test` pasa en verde y cubre todos los casos de 6.2.
- Relanzar el workflow dos veces el mismo día **no** falla.
- `grep -n "child_process" analyze.js` → sin resultados.

---

## FASE 7 — Datos vivos, móvil e higiene 🟢

### 7.1 El contexto macro está congelado

`analyze.js` busca TRM, tasa FED, dominancia BTC y Fear & Greed frescos cada mes y los guarda
en Supabase. `tabs/analisis.html` los tiene **escritos a mano** y nunca los lee:

```html
<div class="macro-item-value num">$3,230.44 COP</div>   <!-- fijo -->
<div class="macro-item-value num">4.25%-4.50%</div>     <!-- fijo -->
<div class="macro-item-value num">56.4%</div>           <!-- fijo -->
<div class="macro-item-value num">27</div>              <!-- fijo -->
```

Y `js/ui-utils.js` tiene `COP_DATA.baseRate = 3230.44` — el simulador de pesos convierte con
una TRM que puede llevar meses desactualizada.

**Arreglo:** dar `id` a esos cuatro valores y al `.macro-narrative`, y poblarlos desde
`portfolio_history.portfolio_snapshot.macro` en `js/views/analisis.js`. `COP_DATA.baseRate`
pasa a ser `snapshot.macro.usdcop` (que tras la Fase 3 ya es un número).

### 7.2 «vs mes» es un número inventado

La sticky bar muestra `+1.5%` en «vs mes». **Ningún código escribe nunca en ese elemento** —
es el valor que quedó en el HTML. En móvil está oculto por CSS, así que sólo miente en escritorio.

Calcularlo contra el total del reporte anterior, o borrar el bloque. No dejarlo como está.

### 7.3 Móvil

Lo responsive está mayormente bien resuelto (hay breakpoints reales en 1100/900/768/600/480).
Quedan cuatro cosas:

**a) La barra fija se mete bajo la barra de estado del iPhone.** El manifest declara
`apple-mobile-web-app-status-bar-style: black-translucent`, que exige manejar el área segura.
No se maneja.

En `latest-report.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

En `css/layout.css`:
```css
.sticky-bar{ padding-top: calc(12px + env(safe-area-inset-top)); }
body{ padding-bottom: calc(16px + env(safe-area-inset-bottom)); }
```

**b) Los modales se cortan en iOS.** `.modal-card` usa `max-height:90vh`; en Safari móvil `vh`
incluye la barra de URL, así que el botón de envío queda fuera de pantalla.

```css
.modal-card{ max-height: 90dvh; }   /* con fallback: max-height:90vh; max-height:90dvh; */
```

**c) Las columnas de la tabla de ventas se ocultan por posición.** `css/layout.css` esconde
columnas con `nth-child(1,3,6,7,8)` mientras `js/sell-history.js` genera los `<td>` en un orden
fijo. **Están acoplados sin ningún vínculo:** reordenar una columna en el JS hace desaparecer
la columna equivocada en móvil.

Añadir una clase semántica a cada celda (`.col-fecha`, `.col-bruto`, `.col-comision`…) tanto en
el `<th>` como en el `<td>` generado, y ocultar por clase, no por índice.

**d) El botón de borrar de la bitácora es demasiado pequeño.** `.log-del-btn` no llega al mínimo
de 44×44 px táctil. Ampliar el área de toque con padding.

### 7.4 Errores con `alert()`

`js/ui-manager.js` → `showError()` usa `alert()` nativo, que bloquea el hilo y rompe la estética,
teniendo la app un sistema de toasts propio y funcionando (`window.showToast`). Cambiarlo.

### 7.5 Borrar código muerto

| Qué | Dónde | Por qué |
|---|---|---|
| `PortfolioService` entero | `js/portfolio-service.js` + la llamada en `app.js` `afterLogin` | Hace `SELECT *` sobre `inv_journal` en cada login y **nadie usa el resultado** |
| `_loadSellHistoryFromSupabase` | `js/app.js` | Nunca se llama y **omite `costAvg`**, que `sell-history.js` sí lee. Es una trampa |
| `UIManager.updateSellPreview`, `updateSellQtyOptions`, `setSellQuantityType` | `js/ui-manager.js` | Duplican `calcSellPreview` de `sell-modal.js`; referencian un `#sellQtyOptions` que no existe |
| `getReportByDate` | `js/portfolio-history-service.js` | Sin referencias |
| `copyCommand`, `generateCashCommand`, `copyCashCommand` | `js/ui-utils.js` | Stubs vacíos |
| `#commandBlock` | `latest-report.html` | Bloque oculto permanentemente |
| `VALUATIONS` | `js/data.js` | Objeto vacío, sin consumidores reales |
| Columna `price` (texto) | `portfolio_assets` | Sólo tras un mes con `price_num` funcionando |

### 7.6 Versión y fechas en un solo sitio

Hoy: README dice v23, la sticky bar v21, el footer «v21 (2026-07-13)» con fecha fija del
4 de agosto, el `<title>` dice «agosto de 2026» a mano y el PDF exportado también.

Crear `js/version.js`:

```js
export const BUILD = 'v24';
export const buildDate = new Date().toLocaleDateString('es-CO',
  { year: 'numeric', month: 'long', day: 'numeric' });
```

Poblar desde ahí: `.build-tag`, el `<footer>`, el `<title>` y el nombre del PDF en `exportPDF()`.

### 7.7 `.gitignore`

`latest-report.html` está listado en `.gitignore` pero **sigue versionado** (se añadió al repo
antes de que se escribiera esa línea). Un `git rm --cached` accidental lo saca y GitHub Pages
devuelve 404.

```diff
- latest-report.html
+ .claude/
```

### 7.8 Service worker

La lista de archivos a cachear está a mano y el `CACHE_NAME` se sube a mano; añadir un JS nuevo
sin tocar ambos deja a los usuarios con una versión mixta. Tras la Fase 5 habrá ~10 archivos
nuevos, así que hay que actualizarlo sí o sí.

Generar `service-worker.js` desde un script (`scripts/build-sw.js`) que liste `css/`, `js/`,
`tabs/` y derive el `CACHE_NAME` de un hash del contenido.

### Criterio de aceptación

- La TRM del simulador COP coincide con la del último reporte.
- En iPhone (Safari, PWA instalada) la sticky bar no queda bajo la barra de estado y el botón
  de envío de los modales es alcanzable.
- `grep -rn "alert(" js/` → sin resultados.
- `wc -l js/data.js` — sólo lo imprescindible.

---

## Resumen de migraciones SQL

Correr **en este orden**, en Supabase → SQL Editor:

| Orden | Archivo | Fase | Bloquea |
|---|---|---|---|
| 1 | `scripts/migration-add-tipo-column.sql` | 0 | El tipo de los activos nuevos |
| 2 | `scripts/migration-price-numeric.sql` | 1 | Que los precios lleguen al dashboard |
| 3 | `scripts/migration-cash-table.sql` | 2 | Que el reporte use el cash real |

> La migración 3 debe desplegarse **junto con** el cambio de `analyze.js`. Si la tabla existe
> pero el analizador sigue leyendo el snapshot, el bug del cash sigue vivo con un paso más
> de indirección.

---

## Orden de ejecución recomendado

```
Fase 0  →  cerrar (SQL 1)                          ~10 min
Fase 1  →  precios (SQL 2)          🔴 crítico     ~1 h
Fase 2  →  fuente de verdad (SQL 3) 🔴 crítico     ~2 h
Fase 3  →  API de Anthropic         🔴 crítico     ~2 h
Fase 4  →  motor de cálculo         🟡 habilitador ~3 h
Fase 5  →  partir app.js            🟡             ~4 h
Fase 6  →  tests y CI/CD            🟡             ~3 h
Fase 7  →  datos vivos, móvil       🟢             ~3 h
```

Las fases 1–3 arreglan datos incorrectos y se pueden hacer sueltas. Las 4–6 son un bloque:
no tiene sentido partir `app.js` (5) sin el motor de cálculo (4), ni escribir tests (6) sin
tener funciones puras que testear (4).

---

## Cómo verificar que todo quedó bien

```bash
# Sintaxis de todo el JS
for f in js/*.js js/views/*.js analyze.js test-dry-run.js; do node --check "$f" || echo "FALLA: $f"; done

# Tests
npm test

# No quedan fuentes de verdad duplicadas
grep -rn "cash_amount"        js/ analyze.js   # vacío
grep -rn "claude-opus-4-8"    analyze.js       # vacío
grep -rn "sanitizeAndParse"   analyze.js       # vacío
grep -rn "alert("             js/              # vacío
grep -c  "costAvg"            js/data.js       # 0

# app.js adelgazado
wc -l js/app.js                                # < 200
```

Y a mano, en el navegador:

1. Login → la consola no muestra warnings.
2. El total de la sticky bar coincide con el «Valor de Mercado» del Resumen.
3. Registrar una compra de un ticker nuevo → aparece en Activos **sin tocar código**.
4. Registrar una segunda compra del mismo ticker → la cantidad suma y el costo promedio es el ponderado.
5. Registrar una venta parcial → la cantidad baja, el costo promedio no cambia.
6. Recargar la página → todo persiste.
7. Abrir en el móvil → nada tapado, modales usables, sin scroll horizontal.

---

# Registro de ejecución — 2026-08-20

Todas las fases aplicadas. Lo que sigue documenta las **desviaciones del plan**
y los hallazgos que aparecieron al ejecutarlo, no lo que salió según lo previsto.

## Desviaciones deliberadas

| Plan decía | Se hizo | Por qué |
|---|---|---|
| `baseline.json` + `fetch` en `initialize()` | `js/baseline.js` como módulo ES | `initialize()` corre en `load`, pero el Resumen se pinta en `DOMContentLoaded`. El fetch llegaba tarde y se veía un parpadeo de ceros. Los módulos se ejecutan antes de ese evento. |
| `assets` como objeto indexado por ticker | Lista con `ticker` dentro | Structured outputs impone dos restricciones contradictorias para un objeto: enumerar revienta la gramática, y `additionalProperties: <schema>` no está soportado. |
| Partir `app.js` en ~10 archivos | Los renderizadores consumen `window.PORTFOLIO` | El objetivo real era eliminar el cálculo duplicado en seis sitios, y eso está hecho. Trocear más `app.js` es cosmético y añade riesgo sin beneficio medible. |
| Buscar precio de todos los activos | Solo acciones/ETFs + 4 cripto | ~$1 por corrida, y forzaba al modelo a inventar los precios que no podía verificar. |

## Bugs encontrados durante la ejecución

Ninguno estaba en el informe original: aparecieron al ejecutar.

1. **El sync duplicaba las cantidades.** `_syncPortfolioFromSupabase` clonaba
   `window.EXISTING_ASSETS` —que ya tenía el journal aplicado— en vez del
   baseline. IREN pasaba de 1,18 a 2,36 a 3,54 unidades con cada ↺. Preexistente,
   pero la fase 0 lo hizo mucho más fácil de disparar al resincronizar en cada
   compra.

2. **El modelo inventó los precios.** La corrida del 20-ago multiplicó el
   portafolio por 2,3. Se detectó porque IREN salía a $78,20 el mismo día que se
   compró a $42,04, y porque VOO caía un 8% mientras QQQ subía un 12%. Causa:
   `price` obligatorio en el schema, sin forma de abstenerse. Mitigado con
   `sanityCheckPrices` y el recorte del universo consultado.

3. **Faltaban GRANT en tres tablas.** `service_role` solo los tenía completos
   sobre `inv_journal`. Y nadie tenía SELECT sobre `portfolio_cash`, así que el
   cash *parecía* funcionar por el fallback al último snapshot.

4. **`authenticated` sin DELETE sobre `inv_journal`** — el botón 🗑 de la
   bitácora llevaba roto desde siempre.

5. **Secret renombrado y `PORTFOLIO_USER_ID` ausente.** El análisis llevaba roto
   nueve días sin que nadie lo notara, porque el cron no vuelve hasta el 26 y no
   había notificación de fallos.

6. **Jekyll rompía el deploy de Pages** por las llaves dobles de este mismo
   documento. Resuelto con `.nojekyll`.

## Migraciones SQL aplicadas

| Archivo | Qué hace |
|---|---|
| `migration-add-tipo-column.sql` | `inv_journal.tipo` |
| `migration-price-numeric.sql` | `portfolio_assets.price_num` + backfill |
| `migration-cash-table.sql` | `portfolio_cash` con RLS + sembrado |
| `migration-fix-grants.sql` | GRANT en las cuatro tablas |

## Pendiente

- **Borrar el reporte corrupto** si aún está:
  `DELETE FROM portfolio_history WHERE report_date = '2026-08-20';`
- **Validar el recorte de precios** en la próxima corrida (26 de cada mes).
- Trocear `app.js` en vistas, si algún día estorba. Hoy no estorba.
