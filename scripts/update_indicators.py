from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DATA_FILE = Path("data/indicators.json")
MAX_HISTORY = 24
LB_PER_METRIC_TON = 2204.62262

TE_RU_PMI_URL = "https://tradingeconomics.com/russia/manufacturing-pmi"
TE_COPPER_URL = "https://tradingeconomics.com/commodity/copper"
TE_VIX_URL = "https://tradingeconomics.com/vix:ind"
TE_US_10Y_URL = "https://tradingeconomics.com/united-states/government-bond-yield"
TE_US_2Y_URL = "https://tradingeconomics.com/united-states/2-year-note-yield"

MOEX_GCURVE_URL = "https://www.moex.com/ru/marketdata/indices/state/g-curve/"
MOEX_GCURVE_ARCHIVE_URL = "https://www.moex.com/ru/marketdata/indices/state/g-curve/archive/"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
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
    html = fetch_html(indicator["sourceUrl"])
    actual, previous, release, scraped_history = parse_te_russia_pmi(html)

    trend = trend_from_delta(actual - previous, neutral_band=0.15)
    trend_label = trend_label_ru(trend)
    history = merge_history(scraped_history, indicator.get("history", []))

    return UpdateResult(
        value=round(actual, 1),
        label=release,
        trend=trend,
        trend_label=trend_label,
        history=history,
    )


def update_copper(indicator: dict[str, Any]) -> UpdateResult:
    html = fetch_html(TE_COPPER_URL)
    meta = parse_te_charts_meta(html)
    value_lb = float(meta["last"])
    value_ton = round(value_lb * LB_PER_METRIC_TON)
    label = te_last_update_label(html) or current_label()

    history = merge_history(
        indicator.get("history", []),
        [{"label": label, "value": value_ton}],
    )
    previous = history[-2]["value"] if len(history) > 1 else value_ton
    trend = trend_from_delta(value_ton - float(previous), neutral_band=50)

    return UpdateResult(
        value=value_ton,
        label=label,
        trend=trend,
        trend_label=trend_label_ru(trend, sideways_label="боковик"),
        history=history,
    )


def update_vix(indicator: dict[str, Any]) -> UpdateResult:
    html = fetch_html(TE_VIX_URL)
    meta = parse_te_charts_meta(html)
    value = round(float(meta["last"]), 1)
    label = te_last_update_label(html) or current_label()

    history = merge_history(
        indicator.get("history", []),
        [{"label": label, "value": value}],
    )
    previous = history[-2]["value"] if len(history) > 1 else value
    trend = trend_from_delta(value - float(previous), neutral_band=0.2)
    trend_label = (
        "растет"
        if trend == "up"
        else "снижается"
        if trend == "down"
        else "умеренный риск"
    )

    return UpdateResult(
        value=value,
        label=label,
        trend=trend,
        trend_label=trend_label,
        history=history,
    )


def update_yield_curve(indicator: dict[str, Any]) -> UpdateResult:
    ofz_history = scrape_moex_ofz_spread_history()
    latest = ofz_history[-1]
    spread_bp = float(latest["value"])

    ust_spread_bp = scrape_ust_spread_bp()
    shape = curve_shape_from_spread(spread_bp)
    shape_label = curve_shape_label(shape)

    trend_label = shape_label
    if ust_spread_bp is not None:
        sign = "+" if ust_spread_bp >= 0 else ""
        trend_label = f"{shape_label}; UST {sign}{ust_spread_bp:.1f} б.п."

    return UpdateResult(
        value=round(spread_bp, 1),
        label=str(latest["label"]),
        trend="sideways",
        trend_label=trend_label,
        curve_shape=shape,
        history=ofz_history,
    )


def scrape_moex_ofz_spread_history() -> list[dict[str, Any]]:
    page_text = fetch_moex_page_text(MOEX_GCURVE_ARCHIVE_URL)
    rows = parse_moex_archive_rows(page_text)

    if not rows:
        page_text = fetch_moex_page_text(MOEX_GCURVE_URL)
        rows = parse_moex_current_curve_row(page_text)

    if not rows:
        raise RuntimeError("MOEX yield curve rows were not found in page HTML")

    history: list[dict[str, Any]] = []
    for row in rows:
        spread_bp = round((row["y10"] - row["y2"]) * 100, 1)
        history.append({"label": row["label"], "value": spread_bp})

    return trim_history(history)


