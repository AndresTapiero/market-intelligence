-- Migración: el cash pasa a tener su propia tabla
--
-- Motivo: el cash vivía en DOS sitios que nunca se hablaban.
--   - la app escribía en auth.user_metadata.cash_amount
--   - analyze.js leía de portfolio_history.portfolio_snapshot.cash,
--     que sólo escribe él mismo
--
-- Cada reporte mensual arrastraba el cash del reporte anterior, así que el
-- campo `total` de todo el histórico está mal — y la gráfica de evolución
-- del portafolio se dibuja sobre esos totales.
--
-- El `cash` que analyze.js sigue guardando dentro de portfolio_snapshot se
-- queda, pero como dato HISTÓRICO ("cuánto cash había el día del reporte"),
-- no como estado actual.
--
-- IMPORTANTE: esta migración debe correrse junto con el despliegue del
-- código de la fase 2. Si la tabla existe pero analyze.js sigue leyendo el
-- snapshot, el bug sigue vivo con un paso más de indirección.
--
-- Ejecutar en: Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS portfolio_cash (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portfolio_cash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own cash select" ON portfolio_cash;
DROP POLICY IF EXISTS "own cash insert" ON portfolio_cash;
DROP POLICY IF EXISTS "own cash update" ON portfolio_cash;

CREATE POLICY "own cash select" ON portfolio_cash
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own cash insert" ON portfolio_cash
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own cash update" ON portfolio_cash
  FOR UPDATE USING (auth.uid() = user_id);


-- ── Sembrado ────────────────────────────────────────────────────────────────
-- Toma como punto de partida el cash que la app venía guardando en
-- user_metadata (que es el valor REAL y actualizado), y si no existe cae al
-- del último reporte.
--
-- Esto siembra la fila de TODOS los usuarios que tengan alguno de los dos.
INSERT INTO portfolio_cash (user_id, amount)
SELECT
  u.id,
  COALESCE(
    (u.raw_user_meta_data ->> 'cash_amount')::numeric,
    (
      SELECT (h.portfolio_snapshot ->> 'cash')::numeric
      FROM portfolio_history h
      WHERE h.user_id = u.id
      ORDER BY h.report_date DESC
      LIMIT 1
    ),
    0
  )
FROM auth.users u
WHERE COALESCE(
        (u.raw_user_meta_data ->> 'cash_amount')::numeric,
        (
          SELECT (h.portfolio_snapshot ->> 'cash')::numeric
          FROM portfolio_history h
          WHERE h.user_id = u.id
          ORDER BY h.report_date DESC
          LIMIT 1
        )
      ) IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;


-- ── Verificación ────────────────────────────────────────────────────────────
-- Debe devolver una fila por usuario, con el cash correcto.
-- Compara `amount` contra `desde_metadata`: deberían coincidir.
SELECT
  c.user_id,
  c.amount                                        AS cash_actual,
  (u.raw_user_meta_data ->> 'cash_amount')::numeric AS desde_metadata,
  c.updated_at
FROM portfolio_cash c
JOIN auth.users u ON u.id = c.user_id;

-- Si `cash_actual` no es el monto real que tienes hoy en Hapi, corrígelo
-- desde la app con el botón "✏️ Actualizar", o a mano:
--
--   UPDATE portfolio_cash SET amount = <monto>, updated_at = now()
--   WHERE user_id = '<PORTFOLIO_USER_ID>';
