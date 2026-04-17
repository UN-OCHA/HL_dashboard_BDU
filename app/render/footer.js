/**
 * render/footer.js — Updates the per-page footer strings where needed.
 * The page number is pre-written in index.html; this just ensures the
 * brand + last-updated suffix reflects meta.
 */

/* global RenderFooter:true */

var RenderFooter = (function () {
  "use strict";

  function render(state) {
    var updated = state.meta && state.meta.last_updated ? state.meta.last_updated : "";
    var month   = state.meta && state.meta.snapshot_month ? state.meta.snapshot_month : "";
    var suffix = updated ? " · Updated " + updated : "";
    document.querySelectorAll(".page .page-foot .brand-foot").forEach(function (el) {
      // Only decorate the default footer — custom per-page footers (e.g. Page 7)
      // are left untouched.
      var txt = (el.textContent || "").trim();
      if (txt === "OCHA · HLS") el.textContent = txt + suffix;
    });
    // Extend per-chart source lines with the "as of" date (OCHA requirement:
    // every chart carries source + data date).
    if (month) {
      document.querySelectorAll(".chart-source").forEach(function (el) {
        el.textContent = "Source: OCHA Humanitarian Leadership Section · as of " + month;
      });
    }
  }

  return { render: render };
})();
