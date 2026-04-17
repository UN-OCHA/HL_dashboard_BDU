/**
 * render/header.js — Fills the overview-page header with month/year
 * and last-updated date from the `meta` tab.
 *
 * Expected meta keys: snapshot_month (e.g. "February 2026"),
 *                     last_updated  (ISO date or human-readable)
 */

/* global RenderHeader:true */

var RenderHeader = (function () {
  "use strict";

  function render(state) {
    var m = state.meta || {};
    var month = m.snapshot_month || defaultMonth();
    var updated = m.last_updated || "";

    setText("head-month", month);
    setText("head-updated", updated || fallbackUpdated());
  }

  function setText(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }
  function defaultMonth() {
    var d = new Date();
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  function fallbackUpdated() {
    var d = new Date();
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  return { render: render };
})();
