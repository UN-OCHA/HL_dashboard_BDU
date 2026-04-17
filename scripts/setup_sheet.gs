/**
 * setup_sheet.gs — Google Apps Script that provisions the HL Dashboard
 * workbook for Valijon.
 *
 * Run once, from inside the Google Sheet:
 *   Extensions → Apps Script → paste this file → ▶ Run → setup()
 *
 * What it does:
 *   • Creates 10 tabs (one per data section) with human-friendly names
 *   • Writes coloured headers + section descriptions
 *   • Seeds every tab with starter data (so the dashboard renders on
 *     day one without additional work)
 *   • Freezes the header rows so scrolling stays oriented
 *   • Colour-codes tab colours so it's obvious which section each
 *     drives (Text = blue, Map = teal, Charts = orange, People = purple,
 *     Trends = gold)
 *
 * Re-running setup() is safe — it will NOT overwrite tabs that already
 * have content; it only updates the header row, colour, and frozen
 * rows. If you want to reset a specific tab, delete it from the sheet
 * first and re-run.
 */

var BRAND = {
  blue:       "#009EDB",
  blueText:   "#FFFFFF",
  teal:       "#1EBFB3",
  orange:     "#F58220",
  red:        "#ED1847",
  purple:     "#A05FB4",
  gold:       "#FFC800",
  grey:       "#4D4D4D",
  lightGrey:  "#F2F2F2"
};

