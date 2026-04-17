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
      var h = document.createElement("h3");
      h.textContent = section;
      col.appendChild(h);
      var ul = document.createElement("ul");
      HLConfig.RESOURCES[section].forEach(function (item) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = item.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = item.label;
        li.appendChild(a);
        ul.appendChild(li);
      });
      col.appendChild(ul);
      root.appendChild(col);
    });
  }

  return { render: render };
})();
