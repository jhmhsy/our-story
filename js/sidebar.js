/* sidebar.js - smooth scrolling for the sidebar links + "current section" highlight.
   Add a section: give it an id and add a matching <a href="#id"> in #love-nav. */
(function () {
  var nav = document.getElementById('love-nav');
  if (!nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var targets = links.map(function (a) {
    return document.getElementById(a.getAttribute('href').slice(1));
  });
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  links.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      var target = targets[i];
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion && reduceMotion.matches ? 'auto' : 'smooth',
        block: 'start'
      });
      if (window.history && history.replaceState) history.replaceState(null, '', '#' + target.id);
    });
  });

  function setActive(index) {
    links.forEach(function (a, i) {
      if (i === index) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  if (!('IntersectionObserver' in window)) { setActive(0); return; }

  var ratios = targets.map(function () { return 0; });
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var i = targets.indexOf(entry.target);
      if (i > -1) ratios[i] = entry.intersectionRatio;
    });
    setActive(ratios.indexOf(Math.max.apply(null, ratios)));
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  targets.forEach(function (t) { if (t) observer.observe(t); });
})();
