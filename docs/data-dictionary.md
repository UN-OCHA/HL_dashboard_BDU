# Data dictionary — Google Sheet → HL Dashboard

One Google Sheet feeds the entire dashboard. Each **tab** listed below is
published as CSV and fetched by the page on load. Column names must match
exactly (lowercase, snake_case). Extra columns are ignored.

Publishing a tab: **File → Share → Publish to web → [tab name] → Comma-separated values (.csv) → Publish**.

---

## Tab 1 — `meta`

Free-form key/value sheet with just two columns: `key`, `value`. Rows can
appear in any order. Unknown keys are ignored.

| key | value example | What it does |
|---|---|---|
| `snapshot_month` | `April 2026` | Big date shown on Page 1 |
| `last_updated` | `16 April 2026` | Small "Updated …" line on every page |
| `monthly_highlight` | *(free text)* | Page 2 highlight card. Supports `**bold**` and `[text](https://url)` |
| `kpi_total_leaders` | `27` | KPI 1 on Page 1 (omit → computed from `leaders`) |
| `kpi_pct_female` | `44` | KPI 2 (omit → computed) |
| `kpi_pct_underrepresented` | `60` | KPI 3 (omit → computed from WEOG column) |
| `kpi_deputy_hcs` | `2` | KPI 4 |
| `kpi_countries` | `25` | KPI 5 |

**When KPIs are omitted**, the page computes them from the `leaders` tab —
useful when adding/removing a row should flow through to the totals.

---

## Tab 2 — `leaders`

Current roster. One row per active humanitarian leader. Feeds Page 5 table
+ the KPI fallbacks.

| column | description |
|---|---|
| `country` | Duty-station country (e.g. *Yemen*) |
| `duty_station` | City or country of posting |
| `name` | Full name |
| `position` | Position title (e.g. *RC/HC*) |
| `hat3` | Short role code: `HC`, `DHC`, `RHC`, `SHC` |
| `gender` | `Female` / `Male` |
| `nationality` | Country of origin |
| `weog` | `WEOG` or `Non-WEOG` |
| `agency` | Home agency short name (*OCHA*, *WFP*, …) |
| `eod` | Entrance on duty (ISO date `YYYY-MM-DD`) |
| `eoa` | End of assignment (ISO date or blank) |

---

## Tab 3 — `contacts`

Contact directory. Feeds Page 6 table. Safe to leave fields blank.

| column | description |
|---|---|
| `country` | Duty-station country |
| `name` | HC/DHC name |
| `position` | Position title |
| `email` | Renders as a `mailto:` link |
| `phone` | Plain text |
| `pa_name` | Special assistant name |
| `pa_phone` | Special assistant phone |
| `ea_name` | Executive assistant name |
| `ea_phone` | Executive assistant phone |

---

## Tab 4 — `map_countries`

Drives which countries are highlighted on the Page 1 world map. Add a row
for each country that has a leader. **ISO3 codes** must be valid (e.g.
`YEM`, `SOM`, `SSD`, `PSE`).

| column | description |
|---|---|
| `iso3` | 3-letter country code (uppercase) — joins to the map SVG |
| `country` | Display name (shown in tooltip) |
| `leader_count` | Number of leaders in that country |
| `primary_role` | `HC` / `DHC` / `RHC` / … — picks the colour on the map |

---

## Tab 5 — `roles_donut`

Single donut chart data. One row per category.

| column | description |
|---|---|
| `label` | Role category (e.g. *RC/HC*, *DSRSG/RC/HC*, *Deputy HC*) |
| `value` | Absolute count |

---

## Tab 6 — `agency_donut`

Same shape as `roles_donut` — one row per agency (*OCHA*, *WFP*, *UNICEF*, *UNHCR*, *UNDP*, *UN-Women*, …).

---

## Tab 7 — `country_by_grade`

Grouped bar chart: WEOG vs Non-WEOG across role categories.

| column | description |
|---|---|
| `grade` | Role group label (`HC`, `DHC`, `RHC`, `Other`) |
| `weog` | Count of WEOG-nationality leaders in that group |
| `non_weog` | Count of Non-WEOG leaders |

---

## Tab 8 — `gender_by_grade`

Grouped bar chart: female vs male across role categories.

| column | description |
|---|---|
| `grade` | Role group label |
| `female` | Count of female leaders |
| `male` | Count of male leaders |

---

## Tab 9 — `gender_trends`

Long-term line chart (1992 → present).

| column | description |
|---|---|
| `year` | 4-digit year |
| `female_pct` | Percentage (0–100) |
| `male_pct` | Percentage (0–100) |

*(Values don't need to sum to 100 exactly — the chart plots what you give it.)*

---

## Tab 10 — `region_trends`

Regional origin line chart (1992 → present). Five region series.

| column | description |
|---|---|
| `year` | 4-digit year |
| `africa_pct` | % Africa |
| `apac_pct` | % Asia and the Pacific |
| `eeur_pct` | % Eastern Europe |
| `lac_pct` | % Latin America and the Caribbean |
| `weog_pct` | % Western Europe and Others |

---

## Tips

- **Headers must match exactly** (lowercase, no spaces). Extra columns are ignored, missing ones render as empty.
- **Numeric fields** can include commas (`1,234`) or decimal points; text is trimmed automatically.
- **Dates** use ISO format `YYYY-MM-DD` (e.g. `2026-04-16`).
- Google Sheet changes propagate within ~2 minutes (publish-to-web cache).
  The top-right **Refresh data** button forces an immediate reload.
- If the dashboard shows empty sections, open your browser's DevTools console
  (`F12` → Console). Any warnings about missing columns or tabs are logged there.
