/**
 * render/filter-bar.js — Page 3 filter chip bar.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Mounts a sticky chip bar at the top of Section 03 (Leadership
 * characteristics). Five dropdown groups:
 *
 *   · Gender   — Female · Male
 *   · Origin   — WEOG · Non-WEOG
 *   · Role     — RC/HC · DSRSG/RC/HC · DSC/RC/HC · Deputy HC
 *   · Grade    — ASG · D2 · D1
 *   · Agency   — UNDP · UNICEF · OCHA · WFP · Other
 *
 * Picking an option in any group narrows the cohort across all four
 * Page 3 charts. Clicking "Clear all" returns to the unfiltered view.
 *
 * State model
 * -----------
 * The current filter is held on `window.__HL_FILTER__`. Mutations
 * dispatch a `hl:filterchange` CustomEvent on `document` which the
 * render pipeline listens for and re-renders Page 3 charts against
 * `Aggregate.run(state, filter)`.
 *
 * When the filter is empty (every clause undefined/null), charts
 * render from the curated pre-aggregated tabs (state.roles_donut,
 * etc.) — Valijon's truth. When ≥1 filter is active, charts render
 * from the engine, which reflects partial Tab 9 data (some leaders
 * not yet enriched). The user-visible discontinuity is acceptable
 * given the data-gap caveat is small + temporary.
 */

/* global FilterBar:true, Aggregate */

