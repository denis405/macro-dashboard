/**
 * @fileoverview Application bootstrap — wires router, modules, and global UI.
 * @module app
 */

'use strict';

/**
 * Initialize the Investment OS application.
 */
async function initApp() {
  // Seed demo data on first launch
  await SeedData.init();

  // Apply saved settings
  const settings = await store.getSettings();
  applyTheme(settings.theme);
  updateCurrencyBadge(settings.currency);

  // Register all modules with router
  router.register('/', DashboardModule);
  router.register('/watchlist', WatchlistModule);
  router.register('/valuation', ValuationModule);
  router.register('/portfolio', PortfolioModule);
  router.register('/dividends', DividendsModule);
  router.register('/journal', JournalModule);
  router.register('/ratings', RatingsModule);
  router.register('/stress-test', StressTestModule);
  router.register('/analytics', AnalyticsModule);
  router.register('/settings', SettingsModule);

  // Start routing
  router.start();

  // Global UI bindings
  bindSidebar();
  bindGlobalSearch();
  bindClock();
  bindDataRefresh();

  // React to settings changes
  bus.on(AppEvents.SETTINGS_CHANGED, (s) => {
    applyTheme(s.theme);
    updateCurrencyBadge(s.currency);
  });
}

/**
 * Apply theme to document.
 * @param {string} theme
 */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || 'dark';
  bus.emit(AppEvents.THEME_CHANGED, theme);
}

/**
 * Update currency badge in topbar.
 * @param {string} currency
 */
function updateCurrencyBadge(currency) {
  const el = document.getElementById('currency-badge');
  if (el) el.textContent = currency;
}

/**
 * Sidebar toggle for mobile/collapse.
 */
function bindSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const app = document.getElementById('app');

  toggle?.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      app.classList.toggle('sidebar-open');
    } else {
      app.classList.toggle('sidebar-collapsed');
    }
  });
}

/**
 * Global search across all data collections.
 */
function bindGlobalSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;

  let resultsEl = document.querySelector('.search-results');
  if (!resultsEl) {
    resultsEl = document.createElement('div');
    resultsEl.className = 'search-results';
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(resultsEl);
  }

  const search = Utils.debounce(async (query) => {
    if (!query || query.length < 2) {
      resultsEl.classList.remove('visible');
      return;
    }

    const q = query.toLowerCase();
    const [watchlist, portfolio, journal, ratings] = await Promise.all([
      store.getWatchlist(), store.getPortfolio(), store.getJournal(), store.getRatings(),
    ]);

    const results = [];

    for (const w of watchlist) {
      if (w.ticker.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)) {
        results.push({ type: 'Watchlist', label: `${w.ticker} — ${w.name}`, route: '/watchlist' });
      }
    }
    for (const p of portfolio) {
      if (p.ticker.toLowerCase().includes(q)) {
        results.push({ type: 'Portfolio', label: p.ticker, route: '/portfolio' });
      }
    }
    for (const j of journal) {
      if (j.ticker.toLowerCase().includes(q) || j.thesis?.toLowerCase().includes(q)) {
        results.push({ type: 'Journal', label: `${j.ticker} — ${j.action}`, route: '/journal' });
      }
    }
    for (const r of ratings) {
      if (r.ticker.toLowerCase().includes(q)) {
        results.push({ type: 'Ratings', label: r.ticker, route: '/ratings' });
      }
    }

    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="search-result-item">Ничего не найдено</div>';
    } else {
      resultsEl.innerHTML = results.slice(0, 10).map(r =>
        `<a class="search-result-item" href="#${r.route}" data-route="${r.route}">
          <div>${Utils.escapeHtml(r.label)}</div>
          <div class="search-result-type">${r.type}</div>
        </a>`
      ).join('');
    }
    resultsEl.classList.add('visible');
  }, 250);

  input.addEventListener('input', (e) => search(e.target.value));
  input.addEventListener('blur', () => setTimeout(() => resultsEl.classList.remove('visible'), 200));
}

/**
 * Live clock in topbar.
 */
function bindClock() {
  const el = document.getElementById('topbar-clock');
  if (!el) return;

  const tick = () => {
    el.textContent = new Date().toLocaleString('ru-RU', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      day: '2-digit', month: 'short',
    });
  };
  tick();
  setInterval(tick, 1000);
}

/**
 * Re-render current module when data changes.
 */
function bindDataRefresh() {
  bus.on(AppEvents.DATA_CHANGED, () => {
    const path = router.getPath();
    const module = router.getCurrentModule();
    if (module?.render) {
      const container = document.getElementById('content');
      UI.destroyCharts();
      module.render(container);
    }
  });
}

// Bootstrap when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
