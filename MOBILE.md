# Móvil — App sin APK + Ventas Parciales/Totales

## 📱 Usa como App en Celular (Sin APK)

### Opción 1: PWA (Progressive Web App) — RECOMENDADO

#### En iPhone (iOS)
```
1. Abre Safari
2. Ve a: http://tudominio.com/reports/report-YYYY-WXX.html
   (o si es local: http://localhost:8000/reports/report-YYYY-WXX.html)

3. Tap ↑ (share icon arriba)
4. Tap "Add to Home Screen"
5. Dale nombre: "Market Intel"
6. Tap "Add"

✅ Listo. Abre como app (sin URL bar, sin botones Safari)
```

#### En Android (Chrome)
```
1. Abre Chrome
2. Ve a: http://tudominio.com/reports/report-YYYY-WXX.html

3. ⋮ (menú 3 puntos) arriba derecha
4. "Install app" o "Instalar"
5. Confirma

✅ Listo. Se instala en home como app (sin APK descargado)
```

### Opción 2: Compartir HTML local (sin servidor)

**Si no quieres usar servidor:**
```bash
# 1. Genera reporte localmente
node regenerate.js

# 2. Copia el archivo HTML a un lugar accesible
# Opción A: Dropbox/Google Drive (comparte link)
# Opción B: GitHub Pages (push + habilita Pages)
# Opción C: Vercel (conecta repo, auto-deploy)

# 3. Accede desde móvil
# Si usas Dropbox: el HTML abre en el navegador
# Si usas GitHub Pages: dirección URL pública
# Si usas Vercel: auto-genera HTTPS + PWA manifest
```

### Opción 3: Servidor Local (LAN)

```bash
# En tu Mac (que genera los reportes):
cd ~/Documents/Personal/market-intelligence
python3 -m http.server 8000

# En tu iPhone/Android (misma WiFi):
# Safari/Chrome → http://192.168.1.100:8000/reports/report-2026-W33.html
# (reemplaza 192.168.1.100 con tu IP de Mac)

# Luego "Add to Home Screen" (igual que arriba)
```

---

## 🛒 VENTAS: Parciales vs Totales

### Ya Está Soportado ✅

El script `register-exit.js` **SÍ maneja ventas parciales y totales**:

```javascript
// register-exit.js línea 69-74
const quantity = parseFloat(quantityStr);
if (quantity <= 0 || quantity > qty) {
  console.log(`❌ Cantidad inválida (tienes ${qty})`);
  process.exit(1);
}
```

**Validación:**
- ✅ Venta parcial: `¿Cuánto vendes? 0.5` (si tienes 1.0)
- ✅ Venta total: `¿Cuánto vendes? 1.0` (si tienes 1.0)
- ❌ Venta inválida: `¿Cuánto vendes? 1.5` (si tienes 1.0) → Error

### Ejemplo: Venta Parcial NVDA

```bash
$ node register-exit.js NVDA

📤 Registrando venta de NVDA
  Cantidad actual: 1.10855 acciones
  Costo promedio: $119.11

¿Cuánto vendes? 0.5           # ← Venta PARCIAL
¿A qué precio por unidad? 150
¿Razón de venta?
  1. Toma de ganancias
  2. Stop loss / Reducción de pérdida
  ...
Selecciona (1-6): 1

Observaciones: Ganancia buena, reinvirtiendo en VOO

📊 Resumen de venta:
  Monto bruto: $75.00
  Costo base: $59.55 (0.5 × $119.11)
  Ganancia: $15.45 (25.96%)

¿Confirmar? (s/n): s

✅ Venta registrada en Supabase (id: bdf4b00f...)
✅ portfolio.json actualizado: nvda.shares = 0.60855
```

### Portfolio Actualizado

```json
// portfolio.json ANTES
{
  "stocks": {
    "nvda": {
      "shares": 1.10855,
      "costAvg": 119.11
    }
  }
}

// portfolio.json DESPUÉS de vender 0.5
{
  "stocks": {
    "nvda": {
      "shares": 0.60855,    // ← 1.10855 - 0.5
      "costAvg": 119.11     // ← Se mantiene (histórico)
    }
  }
}
```

### En Supabase: inv_journal_exits

**Registro de venta parcial:**
```sql
SELECT * FROM inv_journal_exits WHERE ticker = 'NVDA';

 id                  | ticker | numero_acciones_vendidas | precio_salida | ganancia_pct | razon_venta
 bdf4b00f-ed5f-4a0e | NVDA   | 0.5                      | 150           | 25.96        | Toma de ganancias
```

**Si luego vendes el resto:**
```bash
$ node register-exit.js NVDA

📤 Registrando venta de NVDA
  Cantidad actual: 0.60855 acciones  # ← Actualizado del paso anterior
  Costo promedio: $119.11

¿Cuánto vendes? 0.60855   # ← Venta TOTAL (lo que queda)
¿A qué precio por unidad? 155

# ... Confirmas ...

✅ Venta registrada (segunda fila en inv_journal_exits)
✅ portfolio.json actualizado: nvda.shares = 0
```

