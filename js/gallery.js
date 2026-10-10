/* gallery.js - Section 3 (#gallery): photo-booth carousel seen from INSIDE a cylinder.
   Photos sit on the inner wall of a ring around the viewer, so side prints curve toward you.
   Input: drag / touch swipe / horizontal wheel or trackpad / arrow keys / buttons. Always snaps to centre.
   Data comes from SITE_CONTENT.gallery (js/content.js). */
(function () {
    'use strict';
    var cfg = window.SITE_CONTENT && window.SITE_CONTENT.gallery;
    var section = document.getElementById('gallery');
    if (!cfg || !section || !cfg.photos || !cfg.photos.length || section.getAttribute('data-built')) return;
    section.setAttribute('data-built', '1');

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var photos = cfg.photos;

    for (var i = photos.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        [photos[i], photos[j]] = [photos[j], photos[i]];
    }
    var N = photos.length;
    var MAX_VISIBLE = 3;           // prints further than this many slots from centre are hidden

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function mod(i) { return ((i % N) + N) % N; }
    function wrap(d) { var h = N / 2; return ((((d + h) % N) + N) % N) - h; }   // shortest signed distance on the ring

    /* ---- DOM ---- */
    var root = el('div', 'pb');
    root.appendChild(el('h2', 'pb__title', cfg.title || 'Photo Booth'));
    if (cfg.subtitle) root.appendChild(el('p', 'pb__subtitle', cfg.subtitle));

    var stage = el('div', 'pb__stage');
    stage.tabIndex = 0;
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-roledescription', 'carousel');
    stage.setAttribute('aria-label', 'Photo booth gallery. Use the left and right arrow keys to browse.');
    var ring = el('div', 'pb__ring');
    var items = photos.map(function (p, i) {
        var card = el('figure', 'pb-card');
        card.setAttribute('data-i', i);
        var img = document.createElement('img');
        img.src = p.src;
        img.alt = p.alt || p.caption || ('Photo ' + (i + 1));
        img.draggable = false;
        img.decoding = 'async';
        card.appendChild(img);
        card.appendChild(el('figcaption', 'pb-card__caption', p.caption || ''));
        ring.appendChild(card);
        return card;
    });
    stage.appendChild(ring);
    root.appendChild(stage);

    var controls = el('div', 'pb__controls');
    var prev = el('button', 'pb__btn', '\u2039');
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Previous photo');
    var count = el('span', 'pb__count');
    count.setAttribute('aria-live', 'polite');
    var next = el('button', 'pb__btn', '\u203A');
    next.type = 'button';
    next.setAttribute('aria-label', 'Next photo');
    controls.appendChild(prev);
    controls.appendChild(count);
    controls.appendChild(next);
    root.appendChild(controls);
    section.appendChild(root);

    /* ---- Geometry ---- */
    var cardW = 0, R = 600, stepDeg = 20, pxPerItem = 200;

    function measure() {
        var w = items[0].offsetWidth;
        if (!w) return;                                   // section still hidden behind the password gate
        cardW = w;
        R = Math.max(w * 3.2, 480);                       // cylinder radius; also the CSS perspective, so the viewer sits at its centre
        stepDeg = 2 * Math.asin(Math.min(1, (w * 1.08) / (2 * R))) * 180 / Math.PI;
        pxPerItem = w * 0.85;
        stage.style.perspective = R + 'px';
        render();
    }

    /* ---- Render: every print is placed on the inner wall of the ring ---- */
    var pos = 0;        // current (animated) position, in photo slots
    var target = 0;     // where we are heading; integer when settled
    var lastActive = -1;

    function render() {
        if (!cardW) return;
        var active = mod(Math.round(pos));
        for (var i = 0; i < N; i++) {
            var it = items[i];
            var d = wrap(i - pos);
            var ad = Math.abs(d);
            if (ad > MAX_VISIBLE) {
                it.style.visibility = 'hidden';
                it.style.opacity = '0';
                continue;
            }
            var theta = -d * stepDeg;                       // negative: photos to the right of centre sit on the right
            var drop = Math.min(d * d, 9) * 11;             // arch: centre highest, sides lower (as in the reference)
            var tilt = d * 2;                               // sides lean outward a little
            it.style.visibility = 'visible';
            it.style.opacity = ad > 2.4 ? String(Math.max(0, 1 - (ad - 2.4) / (MAX_VISIBLE - 2.4))) : '1';
            it.style.transform =
                'translate(-50%, -50%) translateZ(' + R + 'px) rotateY(' + theta.toFixed(3) + 'deg) ' +
                'translateZ(' + (-R) + 'px) translateY(' + drop.toFixed(2) + 'px) rotateZ(' + tilt.toFixed(3) + 'deg)';
        }
        if (active !== lastActive) {
            lastActive = active;
            for (var j = 0; j < N; j++) items[j].classList.toggle('is-active', j === active);
            count.textContent = (active + 1) + ' / ' + N;
        }
    }

    /* ---- Animation loop: eases `pos` toward `target` ---- */
    var raf = 0, lastT = 0, dragging = false;
    function tick(t) {
        var dt = Math.min(0.05, (t - lastT) / 1000) || 0.016;
        lastT = t;
        var diff = target - pos;
        if (reduce || Math.abs(diff) < 0.0008) {
            pos = target;
            raf = 0;
            render();
            return;
        }
        pos += diff * (1 - Math.exp(-dt * (dragging ? 30 : 9)));
        render();
        raf = requestAnimationFrame(tick);
    }
    function kick() {
        if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function snap() { target = Math.round(target); kick(); }
    function go(delta) { target = Math.round(target) + delta; kick(); }

    /* ---- Buttons / keyboard ---- */
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    if (N < 2) { prev.disabled = true; next.disabled = true; }
    stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    });

    /* ---- Pointer drag (mouse + touch). touch-action: pan-y in CSS keeps vertical page scroll working ---- */
    var drag = null, suppressClick = false;

    stage.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var now = performance.now();
        drag = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: now, v: 0, moved: false };
    });
    stage.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved) {
            if (Math.abs(e.clientX - drag.startX) < 6) return;      // below threshold it is still a tap
            drag.moved = true;
            dragging = true;
            stage.classList.add('is-dragging');
            try { stage.setPointerCapture(e.pointerId); } catch (err) { }
        }
        var now = performance.now();
        var dx = e.clientX - drag.lastX;
        var dItems = -dx / pxPerItem;
        target += dItems;
        var dtMs = Math.max(1, now - drag.lastT);
        drag.v = drag.v * 0.7 + (dItems / dtMs) * 0.3;            // items per ms, smoothed
        drag.lastX = e.clientX;
        drag.lastT = now;
        kick();
    });
    function endDrag(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        var moved = drag.moved;
        var v = drag.v;
        drag = null;
        dragging = false;
        stage.classList.remove('is-dragging');
        if (moved) {
            suppressClick = true;
            setTimeout(function () { suppressClick = false; }, 60);
            target = Math.round(target + clamp(v * 140, -2, 2));    // flick momentum, then snap to centre
            kick();
        }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    /* Tap a side print to bring it to the centre */
    stage.addEventListener('click', function (e) {
        if (suppressClick) { suppressClick = false; return; }
        var card = e.target.closest ? e.target.closest('.pb-card') : null;
        if (!card) return;
        var d = wrap(+card.getAttribute('data-i') - Math.round(target));
        if (d !== 0) go(d);
    });

    /* ---- Wheel / trackpad: only horizontal gestures (or Shift+wheel) are captured,
            so ordinary vertical page scrolling is never hijacked ---- */
    var wheelTimer = 0, wheelStart = 0;
    function wheelSnap() {
        // A single mouse-wheel tick only moves a fraction of a slot; bias it to a full step so it never snaps back.
        var moved = target - wheelStart;
        var base = Math.round(wheelStart);
        var steps = Math.abs(moved) > 0.12 ? Math.max(1, Math.round(Math.abs(moved))) * (moved > 0 ? 1 : -1) : 0;
        target = base + steps;
        kick();
    }
    stage.addEventListener('wheel', function (e) {
        var dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!dx) return;
        e.preventDefault();
        if (!wheelTimer) wheelStart = target;
        target += clamp(dx, -120, 120) / (pxPerItem * 1.6);
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(function () { wheelTimer = 0; wheelSnap(); }, 140);
        kick();
    }, { passive: false });

    /* ---- Resize / unhide ---- */
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stage);
    window.addEventListener('resize', measure);
    measure();
})();