var FilterBar = (function () {
  "use strict";

  // ── Chip group definitions ─────────────────────────────────────────
  // Each group has a key (filter clause name), display label, and a
  // list of option values shown in the dropdown.
  var GROUPS = [
    { key: "gender", label: "Gender", options: ["Female", "Male"] },
    { key: "weog",   label: "Origin", options: ["WEOG", "Non-WEOG"] },
    { key: "role",   label: "Role",   options: ["RC/HC", "DSRSG/RC/HC", "DSC/RC/HC", "Deputy HC"] },
    { key: "grade",  label: "Grade",  options: ["ASG", "D2", "D1"] },
    { key: "agency", label: "Agency", options: ["UNDP", "UNICEF", "OCHA", "WFP", "Other"] }
  ];

  // The single source of truth for the current filter.
  // Stored on window so the in-DevTools `Aggregate.run(...)` debug
  // helper can reach it for ad-hoc poking.
  if (typeof window !== "undefined" && !window.__HL_FILTER__) {
    window.__HL_FILTER__ = {};
  }

  /** Initialise the bar: build the DOM, mount, wire events. Called once. */
  function mount(state) {
    var bar = document.getElementById("filter-bar");
    if (!bar) return;

    // Build the chip bar markup.
    bar.innerHTML =
      '<div class="filter-bar__chips" role="group" aria-label="Filter Page 3 charts">' +
        GROUPS.map(renderGroup).join("") +
      '</div>' +
      '<div class="filter-bar__summary" id="filter-summary" hidden>' +
        '<span class="filter-bar__count" id="filter-count"></span>' +
        '<div class="filter-bar__active-chips" id="filter-active-chips" aria-live="polite"></div>' +
        '<button type="button" class="filter-bar__clear" id="filter-clear">Clear all</button>' +
      '</div>';
    bar.hidden = false;

    bindGroupListeners(bar, state);
    bindClearAll(bar);
    bindOutsideClose(bar);
    bindEscapeKey(bar);
    refreshSummary(state);
  }

  function renderGroup(g) {
    return (
      '<div class="filter-chip-group" data-filter-key="' + g.key + '">' +
        '<button type="button" class="filter-chip" aria-expanded="false" aria-haspopup="listbox">' +
          '<span class="filter-chip__label">' + g.label + '</span>' +
          '<span class="filter-chip__value" aria-hidden="true"></span>' +
          '<span class="filter-chip__caret" aria-hidden="true">▾</span>' +
        '</button>' +
        '<ul class="filter-chip__menu" role="listbox" hidden>' +
          g.options.map(function (opt) {
            return (
              '<li role="option" data-value="' + escapeAttr(opt) + '" tabindex="0">' +
                opt +
              '</li>'
            );
          }).join("") +
        '</ul>' +
      '</div>'
    );
  }

  function bindGroupListeners(bar, state) {
    bar.querySelectorAll(".filter-chip-group").forEach(function (group) {
      var key    = group.getAttribute("data-filter-key");
      var button = group.querySelector(".filter-chip");
      var menu   = group.querySelector(".filter-chip__menu");

      // Toggle dropdown
      button.addEventListener("click", function (ev) {
        ev.stopPropagation();
        closeAllMenus(bar, group);
        var isOpen = !menu.hidden;
        menu.hidden = isOpen;
        button.setAttribute("aria-expanded", String(!isOpen));
      });

      // Option select
      menu.querySelectorAll("li").forEach(function (li) {
        li.addEventListener("click", function () { selectOption(state, key, li.getAttribute("data-value"), bar); });
        li.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            selectOption(state, key, li.getAttribute("data-value"), bar);
          }
        });
      });
    });
  }

  function bindClearAll(bar) {
    var btn = bar.querySelector("#filter-clear");
    if (!btn) return;
    btn.addEventListener("click", function () {
      // Use a state we can pull from the page so refreshSummary works.
      var state = window.__HL_STATE__ || {};
      window.__HL_FILTER__ = {};
      bar.querySelectorAll(".filter-chip").forEach(function (c) {
        c.classList.remove("filter-chip--active");
        var v = c.querySelector(".filter-chip__value");
        if (v) v.textContent = "";
      });
      closeAllMenus(bar);
      refreshSummary(state);
      dispatchChange();
    });
  }

  function bindOutsideClose(bar) {
    document.addEventListener("click", function (ev) {
      if (!bar.contains(ev.target)) closeAllMenus(bar);
    });
  }

  function bindEscapeKey(bar) {
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeAllMenus(bar);
    });
  }

  function selectOption(state, key, value, bar) {
    var filter = window.__HL_FILTER__ || {};
    // Toggle off if same value clicked again
    if (filter[key] === value) {
      delete filter[key];
    } else {
      filter[key] = value;
    }
    window.__HL_FILTER__ = filter;

    // Update the chip UI for this group
    var group = bar.querySelector('.filter-chip-group[data-filter-key="' + key + '"]');
    if (group) {
      var chip = group.querySelector(".filter-chip");
      var v    = chip && chip.querySelector(".filter-chip__value");
      if (filter[key]) {
        chip.classList.add("filter-chip--active");
        if (v) v.textContent = " · " + filter[key];
      } else {
        chip.classList.remove("filter-chip--active");
        if (v) v.textContent = "";
      }
    }
    closeAllMenus(bar);
    refreshSummary(state);
    dispatchChange();
  }

  function closeAllMenus(bar, except) {
    bar.querySelectorAll(".filter-chip-group").forEach(function (g) {
      if (g === except) return;
      var m = g.querySelector(".filter-chip__menu");
      var b = g.querySelector(".filter-chip");
      if (m) m.hidden = true;
      if (b) b.setAttribute("aria-expanded", "false");
    });
  }

  /** Update the "Showing X of Y leaders · [chips] · Clear all" line. */
  function refreshSummary(state) {
    var summary = document.getElementById("filter-summary");
    if (!summary) return;
    var filter = window.__HL_FILTER__ || {};
    var activeKeys = Object.keys(filter).filter(function (k) { return filter[k]; });
    if (activeKeys.length === 0) {
      summary.hidden = true;
      return;
    }
    summary.hidden = false;

    // Cohort size: compute the filtered cohort size via Aggregate.
    var derived = Aggregate.run(state || {}, filter);
    var filteredCount = derived.cohort_kpis.total;
    var totalCohort = Aggregate.run(state || {}, {}).cohort_kpis.total;

    var countEl = document.getElementById("filter-count");
    if (countEl) {
      countEl.textContent = "Showing " + filteredCount + " of " + totalCohort + " leaders";
    }

    var chipsHost = document.getElementById("filter-active-chips");
    if (chipsHost) {
      chipsHost.innerHTML = activeKeys.map(function (k) {
        return (
          '<span class="filter-bar__active-chip" data-filter-key="' + k + '">' +
            escapeHtml(filter[k]) +
            '<button type="button" class="filter-bar__active-chip-x" aria-label="Remove ' +
              escapeAttr(k) + ' filter">&times;</button>' +
          '</span>'
        );
      }).join("");

      // Bind the per-chip X buttons.
      chipsHost.querySelectorAll(".filter-bar__active-chip").forEach(function (sp) {
        sp.querySelector(".filter-bar__active-chip-x").addEventListener("click", function (ev) {
          ev.stopPropagation();
          var k = sp.getAttribute("data-filter-key");
          // Reuse selectOption with the current value to toggle off.
          var current = (window.__HL_FILTER__ || {})[k];
          if (current) {
            var bar = document.getElementById("filter-bar");
            selectOption(state, k, current, bar);
          }
        });
      });
    }
  }

  function dispatchChange() {
    document.dispatchEvent(new CustomEvent("hl:filterchange", {
      detail: { filter: window.__HL_FILTER__ || {} }
    }));
  }

  /** Read the current filter (defensive copy). Pure getter for consumers. */
  function get() {
    var f = window.__HL_FILTER__ || {};
    var copy = {};
    Object.keys(f).forEach(function (k) { if (f[k]) copy[k] = f[k]; });
    return copy;
  }

  /** True if no filter clauses are active. */
  function isEmpty() {
    var f = window.__HL_FILTER__ || {};
    return Object.keys(f).every(function (k) { return !f[k]; });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /**
   * Public setter — toggles a filter clause from outside the chip bar
   * (e.g. a chart click handler). Same toggle semantics as picking an
   * option from the dropdown: setting the same value twice clears it,
   * setting a different value swaps. Always re-renders chip UI and
   * dispatches hl:filterchange.
   */
  function toggle(state, key, value) {
    var bar = document.getElementById("filter-bar");
    if (!bar) return;
    selectOption(state || window.__HL_STATE__ || {}, key, value, bar);
  }

  return {
    mount:           mount,
    get:             get,
    isEmpty:         isEmpty,
    refreshSummary:  refreshSummary,
    toggle:          toggle
  };
})();
