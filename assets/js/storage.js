/**
 * @fileoverview Storage abstraction layer with adapter pattern.
 * Currently uses localStorage; designed for future Supabase/Firebase migration.
 * @module storage
 */

'use strict';

/**
 * Abstract storage adapter interface.
 * Implement this for remote backends (Supabase, Firebase).
 * @abstract
 * @class StorageAdapter
 */
class StorageAdapter {
  /**
   * @param {string} key
   * @returns {Promise<*>}
   */
  async get(key) { throw new Error('Not implemented'); }

  /**
   * @param {string} key
   * @param {*} value
   * @returns {Promise<void>}
   */
  async set(key, value) { throw new Error('Not implemented'); }

  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) { throw new Error('Not implemented'); }

  /**
   * @returns {Promise<string[]>}
   */
  async keys() { throw new Error('Not implemented'); }
}

/**
 * LocalStorage implementation of StorageAdapter.
 * @class LocalStorageAdapter
 * @extends StorageAdapter
 */
class LocalStorageAdapter extends StorageAdapter {
  /** @param {string} [prefix] */
  constructor(prefix = 'ios_') {
    super();
    this.prefix = prefix;
  }

  /** @param {string} key @returns {string} */
  _k(key) { return `${this.prefix}${key}`; }

  /** @inheritdoc */
  async get(key) {
    const raw = localStorage.getItem(this._k(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /** @inheritdoc */
  async set(key, value) {
    localStorage.setItem(this._k(key), JSON.stringify(value));
  }

  /** @inheritdoc */
  async remove(key) {
    localStorage.removeItem(this._k(key));
  }

  /** @inheritdoc */
  async keys() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) {
        result.push(k.slice(this.prefix.length));
      }
    }
    return result;
  }
}

/**
 * High-level data repository with typed collections.
 * Business logic interacts with this, not raw storage.
 * @class DataStore
 */
class DataStore {
  /**
   * @param {StorageAdapter} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** Switch backend adapter at runtime (e.g. migrate to Supabase) */
  setAdapter(adapter) {
    this.adapter = adapter;
  }

  /** @returns {Promise<Object>} */
  async getSettings() {
    return (await this.adapter.get('settings')) || {
      currency: 'USD',
      language: 'ru',
      theme: 'dark',
    };
  }

  /** @param {Object} settings */
  async saveSettings(settings) {
    await this.adapter.set('settings', settings);
    bus.emit(AppEvents.SETTINGS_CHANGED, settings);
  }

  /** @returns {Promise<Array>} */
  async getWatchlist() {
    return (await this.adapter.get('watchlist')) || [];
  }

  /** @param {Array} items */
  async saveWatchlist(items) {
    await this.adapter.set('watchlist', items);
    bus.emit(AppEvents.DATA_CHANGED, { collection: 'watchlist' });
  }

  /** @returns {Promise<Array>} */
  async getPortfolio() {
    return (await this.adapter.get('portfolio')) || [];
  }

  /** @param {Array} items */
  async savePortfolio(items) {
    await this.adapter.set('portfolio', items);
    bus.emit(AppEvents.DATA_CHANGED, { collection: 'portfolio' });
  }

  /** @returns {Promise<Array>} */
  async getDividends() {
    return (await this.adapter.get('dividends')) || [];
  }

  /** @param {Array} items */
  async saveDividends(items) {
    await this.adapter.set('dividends', items);
    bus.emit(AppEvents.DATA_CHANGED, { collection: 'dividends' });
  }

  /** @returns {Promise<Array>} */
  async getJournal() {
    return (await this.adapter.get('journal')) || [];
  }

  /** @param {Array} items */
  async saveJournal(items) {
    await this.adapter.set('journal', items);
    bus.emit(AppEvents.DATA_CHANGED, { collection: 'journal' });
  }

  /** @returns {Promise<Array>} */
  async getRatings() {
    return (await this.adapter.get('ratings')) || [];
  }

  /** @param {Array} items */
  async saveRatings(items) {
    await this.adapter.set('ratings', items);
    bus.emit(AppEvents.DATA_CHANGED, { collection: 'ratings' });
  }

  /** @returns {Promise<boolean>} */
  async isSeeded() {
    return !!(await this.adapter.get('seeded'));
  }

  async markSeeded() {
    await this.adapter.set('seeded', true);
  }

  /**
   * Export all data as a single object.
   * @returns {Promise<Object>}
   */
  async exportAll() {
    const [settings, watchlist, portfolio, dividends, journal, ratings] = await Promise.all([
      this.getSettings(),
      this.getWatchlist(),
      this.getPortfolio(),
      this.getDividends(),
      this.getJournal(),
      this.getRatings(),
    ]);
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings,
      watchlist,
      portfolio,
      dividends,
      journal,
      ratings,
    };
  }

  /**
   * Import data from exported object.
   * @param {Object} data
   */
  async importAll(data) {
    if (data.settings) await this.saveSettings(data.settings);
    if (data.watchlist) await this.saveWatchlist(data.watchlist);
    if (data.portfolio) await this.savePortfolio(data.portfolio);
    if (data.dividends) await this.saveDividends(data.dividends);
    if (data.journal) await this.saveJournal(data.journal);
    if (data.ratings) await this.saveRatings(data.ratings);
    bus.emit(AppEvents.DATA_CHANGED, { collection: 'all' });
  }

  /** Clear all application data */
  async clearAll() {
    const keys = await this.adapter.keys();
    for (const key of keys) {
      await this.adapter.remove(key);
    }
  }
}

/** Global data store instance */
const store = new DataStore(new LocalStorageAdapter());
