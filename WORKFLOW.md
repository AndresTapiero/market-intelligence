# Workflow — Cómo Operar Market Intelligence

## 1️⃣ COMPRA DISCRECIONAL (Stock-picking: NVDA, TSLA, NU)

### Escenario: Compras 1.5 acciones de APPLE a $180

```bash
# Paso 1: Editas portfolio.json
# Busca "apple" en stocks, actualiza:
# "apple": {
#   "shares": 0.5,  →  1.0   (sumaste 0.5 acciones)
#   "costAvg": 170  →  175.5  (recalcula automático o manual)
# }

# Paso 2: Valida los cambios
node regenerate.js
# ✅ Output: "Apple +2.3%" → tu nuevo P&L

# Paso 3: Registra en Supabase (auditoría de TESIS)
# NUEVO: node register-entry.js APPLE
# → Prompts:
#   ¿Tesis de inversión? "Dominio de mercado, producto integrado"
#   ¿3 fuentes de valoracion? "DCF, Comparables, Sentimiento mercado"
#   ¿Precio objetivo? "$200"
#   ¿Margen de seguridad? "11%"
# → Inserta fila en inv_journal con UUID

# Paso 4: Git commit (auditoría de cantidades)
git add portfolio.json
git commit -m "portfolio: compra APPLE 2026-08-15, 0.5 acciones a $180"
git push
```

**Resultado:**
- ✅ `portfolio.json`: Actualizado (qty = 1.0, costAvg = 175.5)
- ✅ `inv_journal` (Supabase): Fila con tesis, fuentes, objetivo
- ✅ `git log`: Commit auditable con fecha y cantidad
- ✅ `regenerate.js`: Próxima semana mostrará P&L actualizado

---

## 2️⃣ COMPRA SISTEMÁTICA (DCA: Bitcoin/VOO/QQQ)

### Escenario: Tu DCA automático compró 0.00125 BTC en Julio

```bash
# Paso 1: Actualiza portfolio.json
# "btc": {
#   "qty": 0.016271  →  0.016521  (sumaste 0.0025 USD/7 = ~0.00125 BTC @ $63k)
# }

# Paso 2: Valida
node regenerate.js
# ✅ Output: "Bitcoin +1.2%" → tu nuevo P&L total

# Paso 3: NO registra en inv_journal (es sistemático, sin tesis)
# dca-log.js automáticamente genera entrada en dca-log.json

# Paso 4: Git commit (igual auditoría)
git add portfolio.json dca-log.json
git commit -m "portfolio: DCA BTC julio 2026, +0.00125 unidades"
git push
```

**Resultado:**
- ✅ `portfolio.json`: Actualizado (qty = 0.016521)
- ✅ `dca-log.json`: Entrada automática con fecha/cantidad/precio
- ❌ `inv_journal`: No necesita (es automático, sin decisión discretional)
- ✅ `regenerate.js`: Muestra evolución acumulada del DCA

---

## 3️⃣ VENTA (Nuevo Workflow)

### Escenario: Vendes 0.5 acciones de NVDA a $150 (compraste a $119)

```bash
# Paso 1: Registra la venta
node register-exit.js NVDA

# Prompts:
# ¿Cuánto vendes? 0.5
# ¿A qué precio? $150
# ¿Razón de venta? (1-6)
#   1. Toma de ganancias  ← SELECCIONAS ESTA
# Observaciones? "Ganancia buena, necesito cash para Tesla"

# Paso 2: Valida P&L
# Output:
# 📊 Resumen de venta:
#   Monto bruto: $75.00
#   Costo base: $59.55 (0.5 × $119.11)
#   Ganancia: $15.45 (25.96%)
# ¿Confirmar? (s/n): s

# Paso 3: Automático
# a) inv_journal_exits: Inserta fila (Supabase)
# b) portfolio.json: Actualiza NVDA.shares (1.10855 → 0.60855)
# c) Git commit (manual):
git add portfolio.json
git commit -m "portfolio: venta NVDA 2026-08-15, 0.5 acciones a $150, +25.96%"
git push
```

**Resultado:**
- ✅ `inv_journal_exits` (Supabase): Registro permanente con razón
- ✅ `portfolio.json`: Cantidad actualizada (shares = 0.60855)
- ✅ `git log`: Commit con ganancia %
- ✅ `regenerate.js`: Próximo HTML muestra "Realizadas: NVDA +25.96%"

---

## 4️⃣ VISUALIZAR TODO (Semanal)

```bash
# Miércoles 10 AM
node regenerate.js
# Lee:
#   - portfolio.json (cantidades actuales)
#   - history.json (últimos análisis)
#   - inv_journal (tus compras discretas)
#   - inv_journal_exits (tus ventas)
# Genera: reports/report-YYYY-WXX.html

# Abre en navegador
# Click en pestañas:
# 📊 Dashboard: resumen semanal
# 📓 Diario: tus posiciones + tesis
# 💰 DCA: Bitcoin/VOO/QQQ automático
# 🔍 Análisis: asignación objetivo vs real
```

---

## 5️⃣ FLUJO COMPLETO MES A MES