// Tab catalogue — what each tab is for, what columns it needs, starter
// data, and a colour coding group so Valijon can tell at a glance which
// part of the dashboard they're editing.
var TABS = [
  {
    key: "meta",
    title: "1. Text & KPIs",
    group: "Text",
    color: BRAND.blue,
    description:
      "Page header, the 5 KPI figures, and all the editable text on the " +
      "dashboard (overview, leadership on the move, monthly highlight, " +
      "observations under the charts). Edit the VALUE column only.",
    headers: ["key", "value"],
    rows: [
      ["snapshot_month", "February 2026"],
      ["last_updated",   "01 February 2026"],
      ["overview",
       "There are currently **27 humanitarian leaders** coordinating " +
       "humanitarian response in **25 countries**.\n\n" +
       "Of this leadership cohort, 7 are Deputy Special Representatives of " +
       "the Secretary-General / Resident Coordinators / Humanitarian " +
       "Coordinators (DSRSG/RC/HC) and 2 Deputy Special Coordinators / " +
       "RC/HCs (DSC/RC/HC), 16 RC/HCs, and 2 Deputy HCs (DHCs).\n\n" +
       "Over **44 per cent** of the cohort is female, while **60 per cent** " +
       "originate from countries historically under-represented."],
      ["leadership_on_the_move",
       "**Regional:** Mr. John Ging has been designated as Senior Advisor " +
       "on the Middle East and North Africa (MENA)."],
      ["monthly_highlight",
       "The IASC Emergency Directors Group (EDG) recently endorsed the HC " +
       "Leadership Profile, which sets out a clear framework for the " +
       "**values, attributes, competencies, and commitments** expected of " +
       "effective humanitarian leaders. The Profile complements the RC " +
       "Leadership Profile and HC Terms of Reference, guides HC " +
       "designations, selection into the HC Pool and Talent Pipeline, " +
       "and performance management."],
      ["note_characteristics",
       "Leadership positions are largely concentrated at the **RC/HC " +
       "level**, representing around 60 per cent of the total, followed " +
       "by DSRSG/RC/HC positions at 26 per cent, with Deputy HC and other " +
       "senior roles accounting for the remaining 15 per cent.\n\n" +
       "The current leadership cadre is drawn from a range of agencies: " +
       "22 per cent from UNDP, 19 per cent from UNICEF, 15 per cent from " +
       "OCHA, and approximately 33 per cent from nine other agencies.\n\n" +
       "Representation by country of origin varies across grades."],
      ["note_trends",
       "Gender distribution is different across leadership grades. At the " +
       "ASG level, women account for around 30 per cent of the total. At " +
       "the D2 level, female representation has surpassed parity and " +
       "reached 60 per cent.\n\n" +
       "Historically, the number of women in leadership roles has " +
       "increased steadily, with long-term trends pointing to gradual " +
       "progress toward greater gender balance.\n\n" +
       "Regionally, leadership representation has diversified."],
      ["kpi_total_leaders",          27],
      ["kpi_pct_female",             44],
      ["kpi_pct_underrepresented",   60],
      ["kpi_deputy_hcs",             2],
      ["kpi_countries",              25]
    ]
  },

  {
    key: "map_countries",
    title: "2. Map (countries)",
    group: "Map",
    color: BRAND.teal,
    description:
      "(Reserved for when the map becomes data-driven again.) Currently " +
      "the map is a static SVG — you can ignore this tab for now.",
    headers: ["iso3", "country", "primary_role", "has_dhc"],
    rows: []
  },

  {
    key: "roles_donut",
    title: "3. Leadership roles (donut)",
    group: "Chart",
    color: BRAND.orange,
    description:
      "Slice values for the Leadership roles donut on page 3. One row " +
      "per role. Values are simple counts (the donut computes % itself).",
    headers: ["label", "value"],
    rows: [
      ["RC/HC",         16],
      ["DSRSG/RC/HC",    7],
      ["DSC/RC/HC",      2],
      ["Deputy HC",      2]
    ]
  },
  {
    key: "agency_donut",
    title: "4. Agency of origin (bar)",
    group: "Chart",
    color: BRAND.orange,
    description:
      "Agencies the current leaders come from. One row per agency, any " +
      "count. Rendered as a sorted horizontal bar chart.",
    headers: ["label", "value"],
    rows: [
      ["Other",   9],
      ["UNDP",    6],
      ["UNICEF",  5],
      ["OCHA",    4],
      ["WFP",     3]
    ]
  },
  {
    key: "country_by_grade",
    title: "5. Country of origin by grade",
    group: "Chart",
    color: BRAND.orange,
    description:
      "Grouped bar chart on page 3. One row per UN grade (ASG / D2 / D1). " +
      "Columns: WEOG count, Non-WEOG count.",
    headers: ["grade", "weog", "non_weog"],
    rows: [
      ["ASG", 6, 8],
      ["D2",  3, 8],
      ["D1",  2, 0]
    ]
  },
  {
    key: "gender_by_grade",
    title: "6. Grade and gender",
    group: "Chart",
    color: BRAND.orange,
    description:
      "Grouped bar chart on page 3. One row per UN grade. Columns: " +
      "female, male (absolute counts).",
    headers: ["grade", "female", "male"],
    rows: [
      ["ASG", 4, 10],
      ["D2",  6,  5],
      ["D1",  2,  0]
    ]
  },

  {
    key: "gender_trends",
    title: "7. Gender trend, 1992 → present",
    group: "Trend",
    color: BRAND.gold,
    description:
      "One row per year, percent split female/male. Columns must sum to " +
      "(or close to) 100 per row. Drives the stacked-column chart on page 4.",
    headers: ["year", "female_pct", "male_pct"],
    rows: buildYearRows(1992, 2024, function (y) {
      // Coarse linear trend as a starter — Valijon replaces with actual figures.
      var f = Math.max(0, Math.min(60, Math.round((y - 1992) * 1.8)));
      return [y, f, 100 - f];
    })
  },
  {
    key: "region_trends",
    title: "8. Region trend, 1992 → present",
    group: "Trend",
    color: BRAND.gold,
    description:
      "One row per year, percent split by region of origin. Five region " +
      "columns sum to 100 per row. Drives the stacked-column chart on page 4.",
    headers: ["year", "africa_pct", "apac_pct", "eeur_pct", "lac_pct", "weog_pct"],
    rows: buildYearRows(1992, 2024, function (y) {
      var p = (y - 1992) / (2024 - 1992);
      var af   = Math.round(10 + 30 * p);
      var apac = Math.round(5 + 5 * p);
      var eeur = y >= 2018 ? 3 : 0;
      var lac  = y >= 2012 ? 3 : 1;
      var weog = 100 - af - apac - eeur - lac;
      return [y, af, apac, eeur, lac, weog];
    })
  },

  {
    key: "leaders",
    title: "9. Leaders (roster)",
    group: "People",
    color: BRAND.purple,
    description:
      "One row per humanitarian leader. Drives the Page 5 table. Country " +
      "and Position are required; the other columns are optional detail.",
    headers: [
      "country", "duty_station", "name", "position",
      "hat3", "gender", "nationality", "weog", "agency", "eod", "eoa"
    ],
    rows: [
      ["Afghanistan",              "Kabul",        "Indrika Ratwatte",              "DSRSG/RC/HC", "", "", "", "", "", "", ""],
      ["Burkina Faso",             "Ouagadougou",  "Maurice Azonnankpo",            "RC/HC OiC",   "", "", "", "", "", "", ""],
      ["Cameroon",                 "Yaoundé",      "Issa Sanogo",                   "RC/HC",       "", "", "", "", "", "", ""],
      ["Central African Republic", "Bangui",       "Mohamed Ag Ayoya",              "DSRSG/RC/HC", "", "", "", "", "", "", ""],
      ["Chad",                     "N'Djamena",    "François Batalingaya",          "RC/HC",       "", "", "", "", "", "", ""],
      ["Colombia",                 "Bogota",       "Mireia Villar Forner",          "RC/HC",       "", "", "", "", "", "", ""],
      ["Democratic Republic of the Congo","Kinshasa","Bruno Lemarquis",             "DSRSG/RC/HC", "", "", "", "", "", "", ""],
      ["Eritrea",                  "Asmara",       "Nahla Valji",                   "RC/HC",       "", "", "", "", "", "", ""],
      ["Ethiopia",                 "Addis Ababa",  "Aboubacar Kampo",               "RC/HC OiC",   "", "", "", "", "", "", ""],
      ["Haiti",                    "Port-au-Prince","Nicole Kouassi",               "DSRSG/RC/HC", "", "", "", "", "", "", ""],
      ["Iraq",                     "Baghdad",      "Ghulam Isaczai",                "DSRSG/RC/HC", "", "", "", "", "", "", ""],
      ["Lebanon",                  "Beirut",       "Imran Riza",                    "DSC/RC/HC",   "", "", "", "", "", "", ""],
      ["Mali",                     "Bamako",       "Hanaa Singer",                  "RC/HC",       "", "", "", "", "", "", ""],
      ["Mozambique",               "Maputo",       "Catherine Sozi",                "RC/HC",       "", "", "", "", "", "", ""],
      ["Myanmar",                  "Yangon",       "Gwyn Lewis",                    "RC/HC a.i.",  "", "", "", "", "", "", ""],
      ["Niger",                    "Niamey",       "Mama Keita",                    "RC/HC",       "", "", "", "", "", "", ""],
      ["Nigeria",                  "Abuja",        "Mohamed Fall",                  "RC/HC",       "", "", "", "", "", "", ""],
      ["OPT",                      "Jerusalem",    "Ramiz Alakbarov",               "DSC/RC/HC",   "", "", "", "", "", "", ""],
      ["Pakistan",                 "Islamabad",    "Mohamed Yahya",                 "RC/HC",       "", "", "", "", "", "", ""],
      ["Somalia",                  "Mogadishu",    "George Conway",                 "DSRSG/RC/HC", "", "", "", "", "", "", ""],
      ["South Sudan",              "Juba",         "Anita Kiki Gbeho",              "DSRSG/RC/HC", "", "", "", "", "", "", ""],
      ["Sudan",                    "Port Sudan",   "Denise Brown",                  "RC/HC",       "", "", "", "", "", "", ""],
      ["Syrian Arab Republic",     "Damascus",     "Nathalie Fustier",              "RC/HC a.i.",  "", "", "", "", "", "", ""],
      ["Ukraine",                  "Kyiv",         "Matthias Schmale",              "RC/HC",       "", "", "", "", "", "", ""],
      ["Venezuela",                "Caracas",      "Gianluca Rampolla del Tindaro", "RC/HC",       "", "", "", "", "", "", ""],
      ["Yemen",                    "Sana'a",       "Julien Harneis",                "RC/HC",       "", "", "", "", "", "", ""],
      ["Zimbabwe",                 "Harare",       "Edward Kallon",                 "RC/HC",       "", "", "", "", "", "", ""],
      ["OPT",                      "Gaza",         "Suzanna Tkalec",                "Deputy HC",   "", "", "", "", "", "", ""],
      ["Sudan Crisis",             "Tawila",       "Rosaria Bruno",                 "Deputy HC",   "", "", "", "", "", "", ""]
    ]
  },
  {
    key: "contacts",
    title: "10. Contact directory",
    group: "People",
    color: BRAND.purple,
    description:
      "Page 6 contacts table. Safe to leave email / phone cells blank — " +
      "they render as em-dashes until filled.",
    headers: [
      "country", "name", "position", "email", "phone",
      "pa_name", "pa_phone", "ea_name", "ea_phone"
    ],
    rows: []   // names auto-copied from 'leaders' on first sync; see below
  }
];


