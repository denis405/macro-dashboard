/**
 * @fileoverview Portfolio module — positions, allocation, top-10.
 * @module PortfolioModule
 */

'use strict';

const PortfolioModule = {
  title: 'Portfolio',

  async render(container) {
    const settings = await store.getSettings();
    const currency = settings.currency;
    const positions = await store.getPortfolio();
    const totals = Utils.calcPortfolioTotals(positions);

    // Top 10 by value
    const ranked = positions.map(p => ({ ...p, ...Utils.calcPosition(p) }))
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 10);

    const maxValue = ranked[0]?.currentValue || 1;

    container.innerHTML = `
      ${UI.pageHeader('Portfolio', 'Управление позициями и структура портфеля')}

      <div class="metric-grid">
        ${UI.metricCard({ label: 'Стоимость', value: Utils.formatCurrency(totals.totalValue, currency) })}
        ${UI.metricCard({ label: 'Вложено', value: Utils.formatCurrency(totals.totalInvested, currency) })}
        ${UI.metricCard({
          label: 'P&L',
          value: Utils.formatCurrency(totals.profit, currency),
          change: Utils.formatPercent(totals.returnPct),
          changeType: totals.profit >= 0 ? 'up' : 'down',
          variant: totals.profit >= 0 ? 'positive' : 'negative',
        })}
        ${UI.metricCard({ label: 'Позиций', value: String(positions.length) })}
      </div>

      <div class="toolbar">
        <div class="toolbar-right">
          <button class="btn btn-primary" id="pf-add">+ Добавить позицию</button>
        </div>
      </div>

      <div class="portfolio-layout">
        <div>
          <div id="pf-table">${this._buildTable(positions, currency, totals)}</div>
          <div class="portfolio-top10">
            <h3 style="margin-bottom:16px;font-size:1rem">Топ-10 позиций</h3>
            ${ranked.map(p => {
              const pct = (p.currentValue / totals.totalValue * 100).toFixed(1);
              const width = (p.currentValue / maxValue * 100).toFixed(0);
              return `<div class="top10-bar">
                <span class="top10-label">${p.ticker}</span>
                <div class="top10-track"><div class="top10-fill" style="width:${width}%">${pct}%</div></div>
                <span class="top10-value">${Utils.formatCurrency(p.currentValue, currency)}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Структура портфеля</div>
          <div class="chart-container"><canvas id="pf-chart"></canvas></div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      const groups = {};
      for (const p of positions) {
        const m = Utils.calcPosition(p);
        groups[p.ticker] = { value: m.currentValue, weight: 0 };
      }
      const total = totals.totalValue || 1;
      for (const k of Object.keys(groups)) {
        groups[k].weight = (groups[k].value / total) * 100;
      }
      UI.chart('pf-chart', 'doughnut', UI.doughnutData(groups));
    });

    container.querySelector('#pf-add')?.addEventListener('click', () => this._showForm(container));
    container.querySelector('#pf-table')?.addEventListener('click', async (e) => {
      if (e.target.dataset.edit) this._showForm(container, e.target.dataset.edit);
      if (e.target.dataset.del) this._delete(container, e.target.dataset.del);
    });
  },

  _buildTable(positions, currency, totals) {
    if (!positions.length) return UI.emptyState('◫', 'Портфель пуст', 'Добавьте первую позицию');

    const rows = positions.map(p => {
      const m = Utils.calcPosition(p);
      const weight = totals.totalValue > 0 ? (m.currentValue / totals.totalValue * 100).toFixed(1) : '0';
      return {
        id: p.id,
        ticker: p.ticker,
        quantity: p.quantity,
        avgPrice: Utils.formatCurrency(p.avgPrice, currency),
        currentPrice: Utils.formatCurrency(p.currentPrice, currency),
        invested: Utils.formatCurrency(m.invested, currency),
        currentValue: Utils.formatCurrency(m.currentValue, currency),
        profit: `${m.profit >= 0 ? '+' : ''}${Utils.formatCurrency(m.profit, currency)}`,
        returnPct: Utils.formatPercent(m.returnPct),
        weight: `${weight}%`,
        sector: p.sector,
      };
    });

    return UI.table([
      { key: 'ticker', label: 'Тикер' },
      { key: 'quantity', label: 'Кол-во', align: 'right' },
      { key: 'avgPrice', label: 'Ср. цена', align: 'right' },
      { key: 'currentPrice', label: 'Текущая', align: 'right' },
      { key: 'invested', label: 'Вложено', align: 'right' },
      { key: 'currentValue', label: 'Стоимость', align: 'right' },
      { key: 'profit', label: 'P&L', align: 'right' },
      { key: 'returnPct', label: 'Доходн.', align: 'right' },
      { key: 'weight', label: 'Доля', align: 'right' },
      { key: 'actions', label: '', raw: true, format: (_, row) =>
        `<button class="btn btn-sm btn-ghost" data-edit="${row.id}">✎</button>
         <button class="btn btn-sm btn-ghost" data-del="${row.id}">✕</button>` },
    ], rows);
  },

  async _showForm(container, id) {
    const positions = await store.getPortfolio();
    const item = id ? positions.find(p => p.id === id) : null;

    const html = `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Тикер</label>
          <input class="form-input" id="f-ticker" value="${item?.ticker || ''}"></div>
        <div class="form-group"><label class="form-label">Количество</label>
          <input class="form-input" id="f-qty" type="number" value="${item?.quantity || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Средняя цена</label>
          <input class="form-input" id="f-avg" type="number" step="0.01" value="${item?.avgPrice || ''}"></div>
        <div class="form-group"><label class="form-label">Текущая цена</label>
          <input class="form-input" id="f-cur" type="number" step="0.01" value="${item?.currentPrice || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Сектор</label>
          <input class="form-input" id="f-sector" value="${item?.sector || ''}"></div>
        <div class="form-group"><label class="form-label">Страна</label>
          <input class="form-input" id="f-country" value="${item?.country || ''}"></div>
      </div>`;

    const ok = await UI.modal(item ? 'Редактировать позицию' : 'Новая позиция', html);
    if (!ok) return;

    const data = {
      id: item?.id || Utils.uid(),
      ticker: document.getElementById('f-ticker').value.toUpperCase(),
      quantity: parseFloat(document.getElementById('f-qty').value) || 0,
      avgPrice: parseFloat(document.getElementById('f-avg').value) || 0,
      currentPrice: parseFloat(document.getElementById('f-cur').value) || 0,
      sector: document.getElementById('f-sector').value,
      country: document.getElementById('f-country').value,
    };

    const list = item ? positions.map(p => p.id === id ? data : p) : [...positions, data];
    await store.savePortfolio(list);
    UI.toast('Сохранено', 'success');
    this.render(container);
  },

  async _delete(container, id) {
    const ok = await UI.modal('Удалить позицию?', '<p>Позиция будет удалена из портфеля.</p>', { confirmText: 'Удалить' });
    if (!ok) return;
    await store.savePortfolio((await store.getPortfolio()).filter(p => p.id !== id));
    UI.toast('Удалено', 'success');
    this.render(container);
  },

  destroy() { UI.destroyCharts(); },
};
