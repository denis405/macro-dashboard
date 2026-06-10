/**
 * @fileoverview Watchlist module — track companies, signals, filters.
 * @module WatchlistModule
 */

'use strict';

const WatchlistModule = {
  title: 'Watchlist',
  _sortKey: 'ticker',
  _sortDir: 'asc',
  _filter: '',
  _statusFilter: '',
  _favOnly: false,

  async render(container) {
    const settings = await store.getSettings();
    let items = await store.getWatchlist();

    // Apply filters
    if (this._filter) {
      const q = this._filter.toLowerCase();
      items = items.filter(w =>
        w.ticker.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)
      );
    }
    if (this._statusFilter) items = items.filter(w => w.status === this._statusFilter);
    if (this._favOnly) items = items.filter(w => w.favorite);

    container.innerHTML = `
      ${UI.pageHeader('Watchlist', 'Отслеживание компаний и инвестиционных сигналов')}
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="search" class="search-input" id="wl-search" placeholder="Поиск…" value="${Utils.escapeHtml(this._filter)}">
          <select class="filter-select" id="wl-status">
            <option value="">Все статусы</option>
            <option value="study" ${this._statusFilter === 'study' ? 'selected' : ''}>Изучить</option>
            <option value="buy" ${this._statusFilter === 'buy' ? 'selected' : ''}>Купить</option>
            <option value="hold" ${this._statusFilter === 'hold' ? 'selected' : ''}>Держать</option>
            <option value="sell" ${this._statusFilter === 'sell' ? 'selected' : ''}>Продать</option>
          </select>
          <button class="btn btn-sm ${this._favOnly ? 'btn-primary' : ''}" id="wl-fav">★ Избранное</button>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" id="wl-add">+ Добавить</button>
        </div>
      </div>
      <div id="wl-table">${this._buildTable(items, settings.currency)}</div>
    `;

    this._bindEvents(container, items);
  },

  _buildTable(items, currency) {
    if (!items.length) return UI.emptyState('◎', 'Watchlist пуст', 'Добавьте компании для отслеживания');

    const rows = items.map(w => {
      const signal = Utils.priceSignal(w.currentPrice, w.fairPrice);
      const signalHtml = signal === 'green'
        ? '<span class="signal-green" title="Ниже справедливой на 20%+"></span>'
        : signal === 'red'
          ? '<span class="signal-red" title="Выше справедливой"></span>'
          : '';
      const discount = w.fairPrice > 0
        ? Utils.formatPercent(((w.fairPrice - w.currentPrice) / w.fairPrice) * 100)
        : '—';

      return {
        id: w.id,
        favorite: w.favorite,
        signal: signalHtml,
        ticker: w.ticker,
        name: w.name,
        sector: w.sector,
        country: w.country,
        currentPrice: Utils.formatCurrency(w.currentPrice, currency),
        targetPrice: Utils.formatCurrency(w.targetPrice, currency),
        fairPrice: Utils.formatCurrency(w.fairPrice, currency),
        discount,
        status: w.status,
        comment: w.comment || '',
        _raw: w,
      };
    });

    return UI.table([
      { key: 'signal', label: '', raw: true },
      { key: 'favorite', label: '★', raw: true, format: (v, row) =>
        `<button class="star-btn ${v ? 'active' : ''}" data-fav="${row.id}">${v ? '★' : '☆'}</button>` },
      { key: 'ticker', label: 'Тикер' },
      { key: 'name', label: 'Название' },
      { key: 'sector', label: 'Сектор' },
      { key: 'currentPrice', label: 'Цена', align: 'right' },
      { key: 'fairPrice', label: 'Справедл.', align: 'right' },
      { key: 'discount', label: 'MoS', align: 'right' },
      { key: 'status', label: 'Статус', raw: true, format: (v) => UI.statusBadge(v) },
      { key: 'actions', label: '', raw: true, format: (_, row) =>
        `<button class="btn btn-sm btn-ghost" data-edit="${row.id}">✎</button>
         <button class="btn btn-sm btn-ghost" data-del="${row.id}">✕</button>` },
    ], rows, { sortKey: this._sortKey, sortDir: this._sortDir });
  },

  _bindEvents(container) {
    container.querySelector('#wl-search')?.addEventListener('input', (e) => {
      this._filter = e.target.value;
      this.render(container);
    });
    container.querySelector('#wl-status')?.addEventListener('change', (e) => {
      this._statusFilter = e.target.value;
      this.render(container);
    });
    container.querySelector('#wl-fav')?.addEventListener('click', () => {
      this._favOnly = !this._favOnly;
      this.render(container);
    });
    container.querySelector('#wl-add')?.addEventListener('click', () => this._showForm(container));
    container.querySelector('#wl-table')?.addEventListener('click', async (e) => {
      const editId = e.target.dataset.edit;
      const delId = e.target.dataset.del;
      const favId = e.target.dataset.fav;
      if (editId) return this._showForm(container, editId);
      if (delId) return this._delete(container, delId);
      if (favId) return this._toggleFav(container, favId);
    });
    UI.attachTableSort(container.querySelector('#wl-table'), (key, dir) => {
      this._sortKey = key;
      this._sortDir = dir;
      this.render(container);
    });
  },

  async _showForm(container, id) {
    const items = await store.getWatchlist();
    const item = id ? items.find(w => w.id === id) : null;

    const html = `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Тикер</label>
          <input class="form-input" id="f-ticker" value="${item?.ticker || ''}"></div>
        <div class="form-group"><label class="form-label">Название</label>
          <input class="form-input" id="f-name" value="${item?.name || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Сектор</label>
          <input class="form-input" id="f-sector" value="${item?.sector || ''}"></div>
        <div class="form-group"><label class="form-label">Страна</label>
          <input class="form-input" id="f-country" value="${item?.country || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Текущая цена</label>
          <input class="form-input" id="f-price" type="number" step="0.01" value="${item?.currentPrice || ''}"></div>
        <div class="form-group"><label class="form-label">Целевая цена</label>
          <input class="form-input" id="f-target" type="number" step="0.01" value="${item?.targetPrice || ''}"></div>
        <div class="form-group"><label class="form-label">Справедливая цена</label>
          <input class="form-input" id="f-fair" type="number" step="0.01" value="${item?.fairPrice || ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Статус</label>
        <select class="form-select" id="f-status">
          <option value="study" ${item?.status === 'study' ? 'selected' : ''}>Изучить</option>
          <option value="buy" ${item?.status === 'buy' ? 'selected' : ''}>Купить</option>
          <option value="hold" ${item?.status === 'hold' ? 'selected' : ''}>Держать</option>
          <option value="sell" ${item?.status === 'sell' ? 'selected' : ''}>Продать</option>
        </select></div>
      <div class="form-group"><label class="form-label">Комментарий</label>
        <textarea class="form-textarea" id="f-comment">${item?.comment || ''}</textarea></div>
    `;

    const ok = await UI.modal(item ? 'Редактировать' : 'Добавить компанию', html);
    if (!ok) return;

    const data = {
      id: item?.id || Utils.uid(),
      ticker: document.getElementById('f-ticker').value.toUpperCase(),
      name: document.getElementById('f-name').value,
      sector: document.getElementById('f-sector').value,
      country: document.getElementById('f-country').value,
      currentPrice: parseFloat(document.getElementById('f-price').value) || 0,
      targetPrice: parseFloat(document.getElementById('f-target').value) || 0,
      fairPrice: parseFloat(document.getElementById('f-fair').value) || 0,
      status: document.getElementById('f-status').value,
      comment: document.getElementById('f-comment').value,
      favorite: item?.favorite || false,
    };

    if (!data.ticker) { UI.toast('Укажите тикер', 'error'); return; }

    const list = item ? items.map(w => w.id === id ? data : w) : [...items, data];
    await store.saveWatchlist(list);
    UI.toast(item ? 'Обновлено' : 'Добавлено', 'success');
    this.render(container);
  },

  async _delete(container, id) {
    const ok = await UI.modal('Удалить?', '<p>Компания будет удалена из watchlist.</p>', { confirmText: 'Удалить', hideCancel: false });
    if (!ok) return;
    const items = (await store.getWatchlist()).filter(w => w.id !== id);
    await store.saveWatchlist(items);
    UI.toast('Удалено', 'success');
    this.render(container);
  },

  async _toggleFav(container, id) {
    const items = await store.getWatchlist();
    const updated = items.map(w => w.id === id ? { ...w, favorite: !w.favorite } : w);
    await store.saveWatchlist(updated);
    this.render(container);
  },
};
