(function () {
  var PASSWORD = '022023';
  var gate = document.getElementById('password-gate');
  var form = document.getElementById('password-form');
  var input = document.getElementById('password-input');
  var error = document.getElementById('password-error');
  var site = document.getElementById('site-content');

  if (!gate || !form || !input || !site) return;

  function unlock() {
    window.__siteUnlocked = true;
    gate.classList.add('is-hidden');
    site.removeAttribute('hidden');
    // Allow body scroll / focus after unlock
    document.body.style.overflow = '';
    // Re-run fit-tree.js / emoji layout now that the content is visible. This must happen BEFORE the
    // tree animation starts so the seed is drawn using the real --tree-scale.
    try {
      window.dispatchEvent(new Event('resize'));
    } catch (e) { }
    // Start tree animation if the script already registered the starter
    if (typeof window.__startTreeAnimation === 'function') {
      window.__startTreeAnimation();
    }
    // Focus first nav link for a11y
    var firstLink = document.querySelector('#love-nav a');
    if (firstLink) firstLink.focus();
  }

  // Already unlocked this session?
  try {
    if (sessionStorage.getItem('loveSiteUnlocked') === '1') {
      unlock();
      return;
    }
  } catch (e) { }

  document.body.style.overflow = 'hidden';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = (input.value || '').replace(/\s+/g, '');
    if (val === PASSWORD) {
      error.hidden = true;
      try { sessionStorage.setItem('loveSiteUnlocked', '1'); } catch (err) { }
      unlock();
    } else {
      error.hidden = false;
      input.value = '';
      input.focus();
      // brief shake
      input.style.animation = 'none';
      // force reflow
      void input.offsetWidth;
      input.style.animation = 'pw-shake 0.4s ease';
    }
  });

  // Enter is handled by form submit; ensure focus
  input.focus();
})();

/* shake keyframes injected once */
(function () {
  if (document.getElementById('pw-shake-style')) return;
  var s = document.createElement('style');
  s.id = 'pw-shake-style';
  s.textContent =
    '@keyframes pw-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}';
  document.head.appendChild(s);
})();