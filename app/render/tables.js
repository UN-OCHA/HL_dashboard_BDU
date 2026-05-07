/**
 * render/tables.js — Renders the Leadership list (Page 5) and
 * the Contact directory (Page 6) with client-side search + sort.
 */

/* global RenderTables:true */

var RenderTables = (function () {
  "use strict";

  // `cls`: optional CSS class added to TD for the v2 cell-type styling
  // (e.g. country in navy + 500 weight, position in Roboto Condensed,
  // email in blue). Class names match the `td-*` rules in styles.css.
  var LEADERS_COLS = [
    { key: "country",      label: "Country",      cls: "td-country" },
    { key: "duty_station", label: "Duty station" },
    { key: "name",         label: "Name" },
    { key: "position",     label: "Position",     cls: "td-position" }
  ];
  var CONTACTS_COLS = [
    { key: "country",  label: "Country",  cls: "td-country" },
    { key: "name",     label: "Name" },
    { key: "position", label: "Position", cls: "td-position" },
    { key: "email",    label: "Email",    kind: "email", cls: "td-email" },
    { key: "phone",    label: "Phone" },
    { key: "pa_name",  label: "Special assistant", linked: "pa_phone" },
    { key: "ea_name",  label: "Executive assistant", linked: "ea_phone" }
  ];

  function render(state) {
    bindTable("leaders-table", "leaders-search", "leaders-count", state.leaders || [], LEADERS_COLS);
    bindTable("contacts-table", "contacts-search", "contacts-count", state.contacts || [], CONTACTS_COLS);
  }

  function bindTable(tableId, searchId, countId, data, cols) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var tbody = table.querySelector("tbody");
    var search = document.getElementById(searchId);
    var countEl = countId ? document.getElementById(countId) : null;

    // ── Hide empty columns ──
    // For a friendlier first-paint when Valijon hasn't yet filled all
    // columns of a sheet (e.g. emails on the contacts tab are blank
    // for the first month), drop columns whose data + linked-data
    // cells are 100 % empty. The TH for that column is also hidden so
    // the header row stays aligned. Columns auto-reappear when the
    // sheet starts populating them.
    cols = cols.filter(function (c) {
      var anyValue = data.some(function (row) {
        var v = String(row[c.key] || "").trim();
        if (v) return true;
        if (c.linked) {
          var lv = String(row[c.linked] || "").trim();
          if (lv) return true;
        }
        return false;
      });
      var th = table.querySelector('thead th[data-sort="' + c.key + '"]');
      if (th) th.style.display = anyValue ? "" : "none";
      return anyValue;
    });
    if (cols.length === 0) {
      // Defensive: every column was empty. Show at least the first
      // column so the table doesn't collapse to nothing.
      cols = [cols[0] || { key: "country", label: "Country" }];
    }

    var state = { sortKey: cols[0].key, sortDir: "asc", query: "" };

    function redraw() {
      var q = state.query.toLowerCase();
      var filtered = q
        ? data.filter(function (row) {
            return cols.some(function (c) {
              return String(row[c.key] || "").toLowerCase().indexOf(q) !== -1;
            });
          })
        : data.slice();
      filtered.sort(function (a, b) {
        var av = String(a[state.sortKey] || "").toLowerCase();
        var bv = String(b[state.sortKey] || "").toLowerCase();
        if (av < bv) return state.sortDir === "asc" ? -1 : 1;
        if (av > bv) return state.sortDir === "asc" ?  1 : -1;
        return 0;
      });

      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      // Leaders table (Page 5) gets a numeric # column matching the PPT.
      var showNumCol = table.querySelector("thead .col-num") !== null;
      filtered.forEach(function (row, idx) {
        var tr = document.createElement("tr");
        if (showNumCol) {
          var tdNum = document.createElement("td");
          tdNum.className = "col-num";
          tdNum.textContent = String(idx + 1);
          tr.appendChild(tdNum);
        }
        cols.forEach(function (c) {
          var td = document.createElement("td");
          if (c.cls) td.classList.add(c.cls);
          var v = (row[c.key] == null ? "" : String(row[c.key])).trim();
          if (c.kind === "email" && v) {
            var a = document.createElement("a");
            a.href = "mailto:" + v;
            a.textContent = v;
            td.appendChild(a);
          } else if (c.linked) {
            // Compose "name\nphone" where both exist; otherwise fall back to dash.
            var nameTxt = v;
            var phoneTxt = (row[c.linked] || "").toString().trim();
            if (!nameTxt && !phoneTxt) {
              td.innerHTML = '<span class="td-missing">—</span>';
            } else {
              if (nameTxt) td.appendChild(document.createTextNode(nameTxt));
              else td.appendChild(document.createTextNode(""));
              if (phoneTxt) {
                td.appendChild(document.createElement("br"));
                var small = document.createElement("span");
                small.className = "td-sub";
                small.textContent = phoneTxt;
                td.appendChild(small);
              }
            }
          } else if (!v) {
            td.innerHTML = '<span class="td-missing">—</span>';
          } else {
            td.textContent = v;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      // Header sort indicators
      table.querySelectorAll("th").forEach(function (th) {
        th.classList.remove("sort-asc", "sort-desc");
        if (th.getAttribute("data-sort") === state.sortKey) {
          th.classList.add(state.sortDir === "asc" ? "sort-asc" : "sort-desc");
        }
      });

      // Count badge in the toolbar — "X of Y" or just "Y rows" if unfiltered.
      if (countEl) {
        countEl.textContent = q
          ? filtered.length + " of " + data.length
          : data.length + " " + (data.length === 1 ? "row" : "rows");
      }
    }

    // Wire header clicks for sort
    table.querySelectorAll("th[data-sort]").forEach(function (th) {
      th.onclick = function () {
        var k = th.getAttribute("data-sort");
        if (state.sortKey === k) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = k;
          state.sortDir = "asc";
        }
        redraw();
      };
    });

    if (search) {
      search.oninput = function (e) {
        state.query = e.target.value || "";
        redraw();
      };
    }

    redraw();
  }

  return { render: render };
})();
