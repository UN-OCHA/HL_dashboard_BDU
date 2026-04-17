/**
 * main.js — Orchestrates the dashboard:
 *   1. Load 10 sheet tabs in parallel (SheetsLoader)
 *   2. Render each section from the resulting state
 *   3. Wire top-bar buttons + per-page PNG export buttons
 *
 * Re-runs the render pipeline when "Refresh data" is clicked.
 */

/* global SheetsLoader, RenderHeader, RenderKpis, RenderMap, RenderHighlights,
          RenderCharts, RenderTables, RenderResources, RenderFooter, Exporter */

(function () {
  "use strict";

  function mountErr(msg) {
    var bar = document.createElement("div");
    bar.className = "data-error";
    bar.style.margin = "12px 20px";
    bar.textContent = msg;
    document.body.insertBefore(bar, document.body.firstChild.nextSibling);
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
    RenderHeader.render(state);
    RenderKpis.render(state);
    // Map is async (fetches the SVG); charts and tables are sync.
    RenderMap.render(state);
    RenderHighlights.render(state);
    RenderCharts.render(state);
    RenderTables.render(state);
    RenderResources.render();
    RenderFooter.render(state);
  }

  // Re-render only the parts whose layout depends on container size —
  // charts and the map legend. Called by export.js around PNG capture.
  window.__HL_rerenderForSize__ = function () {
    if (!lastState) return;
    RenderCharts.render(lastState);
  };

  function load() {
    return SheetsLoader.loadAll()
      .then(renderAll)
      .catch(function (err) {
        console.error("[HL Dashboard] Fatal load error:", err);
        mountErr("Failed to load dashboard data: " + err.message);
      });
  }

  function wireUi() {
    var refresh = document.getElementById("btn-refresh");
    if (refresh) {
      refresh.addEventListener("click", function () {
        SheetsLoader.clearCache();
        refresh.disabled = true;
        refresh.textContent = "⟳ Refreshing…";
        load().finally(function () {
          refresh.disabled = false;
          refresh.textContent = "⟳ Refresh data";
        });
      });
    }
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
