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
        var COLOR_SCALE = 4;         // color canvas resolution multiplier (higher = better color accuracy)
        var GAMMA = 2.2;             // sRGB gamma for accurate color reproduction
        var SATURATION_BOOST = 1.15; // slight saturation boost for more vibrant colors
        var COLOR_CONTRAST = 1.1;    // contrast boost for color map

        /* ---- Luminance -> char code lookup ---- */
        var LUT = new Uint16Array(256);
        (function () {
            for (var i = 0; i < 256; i++) {
                var l = i / 255;
                l = Math.max(0, Math.min(1, (l - 0.5) * CONTRAST + 0.5));
                LUT[i] = RAMP.charCodeAt(Math.round((1 - l) * (RAMP.length - 1)));
            }
        })();

        /* ---- Gamma lookup tables for fast color processing ---- */
        var GAMMA_LUT = new Float32Array(256);
        var INV_GAMMA_LUT = new Float32Array(256);
        (function () {
            for (var i = 0; i < 256; i++) {
                var v = i / 255;
                GAMMA_LUT[i] = Math.pow(v, GAMMA);
                INV_GAMMA_LUT[i] = Math.pow(v, 1 / GAMMA);
            }
        })();

        /* ---- Pre-computed sample offsets for color averaging ---- */
        var SAMPLE_OFFSETS = [];
        function buildSampleOffsets() {
            SAMPLE_OFFSETS.length = 0;
            var sampleSize = Math.max(1, Math.floor(COLOR_SCALE / 2));
            for (var dy = -sampleSize; dy <= sampleSize; dy++) {
                for (var dx = -sampleSize; dx <= sampleSize; dx++) {
                    SAMPLE_OFFSETS.push({ dx: dx, dy: dy });
                }
            }
        }
        buildSampleOffsets();

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

        /* ---- Color canvas (higher resolution for accurate color sampling) ---- */
        var colorCanvas = document.createElement('canvas');
        var colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
        var colorCols = 0, colorRows = 0;

        /* ---- Reusable color map canvas (avoids allocation per frame) ---- */
        var colorMapCanvas = document.createElement('canvas');
        var colorMapCtx = colorMapCanvas.getContext('2d');
        var colorMapData = null;

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

            // Color canvas at higher resolution for accurate color sampling
            colorCols = cols * COLOR_SCALE;
            colorRows = rows * COLOR_SCALE;
            colorCanvas.width = colorCols;
            colorCanvas.height = colorRows;

            // Rebuild sample offsets when COLOR_SCALE changes
            buildSampleOffsets();

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

            // Draw to main canvas for luminance (character selection)
            ctx.drawImage(video, 0, 0, cols, rows);
            var d = ctx.getImageData(0, 0, cols, rows).data;

            // Draw to color canvas at higher resolution for accurate color sampling
            colorCtx.drawImage(video, 0, 0, colorCols, colorRows);
            var colorData = colorCtx.getImageData(0, 0, colorCols, colorRows).data;

            var lines = new Array(rows);
            var codes = new Array(cols);
            var p = 0;
            var scale = COLOR_SCALE;
            for (var y = 0; y < rows; y++) {
                for (var x = 0; x < cols; x++) {
                    var lum = (77 * d[p] + 150 * d[p + 1] + 29 * d[p + 2]) >> 8;
                    codes[x] = LUT[lum];
                    p += 4;
                }
                lines[y] = String.fromCharCode.apply(null, codes);
            }
            output.textContent = lines.join('\n');

            if (COLOR) {
                // Resize reusable color map canvas if needed
                if (colorMapCanvas.width !== cols || colorMapCanvas.height !== rows) {
                    colorMapCanvas.width = cols;
                    colorMapCanvas.height = rows;
                    colorMapData = colorMapCtx.createImageData(cols, rows);
                }
                // Build a color map by sampling average color per character cell from high-res canvas
                var colorMap = colorMapData.data;
                var cmIdx = 0;
                for (var y = 0; y < rows; y++) {
                    for (var x = 0; x < cols; x++) {
                        // Sample a small region around the center of each character cell for smoother colors
                        var cx = Math.floor((x + 0.5) * scale);
                        var cy = Math.floor((y + 0.5) * scale);
                        var r = 0, g = 0, b = 0, count = 0;
                        // Use pre-computed sample offsets
                        for (var i = 0; i < SAMPLE_OFFSETS.length; i++) {
                            var off = SAMPLE_OFFSETS[i];
                            var sx = cx + off.dx;
                            var sy = cy + off.dy;
                            if (sx >= 0 && sx < colorCols && sy >= 0 && sy < colorRows) {
                                var ci = (sy * colorCols + sx) * 4;
                                // Use lookup tables for fast gamma correction
                                r += GAMMA_LUT[colorData[ci]];
                                g += GAMMA_LUT[colorData[ci + 1]];
                                b += GAMMA_LUT[colorData[ci + 2]];
                                count++;
                            }
                        }
                        if (count > 0) {
                            var invCount = 1 / count;
                            r = INV_GAMMA_LUT[Math.min(255, Math.round(r * invCount * 255))] * 255;
                            g = INV_GAMMA_LUT[Math.min(255, Math.round(g * invCount * 255))] * 255;
                            b = INV_GAMMA_LUT[Math.min(255, Math.round(b * invCount * 255))] * 255;
                        }
                        // Apply saturation boost
                        var maxC = Math.max(r, g, b);
                        if (maxC > 0 && SATURATION_BOOST !== 1) {
                            var gray = (r + g + b) / 3;
                            r = gray + (r - gray) * SATURATION_BOOST;
                            g = gray + (g - gray) * SATURATION_BOOST;
                            b = gray + (b - gray) * SATURATION_BOOST;
                        }
                        // Apply contrast boost
                        if (COLOR_CONTRAST !== 1) {
                            var mid = 127.5;
                            r = mid + (r - mid) * COLOR_CONTRAST;
                            g = mid + (g - mid) * COLOR_CONTRAST;
                            b = mid + (b - mid) * COLOR_CONTRAST;
                        }
                        colorMap[cmIdx++] = Math.round(Math.max(0, Math.min(255, r)));
                        colorMap[cmIdx++] = Math.round(Math.max(0, Math.min(255, g)));
                        colorMap[cmIdx++] = Math.round(Math.max(0, Math.min(255, b)));
                        colorMap[cmIdx++] = 255;
                    }
                }
                colorMapCtx.putImageData(colorMapData, 0, 0);
                // Use PNG for lossless color, nearest-neighbor scaling via CSS
                output.style.backgroundImage = 'url(' + colorMapCanvas.toDataURL('image/png') + ')';
                output.style.imageRendering = 'pixelated';
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