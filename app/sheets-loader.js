/**
 * sheets-loader.js — Fetches the 10 sheet tabs in parallel and parses
 * them into usable shapes. Uses HLConfig.csvUrlFor(tab) so the same
 * code path works against live published URLs or local fallback CSVs.
 *
 * Public API:
 *   SheetsLoader.loadAll()  →  Promise<{ meta, leaders, contacts,
 *                                         map_countries, roles_donut,
 *                                         agency_donut, country_by_grade,
 *                                         gender_by_grade, gender_trends,
 *                                         region_trends }>
 *
 * Each value is already coerced to the shape the renderers want.
 * Errors on individual tabs are surfaced as empty arrays + a warning
 * in the returned `_warnings` so the dashboard degrades gracefully.
 */

/* global SheetsLoader:true, HLConfig, CSVParser */

var SheetsLoader = (function () {
  "use strict";

  var cache = {}; // { tab: { t: timestamp, csv: string } }

  function fetchCsv(tab) {
    var url = HLConfig.csvUrlFor(tab);
    var cached = cache[tab];
    if (cached && (Date.now() - cached.t) < HLConfig.CACHE_TTL_MS) {
      return Promise.resolve({ tab: tab, csv: cached.csv });
    }
    return fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " for " + tab);
        return r.text();
      })
      .then(function (txt) {
        // Google's gviz endpoint returns 200 with an empty body when the
        // sheet isn't publicly viewable or the tab doesn't exist, and a
        // one-line HTML error page in some other cases. In both cases we
        // want to fall back to the bundled starter CSV.
        if (!txt || !String(txt).trim()) {
          throw new Error("empty response — falling back to local CSV for " + tab);
        }
        if (/^\s*</.test(txt) || txt.indexOf("<HTML>") !== -1) {
          throw new Error("sheet not accessible — falling back to local CSV for " + tab);
        }
        cache[tab] = { t: Date.now(), csv: txt };
        return { tab: tab, csv: txt };
      })
      .catch(function (err) {
        // Retry against the bundled starter CSV so the dashboard renders
        // something even when the sheet hasn't been set up yet.
        var fallback = HLConfig.localFallbackFor && HLConfig.localFallbackFor(tab);
        if (!fallback) throw err;
        console.warn("[SheetsLoader]", err.message + "; using " + fallback);
        return fetch(fallback, { cache: "no-cache" })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status + " for fallback " + tab);
            return r.text();
          })
          .then(function (txt) {
            cache[tab] = { t: Date.now(), csv: txt };
            return { tab: tab, csv: txt };
          });
      });
  }

  /* ── Per-tab parsers ────────────────────────────────────── */

  function parseMeta(csv)     { return CSVParser.parseKeyValue(csv); }
  function parseLeaders(csv)  { return CSVParser.parseRows(csv); }
  function parseContacts(csv) { return CSVParser.parseRows(csv); }
  function parseMapCountries(csv) {
    return CSVParser.parseRows(csv).map(function (r) {
      var hasDhc = String(r.has_dhc || "").trim().toLowerCase();
      return {
        iso3: String(r.iso3 || "").toUpperCase(),
        country: r.country || "",
        primary_role: r.primary_role || "",
        // Truthy if the country also has a Deputy HC — drives the "+ DHC"
        // stripe overlay on the map.
        has_dhc: (hasDhc === "yes" || hasDhc === "true" || hasDhc === "1")
      };
    });
  }
  // [{ label, value }] — for donut/pie
  function parseDonut(csv) {
    return CSVParser.parseRows(csv)
      .map(function (r) {
        return { label: r.label || "", value: CSVParser.num(r.value) || 0 };
      })
      .filter(function (d) { return d.label; });
  }
  // [{ grade, weog, non_weog }] — slide 3 bar chart
  function parseCountryByGrade(csv) {
    return CSVParser.parseRows(csv).map(function (r) {
      return {
        grade: r.grade || "",
        weog: CSVParser.num(r.weog) || 0,
        non_weog: CSVParser.num(r.non_weog) || 0
      };
    });
  }
  // [{ grade, female, male }] — slide 4 bar chart
  function parseGenderByGrade(csv) {
    return CSVParser.parseRows(csv).map(function (r) {
      return {
        grade: r.grade || "",
        female: CSVParser.num(r.female) || 0,
        male: CSVParser.num(r.male) || 0
      };
    });
  }
  // [{ year, female_pct, male_pct }]
  function parseGenderTrends(csv) {
    return CSVParser.parseRows(csv)
      .map(function (r) {
        return {
          year: CSVParser.num(r.year),
          female_pct: CSVParser.num(r.female_pct) || 0,
          male_pct: CSVParser.num(r.male_pct) || 0
        };
      })
      .filter(function (r) { return !isNaN(r.year); });
  }
  // [{ year, africa_pct, apac_pct, eeur_pct, lac_pct, weog_pct }]
  function parseRegionTrends(csv) {
    return CSVParser.parseRows(csv)
      .map(function (r) {
        return {
          year: CSVParser.num(r.year),
          africa_pct: CSVParser.num(r.africa_pct) || 0,
          apac_pct:   CSVParser.num(r.apac_pct)   || 0,
          eeur_pct:   CSVParser.num(r.eeur_pct)   || 0,
          lac_pct:    CSVParser.num(r.lac_pct)    || 0,
          weog_pct:   CSVParser.num(r.weog_pct)   || 0
        };
      })
      .filter(function (r) { return !isNaN(r.year); });
  }

  var PARSERS = {
    meta:             parseMeta,
    leaders:          parseLeaders,
    contacts:         parseContacts,
    map_countries:    parseMapCountries,
    roles_donut:      parseDonut,
    agency_donut:     parseDonut,
    country_by_grade: parseCountryByGrade,
    gender_by_grade:  parseGenderByGrade,
    gender_trends:    parseGenderTrends,
    region_trends:    parseRegionTrends
  };

  function loadAll() {
    var warnings = [];
    var result = { _warnings: warnings };

    var jobs = HLConfig.TABS.map(function (tab) {
      return fetchCsv(tab)
        .then(function (x) {
          try {
            result[tab] = PARSERS[tab](x.csv);
          } catch (err) {
            warnings.push("Parse error in tab \"" + tab + "\": " + err.message);
            result[tab] = Array.isArray(result[tab]) ? [] : (tab === "meta" ? {} : []);
          }
        })
        .catch(function (err) {
          warnings.push("Failed to load tab \"" + tab + "\": " + err.message);
          result[tab] = (tab === "meta") ? {} : [];
        });
    });

    return Promise.all(jobs).then(function () { return result; });
  }

  function clearCache() { cache = {}; }

  return { loadAll: loadAll, clearCache: clearCache };
})();
