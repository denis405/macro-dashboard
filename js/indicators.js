/** Indicator status logic and metadata. */

import {
  STATUS,
  averageLastMonths,
  filterLast12Months,
  isRising,
  latestRecord,
  previousRecord,
} from "./utils.js";

export const INDICATORS = {
  pmi: {
    id: "pmi",
    title: "Russia PMI",
    subtitle: "Manufacturing PMI",
    source: "Trading Economics",
    sourceUrl: "https://tradingeconomics.com/russia/manufacturing-pmi",
    dataFile: "data/pmi.json",
    valueKey: "value",
    format: "decimal",
  },
  copper: {
    id: "copper",
    title: "Copper",
    subtitle: "Global price (USD/mt)",
    source: "FRED — PCOPPUSDM",
    sourceUrl: "https://fred.stlouisfed.org/series/PCOPPUSDM",
    dataFile: "data/copper.json",
    valueKey: "value",
    format: "usd",
  },
  vix: {
    id: "vix",
    title: "VIX",
    subtitle: "CBOE Volatility Index",
    source: "FRED — VIXCLS",
    sourceUrl: "https://fred.stlouisfed.org/series/VIXCLS",
    dataFile: "data/vix.json",
    valueKey: "value",
    format: "decimal",
  },
  yieldCurve: {
    id: "yieldCurve",
    title: "Yield Curve",
    subtitle: "US 10Y − 2Y spread",
    source: "FRED — DGS10 / DGS2",
    sourceUrl: "https://fred.stlouisfed.org/graph/?g=1MrYW",
    dataFile: "data/yield_curve.json",
    valueKey: "spread",
    format: "spread",
  },
};

export function getPmiStatus(records) {
  const latest = latestRecord(records);
  if (!latest) return { status: STATUS.NEUTRAL, label: "No data" };
  const value = Number(latest.value);
  if (value > 50) return { status: STATUS.GREEN, label: "Expansion" };
  if (value >= 48) return { status: STATUS.YELLOW, label: "Caution" };
  return { status: STATUS.RED, label: "Contraction" };
}

export function getCopperStatus(records) {
  const latest = latestRecord(records);
  const avg = averageLastMonths(records, 12);
  if (!latest || avg == null) return { status: STATUS.NEUTRAL, label: "No data" };
  const value = Number(latest.value);
  if (value >= avg) return { status: STATUS.GREEN, label: "Above 12mo avg" };
  return { status: STATUS.RED, label: "Below 12mo avg" };
}

export function getVixStatus(records) {
  const latest = latestRecord(records);
  if (!latest) return { status: STATUS.NEUTRAL, label: "No data" };
  const value = Number(latest.value);
  if (value < 15) return { status: STATUS.GREEN, label: "Low volatility" };
  if (value <= 25) return { status: STATUS.YELLOW, label: "Elevated" };
  return { status: STATUS.RED, label: "High fear" };
}

export function getYieldStatus(records) {
  const latest = latestRecord(records);
  if (!latest) return { status: STATUS.NEUTRAL, label: "No data" };
  const spread = Number(latest.spread);
  if (spread > 0) return { status: STATUS.GREEN, label: "Positive slope" };
  return { status: STATUS.RED, label: "Inverted" };
}

export function getIndicatorStatus(id, records) {
  switch (id) {
    case "pmi":
      return getPmiStatus(records);
    case "copper":
      return getCopperStatus(records);
    case "vix":
      return getVixStatus(records);
    case "yieldCurve":
      return getYieldStatus(records);
    default:
      return { status: STATUS.NEUTRAL, label: "Unknown" };
  }
}

export function getMacroRegimeScore(data) {
  const pmi = filterLast12Months(data.pmi);
  const copper = filterLast12Months(data.copper);
  const vix = filterLast12Months(data.vix);
  const yieldCurve = filterLast12Months(data.yieldCurve);

  const pmiLatest = latestRecord(pmi);
  const pmiPrev = previousRecord(pmi);
  const copperLatest = latestRecord(copper);
  const vixLatest = latestRecord(vix);
  const yieldLatest = latestRecord(yieldCurve);

  let score = 0;
  const breakdown = [];

  if (pmiLatest && Number(pmiLatest.value) > 50) {
    score += 3;
    breakdown.push({ label: "PMI > 50", points: 3 });
  }
  if (pmiLatest && pmiPrev && isRising(pmiLatest.value, pmiPrev.value)) {
    score += 2;
    breakdown.push({ label: "PMI rising", points: 2 });
  }
  if (copperLatest) {
    const avg = averageLastMonths(copper, 12);
    if (avg != null && Number(copperLatest.value) >= avg) {
      score += 2;
      breakdown.push({ label: "Copper above avg", points: 2 });
    }
  }
  if (vixLatest && Number(vixLatest.value) < 20) {
    score += 1;
    breakdown.push({ label: "VIX < 20", points: 1 });
  }
  if (yieldLatest && Number(yieldLatest.spread) > 0) {
    score += 2;
    breakdown.push({ label: "Yield spread > 0", points: 2 });
  }

  let regime = "Risk Off";
  let status = STATUS.RED;
  if (score >= 8) {
    regime = "Expansion";
    status = STATUS.GREEN;
  } else if (score >= 5) {
    regime = "Neutral";
    status = STATUS.YELLOW;
  }

  return { score, max: 10, regime, status, breakdown };
}
