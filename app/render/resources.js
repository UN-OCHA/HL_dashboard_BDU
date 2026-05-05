/**
 * render/resources.js — Static Resources section on Page 7.
 * Content lives in HLConfig.RESOURCES so non-developers can edit
 * it in one place (config.js).
 */

/* global RenderResources:true, HLConfig */

var RenderResources = (function () {
  "use strict";

  function render() {
    var root = document.getElementById("resources");
    if (!root) return;
    while (root.firstChild) root.removeChild(root.firstChild);

    Object.keys(HLConfig.RESOURCES).forEach(function (section) {
      var col = document.createElement("div");
      col.className = "resources__col";

      // Heading: title with a 2px navy bottom rule (per v2 design).
      var head = document.createElement("div");
      head.className = "resources__head";
      var h = document.createElement("h3");
      h.className = "resources__title";
      h.textContent = section;
      head.appendChild(h);
      col.appendChild(head);

      // Items rendered as the shared .link-row primitive.
      HLConfig.RESOURCES[section].forEach(function (item) {
        var a = document.createElement("a");
        a.className = "link-row";
        a.href = item.url;
        a.target = "_blank";
        a.rel = "noopener";
        var label = document.createElement("span");
        label.textContent = item.label;
        a.appendChild(label);
        var trail = document.createElement("span");
        trail.className = "link-row__trail";
        trail.setAttribute("aria-hidden", "true");
        trail.textContent = "↗";
        a.appendChild(trail);
        col.appendChild(a);
      });

      root.appendChild(col);
    });
  }

  return { render: render };
})();
