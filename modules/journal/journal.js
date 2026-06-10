/**
 * @fileoverview Investment journal — decision log with thesis, risks, tags.
 * @module JournalModule
 */

'use strict';

const JournalModule = {
  title: 'Journal',
  _filter: '',
  _tagFilter: '',
  _tickerFilter: '',

  async render(container) {
    let entries = await store.getJournal();

    if (this._filter) {
      const q = this._filter.toLowerCase();
      entries = entries.filter(e =>
        e.ticker.toLowerCase().includes(q) ||
        e.thesis?.toLowerCase().includes(q) ||
        e.reasons?.toLowerCase().includes(q)
      );
    }
    if (this._tagFilter) entries = entries.filter(e => e.tags?.includes(this._tagFilter));
    if (this._tickerFilter) entries = entries.filter(e => e.ticker === this._tickerFilter);

    const allTags = [...new Set((await store.getJournal()).flatMap(e => e.tags || []))];
    const allTickers = [...new Set((await store.getJournal()).map(e => e.ticker))];

    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = `
      ${UI.pageHeader('Journal', 'Инвестиционный дневник решений')}
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="search" class="search-input" id="jn-search" placeholder="Поиск…" value="${Utils.escapeHtml(this._filter)}">
          <select class="filter-select" id="jn-ticker">
            <option value="">Все тикеры</option>
            ${allTickers.map(t => `<option value="${t}" ${this._tickerFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <select class="filter-select" id="jn-tag">
            <option value="">Все теги</option>
            ${allTags.map(t => `<option value="${t}" ${this._tagFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" id="jn-add">+ Новая запись</button>
        </div>
      </div>
      <div id="jn-entries">${this._entriesHtml(entries)}</div>
    `;

    this._bindEvents(container);
  },

  _entriesHtml(entries) {
    if (!entries.length) return UI.emptyState('◧', 'Дневник пуст', 'Зафиксируйте первое инвестиционное решение');

    return entries.map(e => `
      <div class="journal-entry" data-id="${e.id}">
        <div class="journal-entry-header">
          <div>
            <strong>${Utils.escapeHtml(e.ticker)}</strong>
            <span class="badge ${e.action === 'buy' ? 'badge-buy' : 'badge-sell'}">${e.action === 'buy' ? 'Покупка' : 'Продажа'}</span>
            ${(e.tags || []).map(t => `<span class="tag">${Utils.escapeHtml(t)}</span>`).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="journal-entry-date">${Utils.formatDate(e.date)}</span>
            <button class="btn btn-sm btn-ghost" data-edit="${e.id}">✎</button>
            <button class="btn btn-sm btn-ghost" data-del="${e.id}">✕</button>
          </div>
        </div>
        <div class="journal-entry-thesis">${Utils.escapeHtml(e.thesis)}</div>
        <div class="journal-meta">
          <div><div class="journal-meta-label">Причины</div>${Utils.escapeHtml(e.reasons || '—')}</div>
          <div><div class="journal-meta-label">Риски</div>${Utils.escapeHtml(e.risks || '—')}</div>
          <div><div class="journal-meta-label">Ожид. доходность</div>${e.expectedReturn ? Utils.formatPercent(e.expectedReturn) : '—'}</div>
          <div><div class="journal-meta-label">Справедливая цена</div>${e.fairPrice ? `$${e.fairPrice}` : '—'}</div>
        </div>
      </div>
    `).join('');
  },

  _bindEvents(container) {
    container.querySelector('#jn-search')?.addEventListener('input', (e) => {
      this._filter = e.target.value;
      this.render(container);
    });
    container.querySelector('#jn-ticker')?.addEventListener('change', (e) => {
      this._tickerFilter = e.target.value;
      this.render(container);
    });
    container.querySelector('#jn-tag')?.addEventListener('change', (e) => {
      this._tagFilter = e.target.value;
      this.render(container);
    });
    container.querySelector('#jn-add')?.addEventListener('click', () => this._showForm(container));
    container.querySelector('#jn-entries')?.addEventListener('click', async (e) => {
      if (e.target.dataset.edit) this._showForm(container, e.target.dataset.edit);
      if (e.target.dataset.del) this._delete(container, e.target.dataset.del);
    });
  },

  async _showForm(container, id) {
    const entries = await store.getJournal();
    const item = id ? entries.find(e => e.id === id) : null;

    const html = `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Дата</label>
          <input class="form-input" id="f-date" type="date" value="${item?.date || new Date().toISOString().slice(0, 10)}"></div>
        <div class="form-group"><label class="form-label">Тикер</label>
          <input class="form-input" id="f-ticker" value="${item?.ticker || ''}"></div>
        <div class="form-group"><label class="form-label">Действие</label>
          <select class="form-select" id="f-action">
            <option value="buy" ${item?.action === 'buy' ? 'selected' : ''}>Покупка</option>
            <option value="sell" ${item?.action === 'sell' ? 'selected' : ''}>Продажа</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Инвестиционный тезис</label>
        <textarea class="form-textarea" id="f-thesis">${item?.thesis || ''}</textarea></div>
      <div class="form-group"><label class="form-label">Причины</label>
        <textarea class="form-textarea" id="f-reasons">${item?.reasons || ''}</textarea></div>
      <div class="form-group"><label class="form-label">Риски</label>
        <textarea class="form-textarea" id="f-risks">${item?.risks || ''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Ожид. доходность (%)</label>
          <input class="form-input" id="f-return" type="number" step="0.1" value="${item?.expectedReturn || ''}"></div>
        <div class="form-group"><label class="form-label">Справедливая цена</label>
          <input class="form-input" id="f-fair" type="number" step="0.01" value="${item?.fairPrice || ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Теги (через запятую)</label>
        <input class="form-input" id="f-tags" value="${(item?.tags || []).join(', ')}"></div>`;

    const ok = await UI.modal(item ? 'Редактировать запись' : 'Новая запись', html);
    if (!ok) return;

    const data = {
      id: item?.id || Utils.uid(),
      date: document.getElementById('f-date').value,
      ticker: document.getElementById('f-ticker').value.toUpperCase(),
      action: document.getElementById('f-action').value,
      thesis: document.getElementById('f-thesis').value,
      reasons: document.getElementById('f-reasons').value,
      risks: document.getElementById('f-risks').value,
      expectedReturn: parseFloat(document.getElementById('f-return').value) || 0,
      fairPrice: parseFloat(document.getElementById('f-fair').value) || 0,
      tags: document.getElementById('f-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    };

    const list = item ? entries.map(e => e.id === id ? data : e) : [...entries, data];
    await store.saveJournal(list);
    UI.toast('Сохранено', 'success');
    this.render(container);
  },

  async _delete(container, id) {
    const ok = await UI.modal('Удалить запись?', '<p>Запись будет удалена из дневника.</p>', { confirmText: 'Удалить' });
    if (!ok) return;
    await store.saveJournal((await store.getJournal()).filter(e => e.id !== id));
    UI.toast('Удалено', 'success');
    this.render(container);
  },
};
