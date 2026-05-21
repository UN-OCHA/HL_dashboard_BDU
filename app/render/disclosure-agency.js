/**
 * render/disclosure-agency.js
 * ──────────────────────────────────────────────────────────────────────────
 * Click-driven drill-down for the agency-of-origin chart (Page 3, Fig 3.4).
 *
 * When the user clicks the "Other" bar on the agency hbar chart, this
 * module derives the list of agencies aggregated into that bucket from
 * the per-leader roster (Tab 9, the leaders array on `state`) and renders
 * a small disclosure panel inside the chart card.
 *
 * Data source contract:
 *   · state.leaders[i].agency  — leader's agency of origin (from Tab 9)
 *   · state.agency_donut       — the curated buckets shown on the chart
 *
 * Anything in state.leaders whose CLEANED agency name doesn't match one
 * of the explicit (non-"Other") buckets is counted toward "Other".
 *
 * If state.leaders is missing agency data for some leaders (Tab 9 not
 * fully enriched yet), the panel flags the gap explicitly so it's clear
 * the list is partial — never silently misleading.
 */

/* global DisclosureAgency:true */

var DisclosureAgency = (function () {
  "use strict";

  // Same canonicalisation as render/charts.js → keep in sync. Short form
  // is what appears on the chart's bars; we match against it.
  function cleanAgencyName(s) {
    var t = String(s || "").trim();
    if (!t) return "";
    var swap = {
      "United Nations Development Programme - UNDP": "UNDP",
      "High Commissioner for Refugees": "UNHCR",
      "United Nations Relief and Works Agency for Palestine Refugees in the Near East": "UNRWA",
      "United Nations Relief and Works Agency": "UNRWA",
      "World Food Programme": "WFP",
      "United Nations Populations Fund": "UNFPA",
      "United Nations Population Fund": "UNFPA",
      "Office of the United Nations High Commissioner for Human Rights": "OHCHR",
      "UN-Women": "UN-Women",
      "UNAIDS": "UNAIDS",
      "UNV": "UNV",
      "UNICEF": "UNICEF",
      "OCHA": "OCHA",
      "DPPA": "DPPA"
    };
    return swap[t] || t;
  }

  /**
   * Compute the breakdown of the "Other" bucket.
   *
   * @param {object} state — global state (state.leaders + state.agency_donut)
   * @returns {{
   *   namedBuckets: string[],       // bucket labels shown on the chart (excl. "Other")
   *   otherCountFromChart: number,  // total "Other" reported on the chart
   *   breakdown: Array<{label: string, count: number, names: string[]}>,
   *   countedLeaders: number,       // how many of the cohort had an agency we read
   *   unknownLeaders: string[]      // leader names with no agency in Tab 9
   * }}
   */
  function compute(state) {
    var leaders  = state.leaders || [];
    var donut    = state.agency_donut || [];
    var namedBuckets = donut
      .map(function (d) { return String(d.label || "").trim(); })
      .filter(function (l) { return l && l.toLowerCase() !== "other"; });
    var otherRow = donut.find(function (d) {
      return String(d.label || "").trim().toLowerCase() === "other";
    });
    var otherCountFromChart = otherRow ? Number(otherRow.value || 0) : 0;

    var bucketsLower = namedBuckets.map(function (l) { return l.toLowerCase(); });
    var groups = Object.create(null);   // cleanedAgency → { count, names: [] }
    var unknownLeaders = [];
    var countedLeaders = 0;

    leaders.forEach(function (lead) {
      // OiC arrangements are listed in the Page 5 directory table but
      // EXCLUDED from the charts (per the PPT footnote: "OiC
      // arrangements listed here are not included in the charts and
      // figures highlighted in the previous pages.") So we also exclude
      // them here — otherwise the breakdown's total would exceed the
      // chart's "Other" count when OiC leaders happen to be in Other.
      var pos = String(lead.position || "").toLowerCase();
      if (pos.indexOf("oic") !== -1) return;

      var raw = lead.agency || "";
      if (!raw || String(raw).trim() === "") {
        unknownLeaders.push(lead.name || "(unnamed)");
        return;
      }
      countedLeaders += 1;
      var cleaned = cleanAgencyName(raw);
      // Skip leaders whose agency IS one of the explicit chart buckets —
      // they're not in "Other".
      if (bucketsLower.indexOf(cleaned.toLowerCase()) !== -1) return;
      if (!groups[cleaned]) groups[cleaned] = { count: 0, names: [] };
      groups[cleaned].count += 1;
      if (lead.name) groups[cleaned].names.push(lead.name);
    });

    var breakdown = Object.keys(groups).map(function (k) {
      return { label: k, count: groups[k].count, names: groups[k].names };
    }).sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

    return {
      namedBuckets: namedBuckets,
      otherCountFromChart: otherCountFromChart,
      breakdown: breakdown,
      countedLeaders: countedLeaders,
      unknownLeaders: unknownLeaders
    };
  }

  /**
   * Render (or update) the disclosure panel inside the agency chart card.
   * If `isOpen` is false the panel is hidden but the DOM stays around so
   * a future click re-opens cheaply.
   */
  function render(state, isOpen) {
    var panel = document.getElementById("chart-agency-disclosure");
    if (!panel) return;
    panel.hidden = !isOpen;
    panel.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (!isOpen) return;

    var info = compute(state);
    var sumCounted = info.breakdown.reduce(function (s, g) { return s + g.count; }, 0);
    var partial = sumCounted < info.otherCountFromChart;

    // Build markup
    var headerNote = partial
      ? sumCounted + " of " + info.otherCountFromChart + " leaders shown — "
        + info.unknownLeaders.length + " not yet enriched in Tab 9"
      : sumCounted + " leaders, " + info.breakdown.length + " agencies";

    var rows = info.breakdown.map(function (g) {
      // Tooltip on the count cell shows the leader names for context.
      var titleAttr = g.names.length ? ' title="' + escapeHtml(g.names.join(", ")) + '"' : '';
      return '<dt class="agency-name">' + escapeHtml(g.label) + '</dt>'
           + '<dd class="agency-count"' + titleAttr + '>' + g.count + '</dd>';
    }).join("");

    panel.innerHTML =
      '<div class="chart-disclosure__head">' +
        '<span class="chart-disclosure__kicker">What\'s in &ldquo;Other&rdquo;</span>' +
        '<span class="chart-disclosure__meta">' + headerNote + '</span>' +
        '<button type="button" class="chart-disclosure__close" aria-label="Close">&times;</button>' +
      '</div>' +
      (info.breakdown.length
        ? '<dl class="chart-disclosure__list">' + rows + '</dl>'
        : '<p class="chart-disclosure__empty">No agency data available yet — Tab 9 needs enrichment first.</p>');

    var closeBtn = panel.querySelector(".chart-disclosure__close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        render(state, false);
      });
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return { compute: compute, render: render };
})();
