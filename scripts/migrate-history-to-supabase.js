/**
 * migrate-history-to-supabase.js
 * Script para cargar history.json a Supabase
 * Uso: node scripts/migrate-history-to-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'https://mglcfwkmwblihbpnjuwb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbGNmd2ttd2JsaWhicG5qdXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAyMDY0MDksImV4cCI6MjAzNTc4MjQwOX0.bBYDgKt0S3pKvI0-U5PzwRaHBn9GjNuW3MH7MvFzlXc';
const USER_ID = '56272fef-8fd2-4adf-af86-ff9ed10cbed1';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateHistoryJson() {
  try {
    // Leer history.json
    const historyPath = path.join(__dirname, '../history.json');
    if (!fs.existsSync(historyPath)) {
      console.error('❌ history.json no encontrado en:', historyPath);
      return;
    }

    const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    console.log(`📥 Cargados ${historyData.length} reportes desde history.json`);

    let reportsInserted = 0;
    let assetsInserted = 0;

    for (const report of historyData) {
      const { timestamp, week, data } = report;
      const reportDate = data.date;

      // Insertar reporte principal
      const reportPayload = {
        user_id: USER_ID,
        report_date: reportDate,
        week: week,
        timestamp: timestamp,
        analyst_opinion: data.analystOpinion || null,
        risk_profile: data.riskProfile || null,
        macro_data: {
          usdcop: data.macro?.usdcop,
          fed_rate: data.macro?.fedrate,
          btc_dominance: data.macro?.btcDominance,
          fear_greed_index: data.macro?.fearGreed,
          fear_greed_label: data.macro?.fearGreedLabel,
          narrative: data.macro?.narrative
        },
        portfolio_snapshot: data.portfolioSnapshot || null,
        actions: data.actions || []
      };

      const { data: insertedReport, error: reportError } = await supabase
        .from('portfolio_history')
        .insert([reportPayload])
        .select();

      if (reportError) {
        console.error(`⚠️ Error insertando reporte ${reportDate}:`, reportError.message);
        continue;
      }

      const reportId = insertedReport[0].id;
      reportsInserted++;

      // Insertar activos del reporte
      const assets = [];
      const assetKeys = Object.keys(data).filter(
        k => !['date', 'analystOpinion', 'riskProfile', 'macro', 'portfolioSnapshot', 'actions', 'newOpportunities', 'watchlist'].includes(k)
      );

      for (const key of assetKeys) {
        const assetData = data[key];
        if (assetData && typeof assetData === 'object' && assetData.price) {
          const assetPayload = {
            report_id: reportId,
            asset_key: key,
            price: assetData.price,
            change_7d: assetData.change7d || null,
            signal: assetData.signal || null,
            context: assetData.context || null
          };

          const { error: assetError } = await supabase
            .from('portfolio_assets')
            .insert([assetPayload]);

          if (!assetError) {
            assetsInserted++;
          } else {
            console.warn(`⚠️ Error insertando activo ${key}:`, assetError.message);
          }
        }
      }
    }

    console.log(`✅ Migración completada:`);
    console.log(`   - ${reportsInserted} reportes insertados`);
    console.log(`   - ${assetsInserted} activos insertados`);
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
  }
}

migrateHistoryJson();
