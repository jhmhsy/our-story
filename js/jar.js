/* jar.js - Love Jar section (#jar): a glass bowl full of folded notes.
   Data comes from SITE_CONTENT.jar (js/content.js). Click the bowl -> a random note unfolds.
   Paper fold technique inspired by "CSS3 Paper Fold" by Jesse Wells (jessenwells). */
(function () {
    'use strict';
    var cfg = window.SITE_CONTENT && window.SITE_CONTENT.jar;
    var section = document.getElementById('jar');
    if (!cfg || !section || section.getAttribute('data-built')) return;
    section.setAttribute('data-built', '1');

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Accept plain strings or { text: '...' } objects (handy for an admin editor)
    var notes = (cfg.notes || []).map(function (n) {
        return typeof n === 'string' ? n : (n && n.text) || '';
    }).filter(function (t) { return t.trim(); });

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    var NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs) {
        var n = document.createElementNS(NS, tag);
        for (var k in attrs) n.setAttribute(k, attrs[k]);
        return n;
    }
    function rand(a, b) { return a + Math.random() * (b - a); }

    /* ---- Jar artwork (SVG, scales with its container) ---- */
    var BOWL = 'M88 40 C28 72 8 130 10 172 C14 246 80 294 150 294 C220 294 286 246 290 172 C292 130 272 72 212 40 Z';
    var PAPER_COLORS = ['#fff7e6', '#ffd6e6', '#ffe9a8', '#d8f0ff', '#e5d9ff', '#ffd9c7', '#ffffff'];

    function halfWidth(y) {                               // approx. inner half-width of the bowl at height y
        if (y >= 170) {
            var d = (y - 170) / 124;
            return 138 * Math.sqrt(Math.max(0, 1 - d * d));
        }
        return 138 - (170 - y) * (66 / 130);
    }

    function buildJar(count) {
        var svg = svgEl('svg', { viewBox: '0 0 300 316', 'aria-hidden': 'true', focusable: 'false' });

        var defs = svgEl('defs', {});
        var grad = svgEl('linearGradient', { id: 'jar-glass', x1: '0', y1: '0', x2: '1', y2: '1' });
        [['0', '.55'], ['.5', '.14'], ['1', '.34']].forEach(function (s) {
            grad.appendChild(svgEl('stop', { offset: s[0], 'stop-color': '#ffffff', 'stop-opacity': s[1] }));
        });
        defs.appendChild(grad);
        var clip = svgEl('clipPath', { id: 'jar-clip' });
        clip.appendChild(svgEl('path', { d: BOWL }));
        defs.appendChild(clip);
        svg.appendChild(defs);

        svg.appendChild(svgEl('ellipse', { cx: '150', cy: '306', rx: '92', ry: '8', fill: 'rgba(150,30,90,0.25)' }));
        svg.appendChild(svgEl('ellipse', { cx: '150', cy: '40', rx: '62', ry: '13', fill: 'rgba(120,20,70,0.10)' }));   // far side of the opening

        /* folded notes, piled from the bottom; more notes -> fuller jar (max 60 drawn) */
        var drawn = Math.min(count, 60);
        var fill = Math.max(50, Math.min(185, drawn * 10));
        var top = 272 - fill;
        var pts = [];
        for (var i = 0; i < drawn; i++) {
            var y = rand(top, 272);
            var hw = Math.max(8, halfWidth(y) - 20);
            pts.push({ x: 150 + rand(-hw, hw), y: y, r: rand(-70, 70), c: PAPER_COLORS[i % PAPER_COLORS.length] });
        }
        pts.sort(function (a, b) { return a.y - b.y; });  // lower notes are drawn last, so they sit in front

        var g = svgEl('g', { 'clip-path': 'url(#jar-clip)' });
        pts.forEach(function (p) {
            var n = svgEl('g', { transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') rotate(' + p.r.toFixed(1) + ')' });
            n.appendChild(svgEl('rect', { x: '-16', y: '-11', width: '32', height: '22', rx: '2', fill: p.c, stroke: 'rgba(150,30,90,0.3)', 'stroke-width': '1' }));
            n.appendChild(svgEl('path', { d: 'M-16 0 H16 M0 -11 V11', stroke: 'rgba(150,30,90,0.18)', 'stroke-width': '1', fill: 'none' }));
            g.appendChild(n);
        });
        svg.appendChild(g);

        /* glass over the notes */
        svg.appendChild(svgEl('path', { d: BOWL, fill: 'url(#jar-glass)', stroke: 'rgba(255,255,255,0.9)', 'stroke-width': '3' }));
        svg.appendChild(svgEl('path', { d: 'M40 120 C24 150 22 190 34 222', fill: 'none', stroke: 'rgba(255,255,255,0.75)', 'stroke-width': '6', 'stroke-linecap': 'round' }));
        svg.appendChild(svgEl('path', { d: 'M262 150 C268 175 264 200 254 222', fill: 'none', stroke: 'rgba(255,255,255,0.4)', 'stroke-width': '3', 'stroke-linecap': 'round' }));
        svg.appendChild(svgEl('ellipse', { cx: '64', cy: '96', rx: '9', ry: '5', fill: 'rgba(255,255,255,0.7)', transform: 'rotate(-35 64 96)' }));
        svg.appendChild(svgEl('ellipse', { cx: '150', cy: '40', rx: '62', ry: '13', fill: 'none', stroke: 'rgba(255,255,255,0.95)', 'stroke-width': '3' }));   // rim
        return svg;
    }

    /* ---- Section DOM ---- */
    var wrap = el('div', 'jar-wrap');
    wrap.appendChild(el('h2', 'jar__title', cfg.title || 'Things I Love About You'));
    if (cfg.subtitle) wrap.appendChild(el('p', 'jar__subtitle', cfg.subtitle));

    var jarBtn = el('button', 'jar-btn');
    jarBtn.type = 'button';
    jarBtn.setAttribute('aria-label', 'Pull a random note out of the jar');
    jarBtn.appendChild(buildJar(notes.length));
    wrap.appendChild(jarBtn);

    var hint = el('p', 'jar__hint', cfg.hint || 'Tap the jar to pull out a note');
    if (!notes.length) {
        jarBtn.disabled = true;
        hint.textContent = 'The jar is waiting for its first note \uD83D\uDC8C';
    }
    wrap.appendChild(hint);
    section.appendChild(wrap);

    /* ---- Modal with the unfolding note ---- */
    var modal = el('div', 'jar-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'A note from the jar');
    modal.setAttribute('aria-hidden', 'true');
    var inner = el('div', 'jar-modal__inner');

    var stage = el('div', 'jn-stage');
    var p1 = el('div', 'jn-panel jn-panel--1');
    var p2 = el('div', 'jn-panel jn-panel--2');
    var p3 = el('div', 'jn-panel jn-panel--3');
    p2.appendChild(p3);
    p1.appendChild(p2);
    stage.appendChild(p1);

    var text = el('div', 'jn-text');
    text.setAttribute('aria-live', 'polite');
    var tp = el('p', 'jn-text__p');
    text.appendChild(tp);
    stage.appendChild(text);
    inner.appendChild(stage);

    var btns = el('div', 'jar-modal__btns');
    var moreBtn = el('button', 'jar-modal__btn', cfg.moreLabel || 'Another one \uD83D\uDC8C');
    moreBtn.type = 'button';
    var closeBtn = el('button', 'jar-modal__btn jar-modal__btn--ghost', cfg.closeLabel || 'Close \u2715');
    closeBtn.type = 'button';
    btns.appendChild(moreBtn);
    btns.appendChild(closeBtn);
    inner.appendChild(btns);
    modal.appendChild(inner);
    section.appendChild(modal);

    /* ---- Behaviour ---- */
    var last = -1, shown = false, busy = false, shaking = false, timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function pick() {
        if (notes.length === 1) return 0;
        var i;
        do { i = Math.floor(Math.random() * notes.length); } while (i === last);
        return i;
    }
    function setNote() {
        last = pick();
        tp.textContent = notes[last];
    }
    function unfoldAfter(ms) {
        later(function () {
            stage.classList.add('is-open');
            later(function () { busy = false; }, reduce ? 0 : 1900);
        }, reduce ? 30 : ms);
    }

    function openModal() {
        if (shown || busy || !notes.length) return;
        shown = true;
        busy = true;
        clearTimers();
        stage.classList.remove('is-open');
        setNote();
        modal.classList.add('is-shown');
        modal.setAttribute('aria-hidden', 'false');
        unfoldAfter(650);
        try { closeBtn.focus({ preventScroll: true }); } catch (e) { }
    }

    function another() {
        if (!shown || busy) return;
        busy = true;
        clearTimers();
        stage.classList.remove('is-open');                // fold back up, swap the text, unfold again
        later(function () { setNote(); unfoldAfter(150); }, reduce ? 30 : 1500);
    }

    function closeModal() {
        if (!shown) return;
        shown = false;
        busy = false;
        clearTimers();
        modal.classList.remove('is-shown');
        modal.setAttribute('aria-hidden', 'true');
        later(function () { stage.classList.remove('is-open'); }, 350);
        try { jarBtn.focus({ preventScroll: true }); } catch (e) { }
    }

    jarBtn.addEventListener('click', function () {
        if (shown || shaking || !notes.length) return;
        shaking = true;
        jarBtn.classList.remove('is-shaking');
        void jarBtn.offsetWidth;                          // restart the animation
        jarBtn.classList.add('is-shaking');
        setTimeout(function () {
            jarBtn.classList.remove('is-shaking');
            shaking = false;
            openModal();
        }, reduce ? 0 : 650);
    });
    moreBtn.addEventListener('click', another);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target === inner) closeModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();
    });
})();