def scrape_ust_spread_bp() -> float | None:
    html_10y = fetch_html(TE_US_10Y_URL)
    html_2y = fetch_html(TE_US_2Y_URL)
    y10 = float(parse_te_charts_meta(html_10y)["last"])
    y2 = float(parse_te_charts_meta(html_2y)["last"])
    return round((y10 - y2) * 100, 1)


def parse_moex_archive_rows(page_text: str) -> list[dict[str, float | str]]:
    tenors = parse_moex_tenors(page_text)
    if not tenors:
        return []

    try:
        idx_2y = tenors.index(2.0)
        idx_10y = tenors.index(10.0)
    except ValueError as exc:
        raise RuntimeError("MOEX archive table is missing 2Y or 10Y tenors") from exc

    rows: list[dict[str, float | str]] = []
    for line in page_text.splitlines():
        parts = [part.strip() for part in re.split(r"\t+", line.strip()) if part.strip()]
        if len(parts) < len(tenors) + 2:
            continue

        date_match = re.match(r"(\d{2})\.(\d{2})\.(\d{4})$", parts[0])
        if not date_match:
            continue

        day, month, year = date_match.groups()
        yields = [parse_locale_number(parts[2 + index]) for index in range(len(tenors))]
        rows.append(
            {
                "label": f"{year}-{month}-{day}",
                "y2": yields[idx_2y],
                "y10": yields[idx_10y],
            }
        )

    rows.reverse()
    return rows


def parse_moex_current_curve_row(page_text: str) -> list[dict[str, float | str]]:
    tenors = parse_moex_tenors(page_text)
    if not tenors:
        return []

    try:
        idx_2y = tenors.index(2.0)
        idx_10y = tenors.index(10.0)
    except ValueError as exc:
        raise RuntimeError("MOEX curve table is missing 2Y or 10Y tenors") from exc

    for line in page_text.splitlines():
        if not line.startswith("Y(t), %"):
            continue

        parts = [part.strip() for part in re.split(r"\t+", line.strip()) if part.strip()]
        yields = [parse_locale_number(value) for value in parts[1:]]
        if len(yields) < len(tenors):
            continue

        return [
            {
                "label": current_label(),
                "y2": yields[idx_2y],
                "y10": yields[idx_10y],
            }
        ]

    return []


def parse_moex_tenors(page_text: str) -> list[float]:
    for line in page_text.splitlines():
        if "0.25" not in line or "10" not in line or "20" not in line:
            continue

        parts = [part.strip() for part in re.split(r"\t+", line.strip()) if part.strip()]
        if parts and re.search(r"срок|лет", parts[0], flags=re.I):
            parts = parts[1:]

        tenors: list[float] = []
        for part in parts:
            try:
                tenors.append(parse_locale_number(part))
            except ValueError:
                break

        if 2.0 in tenors and 10.0 in tenors:
            return tenors

    return []


def fetch_moex_page_text(url: str) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("playwright is required for MOEX HTML scraping") from exc

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        page.goto(url, wait_until="domcontentloaded", timeout=90_000)
        page.wait_for_timeout(12_000)
        text = page.inner_text("body")
        browser.close()

    return text


def parse_te_charts_meta(html: str) -> dict[str, Any]:
    match = re.search(r"TEChartsMeta\s*=\s*(\[.*?\]);", html, flags=re.S)
    if not match:
        raise ValueError("TEChartsMeta block was not found")

    meta = json.loads(match.group(1))
    if not meta:
        raise ValueError("TEChartsMeta is empty")

    return meta[0]


def te_last_update_label(html: str) -> str | None:
    match = re.search(r"TELastUpdate\s*=\s*'(\d{12})'", html)
    if not match:
        return None

    stamp = match.group(1)
    try:
        parsed = datetime.strptime(stamp, "%Y%m%d%H%M")
    except ValueError:
        return None

    return parsed.strftime("%Y-%m-%d")


def apply_update(indicator: dict[str, Any], result: UpdateResult) -> None:
    indicator["value"] = result.value
    indicator["trend"] = result.trend
    indicator["trendLabel"] = result.trend_label

    if result.curve_shape:
        indicator["curveShape"] = result.curve_shape

    if result.history is not None:
        indicator["history"] = trim_history(result.history)


def parse_te_russia_pmi(html: str) -> tuple[float, float, str, list[dict[str, Any]]]:
    summary = re.search(
        r"Manufacturing PMI in Russia .*? to ([\d.]+) points? in (\w+) from ([\d.]+) points? in (\w+) of (\d{4})",
        html,
        flags=re.I,
    )
    if not summary:
        raise ValueError("Russia PMI summary was not found in Trading Economics HTML")

    actual = round(float(summary.group(1)), 1)
    month = summary.group(2)
    previous = round(float(summary.group(3)), 1)
    year = int(summary.group(5))
    release = f"{month} {year}"
    history = fetch_te_pmi_history(html, year, actual, release)

    return actual, previous, release, history


