from __future__ import annotations

import json
import math
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DATA_FILE = Path("data/indicators.json")
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
    return UpdateResult(value=round(actual, 1), label=release, trend=trend, trend_label=trend_label)


def update_copper(indicator: dict[str, Any]) -> UpdateResult:
    text = fetch_text(indicator["sourceUrl"])
    row = find_market_row("Copper", text)
    price_usd_per_lb = row["value"]
    price_usd_per_ton = price_usd_per_lb * 2204.62262185

    trend = trend_from_delta(row["pct_change"], neutral_band=0.2)
    trend_label = "растет" if trend == "up" else "падает" if trend == "down" else "боковик"
    return UpdateResult(
        value=round(price_usd_per_ton),
        label=current_label(),
        trend=trend,
        trend_label=trend_label,
    )


def update_vix(indicator: dict[str, Any]) -> UpdateResult:
    text = fetch_text(indicator["sourceUrl"])
    actual = find_number(r"Actual\s+([-+]?\d+(?:\.\d+)?)", text)

    try:
        row = find_market_row("USVIX", text)
        pct_change = row["pct_change"]
    except ValueError:
        pct_change = actual - float(indicator["value"])

    trend = trend_from_delta(pct_change, neutral_band=0.2)
    trend_label = "растет" if trend == "up" else "снижается" if trend == "down" else "умеренный риск"
    return UpdateResult(value=round(actual, 1), label=current_label(), trend=trend, trend_label=trend_label)


def update_yield_curve(indicator: dict[str, Any]) -> UpdateResult:
    curve = fetch_moex_curve()
    two_year = nearest_curve_point(curve, 2.0)
    ten_year = nearest_curve_point(curve, 10.0)
    spread_bp = (ten_year["yield"] - two_year["yield"]) * 100

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
    )


def apply_update(indicator: dict[str, Any], result: UpdateResult) -> None:
    indicator["value"] = result.value
    indicator["trend"] = result.trend
    indicator["trendLabel"] = result.trend_label

    if result.curve_shape:
        indicator["curveShape"] = result.curve_shape

    append_history(indicator, result.label, result.value)


def append_history(indicator: dict[str, Any], label: str, value: float) -> None:
    history = indicator.setdefault("history", [])

    if history and history[-1].get("label") == label:
        history[-1]["value"] = value
    else:
        history.append({"label": label, "value": value})

    indicator["history"] = history[-8:]


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})

    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"fetch failed for {url}: {exc}") from exc

    return html_to_text(raw)


def fetch_json(url: str) -> Any:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,*/*"})

    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8", errors="ignore"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"json fetch failed for {url}: {exc}") from exc


def fetch_moex_curve() -> list[dict[str, float]]:
    urls = [
        "https://iss.moex.com/iss/engines/stock/zcyc.json?iss.meta=off",
        "https://iss.moex.com/iss/engines/stock/zcyc/securities.json?iss.meta=off",
    ]

    for url in urls:
        try:
            data = fetch_json(url)
            curve = extract_curve_points(data)
            if curve:
                return curve
        except RuntimeError as exc:
            print(exc, file=sys.stderr)

    raise RuntimeError("MOEX curve data was not found in known ISS endpoints")


def extract_curve_points(data: Any) -> list[dict[str, float]]:
    points: list[dict[str, float]] = []

    if not isinstance(data, dict):
        return points

    for block in data.values():
        if not isinstance(block, dict):
            continue

        columns = [str(column).lower() for column in block.get("columns", [])]
        rows = block.get("data", [])

        if not columns or not isinstance(rows, list):
            continue

        term_index = find_column(columns, ["years", "year", "period", "term", "duration", "days"])
        yield_index = find_column(columns, ["yield", "value", "rate", "ytm", "effectiveyield"])

        if term_index is None or yield_index is None:
            continue

        for row in rows:
            try:
                term = normalize_term(float(row[term_index]), columns[term_index])
                yield_value = float(row[yield_index])
            except (TypeError, ValueError, IndexError):
                continue

            if math.isfinite(term) and math.isfinite(yield_value) and term > 0:
                points.append({"term": term, "yield": normalize_yield(yield_value)})

    return points


def find_column(columns: list[str], candidates: list[str]) -> int | None:
    for candidate in candidates:
        for index, column in enumerate(columns):
            if candidate in column:
                return index
    return None


def normalize_term(value: float, column_name: str) -> float:
    if "day" in column_name or "days" in column_name:
        return value / 365
    return value


def normalize_yield(value: float) -> float:
    return value / 100 if value > 1 else value


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


def find_market_row(name: str, text: str) -> dict[str, float]:
    pattern = rf"\b{re.escape(name)}\b\s+([-+]?\d[\d,.]*)\s+([-+]?\d[\d,.]*)\s+([-+]?\d+(?:\.\d+)?)%"
    match = re.search(pattern, text, flags=re.I)

    if not match:
        raise ValueError(f"market row not found: {name}")

    return {
        "value": parse_number(match.group(1)),
        "change": parse_number(match.group(2)),
        "pct_change": parse_number(match.group(3)),
    }


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
