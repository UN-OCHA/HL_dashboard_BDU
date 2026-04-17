# HL Dashboard — UNOCHA Humanitarian Leadership Snapshot

A lightweight, static, OCHA-branded web dashboard that replaces the monthly
PowerPoint *Humanitarian Leadership Snapshot*. Data flows from a single
Google Sheet → published-to-web CSVs → this page. One source of truth for
the HLS team.

**Live page:** `https://un-ocha.github.io/HL_dashboard_BDU/` *(when deployed)*
**Embeds on:** [IASC / Support to humanitarian leadership](https://interagencystandingcommittee.org/support-humanitarian-leadership)

---

## Project Owner
OCHA Humanitarian Leadership Section (HLS) — `hls@un.org`

## Maintained by
**OCHA Brand and Design Unit (BDU)**
- Team: `ochavisual@un.org`
- Focal point: Javier Cueto (`cuetoj@un.org`)

---

## What it is

Single-page site. No build step, no framework. Three moving parts:

| Layer | Tech |
|---|---|
| Layout | 7 A4-sized `.page` sections, responsive down to mobile |
| Charts | Inline SVG, hand-built (hbar / donut / line) using OCHA design tokens |
| Map | Inline SVG from Natural Earth 1:110m, country paths IDed by ISO3 |
| Data | Fetch published-to-web CSVs from a Google Sheet, 10 tabs |
| Export | `html2canvas` + `jsPDF` produce per-page PNGs and a full A4 PDF |

## Repo layout

```
HL_dashboard_BDU/
├── index.html                # 7 pages laid out as A4 sheets
├── styles.css                # OCHA tokens + page layout + print CSS
├── app/
│   ├── config.js             # Sheet CSV URLs + role/region colour maps
│   ├── csv-parser.js         # minimal RFC-4180 parser
│   ├── sheets-loader.js      # fetches 10 CSVs in parallel, 60s cache
│   ├── export.js             # PNG + PDF export
│   ├── main.js               # orchestrator
│   ├── charts/
│   │   ├── chart-hbar.js     # grouped/stacked horizontal bars
│   │   ├── chart-donut.js    # donut w/ centre label
│   │   └── chart-line.js     # multi-series year-indexed lines
│   └── render/
│       ├── header.js kpis.js map.js highlights.js
│       └── charts.js tables.js resources.js footer.js
├── assets/
│   └── world-map.svg         # generated from Natural Earth (~130 KB)
├── vendor/
│   ├── html2canvas.min.js    # PNG rasteriser (198 KB)
│   └── jspdf.umd.min.js      # PDF writer (364 KB)
├── scripts/
│   ├── migrate_xlsx_to_sheet.py   # one-off: Excel → CSVs
│   └── build_world_map.py         # one-off: NE geojson → SVG
├── data/initial/             # starter CSVs generated from Excel
└── docs/
    ├── data-dictionary.md    # tab-by-tab column ref for Valijon
    └── embed-snippet.html    # paste-ready iframe for IASC Drupal
```

## Running locally

```bash
# one-time setup
python3 -m venv .venv && source .venv/bin/activate
pip install openpyxl

# regenerate starter CSVs from the latest Excel export
python scripts/migrate_xlsx_to_sheet.py \
  --xlsx "../data/HC trends report 2025.xlsx" \
  --out  "data/initial"

# (re)build the world map — only needed once, or after Natural Earth updates
python scripts/build_world_map.py

# serve
python3 -m http.server 8765
# open http://localhost:8765
```

## Wiring up the live Google Sheet

1. Create a Google Sheet with 10 tabs: `meta`, `leaders`, `contacts`,
   `map_countries`, `roles_donut`, `agency_donut`, `country_by_grade`,
   `gender_by_grade`, `gender_trends`, `region_trends`.
2. Paste the CSVs from `data/initial/` into the matching tabs.
3. For each tab: **File → Share → Publish to web → select tab → CSV → Publish**.
4. Paste each URL into the corresponding slot in `app/config.js`
   (replace the `TODO_PUBLISH_*` placeholders).
5. Commit + push. GitHub Pages will pick up the change automatically.

See [`docs/data-dictionary.md`](docs/data-dictionary.md) for the column spec
of each tab.

## Updating content (for Valijon)

- **Text, KPIs, dates** — edit the `meta` tab
- **Add/remove/move a leader** — edit the `leaders` tab
- **Map highlights** — edit the `map_countries` tab (ISO3 codes)
- **Monthly highlight text** — edit `meta.monthly_highlight`
- Dashboard refreshes automatically every ~2 min; click **Refresh data** to force it.

No code changes required.

## Exporting a report

- **Full PDF** — top-right **↓ Download PDF** button → 7-page A4 PDF.
- **Single page as PNG** — hover a page, click **PNG** (top-right of the page).
- **Print** — ⌘P / Ctrl P → Save as PDF. Uses the print stylesheet.

## Embedding on IASC

Paste the snippet from `docs/embed-snippet.html` into the Drupal WYSIWYG in
HTML-source mode. If Drupal's CSP blocks the iframe, fall back to a linked
preview (also documented in the snippet file).

## Deployment (GitHub Pages)

1. Create `UN-OCHA/HL_dashboard_BDU` (public).
2. Push this folder as the repo root.
3. Settings → Pages → Source: **Deploy from branch / main / /**.
4. Wait ~1 min. Visit `https://un-ocha.github.io/HL_dashboard_BDU/`.

No build step, no GitHub Action required for normal operation.

## Licence & credits

- Code: MIT.
- World map geometry: Natural Earth (public domain).
- Fonts: Roboto (Google, Apache 2.0). Loaded from Google Fonts; a local
  copy in `assets/fonts/` is recommended for PDF fidelity (see `styles.css`).
