#!/usr/bin/env python3
"""Update US yield curve spread (DGS10 - DGS2) from FRED."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta

from common import (
    DATA_DIR,
    load_json,
    logger,
    merge_records,
    save_json,
    setup_logging,
    fetch_fred_series,
)

OUTPUT = DATA_DIR / "yield_curve.json"
SERIES_10Y = "DGS10"
SERIES_2Y = "DGS2"


def main() -> int:
    setup_logging()
    existing = load_json(OUTPUT)
    if not isinstance(existing, list):
        existing = []

    start = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")
    dgs10 = dict(fetch_fred_series(SERIES_10Y, observation_start=start))
    dgs2 = dict(fetch_fred_series(SERIES_2Y, observation_start=start))

    common_dates = sorted(set(dgs10) & set(dgs2))
    if not common_dates:
        logger.error("No overlapping yield curve dates")
        return 1

    new_data = [
        {"date": date, "spread": round(dgs10[date] - dgs2[date], 4)}
        for date in common_dates
    ]
    merged = merge_records(existing, new_data)

    if not merged:
        logger.error("No yield curve data to save")
        return 1

    save_json(OUTPUT, merged)
    logger.info("Saved %s yield curve records (latest: %s)", len(merged), merged[-1])
    return 0


if __name__ == "__main__":
    sys.exit(main())
