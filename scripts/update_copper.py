#!/usr/bin/env python3
"""Update copper price data from FRED series PCOPPUSDM."""

from __future__ import annotations

import sys
from pathlib import Path

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

OUTPUT = DATA_DIR / "copper.json"
SERIES_ID = "PCOPPUSDM"


def main() -> int:
    setup_logging()
    existing = load_json(OUTPUT)
    if not isinstance(existing, list):
        existing = []

    records = fetch_fred_series(SERIES_ID, observation_start="2020-01-01")
    new_data = records_to_value_json(records)
    merged = merge_records(existing, new_data)

    if not merged:
        logger.error("No copper data to save")
        return 1

    save_json(OUTPUT, merged)
    logger.info("Saved %s copper records (latest: %s)", len(merged), merged[-1])
    return 0


if __name__ == "__main__":
    sys.exit(main())
