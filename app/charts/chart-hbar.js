/**
 * chart-hbar.js — Horizontal bar chart, grouped or stacked.
 *
 * ChartHbar.render(container, { data, series, colors, mode, valueFmt, width, height })
 *
 *   data:   [{ label: "ASG", values: { weog: 2, non_weog: 3 } }, ...]
 *   series: [{ key: "weog", label: "WEOG", color: "#..." }, ...]
 *   mode:   "grouped" | "stacked"   (default "grouped")
 *
 * The chart renders as inline SVG sized to fit the container (width/height
 * are inferred from the container's bounding box when not provided).
 */

/* global ChartHbar:true */

var ChartHbar = (function () {
  "use strict";

  function render(container, opts) {
    opts = opts || {};
    var data = opts.data || [];
    var series = opts.series || [];
    var mode = opts.mode || "grouped";
    var valueFmt = opts.valueFmt || function (v) { return String(v); };

    // Clear
    while (container.firstChild) container.removeChild(container.firstChild);
    if (data.length === 0 || series.length === 0) return;

    // Size
    var box = container.getBoundingClientRect();
    var W = opts.width  || Math.max(240, Math.floor(box.width  || 360));
    var H = opts.height || Math.max(180, Math.floor(box.height || 220));

    // When direct-labelled (the default here, since we always draw value
    // labels next to bars), we skip gridlines and the x-axis tick row.
    // This matches OCHA's "no gridlines if direct-labelled" rule.
    var direct = opts.directLabels !== false;
    var margin = {
      top: 8,
      right: 28,
      bottom: direct ? 4 : 18,
      left: 74
    };
    var innerW = W - margin.left - margin.right;
    var innerH = H - margin.top - margin.bottom;

    // Domain max
    var maxVal = 0;
    data.forEach(function (d) {
      if (mode === "stacked") {
        var sum = 0;
        series.forEach(function (s) { sum += (d.values[s.key] || 0); });
        if (sum > maxVal) maxVal = sum;
      } else {
        series.forEach(function (s) {
          var v = d.values[s.key] || 0;
          if (v > maxVal) maxVal = v;
        });
      }
    });
    if (maxVal <= 0) maxVal = 1;
    // Round up to a nice tick
    var niceMax = niceCeil(maxVal);

    // OCHA rule: bar thickness should relate to the tick-label height,
    // not to the container height — otherwise bars balloon into blocks
    // when the chart is given a lot of vertical space. Label font is
    // ~10 px (from styles.css `.c-tick-label`), so a single-series bar
    // targets ~30 px thick, grouped bars split that budget.
    //
    // When space is tight (many rows in a small card), we shrink the
    // bars to preserve a MIN_GAP between rows — bars must never touch.
    var LABEL_PX   = 10;
    var TARGET_BAR = Math.round(LABEL_PX * 3);   // ≈ 30 px per bar
    var MIN_BAR    = 6;                          // floor for readability
    var GROUP_GAP  = 2;                          // space between bars inside a group
    var MIN_GAP    = 10;                         // minimum whitespace between rows

    function layoutFor(targetBar) {
      var bH = mode === "grouped"
        ? targetBar / Math.max(1, series.length)
        : targetBar;
      bH = Math.max(MIN_BAR, bH);
      var gH = mode === "grouped"
        ? bH * series.length + (series.length - 1) * GROUP_GAP
        : bH;
      return { barH: bH, groupH: gH };
    }

    var lay = layoutFor(TARGET_BAR);
    // If TARGET_BAR + MIN_GAP × data.length > innerH, shrink the bars so
    // each row still has a visible gap. This is what prevents bars from
    // visually overlapping when the chart has many rows.
    var neededH = (lay.groupH + MIN_GAP) * data.length;
    if (neededH > innerH) {
      var scaledBar = Math.max(MIN_BAR, TARGET_BAR * (innerH / neededH));
      lay = layoutFor(scaledBar);
    }
    var barH   = lay.barH;
    var groupH = lay.groupH;
    var bandH  = Math.max(groupH + MIN_GAP, Math.floor(innerH / data.length));
    var availH = groupH;

    // Build SVG
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    var g = document.createElementNS(svgNS, "g");
    g.setAttribute("transform", "translate(" + margin.left + "," + margin.top + ")");
    svg.appendChild(g);

    // Axis + gridlines — skipped entirely when direct-labelled.
    if (!direct) {
      var ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];
      ticks.forEach(function (t) {
        var x = (t / niceMax) * innerW;
        var line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", x); line.setAttribute("x2", x);
        line.setAttribute("y1", 0); line.setAttribute("y2", innerH);
        line.setAttribute("class", t === 0 ? "c-axis-line" : "c-tick-line");
        g.appendChild(line);

        var lab = document.createElementNS(svgNS, "text");
        lab.setAttribute("x", x); lab.setAttribute("y", innerH + 12);
        lab.setAttribute("text-anchor", "middle");
        lab.setAttribute("class", "c-tick-label");
        lab.textContent = valueFmt(Math.round(t * 10) / 10);
        g.appendChild(lab);
      });
    }

    // Bars — centre each row's group inside its band so any extra
    // vertical space becomes whitespace rather than taller bars.
    data.forEach(function (d, i) {
      var yBand = i * bandH;
      var y0 = yBand + Math.max(0, (bandH - groupH) / 2);

      // row label — vertically aligned with the centre of the group
      var yl = document.createElementNS(svgNS, "text");
      yl.setAttribute("x", -8);
      yl.setAttribute("y", y0 + groupH / 2 + 3);
      yl.setAttribute("text-anchor", "end");
      yl.setAttribute("class", "c-tick-label");
      yl.textContent = d.label;
      g.appendChild(yl);

      // If a click callback is provided, wrap each row's bars + label in a
      // single <g class="c-row" data-bar-label=...> so the whole row is one
      // hit target. Otherwise plain bars (no extra DOM, no cursor change).
      var rowG = g;
      if (typeof opts.onBarClick === "function") {
        rowG = document.createElementNS(svgNS, "g");
        rowG.setAttribute("class", "c-row c-row--clickable");
        rowG.setAttribute("data-bar-label", d.label);
        rowG.setAttribute("tabindex", "0");
        rowG.setAttribute("role", "button");
        rowG.setAttribute("aria-label", d.label + " — click for details");
        rowG.style.cursor = "pointer";
        rowG.addEventListener("click", function () {
          opts.onBarClick({ label: d.label, value: rowValue(d, series), index: i });
        });
        rowG.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            opts.onBarClick({ label: d.label, value: rowValue(d, series), index: i });
          }
        });
        g.appendChild(rowG);
      }

      if (mode === "stacked") {
        var xAcc = 0;
        series.forEach(function (s) {
          var v = d.values[s.key] || 0;
          if (v <= 0) return;
          var w = (v / niceMax) * innerW;
          var r = document.createElementNS(svgNS, "rect");
          r.setAttribute("x", xAcc);
          r.setAttribute("y", y0);
          r.setAttribute("width", w);
          r.setAttribute("height", barH);
          r.setAttribute("fill", s.color);
          r.setAttribute("class", "c-bar");
          rowG.appendChild(r);
          // label
          if (w > 24) {
            var t = document.createElementNS(svgNS, "text");
            t.setAttribute("x", xAcc + w / 2);
            t.setAttribute("y", y0 + barH / 2 + 3);
            t.setAttribute("text-anchor", "middle");
            t.setAttribute("class", "c-value-label");
            t.setAttribute("fill", "#fff");
            t.textContent = valueFmt(v);
            rowG.appendChild(t);
          }
          xAcc += w;
        });
      } else {
        series.forEach(function (s, si) {
          var v = d.values[s.key] || 0;
          var w = (v / niceMax) * innerW;
          var y = y0 + si * (barH + GROUP_GAP);
          var r = document.createElementNS(svgNS, "rect");
          r.setAttribute("x", 0);
          r.setAttribute("y", y);
          r.setAttribute("width", Math.max(0.5, w));
          r.setAttribute("height", barH);
          r.setAttribute("fill", s.color);
          r.setAttribute("class", "c-bar");
          rowG.appendChild(r);
          // label
          var t = document.createElementNS(svgNS, "text");
          t.setAttribute("x", w + 4);
          t.setAttribute("y", y + barH / 2 + 3);
          t.setAttribute("class", "c-value-label");
          t.textContent = valueFmt(v);
          rowG.appendChild(t);
        });
      }
    });

    container.appendChild(svg);
  }

  /** Sum a data row's values across all series (used for click payloads). */
  function rowValue(d, series) {
    return series.reduce(function (s, ss) {
      return s + (Number(d.values[ss.key]) || 0);
    }, 0);
  }

  function niceCeil(v) {
    if (v <= 0) return 1;
    var exp = Math.floor(Math.log10(v));
    var pow = Math.pow(10, exp);
    var frac = v / pow;
    var nice;
    if (frac <= 1)      nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 2.5) nice = 2.5;
    else if (frac <= 5) nice = 5;
    else nice = 10;
    return nice * pow;
  }

  return { render: render };
})();
