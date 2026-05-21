/**
 * aggregate.js — Page 3 client-side aggregation engine.
 * ──────────────────────────────────────────────────────────────────────────
 * Takes the raw per-leader roster (Tab 9, surfaced as `state.leaders`) and
 * produces the four chart data shapes the Page 3 renderers consume:
 *
 *   · roles_donut       — [{label, value}, …]   (Fig 3.3)
 *   · agency_donut      — [{label, value}, …]   (Fig 3.4)
 *   · country_by_grade  — [{grade, weog, non_weog}, …]   (Fig 3.1)
 *   · gender_by_grade   — [{grade, female, male}, …]     (Fig 3.2)
 *
 * Plus the cohort KPIs:
 *
 *   · cohort_kpis       — { total, pct_female, pct_underrepresented,
 *                           deputy_hcs, countries }
 *
 * Filter object shape (all optional, AND-combined):
 *
 *   { gender:  "Female" | "Male"
 *   , weog:    "WEOG"   | "Non-WEOG"
 *   , role:    "RC/HC"  | "DSRSG/RC/HC" | "DSC/RC/HC" | "Deputy HC"
 *   , agency:  string (cleaned short name — UNDP, UNICEF, OCHA, WFP, "Other", or any specific full agency)
 *   , grade:   "ASG" | "D2" | "D1"
 *   }
 *
 * Cohort policy
 * -------------
 * The analytical cohort is Tab 9 EXCLUDING OiC leaders (per the PPT
 * footnote: "OiC arrangements listed here are not included in the
 * charts and figures highlighted in the previous pages."). All
 * counts here are over the non-OiC cohort. Filtering further narrows
 * within that cohort.
 *
 * Sanity check
 * ------------
 * When called with an empty filter, the four chart outputs should
 * match the values in the pre-aggregated tabs (state.roles_donut,
 * state.agency_donut, state.country_by_grade, state.gender_by_grade).
 * Discrepancies are LIKELY due to incomplete Tab 9 enrichment, not
 * engine bugs — see `Aggregate.diffVsPreaggregated(state)` which
 * prints a row-by-row comparison to the console.
 */

/* global Aggregate:true */

