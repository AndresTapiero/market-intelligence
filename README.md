# Market Intelligence

PWA de seguimiento de portafolio personal — crypto + acciones USA.
Análisis mensual automático vía Anthropic API. **Supabase como única fuente de verdad.**

**Build:** v24 · **Estado:** ✅ Producción

---

## En 30 segundos

1. Abre la app (GitHub Pages) e inicia sesión
2. Registra compras y ventas desde **📥 Registrar**
3. El día 26 de cada mes, GitHub Actions actualiza precios y análisis

Sin scripts locales. Sin localStorage. Todo persiste en Supabase.

---

## Stack

| Capa | Tech | Propósito |
|---|---|---|
| **UI** | HTML + CSS + JS vanilla | PWA sin frameworks, 4 pestañas |
| **Auth + DB** | Supabase | Login, transacciones, historial, cash |
| **Análisis** | Anthropic API (`claude-sonnet-5` + web_search) | Precios reales + análisis mensual |
| **Tests** | Vitest | 70 tests sobre las funciones puras |
| **CI/CD** | GitHub Actions | Análisis mensual (día 26) |
| **Hosting** | GitHub Pages | Sitio estático |

---

## Arquitectura

```
latest-report.html          ← Shell PWA (login, sticky bar, nav, modales)
css/                        ← tokens · base · layout · components · features
tabs/                       ← Contenido lazy-loaded por pestaña
  resumen.html                Regenerado por analyze.js cada mes
  activos.html                Señales, PnL, composición
  transacciones.html          Franja DCA, bitácora, eventos, historial de ventas
  analisis.html               Asignación objetivo, macro, simulador COP

js/
  ── Datos ──────────────────────────────────────────────────────────
  baseline.js               FUENTE ÚNICA de las posiciones de partida.
                            La importan la app y analyze.js.
  version.js                Build, título, footer y nombre del PDF.
  data.js                   Sólo VALUATIONS (margen de seguridad).

  ── Lógica pura (testeable) ────────────────────────────────────────
  portfolio-model.js        applyJournal · computePortfolio ·
                            weightedCostAvg · sellPnl · dcaStatus ·
                            upcomingEvents · ALLOCATION_TARGETS
  format.js                 fmtUSD · fmtPrice · fmtQty · fmtPct · fmtCOP

  ── Servicios Supabase ─────────────────────────────────────────────
  config.js                 URL, clave publicable y nombres de tabla
  auth-service.js           Login / logout / sesión
  transaction-service.js    recordBuy() · recordSale() → inv_journal
  cash-service.js           get() · set() → portfolio_cash
  portfolio-history-service.js

  ── UI ─────────────────────────────────────────────────────────────
  app.js                    Orquestador. Calcula el modelo UNA vez por
                            sync y lo publica en window.PORTFOLIO.
  portfolio-ui.js           renderPnl() · renderComp()
  ui-manager.js             Modales y previews de compra
  sell-modal.js             Preview de venta
  sell-history.js           Tabla de ventas
  tab-loader.js             Carga diferida de pestañas
  cash.js                   Display y modal de cash
  ui-utils.js               Toasts, PDF, widget COP

analyze.js                  Script mensual: Anthropic → Supabase
test/                       portfolio-model · format · dca
scripts/                    Migraciones SQL
.github/workflows/monthly-analysis.yml
```

### Dos reglas que sostienen el diseño

**1. El baseline vive en un solo sitio.** `js/baseline.js` tiene las posiciones
previas a la app. Todo lo registrado desde el modal está en `inv_journal` y se
aplica encima. La app y el analizador importan el mismo archivo, así que no
pueden discrepar.

**2. El cálculo financiero es puro.** `portfolio-model.js` no toca el DOM, ni
`window`, ni Supabase: todo entra por parámetros. Por eso se puede testear sin
navegador, y por eso `analyze.js` puede usar exactamente el mismo motor que el
dashboard.

---

## Supabase

### `inv_journal` — Compras y ventas

Una fila por operación. Lo que distingue una venta es que `fecha_venta` no sea
nulo.

| Campo | Compra | Venta |
|---|---|---|
| `ticker` | ✅ | ✅ |
| `fecha` | ✅ | ✅ |
| `tipo` | `stock`/`etf`/`crypto` | — |
| `categoria` | `core`/`satelite`/`legado` | `satelite` |
| `numero_acciones` | qty comprada | qty vendida |
| `precio_entrada` | precio efectivo (incl. fee) | costAvg al vender |
| `inversion_monto` | qty × precio + fee | monto bruto |
| `precio_salida` | — | precio de venta |
| `fecha_venta` | — | ✅ distingue venta de compra |
| `comision` | fee del broker | fee del broker |
| `monto_neto` | — | bruto − comisión |
| `tesis_inversion` | fundamento | observaciones |

### `portfolio_cash` — Cash disponible

Una fila por usuario. **Único almacén del cash.** La app lo escribe al
registrar operaciones o ajustarlo a mano; `analyze.js` lo lee para el reporte.

### `portfolio_history` — Reportes mensuales

Snapshot por `report_date`, con `UNIQUE(user_id, report_date)`.
`portfolio_snapshot` (JSONB) incluye totales, P&L, cash, `analystOpinion`,
`macro`, `actions`, `newOpportunities` y `upcomingEvents`.

