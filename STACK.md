# Stack de Datos — Market Intelligence

## 📊 TABLA COMPARATIVA

```
┌──────────────────────────────────────────────────────────────────────────┐
│ FUENTE          │ QUÉ GUARDA          │ PARA QUÉ              │ ACCESO   │
├──────────────────────────────────────────────────────────────────────────┤
│ portfolio.json  │ Cantidad + costo    │ Auditoría de decisiones│ Git      │
│ (Local, Git)    │ promedio            │ Fuente única de verdad │ Offline  │
│                 │ Categoría           │                        │ ✅       │
│                 │ Targets, fundamento │                        │          │
├──────────────────────────────────────────────────────────────────────────┤
│ inv_journal     │ COMPRAS discretas   │ ¿POR QUÉ compraste?   │ API      │
│ (Supabase)      │ • Fecha             │ • Tesis               │ Online   │
│                 │ • Ticker            │ • Fuentes             │ Solo si  │
│                 │ • Cantidad          │ • Objetivo            │ registro │
│                 │ • Precio entrada    │ • Checklist           │ voluntario
│                 │ • Tesis             │                        │          │
├──────────────────────────────────────────────────────────────────────────┤
│ inv_journal_    │ VENTAS              │ ¿POR QUÉ VENDISTE?    │ API      │
│ exits           │ • Fecha salida      │ • Razón               │ Online   │
│ (Supabase)      │ • Ticker            │ • P&L resultado       │ Solo si  │
│                 │ • Cantidad          │ • Lecciones           │ venta    │
│                 │ • Precio salida     │                       │          │
│                 │ • P&L cálculado     │                       │          │
│                 │ • Razón             │                       │          │
├──────────────────────────────────────────────────────────────────────────┤
│ dca-log.json    │ Compras DCA         │ Bitácora automática   │ Git      │
│ (Local, Git)    │ • Fecha             │ BTC/VOO/QQQ           │ Offline  │
│                 │ • Ticker            │ Tracking acumulación  │ ✅       │
│                 │ • Cantidad          │                        │          │
│                 │ • Precio            │                        │          │
├──────────────────────────────────────────────────────────────────────────┤
│ history.json    │ Análisis puntual    │ Contexto macro semanal│ Git      │
│ (Local, Git)    │ (1 entry/semana)    │ Precios, signals,     │ Offline  │
│                 │ • Precios           │ opinions              │ ✅       │
│                 │ • Signals (BUY/...) │                        │          │
│                 │ • Context analyst   │                        │          │
├──────────────────────────────────────────────────────────────────────────┤
│ reports/        │ HTML render         │ Visualización semanal │ Browser  │
│ *.html          │ (regen cada week)   │ 4 pestañas            │ Offline  │
│ (Local)         │                     │ NO versionar          │ ✅       │
│                 │                     │ (se regen auto)       │          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUJOS DE DATOS

### Compra Discrecional (NVDA/TSLA/NU)

```
TÚ COMPRAS 1.5 NVDA @ $130
        ↓
┌───────────────────────────────────────────────────────┐
│ 1. Edita portfolio.json (LOCAL)                       │
│    nvda.shares: 1.10855 → 2.60855                     │
│    nvda.costAvg: 119.11 → actualiza                   │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 2. node register-entry.js NVDA (OPC pero recomendado)│
│    Prompt: ¿Tesis? "Crecimiento IA"                  │
│    → Inserta fila en inv_journal (SUPABASE)          │
│    → UUID: ca115386-f223-45a8-97b9-69725069a4c2     │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 3. git add portfolio.json                             │
│    git commit -m "compra NVDA $130"                   │
│    git push → GitHub (AUDITADO)                       │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 4. Próxima semana: node regenerate.js                │
│    • Lee portfolio.json (cantidad: 2.60855)           │
│    • Lee inv_journal (tesis, fuentes)                 │
│    • Genera HTML → pestaña "Diario"                   │
└───────────────────────────────────────────────────────┘
```

### DCA Automático (Bitcoin/VOO)

```
HAPI/KRAKEN COMPRA AUTOMÁTICO $50 USD BTC
        ↓
┌───────────────────────────────────────────────────────┐
│ 1. Edita portfolio.json (TÚ, después de verificar)   │
│    btc.qty: 0.016271 → 0.016521                      │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 2. node regenerate.js (automático en schedule)       │
│    • dca-log.js detecta cambio en qty                 │
│    • Autogenera entrada en dca-log.json              │
│    • NO entra en inv_journal (sistemático)           │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 3. git add portfolio.json dca-log.json               │
│    git commit -m "DCA BTC julio"                      │
│    git push → GitHub                                 │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 4. Visualización: "Inversión Sistemática" tab         │
│    • DCA Tracker: $50 USD/mes                         │
│    • Bitácora: histórico completo                    │
└───────────────────────────────────────────────────────┘
```

### Venta (NVDA a $150)

```
TÚ VENDES 0.5 NVDA @ $150
        ↓
