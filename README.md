# Market Intelligence

PWA de seguimiento de portafolio de inversiones personal — crypto + acciones USA.  
Análisis mensual automático vía Anthropic API. **Supabase como única fuente de verdad.**

**Build:** v23 · **Estado:** ✅ Producción

---

## En 30 segundos

1. Abre la app en el navegador (GitHub Pages)
2. Inicia sesión con tu cuenta
3. Registra compras y ventas desde el botón **📥 Registrar**
4. El día 26 de cada mes, GitHub Actions actualiza precios y análisis automáticamente

No hay scripts locales que ejecutar. Todo ocurre en la interfaz o en CI.

---

## Stack

| Capa | Tech | Propósito |
|---|---|---|
| **UI** | HTML + CSS + JS vanilla | PWA sin frameworks, 4 pestañas |
| **Auth** | Supabase Auth | Login con email/contraseña |
| **Base de datos** | Supabase (PostgreSQL) | Transacciones, historial, activos |
| **Análisis** | Anthropic API (Claude + web_search) | Precios en tiempo real + análisis |
| **CI/CD** | GitHub Actions | Análisis mensual automático |
| **Hosting** | GitHub Pages | Sitio estático |

---

## Arquitectura

```
market-intelligence/
├── latest-report.html          ← Shell de la PWA (login, nav, modales)
├── css/
│   ├── tokens.css              ← Variables CSS (colores, espaciado)
│   ├── base.css                ← Reset, tipografía, utilidades
│   ├── layout.css              ← Sticky bar, tabs, grids, responsive
│   ├── components.css          ← Cards, botones, modales, formularios
│   └── features.css            ← PnL, composición, historial de ventas
├── tabs/                       ← Contenido de cada tab (carga lazy)
│   ├── resumen.html            ← Generado por analyze.js (análisis mensual)
│   ├── activos.html            ← Señales, PnL detallado, composición
│   ├── transacciones.html      ← DCA tracker, bitácora, historial ventas
│   └── analisis.html           ← Asignación objetivo, macro, simulador COP
├── js/
│   ├── app.js                  ← Orquestador (ES module, Facade pattern)
│   ├── data.js                 ← Baseline de activos y colores
│   ├── portfolio-ui.js         ← renderPnl, renderComp, populateAssetSelects
│   ├── sell-modal.js           ← calcSellPreview, onSellAssetChange
│   ├── sell-history.js         ← SELL_HISTORY, renderSellHistory
│   ├── cash.js                 ← Cash disponible (Hapi), localStorage
│   ├── tab-loader.js           ← Carga lazy de tabs, evento portfolio-synced
│   ├── ui-utils.js             ← Utilidades, loadPortfolioComposition
│   ├── auth-service.js         ← Supabase Auth
│   ├── transaction-service.js  ← recordBuy / recordSale
│   ├── portfolio-service.js    ← Carga transacciones
│   ├── portfolio-history-service.js ← Carga reportes históricos
│   └── ui-manager.js           ← Modales, previews
├── analyze.js                  ← Script mensual: Anthropic API → Supabase
├── test-dry-run.js             ← Valida secrets antes de analizar
├── package.json                ← Solo para el script de análisis
└── .github/workflows/
    └── weekly-analysis.yml     ← Cron día 26 · workflow_dispatch manual
```

---

## Supabase — Tablas

### `inv_journal` — Compras y ventas
| Campo | Tipo | Descripción |
|---|---|---|
| `ticker` | text | Símbolo del activo (mayúsculas) |
| `fecha` | date | Fecha de la operación |
| `categoria` | text | `core` (acciones/ETF) · `satelite` (crypto) · `legado` |
| `numero_acciones` | numeric | Cantidad comprada o vendida |
| `precio_entrada` | numeric | Precio de compra o costo promedio |
| `inversion_monto` | numeric | Monto total (qty × precio) |
| `precio_salida` | numeric | Precio de venta (solo ventas) |
| `fecha_venta` | date | Fecha de venta — distingue ventas de compras |
| `ganancia_perdida_pct` | numeric | P&L% de la venta |
| `comision` | numeric | Comisión del broker |
| `monto_neto` | numeric | Monto de venta menos comisión |
| `razon_venta` | text | Razón de la venta |
| `tesis_inversion` | text | Fundamento de la operación |
| `precio_objetivo` | numeric | Precio objetivo (solo compras) |

