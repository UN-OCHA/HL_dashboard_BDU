# HL Dashboard — UNOCHA Humanitarian Leadership Snapshot

A lightweight, static, OCHA-branded web dashboard that replaces the monthly
PowerPoint *Humanitarian Leadership Snapshot*. Data flows from a single
Google Sheet → published-to-web CSVs → this page. One source of truth for
the HLS team.

**Current release:** v3 — editorial broadsheet cover (Hallmark × OCHA design
pass) + Page 3 cross-filtering. Older versions archived at the `v1-archive`
/ `v2-archive` branches and the `v1.0.0` / `v2.0` tags.

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
│   ├── sheets-loader.js      # fetches 11 CSVs in parallel, 60s cache
│   ├── aggregate.js          # client-side cross-filter engine (v3)
│   ├── export.js             # PNG + PDF export
│   ├── main.js               # orchestrator
│   ├── charts/
│   │   ├── chart-hbar.js     # grouped/stacked horizontal bars + click hooks
│   │   ├── chart-donut.js    # stroked-arc donut w/ trim-path animation
│   │   ├── chart-line.js     # multi-series year-indexed lines
│   │   └── chart-stacked-col.js  # 100% stacked-column time series
│   └── render/
│       ├── header.js kpis.js map.js highlights.js
│       ├── charts.js tables.js resources.js footer.js
│       ├── filter-bar.js     # Page-3 chip bar (v3)
│       └── disclosure-agency.js  # "Other" agencies hover tooltip (v3)
├── assets/
│   ├── world-map.svg         # generated from Natural Earth (~130 KB)
│   ├── iasc-logo.svg         # IASC mark (v3 cover)
│   ├── favicon.svg
│   └── icons/                # OCHA humanitarian icon set
├── vendor/
│   ├── html2canvas.min.js    # PNG rasteriser (198 KB)
│   └── jspdf.umd.min.js      # PDF writer (364 KB)
├── scripts/
│   ├── migrate_xlsx_to_sheet.py     # one-off: Excel → CSVs
│   ├── build_world_map.py           # one-off: NE geojson → SVG
│   ├── sheets_api.gs                # Apps Script web app for the master sheet
│   ├── sheet_call.py                # Python client for the Sheets API
│   └── enrich_tab9_from_xlsx.py     # bulk-enrich Tab 9 from Luiza's xlsx
├── data/initial/             # starter CSVs generated from Excel
└── docs/
    ├── data-dictionary.md    # tab-by-tab column ref for Valijon
    ├── embed-snippet.html    # paste-ready iframe for IASC Drupal
    ├── SHEETS_API_SETUP.md   # deploy + use the Apps Script web app
    ├── TAB9_ENRICHMENT.md    # what Valijon still needs to fill in
    └── GOOGLE_SHEET_SETUP.md
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

1. Create a Google Sheet with 11 tabs: `1. Text & KPIs`,
   `2. Map (countries)`, `3. Leadership roles (donut)`,
   `4. Agency of origin (bar)`, `5. Country of origin by grade`,
   `6. Grade and gender`, `7. Gender trend, 1992 → present`,
   `8. Region trend, 1992 → present`, `9. Leaders (roster)`,
   `10. Contact directory`, `11. Reference links`.
2. Paste the CSVs from `data/initial/` into the matching tabs (the
   numbered prefixes must match what's in `app/config.js`).
3. For each tab: **File → Share → Publish to web → select tab → CSV → Publish**.
4. Paste each URL into the corresponding slot in `app/config.js`
   (replace the `TODO_PUBLISH_*` placeholders).
5. Commit + push. GitHub Pages will pick up the change automatically.

For programmatic write access (e.g. bulk-enriching Tab 9), deploy the
bundled Apps Script web app — see
[`docs/SHEETS_API_SETUP.md`](docs/SHEETS_API_SETUP.md).

See [`docs/data-dictionary.md`](docs/data-dictionary.md) for the column
spec of each tab and [`docs/TAB9_ENRICHMENT.md`](docs/TAB9_ENRICHMENT.md)
for the v3 enrichment columns.

## Updating content (for Valijon)

- **Text, KPIs, dates** — edit `1. Text & KPIs`
- **Add/remove/move a leader** — edit `9. Leaders (roster)`. v3 added
  five enrichment columns (`hat3, gender, nationality, weog, agency,
  grade`) so the dashboard can cross-filter. See
  [`docs/TAB9_ENRICHMENT.md`](docs/TAB9_ENRICHMENT.md) for what's still
  needed.
- **Map highlights** — edit `2. Map (countries)` (ISO3 codes)
- **Monthly highlight text** — edit `1. Text & KPIs`
- **Reference links** (Section 02 + Resources page) — edit
  `11. Reference links`
- Dashboard pulls fresh data on every page load. The gviz cache
  refreshes every ~60 s, so saved-sheet edits propagate within a minute
  or two.

No code changes required.

## Page 3 cross-filtering (v3)

Section 03 (Leadership characteristics) supports cohort filtering:

- A sticky chip bar at the top with five dropdowns —
  **Gender · Origin (WEOG) · Role · Grade · Agency**.
- Or click any chart segment directly: bars in Figs 3.1 / 3.2 / 3.4,
  slices in Fig 3.3.
- All four Page-3 charts re-render against the filtered cohort. Click
  the same chip / segment again to clear that clause (toggle).
- Filter state is mirrored into the URL hash
  (`/…/#gender=Female&weog=Non-WEOG`) — refresh-safe and shareable.
- Cohort KPIs on the cover, the map, the tables, the long-term trends
  (Page 4) and the PDF export all stay at the **baseline** cohort —
  filters are an exploration tool, not a publishing mode.

Engine lives at [`app/aggregate.js`](app/aggregate.js); chip bar at
[`app/render/filter-bar.js`](app/render/filter-bar.js). Diff-against-
pre-aggregated-tabs sanity helper: `Aggregate.diffVsPreaggregated(state)`
from the browser console.

## Exporting a report

- **Full PDF** — bottom-right **Download snapshot as PDF →** colophon
  on the cover → 7-page A4 PDF.
- **Single page as PNG** — hover a page, click **PNG** (top-right of
  the page).
- **Print** — ⌘P / Ctrl P → Save as PDF. Uses the print stylesheet.
- PDFs and PNGs always show the full cohort, never a filtered view —
  by design.

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
