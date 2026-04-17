/**
 * chart-line.js — Multi-series line chart for year-indexed percentages.
 *
 * ChartLine.render(container, { data, series, colors, yMax, yUnit, legendEl })
 *
 *   data:   [{ year: 1992, female_pct: 0, male_pct: 100 }, ...]
 *   series: [{ key: "female_pct", label: "% Female", color: "#..." }, ...]
 *   yMax:   optional max for the y axis (default: auto-rounded up)
 *   yUnit:  axis suffix, e.g. "%" (default "")
 */

/* global ChartLine:true */

var ChartLine = (function () {
  "use strict";

  function render(container, opts) {
    opts = opts || {};
    var data = (opts.data || []).slice().sort(function (a, b) { return a.year - b.year; });
    var series = opts.series || [];
    var yUnit = opts.yUnit || "";

    while (container.firstChild) container.removeChild(container.firstChild);
    if (data.length === 0 || series.length === 0) return;

    var box = container.getBoundingClientRect();
    var W = Math.max(260, Math.floor(box.width || 400));
    var H = Math.max(180, Math.floor(box.height || 240));

    var margin = { top: 10, right: 12, bottom: 22, left: 30 };
    var innerW = W - margin.left - margin.right;
    var innerH = H - margin.top - margin.bottom;

    var xMin = data[0].year;
    var xMax = data[data.length - 1].year;
    var xRange = Math.max(1, xMax - xMin);

    var maxSeries = 0;
    data.forEach(function (d) {
      series.forEach(function (s) {
        var v = Number(d[s.key]);
        if (!isNaN(v) && v > maxSeries) maxSeries = v;
      });
    });
    var yMax = opts.yMax || niceCeil(maxSeries || 1);

    function xs(year) { return ((year - xMin) / xRange) * innerW; }
    function ys(val)  { return innerH - (val / yMax) * innerH; }

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    var g = document.createElementNS(svgNS, "g");
    g.setAttribute("transform", "translate(" + margin.left + "," + margin.top + ")");
    svg.appendChild(g);

    // Y gridlines + ticks
    var yTicks = 4;
    for (var i = 0; i <= yTicks; i++) {
      var v = (yMax * i) / yTicks;
      var y = ys(v);
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", 0); line.setAttribute("x2", innerW);
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("class", i === 0 ? "c-axis-line" : "c-tick-line");
      g.appendChild(line);
      var lab = document.createElementNS(svgNS, "text");
      lab.setAttribute("x", -6); lab.setAttribute("y", y + 3);
      lab.setAttribute("text-anchor", "end");
      lab.setAttribute("class", "c-tick-label");
      lab.textContent = Math.round(v) + yUnit;
      g.appendChild(lab);
    }

    // X ticks (every ~5–10 years, at most 7 labels)
    var yearStep = niceYearStep(xRange);
    var firstTick = Math.ceil(xMin / yearStep) * yearStep;
    for (var y = firstTick; y <= xMax; y += yearStep) {
      var x = xs(y);
      var tline = document.createElementNS(svgNS, "line");
      tline.setAttribute("x1", x); tline.setAttribute("x2", x);
      tline.setAttribute("y1", innerH); tline.setAttribute("y2", innerH + 3);
      tline.setAttribute("class", "c-axis-line");
      g.appendChild(tline);
      var t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", x); t.setAttribute("y", innerH + 14);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "c-tick-label");
      t.textContent = String(y);
      g.appendChild(t);
    }

    // Lines
    series.forEach(function (s) {
      var pts = data
        .map(function (d) { var v = Number(d[s.key]); return isNaN(v) ? null : [xs(d.year), ys(v)]; })
        .filter(function (p) { return p !== null; });
      if (pts.length === 0) return;

      var d = "M" + pts.map(function (p) { return p[0] + "," + p[1]; }).join(" L");
      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "c-line");
      path.setAttribute("stroke", s.color);
      g.appendChild(path);

      // Endpoint label
      var last = pts[pts.length - 1];
      var lab = document.createElementNS(svgNS, "text");
      lab.setAttribute("x", last[0] + 4);
      lab.setAttribute("y", last[1] + 3);
      lab.setAttribute("class", "c-value-label");
      lab.setAttribute("fill", s.color);
      // anchor end if near right edge
      if (last[0] > innerW - 30) {
        lab.setAttribute("x", last[0] - 4);
        lab.setAttribute("text-anchor", "end");
      }
      lab.textContent = s.label;
      g.appendChild(lab);
    });

    container.appendChild(svg);

    // Legend
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

  function niceYearStep(range) {
    if (range <= 10) return 1;
    if (range <= 25) return 5;
    if (range <= 60) return 10;
    return 20;
  }
  function niceCeil(v) {
    if (v <= 0) return 1;
    if (v <= 10) return 10;
    if (v <= 25) return 25;
    if (v <= 50) return 50;
    if (v <= 100) return 100;
    var exp = Math.floor(Math.log10(v));
    var pow = Math.pow(10, exp);
    return Math.ceil(v / pow) * pow;
  }

  return { render: render };
})();
