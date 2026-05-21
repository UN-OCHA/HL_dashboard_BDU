/**
 * main.js — Orchestrates the dashboard:
 *   1. Load 10 sheet tabs in parallel (SheetsLoader)
 *   2. Render each section from the resulting state
 *   3. Wire the hero "Download PDF" button and per-page PNG export
 *      buttons (no in-page refresh — sheet edits propagate via the
 *      gviz cache, hard reload always pulls fresh data).
 */

/* global SheetsLoader, RenderHeader, RenderKpis, RenderMap, RenderHighlights,
          RenderCharts, RenderTables, RenderResources, RenderFooter, Exporter,
          FilterBar */

(function () {
  "use strict";

  function mountErr(msg) {
    var bar = document.createElement("div");
    bar.className = "data-error";
    bar.style.margin = "12px 20px";
    bar.textContent = msg;
    // Safe append: insertBefore(bar, null) appends at the end of body
    // when there's no second child. This never throws.
    var anchor = document.body.firstChild
      ? document.body.firstChild.nextSibling
      : null;
    if (anchor && anchor.parentNode === document.body) {
      document.body.insertBefore(bar, anchor);
    } else {
      document.body.appendChild(bar);
    }
  }

  // Last-rendered state, kept around so the PNG exporter can ask for a
  // fresh render after it toggles A4 mode (charts re-measure their
  // container when re-invoked).
  var lastState = null;

  function renderAll(state) {
    lastState = state;
    window.__HL_STATE__ = state;
    if (state._warnings && state._warnings.length > 0) {
      console.warn("[HL Dashboard] Data warnings:", state._warnings);
    }
    // Each renderer is wrapped so a single section's failure can't
    // blank every section below it. Errors are logged + surfaced as
    // a non-blocking warning bar; the rest of the dashboard renders.
    safeRender("header",     function () { RenderHeader.render(state); });
    safeRender("kpis",       function () { RenderKpis.render(state); });
    safeRender("map",        function () { RenderMap.render(state); });
    safeRender("highlights", function () { RenderHighlights.render(state); });
    safeRender("charts",     function () { RenderCharts.render(state); });
    safeRender("tables",     function () { RenderTables.render(state); });
    safeRender("resources",  function () { RenderResources.render(state); });
    safeRender("footer",     function () { RenderFooter.render(state); });
    // Mount the Page 3 filter chip bar (idempotent: only mounts once).
    safeRender("filter-bar", function () {
      if (typeof FilterBar !== "undefined" && !window.__HL_FILTER_BAR_MOUNTED__) {
        FilterBar.mount(state);
        window.__HL_FILTER_BAR_MOUNTED__ = true;
      } else if (typeof FilterBar !== "undefined") {
        // Re-render summary in case totals shifted (e.g. data refresh)
        FilterBar.refreshSummary(state);
      }
    });
  }

  function safeRender(label, fn) {
    try { fn(); }
    catch (err) {
      console.error("[HL Dashboard] " + label + " render failed:", err);
      mountErr("Render error in “" + label + "” section: " + err.message);
    }
  }

  // Re-render only the parts whose layout depends on container size —
  // charts and the map legend. Called by export.js around PNG capture.
  window.__HL_rerenderForSize__ = function () {
    if (!lastState) return;
    RenderCharts.render(lastState);
  };

  // Re-render Page 3 charts whenever the chip-bar filter changes.
  // RenderCharts.render() reads FilterBar.get() internally and routes
  // through Aggregate.run() when the filter is non-empty. The other
  // sections (KPIs, map, tables, etc.) are NOT re-rendered — the
  // filter scope is Page 3 only per the design decision.
  document.addEventListener("hl:filterchange", function () {
    if (!lastState) return;
    safeRender("charts (filter)", function () { RenderCharts.render(lastState); });
  });

  function load() {
    return SheetsLoader.loadAll()
      .then(renderAll)
      .catch(function (err) {
        console.error("[HL Dashboard] Fatal load error:", err);
        mountErr("Failed to load dashboard data: " + err.message);
      });
  }

  function wireUi() {
    var pdf = document.getElementById("btn-pdf");
    if (pdf) {
      pdf.addEventListener("click", function () {
        pdf.disabled = true;
        var original = pdf.textContent;
        pdf.textContent = "Generating PDF…";
        Exporter.exportPdf()
          .catch(function (err) {
            alert("PDF export failed: " + err.message);
          })
          .finally(function () {
            pdf.disabled = false;
            pdf.textContent = original;
          });
      });
    }
    // Per-page PNG buttons
    document.querySelectorAll("[data-export-page]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var page = btn.closest(".page");
        if (!page) return;
        btn.disabled = true;
        Exporter.exportPage(page).finally(function () { btn.disabled = false; });
      });
    });
  }

  // Bootstrap
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { wireUi(); load(); });
  } else {
    wireUi();
    load();
  }
})();
