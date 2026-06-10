/**
 * @fileoverview Seed data for first-time users.
 * Populates localStorage with demo portfolio on initial launch.
 * @module seed
 */

'use strict';

const SeedData = {
  /**
   * Initialize demo data if storage is empty.
   */
  async init() {
    if (await store.isSeeded()) return;

    await store.saveSettings({ currency: 'USD', language: 'ru', theme: 'dark' });

    await store.saveWatchlist([
      { id: 'w1', ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', country: 'USA', currentPrice: 178.50, targetPrice: 200, fairPrice: 185, comment: 'Сильный бренд, экосистема', status: 'hold', favorite: true },
      { id: 'w2', ticker: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', country: 'USA', currentPrice: 415.20, targetPrice: 450, fairPrice: 400, comment: 'Облако + AI лидер', status: 'buy', favorite: true },
      { id: 'w3', ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', country: 'USA', currentPrice: 156.80, targetPrice: 170, fairPrice: 165, comment: 'Дивидендный аристократ', status: 'hold', favorite: false },
      { id: 'w4', ticker: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer', country: 'USA', currentPrice: 62.40, targetPrice: 68, fairPrice: 58, comment: 'Ниже справедливой — сигнал', status: 'buy', favorite: true },
      { id: 'w5', ticker: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials', country: 'USA', currentPrice: 412.00, targetPrice: 450, fairPrice: 395, comment: 'Изучаю для покупки', status: 'study', favorite: false },
      { id: 'w6', ticker: 'PG', name: 'Procter & Gamble', sector: 'Consumer', country: 'USA', currentPrice: 168.30, targetPrice: 175, fairPrice: 155, comment: 'Переоценена', status: 'sell', favorite: false },
    ]);

    await store.savePortfolio([
      { id: 'p1', ticker: 'AAPL', quantity: 50, avgPrice: 145.00, currentPrice: 178.50, sector: 'Technology', country: 'USA' },
      { id: 'p2', ticker: 'MSFT', quantity: 30, avgPrice: 320.00, currentPrice: 415.20, sector: 'Technology', country: 'USA' },
      { id: 'p3', ticker: 'JNJ', quantity: 40, avgPrice: 158.00, currentPrice: 156.80, sector: 'Healthcare', country: 'USA' },
      { id: 'p4', ticker: 'KO', quantity: 100, avgPrice: 55.00, currentPrice: 62.40, sector: 'Consumer', country: 'USA' },
      { id: 'p5', ticker: 'PG', quantity: 25, avgPrice: 145.00, currentPrice: 168.30, sector: 'Consumer', country: 'USA' },
    ]);

    await store.saveDividends([
      { id: 'd1', ticker: 'AAPL', exDate: '2026-02-10', payDate: '2026-02-14', dividendPerShare: 0.25, shares: 50 },
      { id: 'd2', ticker: 'MSFT', exDate: '2026-02-20', payDate: '2026-03-13', dividendPerShare: 0.83, shares: 30 },
      { id: 'd3', ticker: 'JNJ', exDate: '2026-02-25', payDate: '2026-03-10', dividendPerShare: 1.24, shares: 40 },
      { id: 'd4', ticker: 'KO', exDate: '2026-03-01', payDate: '2026-04-01', dividendPerShare: 0.485, shares: 100 },
      { id: 'd5', ticker: 'PG', exDate: '2026-04-15', payDate: '2026-05-15', dividendPerShare: 0.94, shares: 25 },
      { id: 'd6', ticker: 'AAPL', exDate: '2026-05-10', payDate: '2026-05-15', dividendPerShare: 0.25, shares: 50 },
      { id: 'd7', ticker: 'MSFT', exDate: '2026-05-20', payDate: '2026-06-12', dividendPerShare: 0.83, shares: 30 },
      { id: 'd8', ticker: 'KO', exDate: '2026-06-01', payDate: '2026-07-01', dividendPerShare: 0.485, shares: 100 },
    ]);

    await store.saveJournal([
      {
        id: 'j1', date: '2025-03-15', ticker: 'AAPL', action: 'buy',
        thesis: 'Apple остаётся лидером в экосистеме premium-устройств с растущим сервисным доходом.',
        reasons: 'Высокий ROE, сильный FCF, байбэки, растущие сервисы.',
        risks: 'Зависимость от iPhone, регуляторное давление в EU.',
        expectedReturn: 12, fairPrice: 185, tags: ['tech', 'quality'],
      },
      {
        id: 'j2', date: '2025-06-20', ticker: 'MSFT', action: 'buy',
        thesis: 'Microsoft — ключевой бенефициар AI-трансформации через Azure и Copilot.',
        reasons: 'Доминирование в облаке, recurring revenue, сильный менеджмент.',
        risks: 'Высокая оценка, конкуренция Google/AWS в AI.',
        expectedReturn: 15, fairPrice: 400, tags: ['tech', 'ai'],
      },
      {
        id: 'j3', date: '2025-09-10', ticker: 'KO', action: 'buy',
        thesis: 'Coca-Cola — классический дивидендный актив с глобальным брендом.',
        reasons: 'Цена ниже справедливой на 20%+, стабильные дивиденды 60+ лет.',
        risks: 'Снижение потребления сахара, валютные риски EM.',
        expectedReturn: 10, fairPrice: 58, tags: ['dividend', 'consumer'],
      },
    ]);

    await store.saveRatings([
      { id: 'r1', ticker: 'AAPL', roe: 147, roic: 56, debtEquity: 1.8, netMargin: 26, revenueGrowth: 8, epsGrowth: 12, dividendGrowth: 5, fcfGrowth: 10 },
      { id: 'r2', ticker: 'MSFT', roe: 38, roic: 28, debtEquity: 0.4, netMargin: 36, revenueGrowth: 15, epsGrowth: 18, dividendGrowth: 10, fcfGrowth: 14 },
      { id: 'r3', ticker: 'JNJ', roe: 25, roic: 15, debtEquity: 0.5, netMargin: 18, revenueGrowth: 5, epsGrowth: 6, dividendGrowth: 6, fcfGrowth: 4 },
      { id: 'r4', ticker: 'KO', roe: 42, roic: 12, debtEquity: 1.6, netMargin: 23, revenueGrowth: 4, epsGrowth: 5, dividendGrowth: 4, fcfGrowth: 3 },
      { id: 'r5', ticker: 'PG', roe: 30, roic: 18, debtEquity: 0.7, netMargin: 18, revenueGrowth: 3, epsGrowth: 4, dividendGrowth: 5, fcfGrowth: 3 },
    ]);

    await store.markSeeded();
  },
};
