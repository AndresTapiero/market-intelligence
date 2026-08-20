-- Migración: agrega columna `tipo` a inv_journal
-- Motivo: el tipo de activo (stock/etf/crypto) que se elige en el modal de
-- compra nunca se guardaba en Supabase — solo se derivaba `categoria`
-- (core/satelite). Al sincronizar, un ticker nuevo sin tipo persistido caía
-- en un fallback por defecto a 'crypto', causando que activos como IREN se
-- clasificaran mal y no aparecieran en la tab Activos.
--
-- Ejecutar en: Supabase → SQL Editor

ALTER TABLE inv_journal
  ADD COLUMN IF NOT EXISTS tipo text;

ALTER TABLE inv_journal
  DROP CONSTRAINT IF EXISTS inv_journal_tipo_check;

ALTER TABLE inv_journal
  ADD CONSTRAINT inv_journal_tipo_check CHECK (tipo IS NULL OR tipo IN ('stock', 'etf', 'crypto'));

-- Backfill puntual: corrige la compra de IREN ya registrada (quedó sin tipo,
-- por lo que el sync la clasificaba como crypto por defecto).
UPDATE inv_journal
SET tipo = 'stock'
WHERE ticker = 'IREN' AND tipo IS NULL;

-- Nota: no hace falta backfillear el resto de filas históricas (BTC, VOO,
-- NVDA, etc.) — esos tickers ya existen en el baseline EXISTING_ASSETS de
-- data.js, así que el sync nunca llega a leer `tipo` para ellos.
