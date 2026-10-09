/* letter.js - interactive love letter inside #poem-panel (Section 4, left column).
   Text comes from SITE_CONTENT.letter (js/content.js).
   Flow: click envelope -> seal breaks, flap opens, paper rises -> letter fades in -> typewriter.
   "Close" folds everything back so the envelope can be opened again. */
(function () {
    'use strict';
    var cfg = window.SITE_CONTENT && window.SITE_CONTENT.letter;
    var panel = document.getElementById('poem-panel');
    if (!cfg || !panel || panel.getAttribute('data-built')) return;
    panel.setAttribute('data-built', '1');

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    /* ---- Build the DOM ---- */
    panel.classList.add('lv-root');
    var scene = el('div', 'lv-scene');

    var env = el('div', 'lv-env');
    env.appendChild(el('div', 'lv-env__back'));
    var envPaper = el('div', 'lv-env__paper');
    envPaper.appendChild(el('span', 'lv-env__paper-heart', '\u2665'));
    env.appendChild(envPaper);
    env.appendChild(el('div', 'lv-env__front'));
    var flap = el('div', 'lv-env__flap');
    flap.appendChild(el('div', 'lv-env__flap-shape'));
    flap.appendChild(el('span', 'lv-env__seal', '\u2665'));
    env.appendChild(flap);
    var openBtn = el('button', 'lv-env__btn');
    openBtn.type = 'button';
    openBtn.setAttribute('aria-label', cfg.openLabel || 'Open the love letter');
    openBtn.setAttribute('aria-expanded', 'false');
    env.appendChild(openBtn);
    scene.appendChild(env);
    scene.appendChild(el('p', 'lv-hint', cfg.hint || 'Tap the envelope to open'));

    var letter = el('div', 'lv-letter');
    letter.setAttribute('role', 'region');
    letter.setAttribute('aria-label', 'Love letter');
    var sheet = el('div', 'lv-letter__paper');
    var typed = [];                                   // { node, tn, chars }
    function addLine(cls, text) {
        if (!text) return;
        var node = el('p', 'lv-line ' + cls);
        var tn = document.createTextNode('');
        node.appendChild(tn);
        sheet.appendChild(node);
        typed.push({ node: node, tn: tn, chars: Array.from(text) });
    }
    addLine('lv-line--to', cfg.to);
    (cfg.paragraphs || []).forEach(function (t) { addLine('lv-line--body', t); });
    addLine('lv-line--closing', cfg.closing);
    addLine('lv-line--sign', cfg.from);
    letter.appendChild(sheet);

    var decor = el('div', 'lv-decor');
    decor.setAttribute('aria-hidden', 'true');
    ['a', 'b', 'c', 'd'].forEach(function (k) { decor.appendChild(el('span', 'lv-decor__heart lv-decor__heart--' + k, '\u2665')); });
    letter.appendChild(decor);

    var closeBtn = el('button', 'lv-close', cfg.closeLabel || 'Close letter \u2715');
    closeBtn.type = 'button';
    letter.appendChild(closeBtn);
    scene.appendChild(letter);
    panel.appendChild(scene);

    var cursor = el('span', 'lv-cursor');

    /* ---- Typewriter ---- */
    var typeTimer = 0;
    function clearText() {
        clearTimeout(typeTimer);
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        typed.forEach(function (t) { t.tn.nodeValue = ''; });
        sheet.scrollTop = 0;
    }
    function fillAll() {
        clearTimeout(typeTimer);
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        typed.forEach(function (t) { t.tn.nodeValue = t.chars.join(''); });
    }
    function startTyping(token) {
        clearText();
        if (reduce) { fillAll(); return; }
        var total = typed.reduce(function (n, t) { return n + t.chars.length; }, 0) || 1;
        var delay = Math.max(12, Math.min(42, 13000 / total));   // long letters type faster, ~13s max
        var ei = 0, ci = 0;
        (function step() {
            if (token !== currentToken) return;
            if (ei >= typed.length) { if (cursor.parentNode) cursor.parentNode.removeChild(cursor); return; }
            var t = typed[ei];
            if (ci === 0) t.node.appendChild(cursor);
            ci++;
            t.tn.nodeValue = t.chars.slice(0, ci).join('');
            sheet.scrollTop = sheet.scrollHeight;
            if (ci >= t.chars.length) { ei++; ci = 0; typeTimer = setTimeout(step, 420); }
            else typeTimer = setTimeout(step, delay);
        })();
    }
    sheet.addEventListener('click', function () {            // click the paper to skip the typing
        if (state === 'reading' && cursor.parentNode) { currentToken++; fillAll(); }
    });

    /* ---- State machine: closed -> opening -> reading -> closing -> closed ---- */
    var state = 'closed', currentToken = 0, timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function openLetter() {
        if (state !== 'closed') return;
        state = 'opening';
        currentToken++;
        var token = currentToken;
        scene.classList.add('is-open');
        openBtn.setAttribute('aria-expanded', 'true');
        later(function () { scene.classList.add('is-reading'); }, reduce ? 50 : 1700);
        later(function () {
            state = 'reading';
            startTyping(token);
            try { closeBtn.focus({ preventScroll: true }); } catch (e) { }
        }, reduce ? 100 : 2300);
    }

    function closeLetter() {
        if (state !== 'reading' && state !== 'opening') return;
        state = 'closing';
        currentToken++;
        clearTimers();
        clearText();
        scene.classList.remove('is-reading');
        later(function () {
            scene.classList.remove('is-open');
            openBtn.setAttribute('aria-expanded', 'false');
            state = 'closed';
            try { openBtn.focus({ preventScroll: true }); } catch (e) { }
        }, reduce ? 50 : 650);
    }

    openBtn.addEventListener('click', openLetter);
    closeBtn.addEventListener('click', closeLetter);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLetter(); });
})();