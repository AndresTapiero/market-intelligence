# Arquitectura — Market Intelligence v2

## Estado Actual (Híbrido Local + Supabase)

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUJO DE DATOS                              │
└─────────────────────────────────────────────────────────────────┘

LOCAL (Git + JSON)
├── portfolio.json          → cantidades actuales, costAvg, targets
├── history.json            → análisis históricos (1x mes)
├── dca-log.json            → bitácora DCA (auto-generado)
└── .portfolio-snapshot.json → backup de totales mensuales

SUPABASE (inv_journal tabla)
├── id, user_id, fecha
├── ticker, categoria (core/satelite/legado)
├── inversion_monto, numero_acciones, precio_entrada
├── tesis_inversion, fuentes_valoracion
├── precio_objetivo, margen_seguridad_pct
├── checklist_disciplina (JSON o columna)
└── precio_salida (vacio hasta vender)

GITHUB ACTIONS (workflow semanal)
└── analyze.js → OpenAI/Claude → genera history.json entry
```

---

## Qué Guardar Dónde (Optimización)

### ✅ MANTENER en portfolio.json (Git)
- **Cantidades actuales** (qty, shares) — fuente única de verdad, auditada
- **Costo promedio** — inmutable, necesario para P&L
- **Categoría** (etf/stock/satelite) — Define asignación objetivo
- **Fundamento** — contexto de POR QUÉ compraste
- **Targets** — metas de asignación % (editable, governs decisiones)

*Razón: Cambios auditable en git, validación fácil, off-the-grid si Supabase falla*

### ✅ SUPABASE (inv_journal) — Decisiones Discretas
Cada **compra** es una fila separada:
```json
{
  "fecha": "2025-01-28",
  "ticker": "NVDA",
  "categoria": "satelite",
  "inversion_monto": 132.04,
  "numero_acciones": 1.10855,
  "precio_entrada": 119.11,
  "tesis_inversion": "Crecimiento IA, dominio de mercado",
  "fuentes_valoracion": ["DCF modelo", "Comparables sector"],
  "precio_objetivo": 150,
  "margen_seguridad_pct": 25,
  "checklist_disciplina": {
    "tesis_escrita": true,
    "3_fuentes": true,
    "margen_seguridad_ok": true,
    "limite_posicion": true
  }
}
```

*Razón: Auditoría de decisiones → futuro review "Por qué compré ESTO a ESTE precio"*

### ❌ ELIMINAR / NO GUARDAR
- **Precios históricos** (fetch en cada run desde API)
- **P&L calculado** (calcula on-the-fly desde portfolio.json + precios actuales)
- **Latest-report.html** (regen cada semana, no versionar)
- **Análisis puntual** (historizar en history.json, descartar HTML old)

---

## Flujo Actual: Una Compra

```
1. Ejecutas en terminal:
   node regenerate.js  → Lee portfolio.json + precios API → Genera HTML

2. Si es NUEVA COMPRA en discrecional (NVDA/TSLA/NU):
   a) Editas portfolio.json: 
      - nvda.shares: 1.10855 → 2.0 (ejemplo)
      - nvda.costAvg: 119.11 → recalcula
   
   b) node regenerate.js  → Valida cambios, genera preview
   
   c) git add portfolio.json
      git commit -m "portfolio: compra NVDA 2025-01-28"
      git push
   
   d) (OPC) Registras en Supabase si quieres auditoría:
      node register-to-journal.js (NUEVO SCRIPT NEEDED)
      → Inserta fila en inv_journal con tesis/fuentes

3. Si es DCA (Bitcoin/VOO/QQQ):
   a) Editas portfolio.json cantidades
   b) dca-log.js autogenera entrada en dca-log.json
   c) Same git flow
   d) NO necesita inv_journal (es automático, sin tesis)
```

---

## Propuesta: REGISTRO DE VENTAS

### Tabla: `inv_journal_exits` (Supabase)
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "fecha_salida": "2026-08-15",
  "ticker": "NVDA",
  "numero_acciones_vendidas": 1.0,
  "precio_salida": 145.50,
  "monto_bruto": 145.50,
  "costo_base": 132.04,
  "ganancia_bruta": 13.46,
  "ganancia_pct": 10.2,
  "razon_venta": "Toma de ganancias / Stop loss / Rebalance / Otro",
  "observaciones": "Texto libre",
  "impuesto_aprox": 0,
  "notas_futuras": "Lecciones aprendidas"
}
```

