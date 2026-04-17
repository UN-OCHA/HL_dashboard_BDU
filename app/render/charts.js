/**
 * render/charts.js — Wires the 4 characteristic charts (Page 3) +
 * 2 long-term trend charts (Page 4) to their data.
 */

/* global RenderCharts:true, ChartHbar, ChartDonut, ChartLine, HLConfig */

var RenderCharts = (function () {
  "use strict";

  function render(state) {
    renderCountryByGrade(state);
    renderGenderByGrade(state);
    renderRoles(state);
    renderAgency(state);
    renderGenderTrends(state);
    renderRegionTrends(state);
  }

  /* PPT slide 3 — Country of origin, grade × region. */
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
      mode: "grouped"
    });
    injectLegend(el, [
      { label: "WEOG",     color: cWeog },
      { label: "Non-WEOG", color: cNonWeog }
    ]);
  }

  /* PPT slide 4 — Grade and gender. */
  function renderGenderByGrade(state) {
    var el = document.getElementById("chart-gender-by-grade");
    if (!el) return;
    var data = (state.gender_by_grade || []).map(function (r) {
      return { label: r.grade, values: { female: r.female, male: r.male } };
    });
    var cFemale = "#009EDB"; // UN Blue
    var cMale   = "#002E6E"; // Navy
    ChartHbar.render(el, {
      data: data,
      series: [
        { key: "female", label: "Female", color: cFemale },
        { key: "male",   label: "Male",   color: cMale }
      ],
      mode: "grouped"
    });
    injectLegend(el, [
      { label: "Female", color: cFemale },
      { label: "Male",   color: cMale }
    ]);
  }

  function renderRoles(state) {
    var el = document.getElementById("chart-roles");
    if (!el) return;
    // OCHA rule: pie/donut max 5 slices (top 4 + Others). Collapse long tail.
    var data = topNWithOthers(state.roles_donut || [], 4);
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    // Single-hue: UN Blue ramp (dark → light) across the slices, largest dark.
    // Keeps the page-3 palette monochromatic as requested.
    var BLUE_RAMP = ["#002E6E", "#0074B7", "#009EDB", "#64BDEA", "#C5DFEF"];
    var colors = data.map(function (_, i) { return BLUE_RAMP[i % BLUE_RAMP.length]; });
    ChartDonut.render(el, {
      data: data,
      colors: colors,
      centerValue: String(total),
      centerLabel: "Total leaders",
      directLabels: true      // per OCHA — prefer direct labels over legend
    });
    // Donut places direct labels only when they don't collide. When
    // they would overlap it sets data-used-legend-fallback="1" on the
    // <svg> root; we then inject an OCHA-styled legend above the chart.
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

  function renderAgency(state) {
    var el = document.getElementById("chart-agency");
    if (!el) return;
    // Agency usually has 6-8 categories — far beyond OCHA's donut limit (5 slices).
    // Render as horizontal bar with all agencies sorted by count, OCHA Blue.
    var data = (state.agency_donut || [])
      .slice()
      .sort(function (a, b) { return b.value - a.value; });
    var hbar = data.map(function (d) {
      return { label: cleanAgencyName(d.label), values: { v: d.value } };
    });
    ChartHbar.render(el, {
      data: hbar,
      series: [{ key: "v", label: "Leaders", color: "#009EDB" }],
      mode: "grouped"
    });
    // No legend — single-series bars are self-evident.
    removeLegend(el);
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
    // Insert after the title <h3> so the legend sits between title and chart.
    var title = card.querySelector("h3");
    if (title && title.nextSibling) {
      card.insertBefore(leg, title.nextSibling);
    } else {
      card.appendChild(leg);
    }
  }

  return { render: render };
})();
