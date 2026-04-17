/**
 * chart-stacked-col.js — 100 % stacked column chart for time-series
 * percentages. One thin column per year, segments stacked top-to-bottom
 * representing composition.
 *
 * ChartStackedCol.render(container, { data, series, colors, legendEl })
 *
 *   data:   [{ year: 1992, female_pct: 0, male_pct: 100 }, ...]
 *   series: [{ key: "female_pct", label: "% Female", color: "#..." }, ...]
 *
 * OCHA notes:
 *   - Thin columns with equal spacing give a clear sequence.
 *   - Max ~3 series keeps the stack readable; sender enforces that.
 *   - Columns stay the same height (100 %); only the segment split varies.
 *   - Column thickness is constrained (max ~18 px so bars don't become
 *     blocks when the chart is wide).
 */

/* global ChartStackedCol:true */

var ChartStackedCol = (function () {
  "use strict";

  function render(container, opts) {
    opts = opts || {};
    var data = (opts.data || []).slice().sort(function (a, b) { return a.year - b.year; });
    var series = opts.series || [];
    while (container.firstChild) container.removeChild(container.firstChild);
    if (data.length === 0 || series.length === 0) return;

    var box = container.getBoundingClientRect();
    var W = Math.max(360, Math.floor(box.width || 600));
    var H = Math.max(140, Math.floor(box.height || 220));

    // Reserve room on the right for direct labels showing the last-year
    // value of each series (OCHA direct-labelling preference). The width
    // of the reservation is tied to the longest label so short series
    // names don't waste space. Bumped from 96 → 130 to give leader
    // lines room to fan out without crossing when many series crowd
    // the top of the stack (e.g. region trends: 5 series with two
    // segments at ~3 % each needing to be pushed apart).
    var labelReserve = 130;
    var margin = { top: 10, right: labelReserve, bottom: 22, left: 30 };
    var innerW = W - margin.left - margin.right;
    var innerH = H - margin.top - margin.bottom;

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    var g = document.createElementNS(svgNS, "g");
    g.setAttribute("transform", "translate(" + margin.left + "," + margin.top + ")");
    svg.appendChild(g);

    // Y gridlines at 0 / 25 / 50 / 75 / 100
    [0, 25, 50, 75, 100].forEach(function (v) {
      var y = innerH - (v / 100) * innerH;
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", 0); line.setAttribute("x2", innerW);
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("class", v === 0 ? "c-axis-line" : "c-tick-line");
      g.appendChild(line);
      var lab = document.createElementNS(svgNS, "text");
      lab.setAttribute("x", -6); lab.setAttribute("y", y + 3);
      lab.setAttribute("text-anchor", "end");
      lab.setAttribute("class", "c-tick-label");
      lab.textContent = v + "%";
      g.appendChild(lab);
    });

    // Column geometry — thin columns, spaced evenly across the axis.
    var step = innerW / data.length;
    var MAX_COL_W = 18;   // keeps columns thin on wide pages
    var colW = Math.min(MAX_COL_W, step * 0.8);
    var halfGap = (step - colW) / 2;

    // Normalise each row to 100 % across the series (defends against
    // input rows whose values drift slightly from 100).
    // Track the last-year y-extents per series so we can place direct
    // labels at the right of the chart.
    var lastYRanges = null;

    data.forEach(function (d, i) {
      var total = series.reduce(function (s, ss) {
        return s + (Number(d[ss.key]) || 0);
      }, 0);
      if (total <= 0) total = 1;

      var x = i * step + halfGap;
      var yAcc = 0;
      var ranges = {};
      series.forEach(function (s) {
        var v = Number(d[s.key]) || 0;
        var frac = v / total;
        var h = frac * innerH;
        if (h <= 0) { ranges[s.key] = { yStart: yAcc, yEnd: yAcc, frac: 0 }; return; }
        var r = document.createElementNS(svgNS, "rect");
        r.setAttribute("x", x);
        r.setAttribute("y", yAcc);
        r.setAttribute("width", colW);
        r.setAttribute("height", h);
        r.setAttribute("fill", s.color);
        r.setAttribute("class", "c-bar");
        g.appendChild(r);
        ranges[s.key] = { yStart: yAcc, yEnd: yAcc + h, frac: frac };
        yAcc += h;
      });
      if (i === data.length - 1) {
        lastYRanges = { x: x + colW, ranges: ranges, year: d.year };
      }
    });

    // Direct labels at end-of-line — one per series, anchored to the
    // vertical middle of the last column's segment for that series.
    // When segments are thin, adjacent labels would overlap, so we
    // shift them vertically with a minimum gap AND draw leader lines
    // from the true segment midpoint to the shifted label.
    if (lastYRanges) {
      // Increased from 14 → 18 so labels for very-thin adjacent
      // segments (e.g. two 3 % regions) have genuine separation —
      // otherwise leader elbows stack on top of each other.
      var LABEL_ROW_H = 18;
      // Collect specs first, sorted top-to-bottom.
      var specs = series.map(function (s) {
        var rng = lastYRanges.ranges[s.key];
        if (!rng || rng.frac <= 0) return null;
        var midY = (rng.yStart + rng.yEnd) / 2;
        return {
          midY: midY,
          y: midY,                         // will be adjusted below
          color: s.color,
          text: s.label + " " + Math.round(rng.frac * 100) + "%"
        };
      }).filter(Boolean).sort(function (a, b) { return a.midY - b.midY; });

      // Push-down pass: ensure every label is at least LABEL_ROW_H
      // below the previous one.
      for (var i = 1; i < specs.length; i++) {
        if (specs[i].y < specs[i - 1].y + LABEL_ROW_H) {
          specs[i].y = specs[i - 1].y + LABEL_ROW_H;
        }
      }
      // Push-up pass: if we ran past the bottom, pull the bottom
      // labels up and propagate.
      for (var j = specs.length - 2; j >= 0; j--) {
        if (specs[j + 1].y - specs[j].y < LABEL_ROW_H) {
          specs[j].y = specs[j + 1].y - LABEL_ROW_H;
        }
      }

      // Stagger each leader's elbow X slightly by index so two leaders
      // with near-identical segment midpoints don't overlap their
      // horizontal runs. The label X column stays fixed so the labels
      // align flush-left.
      var ELBOW_BASE = 10;     // px from column edge to first elbow
      var ELBOW_STEP = 6;      // extra px per subsequent label
      var LABEL_X_OFFSET = ELBOW_BASE + ELBOW_STEP * specs.length + 4;

      specs.forEach(function (s, idx) {
        var shifted = Math.abs(s.y - s.midY) > 0.5;
        var anchorX = lastYRanges.x + 2;
        var elbowX  = lastYRanges.x + ELBOW_BASE + ELBOW_STEP * idx;
        var labelX  = lastYRanges.x + LABEL_X_OFFSET;
        // Leader: segment anchor → horizontal to elbow → vertical to
        // label row → horizontal into label start.
        var line = document.createElementNS(svgNS, "polyline");
        line.setAttribute("points",
          anchorX + "," + s.midY + " " +
          elbowX  + "," + s.midY + " " +
          elbowX  + "," + s.y    + " " +
          labelX  + "," + s.y);
        line.setAttribute("fill", "none");
        line.setAttribute("stroke", s.color);
        line.setAttribute("stroke-width", "1");
        line.setAttribute("opacity", shifted ? 1 : 0.7);
        g.appendChild(line);

        // Label
        var t = document.createElementNS(svgNS, "text");
        t.setAttribute("x", labelX + 2);
        t.setAttribute("y", s.y + 3);
        t.setAttribute("class", "c-value-label");
        t.setAttribute("fill", s.color);
        t.textContent = s.text;
        g.appendChild(t);
      });
    }

    // X-axis ticks — every ~5–10 years, centred under columns.
    var years = data.map(function (d) { return d.year; });
    var range = years[years.length - 1] - years[0];
    var tickStep = range <= 10 ? 1 : range <= 25 ? 5 : range <= 60 ? 10 : 20;
    data.forEach(function (d, i) {
      if (d.year % tickStep !== 0) return;
      var cx = i * step + step / 2;
      var t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", cx); t.setAttribute("y", innerH + 14);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "c-tick-label");
      t.textContent = String(d.year);
      g.appendChild(t);
    });

    container.appendChild(svg);

    // Legend (always useful for multi-series stacks).
    if (opts.legendEl) {
      var leg = opts.legendEl;
      while (leg.firstChild) leg.removeChild(leg.firstChild);
      series.forEach(function (s) {
        var item = document.createElement("span");
        var sw = document.createElement("span");
        sw.className = "swatch";
        sw.style.background = s.color;
        item.appendChild(sw);
        item.appendChild(document.createTextNode(s.label));
        leg.appendChild(item);
      });
    }
  }

  return { render: render };
})();
