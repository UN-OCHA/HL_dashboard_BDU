/**
 * config.js — Environment-specific configuration for the HL Dashboard.
 *
 * The dashboard is data-driven from a single Google Sheet. Each tab of the
 * Sheet is published individually (File → Share → Publish to web → select
 * the tab → CSV). Paste those URLs here.
 *
 * For local development you can point SHEET_CSV at ./data/initial/*.csv
 * (output of scripts/migrate_xlsx_to_sheet.py) instead of the published URLs.
 */

/* global HLConfig:true */

var HLConfig = (function () {
  "use strict";

  /* ── Google Sheet integration ──────────────────────────────
     Live data source: one Google Sheet with one tab per data section.
     The sheet's ID is the long random string in its URL:
       https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
     To start pulling live data Valijon simply needs to:
       1. Open the sheet → Share → "Anyone with the link — Viewer".
       2. Run the Apps Script (Tools → Script editor → paste
          /scripts/setup_sheet.gs and click Run) to populate the tabs.

     We use Google's `gviz/tq` CSV endpoint because it works with
     "Anyone with the link" sharing — no per-tab "Publish to web" step. */

  var SHEET_ID = "1wiNvKjtiwoX2UNBJuNX472cLWKExlQ-vxXAOiLFH484";

  // Internal key → human-friendly tab name as written by setup_sheet.gs.
  // Keep these two in lock-step; renaming a tab in the sheet requires the
  // matching line here.
  var TAB_TITLES = {
    meta:             "1. Text & KPIs",
    map_countries:    "2. Map (countries)",
    roles_donut:      "3. Leadership roles (donut)",
    agency_donut:     "4. Agency of origin (bar)",
    country_by_grade: "5. Country of origin by grade",
    gender_by_grade:  "6. Grade and gender",
    gender_trends:    "7. Gender trend, 1992 → present",
    region_trends:    "8. Region trend, 1992 → present",
    leaders:          "9. Leaders (roster)",
    contacts:         "10. Contact directory"
  };
  var TAB_NAMES = Object.keys(TAB_TITLES);

  // Tabs that need `&headers=0` on the gviz URL. See the long explanation
  // inside gvizUrl() below for the exact reason — short version: any tab
  // whose value column mixes text + dates + numbers (currently only the
  // meta tab) must opt out of gviz's column-type inference, otherwise all
  // text cells get nulled. Chart tabs have single-type columns, so they
  // MUST NOT use `headers=0` — adding it there causes gviz to include the
  // string header ("value", "year", …) in its type sample and drop that
  // cell, which in turn kills chart rendering.
  var TABS_NO_HEADER_PROMOTION = { meta: true };

  function gvizUrl(key) {
    var title = TAB_TITLES[key] || key;
    // `range=A2:Z` skips the coloured description banner on row 1 before
    // gviz runs its own header-detection pass. Without this, gviz merges
    // row 1 with row 2 ("label","value") into a compound column label
    // AND strips numeric-looking headers, which breaks chart parsing.
    //
    // `headers=0` is applied ONLY to tabs where the data column mixes
    // text + numbers + dates (meta). It suppresses gviz's column-type
    // promotion, so long paragraphs don't silently vanish next to a
    // date-shaped cell (that was the overview/monthly_highlight bug).
    //
    // DO NOT enable `headers=0` globally — on chart tabs it makes things
    // worse: gviz uses the header cells as part of the type sample,
    // which drops the string header "value" / "year" when the data
    // column below is numeric, breaking the parser entirely.
    var params = "tqx=out:csv&range=A2:Z";
    if (TABS_NO_HEADER_PROMOTION[key]) params += "&headers=0";
    return "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
           "/gviz/tq?" + params + "&sheet=" + encodeURIComponent(title);
  }

  // Local dev-only fallback CSVs. Only used when SHEET_ID is empty /
  // when a tab doesn't exist yet in the live sheet.
  var LOCAL_FALLBACK = {
    meta:             "data/initial/meta.csv",
    leaders:          "data/initial/leaders.csv",
    contacts:         "data/initial/contacts.csv",
    map_countries:    "data/initial/map_countries.csv",
    roles_donut:      "data/initial/roles_donut.csv",
    agency_donut:     "data/initial/agency_donut.csv",
    country_by_grade: "data/initial/country_by_grade.csv",
    gender_by_grade:  "data/initial/gender_by_grade.csv",
    gender_trends:    "data/initial/gender_trends.csv",
    region_trends:    "data/initial/region_trends.csv"
  };

  function csvUrlFor(tabName) {
    return SHEET_ID ? gvizUrl(tabName) : LOCAL_FALLBACK[tabName];
  }
  function localFallbackFor(tabName) { return LOCAL_FALLBACK[tabName]; }

  /* ── Color mapping for roles on the world map ──────────────
     Keep these aligned with the Leadership-roles donut so the map
     and donut tell the same visual story. */

  // 4-category leadership palette using the UN Blue ramp only — mirrors
  // the PPT map (darker blue = more senior hat). Keys cover the Hat 3
  // short codes and the Position Title variants.
  var ROLE_COLORS = {
    // Most frequent role — brightest signature blue.
    "RC/HC":                 "#009EDB", // UN Blue (step 4)
    "HC":                    "#009EDB",
    "Humanitarian Coordinator": "#009EDB",
    // Triple-hatted DSRSG/RC/HC — darker blue.
    "DSRSG/RC/HC":           "#0074B7", // Blue 3
    // Triple-hatted DSC/RC/HC — darkest blue.
    "DSC/RC/HC":             "#004987", // Blue 2
    // Deputy HC — light blue ramp step so it stays in family.
    "Deputy HC":             "#64BDEA", // Blue 5
    "DHC":                   "#64BDEA",
    // Regional HC (rare) — same pale tint as DHC.
    "RHC":                   "#64BDEA",
    "Regional HC":           "#64BDEA"
  };
  var DEFAULT_ROLE_COLOR = "#C5DFEF"; // Blue 6 — pale fallback

  function colorForRole(role) {
    if (!role) return DEFAULT_ROLE_COLOR;
    var key = String(role).trim();
    if (ROLE_COLORS[key]) return ROLE_COLORS[key];
    // Case-insensitive fallback
    var upper = key.toUpperCase();
    for (var k in ROLE_COLORS) {
      if (k.toUpperCase() === upper) return ROLE_COLORS[k];
    }
    return DEFAULT_ROLE_COLOR;
  }

  /* ── Gender colours (used across charts & map) ─────────────
     Muted dual-colour pair consistent with UN Women visual guidance. */

  // Use OCHA Blue + OCHA Orange (the two main brand colours that encode
  // two-way comparison cleanly). Replaces the earlier off-brand coral.
  var GENDER_COLORS = {
    Female: "#009EDB",
    Male:   "#F58220"
  };

  /* ── Region colours for regional-origin trends ─────────────
     5 lines exceeds OCHA's "max 4 lines" rule. We mitigate by using
     five stepped tints of the UN Blue ramp — the lines read as one
     monochrome sequence rather than five competing colours. */

  var REGION_COLORS = {
    africa: "#002E6E", // Blue 1 — Navy
    apac:   "#0074B7", // Blue 3
    eeur:   "#009EDB", // Blue 4 — UN Blue
    lac:    "#64BDEA", // Blue 5
    weog:   "#C5DFEF"  // Blue 6 — pale
  };
  var REGION_LABELS = {
    africa: "Africa",
    apac:   "Asia and the Pacific",
    eeur:   "Eastern Europe",
    lac:    "Latin America and the Caribbean",
    weog:   "Western Europe and Others"
  };

  /* ── Resources (Page 7) — static content from PPT slide 8 ── */

  var RESOURCES = {
    Guidance: [
      { label: "Humanitarian Reset", url: "https://interagencystandingcommittee.org/" },
      { label: "Inter-Agency Standing Committee (IASC)", url: "https://interagencystandingcommittee.org/" },
      { label: "OCHA Humanitarian Leadership Strengthening", url: "https://www.unocha.org/" },
      { label: "Leadership in Humanitarian Action Handbook", url: "https://interagencystandingcommittee.org/" },
      { label: "Leading an Emergency Response", url: "https://interagencystandingcommittee.org/" }
    ],
    Voices: [
      { label: "ERG's Humanifesto", url: "https://interagencystandingcommittee.org/" },
      { label: "I Was There: voices of humanitarian leadership", url: "https://interagencystandingcommittee.org/" },
      { label: "Humanitarian Leadership stories", url: "https://interagencystandingcommittee.org/" }
    ],
    "Talent initiatives": [
      { label: "RC/HC Talent Pipeline", url: "https://unsceb.org/" }
    ]
  };

  return {
    SHEET_ID: SHEET_ID,
    csvUrlFor: csvUrlFor,
    localFallbackFor: localFallbackFor,
    TABS: TAB_NAMES,
    ROLE_COLORS: ROLE_COLORS,
    colorForRole: colorForRole,
    GENDER_COLORS: GENDER_COLORS,
    REGION_COLORS: REGION_COLORS,
    REGION_LABELS: REGION_LABELS,
    RESOURCES: RESOURCES,
    CACHE_TTL_MS: 60 * 1000 // 60s client-side cache
  };
})();
