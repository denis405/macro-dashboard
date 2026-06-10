/**
 * @fileoverview Stress test module — portfolio crisis scenarios.
 * @module StressTestModule
 */

'use strict';

const StressTestModule = {
  title: 'Stress Test',

  /** Predefined historical crisis scenarios */
  PRESETS: {
    '2008': { name: 'Кризис 2008', drop: -50, divCut: 0.30 },
    'covid': { name: 'COVID Crash', drop: -35, divCut: 0.15 },
    'dotcom': { name: 'Dot-com', drop: -70, divCut: 0.20 },
  },

  SCENARIOS: [-20, -30, -40, -50, -70],

  async render(container) {
    const settings = await store.getSettings();
    const currency = settings.currency;
    const [portfolio, dividends] = await Promise.all([
      store.getPortfolio(),
      store.getDividends(),
    ]);

    const totals = Utils.calcPortfolioTotals(portfolio);

    // Annual dividends
    let annualDivs = 0;
    for (const d of dividends) {
      const pos = portfolio.find(p => p.ticker === d.ticker);
      const shares = pos ? pos.quantity : (d.shares || 0);
      annualDivs += Utils.calcDividendPayment(d.dividendPerShare, shares);
    }

    container.innerHTML = `
      ${UI.pageHeader('Stress Test', 'Моделирование кризисных сценариев')}

      <div class="metric-grid">
        ${UI.metricCard({ label: 'Текущая стоимость', value: Utils.formatCurrency(totals.totalValue, currency) })}
        ${UI.metricCard({ label: 'Годовые дивиденды', value: Utils.formatCurrency(annualDivs, currency) })}
        ${UI.metricCard({ label: 'Позиций', value: String(portfolio.length) })}
      </div>

      <h3 style="margin-bottom:12px;font-size:1rem">Исторические сценарии</h3>
      <div class="preset-scenarios">
        ${Object.entries(this.PRESETS).map(([key, p]) => `
          <button class="preset-btn" data-preset="${key}">
            <div class="preset-btn-title">${p.name}</div>
            <div class="preset-btn-desc">Падение ${p.drop}% · Сокращение дивидендов ${(p.divCut * 100).toFixed(0)}%</div>
          </button>
        `).join('')}
      </div>

      <h3 style="margin-bottom:12px;font-size:1rem">Сценарии падения</h3>
      <div class="stress-grid" id="stress-results">
        ${this.SCENARIOS.map(drop => this._scenarioCard(drop, totals.totalValue, annualDivs, currency)).join('')}
      </div>

      <div id="preset-result"></div>
    `;

    container.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = this.PRESETS[btn.dataset.preset];
        const newValue = totals.totalValue * (1 + preset.drop / 100);
        const loss = totals.totalValue - newValue;
        const newDivs = annualDivs * (1 - preset.divCut);
        const divLoss = annualDivs - newDivs;

        container.querySelector('#preset-result').innerHTML = `
          <div class="card" style="margin-top:24px">
            <div class="card-title">${preset.name} — Результаты</div>
            <div class="stress-grid" style="margin-top:16px">
              <div class="stress-card">
                <div class="stress-scenario">Новая стоимость</div>
                <div style="font-family:var(--font-mono);font-size:1.4rem;font-weight:700;margin:8px 0">
                  ${Utils.formatCurrency(newValue, currency)}</div>
              </div>
              <div class="stress-card">
                <div class="stress-scenario">Потеря капитала</div>
                <div class="stress-loss">-${Utils.formatCurrency(loss, currency)}</div>
              </div>
              <div class="stress-card">
                <div class="stress-scenario">Потеря дивидендов</div>
                <div class="stress-loss">-${Utils.formatCurrency(divLoss, currency)}/год</div>
              </div>
              <div class="stress-card">
                <div class="stress-scenario">Новые дивиденды</div>
                <div style="font-family:var(--font-mono);font-size:1.2rem;color:var(--warning)">
                  ${Utils.formatCurrency(newDivs, currency)}/год</div>
              </div>
            </div>
          </div>`;
      });
    });
  },

  /**
   * Build HTML for a single drop scenario card.
   * @param {number} dropPct
   * @param {number} totalValue
   * @param {number} annualDivs
   * @param {string} currency
   * @returns {string}
   */
  _scenarioCard(dropPct, totalValue, annualDivs, currency) {
    const newValue = totalValue * (1 + dropPct / 100);
    const loss = totalValue - newValue;
    const divCut = Math.abs(dropPct) / 100 * 0.4;
    const newDivs = annualDivs * (1 - divCut);
    const divLoss = annualDivs - newDivs;

    return `
      <div class="stress-card">
        <div class="stress-scenario">${dropPct}%</div>
        <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:600;margin:8px 0">
          ${Utils.formatCurrency(newValue, currency)}</div>
        <div style="font-size:0.85rem;color:var(--text-muted)">Потеря капитала</div>
        <div class="stress-loss" style="font-size:1.1rem">-${Utils.formatCurrency(loss, currency)}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-top:8px">Потеря дивидендов</div>
        <div style="font-family:var(--font-mono);color:var(--warning);font-size:0.9rem">-${Utils.formatCurrency(divLoss, currency)}</div>
      </div>`;
  },
};
