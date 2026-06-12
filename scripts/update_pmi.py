#!/usr/bin/env python3
"""Update Russia Manufacturing PMI from Trading Economics API or manual upload."""

from __future__ import annotations

import json
import re
import sys
from html import unescape
from pathlib import Path

from common import (
    DATA_DIR,
    fetch_with_retry,
    get_te_api_key,
    load_json,
    logger,
    merge_records,
    normalize_date,
    save_json,
    setup_logging,
)

OUTPUT = DATA_DIR / "pmi.json"
MANUAL = DATA_DIR / "pmi_manual.json"
TE_URL = "https://tradingeconomics.com/russia/manufacturing-pmi"
TE_API_URL = "https://api.tradingeconomics.com/historical/country/russia/indicator/manufacturing pmi"


def main() -> int:
    setup_logging()
    existing = load_json(OUTPUT)
    if not isinstance(existing, list):
        existing = []

    new_records: list[dict] = []

    api_key = get_te_api_key()
    if api_key:
        try:
            new_records.extend(fetch_te_api(api_key))
            logger.info("Fetched %s PMI records from Trading Economics API", len(new_records))
        except Exception as exc:
            logger.warning("Trading Economics API failed: %s", exc)
    else:
        try:
            new_records.extend(fetch_te_html())
            logger.info("Fetched %s PMI records from Trading Economics page", len(new_records))
        except Exception as exc:
            logger.warning("Trading Economics HTML scrape failed: %s", exc)

    if MANUAL.exists():
        manual = load_json(MANUAL)
        if isinstance(manual, list) and manual:
            new_records.extend(normalize_pmi_records(manual))
            logger.info("Merged %s manual PMI records", len(manual))

    if not new_records and not existing:
        logger.error("No PMI data available; seed data or manual upload required")
        return 1

    merged = merge_records(existing, normalize_pmi_records(new_records))
    save_json(OUTPUT, merged)
    logger.info("Saved %s PMI records (latest: %s)", len(merged), merged[-1])
    return 0


def normalize_pmi_records(records: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for rec in records:
        date = normalize_date(str(rec["date"]))
        normalized.append({"date": date, "value": round(float(rec["value"]), 2)})
    return normalized


def fetch_te_api(api_key: str) -> list[dict]:
    url = f"{TE_API_URL}?c={api_key}&f=json"
    payload = json.loads(fetch_with_retry(url))
    if not payload:
        raise RuntimeError("Empty Trading Economics API response")

    records: list[dict] = []
    for item in payload:
        date = item.get("DateTime") or item.get("Date") or item.get("date")
        value = item.get("Value") or item.get("value")
        if date is None or value is None:
            continue
        records.append({"date": normalize_date(str(date)[:10]), "value": float(value)})
    if not records:
        raise RuntimeError("No PMI values in Trading Economics API response")
    return records


def fetch_te_html() -> list[dict]:
    html = fetch_with_retry(TE_URL)
    records: list[dict] = []

    table_match = re.search(r"<table[^>]*id=[\"']te-table[\"'][^>]*>(.*?)</table>", html, re.S | re.I)
    if table_match:
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", table_match.group(1), re.S | re.I)
        for row in rows[1:]:
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
            if len(cells) < 2:
                continue
            date_text = strip_tags(cells[0])
            value_text = strip_tags(cells[1])
            try:
                value = float(value_text.replace(",", ""))
            except ValueError:
                continue
            try:
                date = normalize_date(date_text)
            except ValueError:
                continue
            records.append({"date": date, "value": value})

    if not records:
        latest = re.search(r"Russia Manufacturing PMI[^<]*</[^>]+>\s*<[^>]+>\s*([\d.]+)", html, re.I)
        if latest:
            records.append(
                {
                    "date": normalize_date(_current_month()),
                    "value": float(latest.group(1)),
                }
            )

    if not records:
        raise RuntimeError("Could not parse PMI data from Trading Economics HTML")
    return records


def strip_tags(text: str) -> str:
    return unescape(re.sub(r"<[^>]+>", "", text)).strip()


def _current_month() -> str:
    from datetime import datetime

    return datetime.now().strftime("%Y-%m-01")


if __name__ == "__main__":
    sys.exit(main())
