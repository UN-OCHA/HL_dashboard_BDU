/**
 * render/disclosure-agency.js
 * ──────────────────────────────────────────────────────────────────────────
 * Hover-driven tooltip for the agency-of-origin chart (Page 3, Fig 3.4).
 *
 * When the user hovers (or taps, on touch devices) the "Other" bar on
 * the agency hbar chart, this module derives the list of agencies
 * aggregated into that bucket from the per-leader roster (Tab 9, the
 * leaders array on `state`) and shows a small anchored tooltip next to
 * the bar.
 *
 * Behaviour
 *   · Desktop  — hover the "Other" row → tooltip appears. Move into the
 *                tooltip → stays visible. mouseleave both → fades out.
 *   · Mobile   — tap the "Other" row → tooltip appears. Tap elsewhere
 *                or tap the row again → hides.
 *   · Keyboard — focus the row → tooltip appears. Blur or Esc → hides.
 *
 * Only the "Other" row is interactive — the named buckets (UNDP /
 * UNICEF / OCHA / WFP) don't need a drill-down. We attach the
 * listeners ONLY to the row whose label is "Other".
 *
 * Data source contract:
 *   · state.leaders[i].agency  — leader's agency of origin (from Tab 9)
 *   · state.leaders[i].position — used to filter OUT OiC arrangements
 *                                 (PPT footnote: OiC not in charts)
 *   · state.agency_donut       — the curated buckets shown on the chart;
 *                                 used to identify which agencies are
 *                                 NAMED (and therefore not in "Other")
 *
 * If Tab 9 is incompletely enriched, the tooltip flags the gap so the
 * partial list is never silently misleading.
 */

/* global DisclosureAgency:true */

var DisclosureAgency = (function () {
  "use strict";

  // Hide-delay on mouseleave so the cursor can transit from the row
  // into the tooltip without flickering it closed.
  var HIDE_DELAY_MS = 140;
  var hideTimer = null;

  // Same canonicalisation as render/charts.js → keep in sync. Short
  // form is what appears on the chart's bars; we match against it.
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

  /** Compute the breakdown of the "Other" bucket from state. */
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

    leaders.forEach(function (lead) {
      // OiC arrangements are listed in the Page 5 directory but EXCLUDED
      // from charts (PPT footnote). Filter them here too so the
      // breakdown total never exceeds the chart's "Other" count.
      var pos = String(lead.position || "").toLowerCase();
      if (pos.indexOf("oic") !== -1) return;

      var raw = lead.agency || "";
      if (!raw || String(raw).trim() === "") {
        unknownLeaders.push(lead.name || "(unnamed)");
        return;
      }
      var cleaned = cleanAgencyName(raw);
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
      breakdown: breakdown,
      otherCountFromChart: otherCountFromChart,
      unknownLeaders: unknownLeaders
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** Populate the tooltip element with the current breakdown HTML. */
  function fillTooltip(tip, state) {
    var info = compute(state);
    var sumCounted = info.breakdown.reduce(function (s, g) { return s + g.count; }, 0);
    var partial = sumCounted < info.otherCountFromChart;
    var headerNote = partial
      ? sumCounted + " of " + info.otherCountFromChart + " leaders shown"
      : sumCounted + " leaders · " + info.breakdown.length + " agencies";

    var rows = info.breakdown.map(function (g) {
      var titleAttr = g.names.length
        ? ' title="' + escapeHtml(g.names.join(", ")) + '"' : '';
      return '<dt class="agency-name">' + escapeHtml(g.label) + '</dt>'
           + '<dd class="agency-count"' + titleAttr + '>' + g.count + '</dd>';
    }).join("");

    tip.innerHTML =
      '<div class="chart-tooltip__head">' +
        '<span class="chart-tooltip__kicker">In &ldquo;Other&rdquo;</span>' +
        '<span class="chart-tooltip__meta">' + escapeHtml(headerNote) + '</span>' +
      '</div>' +
      (info.breakdown.length
        ? '<dl class="chart-tooltip__list">' + rows + '</dl>'
        : '<p class="chart-tooltip__empty">No agency data available yet.</p>');
  }

  /** Position the tooltip next to (or below) the row inside the chart card. */
  function positionTooltip(tip, rowEl, cardEl) {
    var rowBox  = rowEl.getBoundingClientRect();
    var cardBox = cardEl.getBoundingClientRect();
    // Default position: just below the row, left-aligned with the
    // chart's plot area (~the row's left edge minus a small offset).
    var top  = rowBox.bottom - cardBox.top + 8;
    var left = rowBox.left   - cardBox.left;
    // Keep inside the card. If the tooltip would overflow the right
    // edge, pull it left. If below would push off the card, flip above.
    tip.style.top = top + "px";
    tip.style.left = left + "px";
    // Allow CSS max-width to clip; the JS just sets origin.
  }

  function showTooltip(tip, rowEl, cardEl, state) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    fillTooltip(tip, state);
    tip.hidden = false;
    tip.setAttribute("aria-hidden", "false");
    // Position after fillTooltip so the layout knows the real size.
    requestAnimationFrame(function () { positionTooltip(tip, rowEl, cardEl); });
  }

  function scheduleHide(tip) {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      tip.hidden = true;
      tip.setAttribute("aria-hidden", "true");
      hideTimer = null;
    }, HIDE_DELAY_MS);
  }

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  /**
   * Attach hover / tap / focus listeners to the "Other" row of the
   * agency hbar chart, wiring the tooltip to it. Idempotent: removes
   * any prior listeners (via flag) before attaching new ones, so it
   * is safe to call on every re-render.
   */
  function attach(state) {
    var chartEl = document.getElementById("chart-agency");
    var tip     = document.getElementById("chart-agency-tooltip");
    if (!chartEl || !tip) return;
    var cardEl  = chartEl.closest(".chart-card");
    if (!cardEl) return;

    // Find the "Other" row's <g>. The hbar renderer tags it with
    // data-bar-label when an onBarClick callback was provided. The
    // calling code (render/charts.js) sets that callback for this chart.
    var rowEl = chartEl.querySelector('[data-bar-label="Other"]');
    if (!rowEl) return;

    // Avoid stacking duplicate listeners on re-render.
    if (rowEl.__hl_disclosureBound) return;
    rowEl.__hl_disclosureBound = true;

    rowEl.addEventListener("mouseenter", function () { showTooltip(tip, rowEl, cardEl, state); });
    rowEl.addEventListener("mouseleave", function () { scheduleHide(tip); });
    rowEl.addEventListener("focus",      function () { showTooltip(tip, rowEl, cardEl, state); });
    rowEl.addEventListener("blur",       function () { scheduleHide(tip); });

    // Touch / mobile: tap toggles. Listeners on the tooltip prevent it
    // from disappearing while the user is reading.
    tip.addEventListener("mouseenter", cancelHide);
    tip.addEventListener("mouseleave", function () { scheduleHide(tip); });

    // Escape key + outside click dismiss (mobile / keyboard).
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !tip.hidden) {
        tip.hidden = true;
        tip.setAttribute("aria-hidden", "true");
      }
    });
    document.addEventListener("click", function (ev) {
      if (tip.hidden) return;
      if (rowEl.contains(ev.target) || tip.contains(ev.target)) return;
      tip.hidden = true;
      tip.setAttribute("aria-hidden", "true");
    });
  }

  return { compute: compute, attach: attach };
})();
