/* fit-tree.js - scales the fixed-size tree stage down to fit the viewport.
   It only sets the --tree-scale CSS variable; the animation code is untouched. */
(function () {
  var STAGE_W = 1100, STAGE_H = 690;
  var section = document.getElementById('tree-animation');
  if (!section) return;

  function px(v) { return parseFloat(v) || 0; }

  function fit() {
    var cs = window.getComputedStyle(section);
    var availW = section.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
    var availH = window.innerHeight - px(cs.paddingTop) - px(cs.paddingBottom);
    var s = Math.min(1, availW / STAGE_W, availH / STAGE_H);
    if (!(s > 0)) s = 1;
    document.documentElement.style.setProperty('--tree-scale', s.toFixed(4));
  }

  fit();
  window.addEventListener('resize', fit);
})();
