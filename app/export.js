/**
 * export.js — PNG per page + full-report PDF.
 *
 * Usage (wired by main.js):
 *   Exporter.exportPage(pageEl)  → downloads {pageName}.png
 *   Exporter.exportPdf()         → downloads HL_Snapshot_{YYYY-MM}.pdf
 */

/* global Exporter:true, html2canvas, jspdf */

var Exporter = (function () {
  "use strict";

  function captureOptions() {
    return {
      scale: 2,
      useCORS: true,
      backgroundColor: "#FFFFFF",
      logging: false,
      // Ensure SVGs rasterise at the full DPI
      windowWidth: document.documentElement.scrollWidth
    };
  }

  function exportPage(pageEl) {
    if (!window.html2canvas) {
      alert("PNG export library not loaded — please reload the page and try again.");
      return Promise.reject(new Error("html2canvas missing"));
    }
    var name = (pageEl.getAttribute("data-page") || "page") + ".png";
    // Temporarily switch the dashboard into A4 layout mode so the PNG
    // comes out exactly 1123 × 794 (A4 landscape at 96 dpi × scale).
    // The on-screen fluid layout is restored in `finally`.
    return withA4Mode(function () {
      return html2canvas(pageEl, captureOptions()).then(function (canvas) {
        var link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = filename(name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    });
  }

  // Switches the dashboard into A4 mode (wraps pages + adds the class),
  // waits for layout + chart re-render, invokes the callback, then
  // unconditionally restores the fluid layout. Returns the callback's
  // promise value.
  function withA4Mode(fn) {
    var pages = document.querySelector(".pages");
    if (!pages) return fn();
    var hadClass = pages.classList.contains("a4-mode");

    // Wrap each page's content in a `.page-inner` div (idempotent —
    // skips pages that already have an inner wrapper). `.page-foot`
    // and `.page-png-btn` stay OUTSIDE the wrapper so they can anchor
    // to the outer A4 frame (not the scaled inner).
    document.querySelectorAll(".pages .page").forEach(function (page) {
      if (page.firstElementChild && page.firstElementChild.classList.contains("page-inner")) return;
      var outside = [];
      page.querySelectorAll(":scope > .page-foot, :scope > .page-png-btn").forEach(function (el) {
        outside.push(el);
      });
      outside.forEach(function (el) { page.removeChild(el); });
      var inner = document.createElement("div");
      inner.className = "page-inner";
      while (page.firstChild) inner.appendChild(page.firstChild);
      page.appendChild(inner);
      outside.forEach(function (el) { page.appendChild(el); });
    });
    pages.classList.add("a4-mode");

    return new Promise(function (resolve) { requestAnimationFrame(resolve); })
      .then(function () { return new Promise(function (r) { setTimeout(r, 60); }); })
      .then(function () {
        if (typeof window.__HL_rerenderForSize__ === "function") {
          window.__HL_rerenderForSize__();
        }
        return new Promise(function (r) { setTimeout(r, 80); });
      })
      .then(fn)
      .finally(function () {
        if (!hadClass) pages.classList.remove("a4-mode");
        document.querySelectorAll(".pages .page > .page-inner").forEach(function (inner) {
          var page = inner.parentElement;
          while (inner.firstChild) page.insertBefore(inner.firstChild, inner);
          inner.remove();
        });
        setTimeout(function () {
          if (typeof window.__HL_rerenderForSize__ === "function") {
            window.__HL_rerenderForSize__();
          }
        }, 60);
      });
  }

  /* Vector PDF — just hand off to the browser's print pipeline. The
     global `beforeprint` listener below installs `.a4-mode` and re-
     renders the charts at A4 container widths, so the print preview
     always matches what PNG export produces — no matter whether the
     user clicked our "Download PDF" button or hit ⌘P / Ctrl-P in the
     browser menu. */
  function exportPdf() {
    window.print();
    return Promise.resolve();
  }

  // ── Global print lifecycle ────────────────────────────────
  // Fires for every print trigger (button, ⌘P, browser menu). Switches
  // the dashboard into A4 mode by:
  //   1. Wrapping each `.page`'s content in a `.page-inner` div sized
  //      to the natural fluid dimensions (1500 × 1061 px).
  //   2. Adding `.a4-mode` so CSS locks `.page` to 1123 × 794 and
  //      applies `transform: scale(0.7487)` to `.page-inner` — the
  //      whole section renders the exact on-screen layout, just
  //      proportionally smaller to fit an A4 landscape sheet.
  //
  // Wrapper + CSS transform is used instead of `zoom` because `zoom`
  // is inconsistently applied in the browser print pipeline (Safari
  // drops it entirely, Firefox honours it only since 126). `transform:
  // scale` + a fixed-size outer container is 100 % reliable.
  (function installPrintListeners() {
    function wrapPages() {
      document.querySelectorAll(".pages .page").forEach(function (page) {
        if (page.firstElementChild && page.firstElementChild.classList.contains("page-inner")) return;
        // Keep the page-foot and the per-page PNG button OUTSIDE the
        // scaled wrapper so they can be absolutely positioned against
        // the outer 1123 × 794 A4 frame (not the inner 1500-wide box
        // that gets transformed-scaled).
        var outside = [];
        page.querySelectorAll(":scope > .page-foot, :scope > .page-png-btn").forEach(function (el) {
          outside.push(el);
        });
        outside.forEach(function (el) { page.removeChild(el); });

        var inner = document.createElement("div");
        inner.className = "page-inner";
        while (page.firstChild) inner.appendChild(page.firstChild);
        page.appendChild(inner);

        // Re-append the kept-outside elements at the end of the page.
        outside.forEach(function (el) { page.appendChild(el); });
      });
    }
    function unwrapPages() {
      document.querySelectorAll(".pages .page > .page-inner").forEach(function (inner) {
        var page = inner.parentElement;
        // Move inner's children BEFORE the inner (preserves DOM order
        // so .page-foot lands back after the content, not before it).
        while (inner.firstChild) page.insertBefore(inner.firstChild, inner);
        inner.remove();
      });
    }

    function onBeforePrint() {
      var pages = document.querySelector(".pages");
      if (!pages) return;
      wrapPages();
      pages.classList.add("a4-mode");
      if (typeof window.__HL_rerenderForSize__ === "function") {
        window.__HL_rerenderForSize__();
      }
    }
    function onAfterPrint() {
      var pages = document.querySelector(".pages");
      if (!pages) return;
      pages.classList.remove("a4-mode");
      unwrapPages();
      if (typeof window.__HL_rerenderForSize__ === "function") {
        window.__HL_rerenderForSize__();
      }
    }
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    // Safari: matchMedia("print") fires when the preview opens.
    if (window.matchMedia) {
      var mq = window.matchMedia("print");
      if (mq.addEventListener) {
        mq.addEventListener("change", function (e) {
          if (e.matches) onBeforePrint();
          else onAfterPrint();
        });
      }
    }
  })();

  function filename(base) {
    var d = new Date();
    var stamp = d.toISOString().slice(0, 10);
    if (base.indexOf(".") === -1) return stamp + "_" + base;
    var dot = base.lastIndexOf(".");
    return base.slice(0, dot) + "_" + stamp + base.slice(dot);
  }

  return { exportPage: exportPage, exportPdf: exportPdf };
})();
