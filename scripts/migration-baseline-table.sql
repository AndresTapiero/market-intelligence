-- Migración: el baseline de posiciones pasa a vivir en Supabase
--
-- Motivo: js/baseline.js consolidó tres copias divergentes del baseline en
-- una sola (fase 2), pero esa una copia seguía siendo un ARCHIVO DE CÓDIGO,
-- no Supabase — rompiendo la regla que seguimos en todo lo demás: si un dato
-- necesita cambiar, debe poder cambiar con SQL, no con un commit y un deploy.
--
-- El propio plan de refactor ya lo había anticipado:
--   "La tabla solo gana si algún día quieres editar el baseline sin
--   desplegar." Ese día llegó al corregir el costAvg de BTC/ENA/TAO/etc.
--   contra el tracker real: hubo que hacer un commit para un dato, cuando
--   todo lo demás (cash, tipo, precios) ya se corrige por SQL.
--
-- js/baseline.js NO se borra: queda como respaldo local si esta tabla no
-- existe o está vacía, con el mismo patrón de resiliencia que price_num y
-- portfolio_cash (intenta Supabase, si falla usa el archivo y avisa).
--
-- Ejecutar en: Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS portfolio_baseline (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker      text NOT NULL,
  qty         numeric NOT NULL DEFAULT 0,
  cost_avg    numeric NOT NULL DEFAULT 0,
  type        text NOT NULL CHECK (type IN ('stock', 'etf', 'crypto')),
  label       text NOT NULL,
  icon        text NOT NULL,
  color       text NOT NULL,
  seed_price  numeric NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ticker)
);

ALTER TABLE portfolio_baseline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own baseline select" ON portfolio_baseline;
DROP POLICY IF EXISTS "own baseline insert" ON portfolio_baseline;
DROP POLICY IF EXISTS "own baseline update" ON portfolio_baseline;

CREATE POLICY "own baseline select" ON portfolio_baseline
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own baseline insert" ON portfolio_baseline
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own baseline update" ON portfolio_baseline
  FOR UPDATE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_baseline TO service_role;
GRANT SELECT, INSERT, UPDATE          ON portfolio_baseline TO authenticated;


-- ── Sembrado ────────────────────────────────────────────────────────────────
-- Los 18 activos de js/baseline.js, ya con el costAvg corregido contra el
-- tracker real (btc, eth, tao, uni, sui, sei, ena). Reemplaza el UUID.

INSERT INTO portfolio_baseline (user_id, ticker, qty, cost_avg, type, label, icon, color, seed_price) VALUES
  ('<PORTFOLIO_USER_ID>', 'btc',     0.016271, 85319.32, 'crypto', 'Bitcoin',   '₿', '#f7931a', 63736.05),
  ('<PORTFOLIO_USER_ID>', 'eth',     0.1736,    2538.58, 'crypto', 'Ethereum',  'Ξ', '#627eea', 1868.43),
  ('<PORTFOLIO_USER_ID>', 'xrp',     0,               0, 'crypto', 'XRP',       'X', '#23292f', 0.52),
  ('<PORTFOLIO_USER_ID>', 'sol',     4.179,      173.74, 'crypto', 'Solana',    '◎', '#9945ff', 73.32),
  ('<PORTFOLIO_USER_ID>', 'tao',     0.7369,     332.38, 'crypto', 'Bittensor', 'τ', '#38bdf8', 190.52),
  ('<PORTFOLIO_USER_ID>', 'uni',     30.68,         8.92, 'crypto', 'Uniswap',   'U', '#ff007a', 3.86),
  ('<PORTFOLIO_USER_ID>', 'bnb',     0.1075,        673, 'crypto', 'BNB',       'B', '#f3ba2f', 592.23),
  ('<PORTFOLIO_USER_ID>', 'sui',     60.86,        3.723, 'crypto', 'SUI',       'S', '#6fbcf0', 1.85),
  ('<PORTFOLIO_USER_ID>', 'sei',     466.62,      0.2709, 'crypto', 'SEI',       's', '#e84142', 0.19),
  ('<PORTFOLIO_USER_ID>', 'ena',     249.59,      0.1499, 'crypto', 'Ethena',    'E', '#00d4ff', 0.28),
  ('<PORTFOLIO_USER_ID>', 'avax',    2.428,        18.93, 'crypto', 'Avalanche', 'A', '#e84142', 6.87),
  ('<PORTFOLIO_USER_ID>', 'giga',    873.2,       0.06385, 'crypto', 'GIGA',      'G', '#00d4ff', 0.0023),
  ('<PORTFOLIO_USER_ID>', 'trump',   1.151,        36.07, 'crypto', 'TRUMP',     'T', '#8250ff', 1.48),
  ('<PORTFOLIO_USER_ID>', 'spx6900', 37.87,         1.149, 'crypto', 'SPX6900',   'S', '#00d4a0', 0.35),
  ('<PORTFOLIO_USER_ID>', 'voo',     0.36947,     508.99, 'etf',    'VOO',       'V', '#00d4a0', 696.41),
  ('<PORTFOLIO_USER_ID>', 'qqq',     0.15618,     533.7,  'etf',    'QQQ',       'Q', '#4d8fff', 612.35),
  ('<PORTFOLIO_USER_ID>', 'nvda',    1.10855,     119.11, 'stock',  'NVIDIA',    'N', '#76b900', 206.83),
  ('<PORTFOLIO_USER_ID>', 'meta',    0,                0, 'stock',  'META',      'M', '#0081fb', 586.21),
  ('<PORTFOLIO_USER_ID>', 'iren',    0,                0, 'stock',  'IREN',      'I', '#ff6b35', 42.04)
ON CONFLICT (user_id, ticker) DO UPDATE SET
  qty = EXCLUDED.qty, cost_avg = EXCLUDED.cost_avg, type = EXCLUDED.type,
  label = EXCLUDED.label, icon = EXCLUDED.icon, color = EXCLUDED.color,
  seed_price = EXCLUDED.seed_price, updated_at = now();


-- ── Verificación ────────────────────────────────────────────────────────────
SELECT ticker, qty, cost_avg, type FROM portfolio_baseline ORDER BY ticker;
-- Debe devolver 19 filas (18 + XRP en cero).

-- A partir de aquí, corregir un dato es esto — sin commit, sin deploy:
--   UPDATE portfolio_baseline SET cost_avg = 12345.67
--   WHERE ticker = 'btc' AND user_id = '<PORTFOLIO_USER_ID>';
