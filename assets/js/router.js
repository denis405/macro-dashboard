/**
 * @fileoverview Hash-based SPA router.
 * Maps URL hash fragments to isolated module renderers.
 * @module router
 */

'use strict';

/**
 * Client-side hash router.
 * @class Router
 */
class Router {
  constructor() {
    /** @type {Map<string, Object>} */
    this._routes = new Map();
    /** @type {string} */
    this._currentRoute = '';
    /** @type {Object|null} */
    this._currentModule = null;
  }

  /**
   * Register a route with its module.
   * @param {string} path - Route path (e.g. '/', '/watchlist')
   * @param {Object} module - Module with { title, render(container), destroy?() }
   */
  register(path, module) {
    this._routes.set(path, module);
  }

  /**
   * Navigate to a route programmatically.
   * @param {string} path
   */
  navigate(path) {
    window.location.hash = path === '/' ? '#/' : `#${path}`;
  }

  /**
   * Get current route path from hash.
   * @returns {string}
   */
  getPath() {
    const hash = window.location.hash.slice(1) || '/';
    return hash.split('?')[0];
  }

  /**
   * Start listening to hash changes.
   */
  start() {
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  }

  /**
   * Handle route change: destroy old module, render new one.
   * @private
   */
  async _handleRoute() {
    const path = this.getPath();
    const module = this._routes.get(path);

    if (!module) {
      this.navigate('/');
      return;
    }

    // Destroy previous module
    if (this._currentModule?.destroy) {
      try { this._currentModule.destroy(); } catch (e) { console.error(e); }
    }
    UI.destroyCharts();

    this._currentRoute = path;
    this._currentModule = module;

    // Update navigation UI
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === path);
    });

    const breadcrumb = document.getElementById('breadcrumb-current');
    if (breadcrumb) breadcrumb.textContent = module.title;

    bus.emit(AppEvents.ROUTE_CHANGED, { path, module });

    // Render module into content area
    const container = document.getElementById('content');
    if (container && module.render) {
      container.innerHTML = '<div class="loading">Загрузка…</div>';
      try {
        await module.render(container);
      } catch (err) {
        console.error(`[Router] Error rendering ${path}:`, err);
        container.innerHTML = UI.emptyState('⚠', 'Ошибка загрузки', err.message);
      }
    }
  }

  /**
   * Get the currently active module.
   * @returns {Object|null}
   */
  getCurrentModule() {
    return this._currentModule;
  }
}

/** Global router instance */
const router = new Router();
