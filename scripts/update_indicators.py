from __future__ import annotations

import csv
import io
import json
import math
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DATA_FILE = Path("data/indicators.json")
HISTORY_POINTS = 8
CBOE_VIX_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv"
FRED_COPPER_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PCOPPUSDM&cosd=2025-01-01"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


@dataclass
class UpdateResult:
    value: float
    label: str
    trend: str = "sideways"
    trend_label: str = "обновлено"
    curve_shape: str | None = None
    history: list[dict[str, float | str]] | None = None


def main() -> int:
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    indicators = {item["id"]: item for item in payload["indicators"]}
    updated_count = 0

    updaters = {
        "pmi": update_pmi,
        "copper": update_copper,
        "vix": update_vix,
        "yield-curve": update_yield_curve,
    }

    for indicator_id, updater in updaters.items():
        try:
            result = updater(indicators[indicator_id])
            apply_update(indicators[indicator_id], result)
            updated_count += 1
            print(f"updated {indicator_id}: {result.value}")
        except Exception as exc:  # noqa: BLE001 - one broken source should not break the dashboard.
            print(f"kept {indicator_id}: {exc}", file=sys.stderr)

    if updated_count == 0:
        print("No sources were updated; existing JSON was left unchanged.")
        return 0

    payload["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    DATA_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return 0


def update_pmi(indicator: dict[str, Any]) -> UpdateResult:
    text = fetch_text(indicator["sourceUrl"])
    actual = find_number(r"Actual\s+([-+]?\d+(?:\.\d+)?)", text)
    previous = find_number(r"Previous\s+([-+]?\d+(?:\.\d+)?)", text, default=indicator["value"])
    release = find_text(r"Latest Release\s+([A-Za-z]{3}\s+\d{2},\s+\d{4})", text, default=current_label())

    trend = trend_from_delta(actual - previous, neutral_band=0.15)
    trend_label = "растет" if trend == "up" else "падает" if trend == "down" else "без резкого изменения"
    history = fetch_pmi_history(text, actual, release)

    return UpdateResult(
        value=round(actual, 1),
        label=release,
        trend=trend,
        trend_label=trend_label,
        history=history,
    )


def update_copper(indicator: dict[str, Any]) -> UpdateResult:
    series = fetch_fred_copper_series()
    latest = series[-1]
    previous = series[-2]["value"] if len(series) > 1 else latest["value"]

    trend = trend_from_delta(latest["value"] - previous, neutral_band=50)
    trend_label = "растет" if trend == "up" else "падает" if trend == "down" else "боковик"
    return UpdateResult(
        value=latest["value"],
        label=latest["label"],
        trend=trend,
        trend_label=trend_label,
        history=series[-HISTORY_POINTS:],
    )


def update_vix(indicator: dict[str, Any]) -> UpdateResult:
    series = fetch_cboe_vix_series()
    recent = series[-63:]
    latest = series[-1]
    previous = series[-2]["value"] if len(series) > 1 else latest["value"]

    trend = trend_from_delta(latest["value"] - previous, neutral_band=0.2)
    trend_label = "растет" if trend == "up" else "снижается" if trend == "down" else "умеренный риск"
    return UpdateResult(
        value=latest["value"],
        label=latest["label"],
        trend=trend,
        trend_label=trend_label,
        history=sample_history(recent),
    )


def update_yield_curve(indicator: dict[str, Any]) -> UpdateResult:
    curve = fetch_moex_curve()
    spread_bp = curve_spread_bp(curve)
    history = fetch_moex_spread_history()

    if spread_bp < 0:
        shape = "inversion"
        label = "инверсия"
    elif spread_bp < 25:
        shape = "flat"
        label = "плоская форма"
    else:
        shape = "normal"
        label = "нормальная форма"

    return UpdateResult(
        value=round(spread_bp, 1),
        label=current_label(),
        trend="sideways",
        trend_label=label,
        curve_shape=shape,
        history=history,
    )


def apply_update(indicator: dict[str, Any], result: UpdateResult) -> None:
    indicator["value"] = result.value
    indicator["trend"] = result.trend
    indicator["trendLabel"] = result.trend_label

    if result.curve_shape:
        indicator["curveShape"] = result.curve_shape

    if result.history is not None:
        indicator["history"] = result.history[-HISTORY_POINTS:]
    else:
        append_history(indicator, result.label, result.value)


def append_history(indicator: dict[str, Any], label: str, value: float) -> None:
    history = indicator.setdefault("history", [])

    if history and history[-1].get("label") == label:
        history[-1]["value"] = value
    else:
        history.append({"label": label, "value": value})

    indicator["history"] = history[-HISTORY_POINTS:]


def fetch_pmi_history(text: str, latest_value: float, latest_label: str) -> list[dict[str, Any]]:
    releases = re.findall(
        r"([A-Za-z]{3}\s+\d{2},\s+\d{4})\s+Actual\s+([-+]?\d+(?:\.\d+)?)",
        text,
        flags=re.I,
    )

    history: list[dict[str, Any]] = []
    seen: set[str] = set()

    for label, value in releases:
        if label in seen:
            continue
        seen.add(label)
        history.append({"label": label, "value": round(float(value), 1)})

    if not history:
        history.append({"label": latest_label, "value": round(latest_value, 1)})

    history.reverse()
    return history[-HISTORY_POINTS:]


def fetch_fred_copper_series() -> list[dict[str, Any]]:
    raw = fetch_raw(FRED_COPPER_URL, timeout=20)
    reader = csv.DictReader(io.StringIO(raw))
    series: list[dict[str, Any]] = []

    for row in reader:
        value = row.get("PCOPPUSDM", "").strip()
        label = row.get("observation_date", "").strip()
        if not value or value == "." or not label:
            continue
        series.append({"label": label[:7], "value": round(float(value))})

    if not series:
        raise ValueError("no FRED copper data")

    return series


def fetch_cboe_vix_series() -> list[dict[str, Any]]:
    raw = fetch_raw(CBOE_VIX_URL)
    reader = csv.DictReader(io.StringIO(raw))
    series: list[dict[str, Any]] = []

    for row in reader:
        close = row.get("CLOSE", "").strip()
        label = row.get("DATE", "").strip()
        if not close or not label:
            continue

        parsed = datetime.strptime(label, "%m/%d/%Y").strftime("%Y-%m-%d")
        series.append({"label": parsed, "value": round(float(close), 1)})

    if not series:
        raise ValueError("no CBOE VIX data")

    return series


def sample_history(series: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(series) <= HISTORY_POINTS:
        return series

    step = max(1, len(series) // HISTORY_POINTS)
    sampled = series[::step]
    if sampled[-1]["label"] != series[-1]["label"]:
        sampled.append(series[-1])
    return sampled[-HISTORY_POINTS:]


def fetch_moex_curve(date: str | None = None) -> list[dict[str, float]]:
    url = "https://iss.moex.com/iss/engines/stock/zcyc.json?iss.meta=off"
    if date:
        url += f"&date={date}"

    data = fetch_json(url)
    block = data.get("yearyields", {})
    columns = [str(column).lower() for column in block.get("columns", [])]
    rows = block.get("data", [])

    if "period" not in columns or "value" not in columns:
        raise RuntimeError("MOEX yearyields block is missing period/value columns")

    period_index = columns.index("period")
    value_index = columns.index("value")
    points: list[dict[str, float]] = []

    for row in rows:
        try:
            term = float(row[period_index])
            yield_value = float(row[value_index])
        except (TypeError, ValueError, IndexError):
            continue

        if math.isfinite(term) and math.isfinite(yield_value) and term > 0:
            points.append({"term": term, "yield": yield_value})

    if not points:
        raise RuntimeError(f"MOEX curve data was not found for {date or 'latest'}")

    return points


def curve_spread_bp(curve: list[dict[str, float]]) -> float:
    two_year = nearest_curve_point(curve, 2.0)
    ten_year = nearest_curve_point(curve, 10.0)
    return (ten_year["yield"] - two_year["yield"]) * 100


def fetch_moex_spread_history() -> list[dict[str, Any]]:
    history: list[dict[str, Any]] = []
    today = datetime.now(timezone.utc).date()
    checked = 0
    offset = 0

    while len(history) < HISTORY_POINTS and offset <= 70:
        date = today - timedelta(days=offset)
        offset += 7

        if date.weekday() >= 5:
            continue

        date_label = date.isoformat()
        try:
            spread = curve_spread_bp(fetch_moex_curve(date_label))
        except RuntimeError:
            continue

        checked += 1
        history.append({"label": date_label, "value": round(spread, 1)})

    history.reverse()

    if not history:
        spread = curve_spread_bp(fetch_moex_curve())
        history.append({"label": current_label(), "value": round(spread, 1)})

    return history[-HISTORY_POINTS:]


def fetch_raw(url: str, timeout: int = 60) -> str:
    try:
        return fetch_raw_curl(url, timeout)
    except RuntimeError:
        pass

    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})

    try:
        with urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(f"fetch failed for {url}: {exc}") from exc


def fetch_raw_curl(url: str, timeout: int) -> str:
    try:
        result = subprocess.run(
            [
                "curl",
                "-fsSL",
                "--http1.1",
                "--max-time",
                str(timeout),
                "-A",
                USER_AGENT,
                url,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        raise RuntimeError(f"fetch failed for {url}: {exc}") from exc

    if not result.stdout.strip():
        raise RuntimeError(f"fetch failed for {url}: empty response")

    return result.stdout


def fetch_text(url: str) -> str:
    return html_to_text(fetch_raw(url, timeout=30))


def fetch_json(url: str) -> Any:
    try:
        return json.loads(fetch_raw(url, timeout=30))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"json fetch failed for {url}: {exc}") from exc


def nearest_curve_point(curve: list[dict[str, float]], target_term: float) -> dict[str, float]:
    if not curve:
        raise ValueError("empty curve")
    return min(curve, key=lambda point: abs(point["term"] - target_term))


def html_to_text(raw_html: str) -> str:
    without_scripts = re.sub(r"<(script|style)\b.*?</\1>", " ", raw_html, flags=re.I | re.S)
    without_tags = re.sub(r"<[^>]+>", " ", without_scripts)
    return re.sub(r"\s+", " ", unescape(without_tags)).strip()


def find_number(pattern: str, text: str, default: float | None = None) -> float:
    match = re.search(pattern, text, flags=re.I)
    if match:
        return parse_number(match.group(1))
    if default is not None:
        return float(default)
    raise ValueError(f"number pattern not found: {pattern}")


def find_text(pattern: str, text: str, default: str) -> str:
    match = re.search(pattern, text, flags=re.I)
    return match.group(1) if match else default


def parse_number(value: str) -> float:
    return float(value.replace(",", "").strip())


def trend_from_delta(delta: float, neutral_band: float) -> str:
    if delta > neutral_band:
        return "up"
    if delta < -neutral_band:
        return "down"
    return "sideways"


def current_label() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


if __name__ == "__main__":
    raise SystemExit(main())
