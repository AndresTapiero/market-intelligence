-- Crear tabla portfolio_history para reportes semanales
CREATE TABLE IF NOT EXISTS portfolio_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  week TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  analyst_opinion TEXT,
  risk_profile TEXT,
  macro_data JSONB,
  portfolio_snapshot JSONB,
  actions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, report_date)
);

-- Crear tabla portfolio_assets para activos en cada reporte
CREATE TABLE IF NOT EXISTS portfolio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES portfolio_history(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  price TEXT,
  change_7d TEXT,
  signal TEXT,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(report_id, asset_key)
);

-- Crear índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_portfolio_history_user_id ON portfolio_history(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_date ON portfolio_history(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_assets_report_id ON portfolio_assets(report_id);

-- Habilitar Row Level Security
ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;

-- Política RLS para portfolio_history (usuarios solo ven sus propios reportes)
CREATE POLICY "Users can view own portfolio history"
  ON portfolio_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio history"
  ON portfolio_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio history"
  ON portfolio_history
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política RLS para portfolio_assets (a través de portfolio_history)
CREATE POLICY "Users can view own portfolio assets"
  ON portfolio_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portfolio_history
      WHERE portfolio_history.id = portfolio_assets.report_id
      AND portfolio_history.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert portfolio assets"
  ON portfolio_assets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolio_history
      WHERE portfolio_history.id = report_id
      AND portfolio_history.user_id = auth.uid()
    )
  );