var Aggregate = (function () {
  "use strict";

  // ── Constants ─────────────────────────────────────────────────────

  // Roles donut canonical labels. The engine groups by `position` and
  // collapses every non-canonical position (e.g. "RC/HC a.i.") into
  // the closest canonical bucket.
  var ROLE_LABELS = ["RC/HC", "DSRSG/RC/HC", "DSC/RC/HC", "Deputy HC"];

  // Agency hbar canonical labels — these are the EXPLICIT chart buckets;
  // everything else rolls up into "Other".
  var AGENCY_CHART_BUCKETS = ["UNDP", "UNICEF", "OCHA", "WFP"];

  // UN grade order for the by-grade charts.
  var GRADES = ["ASG", "D2", "D1"];

  // Agency name canonicalisation. Keep in sync with
  // render/charts.js#cleanAgencyName + render/disclosure-agency.js.
  var AGENCY_SHORT = {
    "United Nations Development Programme - UNDP": "UNDP",
    "High Commissioner for Refugees": "UNHCR",
    "United Nations Relief and Works Agency for Palestine Refugees in the Near East": "UNRWA",
    "United Nations Relief and Works Agency": "UNRWA",
    "World Food Programme": "WFP",
    "United Nations Populations Fund": "UNFPA",
    "United Nations Population Fund": "UNFPA",
    "Office of the United Nations High Commissioner for Human Rights": "OHCHR"
    // Single-word names map to themselves: UNICEF, OCHA, UNAIDS, UNV, DPPA, UN-Women, …
  };

  function cleanAgency(s) {
    var t = String(s || "").trim();
    if (!t) return "";
    return AGENCY_SHORT[t] || t;
  }

  // Collapse non-canonical position strings to a canonical role label.
  // Examples:
  //   "RC/HC a.i."  → "RC/HC"
  //   "RC/HC OiC"   → "RC/HC"   (but OiC leaders are excluded upstream)
  //   "DSRSG/RC"    → "DSRSG/RC/HC"  (rare partial-string match)
  //   anything else → ""        (uncategorised; not counted in donut)
  function canonicalRole(positionStr) {
    var p = String(positionStr || "").trim();
    if (!p) return "";
    // Test in specificity order — most specific prefix wins.
    if (/^DSRSG\b/.test(p)) return "DSRSG/RC/HC";
    if (/^DSC\b/.test(p))   return "DSC/RC/HC";
    if (/^Deputy\s*HC/i.test(p) || /^DHC/.test(p)) return "Deputy HC";
    if (/^RC\/HC\b/.test(p) || /^RC\b/.test(p) || /^HC\b/.test(p)) return "RC/HC";
    return "";
  }

  // True if a leader is in the analytical cohort (excludes OiC).
  function isInCohort(lead) {
    var pos = String(lead.position || "").toLowerCase();
    return pos.indexOf("oic") === -1;
  }

  // ── Filter matching ───────────────────────────────────────────────

  /**
   * Does a leader match every clause of the filter? Each clause is
   * compared case-insensitively. Empty / undefined clauses pass.
   */
  function matchesFilter(lead, filter) {
    if (!filter) return true;
    if (filter.gender && !ieq(lead.gender, filter.gender))      return false;
    if (filter.weog   && !ieq(lead.weog,   filter.weog))        return false;
    if (filter.grade  && !ieq(lead.grade,  filter.grade))       return false;
    if (filter.role) {
      var canonical = canonicalRole(lead.position);
      if (!ieq(canonical, filter.role)) return false;
    }
    if (filter.agency) {
      var leadAg = cleanAgency(lead.agency);
      var f = String(filter.agency).trim();
      if (ieq(f, "Other")) {
        // "Other" = anything NOT in the explicit chart buckets, AND has
        // some non-empty agency value (unknowns don't count).
        if (!leadAg) return false;
        var isNamed = AGENCY_CHART_BUCKETS.some(function (b) { return ieq(leadAg, b); });
        if (isNamed) return false;
      } else if (!ieq(leadAg, f)) {
        return false;
      }
    }
    return true;
  }

  function ieq(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  }

  // ── Chart-data builders ───────────────────────────────────────────

  /** Roles donut from filtered leaders. */
  function rolesDonut(leaders) {
    var counts = { "RC/HC": 0, "DSRSG/RC/HC": 0, "DSC/RC/HC": 0, "Deputy HC": 0 };
    leaders.forEach(function (lead) {
      var role = canonicalRole(lead.position);
      if (role && counts.hasOwnProperty(role)) counts[role] += 1;
    });
    return ROLE_LABELS
      .map(function (lbl) { return { label: lbl, value: counts[lbl] }; })
      .filter(function (d) { return d.value > 0; });
  }

  /** Agency hbar from filtered leaders — explicit buckets + "Other". */
  function agencyDonut(leaders) {
    var explicit = {};
    AGENCY_CHART_BUCKETS.forEach(function (b) { explicit[b] = 0; });
    var other = 0;
    leaders.forEach(function (lead) {
      var ag = cleanAgency(lead.agency);
      if (!ag) return;   // unknown agency — skip (don't count toward Other)
      var matched = false;
      for (var i = 0; i < AGENCY_CHART_BUCKETS.length; i++) {
        if (ieq(ag, AGENCY_CHART_BUCKETS[i])) {
          explicit[AGENCY_CHART_BUCKETS[i]] += 1;
          matched = true;
          break;
        }
      }
      if (!matched) other += 1;
    });
    var out = AGENCY_CHART_BUCKETS
      .map(function (b) { return { label: b, value: explicit[b] }; })
      .filter(function (d) { return d.value > 0; });
    if (other > 0) out.push({ label: "Other", value: other });
    return out;
  }

  /** Country-of-origin × grade — WEOG vs Non-WEOG per grade. */
  function countryByGrade(leaders) {
    // grade → { weog, non_weog }
    var by = {};
    GRADES.forEach(function (g) { by[g] = { weog: 0, non_weog: 0 }; });
    leaders.forEach(function (lead) {
      var g = String(lead.grade || "").trim().toUpperCase();
      if (!by[g]) return;
      var w = String(lead.weog || "").trim().toLowerCase();
      if (w === "weog") by[g].weog += 1;
      else if (w === "non-weog" || w === "non weog") by[g].non_weog += 1;
    });
    return GRADES.map(function (g) {
      return { grade: g, weog: by[g].weog, non_weog: by[g].non_weog };
    });
  }

  /** Gender × grade — Female vs Male per grade. */
  function genderByGrade(leaders) {
    var by = {};
    GRADES.forEach(function (g) { by[g] = { female: 0, male: 0 }; });
    leaders.forEach(function (lead) {
      var g = String(lead.grade || "").trim().toUpperCase();
      if (!by[g]) return;
      var gn = String(lead.gender || "").trim().toLowerCase();
      if (gn === "female" || gn[0] === "f") by[g].female += 1;
      else if (gn === "male" || gn[0] === "m") by[g].male += 1;
    });
    return GRADES.map(function (g) {
      return { grade: g, female: by[g].female, male: by[g].male };
    });
  }

  /** Cohort-level KPI numbers from filtered leaders. */
  function cohortKpis(leaders) {
    var total = leaders.length;
    var female = leaders.filter(function (l) { return /^f/i.test(l.gender || ""); }).length;
    var nonWeog = leaders.filter(function (l) {
      var w = String(l.weog || "").toLowerCase();
      return w === "non-weog" || w === "non weog";
    }).length;
    var deputies = leaders.filter(function (l) {
      return canonicalRole(l.position) === "Deputy HC";
    }).length;
    var countries = {};
    leaders.forEach(function (l) {
      var c = String(l.country || "").trim();
      if (c) countries[c] = true;
    });
    return {
      total:                  total,
      pct_female:             total ? Math.round((female  / total) * 100) : 0,
      pct_underrepresented:   total ? Math.round((nonWeog / total) * 100) : 0,
      deputy_hcs:             deputies,
      countries:              Object.keys(countries).length
    };
  }

  // ── Public entry point ────────────────────────────────────────────

  /**
   * Aggregate the per-leader roster into the four Page-3 chart shapes
   * + the cohort KPIs, applying the given filter (default: no filter).
   *
   * @param {object} state   — full state, used to read state.leaders
   * @param {object} filter  — optional filter clauses (see top of file)
   * @returns {{
   *   leaders: Array,
   *   cohort_kpis: object,
   *   roles_donut: Array,
   *   agency_donut: Array,
   *   country_by_grade: Array,
   *   gender_by_grade: Array
   * }}
   */
  function run(state, filter) {
    var all = (state && state.leaders) || [];
    var cohort = all.filter(isInCohort);              // exclude OiC
    var filtered = cohort.filter(function (l) { return matchesFilter(l, filter); });
    return {
      leaders:          filtered,
      cohort_kpis:      cohortKpis(filtered),
      roles_donut:      rolesDonut(filtered),
      agency_donut:     agencyDonut(filtered),
      country_by_grade: countryByGrade(filtered),
      gender_by_grade:  genderByGrade(filtered)
    };
  }

  // ── Sanity-check helper ───────────────────────────────────────────

  /**
   * Compare the engine's no-filter output against the pre-aggregated
   * tabs already on `state`. Returns a structured diff and also
   * console.table()s the result so you can eyeball it in DevTools.
   *
   * Intended for development only — call it from the console:
   *
   *     Aggregate.diffVsPreaggregated(window.__HL_STATE__);
   */
  function diffVsPreaggregated(state) {
    if (!state) return null;
    var derived = run(state, {});
    var diff = {
      roles_donut:      diffArrayBy("label", derived.roles_donut,     state.roles_donut      || []),
      agency_donut:     diffArrayBy("label", derived.agency_donut,    state.agency_donut     || []),
      country_by_grade: diffByGrade(derived.country_by_grade,         state.country_by_grade || [], ["weog","non_weog"]),
      gender_by_grade:  diffByGrade(derived.gender_by_grade,          state.gender_by_grade  || [], ["female","male"])
    };
    if (typeof console !== "undefined" && console.group) {
      console.group("[HL Aggregate] derived vs pre-aggregated");
      Object.keys(diff).forEach(function (k) {
        console.log(k, diff[k]);
      });
      console.groupEnd();
    }
    return diff;
  }

  function diffArrayBy(key, derived, preagg) {
    var rows = [];
    var keys = {};
    derived.forEach(function (d) { keys[d[key]] = true; });
    preagg.forEach(function (d)  { keys[d[key]] = true; });
    Object.keys(keys).forEach(function (k) {
      var d = derived.find(function (r) { return r[key] === k; }) || { value: 0 };
      var p = preagg.find(function (r)  { return r[key] === k; }) || { value: 0 };
      rows.push({ label: k, derived: d.value, preagg: p.value, delta: d.value - p.value });
    });
    return rows;
  }

  function diffByGrade(derived, preagg, fields) {
    var rows = [];
    GRADES.forEach(function (g) {
      var d = derived.find(function (r) { return r.grade === g; }) || {};
      var p = preagg.find(function (r)  { return r.grade === g; }) || {};
      var row = { grade: g };
      fields.forEach(function (f) {
        row["derived_" + f] = d[f] || 0;
        row["preagg_"  + f] = p[f] || 0;
        row["delta_"   + f] = (d[f] || 0) - (p[f] || 0);
      });
      rows.push(row);
    });
    return rows;
  }

  return {
    run:                  run,
    diffVsPreaggregated:  diffVsPreaggregated,
    // Exposed for tests / future modules:
    cleanAgency:          cleanAgency,
    canonicalRole:        canonicalRole,
    isInCohort:           isInCohort,
    matchesFilter:        matchesFilter,
    AGENCY_CHART_BUCKETS: AGENCY_CHART_BUCKETS,
    GRADES:               GRADES,
    ROLE_LABELS:          ROLE_LABELS
  };
})();
