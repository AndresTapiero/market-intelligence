# Migración de history.json a Supabase

## Paso 1: Crear las tablas en Supabase

1. Ve a tu proyecto Supabase: https://app.supabase.com
2. Navega a SQL Editor
3. Crea una nueva query y copia todo el contenido de `scripts/create-portfolio-history-tables.sql`
4. Ejecuta la query
5. Verifica que las tablas se crearon correctamente:
   - `portfolio_history` (reportes semanales)
   - `portfolio_assets` (datos de activos por reporte)

## Paso 2: Encontrar tu USER_ID

La migración necesita tu `user_id` autenticado. Hay dos formas de encontrarlo:

### Opción A: Desde la aplicación
1. Abre `latest-report.html` en el navegador
2. Abre la consola (F12)
3. Ejecuta: `window.app.authService.getCurrentUser().id`
4. Copia el UUID que aparece

### Opción B: Desde Supabase
1. Ve a Authentication → Users en tu proyecto Supabase
2. Busca tu usuario (andrestapiero@gmail.com)
3. Copia el UID

## Paso 3: Actualizar el script de migración

Edita `scripts/migrate-history-to-supabase.js` y reemplaza:
```javascript
const USER_ID = '5f7d8e9a-1234-5678-abcd-ef1234567890'; // ← Aquí va tu user_id
```

Con tu UUID real.

## Paso 4: Ejecutar la migración

```bash
cd ~/Documents/Personal/market-intelligence
node scripts/migrate-history-to-supabase.js
```

Deberías ver:
```
📥 Cargados 4 reportes desde history.json
✅ Migración completada:
   - 4 reportes insertados
   - X activos insertados
```

## Paso 5: Verificar en Supabase

1. Ve a Table Editor en tu proyecto Supabase
2. Abre `portfolio_history` - deberías ver los 4 reportes (semanas W24, W29, W31, W32)
3. Abre `portfolio_assets` - deberías ver ~100+ activos

## Paso 6: Actualizar la UI

La aplicación ya tiene todo listo en `js/portfolio-history-service.js`. 

Para mostrar la composición del portafolio en `latest-report.html`:

1. Importa el servicio en `latest-report.html`:
```javascript
import { PortfolioHistoryService } from './js/portfolio-history-service.js';
```

2. En `app.js`, agregalo a la inicialización:
```javascript
this.portfolioHistoryService = new PortfolioHistoryService(this.supabase, this.authService);
```

3. Carga el reporte más reciente:
```javascript
const latestReport = await this.portfolioHistoryService.getLatestReport();
const composition = await this.portfolioHistoryService.loadPortfolioComposition(latestReport.id);
```

## Estructura de datos

### portfolio_history
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "report_date": "2026-08-04",
  "week": "2026-W32",
  "analyst_opinion": "texto...",
  "risk_profile": "Moderado-Agresivo",
  "macro_data": {
    "usdcop": "$3,230.44 COP",
    "fed_rate": "4.25%-4.50%",
    "btc_dominance": "56.4%",
    "fear_greed_index": "27",
    "narrative": "..."
  },
  "portfolio_snapshot": {
    "totalCrypto": 2295.06,
    "totalStocks": 836.74,
    "cash": 200,
    "total": 3331.8
  }
}
```

### portfolio_assets
```json
{
  "id": "uuid",
  "report_id": "uuid",
  "asset_key": "btc",
  "price": "$63,736.05",
  "change_7d": "+0.7%",
  "signal": "BUY",
  "context": "BTC subio cerca de 2%..."
}
```

## Troubleshooting

### Error: "relation 'portfolio_history' does not exist"
- Asegúrate de que ejecutaste el SQL en el paso 1
- Recarga la página después de crear las tablas

### Error: "user_id is invalid"
- Verifica que copiaste correctamente el USER_ID en `migrate-history-to-supabase.js`
- El UUID debe estar en formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### La migración se ejecuta pero no inserta nada
- Verifica que `history.json` existe en la raíz del proyecto
- Asegúrate de ejecutar `node` desde el directorio correcto

## Siguientes pasos

Una vez migrado:
1. Deletea `history.json` (ya no es necesario)
2. Actualiza `latest-report.html` para cargar datos desde Supabase
3. Crea visualizaciones de composición del portafolio
4. Implementa gráficos de evolución histórica
