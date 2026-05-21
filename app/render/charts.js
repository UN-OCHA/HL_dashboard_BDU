/**
 * render/charts.js — Wires the 4 characteristic charts (Page 3) +
 * 2 long-term trend charts (Page 4) to their data.
 */

/* global RenderCharts:true, ChartHbar, ChartDonut, ChartLine, HLConfig,
          DisclosureAgency, FilterBar, Aggregate */

var RenderCharts = (function () {
  "use strict";

  function render(state) {
    // Page 3 charts respect the chip-bar filter. When no filter is
    // active, Page 3 still renders from the curated pre-aggregated
    // tabs (Valijon's truth, no Tab 9 data gaps). When ≥ 1 filter is
    // active, we compute via Aggregate.run() — uses the partial
    // Tab 9 data, which is acceptable since the user explicitly
    // narrowed the cohort.
    var effective = applyPage3Filter(state);
    renderCountryByGrade(effective);
    renderGenderByGrade(effective);
    renderRoles(effective);
    renderAgency(effective);
    // Page 4 trends never react to filters (long-term institutional
    // arc — not a "cohort slice" lens). Always render from raw state.
    renderGenderTrends(state);
    renderRegionTrends(state);
  }

  /**
   * Return a state-shaped object where the four Page 3 chart data
   * arrays are derived from Aggregate.run() if a filter is active.
   * Leaves all other state untouched (state.leaders is replaced with
   * the filtered subset so DisclosureAgency's tooltip reflects the
   * current view).
   */
  function applyPage3Filter(state) {
    if (typeof FilterBar === "undefined" || FilterBar.isEmpty()) return state;
    var filter  = FilterBar.get();
    var derived = Aggregate.run(state, filter);
    return Object.assign({}, state, {
      country_by_grade: derived.country_by_grade,
      gender_by_grade:  derived.gender_by_grade,
      roles_donut:      derived.roles_donut,
      agency_donut:     derived.agency_donut,
      leaders:          derived.leaders
    });
  }

  // ── Click → filter helper. Routes a chart-click to the chip bar,
  //    which handles toggle semantics + chip-UI sync + dispatch of
  //    `hl:filterchange`. Page 3 charts use this for cross-filtering.
  function dispatchFilter(key, value) {
    if (typeof FilterBar === "undefined") return;
    var st = window.__HL_STATE__;
    FilterBar.toggle(st, key, value);
  }

  /* PPT slide 3 — Country of origin, grade × region.
     Click any WEOG / Non-WEOG bar → toggle the `weog` filter clause. */
  function renderCountryByGrade(state) {
    var el = document.getElementById("chart-country-by-grade");
    if (!el) return;
    var data = (state.country_by_grade || []).map(function (r) {
      return { label: r.grade, values: { weog: r.weog, non_weog: r.non_weog } };
    });
    var cWeog    = "#002E6E"; // Navy
    var cNonWeog = "#009EDB"; // UN Blue
    ChartHbar.render(el, {
      data: data,
      series: [
        { key: "weog",     label: "WEOG",     color: cWeog },
        { key: "non_weog", label: "Non-WEOG", color: cNonWeog }
      ],
      mode: "grouped",
      onSegmentClick: function (info) {
        // info.seriesLabel is "WEOG" or "Non-WEOG" — the filter value.
        dispatchFilter("weog", info.seriesLabel);
      }
    });
    injectLegend(el, [
      { label: "WEOG",     color: cWeog },
      { label: "Non-WEOG", color: cNonWeog }
    ]);
  }

  /* PPT slide 4 — Grade and gender.
     Click any Female / Male bar → toggle the `gender` filter clause.
     Distinct blue duo from Fig 3.1 (which uses navy + signature UN Blue)
     so the eye instantly knows which chart it's reading: country/origin
     uses the deepest pair, gender uses a mid + light pair. Stays
     entirely within OCHA's UN Blue ramp per brand guidance. */
  function renderGenderByGrade(state) {
    var el = document.getElementById("chart-gender-by-grade");
    if (!el) return;
    var data = (state.gender_by_grade || []).map(function (r) {
      return { label: r.grade, values: { female: r.female, male: r.male } };
    });
    var cFemale = "#0074B7"; // UN Blue ramp step 3 (mid-dark)
    var cMale   = "#64BDEA"; // UN Blue ramp step 5 (light)
    ChartHbar.render(el, {
      data: data,
      series: [
        { key: "female", label: "Female", color: cFemale },
        { key: "male",   label: "Male",   color: cMale }
      ],
      mode: "grouped",
      onSegmentClick: function (info) {
        dispatchFilter("gender", info.seriesLabel);
      }
    });
    injectLegend(el, [
      { label: "Female", color: cFemale },
      { label: "Male",   color: cMale }
    ]);
  }

  /* Roles donut — click a slice → toggle the `role` filter clause. */
  function renderRoles(state) {
    var el = document.getElementById("chart-roles");
    if (!el) return;
    // OCHA rule: pie/donut max 5 slices (top 4 + Others). Collapse long tail.
    var data = topNWithOthers(state.roles_donut || [], 4);
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    var BLUE_RAMP = ["#002E6E", "#0074B7", "#009EDB", "#64BDEA", "#C5DFEF"];
    var colors = data.map(function (_, i) { return BLUE_RAMP[i % BLUE_RAMP.length]; });
    ChartDonut.render(el, {
      data: data,
      colors: colors,
      centerValue: String(total),
      centerLabel: "Total leaders",
      directLabels: true,
      onSegmentClick: function (info) {
        // info.label is the canonical role string ("RC/HC", "DSRSG/RC/HC", …)
        // — same vocabulary the chip dropdown uses. "Others" is a
        // collapsed bucket from topNWithOthers() and isn't a real
        // filter value, so ignore clicks on it.
        if (!info.label || info.label.toLowerCase() === "others") return;
        dispatchFilter("role", info.label);
      }
    });
    var svg = el.querySelector("svg");
    if (svg && svg.getAttribute("data-used-legend-fallback") === "1") {
      injectLegend(el, data.map(function (d, i) {
        var pct = total ? Math.round((d.value / total) * 100) + "%" : "";
        return { label: d.label + " · " + pct, color: colors[i % colors.length] };
      }));
    } else {
      removeLegend(el);
    }
  }

  /* Agency hbar — click a bar → toggle the `agency` filter clause. */
  function renderAgency(state) {
    var el = document.getElementById("chart-agency");
    if (!el) return;
    var data = (state.agency_donut || [])
      .slice()
      .sort(function (a, b) { return b.value - a.value; });
    var hbar = data.map(function (d) {
      return { label: cleanAgencyName(d.label), values: { v: d.value } };
    });
    ChartHbar.render(el, {
      data: hbar,
      series: [{ key: "v", label: "Leaders", color: "#009EDB" }],
      mode: "grouped",
      // Row click toggles the agency filter. Hovering "Other" still
      // shows the breakdown tooltip via DisclosureAgency.attach()
      // below — the two interactions are independent.
      onBarClick: function (info) {
        if (!info.label) return;
        dispatchFilter("agency", info.label);
      }
    });
    removeLegend(el);
    DisclosureAgency.attach(state);
  }

  // Collapse a categorical distribution to top-N plus an aggregated "Others"
  // bucket — implements OCHA's "max 5 slices" pie/donut rule.
  function topNWithOthers(rows, n) {
    var sorted = rows.slice().sort(function (a, b) { return b.value - a.value; });
    if (sorted.length <= n + 1) return sorted;
    var head = sorted.slice(0, n);
    var tail = sorted.slice(n);
    var other = tail.reduce(function (s, d) { return s + d.value; }, 0);
    if (other > 0) head.push({ label: "Others", value: other });
    return head;
  }

  // Shorten long UN agency names for compact hbar labels.
  function cleanAgencyName(s) {
    var t = String(s || "").trim();
    if (!t || t === "—") return "Unknown";
    var swap = {
      "United Nations Development Programme - UNDP": "UNDP",
      "High Commissioner for Refugees": "UNHCR",
      "United Nations Relief and Works Agency for Palestine Refugees in the Near East": "UNRWA",
      "World Food Programme": "WFP",
      "UN-Women": "UN-Women"
    };
    return swap[t] || t;
  }

  function removeLegend(chartEl) {
    var card = chartEl.closest(".chart-card");
    if (!card) return;
    var existing = card.querySelector(".chart-legend");
    if (existing) existing.parentNode.removeChild(existing);
  }

  function renderGenderTrends(state) {
    var el = document.getElementById("chart-gender-trends");
    if (!el) return;
    // 100 % stacked thin columns, shades of blue. With end-of-line
    // direct labels (last-year %) we no longer need a legend.
    var series = [
      { key: "female_pct", label: "Female", color: "#009EDB" }, // UN Blue
      { key: "male_pct",   label: "Male",   color: "#002E6E" }  // Navy
    ];
    ChartStackedCol.render(el, {
      data: state.gender_trends || [],
      series: series
    });
    removeLegend(el);
  }

  function renderRegionTrends(state) {
    var el = document.getElementById("chart-region-trends");
    if (!el) return;
    // Short region labels for the end-of-line direct label, so we don't
    // need a long string hanging off the chart's right edge.
    var SHORT = {
      africa: "Africa", apac: "Asia-Pac", eeur: "E. Europe",
      lac: "LAC",       weog: "WEOG"
    };
    var keys = ["weog", "lac", "eeur", "apac", "africa"]; // draw order bottom→top
    var series = keys.map(function (k) {
      return {
        key: k + "_pct",
        label: SHORT[k] || HLConfig.REGION_LABELS[k],
        color: HLConfig.REGION_COLORS[k]
      };
    });
    ChartStackedCol.render(el, {
      data: state.region_trends || [],
      series: series
    });
    removeLegend(el);
  }

  /* Place a small legend inside the same .chart-card as `chartEl`, directly
     beneath the <h3> title (per the design direction). */
  function injectLegend(chartEl, items) {
    var card = chartEl.closest(".chart-card");
    if (!card) return;
    var existing = card.querySelector(".chart-legend");
    if (existing) existing.parentNode.removeChild(existing);
    var leg = document.createElement("div");
    leg.className = "chart-legend";
    items.forEach(function (it) {
      var s = document.createElement("span");
      var sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = it.color;
      s.appendChild(sw);
      s.appendChild(document.createTextNode(it.label));
      leg.appendChild(s);
    });
    // Insert AFTER the head row so the legend sits between title and
    // chart. The anchor MUST be a direct child of `card`, otherwise
    // insertBefore throws ("not a child of this node") — using
    // :scope guards against the title being nested inside a wrapper.
    var anchor = card.querySelector(":scope > .chart-card__head");
    if (anchor && anchor.nextSibling) {
      card.insertBefore(leg, anchor.nextSibling);
    } else {
      card.appendChild(leg);
    }
  }

  return { render: render };
})();
