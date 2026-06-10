/**
 * @fileoverview Valuation module — Graham, DDM, Reverse DCF, Earnings Multiple.
 * @module ValuationModule
 */

'use strict';

const ValuationModule = {
  title: 'Valuation',
  _method: 'graham',

  async render(container) {
    container.innerHTML = `
      ${UI.pageHeader('Valuation', 'Оценка справедливой стоимости акций')}
      <div class="valuation-methods">
        <button class="method-btn ${this._method === 'graham' ? 'active' : ''}" data-method="graham">Graham Formula</button>
        <button class="method-btn ${this._method === 'ddm' ? 'active' : ''}" data-method="ddm">Dividend Discount Model</button>
        <button class="method-btn ${this._method === 'dcf' ? 'active' : ''}" data-method="dcf">Reverse DCF</button>
        <button class="method-btn ${this._method === 'multiple' ? 'active' : ''}" data-method="multiple">Earnings Multiple</button>
      </div>
      <div class="valuation-layout">
        <div class="card" id="valuation-form">${this._formHtml()}</div>
        <div class="card" id="valuation-info">
          <div class="card-title">${this._methodTitle()}</div>
          <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;margin-top:12px">${this._methodDescription()}</p>
        </div>
      </div>
      <div class="valuation-results" id="valuation-results"></div>
    `;

    this._bindEvents(container);
  },

  _methodTitle() {
    const titles = {
      graham: 'Формула Бенджамина Грэма',
      ddm: 'Модель дисконтирования дивидендов',
      dcf: 'Обратный DCF',
      multiple: 'Мультипликатор прибыли',
    };
    return titles[this._method];
  },

  _methodDescription() {
    const desc = {
      graham: 'V = EPS × (8.5 + 2g) × 4.4 / Y, где g — ожидаемый рост (%), Y — доходность AAA-облигаций.',
      ddm: 'V = D₁ / (r − g), где D₁ — ожидаемый дивиденд, r — ставка дисконтирования, g — рост дивидендов.',
      dcf: 'Определяет подразумеваемый рост FCF, исходя из текущей рыночной цены и дисконтирования.',
      multiple: 'V = EPS × P/E — простая оценка на основе мультипликатора прибыли.',
    };
    return desc[this._method];
  },

  _formHtml() {
    const common = `
      <div class="form-group"><label class="form-label">Текущая цена</label>
        <input class="form-input" id="v-price" type="number" step="0.01" placeholder="100.00"></div>`;

    const forms = {
      graham: `
        <div class="form-group"><label class="form-label">EPS</label>
          <input class="form-input" id="v-eps" type="number" step="0.01" placeholder="5.00"></div>
        <div class="form-group"><label class="form-label">Growth Rate (%)</label>
          <input class="form-input" id="v-growth" type="number" step="0.1" placeholder="10"></div>
        <div class="form-group"><label class="form-label">Bond Yield (%)</label>
          <input class="form-input" id="v-bond" type="number" step="0.1" value="4.4"></div>
        ${common}`,
      ddm: `
        <div class="form-group"><label class="form-label">Дивиденд (D₀)</label>
          <input class="form-input" id="v-dividend" type="number" step="0.01" placeholder="2.00"></div>
        <div class="form-group"><label class="form-label">Growth Rate (%)</label>
          <input class="form-input" id="v-growth" type="number" step="0.1" placeholder="5"></div>
        <div class="form-group"><label class="form-label">Discount Rate (%)</label>
          <input class="form-input" id="v-discount" type="number" step="0.1" placeholder="10"></div>
        ${common}`,
      dcf: `
        <div class="form-group"><label class="form-label">FCF per Share</label>
          <input class="form-input" id="v-fcf" type="number" step="0.01" placeholder="6.00"></div>
        <div class="form-group"><label class="form-label">Discount Rate (%)</label>
          <input class="form-input" id="v-discount" type="number" step="0.1" value="10"></div>
        ${common}`,
      multiple: `
        <div class="form-group"><label class="form-label">EPS</label>
          <input class="form-input" id="v-eps" type="number" step="0.01" placeholder="5.00"></div>
        <div class="form-group"><label class="form-label">P/E Ratio</label>
          <input class="form-input" id="v-pe" type="number" step="0.1" placeholder="20"></div>
        ${common}`,
    };
    return `${forms[this._method]}<button class="btn btn-primary" id="v-calc" style="margin-top:12px;width:100%">Рассчитать</button>`;
  },

  _bindEvents(container) {
    container.querySelectorAll('[data-method]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._method = btn.dataset.method;
        this.render(container);
      });
    });
    container.querySelector('#v-calc')?.addEventListener('click', () => this._calculate(container));
  },

  _calculate(container) {
    const price = parseFloat(document.getElementById('v-price')?.value) || 0;
    let fairValue = 0;

    switch (this._method) {
      case 'graham': {
        const eps = parseFloat(document.getElementById('v-eps')?.value) || 0;
        const growth = parseFloat(document.getElementById('v-growth')?.value) || 0;
        const bond = parseFloat(document.getElementById('v-bond')?.value) || 4.4;
        fairValue = Utils.grahamFormula(eps, growth, bond);
        break;
      }
      case 'ddm': {
        const div = parseFloat(document.getElementById('v-dividend')?.value) || 0;
        const growth = (parseFloat(document.getElementById('v-growth')?.value) || 0) / 100;
        const discount = (parseFloat(document.getElementById('v-discount')?.value) || 0) / 100;
        fairValue = Utils.dividendDiscountModel(div, growth, discount);
        break;
      }
      case 'dcf': {
        const fcf = parseFloat(document.getElementById('v-fcf')?.value) || 0;
        const discount = (parseFloat(document.getElementById('v-discount')?.value) || 10) / 100;
        const impliedGrowth = Utils.reverseDCF(price, fcf, discount);
        fairValue = price; // Reverse DCF shows implied growth, not fair value
        const resultsEl = container.querySelector('#valuation-results');
        resultsEl.innerHTML = `
          <div class="result-card"><div class="result-card-label">Подразумеваемый рост FCF</div>
            <div class="result-card-value">${impliedGrowth.toFixed(1)}%</div></div>
          <div class="result-card"><div class="result-card-label">FCF per Share</div>
            <div class="result-card-value">$${fcf.toFixed(2)}</div></div>
          <div class="result-card"><div class="result-card-label">Discount Rate</div>
            <div class="result-card-value">${(discount * 100).toFixed(1)}%</div></div>`;
        return;
      }
      case 'multiple': {
        const eps = parseFloat(document.getElementById('v-eps')?.value) || 0;
        const pe = parseFloat(document.getElementById('v-pe')?.value) || 0;
        fairValue = Utils.earningsMultiple(eps, pe);
        break;
      }
    }

    const mos = Utils.marginOfSafety(fairValue, price);
    const potReturn = Utils.potentialReturn(fairValue, price);
    const mosClass = mos >= 20 ? 'positive' : mos < 0 ? 'negative' : '';

    container.querySelector('#valuation-results').innerHTML = `
      <div class="result-card">
        <div class="result-card-label">Справедливая стоимость</div>
        <div class="result-card-value">$${fairValue.toFixed(2)}</div>
      </div>
      <div class="result-card">
        <div class="result-card-label">Margin of Safety</div>
        <div class="result-card-value" style="color:var(--${mos >= 20 ? 'positive' : mos < 0 ? 'negative' : 'accent'})">${Utils.formatPercent(mos)}</div>
      </div>
      <div class="result-card">
        <div class="result-card-label">Потенциальная доходность</div>
        <div class="result-card-value" style="color:var(--${potReturn > 0 ? 'positive' : 'negative'})">${Utils.formatPercent(potReturn)}</div>
      </div>`;
  },
};
