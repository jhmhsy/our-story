/* pinboard.js - thumbtacked photo carousel inside #gallery, below the gallery carousel.
   Swaying pins, per-photo print button, and a camera panel that adds captured photos.
   Optional seed data: SITE_CONTENT.pinboard = { title, subtitle, photos: [{ src, caption }] } */
(function () {
    'use strict';
    var section = document.getElementById('gallery');
    if (!section || section.getAttribute('data-pn-built')) return;
    section.setAttribute('data-pn-built', '1');

    var cfg = (window.SITE_CONTENT && window.SITE_CONTENT.pinboard) || {};
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var MAX_VISIBLE = 2;

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function makePhoto(src, caption) {
        return {
            src: src,
            caption: caption || '',
            rest: rand(-3.5, 3.5).toFixed(2) + 'deg',
            dur: rand(1.5, 2.1).toFixed(2) + 's'
        };
    }

    var photos = (cfg.photos || []).filter(function (p) { return p && p.src; })
        .map(function (p) { return makePhoto(p.src, p.caption); });
    var N = photos.length;

    function mod(i) { return N ? ((i % N) + N) % N : 0; }
    function wrap(d) { var h = N / 2; return ((((d + h) % N) + N) % N) - h; }

    /* ---- DOM ---- */
    var root = el('div', 'pn');
    root.appendChild(el('h2', 'pn__title', cfg.title || 'Pin Board'));
    if (cfg.subtitle) root.appendChild(el('p', 'pn__subtitle', cfg.subtitle));

    var stage = el('div', 'pn__stage');
    stage.tabIndex = 0;
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-roledescription', 'carousel');
    stage.setAttribute('aria-label', 'Pinned photos. Use the left and right arrow keys to browse.');
    var ring = el('div', 'pn__ring');
    var empty = el('p', 'pn__empty', 'No photos yet. Tap + to take one \uD83D\uDCF8');
    stage.appendChild(ring);
    stage.appendChild(empty);
    root.appendChild(stage);

    var controls = el('div', 'pn__controls');
    var prev = el('button', 'pn__btn', '\u2039');
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Previous pinned photo');
    var addBtn = el('button', 'pn__btn pn__btn--add', '+');
    addBtn.type = 'button';
    addBtn.setAttribute('aria-label', 'Add a photo with the camera');
    addBtn.setAttribute('aria-expanded', 'false');
    var next = el('button', 'pn__btn', '\u203A');
    next.type = 'button';
    next.setAttribute('aria-label', 'Next pinned photo');
    controls.appendChild(prev);
    controls.appendChild(addBtn);
    controls.appendChild(next);
    root.appendChild(controls);
    var count = el('p', 'pn__count');
    count.setAttribute('aria-live', 'polite');
    root.appendChild(count);

    /* Camera panel */
    var cam = el('div', 'pn-cam');
    cam.setAttribute('aria-hidden', 'true');
    var camInner = el('div', 'pn-cam__inner');
    var status = el('p', 'pn-cam__status', '');
    status.setAttribute('aria-live', 'polite');
    var view = el('div', 'pn-cam__view');
    var video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    var flash = el('div', 'pn-cam__flash');
    view.appendChild(video);
    view.appendChild(flash);
    var camBtns = el('div', 'pn-cam__btns');
    var shotBtn = el('button', 'pn-cam__btn', 'Capture \uD83D\uDCF8');
    shotBtn.type = 'button';
    shotBtn.disabled = true;
    var closeBtn = el('button', 'pn-cam__btn pn-cam__btn--ghost', 'Close \u2715');
    closeBtn.type = 'button';
    camBtns.appendChild(shotBtn);
    camBtns.appendChild(closeBtn);
    camInner.appendChild(status);
    camInner.appendChild(view);
    camInner.appendChild(camBtns);
    cam.appendChild(camInner);
    root.appendChild(cam);
    section.appendChild(root);

    /* Hidden sheet used for printing a single photo */
    var sheet = el('div', 'pn-print-sheet');
    sheet.id = 'pn-print-sheet';
    var sheetFrame = el('div', 'pn-print-sheet__frame');
    var sheetImg = document.createElement('img');
    sheetImg.alt = '';
    var sheetCap = el('p', 'pn-print-sheet__caption');
    sheetFrame.appendChild(sheetImg);
    sheetFrame.appendChild(sheetCap);
    sheet.appendChild(sheetFrame);
    document.body.appendChild(sheet);

    /* ---- Cards ---- */
    var items = [];
    var cardW = 0, spacing = 160;
    var pos = 0, target = 0, lastActive = -1;

    function buildCard(p, i) {
        var card = el('figure', 'pn-card');
        card.setAttribute('data-i', i);
        var swing = el('div', 'pn-swing');
        swing.style.setProperty('--rest', p.rest);
        swing.style.setProperty('--sdur', p.dur);
        swing.addEventListener('animationend', function () { swing.classList.remove('is-swaying'); });

        swing.appendChild(el('span', 'pn-pin'));
        var img = document.createElement('img');
        img.src = p.src;
        img.alt = p.caption || ('Pinned photo ' + (i + 1));
        img.draggable = false;
        img.decoding = 'async';
        swing.appendChild(img);

        var cap = el('figcaption', 'pn-caption');
        cap.appendChild(el('span', 'pn-caption__text', p.caption));
        var pr = el('button', 'pn-print', '\uD83D\uDDA8 Print');
        pr.type = 'button';
        pr.setAttribute('aria-label', 'Print this photo');
        pr.addEventListener('click', function (e) {
            e.stopPropagation();
            printPhoto(p);
        });
        cap.appendChild(pr);
        swing.appendChild(cap);

        card.appendChild(swing);
        return card;
    }

    function rebuild() {
        ring.textContent = '';
        N = photos.length;
        items = photos.map(buildCard);
        items.forEach(function (c) { ring.appendChild(c); });
        empty.hidden = N > 0;
        prev.disabled = next.disabled = N < 2;
        lastActive = -1;
        measure();
        render();
    }

    function measure() {
        if (!items.length) return;
        var w = items[0].offsetWidth;
        if (!w) return;                                   // section still hidden behind the password gate
        cardW = w;
        spacing = w * 1.12;
        render();
    }

    function render() {
        if (!N) { count.textContent = ''; return; }
        if (!cardW) return;
        var active = mod(Math.round(pos));
        for (var i = 0; i < N; i++) {
            var it = items[i];
            var d = wrap(i - pos);
            var ad = Math.abs(d);
            if (ad > MAX_VISIBLE + 0.5) {
                it.style.visibility = 'hidden';
                it.style.opacity = '0';
                continue;
            }
            var scale = 1 - Math.min(ad, 2) * 0.1;
            it.style.visibility = 'visible';
            it.style.opacity = ad > MAX_VISIBLE ? String(Math.max(0, 1 - (ad - MAX_VISIBLE) * 2)) : '1';
            it.style.zIndex = String(100 - Math.round(ad * 10));
            it.style.transform = 'translateX(-50%) translateX(' + (d * spacing).toFixed(2) + 'px) scale(' + scale.toFixed(3) + ')';
        }
        if (active !== lastActive) {
            lastActive = active;
            for (var j = 0; j < N; j++) items[j].classList.toggle('is-active', j === active);
            count.textContent = (active + 1) + ' / ' + N;
        }
    }

    /* ---- Sway: every pinned photo swings on its tack when you navigate ---- */
    function sway(dir) {
        if (reduce) return;
        items.forEach(function (c) {
            var s = c.firstChild;
            s.style.setProperty('--dir', dir);
            s.classList.remove('is-swaying');
            void s.offsetWidth;                            // restart the animation
            s.classList.add('is-swaying');
        });
    }

    /* ---- Animation loop ---- */
    var raf = 0, lastT = 0;
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
        pos += diff * (1 - Math.exp(-dt * 8));
        render();
        raf = requestAnimationFrame(tick);
    }
    function kick() {
        if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function go(delta) {
        if (N < 2 || !delta) return;
        target = Math.round(target) + delta;
        sway(delta > 0 ? 1 : -1);
        kick();
    }

    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    });

    /* Swipe (vertical page scroll still works: touch-action: pan-y in CSS) */
    var sx = null, swiped = false;
    stage.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        sx = e.clientX;
        swiped = false;
    });
    stage.addEventListener('pointerup', function (e) {
        if (sx === null) return;
        var dx = e.clientX - sx;
        sx = null;
        if (Math.abs(dx) > 40) { swiped = true; go(dx < 0 ? 1 : -1); }
    });
    stage.addEventListener('pointercancel', function () { sx = null; });

    /* Tap a side photo to bring it to the centre */
    stage.addEventListener('click', function (e) {
        if (swiped) { swiped = false; return; }
        if (e.target.closest && e.target.closest('.pn-print')) return;
        var card = e.target.closest ? e.target.closest('.pn-card') : null;
        if (!card) return;
        go(Math.round(wrap(+card.getAttribute('data-i') - Math.round(target))));
    });

    /* ---- Print one photo ---- */
    function printPhoto(p) {
        sheetImg.src = p.src;
        sheetCap.textContent = p.caption || '';
        var run = function () {
            document.documentElement.classList.add('pn-printing');
            window.print();
        };
        if (sheetImg.decode) sheetImg.decode().then(run, run);
        else sheetImg.onload = run;
    }
    window.addEventListener('afterprint', function () {
        document.documentElement.classList.remove('pn-printing');
    });

    /* ---- Camera ---- */
    var stream = null, camToken = 0;

    function setStatus(msg) { status.textContent = msg; }

    function stopStream() {
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
        video.srcObject = null;
        shotBtn.disabled = true;
    }

    function openCam() {
        cam.classList.add('is-open');
        cam.setAttribute('aria-hidden', 'false');
        addBtn.setAttribute('aria-expanded', 'true');
        if (stream) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('Camera is not available here. It needs a secure (https) page.');
            return;
        }
        var token = ++camToken;
        setStatus('Requesting camera permission\u2026');
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
            .then(function (s) {
                if (token !== camToken) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
                stream = s;
                video.srcObject = s;
                var pl = video.play();
                if (pl && pl.catch) pl.catch(function () { });
                shotBtn.disabled = false;
                setStatus('Smile! Tap capture when you are ready.');
            })
            .catch(function (err) {
                if (token !== camToken) return;
                var name = err && err.name;
                if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('Camera permission was denied. Allow it in your browser settings, then try again.');
                else if (name === 'NotFoundError' || name === 'OverconstrainedError') setStatus('No camera was found on this device.');
                else setStatus('Could not start the camera.');
            });
    }

    function closeCam() {
        camToken++;
        stopStream();
        cam.classList.remove('is-open');
        cam.setAttribute('aria-hidden', 'true');
        addBtn.setAttribute('aria-expanded', 'false');
    }

    function capture() {
        var vw = video.videoWidth, vh = video.videoHeight;
        if (!stream || !vw || !vh) return;
        var W = 800, H = 1000;                              // 4:5, same crop as the preview
        var cw = Math.min(vw, vh * 0.8), ch = cw / 0.8;
        var canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        var ctx = canvas.getContext('2d');
        ctx.translate(W, 0);
        ctx.scale(-1, 1);                                   // mirrored, as in the preview
        ctx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, W, H);

        flash.classList.remove('is-flash');
        void flash.offsetWidth;
        flash.classList.add('is-flash');

        var caption = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        addPhoto(makePhoto(canvas.toDataURL('image/jpeg', 0.9), caption));
    }

    function addPhoto(p) {
        var cur = mod(Math.round(target));
        pos = target = N ? cur : 0;                         // normalise; looks identical on a ring
        photos.splice(N ? cur + 1 : 0, 0, p);
        rebuild();
        if (N > 1) go(1);
    }

    addBtn.addEventListener('click', function () {
        if (cam.classList.contains('is-open')) closeCam(); else openCam();
    });
    shotBtn.addEventListener('click', capture);
    closeBtn.addEventListener('click', closeCam);
    stage.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCam(); });
    window.addEventListener('pagehide', stopStream);

    /* ---- Resize / unhide ---- */
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stage);
    window.addEventListener('resize', measure);
    rebuild();
})();