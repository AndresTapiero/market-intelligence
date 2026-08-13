/**
 * app.js
 * Facade Pattern - Orquestador principal
 * Coordina todos los servicios y expone interfaz simple al HTML
 */

import { SUPABASE_CONFIG } from './config.js';
import { AuthService } from './auth-service.js';
import { PortfolioService } from './portfolio-service.js';
import { PortfolioHistoryService } from './portfolio-history-service.js';
import { TransactionService } from './transaction-service.js';
import { UIManager } from './ui-manager.js';

class InvestmentApp {
  constructor() {
    this.supabase = null;
    this.authService = null;
    this.portfolioService = null;
    this.portfolioHistoryService = null;
    this.transactionService = null;
    this.uiManager = null;
  }

  /**
   * Inicializa la aplicación
   */
  async initialize() {
    try {
      // Cargar SDK de Supabase
      const { createClient } = window.supabase;
      this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

      // Crear servicios (Dependency Injection)
      this.authService = new AuthService(this.supabase);
      this.portfolioService = new PortfolioService(this.supabase, this.authService);
      this.portfolioHistoryService = new PortfolioHistoryService(this.supabase, this.authService);
      this.transactionService = new TransactionService(this.supabase, this.authService);
      this.uiManager = new UIManager(this.authService);

      console.log('✅ Supabase inicializado');

      // Intentar obtener sesión existente
      const session = await this.authService.getSession();
      if (session) {
        await this.afterLogin();
      } else {
        document.getElementById('login-gate').style.display = 'flex';
        document.getElementById('login-email').focus();
      }
    } catch (err) {
      console.error('❌ Error inicializando app:', err.message);
    }
  }

  async afterLogin() {
    document.getElementById('login-gate').style.display = 'none';
    await this.portfolioService.loadTransactions();
    await this.portfolioHistoryService.loadHistoricalReports();
    this.uiManager.updateAuthStatus();
    await this._syncPortfolioFromSupabase();
  }

