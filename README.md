# Market Intelligence

PWA de seguimiento de portafolio de inversiones personal — crypto + acciones USA.
Análisis mensual automático vía Anthropic API (Claude + web_search). **Supabase como única fuente de verdad.**

**Build:** v23 · **Estado:** ✅ Producción

---

## En 30 segundos

1. Abre la app (GitHub Pages) e inicia sesión
2. Registra compras y ventas desde **📥 Registrar**
3. El día 26 de cada mes, GitHub Actions actualiza precios y análisis automáticamente

Sin scripts locales. Sin localStorage. Todo persiste en Supabase.

---

## Stack

| Capa | Tech | Propósito |
|---|---|---|
| **UI** | HTML + CSS + JS vanilla | PWA sin frameworks, 4 pestañas |
| **Auth + DB** | Supabase | Login, transacciones, historial, cash |
| **Análisis** | Anthropic API (claude-opus-4-8 + web_search) | Precios en tiempo real + análisis |
| **CI/CD** | GitHub Actions | Análisis mensual automático (día 26) |
| **Hosting** | GitHub Pages | Sitio estático |

---

## Arquitectura de archivos

```
latest-report.html          ← Shell PWA (login, sticky bar, nav, modales)
css/
  tokens.css                ← Variables CSS (colores, espaciado)
  base.css                  ← Reset, tipografía, utilidades
  layout.css                ← Sticky bar, tabs, grids, responsive móvil
  components.css            ← Cards, botones, modales, formularios
  features.css              ← PnL, composición, historial de ventas, ROI
tabs/                       ← Contenido lazy-loaded por tab (sin caché)
  resumen.html              ← Regenerado por analyze.js cada mes
  activos.html              ← Señales, PnL, composición del portafolio
  transacciones.html        ← DCA tracker, bitácora, historial ventas
  analisis.html             ← Asignación objetivo, macro, simulador COP
js/
  app.js                    ← Orquestador (ES module, Facade pattern)
  config.js                 ← Supabase URL/key + tabla names
  auth-service.js           ← Supabase Auth (login/logout/session)
  transaction-service.js    ← recordBuy() / recordSale() → inv_journal
  portfolio-service.js      ← Carga transacciones desde Supabase
  portfolio-history-service.js ← Reportes históricos
  ui-manager.js             ← Modales, previews de compra/venta
  data.js                   ← Baseline de activos, colores (sin localStorage)
  cash.js                   ← CURRENT_CASH sincronizado con Supabase
  portfolio-ui.js           ← renderPnl(), renderComp(), populateAssetSelects()
  sell-modal.js             ← calcSellPreview(), sellSelectAll()
  sell-history.js           ← SELL_HISTORY, renderSellHistory()
  tab-loader.js             ← Lazy fetch de tabs, evento portfolio-synced
  ui-utils.js               ← showToast, exportPDF, loadPortfolioComposition
analyze.js                  ← Script mensual: Anthropic → Supabase → git push
test-dry-run.js             ← Valida secrets y conexión antes de analizar
package.json                ← Dependencias solo para analyze.js
.github/workflows/
  weekly-analysis.yml       ← Cron día 26 + workflow_dispatch manual
```

---

## Supabase — Tablas y RLS

### `inv_journal` — Compras y ventas (misma tabla)
| Campo | Tipo | Compra | Venta |
|---|---|---|---|
| `ticker` | text | ✅ | ✅ |
| `fecha` | date | ✅ | ✅ |
| `categoria` | text | `core`/`satelite`/`legado` | `satelite` |
| `numero_acciones` | numeric | qty comprada | qty vendida |
| `precio_entrada` | numeric | precio de compra | costAvg al vender |
| `inversion_monto` | numeric | qty × precio | monto bruto |
| `precio_salida` | numeric | — | precio de venta |
| `fecha_venta` | date | — | ✅ distingue venta de compra |
| `ganancia_perdida_pct` | numeric | — | P&L% calculado |
| `comision` | numeric | — | fee del broker |
| `monto_neto` | numeric | — | bruto − comisión |
| `razon_venta` | text | — | razón de la venta |
| `tesis_inversion` | text | fundamento | observaciones |

