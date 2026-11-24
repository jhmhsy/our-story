/* ascii-art.js - random mp4 compilation rendered as live ASCII (section 5, right column).
   Videos come from SITE_CONTENT.videos. Zoom / pinch / buttons behave as before. */
(function () {
    'use strict';

    var VIDEOS = ((window.SITE_CONTENT && window.SITE_CONTENT.videos) || [])
        .map(function (v) { return typeof v === 'string' ? v : (v && v.src) || ''; })
        .filter(function (s) { return s; });

    var asciiMode = window.SITE_CONTENT && window.SITE_CONTENT.asciiMode !== undefined ? window.SITE_CONTENT.asciiMode : true;

    var output = document.getElementById('output');
    var canvas = document.getElementById('sourceCanvas');
    var pixelSize = document.getElementById('pixelSize');
    var warning = document.getElementById('warning');
    var dangerBar = document.getElementById('dangerBar');
    var viewport = document.getElementById('asciiViewport');
    var stage = document.getElementById('asciiStage');
    var section = document.getElementById('last');

    if (!output || !canvas || !pixelSize || !viewport || !stage) return;

    // If not in ASCII mode, show actual video instead
    if (!asciiMode) {
        showActualVideo();
        return;
    }

    /* ---- Settings ---- */
    var DARK = true;             // true: bright colours on a dark viewport (best colour fidelity). false: white viewport
    var RAMP = ' .:-=+*#%@';     // sparse -> dense. Dense = bright pixel when DARK, dark pixel otherwise
    var INK = DARK ? '#ffd6e6' : '#9c1f58';   // mono fallback colour
    var FPS = 24;
    var COL_BASE = 1200;         // columns = COL_BASE / slider value
    var MAX_COLS = 300;
    var MIN_COLS = 20;
    var BASE_FONT = 10;
    var MIN_ZOOM = 0.15;
    var MAX_ZOOM = 12;

    var COLOR_SCALE = 4;         // source pixels per cell side (exact box average, no overlap)
    var GAMMA = 2.2;
    var SATURATION = 1.3;
    var COLOR_GAIN = DARK ? 1.45 : 0.95;  // glyphs only cover part of a cell, so colour is pushed brighter
    var LIFT = 0.6;              // < 1 brightens shadows (1 = off, lower = brighter)
    var MIN_COLOR = 90;    // glyphs only cover part of a cell, so colour is pushed brighter
    var LEVEL_CUT = 0.02;        // auto-levels: ignore darkest/brightest 2%
    var LEVEL_SMOOTH = 0.15;     // auto-levels: how fast it follows the scene (0..1)

    var RAMP_CODES = [];
    for (var rc = 0; rc < RAMP.length; rc++) RAMP_CODES.push(RAMP.charCodeAt(rc));

    var GAMMA_LUT = new Float32Array(256);       // 8-bit -> linear
    var INV_GAMMA_LUT = new Float32Array(256);   // linear (i/255) -> display 0..1
    (function () {
        for (var i = 0; i < 256; i++) {
            var v = i / 255;
            GAMMA_LUT[i] = Math.pow(v, GAMMA);
            INV_GAMMA_LUT[i] = Math.pow(v, 1 / GAMMA);
        }
    })();

    /* ---- State ---- */
    var zoom = 1;
    var userZoomed = false;
    var cols = 100, rows = 56;
    var charAspect = 0.6;
    var lastVW = 0, lastVH = 0, lastTime = -1, lastDraw = 0;
    var inView = false, running = false, started = false;
    var failCount = 0, bag = [], lastSrc = '';

    var COLOR = true;            // false = single-colour text (INK)

    if (DARK) {
        viewport.style.background = '#0b0610';
        viewport.style.borderColor = 'rgba(255,255,255,0.15)';
    }
    output.style.fontWeight = '700';

    function applyColorStyles() {
        output.style.color = 'transparent';
        output.style.webkitBackgroundClip = 'text';
        output.style.backgroundClip = 'text';
        output.style.backgroundSize = '100% 100%';
        output.style.backgroundRepeat = 'no-repeat';
        output.style.backgroundPosition = '0 0';
        output.style.imageRendering = 'pixelated';
    }
    if (COLOR) applyColorStyles();
    else output.style.color = INK;

    /* ---- Source canvas (video frame at COLOR_SCALE x the character grid) ---- */
    var colorCanvas = document.createElement('canvas');
    var colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
    var colorCols = 0, colorRows = 0;

    /* ---- Per-cell colour map (one pixel per character) ---- */
    var colorMapCanvas = document.createElement('canvas');
    var colorMapCtx = colorMapCanvas.getContext('2d');
    var colorMapData = null;

    /* ---- Per-cell buffers, reused every frame ---- */
    var cellR = null, cellG = null, cellB = null, cellL = null;
    var hist = new Uint32Array(256);
    var lvLo = 0, lvHi = 1, lvInit = false;

    /* ---- Video element (hidden, muted so autoplay is allowed) ---- */
    var video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';   // needed for getImageData

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
    var btnToggle = document.getElementById('zoomToggle');
    var zoomBtns = document.getElementById('zoomBtns');
    if (btnToggle && zoomBtns) {
        btnToggle.addEventListener('click', function () {
            var show = zoomBtns.hasAttribute('hidden');
            if (show) zoomBtns.removeAttribute('hidden');
            else zoomBtns.setAttribute('hidden', '');
            btnToggle.setAttribute('aria-expanded', show ? 'true' : 'false');
        });
    }

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
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:monospace;font-weight:700;font-size:' + BASE_FONT + 'px;';
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

        colorCols = cols * COLOR_SCALE;
        colorRows = rows * COLOR_SCALE;
        colorCanvas.width = colorCols;
        colorCanvas.height = colorRows;

        lastVW = vw; lastVH = vh;
        lastTime = -1;
        if (!userZoomed) fit();
        updateDangerUI();
    }

    /* ---- Frame -> ASCII ---- */
    function drawFrame() {
        var vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh || video.readyState < 2) return;
        if (vw !== lastVW || vh !== lastVH) setGrid();
        if (video.currentTime === lastTime) return;
        lastTime = video.currentTime;

        colorCtx.drawImage(video, 0, 0, colorCols, colorRows);

        var src;
        try {
            src = colorCtx.getImageData(0, 0, colorCols, colorRows).data;
        } catch (err) {
            console.warn('[ascii-art] getImageData failed (CORS?)', err);
            output.style.color = INK;
            output.style.backgroundImage = '';
            output.style.webkitBackgroundClip = '';
            output.style.backgroundClip = '';
            return;
        }

        var n = cols * rows;
        if (!cellR || cellR.length !== n) {
            cellR = new Float32Array(n);
            cellG = new Float32Array(n);
            cellB = new Float32Array(n);
            cellL = new Float32Array(n);
        }

        /* Pass 1: exact box average per cell (in linear light), luminance, histogram */
        hist.fill(0);
        var S = COLOR_SCALE, inv = 1 / (S * S), stride = colorCols * 4;
        var x, y, i, j, p, id = 0;
        for (y = 0; y < rows; y++) {
            for (x = 0; x < cols; x++) {
                var base = (y * S * colorCols + x * S) * 4;
                var r = 0, g = 0, b = 0;
                for (j = 0; j < S; j++) {
                    p = base + j * stride;
                    for (i = 0; i < S; i++) {
                        r += GAMMA_LUT[src[p]];
                        g += GAMMA_LUT[src[p + 1]];
                        b += GAMMA_LUT[src[p + 2]];
                        p += 4;
                    }
                }
                r *= inv; g *= inv; b *= inv;
                var lin = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                var l = INV_GAMMA_LUT[Math.min(255, Math.round(lin * 255))];
                cellR[id] = r; cellG[id] = g; cellB[id] = b; cellL[id] = l;
                hist[Math.round(l * 255)]++;
                id++;
            }
        }

        /* Auto-levels: stretch between the 2nd and 98th percentile, smoothed over time */
        var acc = 0, lo = 0, hi = 255, cut = n * LEVEL_CUT;
        for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= cut) { lo = i; break; } }
        acc = 0;
        for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= cut) { hi = i; break; } }
        if (hi - lo < 40) hi = Math.min(255, lo + 40);
        if (!lvInit) { lvLo = lo / 255; lvHi = hi / 255; lvInit = true; }
        else {
            lvLo += (lo / 255 - lvLo) * LEVEL_SMOOTH;
            lvHi += (hi / 255 - lvHi) * LEVEL_SMOOTH;
        }
        var span = Math.max(0.05, lvHi - lvLo);

        /* Pass 2: characters + colours */
        if (COLOR) {
            if (colorMapCanvas.width !== cols || colorMapCanvas.height !== rows) {
                colorMapCanvas.width = cols;
                colorMapCanvas.height = rows;
                colorMapData = colorMapCtx.createImageData(cols, rows);
            }
        }
        var colorMap = colorMapData ? colorMapData.data : null;
        var cm = 0;
        var maxIdx = RAMP_CODES.length - 1;
        var lines = new Array(rows);
        var codes = new Array(cols);
        id = 0;
        for (y = 0; y < rows; y++) {
            for (x = 0; x < cols; x++) {
                var lum = cellL[id];
                var ln = Math.pow(clamp((lum - lvLo) / span, 0, 1), LIFT);
                var ci = Math.round((DARK ? ln : 1 - ln) * maxIdx);
                codes[x] = RAMP_CODES[DARK ? Math.max(1, ci) : Math.min(maxIdx - 1, ci)];   // never a blank cell

                if (COLOR) {
                    var ratio = lum > 0.001 ? clamp(ln / lum, 0.7, 4) : 1;
                    var dr = INV_GAMMA_LUT[Math.min(255, Math.round(cellR[id] * 255))] * 255 * ratio * COLOR_GAIN;
                    var dg = INV_GAMMA_LUT[Math.min(255, Math.round(cellG[id] * 255))] * 255 * ratio * COLOR_GAIN;
                    var db = INV_GAMMA_LUT[Math.min(255, Math.round(cellB[id] * 255))] * 255 * ratio * COLOR_GAIN;
                    var gray = (dr + dg + db) / 3;
                    dr = gray + (dr - gray) * SATURATION;
                    dg = gray + (dg - gray) * SATURATION;
                    db = gray + (db - gray) * SATURATION;
                    if (DARK) {
                        var mx = Math.max(dr, dg, db);
                        if (mx < MIN_COLOR) {
                            if (mx < 1) { dr = dg = db = MIN_COLOR; }
                            else { var k = MIN_COLOR / mx; dr *= k; dg *= k; db *= k; }
                        }
                    }
                    colorMap[cm++] = clamp(Math.round(dr), 0, 255);
                    colorMap[cm++] = clamp(Math.round(dg), 0, 255);
                    colorMap[cm++] = clamp(Math.round(db), 0, 255);
                    colorMap[cm++] = 255;
                }
                id++;
            }
            lines[y] = String.fromCharCode.apply(null, codes);
        }
        output.textContent = lines.join('\n');

        if (COLOR) {
            colorMapCtx.putImageData(colorMapData, 0, 0);
            applyColorStyles();   // some browsers drop these between frames
            output.style.backgroundImage = 'url(' + colorMapCanvas.toDataURL('image/png') + ')';
        }
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
        lvInit = false;       // new clip: re-measure levels immediately
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

    /* ---- Slider = detail level ---- */
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

    /* ---- Init ---- */
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

    /* ---- Show actual video instead of ASCII ---- */
    function showActualVideo() {
        // Hide ASCII controls
        var controls = document.querySelector('.ascii-controls');
        if (controls) controls.style.display = 'none';

        // Create video element
        var videoContainer = document.createElement('div');
        videoContainer.style.width = '100%';
        videoContainer.style.height = '100%';
        videoContainer.style.display = 'flex';
        videoContainer.style.alignItems = 'center';
        videoContainer.style.justifyContent = 'center';
        videoContainer.style.background = '#2b1020';

        var videoEl = document.createElement('video');
        videoEl.controls = true;
        videoEl.muted = true;
        videoEl.defaultMuted = true;
        videoEl.playsInline = true;
        videoEl.setAttribute('playsinline', '');
        videoEl.setAttribute('muted', '');
        videoEl.style.maxWidth = '100%';
        videoEl.style.maxHeight = '100%';
        videoEl.style.borderRadius = '8px';
        videoEl.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';

        // Play videos in sequence
        var currentVideoIndex = 0;
        var bag = [];

        function shuffleBag() {
            bag = VIDEOS.slice();
            for (var i = bag.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
            }
        }

        function playNextVideo() {
            if (!bag.length) shuffleBag();
            var src = bag.pop();
            videoEl.src = src;
            videoEl.load();
            videoEl.play().catch(function () {
                // Autoplay might be blocked, user can click play
            });
        }

        videoEl.addEventListener('ended', playNextVideo);
        videoEl.addEventListener('error', function () {
            // Try next video on error
            playNextVideo();
        });

        videoContainer.appendChild(videoEl);

        // Replace the ASCII output with video container
        var asciiFrame = document.querySelector('.ascii-frame');
        if (asciiFrame) {
            asciiFrame.innerHTML = '';
            asciiFrame.appendChild(videoContainer);
        }

        // Start playing
        playNextVideo();
    }

    function tryInitialLoad() {
        var site = document.getElementById('site-content');
        if (site && !site.hasAttribute('hidden')) init();
        else setTimeout(tryInitialLoad, 200);
    }
    tryInitialLoad();
})();