def fetch_te_pmi_history(
    html: str,
    year: int,
    latest_value: float,
    latest_label: str,
) -> list[dict[str, Any]]:
    history: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_point(month_name: str, value: float, point_year: int) -> None:
        label = f"{month_name} {point_year}"
        if label in seen:
            return
        seen.add(label)
        history.append({"label": label, "value": round(value, 1)})

    add_point(latest_label.split()[0], latest_value, year)

    for actual, month, previous, previous_month in re.findall(
        r"PMI (?:rose|fell|inched down|inched up|was unchanged at) to ([\d.]+) in (\w+) from ([\d.]+) in (\w+)",
        html,
        flags=re.I,
    ):
        month_year = resolve_pmi_year(month, year)
        previous_year = resolve_pmi_year(previous_month, year, reference_month=month)
        add_point(month, float(actual), month_year)
        add_point(previous_month, float(previous), previous_year)

    if not history:
        history.append({"label": latest_label, "value": round(latest_value, 1)})

    history.sort(key=pmi_history_sort_key)
    return trim_history(history)


def resolve_pmi_year(month_name: str, default_year: int, reference_month: str | None = None) -> int:
    month_index = month_number(month_name)
    if reference_month is None:
        return default_year

    reference_index = month_number(reference_month)
    if month_index > reference_index:
        return default_year - 1
    return default_year


def month_number(month_name: str) -> int:
    months = {
        "january": 1,
        "february": 2,
        "march": 3,
        "april": 4,
        "may": 5,
        "june": 6,
        "july": 7,
        "august": 8,
        "september": 9,
        "october": 10,
        "november": 11,
        "december": 12,
    }
    index = months.get(month_name.lower())
    if index is None:
        raise ValueError(f"unknown month name: {month_name}")
    return index


def pmi_history_sort_key(point: dict[str, Any]) -> tuple[int, int]:
    label = str(point["label"])
    parts = label.rsplit(" ", 1)
    if len(parts) != 2 or not parts[1].isdigit():
        return (0, 0)
    return (int(parts[1]), month_number(parts[0]))


def merge_history(
  *series: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()

    for points in series:
        for point in points:
            label = str(point["label"])
            if label in seen:
                for index, existing in enumerate(merged):
                    if existing["label"] == label:
                        merged[index] = {"label": label, "value": point["value"]}
                        break
                continue

            seen.add(label)
            merged.append({"label": label, "value": point["value"]})

    return trim_history(merged)


def trim_history(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return history[-MAX_HISTORY:]


def fetch_html(url: str, timeout: int = 60) -> str:
    return fetch_raw(url, timeout=timeout)


def fetch_text(url: str) -> str:
    return html_to_text(fetch_html(url, timeout=30))


def fetch_raw(url: str, timeout: int = 60) -> str:
    try:
        return fetch_raw_curl(url, timeout)
    except RuntimeError:
        pass

    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        },
    )

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
                "-H",
                "Accept: text/html,application/xhtml+xml",
                "-H",
                "Accept-Language: en-US,en;q=0.9,ru;q=0.8",
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


def parse_locale_number(value: str) -> float:
    normalized = value.strip().replace(" ", "").replace("%", "")
    if "," in normalized and "." in normalized:
        normalized = normalized.replace(",", "")
    else:
        normalized = normalized.replace(",", ".")
    return float(normalized)


def trend_from_delta(delta: float, neutral_band: float) -> str:
    if delta > neutral_band:
        return "up"
    if delta < -neutral_band:
        return "down"
    return "sideways"


def trend_label_ru(trend: str, sideways_label: str = "без резкого изменения") -> str:
    if trend == "up":
        return "растет"
    if trend == "down":
        return "падает"
    return sideways_label


def curve_shape_from_spread(spread_bp: float) -> str:
    if spread_bp < 0:
        return "inversion"
    if spread_bp < 25:
        return "flat"
    return "normal"


def curve_shape_label(shape: str) -> str:
    if shape == "inversion":
        return "инверсия"
    if shape == "flat":
        return "плоская форма"
    return "нормальная форма"


def current_label() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


if __name__ == "__main__":
    raise SystemExit(main())
