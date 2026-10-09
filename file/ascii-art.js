/* ascii-art.js - image-to-ILOVEYOU ASCII for section 4, with isolated zoom */
(function () {
    var imageInput = document.getElementById('imageInput');
    var output = document.getElementById('output');
    var canvas = document.getElementById('sourceCanvas');
    var pixelSize = document.getElementById('pixelSize');
    var warning = document.getElementById('warning');
    var dangerBar = document.getElementById('dangerBar');
    var viewport = document.getElementById('asciiViewport');
    var stage = document.getElementById('asciiStage');

    if (!output || !canvas || !pixelSize || !viewport || !stage) return;

    var ctx = canvas.getContext('2d');
    var MAX_WORDS = 30000;
    var safeStep = 1;
    var STATIC_IMAGE = 'file/test.jpg';
    var currentImage = null;

    /* ---- Zoom state (isolated to stage; base tilt is 3deg) ---- */
    var zoom = 1;
    var MIN_ZOOM = 0.25;
    var MAX_ZOOM = 12;
    var BASE_ROTATE = 3; // degrees, matches CSS

    function applyZoom() {
        stage.style.transform = 'rotate(' + BASE_ROTATE + 'deg) scale(' + zoom + ')';
    }

    function setZoom(z, anchorX, anchorY) {
        var prev = zoom;
        zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
        if (zoom === prev) return;

        // Keep point under cursor stable when zooming with wheel
        if (typeof anchorX === 'number' && typeof anchorY === 'number') {
            var rect = viewport.getBoundingClientRect();
            var relX = anchorX - rect.left + viewport.scrollLeft;
            var relY = anchorY - rect.top + viewport.scrollTop;
            var ratio = zoom / prev;
            viewport.scrollLeft = relX * ratio - (anchorX - rect.left);
            viewport.scrollTop = relY * ratio - (anchorY - rect.top);
        }
        applyZoom();
    }

    function resetZoom() {
        zoom = 1;
        applyZoom();
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
    }

    // Mouse wheel zoom (confined to viewport)
    viewport.addEventListener('wheel', function (e) {
        e.preventDefault();
        var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        setZoom(zoom * factor, e.clientX, e.clientY);
    }, { passive: false });

    // Buttons
    var btnIn = document.getElementById('zoomIn');
    var btnOut = document.getElementById('zoomOut');
    var btnReset = document.getElementById('zoomReset');
    if (btnIn) btnIn.addEventListener('click', function () { setZoom(zoom * 1.25); });
    if (btnOut) btnOut.addEventListener('click', function () { setZoom(zoom / 1.25); });
    if (btnReset) btnReset.addEventListener('click', resetZoom);

    // Pinch-to-zoom (touch)
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

    /* ---- Image → ILOVEYOU rendering (from main.html) ---- */
    function loadImage() {
        var file = imageInput && imageInput.files[0];
        var image = new Image();
        image.onload = function () {
            currentImage = image;
            var fitted = fitPixelSize(image);
            pixelSize.value = fitted;
            safeStep = Math.min(findSafeStep(image), fitted);
            updateDangerUI();
            renderTextImage(image, fitted);
            resetZoom();
        };
        image.onerror = function () {
            console.error('Could not load image');
        };
        image.src = file ? URL.createObjectURL(file) : STATIC_IMAGE;
    }

    function rerender() {
        if (currentImage) {
            renderTextImage(currentImage, parseInt(pixelSize.value, 10));
        }
    }

    if (imageInput) {
        imageInput.addEventListener('change', loadImage);
    }
    pixelSize.addEventListener('input', function () {
        updateDangerUI();
        if (!isDanger()) rerender();
    });
    pixelSize.addEventListener('change', function () {
        if (isDanger()) rerender();
    });

    // Defer initial load until site is visible (after password)
    function tryInitialLoad() {
        if (document.getElementById('site-content') &&
            !document.getElementById('site-content').hasAttribute('hidden')) {
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

        for (var y = 0; y < height; y += stepY) {
            var line = document.createElement('div');
            for (var x = 0; x < width; x += stepX) {
                var index = (y * width + x) * 4;
                if (data[index + 3] === 0) continue;
                var word = document.createElement('span');
                word.className = 'word';
                word.textContent = 'ILOVEYOU';
                word.style.color =
                    'rgb(' + data[index] + ',' + data[index + 1] + ',' + data[index + 2] + ')';
                line.appendChild(word);
            }
            output.appendChild(line);
        }
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