### `portfolio_assets` — Precios por reporte

`asset_key`, **`price_num`** (numérico — es el que lee la app), `price` (texto
original, para auditoría), `change_7d`, `signal`, `context`.

**Políticas:** RLS con `auth.uid() = user_id` en todas. `service_role` tiene
GRANT completo para que el analizador funcione sin sesión.

---

## Flujo al hacer login

```
1. loadHistoricalReports()   → reportes, macro y eventos
2. _loadCash()               → portfolio_cash
3. _syncPortfolioFromSupabase()
   ├── _loadLatestAssetData()  precios desde portfolio_assets.price_num
   ├── buildHoldings()         SIEMPRE desde el baseline puro
   └── aplica inv_journal en orden cronológico
4. _recomputeModel()         → window.PORTFOLIO
5. Renderizadores            → todos leen window.PORTFOLIO
```

El paso 3 es **idempotente**: sincronizar N veces da el mismo resultado. Partir
del baseline y no del estado vivo es lo que lo garantiza.

---

## Análisis mensual

Corre el **día 26** por cron, o a demanda desde Actions → *Análisis mensual*.

```
1. Lee cash y posiciones desde Supabase
2. Elige qué precios buscar: todas las acciones/ETFs + las 4 cripto de
   mayor peso (9 de 18 activos ≈ 84% del valor). El resto conserva el
   precio del mes anterior.
3. Claude busca precios y genera el análisis, con salida forzada por
   JSON Schema
4. sanityCheckPrices descarta precios imposibles comparando con el mes
   anterior; si cae más de un tercio, aborta sin escribir
5. Guarda en Supabase (upsert) y regenera tabs/resumen.html
6. El workflow publica el resumen
```

### Por qué el universo de precios está recortado

Buscar los 18 activos costaba ~$1 por corrida y, peor, empujaba al modelo a
inventar los precios que no podía verificar: en agosto de 2026 eso multiplicó
la valoración por 2,3 con memecoins subiendo un 1.856%. Un precio de hace un
mes en un activo que vale $2 es preferible a uno inventado en cualquiera.

### Secrets

| Secret | Dónde |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → **Secret keys** (`sb_secret_…`) |
| `PORTFOLIO_USER_ID` | UUID del usuario en Supabase Auth |

> La clave de Supabase debe ser **secreta**, no la publicable. El analizador
> corre sin sesión y necesita saltarse RLS; con la publicable el rol es `anon`
> y Postgres responde `permission denied`.

---

## Desarrollo

```bash
npm install
npm test          # Vitest — 70 tests, sin red ni navegador
npm run test:watch

npx serve .       # → http://localhost:3000/latest-report.html
                  # Apunta al mismo Supabase: es una prueba real

npm run dry-run   # Valida secrets, modelo y migraciones (necesita las 3 env vars)
npm run analyze   # Corrida completa — CUESTA DINERO
```

`npm test` no toca la red. `npm run dry-run` y `npm run analyze` sí, y este
último gasta tokens de la API.

### Migraciones

Se corren a mano en Supabase → SQL Editor, en este orden. Todas están
aplicadas en producción a fecha de hoy.

| Archivo | Qué añade |
|---|---|
| `create-portfolio-history-tables.sql` | `portfolio_history`, `portfolio_assets` |
| `migration-add-tipo-column.sql` | `inv_journal.tipo` |
| `migration-price-numeric.sql` | `portfolio_assets.price_num` + backfill |
| `migration-cash-table.sql` | `portfolio_cash` con RLS |
| `migration-fix-grants.sql` | GRANT para `service_role` y `authenticated` |

El resto de `scripts/` es del sembrado inicial de agosto de 2026, cuando el
proyecto pasó de archivos locales a Supabase. **Ya se aplicó y no hay que
volver a correrlo**; se conserva sólo como referencia de cómo se cargaron los
datos históricos:

- `insert-portfolio-data.sql`, `-simple`, `-minimal` — tres variantes del mismo
  volcado inicial
- `migrate-history-to-supabase.js`, `migrate-via-console.js` — el traslado desde
  `history.json`
- `get-user-id.js`, `get-user-id-dev.js` — obtener el UUID del usuario

Si estorban, se pueden borrar: nada del código los referencia.

---

## Estrategia

**Asignación objetivo** (sobre lo invertido, sin contar cash):

| | Objetivo |
|---|---|
| Acciones individuales | 35% |
| ETFs (VOO/QQQ) | 25% |
| Bitcoin | 25% |
| Ethereum | 10% |
| Altcoins | 5% |

**DCA:** $50 en BTC y $50 en acciones cada mes. La franja de Transacciones se
pone en verde cuando el aporte del mes ya está hecho.

Las altcoins están en salida gradual, sin forzar ventas. Cambiar los objetivos
es editar `ALLOCATION_TARGETS` en `portfolio-model.js`: la UI se genera desde
ahí.

---

## Historial

[`PLAN-DE-MEJORA.md`](PLAN-DE-MEJORA.md) documenta la auditoría de agosto de
2026 y las siete fases de refactor, con las desviaciones del plan y los bugs
que aparecieron al ejecutarlo. Útil si algo aquí no cuadra y quieres saber por
qué está como está.

---

**Última actualización:** 2026-08-20 · **Build:** v24
