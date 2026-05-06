/**
 * render/resources.js — Page 7 Resources section.
 * Sheet-driven from the "11. Reference links" tab (state.links).
 * Each section in that tab whose key is NOT "highlight" renders as a
 * column on Page 7. Order in the sheet drives column order.
 *
 * Falls back to HLConfig.RESOURCES if the sheet hasn't been populated
 * yet (e.g. brand-new instance).
 */

/* global RenderResources:true, HLConfig */

var RenderResources = (function () {
  "use strict";

  function render(state) {
    var root = document.getElementById("resources");
    if (!root) return;
    while (root.firstChild) root.removeChild(root.firstChild);

    var sections = pickSections(state);

    sections.forEach(function (section) {
      var col = document.createElement("div");
      col.className = "resources__col";

      // Heading: title with a 2px navy bottom rule (per v2 design).
      var head = document.createElement("div");
      head.className = "resources__head";
      var h = document.createElement("h3");
      h.className = "resources__title";
      h.textContent = section.label;
      head.appendChild(h);
      col.appendChild(head);

      // Items rendered as the shared .link-row primitive.
      section.items.forEach(function (item) {
        var a = document.createElement("a");
        a.className = "link-row";
        a.href = item.url || "#";
        if (/^https?:/i.test(item.url)) {
          a.target = "_blank";
          a.rel = "noopener";
        }
        var label = document.createElement("span");
        label.textContent = item.label;
        a.appendChild(label);
        var trail = document.createElement("img");
        trail.className = "link-row__trail";
        trail.setAttribute("aria-hidden", "true");
        trail.src = "assets/icons/link.svg";
        trail.alt = "";
        a.appendChild(trail);
        col.appendChild(a);
      });

      root.appendChild(col);
    });
  }

  // Prefer sheet-driven sections; fall back to HLConfig.RESOURCES if
  // the sheet's links tab hasn't been populated yet (or only has the
  // Highlight section, which is Page 2's territory).
  function pickSections(state) {
    var sheetSections = ((state && state.links && state.links.sections) || [])
      .filter(function (s) { return s.key !== "highlight"; });
    if (sheetSections.length) return sheetSections;

    // Fall back to the constant — same shape as the sheet output.
    var fallback = (HLConfig && HLConfig.RESOURCES) || {};
    return Object.keys(fallback).map(function (k) {
      return { key: k.toLowerCase(), label: k, items: fallback[k] };
    });
  }

  return { render: render };
})();
