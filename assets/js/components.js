/**
 * @fileoverview Reusable UI components: toast, modal, charts, tables.
 * @module components
 */

'use strict';

const UI = {
  /** @type {Map<string, Chart>} */
  _charts: new Map(),

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='info']
   * @param {number} [duration=3000]
   */
  toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  /**
   * Open a modal dialog.
   * @param {string} title
   * @param {string} bodyHtml
   * @param {Object} [options]
   * @returns {Promise<boolean>} Resolves true on confirm, false on cancel
   */
  modal(title, bodyHtml, options = {}) {
    return new Promise((resolve) => {
      const root = document.getElementById('modal-root');
      root.hidden = false;
      root.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">${Utils.escapeHtml(title)}</h3>
            <button class="modal-close" type="button" aria-label="Закрыть">&times;</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-footer">
            ${options.hideCancel ? '' : '<button class="btn btn-ghost" data-action="cancel">Отмена</button>'}
            <button class="btn btn-primary" data-action="confirm">${options.confirmText || 'Сохранить'}</button>
          </div>
        </div>`;

      const close = (result) => {
        root.hidden = true;
        root.innerHTML = '';
        resolve(result);
      };

      root.querySelector('[data-action="cancel"]')?.addEventListener('click', () => close(false));
      root.querySelector('[data-action="confirm"]')?.addEventListener('click', () => close(true));
      root.querySelector('.modal-close')?.addEventListener('click', () => close(false));
      root.addEventListener('click', (e) => { if (e.target === root) close(false); });
    });
  },

  /**
   * Create or update a Chart.js chart.
   * @param {string} canvasId
   * @param {string} type
   * @param {Object} data
   * @param {Object} [options]
   * @returns {Chart|null}
   */
  chart(canvasId, type, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;

    if (this._charts.has(canvasId)) {
      this._charts.get(canvasId).destroy();
    }

    const isTerminal = document.documentElement.dataset.theme === 'terminal';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();

    const chart = new Chart(canvas, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { size: 11 }, padding: 16 },
          },
        },
        ...options,
      },
    });

    this._charts.set(canvasId, chart);
    return chart;
  },

  /**
   * Destroy all active charts (call before re-render).
   */
  destroyCharts() {
    for (const chart of this._charts.values()) chart.destroy();
    this._charts.clear();
  },

  /**
   * Build doughnut chart data from grouped object.
   * @param {Object} groups - { key: { value, weight } }
   * @returns {Object}
   */
  doughnutData(groups) {
    const colors = [
      '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
    ];
    const keys = Object.keys(groups);
    return {
      labels: keys,
      datasets: [{
        data: keys.map(k => groups[k].value),
        backgroundColor: keys.map((_, i) => colors[i % colors.length]),
        borderWidth: 0,
      }],
    };
  },

  /**
   * Build bar chart data from grouped object.
   * @param {Object} groups
   * @returns {Object}
   */
  barData(groups) {
    const keys = Object.keys(groups).sort();
    return {
      labels: keys,
      datasets: [{
        label: 'Сумма',
        data: keys.map(k => groups[k]),
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      }],
    };
  },

  /**
   * Render a sortable data table.
   * @param {Array<Object>} columns - { key, label, align?, format? }
   * @param {Array<Object>} rows
   * @param {Object} [options]
   * @returns {string} HTML string
   */
  table(columns, rows, options = {}) {
    const sortKey = options.sortKey || '';
    const sortDir = options.sortDir || 'asc';

    let sorted = [...rows];
    if (sortKey) {
      sorted.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    const ths = columns.map(col => {
      const sortedClass = sortKey === col.key ? 'sorted' : '';
      const align = col.align === 'right' ? ' style="text-align:right"' : '';
      return `<th class="${sortedClass}" data-sort="${col.key}"${align}>${col.label}</th>`;
    }).join('');

    const trs = sorted.map(row => {
      const tds = columns.map(col => {
        const val = col.format ? col.format(row[col.key], row) : (row[col.key] ?? '—');
        const align = col.align === 'right' ? ' class="text-right mono"' : '';
        const cell = col.raw ? val : Utils.escapeHtml(String(val));
        return `<td${align}>${cell}</td>`;
      }).join('');
      return `<tr data-id="${row.id || ''}">${tds}</tr>`;
    }).join('');

    return `<div class="table-wrap"><table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
  },

  /**
   * Attach sort handlers to a table.
   * @param {HTMLElement} container
   * @param {Function} onSort - (key, dir) => void
   */
  attachTableSort(container, onSort) {
    container.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        const current = th.classList.contains('sorted');
        const dir = current && th.dataset.dir === 'asc' ? 'desc' : 'asc';
        onSort(key, dir);
      });
    });
  },

  /**
   * Render metric card HTML.
   * @param {Object} opts
   * @returns {string}
   */
  metricCard({ label, value, change, changeType, variant }) {
    const changeHtml = change != null
      ? `<div class="metric-change ${changeType || ''}">${change}</div>` : '';
    return `
      <div class="metric-card ${variant || ''}">
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
        ${changeHtml}
      </div>`;
  },

  /**
   * Render page header.
   * @param {string} title
   * @param {string} [subtitle]
   * @returns {string}
   */
  pageHeader(title, subtitle) {
    return `
      <div class="page-header">
        <h1 class="page-title">${Utils.escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${Utils.escapeHtml(subtitle)}</p>` : ''}
      </div>`;
  },

  /**
   * Render empty state.
   * @param {string} icon
   * @param {string} title
   * @param {string} [description]
   * @returns {string}
   */
  emptyState(icon, title, description) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${Utils.escapeHtml(title)}</div>
        ${description ? `<p>${Utils.escapeHtml(description)}</p>` : ''}
      </div>`;
  },

  /**
   * Get badge class for watchlist status.
   * @param {string} status
   * @returns {string}
   */
  statusBadge(status) {
    const map = { study: 'badge-study', buy: 'badge-buy', hold: 'badge-hold', sell: 'badge-sell' };
    const labels = { study: 'Изучить', buy: 'Купить', hold: 'Держать', sell: 'Продать' };
    return `<span class="badge ${map[status] || ''}">${labels[status] || status}</span>`;
  },
};

// Wire toast to event bus
bus.on(AppEvents.TOAST, ({ message, type }) => UI.toast(message, type));