### `portfolio_history` — Reportes mensuales
Snapshot del portafolio por fecha. `portfolio_snapshot` (JSONB) contiene:
totales, P&L, análisis del asesor, macro, decisiones del mes, oportunidades.

### `portfolio_assets` — Activos por reporte
Precio, señal (BUY/HOLD/WAIT) y contexto de cada activo en cada reporte.

---

## Flujo al hacer login

```
1. _loadLatestAssetData()    → precios/señales desde portfolio_assets
2. _syncPortfolioFromSupabase() → posiciones desde inv_journal
   ├── Clona baseline de data.js
   ├── Aplica compras (suma qty, recalcula costAvg ponderado)
   ├── Aplica ventas (resta qty)
   └── Reemplaza window.EXISTING_ASSETS con resultado
3. Carga historial de ventas (inv_journal donde fecha_venta IS NOT NULL)
4. Carga bitácora de compras (inv_journal donde fecha_venta IS NULL)
5. Actualiza sticky bar con totales calculados
6. Dispara portfolio-synced → re-renderiza tabs
```

---

## Registro de operaciones (UI)

### Compra
1. Clic en **📥 Registrar** → tab Compra
2. Selecciona activo (existente o nuevo)
3. Ingresa cantidad, precio, fecha, fundamento
4. **Registrar compra** → inserta en `inv_journal`, actualiza UI en tiempo real

### Venta
1. Clic en **📥 Registrar** → tab Venta
2. Selecciona activo → se auto-llena costo promedio
3. Ingresa precio de venta, comisión, fundamento
4. **Vender todo** rellena la cantidad completa automáticamente
5. Preview muestra P&L en tiempo real (verde/rojo)
6. **Registrar venta** → inserta en `inv_journal`, actualiza UI y historial

### Cash (Hapi)
- El botón **✏️ Actualizar** en Transacciones permite corregir el cash real
- Se descuenta automáticamente en compras y suma en ventas

---

## Análisis mensual (GitHub Actions)

El workflow corre el **día 26 de cada mes** (o manualmente desde Actions):

```
analyze.js:
1. Lee posiciones reales desde Supabase (inv_journal)
2. Llama Claude (claude-opus-4-8 + web_search) para precios y análisis
3. Guarda en Supabase:
   ├── portfolio_history → snapshot completo con análisis
   └── portfolio_assets  → precio/señal/contexto por activo
4. Regenera tabs/resumen.html con la narrativa del mes
5. Git push de tabs/resumen.html
```

### Secrets requeridos en GitHub

| Secret | Cómo obtenerlo |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role |
| `PORTFOLIO_USER_ID` | UUID del usuario en Supabase Auth |

Configurar en: **GitHub repo → Settings → Secrets and variables → Actions**

---

## Seguridad

- **RLS activo** en todas las tablas: `auth.uid() = user_id`
- Políticas: SELECT, INSERT, DELETE con row-level security
- El `SUPABASE_SERVICE_KEY` solo existe como GitHub Secret — nunca en el código
- El análisis mensual usa el service role para bypass RLS desde el servidor

---

## Desarrollo local

```bash
# Servir localmente (requerido para fetch() de tabs/)
npx serve .
# → http://localhost:3000/latest-report.html

# Correr análisis manualmente (requiere .env con secrets)
npm install
node analyze.js
```

---

**Última actualización:** 2026-08-12 | **Build:** v23