**Resultado en inv_journal_exits:**
```sql
 id                  | ticker | numero_acciones_vendidas | precio_salida | ganancia_pct
 bdf4b00f-ed5f-4a0e | NVDA   | 0.5                      | 150           | 25.96
 cda8f2c0-123e-5b1p | NVDA   | 0.60855                  | 155           | 30.12
```

---

## 📊 Visualización de Ventas en Móvil

### Pestaña "Diario de Inversiones"

**En el reporte HTML, la pestaña "📓 Diario" muestra:**

```
COMPRAS DISCRETAS
├─ NVDA
│  ├─ Fecha: 2025-01-28
│  ├─ Invertido: $132.04
│  ├─ Acciones: 1.10855
│  └─ P&L actual: +$13.45 (+10.2%)
│
├─ TSLA
│  └─ ...
│
└─ NU
   └─ ...

RENDIMIENTO DETALLADO
├─ Acciones: +$186 (+23.1%) [después de todas las transacciones]
└─ Crypto: -$205 (-16.5%)
```

**Lógica:**
- ✅ `numero_acciones_vendidas` de `inv_journal_exits` **resta automáticamente** del total
- ✅ P&L se calcula: `(precio_actual - precio_promedio) × acciones_reales`
- ✅ Si vendiste TODO: aparece con 0 acciones, solo P&L histórico

### Próximo: Panel "Realizadas este Mes"

(Planeado para v23)
```
POSICIONES CERRADAS
├─ NVDA: Vendidas 0.5 + 0.60855 = 1.10855 total
│  ├─ Venta 1: 0.5 @ $150 → +$15.45 (25.96%)
│  ├─ Venta 2: 0.60855 @ $155 → +$18.25 (30.12%)
│  └─ Total NVDA: +$33.70 (+28.5% promedio)
│
└─ [Más vendidas...]
```

---

## 🔄 Flujo Móvil Completo

### Día 1: Ves portafolio en móvil
```
1. Abre la app (PWA instalada)
2. Click en "📓 Diario"
3. Ves posiciones: NVDA $13.45 ganancia
4. "Hmm, vendo media posición a $150"
```

### Día 1b: Registras venta (Terminal en Mac)
```bash
$ node register-exit.js NVDA
# ... prompts ...
# ✅ Registrado en Supabase
```

### Día 2: Ves cambio en móvil
```
1. Recarga app (o espera a que se auto-actualice)
2. Pestaña "Diario" ahora muestra:
   - NVDA: 0.60855 acciones (antes 1.10855)
   - P&L recalculado con cantidad nueva
3. En la sección "Realizadas": 
   - NVDA venta parcial: 0.5 @ $150 → +25.96%
```

---

## 🚀 Deploy para Móvil Permanente

### Opción: GitHub Pages (Gratis + HTTPS)

```bash
# 1. En tu repo, habilita GitHub Pages
# Settings → Pages → Build from main branch

# 2. Copia manifest.json a raíz
# (Ya está en tu repo)

# 3. El HTML accesible en:
# https://andrestapiero.github.io/market-intelligence/reports/report-2026-W33.html

# 4. En móvil: "Add to Home Screen"
# ✅ App instalada con PWA manifest
```

### Opción: Vercel (Recomendado)

```bash
# 1. Conecta tu repo a Vercel
# (5 minutos, no requiere instalación)

# 2. Vercel auto-deploy cada push
# 3. URL: https://market-intelligence.vercel.app/reports/...
# 4. PWA automático (manifest + HTTPS)
```

---

## ✅ Resumen: Ya Funciona Todo

| Feature | Status | Cómo |
|---------|--------|------|
| **Ventas parciales** | ✅ Funciona | `node register-exit.js` valida `qty <= acciones_reales` |
| **Ventas totales** | ✅ Funciona | Mismo script, pero `qty = acciones_totales` |
| **App en móvil** | ✅ Funciona | PWA: "Add to Home Screen" (sin APK) |
| **Visualización móvil** | ✅ Funciona | CSS responsive + media queries |
| **Acceso local** | ✅ Funciona | `python3 -m http.server` en Mac |
| **Deploy permanente** | ✅ Disponible | GitHub Pages o Vercel |

---

## 📋 Checklist: Móvil + Ventas

- [x] `register-exit.js` soporta parciales/totales
- [x] Validación de cantidad implementada
- [x] PWA manifest creado
- [x] CSS responsive OK (media queries)
- [x] Viewport móvil configurado
- [x] Puedes abrir como app (sin APK)
- [ ] (Futuro) Panel "Realizadas este mes"
- [ ] (Futuro) Widget iOS/Android (home screen)
