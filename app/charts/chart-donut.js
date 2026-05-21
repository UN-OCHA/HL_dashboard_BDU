/**
 * chart-donut.js — Donut chart with optional center label.
 *
 * ChartDonut.render(container, { data, colors, centerValue, centerLabel,
 *                                valueFmt, showLegend, legendEl })
 *
 *   data:  [{ label: "RC/HC", value: 17 }, ...]
 *   colors: array of hex strings, used in order (recycled if data is longer)
 *   centerValue / centerLabel: optional strings for the donut hole
 *   legendEl:  optional DOM node where the legend should be appended
 */

/* global ChartDonut:true */

var ChartDonut = (function () {
  "use strict";

  var DEFAULT_COLORS = ["#009EDB", "#F2645A", "#1EBFB3", "#FFB92A", "#7B68EE", "#AAC85C", "#78B7D0", "#C77CFF"];

  function render(container, opts) {
    opts = opts || {};
    var data = (opts.data || []).filter(function (d) { return d.value > 0; });
    var colors = opts.colors || DEFAULT_COLORS;
    var valueFmt = opts.valueFmt || function (v) { return String(v); };
    var pctFmt = function (p) { return Math.round(p * 100) + "%"; };

    while (container.firstChild) container.removeChild(container.firstChild);
    if (data.length === 0) return;

    var box = container.getBoundingClientRect();
    var W = Math.max(160, Math.floor(box.width || 220));
    var H = Math.max(160, Math.floor(box.height || 220));

    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (total <= 0) return;

    var direct = !!opts.directLabels;
    // Reserve more room on both sides for direct labels; keep the donut
    // noticeably smaller so the label text can't bleed past the edges.
    var LABEL_PAD = direct ? 110 : 10;

    var cx = W / 2;
    var cy = H / 2;
    var radius = Math.min(W - 2 * LABEL_PAD, H - 40) / 2;
    if (radius < 36) radius = Math.min(W, H) / 2 - 20;
    // Tighter outer radius when labels are direct — leaves more breathing
    // room for the text without shrinking the inner ring.
    if (direct) radius = Math.max(36, radius * 0.88);
    var inner = radius * 0.62;

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // First pass: draw the arcs + compute ideal label positions.
    // Direct labels are placed at their radial "ideal" Y only — NO
    // leader lines. If any two adjacent labels on the same side
    // would collide, we abandon direct labelling entirely and fall
    // back to the legend (populated into opts.legendEl by the caller).
    var LABEL_ROW_H = 14;
    var labelSpecs = [];

    // Donut geometry for the stroke-based slice rendering. Each slice
    // is a <circle> with stroke (no fill) at the donut's mid-radius;
    // stroke-width equals (radius - inner). We use stroke-dasharray to
    // make only the slice's arc visible, and rotate each circle so its
    // dash starts at the slice's a0 angle. This setup lets us animate
    // stroke-dashoffset for a true "trim path" sweep (see CSS).
    var midR = (radius + inner) / 2;
    var thickness = radius - inner;
    var circumference = 2 * Math.PI * midR;

    var angle = -Math.PI / 2;
    data.forEach(function (d, i) {
      var sweep = (d.value / total) * Math.PI * 2;
      var a0 = angle;
      var a1 = angle + sweep;
      angle = a1;
      var pct = d.value / total;
      var isFullCircle = pct >= 0.9999;
      var sliceLen = sweep * midR;   // arc length at midline

      // Stroked-circle slice. SVG circles start their stroke at the
      // 3-o'clock position (angle 0). Our angle system starts at -π/2
      // (12 o'clock) and increases clockwise. To align the dash start
      // with this slice's a0 we rotate the circle by a0 degrees around
      // the donut's centre.
      var arc = document.createElementNS(svgNS, "circle");
      arc.setAttribute("cx", cx);
      arc.setAttribute("cy", cy);
      arc.setAttribute("r", midR);
      arc.setAttribute("fill", "none");
      arc.setAttribute("stroke", colors[i % colors.length]);
      arc.setAttribute("stroke-width", thickness);
      arc.setAttribute("stroke-dasharray", sliceLen + " " + Math.max(0, circumference - sliceLen));
      var rotDeg = a0 * 180 / Math.PI;
      arc.setAttribute("transform", "rotate(" + rotDeg + " " + cx + " " + cy + ")");
      arc.setAttribute("data-segment-label", d.label);
      // Custom property for the trim-path animation. CSS reads
      // --slice-len to set stroke-dashoffset's `from` value in the
      // hl-arc-trim @keyframes; final state is dashoffset 0.
      arc.style.setProperty("--slice-len", sliceLen);

      if (typeof opts.onSegmentClick === "function") {
        arc.style.cursor = "pointer";
        arc.setAttribute("class", "c-arc c-arc--clickable");
        (function (slice, idx) {
          arc.addEventListener("click", function (ev) {
            ev.stopPropagation();
            opts.onSegmentClick({
              label: slice.label,
              value: slice.value,
              index: idx,
              fraction: slice.value / total
            });
          });
        })(d, i);
      } else {
        arc.setAttribute("class", "c-arc");
      }
      svg.appendChild(arc);

      // Hairline white separator at the slice's start angle (skip for
      // a 100% single-slice donut — there's only one boundary and it
      // looks like a stray notch at 12 o'clock).
      if (!isFullCircle && data.length > 1) {
        var sep = document.createElementNS(svgNS, "line");
        sep.setAttribute("x1", cx + Math.cos(a0) * inner);
        sep.setAttribute("y1", cy + Math.sin(a0) * inner);
        sep.setAttribute("x2", cx + Math.cos(a0) * radius);
        sep.setAttribute("y2", cy + Math.sin(a0) * radius);
        sep.setAttribute("stroke", "#fff");
        sep.setAttribute("stroke-width", "2");
        sep.setAttribute("class", "c-arc-sep");
        svg.appendChild(sep);
      }

      var mid = (a0 + a1) / 2;

      // Full-circle case: skip direct AND inline labels — the center
      // text already reads "Total leaders / N" and labeling the rim
      // with "100%" or the single category name would just clutter.
      if (isFullCircle) return;

      if (direct) {
        var onRight = Math.cos(mid) >= 0;
        // Label sits just outside the outer radius along the slice's
        // bisecting angle. No elbow, no leader line.
        var outR = radius + 12;
        var lx = cx + Math.cos(mid) * outR;
        var ly = cy + Math.sin(mid) * outR + 3;
        labelSpecs.push({
          onRight: onRight,
          x: lx,
          y: ly,
          text: (d.label || "—") + " · " + pctFmt(pct),
          color: colors[i % colors.length]
        });
      } else if (pct >= 0.08) {
        // Inline % label for big slices (when not using direct labels).
        var lr = (radius + inner) / 2;
        var lxIn = cx + Math.cos(mid) * lr;
        var lyIn = cy + Math.sin(mid) * lr + 3;
        var t2 = document.createElementNS(svgNS, "text");
        t2.setAttribute("x", lxIn); t2.setAttribute("y", lyIn);
        t2.setAttribute("text-anchor", "middle");
        t2.setAttribute("class", "c-value-label");
        t2.setAttribute("fill", "#fff");
        t2.textContent = pctFmt(pct);
        svg.appendChild(t2);
      }
    });

    // ── Direct labels OR legend fallback ──
    // We NEVER draw leader lines. If labels at their ideal positions
    // would collide, we skip them and let the caller's legend render
    // instead (opts.legendEl is populated by the legend block below).
    if (direct && labelSpecs.length) {
      var leftSide  = labelSpecs.filter(function (s) { return !s.onRight; })
                                 .sort(function (a, b) { return a.y - b.y; });
      var rightSide = labelSpecs.filter(function (s) { return s.onRight; })
                                 .sort(function (a, b) { return a.y - b.y; });

      var collides = hasCollision(leftSide) || hasCollision(rightSide);

      if (collides) {
        // Signal to the caller (via the legend block) that a legend
        // must render. If no legendEl was passed in, the caller should
        // inspect svg.dataset.usedLegendFallback after render().
        svg.setAttribute("data-used-legend-fallback", "1");
      } else {
        labelSpecs.forEach(function (s) {
          var t = document.createElementNS(svgNS, "text");
          t.setAttribute("x", s.x);
          t.setAttribute("y", s.y);
          t.setAttribute("text-anchor", s.onRight ? "start" : "end");
          t.setAttribute("class", "c-value-label");
          t.setAttribute("fill", "#262626");
          t.textContent = s.text;
          svg.appendChild(t);
        });
      }
    }

    function hasCollision(side) {
      for (var k = 1; k < side.length; k++) {
        if (side[k].y - side[k - 1].y < LABEL_ROW_H) return true;
      }
      return false;
    }

    // Center label — value on its own line, each word of the sub-label
    // on its own line below. Kept compact so the whole stack fits
    // inside the donut hole at A4 (print) sizes.
    drawCenter(opts.centerValue || (opts.centerLabel ? "" : valueFmt(total)),
               opts.centerLabel || (opts.centerValue ? "" : "Total"));

    function drawCenter(value, label) {
      var words = String(label || "").split(/\s+/).filter(Boolean);
      // Vertically center the whole block. Gap between value and first
      // sub-word is larger than between sub-words themselves.
      var VALUE_H = 22;
      var SUB_H = 12;
      var totalH = (value ? VALUE_H : 0) + words.length * SUB_H;
      var top = cy - totalH / 2;

      if (value) {
        var cv = document.createElementNS(svgNS, "text");
        cv.setAttribute("x", cx);
        cv.setAttribute("y", top + VALUE_H - 4);
        cv.setAttribute("class", "c-donut-center");
        cv.textContent = value;
        svg.appendChild(cv);
      }

      words.forEach(function (w, idx) {
        var cl = document.createElementNS(svgNS, "text");
        cl.setAttribute("x", cx);
        cl.setAttribute("y", top + (value ? VALUE_H : 0) + SUB_H * (idx + 1) - 2);
        cl.setAttribute("class", "c-donut-sub");
        cl.textContent = w;
        svg.appendChild(cl);
      });
    }

    container.appendChild(svg);

    // Legend (appended externally if legendEl supplied)
    if (opts.legendEl) {
      var leg = opts.legendEl;
      while (leg.firstChild) leg.removeChild(leg.firstChild);
      data.forEach(function (d, i) {
        var item = document.createElement("span");
        var sw = document.createElement("span");
        sw.className = "swatch";
        sw.style.background = colors[i % colors.length];
        item.appendChild(sw);
        var pct = d.value / total;
        item.appendChild(document.createTextNode(d.label + " · " + pctFmt(pct)));
        leg.appendChild(item);
      });
    }
  }

  function arcPath(cx, cy, rOuter, rInner, a0, a1) {
    var x0o = cx + Math.cos(a0) * rOuter;
    var y0o = cy + Math.sin(a0) * rOuter;
    var x1o = cx + Math.cos(a1) * rOuter;
    var y1o = cy + Math.sin(a1) * rOuter;
    var x0i = cx + Math.cos(a1) * rInner;
    var y0i = cy + Math.sin(a1) * rInner;
    var x1i = cx + Math.cos(a0) * rInner;
    var y1i = cy + Math.sin(a0) * rInner;
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return "M" + x0o + "," + y0o +
           " A" + rOuter + "," + rOuter + " 0 " + large + " 1 " + x1o + "," + y1o +
           " L" + x0i + "," + y0i +
           " A" + rInner + "," + rInner + " 0 " + large + " 0 " + x1i + "," + y1i +
           " Z";
  }

  /**
   * Full-circle ring path — outer circle (clockwise) + inner circle
   * (counter-clockwise), combined into one <path d="…M…M…"> with
   * `fill-rule: evenodd` to punch the inner radius out of the outer.
   * Used for the 100%-single-slice case where arcPath() above
   * degenerates (start point == end point yields an empty render).
   */
  function ringPath(cx, cy, rOuter, rInner) {
    return "M " + (cx - rOuter) + "," + cy +
           " A " + rOuter + "," + rOuter + " 0 1 1 " + (cx + rOuter) + "," + cy +
           " A " + rOuter + "," + rOuter + " 0 1 1 " + (cx - rOuter) + "," + cy + " Z " +
           "M " + (cx - rInner) + "," + cy +
           " A " + rInner + "," + rInner + " 0 1 0 " + (cx + rInner) + "," + cy +
           " A " + rInner + "," + rInner + " 0 1 0 " + (cx - rInner) + "," + cy + " Z";
  }

  return { render: render };
})();
