#!/usr/bin/env python3
"""Calculate composite macro index from normalized indicator z-scores."""

from __future__ import annotations

import math
import sys
from datetime import datetime

from common import DATA_DIR, load_json, logger, save_json, setup_logging

OUTPUT = DATA_DIR / "composite.json"

WEIGHTS = {
    "pmi": 0.4,
    "copper": 0.3,
    "yield_curve": 0.2,
    "vix": -0.1,
}


def main() -> int:
    setup_logging()

    pmi = _load_series(DATA_DIR / "pmi.json", "value")
    copper = _load_series(DATA_DIR / "copper.json", "value")
    vix = _load_series(DATA_DIR / "vix.json", "value")
    yield_curve = _load_series(DATA_DIR / "yield_curve.json", "spread")

    if not any((pmi, copper, vix, yield_curve)):
        logger.error("No indicator data available for composite calculation")
        return 1

    monthly_dates = _monthly_date_grid(pmi, copper, vix, yield_curve)
    if not monthly_dates:
        logger.error("Could not build monthly date grid")
        return 1

    pmi_z = _zscore_series(_resample_monthly(pmi, monthly_dates))
    copper_z = _zscore_series(_resample_monthly(copper, monthly_dates))
    vix_z = _zscore_series(_resample_monthly(vix, monthly_dates))
    yield_z = _zscore_series(_resample_monthly(yield_curve, monthly_dates))

    composite: list[dict] = []
    for idx, date in enumerate(monthly_dates):
        if any(
            math.isnan(series[idx])
            for series in (pmi_z, copper_z, vix_z, yield_z)
        ):
            continue
        score = (
            WEIGHTS["pmi"] * pmi_z[idx]
            + WEIGHTS["copper"] * copper_z[idx]
            + WEIGHTS["yield_curve"] * yield_z[idx]
            + WEIGHTS["vix"] * vix_z[idx]
        )
        composite.append({"date": date, "value": round(score, 4)})

    if not composite:
        logger.error("Composite calculation produced no values")
        return 1

    save_json(OUTPUT, composite)
    logger.info("Saved %s composite records (latest: %s)", len(composite), composite[-1])
    return 0


def _load_series(path, value_key: str) -> list[tuple[str, float]]:
    data = load_json(path)
    if not isinstance(data, list):
        return []
    series: list[tuple[str, float]] = []
    for item in data:
        if value_key not in item:
            continue
        series.append((item["date"], float(item[value_key])))
    return sorted(series, key=lambda pair: pair[0])


def _monthly_date_grid(*series_list: list[tuple[str, float]]) -> list[str]:
    all_dates = [date for series in series_list for date, _ in series]
    if not all_dates:
        return []
    start = min(all_dates)[:7]
    end = max(all_dates)[:7]
    year, month = map(int, start.split("-"))
    end_year, end_month = map(int, end.split("-"))

    dates: list[str] = []
    while (year, month) <= (end_year, end_month):
        dates.append(f"{year:04d}-{month:02d}-01")
        month += 1
        if month > 12:
            month = 1
            year += 1
    return dates


def _resample_monthly(
    series: list[tuple[str, float]],
    monthly_dates: list[str],
) -> list[float]:
    if not series:
        return [math.nan] * len(monthly_dates)

    by_month: dict[str, float] = {}
    for date, value in series:
        by_month[date[:7]] = value

    values: list[float] = []
    last_known = math.nan
    for date in monthly_dates:
        month = date[:7]
        if month in by_month:
            last_known = by_month[month]
        values.append(last_known)
    return values


def _zscore_series(values: list[float]) -> list[float]:
    valid = [value for value in values if not math.isnan(value)]
    if len(valid) < 2:
        return [math.nan] * len(values)

    mean = sum(valid) / len(valid)
    variance = sum((value - mean) ** 2 for value in valid) / len(valid)
    std = math.sqrt(variance) if variance > 0 else 0.0
    if std == 0:
        return [0.0 if not math.isnan(value) else math.nan for value in values]

    return [(value - mean) / std if not math.isnan(value) else math.nan for value in values]


if __name__ == "__main__":
    sys.exit(main())
