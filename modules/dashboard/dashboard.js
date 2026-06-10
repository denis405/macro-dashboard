/**
 * @fileoverview Dashboard module — portfolio overview, metrics, allocation charts.
 * @module DashboardModule
 */

'use strict';

const DashboardModule = {
  title: 'Dashboard',

  /**
   * Render dashboard page.
   * @param {HTMLElement} container
   */
  async render(container) {
    const settings = await store.getSettings();
    const currency = settings.currency;
    const [portfolio, dividends, ratings] = await Promise.all([
      store.getPortfolio(),
      store.getDividends(),
      store.getRatings(),
    ]);

    const totals = Utils.calcPortfolioTotals(portfolio);
    const sectors = Utils.groupByField(portfolio, 'sector');
    const countries = Utils.groupByField(portfolio, 'country');

    // Dividend calculations
    let annualDividends = 0;
    let monthlyDividends = 0;
    let nearestPayment = null;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const d of dividends) {
      const pos = portfolio.find(p => p.ticker === d.ticker);
      const shares = pos ? pos.quantity : (d.shares || 0);
      const payment = Utils.calcDividendPayment(d.dividendPerShare, shares);
      annualDividends += payment;
      const payMonth = d.payDate?.slice(0, 7);
      if (payMonth === currentMonth) monthlyDividends += payment;
      const payDate = new Date(d.payDate);
      if (payDate >= now && (!nearestPayment || payDate < new Date(nearestPayment.payDate))) {
        nearestPayment = { ...d, payment };
      }
    }

    // Quality metrics from ratings
    let avgRating = 0;
    let avgRoe = 0;
    let avgDebt = 0;
    if (ratings.length) {
      const scored = ratings.map(r => Utils.calcRating(r));
      avgRating = Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length);
      avgRoe = (ratings.reduce((s, r) => s + r.roe, 0) / ratings.length).toFixed(1);
      avgDebt = (ratings.reduce((s, r) => s + r.debtEquity, 0) / ratings.length).toFixed(2);
    }

    // Risk metrics
    const positionConc = Utils.calcConcentration(portfolio).toFixed(1);
    const sectorConc = Utils.calcSectorConcentration(portfolio).toFixed(1);
    const riskScore = Math.min(100, Math.round(parseFloat(positionConc) + parseFloat(sectorConc) * 0.5));

    const profitClass = totals.profit >= 0 ? 'positive' : 'negative';
    const profitSign = totals.profit >= 0 ? '+' : '';

    container.innerHTML = `
      ${UI.pageHeader('Dashboard', 'Обзор портфеля и ключевые метрики')}

      <div class="dashboard-metrics">
        ${UI.metricCard({
          label: 'Стоимость портфеля',
          value: Utils.formatCurrency(totals.totalValue, currency),
          change: `${profitSign}${Utils.formatCurrency(totals.profit, currency)} (${Utils.formatPercent(totals.returnPct)})`,
          changeType: totals.profit >= 0 ? 'up' : 'down',
          variant: profitClass,
        })}
        ${UI.metricCard({
          label: 'Вложено',
          value: Utils.formatCurrency(totals.totalInvested, currency),
        })}
        ${UI.metricCard({
          label: 'Дивиденды / год',
          value: Utils.formatCurrency(annualDividends, currency),
          change: `В месяц: ${Utils.formatCurrency(monthlyDividends, currency)}`,
        })}
        ${UI.metricCard({
          label: 'Ближайшая выплата',
          value: nearestPayment ? Utils.formatCurrency(nearestPayment.payment, currency) : '—',
          change: nearestPayment ? `${nearestPayment.ticker} · ${Utils.formatDate(nearestPayment.payDate)}` : 'Нет данных',
        })}
      </div>

      <div class="dashboard-metrics">
        ${UI.metricCard({
          label: 'Средний рейтинг',
          value: `${avgRating}/100`,
          change: Utils.ratingCategory(avgRating).category,
        })}
        ${UI.metricCard({
          label: 'Средний ROE',
          value: `${avgRoe}%`,
        })}
        ${UI.metricCard({
          label: 'Средний Debt/Equity',
          value: avgDebt,
        })}
        ${UI.metricCard({
          label: 'Риск-показатель',
          value: `${riskScore}`,
          change: `Позиция: ${positionConc}% · Сектор: ${sectorConc}%`,
          variant: riskScore > 60 ? 'negative' : riskScore > 40 ? 'warning' : '',
        })}
      </div>

      <div class="dashboard-charts">
        <div class="dashboard-chart-card">
          <div class="dashboard-chart-title">По секторам</div>
          <div class="chart-container"><canvas id="chart-sectors"></canvas></div>
        </div>
        <div class="dashboard-chart-card">
          <div class="dashboard-chart-title">По странам</div>
          <div class="chart-container"><canvas id="chart-countries"></canvas></div>
        </div>
        <div class="dashboard-chart-card">
          <div class="dashboard-chart-title">По валютам</div>
          <div class="chart-container"><canvas id="chart-currencies"></canvas></div>
        </div>
      </div>
    `;

    // Render charts after DOM is ready
    requestAnimationFrame(() => {
      UI.chart('chart-sectors', 'doughnut', UI.doughnutData(sectors));
      UI.chart('chart-countries', 'doughnut', UI.doughnutData(countries));
      UI.chart('chart-currencies', 'doughnut', UI.doughnutData({ [currency]: { value: totals.totalValue, weight: 100 } }));
    });
  },

  destroy() {
    UI.destroyCharts();
  },
};
