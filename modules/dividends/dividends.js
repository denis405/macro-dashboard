/**
 * @fileoverview Dividends module — calendar, table, dividend flow chart.
 * @module DividendsModule
 */

'use strict';

const DividendsModule = {
  title: 'Dividends',
  _view: 'calendar',

  async render(container) {
    const settings = await store.getSettings();
    const currency = settings.currency;
    const [dividends, portfolio] = await Promise.all([
      store.getDividends(),
      store.getPortfolio(),
    ]);

    // Summary calculations
    let annualTotal = 0;
    const enriched = dividends.map(d => {
      const pos = portfolio.find(p => p.ticker === d.ticker);
      const shares = pos ? pos.quantity : (d.shares || 0);
      const payment = Utils.calcDividendPayment(d.dividendPerShare, shares);
      annualTotal += payment;
      return { ...d, shares, payment };
    });

    const byMonth = Utils.groupDividendsByPeriod(dividends, portfolio, 'month');
    const byQuarter = Utils.groupDividendsByPeriod(dividends, portfolio, 'quarter');
    const byYear = Utils.groupDividendsByPeriod(dividends, portfolio, 'year');

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyTotal = byMonth[currentMonth] || 0;

    container.innerHTML = `
      ${UI.pageHeader('Dividends', 'Календарь дивидендов и денежный поток')}

      <div class="dividend-summary">
        ${UI.metricCard({ label: 'За год', value: Utils.formatCurrency(annualTotal, currency) })}
        ${UI.metricCard({ label: 'За месяц', value: Utils.formatCurrency(monthlyTotal, currency) })}
        ${UI.metricCard({ label: 'Записей', value: String(dividends.length) })}
        ${UI.metricCard({ label: 'Компаний', value: String(new Set(dividends.map(d => d.ticker)).size) })}
      </div>

      <div class="tabs">
        <button class="tab ${this._view === 'calendar' ? 'active' : ''}" data-view="calendar">Календарь</button>
        <button class="tab ${this._view === 'table' ? 'active' : ''}" data-view="table">Таблица</button>
        <button class="tab ${this._view === 'chart' ? 'active' : ''}" data-view="chart">График</button>
      </div>

      <div class="toolbar">
        <div class="toolbar-right">
          <button class="btn btn-primary" id="div-add">+ Добавить</button>
        </div>
      </div>

      <div id="div-content">
        ${this._view === 'calendar' ? this._calendarHtml(enriched, now) :
          this._view === 'table' ? this._tableHtml(enriched, currency) :
          '<div class="card"><div class="chart-container"><canvas id="div-chart"></canvas></div></div>'}
      </div>
    `;

    if (this._view === 'chart') {
      requestAnimationFrame(() => {
        UI.chart('div-chart', 'bar', UI.barData(byMonth), {
          scales: {
            y: { beginAtZero: true, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted') } },
            x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted') } },
          },
        });
      });
    }

    this._bindEvents(container);
  },

  _calendarHtml(dividends, now) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    let html = '<div class="card"><div class="calendar-grid">';
    for (const dn of dayNames) html += `<div class="calendar-day-header">${dn}</div>`;

    for (let i = 0; i < offset; i++) html += '<div class="calendar-day other-month"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDivs = dividends.filter(div => div.payDate === dateStr);
      const total = dayDivs.reduce((s, div) => s + div.payment, 0);
      const isToday = d === now.getDate();
      html += `<div class="calendar-day ${dayDivs.length ? 'has-dividend' : ''} ${isToday ? 'today' : ''}">
        <span>${d}</span>
        ${total > 0 ? `<span class="calendar-day-amount">$${total.toFixed(0)}</span>` : ''}
      </div>`;
    }
    html += '</div></div>';
    return html;
  },

  _tableHtml(dividends, currency) {
    if (!dividends.length) return UI.emptyState('◈', 'Нет дивидендов', 'Добавьте дивидендные выплаты');

    return UI.table([
      { key: 'ticker', label: 'Тикер' },
      { key: 'exDate', label: 'Отсечка', format: v => Utils.formatDate(v) },
      { key: 'payDate', label: 'Выплата', format: v => Utils.formatDate(v) },
      { key: 'dividendPerShare', label: '$/акция', align: 'right', format: v => `$${v}` },
      { key: 'shares', label: 'Акций', align: 'right' },
      { key: 'payment', label: 'Выплата', align: 'right', format: v => Utils.formatCurrency(v, currency) },
      { key: 'actions', label: '', raw: true, format: (_, row) =>
        `<button class="btn btn-sm btn-ghost" data-edit="${row.id}">✎</button>
         <button class="btn btn-sm btn-ghost" data-del="${row.id}">✕</button>` },
    ], dividends);
  },

  _bindEvents(container) {
    container.querySelectorAll('[data-view]').forEach(tab => {
      tab.addEventListener('click', () => {
        this._view = tab.dataset.view;
        this.render(container);
      });
    });
    container.querySelector('#div-add')?.addEventListener('click', () => this._showForm(container));
    container.querySelector('#div-content')?.addEventListener('click', async (e) => {
      if (e.target.dataset.edit) this._showForm(container, e.target.dataset.edit);
      if (e.target.dataset.del) this._delete(container, e.target.dataset.del);
    });
  },

  async _showForm(container, id) {
    const dividends = await store.getDividends();
    const item = id ? dividends.find(d => d.id === id) : null;

    const html = `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Тикер</label>
          <input class="form-input" id="f-ticker" value="${item?.ticker || ''}"></div>
        <div class="form-group"><label class="form-label">Дивиденд/акция</label>
          <input class="form-input" id="f-div" type="number" step="0.001" value="${item?.dividendPerShare || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Дата отсечки</label>
          <input class="form-input" id="f-ex" type="date" value="${item?.exDate || ''}"></div>
        <div class="form-group"><label class="form-label">Дата выплаты</label>
          <input class="form-input" id="f-pay" type="date" value="${item?.payDate || ''}"></div>
      </div>`;

    const ok = await UI.modal(item ? 'Редактировать' : 'Добавить дивиденд', html);
    if (!ok) return;

    const data = {
      id: item?.id || Utils.uid(),
      ticker: document.getElementById('f-ticker').value.toUpperCase(),
      dividendPerShare: parseFloat(document.getElementById('f-div').value) || 0,
      exDate: document.getElementById('f-ex').value,
      payDate: document.getElementById('f-pay').value,
      shares: item?.shares || 0,
    };

    const list = item ? dividends.map(d => d.id === id ? data : d) : [...dividends, data];
    await store.saveDividends(list);
    UI.toast('Сохранено', 'success');
    this.render(container);
  },

  async _delete(container, id) {
    const ok = await UI.modal('Удалить?', '<p>Запись будет удалена.</p>', { confirmText: 'Удалить' });
    if (!ok) return;
    await store.saveDividends((await store.getDividends()).filter(d => d.id !== id));
    UI.toast('Удалено', 'success');
    this.render(container);
  },

  destroy() { UI.destroyCharts(); },
};
