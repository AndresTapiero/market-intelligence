-- Insertar solo reportes básicos (sin narrativas)
INSERT INTO portfolio_history (user_id, report_date, week, timestamp, portfolio_snapshot)
VALUES
('56272fef-8fd2-4adf-af86-ff9ed10cbed1', '2026-06-11', '2026-W24', '2026-06-11T17:41:04.787Z', '{"totalCrypto": 0, "totalStocks": 0, "cash": 0, "total": 0}'::jsonb),
('56272fef-8fd2-4adf-af86-ff9ed10cbed1', '2026-07-17', '2026-W29', '2026-07-17T17:00:09.203Z', '{"totalCrypto": 2314.86, "totalStocks": 624.82, "cash": 200, "total": 3139.68}'::jsonb),
('56272fef-8fd2-4adf-af86-ff9ed10cbed1', '2026-07-26', '2026-W31', '2026-07-26T12:55:45.827Z', '{"totalCrypto": 2145.55, "totalStocks": 841.55, "cash": 200, "total": 3187.1}'::jsonb),
('56272fef-8fd2-4adf-af86-ff9ed10cbed1', '2026-08-04', '2026-W32', '2026-08-04T15:14:07.318Z', '{"totalCrypto": 2295.06, "totalStocks": 836.74, "cash": 200, "total": 3331.8}'::jsonb);

-- Insertar activos para 2026-06-11
INSERT INTO portfolio_assets (report_id, asset_key, price, change_7d, signal)
SELECT id, 'btc', '$67,234', '-2.3%', 'BUY' FROM portfolio_history WHERE report_date = '2026-06-11'
UNION ALL SELECT id, 'eth', '$3,521', '-3.1%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-06-11'
UNION ALL SELECT id, 'voo', '$512', '+1.2%', 'BUY' FROM portfolio_history WHERE report_date = '2026-06-11'
UNION ALL SELECT id, 'qqq', '$485', '+0.8%', 'BUY' FROM portfolio_history WHERE report_date = '2026-06-11'
UNION ALL SELECT id, 'nvda', '$128', '-1.5%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-06-11'
UNION ALL SELECT id, 'nu', '$15.80', '+2.1%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-06-11'
ON CONFLICT (report_id, asset_key) DO NOTHING;

-- Insertar activos para 2026-07-17
INSERT INTO portfolio_assets (report_id, asset_key, price, change_7d, signal)
SELECT id, 'btc', '$63,130', '-1.5%', 'BUY' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'eth', '$1,832', '-3.5%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'sol', '$75.86', '-4.5%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'tao', '$190.70', '-2.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'uni', '$7.20', '-3.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'bnb', '$564.00', '-1.5%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'sui', '$2.10', '-4.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'sei', '$0.18', '-5.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'ena', '$0.32', '-6.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'avax', '$6.74', '-2.8%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'giga', '$0.0055', '-8.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'trump', '$1.55', '-5.9%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'voo', '$690.14', '-0.5%', 'BUY' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'qqq', '$705.94', '-1.6%', 'BUY' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'nvda', '$185.00', '+3.0%', 'BUY' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'nu', '$14.50', '+1.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'tsla', '$310.00', '-2.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
UNION ALL SELECT id, 'spx6900', '$0.3494', '-3.28%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-17'
ON CONFLICT (report_id, asset_key) DO NOTHING;

-- Insertar activos para 2026-07-26
INSERT INTO portfolio_assets (report_id, asset_key, price, change_7d, signal)
SELECT id, 'btc', '$64,250', '-1.2%', 'BUY' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'eth', '$1,875', '-3.1%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'sol', '$74.50', '-1.1%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'tao', '$192.00', '-4.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'uni', '$3.75', '+4.4%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'bnb', '$563.33', '-1.5%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'sui', '$0.74', '-3.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'sei', '$0.19', '-4.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'ena', '$0.32', '-5.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'avax', '$6.26', '-5.6%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'giga', '$0.00203', '-10.3%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'trump', '$1.56', '+1.4%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'spx6900', '$0.34', '-3.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'voo', '$679.14', '+0.3%', 'BUY' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'qqq', '$684.23', '-0.5%', 'BUY' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'nvda', '$206.84', '-4.5%', 'BUY' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'nu', '$14.09', '+4.4%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
UNION ALL SELECT id, 'tsla', '$313.03', '-4.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-07-26'
ON CONFLICT (report_id, asset_key) DO NOTHING;

-- Insertar activos para 2026-08-04
INSERT INTO portfolio_assets (report_id, asset_key, price, change_7d, signal)
SELECT id, 'btc', '$63,736.05', '+0.7%', 'BUY' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'eth', '$1,868.43', '-3.2%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'sol', '$73.32', '-2.4%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'tao', '$190.52', '-4.5%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'uni', '$3.86', '-5.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'bnb', '$592.23', '+1.5%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'sui', '$1.85', '-6.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'sei', '$0.19', '-7.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'ena', '$0.28', '-8.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'avax', '$6.87', '-9.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'giga', '$0.0023', '-10.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'trump', '$1.48', '-15.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'spx6900', '$0.35', '-6.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'voo', '$696.41', '+1.4%', 'BUY' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'qqq', '$612.35', '+1.8%', 'BUY' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'nvda', '$206.83', '-0.4%', 'BUY' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'nu', '$14.20', '+2.0%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
UNION ALL SELECT id, 'tsla', '$312.50', '-1.5%', 'HOLD' FROM portfolio_history WHERE report_date = '2026-08-04'
ON CONFLICT (report_id, asset_key) DO NOTHING;
