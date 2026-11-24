/* ascii-art.js - random mp4 compilation rendered as live ASCII (section 5, right column).
   Edit VIDEOS to change the playlist. Zoom / pinch / buttons behave as before. */
(function () {
    'use strict';

    /* ---- Playlist: add your files here ---- */
    var VIDEOS = ((window.SITE_CONTENT && window.SITE_CONTENT.videos) || [])
        .map(function (v) { return typeof v === 'string' ? v : (v && v.src) || ''; })
        .filter(function (s) { return s; });

    var output = document.getElementById('output');
    var canvas = document.getElementById('sourceCanvas');
    var pixelSize = document.getElementById('pixelSize');
    var warning = document.getElementById('warning');
    var dangerBar = document.getElementById('dangerBar');
    var viewport = document.getElementById('asciiViewport');
    var stage = document.getElementById('asciiStage');
    var section = document.getElementById('last');

    if (!output || !canvas || !pixelSize || !viewport || !stage) return;

    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    /* ---- Settings ---- */
    var RAMP = ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'; // light -> dense
    var INK = '#9c1f58';         // text colour (dense chars = dark pixels, on the white viewport)
    var CONTRAST = 1;
    var FPS = 24;
    var COL_BASE = 1200;         // columns = COL_BASE / slider value
    var MAX_COLS = 300;          // detail cap, keeps frames fast
    var MIN_COLS = 20;
    var BASE_FONT = 10;
    var MIN_ZOOM = 0.15;
    var MAX_ZOOM = 12;

    /* ---- Luminance -> char code lookup ---- */
    var LUT = new Uint16Array(256);
    (function () {
        for (var i = 0; i < 256; i++) {
            var l = i / 255;
            l = Math.max(0, Math.min(1, (l - 0.5) * CONTRAST + 0.5));
            LUT[i] = RAMP.charCodeAt(Math.round((1 - l) * (RAMP.length - 1)));
        }
    })();

    /* ---- State ---- */
    var zoom = 1;
    var userZoomed = false;
    var cols = 100, rows = 56;
    var charAspect = 0.6;        // char width / char height for the monospace font
    var lastVW = 0, lastVH = 0, lastCols = 0, lastTime = -1, lastDraw = 0;
    var inView = false, running = false, started = false;
    var failCount = 0, bag = [], lastSrc = '';

    var COLOR = true;            // false = single-colour text (INK)
    if (COLOR) {
        output.style.color = 'transparent';
        output.style.webkitBackgroundClip = 'text';
        output.style.backgroundClip = 'text';
        output.style.backgroundSize = '100% 100%';
        output.style.backgroundRepeat = 'no-repeat';
    } else {
        output.style.color = INK;
    }

    /* ---- Video element (hidden, muted so autoplay is allowed) ---- */
    var video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.preload = 'auto';

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    /* ---- Zoom ---- */
    function applyFont() { output.style.fontSize = (BASE_FONT * zoom) + 'px'; }

    function centerScroll() {
        requestAnimationFrame(function () {
            viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
            viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
        });
    }

    function fit() {
        var availW = viewport.clientWidth - 56;
        var availH = Math.min(viewport.clientHeight, window.innerHeight - 160) - 56;
        var stageW = cols * charAspect * BASE_FONT;
        var stageH = rows * BASE_FONT;
        if (availW <= 0 || availH <= 0 || !stageW || !stageH) return;
        zoom = clamp(Math.min(availW / stageW, availH / stageH), MIN_ZOOM, MAX_ZOOM);
        applyFont();
        centerScroll();
    }

    function setZoom(z, anchorX, anchorY) {
        z = clamp(z, MIN_ZOOM, MAX_ZOOM);
        if (z === zoom) return;
        userZoomed = true;

        var vr = viewport.getBoundingClientRect();
        if (typeof anchorX !== 'number' || typeof anchorY !== 'number') {
            anchorX = vr.left + vr.width / 2;
            anchorY = vr.top + vr.height / 2;
        }
        var sr = stage.getBoundingClientRect();
        var fx = sr.width ? clamp((anchorX - sr.left) / sr.width, 0, 1) : 0.5;
        var fy = sr.height ? clamp((anchorY - sr.top) / sr.height, 0, 1) : 0.5;

        zoom = z;
        applyFont();

        var nr = stage.getBoundingClientRect();
        viewport.scrollLeft += (nr.left + fx * nr.width) - anchorX;
        viewport.scrollTop += (nr.top + fy * nr.height) - anchorY;
    }

    function resetZoom() { userZoomed = false; fit(); }

    viewport.addEventListener('wheel', function (e) {
        e.preventDefault();
        setZoom(zoom * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
    }, { passive: false });

    var btnIn = document.getElementById('zoomIn');
    var btnOut = document.getElementById('zoomOut');
    var btnReset = document.getElementById('zoomReset');
    if (btnIn) btnIn.addEventListener('click', function () { setZoom(zoom * 1.25); });
    if (btnOut) btnOut.addEventListener('click', function () { setZoom(zoom / 1.25); });
    if (btnReset) btnReset.addEventListener('click', resetZoom);

    var pinchDist = 0;
    viewport.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
            var dx = e.touches[0].clientX - e.touches[1].clientX;
            var dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchDist = Math.sqrt(dx * dx + dy * dy);
        }
    }, { passive: true });
    viewport.addEventListener('touchmove', function (e) {
        if (e.touches.length === 2 && pinchDist > 0) {
            e.preventDefault();
            var dx = e.touches[0].clientX - e.touches[1].clientX;
            var dy = e.touches[0].clientY - e.touches[1].clientY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            setZoom(zoom * (dist / pinchDist), midX, midY);
            pinchDist = dist;
        }
    }, { passive: false });
    viewport.addEventListener('touchend', function (e) {
        if (e.touches.length < 2) pinchDist = 0;
    });

    /* ---- Grid (columns / rows) ---- */
    function measureCharAspect() {
        var probe = document.createElement('span');
        probe.textContent = 'MMMMMMMMMM';
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:monospace;font-size:' + BASE_FONT + 'px;';
        document.body.appendChild(probe);
        var w = probe.getBoundingClientRect().width;
        document.body.removeChild(probe);
        if (w > 0) charAspect = w / 10 / BASE_FONT;
    }

    function setGrid() {
        var vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return;
        var step = Math.max(1, parseInt(pixelSize.value, 10) || 10);
        cols = clamp(Math.round(COL_BASE / step), MIN_COLS, MAX_COLS);
        rows = Math.max(1, Math.round(cols * (vh / vw) * charAspect));
        canvas.width = cols;
        canvas.height = rows;
        lastVW = vw; lastVH = vh; lastCols = cols;
        lastTime = -1;
        if (!userZoomed) fit();
        updateDangerUI();
    }

    /* ---- Frame -> ASCII ---- */
    function drawFrame() {
        var vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh || video.readyState < 2) return;
        if (vw !== lastVW || vh !== lastVH) setGrid();
        if (video.currentTime === lastTime) return;   // nothing new to draw
        lastTime = video.currentTime;

        ctx.drawImage(video, 0, 0, cols, rows);
        var d = ctx.getImageData(0, 0, cols, rows).data;
        var lines = new Array(rows);
        var codes = new Array(cols);
        var p = 0;
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var lum = (77 * d[p] + 150 * d[p + 1] + 29 * d[p + 2]) >> 8;
                codes[x] = LUT[lum];
                p += 4;
            }
            lines[y] = String.fromCharCode.apply(null, codes);
        }
        output.textContent = lines.join('\n');
        if (COLOR) output.style.backgroundImage = 'url(' + canvas.toDataURL('image/jpeg', 0.8) + ')';
    }

    function loop(now) {
        if (!inView || document.hidden) { running = false; return; }
        if (now - lastDraw >= 1000 / FPS) {
            lastDraw = now;
            drawFrame();
        }
        requestAnimationFrame(loop);
    }

    function startLoop() {
        if (running) return;
        running = true;
        requestAnimationFrame(loop);
    }

    /* ---- Random playlist (shuffle bag, no immediate repeat) ---- */
    function nextSrc() {
        if (!bag.length) {
            bag = VIDEOS.slice();
            for (var i = bag.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
            }
            if (bag.length > 1 && bag[bag.length - 1] === lastSrc) {
                var s = bag[bag.length - 1]; bag[bag.length - 1] = bag[0]; bag[0] = s;
            }
        }
        lastSrc = bag.pop();
        return lastSrc;
    }

    function shouldPlay() { return inView && !document.hidden; }

    function play() {
        var pr = video.play();
        if (pr && pr.catch) pr.catch(function () { });
    }

    function playNext() {
        video.src = nextSrc();
        lastTime = -1;
        if (shouldPlay()) play();
    }

    video.addEventListener('loadedmetadata', setGrid);
    video.addEventListener('playing', function () { failCount = 0; });
    video.addEventListener('ended', playNext);
    video.addEventListener('error', function () {
        failCount++;
        if (failCount < VIDEOS.length) playNext();
        else console.error('[ascii-art] none of the videos could be loaded:', VIDEOS);
    });

    function updatePlayback() {
        if (!started) return;
        if (shouldPlay()) { play(); startLoop(); }
        else video.pause();
    }

    document.addEventListener('visibilitychange', updatePlayback);

    /* ---- Slider = detail level (bigger value = fewer, coarser characters) ---- */
    var safeStep = Math.ceil(COL_BASE / MAX_COLS);

    function updateDangerUI() {
        var min = parseInt(pixelSize.min, 10) || 1;
        var max = parseInt(pixelSize.max, 10) || 40;
        var pct = clamp((safeStep - min) / (max - min) * 100, 0, 100);
        if (dangerBar) dangerBar.style.width = pct + '%';
        if (warning) {
            warning.textContent = (parseInt(pixelSize.value, 10) < safeStep) ? 'Max detail reached' : '';
        }
    }

    pixelSize.addEventListener('input', function () {
        setGrid();
        updateDangerUI();
    });

    /* ---- Init: wait for the password gate, then start ---- */
    function init() {
        if (!VIDEOS.length) {
            output.textContent = 'Add videos in the admin page';
            return;
        }
        measureCharAspect();
        started = true;
        updateDangerUI();
        playNext();

        if ('IntersectionObserver' in window && section) {
            new IntersectionObserver(function (entries) {
                inView = entries[0].isIntersecting;
                updatePlayback();
            }, { threshold: 0.15 }).observe(section);
        } else {
            inView = true;
            updatePlayback();
        }
    }

    function tryInitialLoad() {
        var site = document.getElementById('site-content');
        if (site && !site.hasAttribute('hidden')) init();
        else setTimeout(tryInitialLoad, 200);
    }
    tryInitialLoad();
})();