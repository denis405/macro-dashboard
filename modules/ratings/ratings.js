/**
 * @fileoverview Company ratings module — quality scoring 0-100.
 * @module RatingsModule
 */

'use strict';

const RatingsModule = {
  title: 'Ratings',
  _selectedId: null,

  async render(container) {
    const ratings = await store.getRatings();
    const scored = ratings.map(r => ({ ...r, ...Utils.calcRating(r) }));

    const selected = this._selectedId
      ? scored.find(r => r.id === this._selectedId) || scored[0]
      : scored[0];

    container.innerHTML = `
      ${UI.pageHeader('Ratings', 'Система оценки качества компаний')}
      <div class="toolbar">
        <div class="toolbar-right">
          <button class="btn btn-primary" id="rt-add">+ Добавить</button>
        </div>
      </div>
      <div class="ratings-layout">
        <div>
          <div id="rt-table">${this._tableHtml(scored)}</div>
        </div>
        <div class="card" id="rt-detail">
          ${selected ? this._detailHtml(selected) : UI.emptyState('★', 'Выберите компанию')}
        </div>
      </div>
    `;

    container.querySelector('#rt-add')?.addEventListener('click', () => this._showForm(container));
    container.querySelector('#rt-table')?.addEventListener('click', async (e) => {
      const row = e.target.closest('tr[data-id]');
      if (row) {
        this._selectedId = row.dataset.id;
        const r = scored.find(s => s.id === this._selectedId);
        if (r) container.querySelector('#rt-detail').innerHTML = this._detailHtml(r);
      }
      if (e.target.dataset.edit) this._showForm(container, e.target.dataset.edit);
      if (e.target.dataset.del) this._delete(container, e.target.dataset.del);
    });
  },

  _tableHtml(scored) {
    if (!scored.length) return UI.emptyState('★', 'Нет оценок', 'Добавьте первую компанию');

    return UI.table([
      { key: 'ticker', label: 'Тикер' },
      { key: 'score', label: 'Рейтинг', align: 'right' },
      { key: 'category', label: 'Категория', raw: true, format: (_, row) => `<span class="badge">${row.category}</span>` },
      { key: 'roe', label: 'ROE%', align: 'right' },
      { key: 'roic', label: 'ROIC%', align: 'right' },
      { key: 'debtEquity', label: 'D/E', align: 'right' },
      { key: 'actions', label: '', raw: true, format: (_, row) =>
        `<button class="btn btn-sm btn-ghost" data-edit="${row.id}">✎</button>
         <button class="btn btn-sm btn-ghost" data-del="${row.id}">✕</button>` },
    ], scored);
  },

  _detailHtml(r) {
    const metrics = [
      { name: 'ROE', value: r.roe, score: Utils.scoreMetric(r.roe, { excellent: 20, good: 15, average: 10 }) },
      { name: 'ROIC', value: r.roic, score: Utils.scoreMetric(r.roic, { excellent: 15, good: 10, average: 5 }) },
      { name: 'Debt/Equity', value: r.debtEquity, score: Utils.scoreMetric(r.debtEquity, { excellent: 0.3, good: 0.7, average: 1.5 }, true) },
      { name: 'Net Margin', value: r.netMargin, score: Utils.scoreMetric(r.netMargin, { excellent: 20, good: 12, average: 5 }) },
      { name: 'Revenue Growth', value: r.revenueGrowth, score: Utils.scoreMetric(r.revenueGrowth, { excellent: 15, good: 8, average: 3 }) },
      { name: 'EPS Growth', value: r.epsGrowth, score: Utils.scoreMetric(r.epsGrowth, { excellent: 15, good: 8, average: 3 }) },
      { name: 'Dividend Growth', value: r.dividendGrowth, score: Utils.scoreMetric(r.dividendGrowth, { excellent: 10, good: 5, average: 2 }) },
      { name: 'FCF Growth', value: r.fcfGrowth, score: Utils.scoreMetric(r.fcfGrowth, { excellent: 12, good: 6, average: 2 }) },
    ];

    return `
      <div class="card-title">${Utils.escapeHtml(r.ticker)}</div>
      <div class="rating-score-circle" style="border-color:var(--accent)">
        <div class="rating-score-value">${r.score}</div>
        <div class="rating-score-label">${r.category}</div>
      </div>
      <div class="rating-bar"><div class="rating-bar-fill ${r.class}" style="width:${r.score}%"></div></div>
      ${metrics.map(m => `
        <div class="rating-metric-row">
          <span class="rating-metric-name">${m.name}</span>
          <span style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text-muted)">${m.value}</span>
          <span class="rating-metric-score">${m.score}</span>
        </div>
        <div class="rating-bar"><div class="rating-bar-fill ${r.class}" style="width:${m.score}%"></div></div>
      `).join('')}
    `;
  },

  async _showForm(container, id) {
    const ratings = await store.getRatings();
    const item = id ? ratings.find(r => r.id === id) : null;

    const fields = ['roe', 'roic', 'debtEquity', 'netMargin', 'revenueGrowth', 'epsGrowth', 'dividendGrowth', 'fcfGrowth'];
    const labels = ['ROE (%)', 'ROIC (%)', 'Debt/Equity', 'Net Margin (%)', 'Revenue Growth (%)', 'EPS Growth (%)', 'Dividend Growth (%)', 'FCF Growth (%)'];

    const html = `
      <div class="form-group"><label class="form-label">Тикер</label>
        <input class="form-input" id="f-ticker" value="${item?.ticker || ''}"></div>
      <div class="form-row">
        ${fields.map((f, i) => `
          <div class="form-group"><label class="form-label">${labels[i]}</label>
            <input class="form-input" id="f-${f}" type="number" step="0.1" value="${item?.[f] ?? ''}"></div>
        `).join('')}
      </div>`;

    const ok = await UI.modal(item ? 'Редактировать' : 'Добавить оценку', html);
    if (!ok) return;

    const data = { id: item?.id || Utils.uid(), ticker: document.getElementById('f-ticker').value.toUpperCase() };
    for (const f of fields) data[f] = parseFloat(document.getElementById(`f-${f}`).value) || 0;

    const list = item ? ratings.map(r => r.id === id ? data : r) : [...ratings, data];
    await store.saveRatings(list);
    UI.toast('Сохранено', 'success');
    this.render(container);
  },

  async _delete(container, id) {
    const ok = await UI.modal('Удалить?', '<p>Оценка будет удалена.</p>', { confirmText: 'Удалить' });
    if (!ok) return;
    await store.saveRatings((await store.getRatings()).filter(r => r.id !== id));
    UI.toast('Удалено', 'success');
    this.render(container);
  },
};
