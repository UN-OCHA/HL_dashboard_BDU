/**
 * render/kpis.js — Renders the 5 KPI cards on Page 1 from either
 * explicit values in the `meta` tab OR computed fallbacks from the
 * roster/map data.
 *
 * Meta keys (override values when present):
 *   kpi_total_leaders, kpi_pct_female, kpi_pct_underrepresented,
 *   kpi_deputy_hcs, kpi_countries
 */

/* global RenderKpis:true */

var RenderKpis = (function () {
  "use strict";

  function render(state) {
    var row = document.getElementById("kpi-row");
    if (!row) return;
    while (row.firstChild) row.removeChild(row.firstChild);

    var kpis = compute(state);
    kpis.forEach(function (k) { row.appendChild(cardEl(k)); });
  }

  function compute(state) {
    var meta = state.meta || {};
    var leaders = state.leaders || [];
    var countries = state.map_countries || [];

    // Total active leaders
    var total = numOr(meta.kpi_total_leaders, leaders.length);

    // % Female
    var femaleCount = leaders.filter(function (l) {
      return /^f/i.test(String(l.gender || ""));
    }).length;
    var pctF = leaders.length > 0 ? Math.round((femaleCount / leaders.length) * 100) : 0;
    pctF = numOr(meta.kpi_pct_female, pctF);

    // % Under-represented (non-WEOG)
    var nonWeog = leaders.filter(function (l) {
      var w = String(l.weog || "").toLowerCase();
      return w === "non-weog" || w === "non weog" || w === "false" || w === "0" || w === "no";
    }).length;
    var pctU = leaders.length > 0 ? Math.round((nonWeog / leaders.length) * 100) : 0;
    pctU = numOr(meta.kpi_pct_underrepresented, pctU);

    // Deputy HCs
    var dhcs = leaders.filter(function (l) {
      var p = String(l.position || "").toLowerCase();
      var h = String(l.hat3 || "").toLowerCase();
      return /deputy/.test(p) || /deputy hc/.test(h) || h === "dhc";
    }).length;
    dhcs = numOr(meta.kpi_deputy_hcs, dhcs);

    // Countries
    var ctrySet = {};
    (countries.length > 0 ? countries : leaders).forEach(function (r) {
      var c = (r.iso3 || r.country || "").trim();
      if (c) ctrySet[c] = true;
    });
    var countryCount = numOr(meta.kpi_countries, Object.keys(ctrySet).length);

    return [
      { value: total,        unit: "",  label: "Humanitarian leaders",            icon: "leadership" },
      { value: pctF,         unit: "%", label: "Female leaders",                  icon: "gender" },
      { value: pctU,         unit: "%", label: "From under-represented countries", icon: "country" },
      { value: dhcs,         unit: "",  label: "Deputy humanitarian coordinators", icon: "coordination" },
      { value: countryCount, unit: "",  label: "Countries with hum. leadership",   icon: "map" }
    ];
  }

  // Inline the humanitarian icon's SVG so it inherits colour via CSS and
  // rasterises cleanly into PDF / PNG export. Cached per-session.
  var iconCache = {};
  function iconSvg(key) {
    if (iconCache[key] !== undefined) return Promise.resolve(iconCache[key]);
    return fetch("assets/icons/" + key + ".svg")
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (txt) { iconCache[key] = txt; return txt; })
      .catch(function () { return ""; });
  }

  function cardEl(k) {
    var el = document.createElement("div");
    el.className = "kpi";

    var icon = document.createElement("div");
    icon.className = "kpi-icon";
    el.appendChild(icon);
    if (k.icon) {
      iconSvg(k.icon).then(function (svg) {
        if (svg) icon.innerHTML = svg;
      });
    }

    var v = document.createElement("div");
    v.className = "value";
    v.textContent = String(k.value);
    if (k.unit) {
      var u = document.createElement("span");
      u.className = "unit";
      u.textContent = k.unit;
      v.appendChild(u);
    }
    el.appendChild(v);

    var l = document.createElement("div");
    l.className = "label";
    l.textContent = k.label;
    el.appendChild(l);
    return el;
  }

  function numOr(raw, fallback) {
    if (raw === undefined || raw === null || raw === "") return fallback;
    var n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? fallback : n;
  }

  return { render: render };
})();