### Flujo de Venta
```
1. Vendes NVDA a $145.50
   
2. Terminal:
   node register-exit.js NVDA
   → Prompt: ¿Cantidad? ¿Precio? ¿Razón? ¿Observaciones?
   → Valida contra inv_journal (tu costo_base histórico)
   → Calcula P&L automático
   → Inserta en inv_journal_exits
   
3. Automático:
   a) Actualiza portfolio.json: nvda.shares: 2.0 → 1.0
   b) Recalcula costAvg (nuevo promedio ponderado)
   c) git commit -m "portfolio: venta NVDA 2026-08-15, +10.2%"
   
4. Histórico:
   a) inv_journal_exits tiene registro permanente
   b) regenerate.js muestra "Realizadas este mes: NVDA +10.2%"
   c) Puedes revisar futuro: "¿Por qué vendí NVDA? Porque..."
```

---

## Ventajas Arquitectura Propuesta

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Compras** | Solo en portfolio.json | portfolio.json + inv_journal (auditoría) |
| **Ventas** | No registradas | inv_journal_exits (rastreo completo) |
| **Tesis** | No registrada | Supabase (futuro review) |
| **P&L** | Solo precios actuales | Actual + histórico de decisiones |
| **Git** | Fuente única de verdad | Cambios de cantidad/costAvg auditados |
| **Supabase** | Espejo de decisiones | Registro inmutable de "por qué" |
| **Offline** | ✅ Si | ✅ Si (portfolio.json basta) |
| **Review Futuro** | ❌ No | ✅ Si (decisiones + resultados) |

---

## Estructura JSON Propuesta en Portfolio

```json
{
  "nvda": {
    "shares": 1.0,
    "costAvg": 132.04,
    "cat": "stock",
    "fundamento": "Crecimiento IA",
    
    "journal_ids": ["ca115386-f223-45a8-97b9-69725069a4c2"],
    "exit_ids": [],
    
    "history": [
      {
        "date": "2025-01-28",
        "shares_bought": 1.10855,
        "price": 119.11,
        "journal_id": "ca115386-f223-45a8-97b9-69725069a4c2"
      }
    ]
  }
}
```

*journal_ids:* UUID de compras en inv_journal
*exit_ids:* UUID de ventas en inv_journal_exits
*history:* log local para auditoría local si Supabase no disponible

---

## Scripts Necesarios

### Existentes ✅
- `regenerate.js` — genera HTML (usa portfolio.json)
- `dca-log.js` — bitácora DCA automática
- `analyze.js` — análisis semanal (API)

### Nuevos Necesarios 🔨
1. **register-entry.js** — Compra → inv_journal
2. **register-exit.js** — Venta → inv_journal_exits + portfolio.json
3. **journal-review.js** — Lee inv_journal + exits, genera resumen

### Opcional
4. **sync-portfolio-to-journal.js** — Auditoría inversa (¿portfolio.json ↔ inv_journal sincronizados?)

---

## Plan de Implementación

### Fase 1 (Hoy)
✅ Ya hecho: inv_journal con 3 compras (NVDA/TSLA/NU)
✅ Ya hecho: regenerate.js lee inv_journal, muestra en pestaña "Diario"

### Fase 2 (Próximo)
🔨 Crear `register-exit.js` (compra inversa)
🔨 Tabla `inv_journal_exits` en Supabase
🔨 Integrar exits en "Diario de Inversiones" tab

### Fase 3 (Futuro)
🔨 `journal-review.js` — dashboard "Historias de inversión"
🔨 Análisis: "Ventas rentables vs no rentables"
🔨 Métricas: tasa de acierto, P&L promedio, razones de venta

---

## Resumen: Qué NO Necesitas Guardar Localmente

❌ **Precios** — siempre fresh del API
❌ **P&L cálculado** — se regen cada semana
❌ **HTML Reports** — regen each week, no es source
❌ **Cache de análisis puntual** — esto va a history.json (1 entry/mes)
❌ **Historiales de portfolio antiguas** — snapshot mensual en .portfolio-snapshot.json basta

✅ **Lo único que importa local:** portfolio.json (auditoría de decisiones)
✅ **Lo que importa en Supabase:** inv_journal + inv_journal_exits (por qué compraste/vendiste)
