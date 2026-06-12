/** Composite index display helpers. */

import { STATUS, latestRecord } from "./utils.js";

export function getCompositeSummary(records) {
  const latest = latestRecord(records);
  if (!latest) {
    return {
      value: null,
      status: STATUS.NEUTRAL,
      label: "No data",
      trend: "flat",
    };
  }

  const value = Number(latest.value);
  let status = STATUS.YELLOW;
  let label = "Neutral";

  if (value > 0.5) {
    status = STATUS.GREEN;
    label = "Risk-on bias";
  } else if (value < -0.5) {
    status = STATUS.RED;
    label = "Risk-off bias";
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const prev = sorted.length > 1 ? sorted.at(-2) : null;
  let trend = "flat";
  if (prev) {
    if (value > Number(prev.value)) trend = "up";
    else if (value < Number(prev.value)) trend = "down";
  }

  return { value, status, label, trend };
}
