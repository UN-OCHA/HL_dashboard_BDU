/**
 * csv-parser.js — Minimal RFC-4180-ish CSV parser.
 *
 * Parses a CSV string into an array of row-objects keyed by the
 * first-row header names (lowercased, trimmed).
 *
 *   parseCSV("a,b\n1,2\n3,4")  →  [ { a: "1", b: "2" }, { a: "3", b: "4" } ]
 *
 * Handles quoted fields, embedded commas, escaped quotes (""), CRLF.
 */

/* global CSVParser:true */

var CSVParser = (function () {
  "use strict";

  function tokenize(text) {
    var rows = [];
    var row  = [];
    var field = "";
    var inQ = false;
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === ",") { row.push(field); field = ""; i++; continue; }
      if (ch === "\r") { i++; continue; }
      if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += ch; i++;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }

  function parseRows(text) {
    if (!text || !String(text).trim()) return [];
    var rows = tokenize(String(text));
    if (rows.length === 0) return [];

    // Skip any leading rows that look like description banners — a row
    // where only 1 cell is non-empty AND the row has ≥ 2 columns. Google
    // Sheets merged cells export that way. The first non-banner row is
    // the real header.
    var headerIdx = 0;
    while (headerIdx < rows.length && isBannerRow(rows[headerIdx])) headerIdx++;
    if (headerIdx >= rows.length) return [];

    var headers = rows[headerIdx].map(function (h) {
      return String(h).trim().toLowerCase();
    });
    var out = [];
    for (var i = headerIdx + 1; i < rows.length; i++) {
      var r = rows[i];
      var empty = true;
      for (var k = 0; k < r.length; k++) if (String(r[k]).trim() !== "") { empty = false; break; }
      if (empty) continue;
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = r[j] !== undefined ? String(r[j]).trim() : "";
      }
      out.push(obj);
    }
    return out;
  }

  function isBannerRow(row) {
    if (!row || row.length < 2) return false;
    var nonEmpty = 0;
    for (var i = 0; i < row.length; i++) {
      if (String(row[i]).trim() !== "") nonEmpty++;
      if (nonEmpty > 1) return false;
    }
    return nonEmpty === 1;
  }

  /** Parse a "key,value" sheet (one setting per row) into a flat object. */
  function parseKeyValue(text) {
    var rows = parseRows(text);
    var obj = {};
    rows.forEach(function (r) {
      var k = r.key || r.Key || r.KEY;
      if (k) obj[k] = r.value !== undefined ? r.value : "";
    });
    return obj;
  }

  /** Coerce a string to a number; empty/non-numeric → NaN. */
  function num(s) {
    if (s === null || s === undefined) return NaN;
    var t = String(s).replace(/[\s,]/g, "");
    if (t === "") return NaN;
    var n = Number(t);
    return isNaN(n) ? NaN : n;
  }

  return { parseRows: parseRows, parseKeyValue: parseKeyValue, num: num };
})();
