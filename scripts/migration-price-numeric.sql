-- Migración: portfolio_assets.price pasa de TEXT a numérico
--
-- Motivo: analyze.js guardaba el precio tal como lo devuelve el modelo,
-- la cadena "$63,736.05". La app hacía:
--
--     meta.price = parseFloat(row.price) || meta.price;
--
-- y parseFloat("$63,736.05") devuelve NaN, así que `NaN || meta.price`
-- se quedaba con el precio HARDCODEADO de js/data.js. Resultado: los
-- precios del análisis mensual nunca llegaron al dashboard.
--
-- Peor aún: si el modelo devolvía "63,736.05" sin el $, parseFloat da 63
-- (se detiene en la coma), lo que habría escrito 63 dólares como precio
-- de BTC sin lanzar ningún error.
--
-- Ejecutar en: Supabase → SQL Editor

ALTER TABLE portfolio_assets
  ADD COLUMN IF NOT EXISTS price_num numeric;

-- Backfill de los reportes históricos: quitar $, comas y espacios.
-- NULLIF evita que una cadena sin dígitos ("N/A", "—") reviente el cast.
UPDATE portfolio_assets
SET price_num = NULLIF(regexp_replace(price, '[^0-9.\-]', '', 'g'), '')::numeric
WHERE price IS NOT NULL
  AND price_num IS NULL;

-- Verificación: no debe quedar ninguna fila con price poblado y price_num nulo.
-- Si devuelve filas, revisa esos valores a mano antes de continuar.
SELECT report_id, asset_key, price
FROM portfolio_assets
WHERE price IS NOT NULL AND price_num IS NULL;

-- NOTA: la columna `price` (texto) se conserva a propósito, como registro
-- de auditoría y para poder revertir. Se elimina en la Fase 7, cuando el
-- flujo nuevo lleve un mes funcionando:
--   ALTER TABLE portfolio_assets DROP COLUMN price;
