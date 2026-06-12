# Macro Dashboard

A static macro monitoring dashboard for GitHub Pages. Tracks Russia Manufacturing PMI, global copper prices, the VIX volatility index, and the US 10Y–2Y yield curve spread. Computes a weighted composite index and a macro regime score.

**Live site:** enable GitHub Pages on the `main` branch (root `/`) after pushing this repository.

## Features

- **Macro Regime Score** (0–10) from PMI, copper, VIX, and yield curve signals
- **Composite Index** — z-scored blend: `0.4×PMI + 0.3×Copper + 0.2×YieldCurve − 0.1×VIX`
- **Four indicator charts** with traffic-light status badges
- **Daily automated updates** via GitHub Actions
- **Fully static** — HTML, CSS, vanilla JavaScript, Chart.js; no server or database

## Project Structure

```
/
├── index.html
├── README.md
├── requirements.txt
├── css/style.css
├── js/dashboard.js, charts.js, indicators.js, composite.js, utils.js
├── data/pmi.json, copper.json, vix.json, yield_curve.json, composite.json
├── scripts/update_pmi.py, update_copper.py, update_vix.py, update_yield_curve.py, calculate_composite.py, common.py, seed_data.py
└── .github/workflows/update-data.yml
```

## Data Sources

| Indicator   | Source | FRED / API Series |
|-------------|--------|-------------------|
| Russia PMI  | [Trading Economics](https://tradingeconomics.com/russia/manufacturing-pmi) | API or HTML scrape |
| Copper      | [FRED](https://fred.stlouisfed.org/series/PCOPPUSDM) | `PCOPPUSDM` |
| VIX         | [FRED](https://fred.stlouisfed.org/series/VIXCLS) | `VIXCLS` |
| Yield Curve | [FRED](https://fred.stlouisfed.org/series/DGS10) / [DGS2](https://fred.stlouisfed.org/series/DGS2) | `DGS10 − DGS2` |

## JSON Format

Standard indicators:

```json
[{"date": "2025-06-01", "value": 52.3}]
```

Yield curve:

```json
[{"date": "2025-06-01", "spread": 1.25}]
```

Composite:

```json
[{"date": "2025-06-01", "value": 0.44}]
```

Records are merged by date — existing dates are updated, duplicates are prevented, and history accumulates over time.

## Status Logic

| Indicator | Green | Yellow | Red |
|-----------|-------|--------|-----|
| PMI | > 50 | 48–50 | < 48 |
| Copper | Above 12-month average | — | Below average |
| VIX | < 15 | 15–25 | > 25 |
| Yield Curve | Spread > 0 | — | Spread < 0 |

## Macro Regime Score (max 10)

| Signal | Points |
|--------|--------|
| PMI > 50 | +3 |
| PMI rising vs prior month | +2 |
| Copper above 12-month average | +2 |
| VIX < 20 | +1 |
| Yield spread > 0 | +2 |

| Score | Regime |
|-------|--------|
| 8–10 | Expansion |
| 5–7 | Neutral |
| 0–4 | Risk Off |

Charts display the **last 12 months** from the current date.

## Setup

### GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`.
5. Save. The site will be available at `https://<username>.github.io/macro-dashboard/`.

### Secrets (recommended for automated updates)

Add these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Required | Description |
|--------|----------|-------------|
| `FRED_API_KEY` | Recommended | Free key from [FRED API](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `TRADING_ECONOMICS_API_KEY` | Optional | Trading Economics API key for PMI |

Without `FRED_API_KEY`, update scripts fall back to FRED public CSV downloads. Without `TRADING_ECONOMICS_API_KEY`, PMI is scraped from the Trading Economics page or merged from manual uploads.

### Manual PMI upload

Create `data/pmi_manual.json` with the standard format. The updater merges it into `data/pmi.json` on each run.

## Local Development

Serve the repo root with any static file server:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

### Seed data

```bash
python3 scripts/seed_data.py
python3 scripts/calculate_composite.py
```

### Run updaters locally

```bash
export FRED_API_KEY=your_key_here
export TRADING_ECONOMICS_API_KEY=your_key_here   # optional

python3 scripts/update_pmi.py
python3 scripts/update_copper.py
python3 scripts/update_vix.py
python3 scripts/update_yield_curve.py
python3 scripts/calculate_composite.py
```

## GitHub Actions

Workflow: `.github/workflows/update-data.yml`

- Runs daily at **06:00 UTC** and on manual `workflow_dispatch`
- Fetches latest data, recalculates composite, commits and pushes to `main`
- Retries on API errors; skips individual sources on failure without blocking others
- Push step retries up to 5 times with rebase on conflicts

## Adding a New Indicator

1. Add a JSON file under `data/`.
2. Create `scripts/update_<indicator>.py` using `common.py` helpers.
3. Register metadata and status logic in `js/indicators.js`.
4. Add a card to `index.html` and render it in `js/dashboard.js`.
5. Optionally include it in `calculate_composite.py` weights.
6. Add the updater to `.github/workflows/update-data.yml`.

## License

MIT
