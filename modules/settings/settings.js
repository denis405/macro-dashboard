/**
 * @fileoverview Settings module — theme, currency, language, import/export.
 * @module SettingsModule
 */

'use strict';

const SettingsModule = {
  title: 'Settings',

  async render(container) {
    const settings = await store.getSettings();

    container.innerHTML = `
      ${UI.pageHeader('Settings', 'Настройки приложения и управление данными')}

      <div class="settings-section">
        <div class="settings-section-title">Тема оформления</div>
        <div class="theme-options">
          ${['dark', 'light', 'terminal'].map(t => `
            <div class="theme-option ${settings.theme === t ? 'active' : ''}" data-theme="${t}">
              <div class="theme-preview theme-preview-${t}"></div>
              <div>${t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'Terminal'}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Общие настройки</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Валюта</label>
            <select class="form-select" id="set-currency">
              ${['USD', 'EUR', 'RUB', 'GBP'].map(c =>
                `<option value="${c}" ${settings.currency === c ? 'selected' : ''}>${c}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Язык</label>
            <select class="form-select" id="set-language">
              <option value="ru" ${settings.language === 'ru' ? 'selected' : ''}>Русский</option>
              <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" id="set-save">Сохранить настройки</button>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Экспорт данных</div>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px">
          Сохраните все данные портфеля в файл для резервного копирования.
        </p>
        <div class="btn-group">
          <button class="btn" id="export-json">Экспорт JSON</button>
          <button class="btn" id="export-csv">Экспорт CSV (Portfolio)</button>
          <button class="btn btn-primary" id="backup-btn">Backup</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Импорт данных</div>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px">
          Восстановите данные из ранее сохранённого файла.
        </p>
        <div class="btn-group">
          <button class="btn" id="import-json-btn">Импорт JSON</button>
          <button class="btn" id="import-csv-btn">Импорт CSV (Portfolio)</button>
          <button class="btn btn-primary" id="restore-btn">Restore</button>
        </div>
        <input type="file" id="import-file" accept=".json,.csv" hidden>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Опасная зона</div>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px">
          Удаление всех данных необратимо. Рекомендуем сначала сделать Backup.
        </p>
        <button class="btn btn-danger" id="clear-all">Удалить все данные</button>
      </div>
    `;

    this._bindEvents(container);
  },

  _bindEvents(container) {
    // Theme selection
    container.querySelectorAll('[data-theme]').forEach(el => {
      el.addEventListener('click', async () => {
        const settings = await store.getSettings();
        settings.theme = el.dataset.theme;
        await store.saveSettings(settings);
        container.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
        el.classList.add('active');
        UI.toast('Тема изменена', 'success');
      });
    });

    // Save general settings
    container.querySelector('#set-save')?.addEventListener('click', async () => {
      const settings = await store.getSettings();
      settings.currency = document.getElementById('set-currency').value;
      settings.language = document.getElementById('set-language').value;
      await store.saveSettings(settings);
      UI.toast('Настройки сохранены', 'success');
    });

    // Export JSON
    const exportJson = async () => {
      const data = await store.exportAll();
      Utils.downloadFile(JSON.stringify(data, null, 2), `investment-os-backup-${Date.now()}.json`, 'application/json');
      UI.toast('JSON экспортирован', 'success');
    };

    container.querySelector('#export-json')?.addEventListener('click', exportJson);
    container.querySelector('#backup-btn')?.addEventListener('click', exportJson);

    // Export CSV (portfolio)
    container.querySelector('#export-csv')?.addEventListener('click', async () => {
      const portfolio = await store.getPortfolio();
      const csv = Utils.toCSV(portfolio);
      Utils.downloadFile(csv, `portfolio-${Date.now()}.csv`, 'text/csv');
      UI.toast('CSV экспортирован', 'success');
    });

    // Import
    const fileInput = container.querySelector('#import-file');
    let importMode = 'json';

    const triggerImport = (mode) => {
      importMode = mode;
      fileInput.accept = mode === 'json' ? '.json' : '.csv';
      fileInput.click();
    };

    container.querySelector('#import-json-btn')?.addEventListener('click', () => triggerImport('json'));
    container.querySelector('#restore-btn')?.addEventListener('click', () => triggerImport('json'));
    container.querySelector('#import-csv-btn')?.addEventListener('click', () => triggerImport('csv'));

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      try {
        if (importMode === 'json') {
          const data = JSON.parse(text);
          const ok = await UI.modal('Импорт данных', '<p>Текущие данные будут заменены. Продолжить?</p>', { confirmText: 'Импортировать' });
          if (!ok) return;
          await store.importAll(data);
          UI.toast('Данные импортированы', 'success');
        } else {
          const rows = Utils.parseCSV(text);
          const portfolio = rows.map(r => ({
            id: Utils.uid(),
            ticker: r.ticker || r.Ticker || '',
            quantity: parseFloat(r.quantity || r.Quantity) || 0,
            avgPrice: parseFloat(r.avgPrice || r['Avg Price'] || r.avg_price) || 0,
            currentPrice: parseFloat(r.currentPrice || r['Current Price'] || r.current_price) || 0,
            sector: r.sector || r.Sector || '',
            country: r.country || r.Country || '',
          }));
          await store.savePortfolio(portfolio);
          UI.toast(`Импортировано ${portfolio.length} позиций`, 'success');
        }
      } catch (err) {
        UI.toast('Ошибка импорта: ' + err.message, 'error');
      }
      fileInput.value = '';
    });

    // Clear all
    container.querySelector('#clear-all')?.addEventListener('click', async () => {
      const ok = await UI.modal('Удалить все данные?', '<p>Это действие необратимо. Все данные будут удалены из LocalStorage.</p>', { confirmText: 'Удалить всё' });
      if (!ok) return;
      await store.clearAll();
      await SeedData.init();
      UI.toast('Данные сброшены', 'success');
      router.navigate('/');
    });
  },
};
