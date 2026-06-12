/** Main dashboard controller. */

import {
  STATUS,
  fetchJSON,
  filterLast12Months,
  formatDate,
  formatNumber,
  formatUsd,
  latestRecord,
  statusClass,
} from "./utils.js";
import {
  INDICATORS,
  getIndicatorStatus,
  getMacroRegimeScore,
} from "./indicators.js";
import { getCompositeSummary } from "./composite.js";
import { createLineChart, createSpreadChart, destroyChart } from "./charts.js";

const charts = {};

async function loadData() {
  const [pmi, copper, vix, yieldCurve, composite] = await Promise.all([
    fetchJSON(INDICATORS.pmi.dataFile),
    fetchJSON(INDICATORS.copper.dataFile),
    fetchJSON(INDICATORS.vix.dataFile),
    fetchJSON(INDICATORS.yieldCurve.dataFile),
    fetchJSON("data/composite.json"),
  ]);

  return { pmi, copper, vix, yieldCurve, composite };
}

function setStatus(element, status, label) {
  element.className = `status-pill ${statusClass(status)}`;
  element.textContent = label;
}

function renderMacroRegime(data) {
  const regime = getMacroRegimeScore(data);
  const scoreEl = document.getElementById("regime-score");
  const labelEl = document.getElementById("regime-label");
  const breakdownEl = document.getElementById("regime-breakdown");

  scoreEl.textContent = `${regime.score} / ${regime.max}`;
  labelEl.textContent = regime.regime;
  setStatus(document.getElementById("regime-status"), regime.status, regime.regime);

  breakdownEl.innerHTML = regime.breakdown.length
    ? regime.breakdown
        .map(
          (item) =>
            `<li><span>${item.label}</span><strong>+${item.points}</strong></li>`
        )
        .join("")
    : "<li><span>No active signals</span><strong>0</strong></li>";
}

function renderComposite(data) {
  const summary = getCompositeSummary(data.composite);
  const valueEl = document.getElementById("composite-value");
  const labelEl = document.getElementById("composite-label");
  const statusEl = document.getElementById("composite-status");

  valueEl.textContent =
    summary.value == null ? "—" : formatNumber(summary.value, 2);
  labelEl.textContent = summary.label;
  setStatus(statusEl, summary.status, summary.label);

  destroyChart(charts.composite);
  const canvas = document.getElementById("composite-chart");
  charts.composite = createLineChart(
    canvas,
    filterLast12Months(data.composite),
    {
      label: "Composite Index",
      monthly: true,
      color: "#a78bfa",
    }
  );
}

function formatIndicatorValue(indicator, record) {
  if (!record) return "—";
  const value = record[indicator.valueKey];
  switch (indicator.format) {
    case "usd":
      return formatUsd(value);
    case "spread":
      return `${formatNumber(value, 2)}%`;
    default:
      return formatNumber(value, 1);
  }
}

function renderIndicatorCard(indicator, records) {
  const card = document.querySelector(`[data-indicator="${indicator.id}"]`);
  if (!card) return;

  const recent = filterLast12Months(records);
  const latest = latestRecord(recent);
  const status = getIndicatorStatus(indicator.id, recent);

  card.querySelector(".indicator-title").textContent = indicator.title;
  card.querySelector(".indicator-subtitle").textContent = indicator.subtitle;
  card.querySelector(".indicator-value").textContent = formatIndicatorValue(
    indicator,
    latest
  );
  card.querySelector(".indicator-date").textContent = latest
    ? formatDate(latest.date)
    : "—";
  setStatus(card.querySelector(".indicator-status"), status.status, status.label);

  const sourceLink = card.querySelector(".indicator-source");
  sourceLink.href = indicator.sourceUrl;
  sourceLink.textContent = indicator.source;

  destroyChart(charts[indicator.id]);
  const canvas = card.querySelector("canvas");

  if (indicator.id === "yieldCurve") {
    charts[indicator.id] = createSpreadChart(canvas, recent);
    return;
  }

  const monthly = indicator.id === "pmi" || indicator.id === "copper";
  const options = {
    label: indicator.title,
    valueKey: indicator.valueKey,
    monthly,
  };

  if (indicator.id === "pmi") {
    options.referenceLine = 50;
  }
  if (indicator.id === "copper") {
    const values = recent.map((item) => Number(item.value));
    if (values.length) {
      options.referenceLine =
        values.reduce((sum, value) => sum + value, 0) / values.length;
    }
  }

  charts[indicator.id] = createLineChart(canvas, recent, options);
}

function showError(message) {
  const banner = document.getElementById("error-banner");
  banner.hidden = false;
  banner.textContent = message;
}

function hideError() {
  const banner = document.getElementById("error-banner");
  banner.hidden = true;
  banner.textContent = "";
}

function setLoading(isLoading) {
  document.body.classList.toggle("is-loading", isLoading);
}

async function init() {
  setLoading(true);
  hideError();

  try {
    const data = await loadData();
    renderMacroRegime(data);
    renderComposite(data);
    renderIndicatorCard(INDICATORS.pmi, data.pmi);
    renderIndicatorCard(INDICATORS.copper, data.copper);
    renderIndicatorCard(INDICATORS.vix, data.vix);
    renderIndicatorCard(INDICATORS.yieldCurve, data.yieldCurve);

    const statusEl = document.getElementById("data-status");
    statusEl.textContent = `Updated ${new Date().toLocaleString()}`;
  } catch (error) {
    console.error(error);
    showError("Failed to load dashboard data. Check data files and try again.");
  } finally {
    setLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", init);