```
INICIO DE MES
├─ run-weekly.sh (GitHub Actions)
│  ├─ analyze.js → OpenAI → genera history.json entry
│  └─ regenerate.js → lee todo, genera HTML
│
DURANTE EL MES
├─ Compra discrecional NVDA?
│  ├─ Edita portfolio.json
│  ├─ node register-entry.js NVDA (tesis → Supabase)
│  ├─ git add + commit + push
│  └─ Espera semana siguiente para HTML actualizado
│
├─ DCA automático?
│  ├─ Broker (Hapi/Kraken) compra automático
│  ├─ Edita portfolio.json (qty actualizada)
│  ├─ dca-log.js autogenera entrada
│  ├─ git add + commit
│  └─ (Sin Supabase, es sistemático)
│
├─ Venta de NVDA?
│  ├─ node register-exit.js NVDA
│  ├─ inv_journal_exits registra venta + razón
│  ├─ portfolio.json actualiza cantidad
│  ├─ git add + commit
│  └─ Próximo HTML mostrará "Realizadas" section
│
FIN DE MES / ANÁLISIS
├─ Lectura: Diario de Inversiones pestaña
│  ├─ Compras: tesis, fuentes, objetivos
│  ├─ Ventas: razones, resultados
│  ├─ P&L: ganancias/pérdidas por posición
│  └─ Próximos: QQQ, BTC siguen planes?
│
└─ Review futuro:
   ├─ ¿Por qué compré TESLA a $302? (Supabase: ver tesis)
   ├─ ¿Vendí a ganancia o pérdida? (inv_journal_exits: ver razón)
   └─ ¿Estrategia funcionó? (Comparar entrada vs salida)
```

---

## 📊 Qué VES en Cada Pestaña

### 📊 DASHBOARD
- Totales: invertido vs actual vs P&L
- Converter USD/COP simulador
- Análisis asesor (macro, oportunidades)
- Score de salud (1-10)
- Señales de mercado (BUY/HOLD/WAIT)
- Decisiones recomendadas

### 📓 DIARIO DE INVERSIONES
**COMPRAS DISCRETAS**
```
NVDA (Satelite)
├─ Fecha: 2025-01-28
├─ Invertido: $132.04
├─ Acciones: 1.10855
├─ Precio entrada: $119.11
├─ Tesis: "Crecimiento IA"
├─ Fuentes: ["DCF", "Comparables"]
├─ Precio objetivo: $150
├─ Margen seguridad: 25%
├─ Checklist disciplina: 
│  ✓ Tesis escrita
│  ✓ 3 fuentes
│  ✓ Margen seguridad OK
│  ✓ Límite posición OK
└─ P&L: +$13.45 (+10.2%)

[Similar para TSLA, NU]
```

**RENDIMIENTO DETALLADO**
```
Acciones · 5
├─ VOO: +$257 (+41.3%)
├─ QQQ: +$95 (+15.6%)
├─ NVDA: +$13.45 (+10.2%)
├─ TSLA: -$5.20 (-13.3%)
└─ NU: +$6.11 (+75%)

Crypto · 13
├─ Bitcoin: -$205 (-16.5%)
├─ Ethereum: -$115 (-26.2%)
└─ [11 más...]
```

### 💰 INVERSIÓN SISTEMÁTICA
```
DCA TRACKER
├─ Bitcoin: $50 USD/mes (próximo 1 de mes)
├─ Acciones: $50 USD/mes (próximo 30 de mes)
└─ Cash: $200 USD (ej: del último mes)

BITÁCORA DE COMPRAS
├─ 2026-08-01 BTC +0.00154 a $76,370 = $117.69
├─ 2026-07-31 SPX6900 +37.87 a $1.149 = $43.51
└─ [Historial completo]

PRÓXIMOS EVENTOS
├─ 1 agosto: DCA Bitcoin
├─ 15 agosto: Análisis semanal
└─ 30 agosto: DCA Acciones
```

### 🔍 ANÁLISIS DETALLADO
```
ASIGNACIÓN OBJETIVO vs REAL
├─ Bitcoin: 35.4% actual / 30% objetivo → +5.4pp
├─ ETFs: 0% / 38% → -38pp (OPORTUNIDAD)
├─ Acciones individuales: 21.7% / 25% → -3.3pp
└─ Altcoins: 42.9% / 15% → +27.9pp (EXCESO)

💡 Recomendación: Aumentar ETFs a $X
```

---

## 🔑 SHORTCUTS TERMINAL

```bash
# Regen completo (compra/venta/DCA todo)
node regenerate.js

# Registrar NUEVA compra (discretional)
node register-entry.js TICKER

# Registrar VENTA
node register-exit.js TICKER

# Ver último reporte
open reports/report-2026-W33.html

# Ver git history (auditoria)
git log --oneline portfolio.json

# Ver diario Supabase
# (abre: https://app.supabase.com → inv_journal)
```

---

## 🚨 REGLAS IMPORTANTES

✅ **SIEMPRE:**
- `git push` después de editar portfolio.json
- Registra tesis ANTES de comprar (Supabase)
- Registra razón de venta INMEDIATAMENTE

❌ **NUNCA:**
- Edites portfolio.json sin git commit
- Dejes .env en git (revisar .gitignore)
- Borres history.json (es tu historial)
- Olvides `node regenerate.js` después de cambios

🔄 **CADA SEMANA:**
- run-weekly.sh → actualiza HTML con precios nuevos
- Revisa "Diario" pestaña → ¿Tus posiciones en plan?

📝 **CADA MES:**
- Review: ¿Cumpliste los targets de asignación?
- Review: ¿Vendiste a ganancia/pérdida? ¿Por qué?
- Review: ¿DCA automático funcionó?
