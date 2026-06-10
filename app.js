const DATA_URL = "data/indicators.json";

const statusConfig = {
  green: {
    label: "Зеленый",
    className: "status-green",
    color: "#22c55e",
    fill: "rgba(34, 197, 94, 0.12)"
  },
  yellow: {
    label: "Желтый",
    className: "status-yellow",
    color: "#f59e0b",
    fill: "rgba(245, 158, 11, 0.12)"
  },
  red: {
    label: "Красный",
    className: "status-red",
    color: "#ef4444",
    fill: "rgba(239, 68, 68, 0.12)"
  }
};

const grid = document.querySelector("#indicator-grid");
const guide = document.querySelector("#reading-guide");
const sourceList = document.querySelector("#source-list");

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  try {
    // GitHub Pages serves this JSON as a static asset, so no backend is needed.
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Data request failed: ${response.status}`);
    }

    const { indicators, updatedAt } = await response.json();
    renderIndicators(indicators);
    renderReadingGuide(indicators);
    renderSourceLinks(indicators);
    renderDataStatus(updatedAt);
  } catch (error) {
    renderError(error);
  }
}

function renderIndicators(indicators) {
  grid.innerHTML = indicators.map(createIndicatorCard).join("");

  indicators.forEach((indicator) => {
    const status = getIndicatorStatus(indicator);
    const canvas = document.querySelector(`#chart-${indicator.id}`);

    renderMiniChart(canvas, indicator.history, status);
  });
}

function createIndicatorCard(indicator) {
  const status = getIndicatorStatus(indicator);
  const formattedValue = formatValue(indicator);

  return `
    <article class="indicator-card">
      <div class="card-top">
        <div>
          <h2 class="indicator-title">${indicator.title}</h2>
          <p class="indicator-description">${indicator.description}</p>
        </div>
        <span class="status-pill ${status.className}">
          <span class="status-dot"></span>
          ${status.label}
        </span>
      </div>

      <div class="value-row">
        <div class="current-value">${formattedValue}</div>
        <div class="value-meta">
          <div>${indicator.period}</div>
          <div>${indicator.trendLabel}</div>
        </div>
      </div>

      <div class="chart-wrap">
        <canvas id="chart-${indicator.id}" aria-label="Мини-график ${indicator.title}"></canvas>
      </div>

      <a class="source-button" href="${indicator.sourceUrl}" target="_blank" rel="noopener noreferrer">
        Открыть источник
      </a>
    </article>
  `;
}

function renderReadingGuide(indicators) {
  guide.innerHTML = indicators.map((indicator) => `
    <article class="guide-card">
      <h3>${indicator.title}</h3>
      <dl class="guide-list">
        <div>
          <dt>Что показывает</dt>
          <dd>${indicator.guide.what}</dd>
        </div>
        <div>
          <dt>Почему важен</dt>
          <dd>${indicator.guide.why}</dd>
        </div>
        <div>
          <dt>Опасные значения</dt>
          <dd>${indicator.guide.danger}</dd>
        </div>
      </dl>
    </article>
  `).join("");
}

function renderSourceLinks(indicators) {
  sourceList.innerHTML = indicators.map((indicator) => `
    <a class="source-link" href="${indicator.sourceUrl}" target="_blank" rel="noopener noreferrer">
      <strong>${indicator.title}</strong>
      <span>${new URL(indicator.sourceUrl).hostname}</span>
    </a>
  `).join("");
}

function getIndicatorStatus(indicator) {
  let key = "yellow";

  // Status rules are intentionally centralized so the JSON can stay simple.
  if (indicator.id === "pmi") {
    if (indicator.value >= 52) key = "green";
    if (indicator.value >= 48 && indicator.value < 52) key = "yellow";
    if (indicator.value < 48) key = "red";
  }

  if (indicator.id === "copper") {
    key = indicator.trend === "up" ? "green" : indicator.trend === "down" ? "red" : "yellow";
  }

  if (indicator.id === "vix") {
    if (indicator.value < 15) key = "green";
    if (indicator.value >= 15 && indicator.value < 25) key = "yellow";
    if (indicator.value >= 25) key = "red";
  }

  if (indicator.id === "yield-curve") {
    key = indicator.curveShape === "normal" ? "green" : indicator.curveShape === "inversion" ? "red" : "yellow";
  }

  return statusConfig[key];
}

function formatValue(indicator) {
  if (indicator.format === "usd") {
    return `$${indicator.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  if (indicator.format === "percent") {
    return `${indicator.value.toFixed(1)}%`;
  }

  if (indicator.format === "spread") {
    return `${indicator.value > 0 ? "+" : ""}${indicator.value.toFixed(1)} б.п.`;
  }

  return indicator.value.toFixed(1);
}

function renderMiniChart(canvas, history, status) {
  const labels = history.map((point) => point.label);
  const values = history.map((point) => point.value);

  // Mini charts are deliberately quiet: trend shape matters more than axis detail.
  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: status.color,
          backgroundColor: status.fill,
          borderWidth: 2,
          tension: 0.38,
          pointRadius: 0,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 700,
        easing: "easeOutQuart"
      },
      interaction: {
        intersect: false,
        mode: "index"
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          displayColors: false,
          backgroundColor: "#111722",
          borderColor: "rgba(204, 214, 231, 0.24)",
          borderWidth: 1,
          titleColor: "#eef3fb",
          bodyColor: "#c2ccda"
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false,
          grace: "8%"
        }
      }
    }
  });
}

function renderDataStatus(updatedAt) {
  const status = document.querySelector("#data-status");
  if (!status) return;

  if (!updatedAt) {
    status.textContent = "Данные без отметки времени";
    return;
  }

  const formatted = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(updatedAt));

  status.textContent = `Обновлено ${formatted}`;
}

function renderError(error) {
  grid.innerHTML = `
    <article class="indicator-card">
      <div class="card-top">
        <div>
          <h2 class="indicator-title">Данные не загрузились</h2>
          <p class="indicator-description">
            Проверьте файл data/indicators.json и откройте сайт через GitHub Pages или локальный сервер.
          </p>
        </div>
      </div>
      <p class="indicator-description">${error.message}</p>
    </article>
  `;
}