┌───────────────────────────────────────────────────────┐
│ 1. node register-exit.js NVDA                         │
│    Prompts: cantidad, precio, razón, observaciones   │
│    → Calcula P&L: $15.45 (+25.96%)                   │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 2. ¿Confirmar? (s/n)                                  │
│    Inserta fila en inv_journal_exits (SUPABASE)      │
│    Retorna UUID: bdf4b00f-ed5f-4a0e-87b5-1596d170    │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 3. Automático: portfolio.json actualizado             │
│    nvda.shares: 2.60855 → 2.10855                     │
│    (register-exit.js lo hace, no manual)              │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 4. git add portfolio.json                             │
│    git commit -m "venta NVDA $150, +25.96%"           │
│    git push → GitHub (AUDITADO)                       │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 5. Próxima semana: node regenerate.js                │
│    • Lee portfolio.json (shares: 2.10855)             │
│    • Lee inv_journal_exits (venta + razón)            │
│    • Genera HTML → pestaña "Diario" muestra:         │
│      "Realizadas este mes: NVDA +25.96%"             │
└───────────────────────────────────────────────────────┘
```

---

## ✅ QUÉ NO NECESITAS GUARDAR LOCALMENTE

| Item | Razón | Solución |
|------|-------|----------|
| **Precios históricos** | Siempre frescos del API | `history.json` (1x/semana) |
| **P&L calculado** | Se regen cada semana | Calc on-the-fly en regenerate.js |
| **HTML viejo** | No es source | `.gitignore` reportes, regen cada week |
| **Cache de análisis puntual** | Ocupa espacio | Mantén solo últimas 12 entries en history.json |
| **Portafolios históricos** | Para qué? | Snapshot mensual en .portfolio-snapshot.json |

---

## 🎯 GARANTÍAS DE CONSISTENCIA

### "¿Qué pasa si pierdo la conexión a Supabase?"

**Compras sin inv_journal:**
```
✅ Editas portfolio.json, commitas a git
✅ Tienes la verdad: cantidades + costo
❌ Pierdes: tesis, fuentes (no crítico, puedes agregar después)
```

**Ventas sin inv_journal_exits:**
```
✅ register-exit.js actualiza portfolio.json automático
✅ Tienes la verdad: cantidad post-venta
❌ Pierdes: razón, P&L (no crítico, puedes agregar después)
```

**Regenerate sin Supabase:**
```
✅ Sigue funcionando: usa portfolio.json + history.json
✅ Muestra: portafolio, DCA, análisis macro
❌ Ocultará: tesis de compras (secc. "Diario" con warning)
```

### "¿Cómo verifico consistencia?"

```bash
# Comparar portfolio.json vs inv_journal
node audit-portfolio.js
# ✅ Output: "Todas las posiciones en portfolio.json tienen inv_journal entry"
# ❌ Output: "NVDA en portfolio pero sin entrada en journal"

# Comparar ventas registradas vs portfolio.json
# "¿Vendiste 0.5 NVDA pero portfolio dice 2.0 acciones aún?"
```

---

## 📈 ESCALABILIDAD

### Hoy (Hasta 20 posiciones)
```
portfolio.json: ~200 líneas
inv_journal: 3-5 filas (tus 3 compras)
dca-log.json: ~50 líneas (1 entry/mes × 50 meses)
history.json: ~100KB (1 entry/semana × 5 años)
```

### Mañana (50+ posiciones, 10+ años)
```
portfolio.json: ~300 líneas (same, escalable)
inv_journal: ~50-100 filas (solo compras discretas)
inv_journal_exits: ~30-50 filas (ventas)
dca-log.json: ~500 líneas (automático)
history.json: ~1MB (comprimible)

GitHub: ✅ Sin problema
Supabase: ✅ Sin problema (tablas pequeñas)
```

---

## 🔐 SEGURIDAD DE DATOS

```
LOCAL (Git)
├─ .env: ❌ NUNCA en repo (en .gitignore)
├─ portfolio.json: ✅ En repo (público OK)
├─ history.json: ✅ En repo (sin datos personales)
└─ reports/*.html: ❌ No en repo (genera cada week)

SUPABASE (Online)
├─ inv_journal: ✅ Privado (solo tu user_id)
├─ inv_journal_exits: ✅ Privado (solo tu user_id)
├─ RLS policies: ✅ Configurado (user_id check)
└─ Backups: ✅ Automático (Supabase)

GITHUB
├─ Secrets: ✅ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
├─ Actions: ✅ Corridas automáticas (run-weekly.sh)
└─ Auditoría: ✅ Git log de todo
```

---

## 💾 BACKUP STRATEGY

```
DIARIO (Local)
  portfolio.json → Auto en .git

SEMANAL (GitHub)
  git push → Todos los cambios auditados

MENSUAL (Supabase Auto)
  inv_journal → Backups automáticos
  inv_journal_exits → Backups automáticos

ANUAL (Manual, OPC)
  export inv_journal → JSON local
  export inv_journal_exits → JSON local
  zip reports/ → Archivo de reportes
```

---

## 🚀 PRÓXIMOS STEPS

### Ya Implementado ✅
- [x] portfolio.json (cantidades + costo)
- [x] inv_journal (3 compras NVDA/TSLA/NU)
- [x] dca-log.json (historial DCA)
- [x] history.json (análisis semanal)
- [x] regenerate.js (lee todo, genera HTML)
- [x] 4 pestañas (Dashboard, Diario, DCA, Análisis)

### Listo Implementar 🔨
- [ ] register-exit.js (DONE ✅ pero necesita tabla inv_journal_exits en Supabase)
- [ ] inv_journal_exits tabla (Supabase)
- [ ] Visualización de ventas en pestaña "Diario"

### Futuro 🎯
- [ ] `audit-portfolio.js` — consistencia local vs Supabase
- [ ] Dashboard "Histórico de decisiones" — todas tus compras/ventas
- [ ] Análisis "Tasa de acierto" — % de ventas rentables
- [ ] Métricas "Razones de venta más comunes"
