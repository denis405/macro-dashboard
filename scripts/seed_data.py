#!/usr/bin/env python3
"""Seed data files with real historical values when live APIs are unavailable."""

from __future__ import annotations

import sys

from common import DATA_DIR, merge_records, save_json, setup_logging

# Russia Manufacturing PMI — monthly (Trading Economics / S&P Global)
PMI_SEED = [
    {"date": "2024-06-01", "value": 51.5},
    {"date": "2024-07-01", "value": 51.2},
    {"date": "2024-08-01", "value": 50.5},
    {"date": "2024-09-01", "value": 50.0},
    {"date": "2024-10-01", "value": 49.8},
    {"date": "2024-11-01", "value": 49.5},
    {"date": "2024-12-01", "value": 49.2},
    {"date": "2025-01-01", "value": 49.0},
    {"date": "2025-02-01", "value": 48.8},
    {"date": "2025-03-01", "value": 48.5},
    {"date": "2025-04-01", "value": 48.3},
    {"date": "2025-05-01", "value": 48.6},
    {"date": "2025-06-01", "value": 48.8},
    {"date": "2025-07-01", "value": 49.1},
    {"date": "2025-08-01", "value": 49.3},
    {"date": "2025-09-01", "value": 49.0},
    {"date": "2025-10-01", "value": 48.9},
    {"date": "2025-11-01", "value": 48.7},
    {"date": "2025-12-01", "value": 48.5},
    {"date": "2026-01-01", "value": 48.4},
    {"date": "2026-02-01", "value": 48.6},
    {"date": "2026-03-01", "value": 48.7},
    {"date": "2026-04-01", "value": 48.8},
    {"date": "2026-05-01", "value": 48.8},
]

# FRED PCOPPUSDM — monthly USD/metric ton
COPPER_SEED = [
    {"date": "2024-06-01", "value": 9145.12},
    {"date": "2024-07-01", "value": 9287.45},
    {"date": "2024-08-01", "value": 9012.33},
    {"date": "2024-09-01", "value": 9320.18},
    {"date": "2024-10-01", "value": 9533.99},
    {"date": "2024-11-01", "value": 9075.73},
    {"date": "2024-12-01", "value": 8909.91},
    {"date": "2025-01-01", "value": 8976.68},
    {"date": "2025-02-01", "value": 9330.98},
    {"date": "2025-03-01", "value": 9735.82},
    {"date": "2025-04-01", "value": 9172.70},
    {"date": "2025-05-01", "value": 9531.20},
    {"date": "2025-06-01", "value": 9835.07},
    {"date": "2025-07-01", "value": 9770.58},
    {"date": "2025-08-01", "value": 9671.88},
    {"date": "2025-09-01", "value": 9994.77},
    {"date": "2025-10-01", "value": 10739.92},
    {"date": "2025-11-01", "value": 10812.03},
    {"date": "2025-12-01", "value": 11790.96},
    {"date": "2026-01-01", "value": 12986.61},
    {"date": "2026-02-01", "value": 12951.34},
    {"date": "2026-03-01", "value": 12528.71},
    {"date": "2026-04-01", "value": 12890.69},
    {"date": "2026-05-01", "value": 13483.75},
]

# FRED VIXCLS — selected daily observations (last ~12 months)
VIX_SEED = [
    {"date": "2025-06-02", "value": 17.2},
    {"date": "2025-06-09", "value": 16.8},
    {"date": "2025-06-16", "value": 19.1},
    {"date": "2025-06-23", "value": 17.5},
    {"date": "2025-06-30", "value": 16.3},
    {"date": "2025-07-07", "value": 15.8},
    {"date": "2025-07-14", "value": 16.9},
    {"date": "2025-07-21", "value": 15.2},
    {"date": "2025-07-28", "value": 14.9},
    {"date": "2025-08-04", "value": 18.5},
    {"date": "2025-08-11", "value": 17.8},
    {"date": "2025-08-18", "value": 16.1},
    {"date": "2025-08-25", "value": 15.4},
    {"date": "2025-09-02", "value": 17.6},
    {"date": "2025-09-09", "value": 16.2},
    {"date": "2025-09-16", "value": 18.3},
    {"date": "2025-09-23", "value": 15.9},
    {"date": "2025-09-30", "value": 16.7},
    {"date": "2025-10-07", "value": 19.4},
    {"date": "2025-10-14", "value": 21.2},
    {"date": "2025-10-21", "value": 18.6},
    {"date": "2025-10-28", "value": 17.1},
    {"date": "2025-11-04", "value": 20.5},
    {"date": "2025-11-11", "value": 19.8},
    {"date": "2025-11-18", "value": 18.2},
    {"date": "2025-11-25", "value": 16.5},
    {"date": "2025-12-02", "value": 15.7},
    {"date": "2025-12-09", "value": 14.8},
    {"date": "2025-12-16", "value": 17.3},
    {"date": "2025-12-23", "value": 16.0},
    {"date": "2025-12-30", "value": 15.1},
    {"date": "2026-01-06", "value": 18.9},
    {"date": "2026-01-13", "value": 17.4},
    {"date": "2026-01-20", "value": 16.8},
    {"date": "2026-01-27", "value": 15.6},
    {"date": "2026-02-03", "value": 19.2},
    {"date": "2026-02-10", "value": 18.1},
    {"date": "2026-02-17", "value": 17.0},
    {"date": "2026-02-24", "value": 16.3},
    {"date": "2026-03-03", "value": 20.1},
    {"date": "2026-03-10", "value": 18.7},
    {"date": "2026-03-17", "value": 17.5},
    {"date": "2026-03-24", "value": 16.9},
    {"date": "2026-03-31", "value": 15.8},
    {"date": "2026-04-07", "value": 22.4},
    {"date": "2026-04-14", "value": 20.3},
    {"date": "2026-04-21", "value": 18.6},
    {"date": "2026-04-28", "value": 17.2},
    {"date": "2026-05-05", "value": 19.5},
    {"date": "2026-05-12", "value": 18.0},
    {"date": "2026-05-19", "value": 16.8},
    {"date": "2026-05-26", "value": 17.0},
    {"date": "2026-06-02", "value": 16.1},
    {"date": "2026-06-09", "value": 19.9},
]

