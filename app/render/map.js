/**
 * render/map.js — Inlines the OCHA HL map (assets/world-map.svg) and
 * adds wheel-zoom + drag-to-pan + reset.
 *
 * The map is currently **static**: the SVG ships with its own legend,
 * country colour-coding and disclaimer baked in. Valijon replaces the
 * file in `assets/world-map.svg` when the roster changes (re-export
 * from Illustrator). No Google-Sheet data-join happens here.
 *
 * When you're ready to switch back to a data-driven map, re-introduce
 * the `paintCountries()` routine from earlier revisions and provide an
 * SVG where each country `<path>` carries an ISO3 `id`.
 */

/* global RenderMap:true */

var RenderMap = (function () {
  "use strict";

  var svgCache = null;

  function render(/* state */) {
    var container = document.getElementById("map-container");
    var legend = document.getElementById("map-legend");
    if (!container) return Promise.resolve();

    // The static map ships with its own legend — hide our HTML one so
    // we don't render it twice.
    if (legend) legend.innerHTML = "";

    return loadSvg()
      .then(function (svgText) {
        container.innerHTML = svgText;
        var svg = container.querySelector("svg");
        if (!svg) throw new Error("world-map.svg has no <svg> root");
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        // Align to the LEFT of the map container (vertically centered).
        // Without this the SVG defaults to xMidYMid, which centers the
        // map horizontally and leaves an awkward gap on the left when
        // the container is wider than the map's 1.66 aspect ratio.
        svg.setAttribute("preserveAspectRatio", "xMinYMid meet");
        // Zoom/pan disabled per design — the map sits static within its
        // grid cell.
      })
      .catch(function (err) {
        container.innerHTML =
          '<div class="data-error">Map failed to load: ' + err.message + '</div>';
      });
  }

  function loadSvg() {
    if (svgCache) return Promise.resolve(svgCache);
    // Cache-bust so Illustrator re-exports are picked up without a hard
    // reload. The page-level cache-buster bumps index.html's ?v=…,
    // but the SVG is fetched independently, so we time-stamp it here.
    var url = "assets/world-map.svg?v=" + (window.__HL_ASSET_VER__ || Date.now());
    return fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (txt) { svgCache = txt; return txt; });
  }

  /* ── Zoom / pan ─────────────────────────────────────────── */

  function attachZoomPan(svg, container) {
    var vb0 = parseViewBox(svg.getAttribute("viewBox"));
    var vb  = vb0.slice();
    var ZOOM_MIN = 0.9;     // essentially no zoom-out beyond initial
    var ZOOM_MAX = 20;

    function apply() { svg.setAttribute("viewBox", vb.join(" ")); }
    function clamp() {
      var minW = vb0[2] / ZOOM_MAX, maxW = vb0[2] / ZOOM_MIN;
      if (vb[2] < minW) { vb[3] *= minW / vb[2]; vb[2] = minW; }
      if (vb[2] > maxW) { vb[3] *= maxW / vb[2]; vb[2] = maxW; }
      if (vb[0] < vb0[0])                  vb[0] = vb0[0];
      if (vb[1] < vb0[1])                  vb[1] = vb0[1];
      if (vb[0] + vb[2] > vb0[0] + vb0[2]) vb[0] = vb0[0] + vb0[2] - vb[2];
      if (vb[1] + vb[3] > vb0[1] + vb0[3]) vb[1] = vb0[1] + vb0[3] - vb[3];
    }
    function clientToVb(cx, cy) {
      var rect = svg.getBoundingClientRect();
      return {
        x: vb[0] + (cx - rect.left) / rect.width  * vb[2],
        y: vb[1] + (cy - rect.top)  / rect.height * vb[3]
      };
    }
    function zoomAt(cx, cy, k) {
      var before = clientToVb(cx, cy);
      vb[2] *= k; vb[3] *= k;
      var after = clientToVb(cx, cy);
      vb[0] += before.x - after.x;
      vb[1] += before.y - after.y;
      clamp(); apply();
    }

    svg.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
    }, { passive: false });

    var dragging = false, dragStart = null, vbStart = null;
    svg.style.cursor = "grab";
    svg.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      vbStart = vb.slice();
      svg.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var rect = svg.getBoundingClientRect();
      vb[0] = vbStart[0] - (e.clientX - dragStart.x) / rect.width  * vbStart[2];
      vb[1] = vbStart[1] - (e.clientY - dragStart.y) / rect.height * vbStart[3];
      clamp(); apply();
    });
    window.addEventListener("mouseup", function () {
      if (!dragging) return;
      dragging = false;
      svg.style.cursor = "grab";
    });
    svg.addEventListener("dblclick", function () { vb = vb0.slice(); apply(); });

    if (!container.querySelector(".map-zoom-ctrls")) {
      var ctrls = document.createElement("div");
      ctrls.className = "map-zoom-ctrls";
      ctrls.innerHTML =
        '<button class="map-zoom-btn" data-z="in"    title="Zoom in">+</button>' +
        '<button class="map-zoom-btn" data-z="out"   title="Zoom out">−</button>' +
        '<button class="map-zoom-btn" data-z="reset" title="Reset view">⟳</button>';
      ctrls.addEventListener("click", function (e) {
        var b = e.target.closest("[data-z]");
        if (!b) return;
        var rect = svg.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top  + rect.height / 2;
        if (b.getAttribute("data-z") === "in")  zoomAt(cx, cy, 0.75);
        else if (b.getAttribute("data-z") === "out") zoomAt(cx, cy, 1 / 0.75);
        else { vb = vb0.slice(); apply(); }
      });
      container.appendChild(ctrls);
    }
  }

  function parseViewBox(v) {
    if (!v) return [0, 0, 1000, 505];
    return v.trim().split(/[ ,]+/).map(Number);
  }

  return { render: render };
})();
