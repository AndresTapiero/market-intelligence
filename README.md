# 📊 Market Intelligence — Análisis Semanal de Portafolio

Corre cada lunes automáticamente, consulta el mercado en tiempo real con IA y genera un reporte HTML con señales de inversión personalizadas para tu portafolio.

---

## 🚀 Instalación (una sola vez)

### 1. Prerrequisitos

Verifica que tienes Node.js instalado:
```bash
node --version   # debe mostrar v18 o superior
```

Si no lo tienes: https://nodejs.org/en/download

### 2. Instalar dependencias

```bash
cd market-intelligence
npm install
```

### 3. Configurar tu API Key de Anthropic

Abre tu terminal y agrega esto a `~/.zshrc` (Mac) o `~/.bash_profile`:

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-tu-key-aqui"
```

Luego recarga:
```bash
source ~/.zshrc
```

Puedes obtener tu API key en: https://console.anthropic.com/settings/keys

### 4. Configurar el cron job (tarea semanal automática)

```bash
bash setup-cron.sh
```

Esto configura el script para correr **cada lunes a las 7:00 AM** automáticamente.

---

## ▶️ Uso manual

Para correr el análisis ahora mismo:

```bash
node analyze.js
```

El reporte se abre automáticamente en tu navegador y se guarda en `reports/`.

---

## 📁 Estructura del proyecto

```
market-intelligence/
├── analyze.js          # Script principal — llama la API y orquesta todo
├── generate-report.js  # Genera el HTML del dashboard
├── history.js          # Guarda historial semana a semana (JSON local)
├── setup-cron.sh       # Configura la tarea automática semanal
├── package.json
├── README.md
│
├── reports/            # Reportes históricos (se crean automáticamente)
│   ├── report-2026-W24.html
│   ├── report-2026-W25.html
│   └── ...
│
├── latest-report.html  # Siempre el reporte más reciente
├── history.json        # Historial de señales (se crea automáticamente)
└── logs/
    └── cron.log        # Log de ejecuciones del cron
```

---

## 🔧 Personalización

Para actualizar tu portafolio (cuando cambien tus posiciones), edita el objeto `PORTFOLIO` al inicio de `analyze.js`:

```js
const PORTFOLIO = {
  crypto: {
    btc: { qty: 0.01303, costAvg: 82716 },  // ← actualiza qty y costo
    eth: { qty: 0.1733 },
  },
  stocks: {
    voo:  { val: 244.79, gainPct: 30 },     // ← actualiza tras cada DCA
    // ...
  },
  debt: {
    davivienda: 1559681,                     // ← actualiza mensualmente
    rappi: 3580796,
  },
  // ...
};
```

---

## 📋 Ver logs del cron

```bash
npm run logs
# o
tail -f logs/cron.log
```

---

## ❌ Eliminar el cron job

```bash
crontab -e
# Borra la línea que contiene "market-intelligence"
```

---

## 💡 Notas

- El historial se guarda en `history.json` y se muestra en el dashboard (últimas 8 semanas)
- Cada reporte queda guardado en `reports/` con el label de semana (ej: `report-2026-W24.html`)
- `latest-report.html` siempre apunta al más reciente para acceso rápido
- El cron requiere que el Mac esté encendido a las 7 AM del lunes — si está apagado, corre manualmente con `node analyze.js`
