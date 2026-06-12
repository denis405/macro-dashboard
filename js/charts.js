/** Chart.js chart builders. */

import { formatDate, formatMonth } from "./utils.js";

const CHART_COLORS = {
  line: "#4da3ff",
  fill: "rgba(77, 163, 255, 0.12)",
  grid: "rgba(148, 163, 184, 0.12)",
  text: "#94a3b8",
  positive: "#34d399",
  negative: "#f87171",
  neutral: "#fbbf24",
};

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#111827",
      borderColor: "#334155",
      borderWidth: 1,
      titleColor: "#e2e8f0",
      bodyColor: "#cbd5e1",
    },
  },
  scales: {
    x: {
      ticks: { color: CHART_COLORS.text, maxTicksLimit: 6 },
      grid: { color: CHART_COLORS.grid },
    },
    y: {
      ticks: { color: CHART_COLORS.text },
      grid: { color: CHART_COLORS.grid },
    },
  },
};

export function createLineChart(canvas, records, options = {}) {
  const {
    valueKey = "value",
    label = "Value",
    monthly = false,
    referenceLine = null,
    color = CHART_COLORS.line,
  } = options;

  const labels = records.map((item) =>
    monthly ? formatMonth(item.date) : formatDate(item.date)
  );
  const values = records.map((item) => Number(item[valueKey]));

  const datasets = [
    {
      label,
      data: values,
      borderColor: color,
      backgroundColor: color.includes("rgba") ? color : CHART_COLORS.fill,
      fill: true,
      tension: 0.3,
      pointRadius: records.length > 40 ? 0 : 2,
      borderWidth: 2,
    },
  ];

  if (referenceLine != null) {
    datasets.push({
      label: "Reference",
      data: Array(values.length).fill(referenceLine),
      borderColor: CHART_COLORS.neutral,
      borderDash: [6, 4],
      pointRadius: 0,
      borderWidth: 1,
    });
  }

  return new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: baseOptions,
  });
}

export function createSpreadChart(canvas, records) {
  const labels = records.map((item) => formatDate(item.date));
  const values = records.map((item) => Number(item.spread));
  const backgroundColor = values.map((value) =>
    value >= 0 ? "rgba(52, 211, 153, 0.7)" : "rgba(248, 113, 113, 0.7)"
  );
  const borderColor = values.map((value) =>
    value >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative
  );

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "10Y − 2Y spread",
          data: values,
          backgroundColor,
          borderColor,
          borderWidth: 1,
        },
      ],
    },
    options: {
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        annotation: undefined,
      },
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales.y,
          ticks: {
            ...baseOptions.scales.y.ticks,
            callback: (value) => `${value}%`,
          },
        },
      },
    },
  });
}

export function destroyChart(chart) {
  if (chart) chart.destroy();
}
