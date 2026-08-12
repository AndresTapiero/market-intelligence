/**
 * migrate-via-console.js
 * Script para ejecutar en la consola del navegador (F12)
 * Copia y pega en la consola cuando latest-report.html esté abierto
 */

(async () => {
  console.log('🚀 Iniciando migración de history.json...');

  try {
    // Obtener el cliente de Supabase desde la app global
    if (!window.app || !window.app.supabase) {
      console.error('❌ App no inicializada. Asegúrate de que latest-report.html esté cargado.');
      return;
    }

    const supabase = window.app.supabase;
    const user = window.app.authService.getCurrentUser();

    if (!user) {
      console.error('❌ Usuario no autenticado');
      return;
    }

    console.log(`✅ Autenticado como: ${user.email}`);

    // Cargar history.json
    const response = await fetch('./history.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const historyData = await response.json();

    console.log(`📥 Cargados ${historyData.length} reportes desde history.json`);

    let reportsInserted = 0;
    let assetsInserted = 0;

    for (const report of historyData) {
      const { timestamp, week, data } = report;
      const reportDate = data.date;

      // Insertar reporte principal
      const reportPayload = {
        user_id: user.id,
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
        console.warn(`⚠️ Error insertando reporte ${reportDate}:`, reportError.message);
        continue;
      }

      const reportId = insertedReport[0].id;
      reportsInserted++;
      console.log(`✅ Reporte ${reportDate} insertado (${reportId})`);

      // Insertar activos del reporte
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
          }
        }
      }
    }

    console.log(`\n✅ Migración completada:`);
    console.log(`   - ${reportsInserted} reportes insertados`);
    console.log(`   - ${assetsInserted} activos insertados`);
    console.log('\n✨ Los datos de portafolio ahora están en Supabase');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
  }
})();
