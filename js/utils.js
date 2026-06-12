/** Shared utilities for the macro dashboard. */

export const STATUS = {
  GREEN: "green",
  YELLOW: "yellow",
  RED: "red",
  NEUTRAL: "neutral",
};

export function fetchJSON(url) {
  return fetch(url, { cache: "no-store" }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return response.json();
  });
}

export function parseDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, locale = "en-US") {
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMonth(value, locale = "en-US") {
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString(locale, { year: "numeric", month: "short" });
}

export function filterLast12Months(records, dateKey = "date") {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  return records.filter((record) => {
    const date = parseDate(record[dateKey]);
    return date && date >= cutoff;
  });
}

export function latestRecord(records) {
  if (!records?.length) return null;
  return [...records].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

export function previousRecord(records) {
  if (!records?.length) return null;
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.length > 1 ? sorted.at(-2) : null;
}

export function averageLastMonths(records, months = 12, valueKey = "value") {
  const recent = filterLast12Months(records).slice(-months);
  if (!recent.length) return null;
  const sum = recent.reduce((total, item) => total + Number(item[valueKey]), 0);
  return sum / recent.length;
}

export function isRising(current, previous) {
  if (current == null || previous == null) return false;
  return Number(current) > Number(previous);
}

export function statusClass(status) {
  return `status-${status}`;
}

export function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatUsd(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