  async _syncPortfolioFromSupabase() {
    // Show sync loader
    const loader = document.getElementById('syncLoader');
    if (loader) loader.classList.add('visible');

    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      // 1. Cargar precios y señales desde portfolio_assets (último reporte)
      await this._loadLatestAssetData();

      // 2. Cargar todas las transacciones en orden cronológico
      const { data, error } = await this.supabase
        .from('inv_journal')
        .select('ticker, numero_acciones, precio_entrada, precio_salida, inversion_monto, comision, monto_neto, ganancia_perdida_pct, fecha_venta, razon_venta, tesis_inversion, fecha')
        .eq('user_id', user.id)
        .order('fecha', { ascending: true });

      if (error) throw error;
      if (!data?.length) return;

      // Clonar baseline para no mutar el original
      const computed = JSON.parse(JSON.stringify(window.EXISTING_ASSETS));

      // Aplicar transacciones sobre el baseline clonado
      data.forEach(row => {
        const ticker = row.ticker.toLowerCase();
        const qty    = parseFloat(row.numero_acciones) || 0;
        const price  = parseFloat(row.precio_entrada)  || 0;
        const isSell = !!row.fecha_venta;

        if (isSell) {
          if (computed[ticker]) {
            computed[ticker].qty = Math.max(0, computed[ticker].qty - qty);
          }
        } else {
          if (computed[ticker]) {
            const prev   = computed[ticker];
            const newQty = prev.qty + qty;
            computed[ticker].costAvg = newQty > 0
              ? (prev.qty * prev.costAvg + qty * price) / newQty
              : price;
            computed[ticker].qty = newQty;
          } else {
            const assetMeta = window.ASSET_DATA?.find(a => a.ticker === row.ticker);
            computed[ticker] = {
              qty, costAvg: price,
              type:  assetMeta?.type  || 'crypto',
              label: assetMeta?.label || row.ticker,
              fundamento: ''
            };
          }
        }
      });

      // REEMPLAZAR (no mutar) — garantiza que cualquier lectura de window.EXISTING_ASSETS
      // obtenga el objeto actualizado incluso si hay referencias estales
      window.EXISTING_ASSETS = computed;

      console.log('✅ Portafolio sincronizado desde Supabase');
      window.populateAssetSelects?.();
      this._rerenderPortfolio();
      this._updateStickyBar();
      this._updateResumenCards();
      this._updateAnalisisTab();
      await this._loadBuyHistory();
      document.dispatchEvent(new CustomEvent('portfolio-synced'));

      // Cargar historial de ventas
      const sells = data.filter(r => !!r.fecha_venta);
      if (sells.length) {
        window.SELL_HISTORY = sells.reverse().map(r => {
          const qty    = r.numero_acciones || 0;
          const price  = r.precio_salida   || 0;
          const costAvg = r.precio_entrada  || 0;
          const gross  = r.inversion_monto  || qty * price;
          const comm   = r.comision         || 0;
          const net    = r.monto_neto       || gross - comm;
          const pnl    = net - qty * costAvg;
          const pnlPct = r.ganancia_perdida_pct ?? (costAvg > 0 ? pnl / (qty * costAvg) * 100 : 0);
          return {
            key: r.ticker.toLowerCase(), ticker: r.ticker,
            qty, price, costAvg, gross, commission: comm, net, pnl, pnlPct,
            date: r.fecha_venta
              ? new Date(r.fecha_venta).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
              : '—',
            reason: r.razon_venta || ''
          };
        });
        console.log(`✅ ${window.SELL_HISTORY.length} ventas cargadas`);
        window.renderSellHistory?.();
      }
    } catch (err) {
      console.warn('⚠️ Error sincronizando portafolio:', err.message);
    } finally {
      // Hide sync loader
      const loaderEl = document.getElementById('syncLoader');
      if (loaderEl) loaderEl.classList.remove('visible');
    }
  }

  async _loadLatestAssetData() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      // Obtener el último reporte
      const { data: reports } = await this.supabase
        .from('portfolio_history')
        .select('id, report_date, portfolio_snapshot')
        .eq('user_id', user.id)
        .order('report_date', { ascending: false })
        .limit(1);

      if (!reports?.length) return;
      const report = reports[0];

      // Cargar cash desde user_metadata (siempre actualizado, sincronizado entre dispositivos)
      const { data: { user: authUser } } = await this.supabase.auth.getUser();
      if (authUser?.user_metadata?.cash_amount !== undefined) {
        window.CURRENT_CASH = authUser.user_metadata.cash_amount;
      } else if (report.portfolio_snapshot?.cash !== undefined) {
        // Fallback: snapshot del último reporte (migración desde esquema anterior)
        window.CURRENT_CASH = report.portfolio_snapshot.cash;
      }
      if (typeof window.updateCashDisplayPublic === 'function') window.updateCashDisplayPublic();

      // Obtener activos del último reporte
      const { data: assets } = await this.supabase
        .from('portfolio_assets')
        .select('asset_key, price, change_7d, signal, context')
        .eq('report_id', report.id);

      if (!assets?.length) return;

      // Actualizar ASSET_DATA con precios y señales de Supabase
      const metaMap = {};
      (window.ASSET_DATA || []).forEach(a => { metaMap[a.ticker.toLowerCase()] = a; });

      assets.forEach(row => {
        const key  = row.asset_key.toLowerCase();
        const meta = metaMap[key];
        if (!meta) return;
        // Actualizar precio y señal desde Supabase (fuente de verdad del reporte)
        if (row.price)     meta.price   = parseFloat(row.price)   || meta.price;
        if (row.change_7d) meta.change  = row.change_7d;
        if (row.signal)    meta.signal  = row.signal;
        if (row.context)   meta.context = row.context;
      });

      console.log(`✅ Precios y señales actualizados desde reporte ${report.report_date}`);

      // Update report date line in resumen tab
      const el = document.getElementById('reportDateLine');
      if (el) {
        el.textContent = 'Reporte de inversiones · ' + new Date(report.report_date).toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      }
    } catch (err) {
      console.warn('⚠️ Error cargando asset data:', err.message);
    }
  }

  /**
   * Calcula y actualiza los valores de la sticky bar dinámicamente
   */
  _updateAnalisisTab() {
    try {
      const assets    = window.EXISTING_ASSETS || {};
      const assetData = window.ASSET_DATA || [];
      const cash      = window.CURRENT_CASH || 0;

      // Calcular valores por categoría
      let btcVal = 0, etfVal = 0, stockVal = 0, altVal = 0, totalCrypto = 0, totalStocks = 0;

      assetData.forEach(a => {
        const key = a.ticker.toLowerCase();
        const h   = assets[key];
        if (!h || h.qty <= 0) return;
        const val = h.qty * a.price;

        if (a.type === 'etf')    { etfVal    += val; totalStocks += val; }
        else if (a.type === 'stock') { stockVal  += val; totalStocks += val; }
        else if (key === 'btc')  { btcVal    += val; totalCrypto += val; }
        else                     { altVal    += val; totalCrypto += val; }
      });

      const total = totalCrypto + totalStocks + cash;
      if (total <= 0) return;

      const pct = v => (v / total * 100);
      const fmtPct = v => v.toFixed(1) + '%';
      const gap = (actual, target) => {
        const diff = actual - target;
        const el_cls = diff >= 0 ? 'neg' : 'pos'; // sobre el objetivo = negativo (ya lo tienes)
        return { text: (diff >= 0 ? '-' : '+') + Math.abs(diff).toFixed(1) + 'pp', cls: el_cls };
      };

      const setBar = (barId, pctId, gapId, val, target) => {
        const p    = pct(val);
        const barEl  = document.getElementById(barId);
        const pctEl  = document.getElementById(pctId);
        const gapEl  = document.getElementById(gapId);
        if (barEl) barEl.style.width = Math.min(p, 100).toFixed(1) + '%';
        if (pctEl) pctEl.textContent = fmtPct(p);
        if (gapEl) {
          const g = gap(p, target);
          gapEl.textContent = g.text;
          gapEl.className   = 'alloc-gap mono num ' + g.cls;
        }
      };

      setBar('allocBtcBar',   'allocBtcPct',   'allocBtcGap',   btcVal,   30);
      setBar('allocEtfBar',   'allocEtfPct',   'allocEtfGap',   etfVal,   30);
      setBar('allocStockBar', 'allocStockPct', 'allocStockGap', stockVal, 25);
      setBar('allocAltBar',   'allocAltPct',   'allocAltGap',   altVal,   15);

      // Hint dinámico: categoría más alejada del objetivo
      const gaps = [
        { name: 'ETFs',            diff: 30 - pct(etfVal)   },
        { name: 'Acciones indiv.', diff: 25 - pct(stockVal) },
        { name: 'Altcoins',        diff: pct(altVal) - 15   },
        { name: 'Bitcoin',         diff: pct(btcVal) - 30   },
      ];
      const mostNeeded = gaps.filter(g => g.diff > 0).sort((a,b) => b.diff - a.diff)[0];
      const hintEl = document.getElementById('allocHint');
      if (hintEl && mostNeeded) {
        hintEl.innerHTML = '💡 Tu próxima inversión debería priorizar <strong>' + mostNeeded.name + '</strong> (' + mostNeeded.diff.toFixed(1) + ' pp por debajo del objetivo).';
      } else if (hintEl) {
        hintEl.textContent = '✅ Portafolio alineado con los objetivos de asignación.';
      }

      // Actualizar COP widget con valores reales
      if (window.COP_DATA) {
        window.COP_DATA.totalUsd  = totalCrypto + totalStocks;
        window.COP_DATA.cryptoUsd = totalCrypto;
        window.COP_DATA.stocksUsd = totalStocks;
        window.COP_DATA.cashUsd   = cash;
        if (typeof window.initCopWidget === 'function') window.initCopWidget();
      }
    } catch (err) {
      console.warn('⚠️ Error actualizando análisis:', err.message);
    }
  }

  _updateResumenCards() {
    try {
      const assets    = window.EXISTING_ASSETS || {};
      const assetData = window.ASSET_DATA || [];

      let totalCrypto = 0, totalStocks = 0, costCrypto = 0, costStocks = 0;
      const stockResults = [], cryptoResults = [];

      assetData.forEach(a => {
        const key = a.ticker.toLowerCase();
        const h   = assets[key];
        if (!h || h.qty <= 0) return;
        const val  = h.qty * a.price;
        const cost = h.qty * h.costAvg;
        const pnlPct = ((a.price - h.costAvg) / h.costAvg * 100);
        const entry = { ticker: a.ticker, label: a.label || a.ticker, val, cost, pnlPct, change: a.change || '—' };
        if (a.type === 'stock' || a.type === 'etf') { totalStocks += val; costStocks += cost; stockResults.push(entry); }
        else                    { totalCrypto += val; costCrypto += cost; cryptoResults.push(entry); }
      });

      const totalMarket = totalCrypto + totalStocks;
      const totalCost   = costCrypto + costStocks;
      const pnl         = totalMarket - totalCost;
      const pnlPct      = totalCost > 0 ? (pnl / totalCost * 100) : 0;
      const cryptoPnlPct = costCrypto > 0 ? ((totalCrypto - costCrypto) / costCrypto * 100) : 0;
      const stocksPnlPct = costStocks > 0 ? ((totalStocks - costStocks) / costStocks * 100) : 0;
      const cash         = window.CURRENT_CASH || 0;

      const fmtD  = n => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 });
      const fmtPct = (n, plus=true) => (n >= 0 && plus ? '+' : n < 0 ? '' : '') + n.toFixed(1) + '%';
      const cls   = n => n >= 0 ? 'pos' : 'neg';
      const set   = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      const setClass = (id, c) => { const el = document.getElementById(id); if (el) el.className = c; };

      // Totals bar
      set('resumeCostBase',       fmtD(totalCost));
      set('resumeCryptoCost',     fmtD(costCrypto));
      set('resumeStocksCost',     fmtD(costStocks));
      set('resumeMarket',         fmtD(totalMarket));
      set('resumeCryptoMarket',   fmtD(totalCrypto));
      set('resumeStocksMarket',   fmtD(totalStocks));
      set('resumePnl',            (pnl >= 0 ? '+' : '-') + fmtD(pnl));
      setClass('resumePnl',       'total-value num ' + cls(pnl));
      set('resumePnlPct',         fmtPct(pnlPct) + ' sobre capital');
      setClass('resumePnlPct',    'total-sub ' + cls(pnl));
      set('resumeCryptoPnlPct',   'Crypto ' + fmtPct(cryptoPnlPct));
      setClass('resumeCryptoPnlPct', cls(cryptoPnlPct));
      set('resumeStocksPnlPct',   'Acc. ' + fmtPct(stocksPnlPct));
      setClass('resumeStocksPnlPct', cls(stocksPnlPct));
      set('resumeTotal',          fmtD(totalMarket + cash));
      set('resumeCash',           fmtD(cash));

      // Ratio bars
      const cryptoRatio = totalMarket > 0 ? Math.round(totalCrypto / totalMarket * 100) : 0;
      const stocksRatio = 100 - cryptoRatio;
      const rc = document.getElementById('ratioCrypto'), rs = document.getElementById('ratioStocks');
      if (rc) { rc.style.width = cryptoRatio + '%'; const lbl = rc.querySelector('.ratio-label'); if (lbl) lbl.textContent = 'Crypto ' + cryptoRatio + '%'; }
      if (rs) { rs.style.width = stocksRatio + '%'; const lbl = rs.querySelector('.ratio-label'); if (lbl) lbl.textContent = 'Acc. '    + stocksRatio + '%'; }

      // Score items
      const si = document.getElementById('scoreItems');
      if (si) si.innerHTML =
        `<div class="score-item">📊 Balance ${cryptoRatio}/${stocksRatio} crypto/acc.</div>` +
        `<div class="score-item ${cls(cryptoPnlPct)}">₿ Crypto P&L ${fmtPct(cryptoPnlPct)}</div>` +
        `<div class="score-item ${cls(stocksPnlPct)}">📈 Acciones P&L ${fmtPct(stocksPnlPct)}</div>` +
        `<div class="score-item pos">✓ DCA activo</div>`;

      // BTC break-even
      const btcA = assetData.find(a => a.ticker === 'BTC');
      const btcH = assets['btc'];
      if (btcA && btcH && btcH.qty > 0) {
        const bePct  = ((btcH.costAvg - btcA.price) / btcA.price * 100);
        const beEl   = document.getElementById('btcBreakevenPct');
        if (beEl) { beEl.textContent = (bePct > 0 ? '+' : '') + bePct.toFixed(1) + '%'; beEl.style.color = bePct > 0 ? 'var(--orange)' : 'var(--green)'; }
        set('btcBreakevenCost',  '$' + btcH.costAvg.toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 }));
        set('btcBreakevenPrice', '$' + btcA.price.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }));
        set('btcBreakevenSub',   (bePct > 0 ? 'Falta ' : 'Superado por ') + Math.abs(bePct).toFixed(1) + '% para break-even');
      }

      // Mejor/Peor acción
      const fillCard = (tickerId, changeId, subId, asset, colorCls) => {
        set(tickerId, asset.ticker);
        const chEl = document.getElementById(changeId);
        if (chEl) { chEl.textContent = asset.change; chEl.style.color = asset.pnlPct >= 0 ? 'var(--green)' : 'var(--red)'; }
        set(subId, `${asset.label} · ${fmtD(asset.val)} · P&L ${fmtPct(asset.pnlPct)}`);
      };
      if (stockResults.length) {
        const sorted = [...stockResults].sort((a,b) => b.pnlPct - a.pnlPct);
        fillCard('bestStockTicker',  'bestStockChange',  'bestStockSub',  sorted[0]);
        fillCard('worstStockTicker', 'worstStockChange', 'worstStockSub', sorted[sorted.length-1]);
      }
      if (cryptoResults.length) {
        const sorted = [...cryptoResults].sort((a,b) => b.pnlPct - a.pnlPct);
        fillCard('bestCryptoTicker',  'bestCryptoChange',  'bestCryptoSub',  sorted[0]);
        fillCard('worstCryptoTicker', 'worstCryptoChange', 'worstCryptoSub', sorted[sorted.length-1]);
      }
    } catch (err) {
      console.warn('⚠️ Error actualizando resumen cards:', err.message);
    }
  }

  _updateStickyBar() {
    try {
      const assets = window.EXISTING_ASSETS || {};
      const assetData = window.ASSET_DATA || [];

      let total = 0;
      let costBase = 0;

      assetData.forEach(function(asset) {
        const key = asset.ticker.toLowerCase();
        const holding = assets[key];
        if (!holding || holding.qty <= 0) return;
        total += holding.qty * asset.price;
        costBase += holding.qty * holding.costAvg;
      });

      const cashAmount = window.CURRENT_CASH || 0;
      total += cashAmount;

      const pnl = total - cashAmount - costBase; // PnL solo sobre activos invertidos

      // BTC price
      const btcAsset = assetData.find(a => a.ticker === 'BTC');
      const btcPrice = btcAsset ? btcAsset.price : null;

      // Update DOM
      const totalEl = document.getElementById('stickyTotal');
      const pnlEl = document.getElementById('stickyPnl');
      const btcEl = document.getElementById('stickyBtc');

      const fmtUSD = n => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      if (totalEl) totalEl.textContent = fmtUSD(total);

      if (pnlEl) {
        const isPos = pnl >= 0;
        pnlEl.textContent = (isPos ? '+' : '-') + fmtUSD(pnl);
        pnlEl.className = 'sticky-stat-val num ' + (isPos ? 'pos' : 'neg');
      }

      if (btcEl && btcPrice !== null) {
        btcEl.textContent = '$' + btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      // Actualizar cards del tab Resumen (si ya están cargados)
      const resumeTotal = document.getElementById('resumeTotal');
      const resumeCash  = document.getElementById('resumeCash');
      if (resumeTotal) resumeTotal.textContent = fmtUSD(total);
      if (resumeCash)  resumeCash.textContent  = fmtUSD(cashAmount);
    } catch (err) {
      console.warn('⚠️ Error actualizando sticky bar:', err.message);
    }
  }

  /**
   * Carga la bitácora de compras desde inv_journal (solo filas sin fecha_venta)
   */
  async _loadBuyHistory() {
    const container = document.getElementById('logScroll');
    if (!container) return;

    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const { data, error } = await this.supabase
        .from('inv_journal')
        .select('id, ticker, numero_acciones, precio_entrada, inversion_monto, fecha')
        .eq('user_id', user.id)
        .is('fecha_venta', null)
        .order('fecha', { ascending: false });

      if (error) throw error;

      container.innerHTML = '';

      if (!data || !data.length) {
        container.innerHTML = '<div class="log-empty" style="padding:14px 0;text-align:center;font-size:11px">Sin compras registradas.</div>';
        return;
      }

      const colors = window.ASSET_COLORS || {};
      const emptyEl = document.getElementById('logEmpty');

      data.forEach(row => {
        const ticker = (row.ticker || '').toUpperCase();
        const key = ticker.toLowerCase();
        const color = colors[key] || 'var(--text)';
        const qty = parseFloat(row.numero_acciones) || 0;
        const price = parseFloat(row.precio_entrada) || 0;
        const amount = parseFloat(row.inversion_monto) || qty * price;
        const dateStr = row.fecha
          ? new Date(row.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—';
        const monthKey = row.fecha ? row.fecha.substring(0, 7) : 'all';

        const div = document.createElement('div');
        div.className = 'log-row';
        div.dataset.month = monthKey;
        div.innerHTML = `
          <div class="log-date mono">${dateStr}</div>
          <div class="log-asset"><span class="mono" style="color:${color}">${ticker}</span></div>
          <div class="log-qty mono">+${qty % 1 === 0 ? qty.toLocaleString('en-US') : qty.toLocaleString('en-US', { maximumFractionDigits: 6 })}</div>
          <div class="log-price mono">$${price.toLocaleString('en-US', { minimumFractionDigits: price < 1 ? 4 : 2, maximumFractionDigits: price < 1 ? 6 : 2 })}</div>
          <div class="log-amount mono pos">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div><button class="log-del-btn" title="Eliminar" onclick="window.deleteTransaction(${row.id})">🗑</button></div>
        `;
        container.appendChild(div);
      });

      // Apply current month filter
      const filterEl = document.getElementById('logMonthFilter');
      if (filterEl && typeof window.filterLogByMonth === 'function') {
        window.filterLogByMonth(filterEl.value);
      }

      // Note: enable deletes by creating RLS policy in Supabase if needed:
      // CREATE POLICY "Delete own entries" ON inv_journal FOR DELETE USING (auth.uid() = user_id);
    } catch (err) {
      console.warn('⚠️ Error cargando bitácora de compras:', err.message);
      const container2 = document.getElementById('logScroll');
      if (container2) container2.innerHTML = '<div class="log-empty" style="color:var(--red);padding:14px 0;text-align:center;font-size:11px">Error al cargar bitácora.</div>';
    }
  }

  /**
   * Elimina una transacción por ID y recarga la bitácora
   */
  async deleteTransaction(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const { error } = await this.supabase
        .from('inv_journal')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await this._syncPortfolioFromSupabase();
    } catch (err) {
      console.warn('⚠️ Error eliminando transacción:', err.message);
      alert('No se pudo eliminar. Verifica que la política RLS esté activa:\nCREATE POLICY "Delete own entries" ON inv_journal FOR DELETE USING (auth.uid() = user_id);');
    }
  }

  /**
   * Refresca el portafolio manualmente (botón ↺)
   */
  async refreshPortfolio() {
    await this._syncPortfolioFromSupabase();
  }

  async updateCash(newAmount) {
    window.CURRENT_CASH = Math.max(0, newAmount);

    try {
      // Guardar en user_metadata de Supabase Auth
      // No requiere tablas ni políticas extra — el usuario puede actualizar sus propios metadatos
      const { error } = await this.supabase.auth.updateUser({
        data: { cash_amount: window.CURRENT_CASH }
      });
      if (error) throw error;
      console.log('✅ Cash guardado en user metadata:', window.CURRENT_CASH);
    } catch (err) {
      console.warn('⚠️ Error guardando cash:', err.message);
    }
  }

  async _loadSellHistoryFromSupabase() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const { data, error } = await this.supabase
        .from('inv_journal')
        .select('ticker, numero_acciones, precio_salida, inversion_monto, comision, monto_neto, ganancia_perdida_pct, precio_entrada, fecha_venta, razon_venta, tesis_inversion')
        .eq('user_id', user.id)
        .not('fecha_venta', 'is', null)
        .order('fecha_venta', { ascending: false });

      if (error) throw error;
      if (!data?.length) return;

      window.SELL_HISTORY = data.map(r => {
        const qty    = r.numero_acciones || 0;
        const price  = r.precio_salida   || 0;
        const costAvg = r.precio_entrada  || 0;
        const gross  = r.inversion_monto || qty * price;
        const comm   = r.comision        || 0;
        const net    = r.monto_neto      || gross - comm;
        const pnl    = net - (qty * costAvg);
        const pnlPct = r.ganancia_perdida_pct ?? (costAvg > 0 ? (pnl / (qty * costAvg) * 100) : 0);
        const date   = r.fecha_venta
          ? new Date(r.fecha_venta).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—';
        return {
          key: r.ticker.toLowerCase(),
          ticker: r.ticker,
          qty, price, gross, commission: comm, net, pnl, pnlPct, date,
          reason: r.razon_venta || ''
        };
      });

      console.log(`✅ ${window.SELL_HISTORY.length} ventas cargadas desde Supabase`);
      window.renderSellHistory?.();
    } catch (err) {
      console.warn('⚠️ Error cargando historial de ventas:', err.message);
    }
  }

  async doLogin() {
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    errEl.style.display = 'none';
    if (!email || !password) {
      errEl.textContent = 'Ingresa tu correo y contraseña para continuar.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Conectando…';
    try {
      await this.authService.signInWithPassword(email, password);
      await this.afterLogin();
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('invalid login credentials')) {
        errEl.textContent = 'Correo o contraseña incorrectos.';
      } else if (msg.includes('email not confirmed')) {
        errEl.textContent = 'Confirma tu correo antes de continuar — revisa tu bandeja de entrada.';
      } else if (msg.includes('network') || msg.includes('fetch')) {
        errEl.textContent = 'Sin conexión. Verifica tu red e intenta de nuevo.';
      } else {
        errEl.textContent = 'No se pudo iniciar sesión. Intenta de nuevo.';
      }
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  /**
   * Expone métodos públicos para el HTML
   */

  // === Modales ===
  openBuyModal() {
    this.uiManager.openBuyModal();
  }

  closeBuyModal() {
    this.uiManager.closeBuyModal();
  }

  openSellModal() {
    this.uiManager.openSellModal();
  }

  closeSellModal() {
    this.uiManager.closeSellModal();
  }

  // === Previews ===
  updateBuyPreview() {
    this.uiManager.updateBuyPreview();
  }

  updateSellPreview() {
    const assetKey = document.getElementById('sellAssetSelect')?.value;
    if (!assetKey) return;
    const asset = window.EXISTING_ASSETS?.[assetKey];
    if (asset) {
      this.uiManager.updateSellPreview(asset.qty, asset.costAvg);
    }
  }

  updateSellQtyButtons() {
    const assetKey = document.getElementById('sellAssetSelect')?.value;
    if (!assetKey) return;

    const asset = window.EXISTING_ASSETS?.[assetKey];
    if (asset) {
      this.uiManager.updateSellQtyOptions(asset.qty);
      document.getElementById('sellQty').value = '';
      document.getElementById('sellPreview').style.display = 'none';
    }
  }

  setSellQuantityType(type) {
    const assetKey = document.getElementById('sellAssetSelect')?.value;
    const asset = window.EXISTING_ASSETS?.[assetKey];
    if (asset) {
      this.uiManager.setSellQuantityType(type, asset.qty, asset.costAvg);
    }
  }

  // === Historial ===
  async getHistoricalReports() {
    return await this.portfolioHistoryService.loadHistoricalReports();
  }

  async getLatestReport() {
    return await this.portfolioHistoryService.getLatestReport();
  }

  async getPortfolioComposition(reportId) {
    return await this.portfolioHistoryService.loadPortfolioComposition(reportId);
  }

  // === Transacciones ===
  async submitBuy() {
    try {
      const key = window.getSelectedAssetKey?.();
      const qty = parseFloat(document.getElementById('buyQty')?.value) || 0;
      const price = parseFloat(document.getElementById('buyPrice')?.value) || 0;
      const date = document.getElementById('buyDate')?.value || new Date().toISOString().split('T')[0];
      const fundamento = document.getElementById('buyFundamento')?.value.trim() || null;
      const targetPrice = parseFloat(document.getElementById('buyTargetPrice')?.value) || null;
      const isNew = document.getElementById('buyAssetSelect')?.value === '__new__';
      const newType = document.getElementById('buyNewType')?.value || 'crypto';

      if (!key || qty <= 0 || price <= 0) {
        this.uiManager.showError('Completa el activo, la cantidad y el precio.');
        return;
      }

      this.uiManager.setButtonLoading('#buyModalOverlay .modal-submit', true);

      const result = await this.transactionService.recordBuy(key, qty, price, fundamento, date, targetPrice, newType);

      if (result.success) {
        this.uiManager.setButtonSuccess('#buyModalOverlay .modal-submit');
        setTimeout(() => {
          this.closeBuyModal();
          this._refreshBalanceAfterBuy(key, qty, price, isNew, newType);
        }, 1000);
      } else {
        this.uiManager.showError(result.error);
        this.uiManager.setButtonLoading('#buyModalOverlay .modal-submit', false);
      }
    } catch (err) {
      this.uiManager.showError(err.message);
      this.uiManager.setButtonLoading('#buyModalOverlay .modal-submit', false);
    }
  }

  async submitSale() {
    try {
      const key = document.getElementById('sellAssetSelect')?.value;
      const qty = parseFloat(document.getElementById('sellQty')?.value) || 0;
      const price = parseFloat(document.getElementById('sellPrice')?.value) || 0;
      const date = document.getElementById('sellDate')?.value || new Date().toISOString().split('T')[0];
      const reason = document.getElementById('sellReason')?.value || 'Otro';
      const observations = document.getElementById('sellObservations')?.value.trim() || null;

      if (!key || qty <= 0 || price <= 0) {
        this.uiManager.showError('Completa el activo, la cantidad y el precio.');
        return;
      }

      const asset = window.EXISTING_ASSETS?.[key];
      if (!asset || asset.qty < qty) {
        this.uiManager.showError(`No tienes suficientes unidades. Tienes: ${asset?.qty?.toFixed(8) || 0}`);
        return;
      }

      const commission = parseFloat(document.getElementById('sellCommission')?.value) || 0;
      const costAvgAtSale = parseFloat(document.getElementById('sellCostAvg')?.value) || asset.costAvg;
      const gross = qty * price;
      const net = gross - commission;
      const cost = qty * costAvgAtSale;
      const pnl = net - cost;
      const pnlPct = cost > 0 ? (pnl / cost * 100) : 0;

      this.uiManager.setButtonLoading('#sellModalOverlay .modal-submit', true);

      const result = await this.transactionService.recordSale(key, qty, price, reason, observations, date, commission, costAvgAtSale, pnlPct);

      if (result.success) {
        this.uiManager.setButtonSuccess('#sellModalOverlay .modal-submit');
        this._addToSellHistory({ key, qty, price, commission, costAvg: costAvgAtSale, pnl, pnlPct });
        setTimeout(() => {
          this.closeSellModal();
          this._refreshBalanceAfterSell(key, qty, net);  // venta suma net al cash
        }, 1000);
      } else {
        this.uiManager.showError(result.error);
        this.uiManager.setButtonLoading('#sellModalOverlay .modal-submit', false);
      }
    } catch (err) {
      this.uiManager.showError(err.message);
      this.uiManager.setButtonLoading('#sellModalOverlay .modal-submit', false);
    }
  }

  _refreshBalanceAfterBuy(key, qty, price, isNew = false, rawType = 'crypto') {
    window.updateCashAfterTrade?.(-(qty * price));  // compra resta cash
    const assets = window.EXISTING_ASSETS;
    const type = rawType === 'etf' ? 'stock' : rawType;

    if (assets?.[key]) {
      const prev = assets[key];
      const newQty = prev.qty + qty;
      assets[key].costAvg = (prev.qty * prev.costAvg + qty * price) / newQty;
      assets[key].qty = newQty;
    } else {
      // Activo nuevo: agregar a EXISTING_ASSETS
      const label = key.toUpperCase();
      assets[key] = { qty, costAvg: price, type, label };

      // Agregar a ASSET_DATA para que aparezca en PnL y Composición
      window.ASSET_DATA?.push({
        ticker: label,
        label,
        icon: label[0],
        type,
        signal: 'hold',
        price,
        change: '0%',
        costAvg: price,
        current: price,
        invested: qty * price,
        actual: qty * price,
        delta: '0',
        context: '',
        class: 'asset-' + key
      });
    }
    this._rerenderPortfolio();
  }

  _addToSellHistory({ key, qty, price, commission, costAvg, pnl, pnlPct }) {
    if (!window.SELL_HISTORY) window.SELL_HISTORY = [];
    const gross = qty * price;
    const net = gross - commission;
    window.SELL_HISTORY.push({
      key,
      ticker: key.toUpperCase(),
      qty,
      price,
      costAvg,
      gross,
      commission,
      net,
      pnl,
      pnlPct,
      date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    });
    window.renderSellHistory?.();
  }

  _refreshBalanceAfterSell(key, qty, netAmount = 0) {
    window.updateCashAfterTrade?.(netAmount);        // venta suma monto neto al cash
    const assets = window.EXISTING_ASSETS;
    if (assets?.[key]) {
      assets[key].qty = Math.max(0, assets[key].qty - qty);
    }
    this._rerenderPortfolio();
  }

  _rerenderPortfolio() {
    ['stocksPnlContainer','cryptoPnlContainer','stocksCompContainer','cryptoCompContainer']
      .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    window.renderPnl?.();
    window.renderComp?.();
    window.populateAssetSelects?.();
  }
}

// Crear instancia global y exponer al window
const app = new InvestmentApp();
window.app = app;

// Inicializar cuando carga el DOM
window.addEventListener('load', () => app.initialize());

// Exponer métodos globales para onclick del HTML
window.openBuyModal = () => app.openBuyModal();
window.closeBuyModal = () => app.closeBuyModal();
window.openSellModal = () => app.openSellModal();
window.closeSellModal = () => app.closeSellModal();
window.updateBuyPreview = () => app.updateBuyPreview();
window.updateSellPreview = () => app.updateSellPreview();
window.updateSellQtyButtons = () => app.updateSellQtyButtons();
window.setSellQuantityType = (type) => app.setSellQuantityType(type);
window.submitBuy = () => app.submitBuy();
window.submitSale = () => app.submitSale();
window.refreshPortfolio = () => app.refreshPortfolio();
window.deleteTransaction = (id) => app.deleteTransaction(id);
window.updateResumenCards = () => app._updateResumenCards();
window.updateAnalisisTab  = () => app._updateAnalisisTab();
window.saveCashToSupabase = (amount) => app.updateCash(amount);
