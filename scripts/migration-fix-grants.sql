-- Migración: conceder los GRANT que faltan
--
-- Síntoma: el análisis mensual fallaba con
--   permission denied for table portfolio_history
--
-- Causa: `service_role` solo tenía privilegios completos sobre inv_journal.
-- En portfolio_history, portfolio_assets y portfolio_cash únicamente tenía
-- TRUNCATE / REFERENCES / TRIGGER — el subconjunto que queda cuando los
-- privilegios por defecto de Supabase no llegan a aplicarse (típico al crear
-- tablas desde el SQL Editor con un owner distinto).
--
-- GRANT y RLS son cosas distintas y complementarias:
--   - GRANT decide si un rol puede tocar la tabla    -> si falta, "permission denied"
--   - RLS  decide qué FILAS puede ver dentro de ella -> si bloquea, devuelve 0 filas
-- Por eso el error era de permisos y no un resultado vacío.
--
-- `service_role` se salta RLS (lo necesita: analyze.js corre sin sesión).
-- `authenticated` NO se la salta: sus políticas auth.uid() = user_id siguen
-- filtrando por usuario. Conceder estos GRANT no expone datos de terceros.
--
-- A `anon` no se le concede nada: sin sesión no debe leerse nada.
--
-- Ejecutar en: Supabase → SQL Editor

-- ── service_role: acceso completo (lo usa analyze.js sin sesión) ────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_assets  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_cash    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inv_journal       TO service_role;

-- ── authenticated: lo que la app necesita, con RLS filtrando por usuario ────

-- portfolio_cash: no tenía NINGÚN privilegio, así que guardar el cash fallaba
-- en silencio y la app caía al fallback del último snapshot.
GRANT SELECT, INSERT, UPDATE ON portfolio_cash TO authenticated;

-- inv_journal: faltaba DELETE, y el boton de borrar de la bitacora lo usa.
GRANT SELECT, INSERT, DELETE ON inv_journal TO authenticated;

-- Ya los tenían, pero se repiten para que la migración sea idempotente
-- y no dependa de en qué estado esté cada entorno.
GRANT SELECT ON portfolio_history TO authenticated;
GRANT SELECT ON portfolio_assets  TO authenticated;


-- ── Verificación ────────────────────────────────────────────────────────────
-- Mantén table_name en el SELECT: sin esa columna no se puede saber a qué
-- tabla pertenece cada fila.
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('inv_journal', 'portfolio_assets', 'portfolio_cash', 'portfolio_history')
  AND grantee IN ('anon', 'authenticated', 'service_role')
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- Esperado:
--   inv_journal       | authenticated | DELETE, INSERT, SELECT
--   inv_journal       | service_role  | DELETE, INSERT, SELECT, UPDATE
--   portfolio_assets  | authenticated | SELECT
--   portfolio_assets  | service_role  | DELETE, INSERT, SELECT, UPDATE
--   portfolio_cash    | authenticated | INSERT, SELECT, UPDATE
--   portfolio_cash    | service_role  | DELETE, INSERT, SELECT, UPDATE
--   portfolio_history | authenticated | SELECT
--   portfolio_history | service_role  | DELETE, INSERT, SELECT, UPDATE
--
-- `anon` no debe aparecer en ninguna fila.