/* ── Main entry point ─────────────────────────────────────── */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Ensure every tab exists with starter data.
  TABS.forEach(function (spec) {
    var sheet = ss.getSheetByName(spec.title) || ss.insertSheet(spec.title);
    formatTab(sheet, spec);
  });

  // Derive `contacts` from `leaders` if the contacts tab is empty.
  seedContactsFromLeaders(ss);

  // Remove the default "Sheet1" if it's still lurking.
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  // Reorder tabs so they appear in numbered order.
  TABS.forEach(function (spec, idx) {
    var s = ss.getSheetByName(spec.title);
    if (s) {
      ss.setActiveSheet(s);
      ss.moveActiveSheet(idx + 1);
    }
  });

  SpreadsheetApp.getActive().toast(
    "HL Dashboard sheet set up. Colour-coded tabs: Text=blue, Map=teal, " +
    "Chart=orange, Trend=gold, People=purple.",
    "HL Dashboard", 8
  );
}


/* ── Per-tab formatting ───────────────────────────────────── */
function formatTab(sheet, spec) {
  sheet.setTabColor(spec.color);

  // Ensure row 1 is the description banner, row 2 headers.
  var needsSeed = sheet.getLastRow() <= 1;

  // Row 1: section description / how-to-edit banner.
  var banner = sheet.getRange(1, 1, 1, Math.max(1, spec.headers.length));
  banner.merge().setValue(spec.description);
  banner.setBackground(spec.color).setFontColor("#FFFFFF").setFontSize(10)
        .setFontWeight("bold").setWrap(true).setVerticalAlignment("middle");
  sheet.setRowHeight(1, 44);

  // Row 2: column headers.
  var headerRange = sheet.getRange(2, 1, 1, spec.headers.length);
  headerRange.setValues([spec.headers]);
  headerRange.setBackground(BRAND.grey).setFontColor("#FFFFFF")
             .setFontWeight("bold").setFontSize(11);

  // Seed data rows (only when the sheet is empty).
  if (needsSeed && spec.rows && spec.rows.length > 0) {
    sheet.getRange(3, 1, spec.rows.length, spec.headers.length)
         .setValues(spec.rows);
    // Soft-zebra striping for readability.
    for (var i = 0; i < spec.rows.length; i++) {
      if (i % 2 === 1) {
        sheet.getRange(3 + i, 1, 1, spec.headers.length)
             .setBackground(BRAND.lightGrey);
      }
    }
  }

  // Freeze top 2 rows (banner + headers) so Valijon keeps context while scrolling.
  sheet.setFrozenRows(2);

  // Auto-resize columns for a clean default view.
  for (var c = 1; c <= spec.headers.length; c++) sheet.autoResizeColumn(c);

  // Meta tab: let the VALUE column wrap long text.
  if (spec.key === "meta") {
    sheet.setColumnWidth(2, 420);
    sheet.getRange(3, 2, 20, 1).setWrap(true);
    sheet.setColumnWidth(1, 220);
    // CRITICAL: force column B to "Plain text" so gviz exports all rows as
    // strings. If any numeric/date cells seed the column first, Google
    // auto-types the whole column as `number` and gviz silently DROPS all
    // non-numeric cells (returning null for every prose paragraph). That
    // was the cause of the empty overview/monthly_highlight bug in v1.
    sheet.getRange(1, 2, sheet.getMaxRows(), 1).setNumberFormat("@");
  }
}


/* ── Helpers ──────────────────────────────────────────────── */
function seedContactsFromLeaders(ss) {
  var contacts = ss.getSheetByName("10. Contact directory");
  var leaders  = ss.getSheetByName("9. Leaders (roster)");
  if (!contacts || !leaders) return;
  if (contacts.getLastRow() > 2) return;  // already has data

  var values = leaders.getRange(3, 1, Math.max(0, leaders.getLastRow() - 2), 4).getValues();
  if (values.length === 0) return;
  var rows = values.map(function (r) {
    // country, name, position, email, phone, pa_name, pa_phone, ea_name, ea_phone
    return [r[0], r[2], r[3], "", "", "", "", "", ""];
  });
  contacts.getRange(3, 1, rows.length, 9).setValues(rows);
  for (var i = 0; i < rows.length; i++) {
    if (i % 2 === 1) {
      contacts.getRange(3 + i, 1, 1, 9).setBackground(BRAND.lightGrey);
    }
  }
}

function buildYearRows(fromY, toY, fn) {
  var out = [];
  for (var y = fromY; y <= toY; y++) out.push(fn(y));
  return out;
}
