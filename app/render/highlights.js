/**
 * render/highlights.js — Injects the monthly highlight text from
 * meta.monthly_highlight (plain text, basic markdown: **bold** and [text](url)).
 */

/* global RenderHighlights:true */

var RenderHighlights = (function () {
  "use strict";

  function render(state) {
    var m = state.meta || {};

    // Page 2 — monthly highlight card (existing behaviour).
    var body = document.getElementById("highlight-body");
    if (body) {
      var raw = m.monthly_highlight ||
        "This month's Humanitarian Leadership highlight will appear here once it is added to the Google Sheet.";
      body.innerHTML = mdLite(raw);
    }

    // Page 1 — OVERVIEW + LEADERSHIP ON THE MOVE (new).
    // Both come from `meta`. Each cell supports the same minimal markdown
    // + newline → <br> as the monthly highlight.
    setHtml("overview-text",
      m.overview || "Add your monthly overview in the Google Sheet meta tab.");
    setHtml("leadership-on-move",
      m.leadership_on_the_move || "Add leadership-on-the-move entries in the Google Sheet meta tab.");

    // Pages 3 & 4 — narrative observation sidebars (from PPT copy).
    setHtml("note-characteristics",
      m.note_characteristics || "Add a short narrative about the current leadership composition in the Google Sheet meta tab.");
    setHtml("note-trends",
      m.note_trends || "Add a short narrative about long-term trends in the Google Sheet meta tab.");
  }

  function setHtml(id, raw) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = mdLite(raw);
  }

  // Minimal markdown: paragraphs (blank line), **bold**, [text](url),
  // and single \n inside a paragraph → <br>. HTML is escaped first so
  // user-entered text can never smuggle in markup.
  function mdLite(text) {
    var safe = String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // Split into paragraphs on blank lines.
    var paras = safe.split(/\n\s*\n/).map(function (p) { return p.trim(); })
                    .filter(Boolean);
    return paras.map(function (p) {
      p = p.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      p = p.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>');
      p = p.replace(/\n/g, "<br>");
      return "<p>" + p + "</p>";
    }).join("");
  }

  return { render: render };
})();
