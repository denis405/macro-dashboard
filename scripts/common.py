"""Shared utilities for macro dashboard ETL scripts."""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations"
FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"
MAX_RETRIES = 3
RETRY_DELAY_SEC = 2
USER_AGENT = "macro-dashboard/1.0 (+https://github.com/denis405/macro-dashboard)"

logger = logging.getLogger("macro_dashboard")


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


def get_fred_api_key() -> str | None:
    key = os.environ.get("FRED_API_KEY", "").strip()
    return key or None


def get_te_api_key() -> str | None:
    key = os.environ.get("TRADING_ECONOMICS_API_KEY", "").strip()
    return key or None


def load_json(path: Path) -> list | dict:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_date(date_str: str) -> str:
    """Normalize assorted date strings to YYYY-MM-DD."""
    text = date_str.strip()
    formats = (
        "%Y-%m-%d",
        "%Y-%m",
        "%b %d, %Y",
        "%B %d, %Y",
        "%d %b %Y",
        "%d %B %Y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    if len(text) == 7 and text[4] == "-":
        return f"{text}-01"
    raise ValueError(f"Unrecognized date format: {date_str!r}")


def merge_records(
    existing: list[dict],
    new_records: list[dict],
    date_key: str = "date",
) -> list[dict]:
    """Merge records by date, updating existing dates and preventing duplicates."""
    by_date: dict[str, dict] = {}
    for rec in existing + new_records:
        date = normalize_date(str(rec[date_key]))
        entry = {date_key: date}
        for key, value in rec.items():
            if key != date_key:
                entry[key] = value
        by_date[date] = entry
    return sorted(by_date.values(), key=lambda item: item[date_key])


def http_get(url: str, headers: dict[str, str] | None = None, timeout: int = 30) -> str:
    request_headers = {"User-Agent": USER_AGENT}
    if headers:
        request_headers.update(headers)
    request = Request(url, headers=request_headers)
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


def fetch_with_retry(
    url: str,
    headers: dict[str, str] | None = None,
    retries: int = MAX_RETRIES,
) -> str:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return http_get(url, headers=headers)
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc
            logger.warning("Request failed (attempt %s/%s): %s", attempt, retries, exc)
            if attempt < retries:
                time.sleep(RETRY_DELAY_SEC * attempt)
    raise RuntimeError(f"Failed to fetch {url} after {retries} attempts") from last_error


def fetch_fred_series(
    series_id: str,
    api_key: str | None = None,
    observation_start: str | None = None,
) -> list[tuple[str, float]]:
    """Fetch a FRED series via API (preferred) or public CSV fallback."""
    api_key = api_key or get_fred_api_key()
    if api_key:
        return _fetch_fred_api(series_id, api_key, observation_start)
    logger.info("FRED_API_KEY not set; falling back to CSV for %s", series_id)
    return _fetch_fred_csv(series_id)


def _fetch_fred_api(
    series_id: str,
    api_key: str,
    observation_start: str | None,
) -> list[tuple[str, float]]:
    params: dict[str, str] = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "sort_order": "asc",
    }
    if observation_start:
        params["observation_start"] = observation_start

    url = f"{FRED_API_URL}?{urlencode(params)}"
    payload = json.loads(fetch_with_retry(url))
    observations = payload.get("observations", [])
    if not observations:
        raise RuntimeError(f"Empty FRED API response for {series_id}")

    records: list[tuple[str, float]] = []
    for obs in observations:
        value = obs.get("value", ".")
        if value in (".", "", None):
            continue
        records.append((obs["date"], float(value)))
    if not records:
        raise RuntimeError(f"No valid observations for {series_id}")
    return records


def _fetch_fred_csv(series_id: str) -> list[tuple[str, float]]:
    url = f"{FRED_CSV_URL}?id={series_id}"
    text = fetch_with_retry(url)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 2:
        raise RuntimeError(f"Unexpected CSV response for {series_id}")

    records: list[tuple[str, float]] = []
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) != 2 or parts[1] in (".", ""):
            continue
        records.append((parts[0], float(parts[1])))
    if not records:
        raise RuntimeError(f"No valid CSV observations for {series_id}")
    return records


def records_to_value_json(records: list[tuple[str, float]]) -> list[dict]:
    return [{"date": date, "value": round(value, 4)} for date, value in records]