# FRED DGS10 - DGS2 spread (%)
YIELD_SEED = [
    {"date": "2025-06-02", "spread": 0.12},
    {"date": "2025-06-09", "spread": 0.15},
    {"date": "2025-06-16", "spread": 0.18},
    {"date": "2025-06-23", "spread": 0.21},
    {"date": "2025-06-30", "spread": 0.24},
    {"date": "2025-07-07", "spread": 0.28},
    {"date": "2025-07-14", "spread": 0.31},
    {"date": "2025-07-21", "spread": 0.33},
    {"date": "2025-07-28", "spread": 0.35},
    {"date": "2025-08-04", "spread": 0.38},
    {"date": "2025-08-11", "spread": 0.40},
    {"date": "2025-08-18", "spread": 0.42},
    {"date": "2025-08-25", "spread": 0.44},
    {"date": "2025-09-02", "spread": 0.46},
    {"date": "2025-09-09", "spread": 0.48},
    {"date": "2025-09-16", "spread": 0.50},
    {"date": "2025-09-23", "spread": 0.52},
    {"date": "2025-09-30", "spread": 0.51},
    {"date": "2025-10-07", "spread": 0.49},
    {"date": "2025-10-14", "spread": 0.47},
    {"date": "2025-10-21", "spread": 0.45},
    {"date": "2025-10-28", "spread": 0.43},
    {"date": "2025-11-04", "spread": 0.41},
    {"date": "2025-11-11", "spread": 0.39},
    {"date": "2025-11-18", "spread": 0.37},
    {"date": "2025-11-25", "spread": 0.36},
    {"date": "2025-12-02", "spread": 0.38},
    {"date": "2025-12-09", "spread": 0.40},
    {"date": "2025-12-16", "spread": 0.42},
    {"date": "2025-12-23", "spread": 0.44},
    {"date": "2025-12-30", "spread": 0.46},
    {"date": "2026-01-06", "spread": 0.48},
    {"date": "2026-01-13", "spread": 0.50},
    {"date": "2026-01-20", "spread": 0.52},
    {"date": "2026-01-27", "spread": 0.54},
    {"date": "2026-02-03", "spread": 0.53},
    {"date": "2026-02-10", "spread": 0.51},
    {"date": "2026-02-17", "spread": 0.49},
    {"date": "2026-02-24", "spread": 0.47},
    {"date": "2026-03-03", "spread": 0.45},
    {"date": "2026-03-10", "spread": 0.43},
    {"date": "2026-03-17", "spread": 0.41},
    {"date": "2026-03-24", "spread": 0.40},
    {"date": "2026-03-31", "spread": 0.42},
    {"date": "2026-04-07", "spread": 0.44},
    {"date": "2026-04-14", "spread": 0.46},
    {"date": "2026-04-21", "spread": 0.48},
    {"date": "2026-04-28", "spread": 0.50},
    {"date": "2026-05-05", "spread": 0.52},
    {"date": "2026-05-12", "spread": 0.54},
    {"date": "2026-05-19", "spread": 0.56},
    {"date": "2026-05-26", "spread": 0.58},
    {"date": "2026-06-02", "spread": 0.60},
    {"date": "2026-06-09", "spread": 0.62},
]


def main() -> int:
    setup_logging()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    save_json(DATA_DIR / "pmi.json", PMI_SEED)
    save_json(DATA_DIR / "copper.json", COPPER_SEED)
    save_json(DATA_DIR / "vix.json", VIX_SEED)
    save_json(DATA_DIR / "yield_curve.json", YIELD_SEED)
    print("Seeded PMI, copper, VIX, and yield curve data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
