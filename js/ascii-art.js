/* ascii-art.js - static image → ILOVEYOU ASCII for section 4, with isolated zoom */
(function () {
    var output = document.getElementById('output');
    var canvas = document.getElementById('sourceCanvas');
    var pixelSize = document.getElementById('pixelSize');
    var warning = document.getElementById('warning');
    var dangerBar = document.getElementById('dangerBar');
    var viewport = document.getElementById('asciiViewport');
    var stage = document.getElementById('asciiStage');

    pixelSize.addEventListener('change', (e) => {
        console.log(e.value);
    });

    if (!output || !canvas || !pixelSize || !viewport || !stage) return;

    var ctx = canvas.getContext('2d');
    var MAX_WORDS = 30000;

    var safeStep = 1;
    // Static image at site root (same folder as index.html)
    var STATIC_IMAGE = 'image.jpg';
    var currentImage = null;
    var PREFERRED_STEP = 16;

    /* ---- Zoom state (scale only; parent .ascii-viewport holds the tilt) ---- */
    var BASE_FONT = 4;
    var zoom = 0.3923;
    var MIN_ZOOM = 0.15;
    var MAX_ZOOM = 12;

    function applyFont() {
        output.style.fontSize = (BASE_FONT * zoom) + 'px';
    }

    function centerScroll() {
        requestAnimationFrame(function () {
            viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
            viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
        });
    }

    function fitZoomToViewport() {
        if (!output.firstChild) return 1;

        // temporarily set zoom=1 so we can measure true size
        var oldZoom = zoom;
        zoom = 1;
        applyFont();

        var stageW = stage.scrollWidth || stage.offsetWidth;
        var stageH = stage.scrollHeight || stage.offsetHeight;
        var viewW = viewport.clientWidth - 24;   // small padding
        var viewH = viewport.clientHeight - 24;

        if (stageW === 0 || stageH === 0) {
            zoom = oldZoom;
            applyFont();
            return oldZoom;
        }

        var scale = Math.min(viewW / stageW, viewH / stageH, 1); // never enlarge past 1
        scale = Math.max(MIN_ZOOM, scale);

        zoom = scale;
        applyFont();
        console.log('[ascii-art] fitZoomToViewport →', zoom.toFixed(4));
        return scale;
    }

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    function setZoom(z, anchorX, anchorY) {
        z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
        if (z === zoom) return;

        // Default anchor = viewport center (used by the +/- buttons)
        var vr = viewport.getBoundingClientRect();
        if (typeof anchorX !== 'number' || typeof anchorY !== 'number') {
            anchorX = vr.left + vr.width / 2;
            anchorY = vr.top + vr.height / 2;
        }

        // Which fraction of the image is under the anchor right now?
        var sr = stage.getBoundingClientRect();
        var fx = sr.width ? clamp01((anchorX - sr.left) / sr.width) : 0.5;
        var fy = sr.height ? clamp01((anchorY - sr.top) / sr.height) : 0.5;

        zoom = z;
        applyFont();
        console.log('[ascii-art] zoom =', zoom.toFixed(4));   // ← add this

        // Keep that same point under the anchor. If the image now fits inside
        // the viewport, scroll clamps to 0 and margin:auto centers it.
        var nr = stage.getBoundingClientRect();
        viewport.scrollLeft += (nr.left + fx * nr.width) - anchorX;
        viewport.scrollTop += (nr.top + fy * nr.height) - anchorY;
    }

    function resetZoom() {
        fitZoomToViewport();          // ← auto zoom-out so everything is visible
        centerScroll();
    }

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

    function loadImage() {
        var image = new Image();
        image.onload = function () {
            currentImage = image;

            // Calculate the absolute minimum allowed by word-count
            safeStep = findSafeStep(image);

            // Prefer the fixed quality, but never go below the safe limit
            var step = Math.max(PREFERRED_STEP, safeStep);

            // Still let the slider go higher if the user wants coarser
            var fitted = fitPixelSize(image);          // updates pixelSize.max
            pixelSize.max = Math.max(pixelSize.max, step * 2);
            pixelSize.value = step;
            updateDangerUI();
            renderTextImage(image, step);

            console.log('[ascii-art] default step =', step,
                '| safeStep =', safeStep,
                '| fitted-for-viewport =', fitted);

            requestAnimationFrame(function () {
                resetZoom();              // now uses the smart fitZoomToViewport
            });
        };
        image.onerror = function () {
            console.error('Could not load static image:', STATIC_IMAGE);
        };
        image.src = STATIC_IMAGE;
    }

    function rerender() {
        if (currentImage) {
            renderTextImage(currentImage, parseInt(pixelSize.value, 10));
            centerScroll();
        }
    }

    pixelSize.addEventListener('input', function () {
        updateDangerUI();
        if (!isDanger()) rerender();
    });
    pixelSize.addEventListener('change', function () {
        if (isDanger()) rerender();
    });

    function tryInitialLoad() {
        var site = document.getElementById('site-content');
        if (site && !site.hasAttribute('hidden')) {
            loadImage();
        } else {
            setTimeout(tryInitialLoad, 200);
        }
    }
    tryInitialLoad();

    function measureWord() {
        var probe = document.createElement('span');
        probe.className = 'word';
        probe.textContent = 'ILOVEYOU';
        output.appendChild(probe);
        var rect = probe.getBoundingClientRect();
        output.removeChild(probe);
        return rect;
    }

    function fitPixelSize(image) {
        output.innerHTML = '';
        var rect = measureWord();
        var ratio = rect.width / rect.height;
        var FIT = 0.9;
        var availableW = Math.max(200, (viewport.clientWidth - 56) * FIT);
        var availableH = Math.max(160, (viewport.clientHeight - 56) * FIT);
        var wordsPerRow = Math.max(1, Math.floor(availableW / rect.width));
        var rowsFit = Math.max(1, Math.floor(availableH / rect.height));
        var stepX = Math.max(
            1,
            Math.ceil(image.width / wordsPerRow),
            Math.ceil((image.height * ratio) / rowsFit)
        );
        pixelSize.max = Math.max(40, stepX * 2);
        return stepX;
    }

    function renderTextImage(image, stepX) {
        var width = image.width;
        var height = image.height;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
        var data = ctx.getImageData(0, 0, width, height).data;
        output.innerHTML = '';
        var rect = measureWord();
        var ratio = rect.width / rect.height;
        var stepY = Math.max(1, Math.round(stepX / ratio));

        // helpful logging
        console.log('[ascii-art] image:', width + '×' + height,
            '| stepX:', stepX, '| stepY:', stepY,
            '| ~words:', wordCount(image, stepX, ratio).toLocaleString(),
            '| safeStep:', safeStep);

        for (var y = 0; y < height; y += stepY) {
            var line = document.createElement('div');
            for (var x = 0; x < width; x += stepX) {
                var col = averageColor(data, width, x, y, stepX, stepY, width, height);
                if (!col) continue;                 // skip transparent blocks

                var word = document.createElement('span');
                word.className = 'word';
                word.textContent = 'ILOVEYOU';
                word.style.color = 'rgb(' + col.r + ',' + col.g + ',' + col.b + ')';
                // optional: also respect alpha if you want soft edges
                // word.style.opacity = (col.a / 255).toFixed(2);
                line.appendChild(word);
            }
            if (line.childNodes.length) output.appendChild(line);
        }
    }

    function averageColor(data, width, x0, y0, stepX, stepY, imgW, imgH) {
        var r = 0, g = 0, b = 0, a = 0, count = 0;
        var xEnd = Math.min(x0 + stepX, imgW);
        var yEnd = Math.min(y0 + stepY, imgH);

        for (var y = y0; y < yEnd; y++) {
            for (var x = x0; x < xEnd; x++) {
                var i = (y * width + x) * 4;
                var alpha = data[i + 3];
                if (alpha === 0) continue;          // skip fully transparent
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                a += alpha;
                count++;
            }
        }
        if (count === 0) return null;               // completely transparent block
        return {
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count),
            a: Math.round(a / count)
        };
    }

    function getRatio() {
        var rect = measureWord();
        return rect.width / rect.height;
    }

    function wordCount(image, step, ratio) {
        var stepY = Math.max(1, Math.round(step / ratio));
        return Math.ceil(image.width / step) * Math.ceil(image.height / stepY);
    }

    function findSafeStep(image) {
        var ratio = getRatio();
        var step = 1;
        while (wordCount(image, step, ratio) > MAX_WORDS) step++;
        return step;
    }

    function isDanger() {
        return parseInt(pixelSize.value, 10) < safeStep;
    }

    function updateDangerUI() {
        var min = parseInt(pixelSize.min, 10);
        var max = parseInt(pixelSize.max, 10);
        var pct = Math.min(100, Math.max(0, (safeStep - min) / (max - min) * 100));
        if (dangerBar) dangerBar.style.width = pct + '%';
        if (currentImage && isDanger()) {
            var count = wordCount(currentImage, parseInt(pixelSize.value, 10), getRatio());
            if (warning) warning.textContent = '⚠ ~' + count.toLocaleString() + ' words, release to render (may lag)';
        } else if (warning) {
            warning.textContent = '';
        }
    }
})();