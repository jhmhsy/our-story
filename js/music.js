/* music.js - Music section (#music): swipeable album carousel + site-wide background player.
   Data comes from SITE_CONTENT.music (data/content.json, edited in /admin).
   Songs are shuffled on every load. The centred song plays; swiping to another plays that one.
   Browsers block sound until the visitor interacts, so playback starts on password unlock
   (password-gate.js calls window.__startMusic) or on the first tap/key press anywhere. */
(function () {
    'use strict';
    var section = document.getElementById('music');
    if (!section || section.getAttribute('data-built')) return;
    section.setAttribute('data-built', '1');

    var cfg = (window.SITE_CONTENT && window.SITE_CONTENT.music) || {};
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var songs = (cfg.songs || []).filter(function (s) { return s && s.audio; });
    for (var i = songs.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = songs[i]; songs[i] = songs[j]; songs[j] = t;
    }
    var N = songs.length;
    var MAX_VISIBLE = 3;

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function mod(k) { return ((k % N) + N) % N; }
    function wrap(d) { var h = N / 2; return ((((d + h) % N) + N) % N) - h; }

    /* ---- DOM ---- */
    var root = el('div', 'mu');
    root.appendChild(el('h2', 'mu__title', cfg.title || 'Our Playlist'));
    if (cfg.subtitle) root.appendChild(el('p', 'mu__subtitle', cfg.subtitle));
    section.appendChild(root);

    if (!N) {
        root.appendChild(el('p', 'mu__empty', 'The playlist is waiting for its first song \uD83C\uDFB5'));
        return;
    }

    var stage = el('div', 'mu__stage');
    stage.tabIndex = 0;
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-roledescription', 'carousel');
    stage.setAttribute('aria-label', 'Songs. Use the left and right arrow keys to browse, space to play or pause.');
    var ring = el('div', 'mu__ring');
    var items = songs.map(function (s, k) {
        var card = el('figure', 'mu-card');
        card.setAttribute('data-i', k);

        var disc = el('div', 'mu-disc');
        var label = el('span', 'mu-disc__label');
        if (s.cover) label.style.backgroundImage = 'url("' + String(s.cover).replace(/"/g, '%22') + '")';
        disc.appendChild(label);
        card.appendChild(disc);

        var art = el('div', 'mu-card__art');
        if (s.cover) {
            var img = document.createElement('img');
            img.src = s.cover;
            img.alt = (s.title || 'Song') + (s.artist ? ' - ' + s.artist : '');
            img.draggable = false;
            img.decoding = 'async';
            art.appendChild(img);
        }
        var eq = el('span', 'mu-eq');
        eq.setAttribute('aria-hidden', 'true');
        for (var b = 0; b < 3; b++) eq.appendChild(document.createElement('i'));
        art.appendChild(eq);
        card.appendChild(art);

        ring.appendChild(card);
        return card;
    });
    stage.appendChild(ring);
    root.appendChild(stage);

    var now = el('div', 'mu__now');
    now.setAttribute('aria-live', 'polite');
    var nowSong = el('p', 'mu__song');
    var nowArtist = el('p', 'mu__artist');
    now.appendChild(nowSong);
    now.appendChild(nowArtist);
    root.appendChild(now);

    var controls = el('div', 'mu__controls');
    var prev = el('button', 'mu__btn', '\u2039');
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Previous song');
    var playBtn = el('button', 'mu__btn mu__btn--play', '\u25B6\uFE0E');
    playBtn.type = 'button';
    playBtn.setAttribute('aria-label', 'Play music');
    var next = el('button', 'mu__btn', '\u203A');
    next.type = 'button';
    next.setAttribute('aria-label', 'Next song');
    controls.appendChild(prev);
    controls.appendChild(playBtn);
    controls.appendChild(next);
    root.appendChild(controls);

    var fab = el('button', 'mu-fab', '\uD83D\uDD07');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Play music');
    var fabWrap = document.querySelector('.mu-fab-wrap');
    if (!fabWrap) {
        fabWrap = el('div', 'mu-fab-wrap');
        (document.getElementById('site-content') || document.body).appendChild(fabWrap);
    }
    fabWrap.appendChild(fab);
    // Theme toggle button is created early by inline script in index.html
    // Just ensure it's in the fabWrap
    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle && themeToggle.parentNode !== fabWrap) {
        fabWrap.appendChild(themeToggle);
    }

    /* ---- Geometry ---- */
    var cardW = 0, pxPerItem = 200;
    function measure() {
        var w = items[0].offsetWidth;
        if (!w) return;                                   // section still hidden behind the password gate
        cardW = w;
        pxPerItem = w * 1.05;
        render();
    }

    /* ---- Render: flat cover-flow ---- */
    var pos = 0, target = 0, lastActive = -1;
    function setNow(a) {
        nowSong.textContent = songs[a].title || '';
        nowArtist.textContent = songs[a].artist || '';
    }
    function render() {
        if (!cardW) return;
        var active = mod(Math.round(pos));
        for (var k = 0; k < N; k++) {
            var it = items[k];
            var d = wrap(k - pos);
            var ad = Math.abs(d);
            if (ad > MAX_VISIBLE) {
                it.style.visibility = 'hidden';
                it.style.opacity = '0';
                continue;
            }
            var sgn = d < 0 ? -1 : 1;
            var x = ad <= 1 ? d * cardW * 1.05 : sgn * cardW * (1.05 + (ad - 1) * 0.5);
            var scale = 1 - Math.min(ad, 2) * 0.16;
            var rot = clamp(-d, -1, 1) * 36;
            var z = -Math.min(ad, 2) * 60;
            it.style.visibility = 'visible';
            it.style.opacity = ad > 2.2 ? String(Math.max(0, 1 - (ad - 2.2) / (MAX_VISIBLE - 2.2))) : '1';
            it.style.zIndex = String(100 - Math.round(ad * 10));
            it.style.transform =
                'perspective(900px) translate(-50%, -50%) translateX(' + x.toFixed(2) + 'px) translateZ(' + z.toFixed(1) + 'px) ' +
                'rotateY(' + rot.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';
        }
        if (active !== lastActive) {
            lastActive = active;
            for (var m = 0; m < N; m++) items[m].classList.toggle('is-active', m === active);
            setNow(active);
        }
    }

    /* ---- Audio engine (one element for the whole site) ---- */
    var audio = new Audio();
    audio.preload = 'auto';
    audio.loop = N === 1;
    var playing = -1, wantPlay = true, begun = false, failCount = 0, armed = false;

    function setPlayingUI(on) {
        root.classList.toggle('is-playing', on);
        playBtn.textContent = on ? '\u275A\u275A' : '\u25B6\uFE0E';
        playBtn.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
        fab.textContent = on ? '\uD83D\uDD0A' : '\uD83D\uDD07';
        fab.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
    }

    /* If the browser blocks autoplay, resume on the first interaction outside the music controls */
    var GESTURES = ['pointerdown', 'keydown', 'touchend'];
    function onGesture(e) {
        if (e.target && e.target.closest && e.target.closest('#music, .mu-fab')) return;
        disarm();
        if (begun && wantPlay && audio.paused) tryPlay();
    }
    function arm() {
        if (armed) return;
        armed = true;
        GESTURES.forEach(function (g) { document.addEventListener(g, onGesture, true); });
    }
    function disarm() {
        armed = false;
        GESTURES.forEach(function (g) { document.removeEventListener(g, onGesture, true); });
    }
    function tryPlay() {
        var p = audio.play();
        if (p && p.catch) p.catch(function (err) { if (err && err.name === 'NotAllowedError') arm(); });
    }

    function playTrack(k) {
        playing = k;
        wantPlay = true;
        audio.src = songs[k].audio;
        tryPlay();
    }
    function begin() {
        if (begun) return;
        begun = true;
        playTrack(mod(Math.round(target)));
    }
    function advance() {
        var offset = 1 + Math.floor(Math.random() * (N - 1));   // 1..N-1, so never the same song
        target = Math.round(target) + wrap(offset);
        playTrack(mod(target));
        kick();
    }
    function togglePlay() {
        if (!begun) { begin(); return; }
        if (audio.paused) { wantPlay = true; tryPlay(); }
        else { wantPlay = false; audio.pause(); }
    }
    function onSettle() {
        if (dragging || wheelTimer || Math.abs(target - Math.round(target)) > 0.001) return;
        var a = mod(Math.round(target));
        if (begun && a !== playing) playTrack(a);
        else if (!begun && a !== 0) begin();                 // first swipe before any playback: start on that song
    }

    audio.addEventListener('playing', function () { failCount = 0; setPlayingUI(true); disarm(); });
    audio.addEventListener('pause', function () { setPlayingUI(false); });
    audio.addEventListener('ended', function () { if (N > 1) advance(); });
    audio.addEventListener('error', function () {
        failCount++;
        if (N > 1 && failCount < N) advance();
        else setPlayingUI(false);
    });
    window.addEventListener('pagehide', function () { audio.pause(); });

    fab.addEventListener('click', togglePlay);
    playBtn.addEventListener('click', togglePlay);

    /* ---- Animation loop ---- */
    var raf = 0, lastT = 0, dragging = false, wheelTimer = 0, wheelStart = 0;
    function tick(ts) {
        var dt = Math.min(0.05, (ts - lastT) / 1000) || 0.016;
        lastT = ts;
        var diff = target - pos;
        if (reduce || Math.abs(diff) < 0.0008) {
            pos = target;
            raf = 0;
            render();
            onSettle();
            return;
        }
        pos += diff * (1 - Math.exp(-dt * (dragging ? 30 : 9)));
        render();
        raf = requestAnimationFrame(tick);
    }
    function kick() {
        if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function go(delta) { target = Math.round(target) + delta; kick(); }

    /* ---- Buttons / keyboard ---- */
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    if (N < 2) { prev.disabled = true; next.disabled = true; }
    stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    });

    /* ---- Pointer drag (mouse + touch) ---- */
    var drag = null, suppressClick = false;
    stage.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        drag = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false };
    });
    stage.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved) {
            if (Math.abs(e.clientX - drag.startX) < 6) return;
            drag.moved = true;
            dragging = true;
            stage.classList.add('is-dragging');
            try { stage.setPointerCapture(e.pointerId); } catch (err) { }
        }
        var nowMs = performance.now();
        var dx = e.clientX - drag.lastX;
        var dItems = -dx / pxPerItem;
        target += dItems;
        var dtMs = Math.max(1, nowMs - drag.lastT);
        drag.v = drag.v * 0.7 + (dItems / dtMs) * 0.3;
        drag.lastX = e.clientX;
        drag.lastT = nowMs;
        kick();
    });
    function endDrag(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        var moved = drag.moved, v = drag.v;
        drag = null;
        dragging = false;
        stage.classList.remove('is-dragging');
        if (moved) {
            suppressClick = true;
            setTimeout(function () { suppressClick = false; }, 60);
            target = Math.round(target + clamp(v * 140, -2, 2));
            kick();
        }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    /* Tap a side cover to bring it to the centre; tap the centre cover to play / pause */
    stage.addEventListener('click', function (e) {
        if (suppressClick) { suppressClick = false; return; }
        var card = e.target.closest ? e.target.closest('.mu-card') : null;
        if (!card) return;
        var d = wrap(+card.getAttribute('data-i') - Math.round(target));
        if (d !== 0) go(d); else togglePlay();
    });

    /* Horizontal wheel / Shift+wheel only, so vertical page scrolling is never hijacked */
    function wheelSnap() {
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
    setNow(0);
    measure();

    /* ---- Start ---- */
    window.__startMusic = begin;                          // called by password-gate.js on unlock (a user gesture)
    if (window.__siteUnlocked) begin();                   // already unlocked this session: try now, else wait for a tap
})();