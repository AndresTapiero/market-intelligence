# Migración de history.json via Consola del Navegador

## Paso 1: Abre latest-report.html

1. Abre `latest-report.html` en tu navegador
2. Espera a que se cargue completamente y veas el dashboard

## Paso 2: Abre la Consola del Navegador

- **Chrome/Edge**: `Ctrl+Shift+J` (Windows) o `Cmd+Option+J` (Mac)
- **Firefox**: `Ctrl+Shift+K` (Windows) o `Cmd+Option+K` (Mac)

Deberías ver la consola (panel negro en la parte inferior o lateral).

## Paso 3: Copia y ejecuta el script

Lee el contenido de `scripts/migrate-via-console.js` y cópialo completamente en la consola:

```javascript
(async () => {
  console.log('🚀 Iniciando migración de history.json...');
  
  try {
    // ... [todo el código del script] ...
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
  }
})();
```

O más fácil: abre DevTools, ve a la pestaña **Console** y copia-pega TODO el contenido de `scripts/migrate-via-console.js`.

## Paso 4: Presiona Enter

El script se ejecutará y verás algo como:

```
🚀 Iniciando migración de history.json...
✅ Autenticado como: andrestapiero@gmail.com
📥 Cargados 4 reportes desde history.json
✅ Reporte 2026-06-11 insertado (uuid...)
✅ Reporte 2026-07-17 insertado (uuid...)
✅ Reporte 2026-07-26 insertado (uuid...)
✅ Reporte 4 de agosto de 2026 insertado (uuid...)

✅ Migración completada:
   - 4 reportes insertados
   - ~100 activos insertados

✨ Los datos de portafolio ahora están en Supabase
```

## Paso 5: Verifica en Supabase

1. Ve a https://app.supabase.com → tu proyecto
2. Abre **Table Editor**
3. Verifica:
   - `portfolio_history`: deberías ver 4 filas (semanas W24, W29, W31, W32)
   - `portfolio_assets`: deberías ver ~100 activos

## Troubleshooting

### "App no inicializada"
- Asegúrate de que `latest-report.html` se cargó completamente
- Espera 2-3 segundos y reintentar

### "Usuario no autenticado"
- Recarga la página (Ctrl+R)
- Verifica que el login funcionó (deberías ver "👤 andrestapiero@gmail.com" en la UI)

### El script se queda "cargando"
- Es normal si hay muchos activos (hasta 100+)
- Espera 30-60 segundos
- Si sigue sin responder, recarga y reintentar

### "TypeError: fetch failed"
- Problema de conectividad
- Verifica tu conexión a internet
- Reintentar más tarde

## ¿Qué hace el script?

1. ✅ Obtiene el cliente Supabase desde la app ya inicializada
2. ✅ Autentica usando la sesión actual del navegador
3. ✅ Carga `history.json` desde el servidor
4. ✅ Por cada reporte: inserta fila en `portfolio_history`
5. ✅ Por cada activo en el reporte: inserta fila en `portfolio_assets`

El script es seguro: usa Row Level Security, así que solo puede insertar datos propios (user_id coincide con el usuario autenticado).
