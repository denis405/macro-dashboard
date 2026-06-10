/**
 * @fileoverview Analytics module — CAGR, yield on cost, risk distribution.
 * @module AnalyticsModule
 */

'use strict';

const AnalyticsModule = {
  title: 'Analytics',

  async render(container) {
    const settings = await store.getSettings();
    const currency = settings.currency;
    const [portfolio, dividends, ratings, journal] = await Promise.all([
      store.getPortfolio(),
      store.getDividends(),
      store.getRatings(),
      store.getJournal(),
    ]);

    const totals = Utils.calcPortfolioTotals(portfolio);

    // CAGR — estimate from earliest journal buy entry
    const buys = journal.filter(j => j.action === 'buy').sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstBuy = buys[0];
    const years = firstBuy
      ? (Date.now() - new Date(firstBuy.date).getTime()) / (365.25 * 24 * 3600 * 1000)
      : 1;
    const cagr = Utils.calcCAGR(totals.totalInvested, totals.totalValue, Math.max(years, 0.1));

    // Annual dividends & yield
    let annualDivs = 0;
    for (const d of dividends) {
      const pos = portfolio.find(p => p.ticker === d.ticker);
      const shares = pos ? pos.quantity : (d.shares || 0);
      annualDivs += Utils.calcDividendPayment(d.dividendPerShare, shares);
    }
    const yoc = Utils.yieldOnCost(annualDivs, totals.totalInvested);
    const divYield = totals.totalValue > 0 ? (annualDivs / totals.totalValue) * 100 : 0;

    // Average dividend growth from ratings
    const avgDivGrowth = ratings.length
      ? (ratings.reduce((s, r) => s + r.dividendGrowth, 0) / ratings.length).toFixed(1)
      : '0';

    // Average rating
    const scored = ratings.map(r => Utils.calcRating(r));
    const avgRating = scored.length
      ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
      : 0;

    // Risk distribution
    const positionConc = Utils.calcConcentration(portfolio);
    const sectorConc = Utils.calcSectorConcentration(portfolio);
    const sectors = Utils.groupByField(portfolio, 'sector');

    container.innerHTML = `
      ${UI.pageHeader('Analytics', 'Углублённая аналитика портфеля')}

      <div class="analytics-grid">
        <div class="analytics-metric">
          <div class="analytics-metric-label">CAGR портфеля</div>
          <div class="analytics-metric-value" style="color:var(--${cagr >= 0 ? 'positive' : 'negative'})">${Utils.formatPercent(cagr)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">за ${years.toFixed(1)} лет</div>
        </div>
        <div class="analytics-metric">
          <div class="analytics-metric-label">Yield on Cost</div>
          <div class="analytics-metric-value">${yoc.toFixed(2)}%</div>
        </div>
        <div class="analytics-metric">
          <div class="analytics-metric-label">Дивидендная доходность</div>
          <div class="analytics-metric-value">${divYield.toFixed(2)}%</div>
        </div>
        <div class="analytics-metric">
          <div class="analytics-metric-label">Ср. рост дивидендов</div>
          <div class="analytics-metric-value">${avgDivGrowth}%</div>
        </div>
        <div class="analytics-metric">
          <div class="analytics-metric-label">Средний рейтинг</div>
          <div class="analytics-metric-value">${avgRating}/100</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${Utils.ratingCategory(avgRating).category}</div>
        </div>
        <div class="analytics-metric">
          <div class="analytics-metric-label">Годовые дивиденды</div>
          <div class="analytics-metric-value">${Utils.formatCurrency(annualDivs, currency)}</div>
        </div>
      </div>

      <div class="section-grid">
        <div class="card">
          <div class="card-title">Распределение риска</div>
          <div class="card-row"><span class="card-row-label">Концентрация (позиция)</span>
            <span class="card-row-value">${positionConc.toFixed(1)}%</span></div>
          <div class="card-row"><span class="card-row-label">Концентрация (сектор)</span>
            <span class="card-row-value">${sectorConc.toFixed(1)}%</span></div>
          <div class="card-row"><span class="card-row-label">Кол-во секторов</span>
            <span class="card-row-value">${Object.keys(sectors).length}</span></div>
          <div class="card-row"><span class="card-row-label">Кол-во позиций</span>
            <span class="card-row-value">${portfolio.length}</span></div>
          <div class="rating-bar" style="margin-top:12px">
            <div class="rating-bar-fill ${positionConc > 40 ? 'rating-weak' : positionConc > 25 ? 'rating-average' : 'rating-excellent'}"
              style="width:${Math.min(positionConc * 2, 100)}%"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Распределение по секторам</div>
          <div class="chart-container chart-container-sm"><canvas id="an-sectors"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Дивидендный поток по месяцам</div>
          <div class="chart-container chart-container-sm"><canvas id="an-divs"></canvas></div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      UI.chart('an-sectors', 'doughnut', UI.doughnutData(sectors));
      const byMonth = Utils.groupDividendsByPeriod(dividends, portfolio, 'month');
      UI.chart('an-divs', 'bar', UI.barData(byMonth), {
        scales: {
          y: { beginAtZero: true },
        },
      });
    });
  },

  destroy() { UI.destroyCharts(); },
};
