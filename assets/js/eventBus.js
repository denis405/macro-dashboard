/**
 * @fileoverview Pub/Sub event bus for decoupled inter-module communication.
 * Modules emit and listen to events without direct dependencies.
 * @module eventBus
 */

'use strict';

/**
 * Lightweight publish-subscribe event bus.
 * @class EventBus
 */
class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) set.delete(callback);
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {*} [data]
   */
  emit(event, data) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  /**
   * Subscribe to an event once.
   * @param {string} event
   * @param {Function} callback
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }
}

/** Global event bus instance */
const bus = new EventBus();

/** Standard application events */
const AppEvents = {
  DATA_CHANGED: 'data:changed',
  SETTINGS_CHANGED: 'settings:changed',
  ROUTE_CHANGED: 'route:changed',
  TOAST: 'ui:toast',
  THEME_CHANGED: 'theme:changed',
};