**Políticas RLS:** SELECT, INSERT, DELETE con `auth.uid() = user_id`

### `portfolio_history` — Reportes mensuales
Snapshot del portafolio por `report_date`. `portfolio_snapshot` (JSONB) contiene:
totales, P&L, cash, analystOpinion, macro, decisiones, oportunidades.

**Políticas RLS:** SELECT, INSERT, UPDATE con `auth.uid() = user_id`

### `portfolio_assets` — Activos por reporte
`asset_key`, `price`, `change_7d`, `signal` (BUY/HOLD/WAIT), `context` por reporte.

---

## Flujo al hacer login

```
1. _loadLatestAssetData()         → precios/señales desde portfolio_assets
2. _syncPortfolioFromSupabase()   → clona BASELINE → aplica inv_journal en orden
   ├── Compras: suma qty, recalcula costAvg ponderado
   ├── Ventas: resta qty (quedan en 0 al vender todo)
   └── Reemplaza window.EXISTING_ASSETS (no muta el original)
3. CURRENT_CASH                   → portfolio_history.portfolio_snapshot.cash
4. _loadBuyHistory()              → bitácora desde inv_journal
5. Historial de ventas            → inv_journal donde fecha_venta IS NOT NULL
6. Dispara portfolio-synced       → re-renderiza tabs, sticky bar, resumen
```

---

## Registro de operaciones (UI)

### Compra — modal 📥 Registrar
- Selecciona activo existente (tipo auto-detectado) o nuevo ticker
- Ingresa cantidad, precio, fecha, precio objetivo, fundamento
- Preview muestra: monto total, nueva cantidad y nuevo costAvg ponderado
- **Registrar compra** → `inv_journal`, descuenta del cash, actualiza PnL en tiempo real

### Venta — modal 📤 Registrar
- Selecciona activo → se llena automáticamente el costo promedio (editable)
- Botón **Vender todo** llena la cantidad completa
- Preview muestra: bruto → comisión → neto → **P&L $ y % en tiempo real** (verde/rojo)
- **Registrar venta** → `inv_journal`, suma al cash, aparece en historial de ventas

### Cash (Hapi)
- Botón **✏️ Actualizar** en Transacciones sincroniza el cash real
- Se descuenta en compras y suma en ventas automáticamente
- Persiste en `portfolio_history.portfolio_snapshot.cash` (sin localStorage)

---

## Análisis mensual (GitHub Actions)

El workflow corre el **día 26 de cada mes** (o manualmente desde Actions):

```
analyze.js v3:
1. Lee posiciones desde Supabase (inv_journal + baseline data.js)
2. Claude (opus-4-8 + web_search) busca precios actuales y genera análisis
3. Guarda en Supabase:
   ├── portfolio_history → snapshot + analystOpinion + macro + decisiones
   └── portfolio_assets  → precio/señal/contexto por activo
4. Regenera tabs/resumen.html con la narrativa del mes
5. Git push de tabs/resumen.html (latest-report.html nunca se toca)
```

### Secrets requeridos en GitHub → Settings → Secrets

| Secret | Cómo obtenerlo |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role |
| `PORTFOLIO_USER_ID` | UUID del usuario en Supabase Auth |

---

## Sin localStorage — sincronizado entre dispositivos

Ningún dato se guarda en localStorage ni sessionStorage:
- **Cash**: Supabase (`portfolio_history.portfolio_snapshot.cash`)
- **Posiciones**: calculadas en tiempo real desde `inv_journal`
- **Historial de ventas**: `inv_journal` donde `fecha_venta IS NOT NULL`
- **Tabs**: fetch siempre fresco, sin caché

---

## Desarrollo local

```bash
# Servir localmente (fetch() de tabs/ requiere servidor HTTP)
npx serve .
# → http://localhost:3000/latest-report.html

# Instalar dependencias del analizador
npm install

# Validar secrets antes de analizar
node test-dry-run.js

# Ejecutar análisis manual (requiere .env o vars de entorno)
ANTHROPIC_API_KEY=... SUPABASE_SERVICE_KEY=... PORTFOLIO_USER_ID=... node analyze.js
```

---

**Última actualización:** 2026-08-12 | **Build:** v23
