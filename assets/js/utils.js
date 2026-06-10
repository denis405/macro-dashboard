/**
 * @fileoverview Shared utilities: formatting, calculations, helpers.
 * @module utils
 */

'use strict';

const Utils = {
  /**
   * Generate a unique ID.
   * @returns {string}
   */
  uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  },

  /**
   * Format number as currency.
   * @param {number} value
   * @param {string} [currency='USD']
   * @returns {string}
   */
  formatCurrency(value, currency = 'USD') {
    const symbols = { USD: '$', EUR: '€', RUB: '₽', GBP: '£' };
    const sym = symbols[currency] || currency + ' ';
    const abs = Math.abs(value);
    const formatted = abs >= 1e6
      ? `${(abs / 1e6).toFixed(2)}M`
      : abs >= 1e3
        ? `${(abs / 1e3).toFixed(1)}K`
        : abs.toFixed(2);
    return `${value < 0 ? '-' : ''}${sym}${formatted}`;
  },

  /**
   * Format percentage.
   * @param {number} value
   * @param {number} [decimals=1]
   * @returns {string}
   */
  formatPercent(value, decimals = 1) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
  },

  /**
   * Format date for display.
   * @param {string|Date} date
   * @returns {string}
   */
  formatDate(date) {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  /**
   * Escape HTML to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Download a file in the browser.
   * @param {string} content
   * @param {string} filename
   * @param {string} mimeType
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Parse CSV string to array of objects.
   * @param {string} csv
   * @returns {Array<Object>}
   */
  parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.match(/(".*?"|[^,]+)/g) || [];
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (values[i] || '').trim().replace(/^"|"$/g, '');
      });
      return obj;
    });
  },

  /**
   * Convert array of objects to CSV string.
   * @param {Array<Object>} data
   * @returns {string}
   */
  toCSV(data) {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
      headers.map(h => {
        const val = row[h] ?? '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  },

  /**
   * Debounce function calls.
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  },

  // ─── Portfolio calculations ───

  /**
   * Calculate position metrics.
   * @param {Object} position
   * @returns {Object}
   */
  calcPosition(position) {
    const invested = position.quantity * position.avgPrice;
    const currentValue = position.quantity * position.currentPrice;
    const profit = currentValue - invested;
    const returnPct = invested > 0 ? (profit / invested) * 100 : 0;
    return { invested, currentValue, profit, returnPct };
  },

  /**
   * Aggregate portfolio totals.
   * @param {Array} positions
   * @returns {Object}
   */
  calcPortfolioTotals(positions) {
    let totalInvested = 0;
    let totalValue = 0;
    for (const p of positions) {
      const m = Utils.calcPosition(p);
      totalInvested += m.invested;
      totalValue += m.currentValue;
    }
    const profit = totalValue - totalInvested;
    const returnPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
    return { totalInvested, totalValue, profit, returnPct };
  },

  /**
   * Group portfolio by field and calculate weights.
   * @param {Array} positions
   * @param {string} field
   * @returns {Object}
   */
  groupByField(positions, field) {
    const groups = {};
    let total = 0;
    for (const p of positions) {
      const m = Utils.calcPosition(p);
      const key = p[field] || 'Other';
      groups[key] = (groups[key] || 0) + m.currentValue;
      total += m.currentValue;
    }
    const result = {};
    for (const [k, v] of Object.entries(groups)) {
      result[k] = { value: v, weight: total > 0 ? (v / total) * 100 : 0 };
    }
    return result;
  },

  /**
   * Calculate concentration (largest position weight).
   * @param {Array} positions
   * @returns {number}
   */
  calcConcentration(positions) {
    const totals = Utils.calcPortfolioTotals(positions);
    if (totals.totalValue === 0) return 0;
    let max = 0;
    for (const p of positions) {
      const m = Utils.calcPosition(p);
      const w = (m.currentValue / totals.totalValue) * 100;
      if (w > max) max = w;
    }
    return max;
  },

  /**
   * Calculate sector concentration.
   * @param {Array} positions
   * @returns {number}
   */
  calcSectorConcentration(positions) {
    const sectors = Utils.groupByField(positions, 'sector');
    let max = 0;
    for (const s of Object.values(sectors)) {
      if (s.weight > max) max = s.weight;
    }
    return max;
  },

  // ─── Valuation formulas ───

  /**
   * Graham Formula: V = EPS × (8.5 + 2g) × 4.4 / Y
   * @param {number} eps
   * @param {number} growthRate - as percentage (e.g. 10 for 10%)
   * @param {number} bondYield - AAA bond yield (default 4.4%)
   * @returns {number}
   */
  grahamFormula(eps, growthRate, bondYield = 4.4) {
    return eps * (8.5 + 2 * growthRate) * 4.4 / bondYield;
  },

  /**
   * Dividend Discount Model (Gordon Growth).
   * @param {number} dividend
   * @param {number} growthRate - as decimal (e.g. 0.05)
   * @param {number} discountRate - as decimal (e.g. 0.10)
   * @returns {number}
   */
  dividendDiscountModel(dividend, growthRate, discountRate) {
    if (discountRate <= growthRate) return 0;
    return dividend * (1 + growthRate) / (discountRate - growthRate);
  },

  /**
   * Reverse DCF: implied growth from current price.
   * @param {number} price
   * @param {number} fcf - free cash flow per share
   * @param {number} discountRate - as decimal
   * @param {number} terminalGrowth - as decimal
   * @returns {number} implied growth rate as percentage
   */
  reverseDCF(price, fcf, discountRate = 0.10, terminalGrowth = 0.03) {
    if (price <= 0 || fcf <= 0) return 0;
    // Simplified: solve for g where price = FCF*(1+g)/(r-g)
    const g = (price * discountRate - fcf) / (price + fcf);
    return Math.max(0, g * 100);
  },

  /**
   * Earnings Multiple valuation.
   * @param {number} eps
   * @param {number} pe
   * @returns {number}
   */
  earningsMultiple(eps, pe) {
    return eps * pe;
  },

  /**
   * Margin of safety.
   * @param {number} fairValue
   * @param {number} currentPrice
   * @returns {number} percentage
   */
  marginOfSafety(fairValue, currentPrice) {
    if (fairValue <= 0) return 0;
    return ((fairValue - currentPrice) / fairValue) * 100;
  },

  /**
   * Potential return to fair value.
   * @param {number} fairValue
   * @param {number} currentPrice
   * @returns {number} percentage
   */
  potentialReturn(fairValue, currentPrice) {
    if (currentPrice <= 0) return 0;
    return ((fairValue - currentPrice) / currentPrice) * 100;
  },

  // ─── Rating calculations ───

  /**
   * Score a single metric on 0-100 scale.
   * @param {number} value
   * @param {Object} thresholds - { excellent, good, average }
   * @param {boolean} [lowerIsBetter=false]
   * @returns {number}
   */
  scoreMetric(value, thresholds, lowerIsBetter = false) {
    const { excellent, good, average } = thresholds;
    if (lowerIsBetter) {
      if (value <= excellent) return 100;
      if (value <= good) return 75;
      if (value <= average) return 50;
      return 25;
    }
    if (value >= excellent) return 100;
    if (value >= good) return 75;
    if (value >= average) return 50;
    return 25;
  },

  /**
   * Calculate composite company rating.
   * @param {Object} metrics
   * @returns {{ score: number, category: string, class: string }}
   */
  calcRating(metrics) {
    const scores = [
      Utils.scoreMetric(metrics.roe, { excellent: 20, good: 15, average: 10 }),
      Utils.scoreMetric(metrics.roic, { excellent: 15, good: 10, average: 5 }),
      Utils.scoreMetric(metrics.debtEquity, { excellent: 0.3, good: 0.7, average: 1.5 }, true),
      Utils.scoreMetric(metrics.netMargin, { excellent: 20, good: 12, average: 5 }),
      Utils.scoreMetric(metrics.revenueGrowth, { excellent: 15, good: 8, average: 3 }),
      Utils.scoreMetric(metrics.epsGrowth, { excellent: 15, good: 8, average: 3 }),
      Utils.scoreMetric(metrics.dividendGrowth, { excellent: 10, good: 5, average: 2 }),
      Utils.scoreMetric(metrics.fcfGrowth, { excellent: 12, good: 6, average: 2 }),
    ];
    const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return { score, ...Utils.ratingCategory(score) };
  },

  /**
   * Get rating category from score.
   * @param {number} score
   * @returns {{ category: string, class: string }}
   */
  ratingCategory(score) {
    if (score >= 90) return { category: 'Exceptional', class: 'rating-exceptional' };
    if (score >= 75) return { category: 'Excellent', class: 'rating-excellent' };
    if (score >= 60) return { category: 'Good', class: 'rating-good' };
    if (score >= 40) return { category: 'Average', class: 'rating-average' };
    return { category: 'Weak', class: 'rating-weak' };
  },

  // ─── Dividend calculations ───

  /**
   * Calculate expected dividend payment.
   * @param {number} dividendPerShare
   * @param {number} shares
   * @returns {number}
   */
  calcDividendPayment(dividendPerShare, shares) {
    return dividendPerShare * shares;
  },

  /**
   * Group dividends by period.
   * @param {Array} dividends
   * @param {Array} portfolio
   * @param {'month'|'quarter'|'year'} period
   * @returns {Object}
   */
  groupDividendsByPeriod(dividends, portfolio, period) {
    const groups = {};
    for (const d of dividends) {
      const pos = portfolio.find(p => p.ticker === d.ticker);
      const shares = pos ? pos.quantity : (d.shares || 0);
      const payment = Utils.calcDividendPayment(d.dividendPerShare, shares);
      const date = new Date(d.payDate);
      let key;
      if (period === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'quarter') {
        key = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
      } else {
        key = `${date.getFullYear()}`;
      }
      groups[key] = (groups[key] || 0) + payment;
    }
    return groups;
  },

  // ─── Analytics ───

  /**
   * Calculate CAGR.
   * @param {number} startValue
   * @param {number} endValue
   * @param {number} years
   * @returns {number}
   */
  calcCAGR(startValue, endValue, years) {
    if (startValue <= 0 || years <= 0) return 0;
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  },

  /**
   * Yield on cost.
   * @param {number} annualDividend
   * @param {number} costBasis
   * @returns {number}
   */
  yieldOnCost(annualDividend, costBasis) {
    if (costBasis <= 0) return 0;
    return (annualDividend / costBasis) * 100;
  },

  /**
   * Get watchlist price signal.
   * @param {number} currentPrice
   * @param {number} fairPrice
   * @returns {'green'|'red'|'neutral'}
   */
  priceSignal(currentPrice, fairPrice) {
    if (!fairPrice || fairPrice <= 0) return 'neutral';
    const discount = ((fairPrice - currentPrice) / fairPrice) * 100;
    if (discount >= 20) return 'green';
    if (currentPrice > fairPrice) return 'red';
    return 'neutral';
  },
};
