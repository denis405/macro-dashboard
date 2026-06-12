#!/usr/bin/env python3
"""Update VIX data from FRED series VIXCLS."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta

from common import (
    DATA_DIR,
    load_json,
    logger,
    merge_records,
    records_to_value_json,
    save_json,
    setup_logging,
    fetch_fred_series,
)

OUTPUT = DATA_DIR / "vix.json"
SERIES_ID = "VIXCLS"


def main() -> int:
    setup_logging()
    existing = load_json(OUTPUT)
    if not isinstance(existing, list):
        existing = []

    start = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")
    records = fetch_fred_series(SERIES_ID, observation_start=start)
    new_data = records_to_value_json(records)
    merged = merge_records(existing, new_data)

    if not merged:
        logger.error("No VIX data to save")
        return 1

    save_json(OUTPUT, merged)
    logger.info("Saved %s VIX records (latest: %s)", len(merged), merged[-1])
    return 0


if __name__ == "__main__":
    sys.exit(main())
