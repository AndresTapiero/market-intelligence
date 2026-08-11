# Market Intelligence

Tu sistema de inversiones personal. Portafolio híbrido (crypto + acciones), análisis automático, diario de decisiones con auditoría.

**Status:** ✅ v22 — Diario de inversiones conectado a Supabase + 4 pestañas navegables + registro de ventas

---

## 🎯 En 30 segundos

```bash
# 1. Edita portfolio.json (cantidades + costo promedio)
# 2. node regenerate.js
# 3. Abre reports/report-YYYY-WXX.html en navegador
```

**4 Pestañas:**
- 📊 **Dashboard** — Resumen ejecutivo
- 📓 **Diario** — Tus posiciones discretas (NVDA/TSLA/NU) con tesis
- 💰 **DCA** — Inversión automática (Bitcoin/VOO/QQQ)
- 🔍 **Análisis** — Asignación objetivo vs real

---

## 🏗️ Stack

| Capa | Tech | Propósito |
|------|------|----------|
| **UI** | HTML + JS vanilla | 4 pestañas sin dependencias |
| **Datos locales** | portfolio.json (Git) | Cantidades + costo, auditado |
| **Datos cloud** | Supabase (PostgreSQL) | inv_journal (compras), inv_journal_exits (ventas) |
| **Lógica** | Node.js | regenerate.js, register-exit.js, dca-log.js |
| **CI** | GitHub Actions | Análisis semanal + regenerar HTML |

---

## 📊 Estructura

```
market-intelligence/
├── portfolio.json              ← Fuente única de verdad (qty + costo)
├── history.json                ← Análisis semanal (1 entry/semana)
├── dca-log.json                ← Bitácora DCA
│
├── generate-report.js          ← HTML generador (4 pestañas)
├── regenerate.js               ← Orquesta todo
├── register-exit.js            ← Registra ventas
├── supabase-client.js          ← Client Supabase
│
├── .env                        ← SUPABASE_URL + SERVICE_ROLE_KEY (.gitignore)
├── reports/                    ← HTML semanal (no versionar)
│
└── docs/
    ├── ARCHITECTURE.md         ← Conceptual: dónde va cada dato
    ├── WORKFLOW.md             ← Práctico: compra/venta/DCA
    └── STACK.md                ← Técnico: flujos de datos
```

---

## 🚀 Operación

### Compra discrecional (NVDA/TSLA/NU)

```bash
# 1. Edita portfolio.json
# 2. node regenerate.js
# 3. (OPC) node register-entry.js TICKER  (registra tesis en Supabase)
# 4. git add . && git commit && git push
```

### DCA automático (Bitcoin/VOO)

```bash
# 1. Broker compra automático
# 2. Edita portfolio.json
# 3. git add . && git commit (dca-log.js autogenera entrada)
```

### Venta (NEW)

```bash
# node register-exit.js TICKER
# → Prompts: cantidad, precio, razón, observaciones
# → Inserta en inv_journal_exits (Supabase)
# → Actualiza portfolio.json automático
# git add . && git commit
```

---

## 🔐 Seguridad

- **portfolio.json** → ✅ En git (decisiones auditadas)
- **.env** → ❌ .gitignore (credenciales locales)
- **Supabase secrets** → ✅ GitHub Actions
- **RLS** → ✅ Configurado (solo tu user_id)

---

## 📚 Documentación

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Qué guardar dónde (conceptual)
- **[WORKFLOW.md](./WORKFLOW.md)** — Cómo operar (práctico)
- **[STACK.md](./STACK.md)** — Flujos de datos (técnico)

👉 **Si vas a operar hoy:** [WORKFLOW.md](./WORKFLOW.md)  
👉 **Si quieres entender:** [ARCHITECTURE.md](./ARCHITECTURE.md)  
👉 **Si quieres profundizar:** [STACK.md](./STACK.md)

---

## ✅ Implementado

- Portfolio híbrido (crypto + acciones + DCA)
- 3 posiciones en Supabase (NVDA/TSLA/NU)
- 4 pestañas navegables
- Registro de ventas (register-exit.js)
- Análisis semanal automático

---

## 🔨 Por hacer

- Tabla `inv_journal_exits` en Supabase
- Visualización de ventas en pestaña "Diario"
- Script `register-entry.js` (compra discrecional)

---

**Última actualización:** 2026-08-11 | **Build:** v22
