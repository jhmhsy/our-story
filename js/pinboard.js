/* pinboard.js - thumbtacked photo carousel inside #gallery, below the gallery carousel.
   Swaying pins, per-photo print button, and a photo-booth camera panel:
   formats (single / strip x3 / grid x4 / landscape x4 / custom), filters, paper colour,
   review step (retake or add), caption, and queueing to IndexedDB for admin approval.
   Content shape: SITE_CONTENT.pinboard = { title, subtitle, photos: [{ src, caption }], dir? }
   Admin panel (admin/index.html) reads the same IndexedDB (ourStoryPinboard/pending) and commits to GitHub. */
(function () {
    'use strict';
    var section = document.getElementById('gallery');
    if (!section || section.getAttribute('data-pn-built')) return;
    section.setAttribute('data-pn-built', '1');

    var cfg = (window.SITE_CONTENT && window.SITE_CONTENT.pinboard) || {};
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var MAX_VISIBLE = 2;
    var GH_OWNER = 'jhmhsy';
    var GH_REPO = 'our-story';
    var GH_TOKEN = 'rahhhh';
    var CONTENT_PATH = 'data/content.json';
    var IMG_DIR = 'images';
    var PAD = 40, GAP = 24;

    /* IndexedDB queue (shared with admin/index.html) */
    var QUEUE_DB = 'ourStoryPinboard';
    var QUEUE_STORE = 'pending';

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function todayStr() {
        return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

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

    /* ==================================================================
       Booth data: formats, filters, paper colours
       ================================================================== */
    var SHAPES = { portrait: 0.8, square: 1, landscape: 4 / 3 };
    var FORMATS = [
        { id: 'single', label: 'Single', cols: 1, rows: 1, ar: 0.8, cellW: 640, footer: 110 },
        { id: 'strip3', label: 'Strip \u00D73', cols: 1, rows: 3, ar: 4 / 3, cellW: 520, footer: 120 },
        { id: 'grid4', label: 'Grid \u00D74', cols: 2, rows: 2, ar: 0.8, cellW: 400, footer: 110 },
        { id: 'wide4', label: 'Landscape \u00D74', cols: 4, rows: 1, ar: 0.8, cellW: 300, footer: 110 },
        { id: 'custom', label: 'Custom' }
    ];
    var FILTERS = [
        { id: 'none', name: 'Normal' },
        { id: 'bw', name: 'B&W', g: 1, c: 1.1 },
        { id: 'noir', name: 'Noir', g: 1, c: 1.45, b: 0.9 },
        { id: 'sepia', name: 'Sepia', sp: 0.9, c: 1.05 },
        { id: 'vintage', name: 'Vintage', sp: 0.45, c: 0.9, b: 1.08, s: 0.8 },
        { id: 'warm', name: 'Warm', sp: 0.25, s: 1.35, b: 1.05 },
        { id: 'cool', name: 'Cool', h: -18, s: 1.1, b: 1.03 },
        { id: 'fade', name: 'Faded', c: 0.78, b: 1.18, s: 0.8 },
        { id: 'vivid', name: 'Vivid', s: 1.7, c: 1.12 },
        { id: 'rosy', name: 'Rosy', sp: 0.3, h: -35, s: 1.4, b: 1.08 },
        { id: 'dream', name: 'Dreamy', b: 1.12, c: 0.88, s: 1.25 }
    ];
    var PAPERS = [
        { name: 'White', c: '#ffffff', dark: false },
        { name: 'Blush', c: '#ffe3ee', dark: false },
        { name: 'Cream', c: '#fff4dc', dark: false },
        { name: 'Wine', c: '#9c1f58', dark: true },
        { name: 'Black', c: '#1b0f16', dark: true }
    ];

    var sel = { format: 'strip3', cols: 2, rows: 2, shape: 'portrait', filter: 'none', paper: 0, border: 'mat', date: true, timer: 3 };

    function curFilter() {
        for (var i = 0; i < FILTERS.length; i++) if (FILTERS[i].id === sel.filter) return FILTERS[i];
        return FILTERS[0];
    }
    function fv(v, d) { return v == null ? d : v; }
    function fparams(f) {
        return { b: fv(f.b, 1), c: fv(f.c, 1), s: fv(f.s, 1), g: fv(f.g, 0), sp: fv(f.sp, 0), h: fv(f.h, 0) };
    }
    /* Same filter for the live preview (CSS) and the saved photo (pixels), so Safari works too */
    function cssFilter(f) {
        var p = fparams(f), out = [];
        if (p.b !== 1) out.push('brightness(' + p.b + ')');
        if (p.c !== 1) out.push('contrast(' + p.c + ')');
        if (p.s !== 1) out.push('saturate(' + p.s + ')');
        if (p.g) out.push('grayscale(' + p.g + ')');
        if (p.sp) out.push('sepia(' + p.sp + ')');
        if (p.h) out.push('hue-rotate(' + p.h + 'deg)');
        return out.length ? out.join(' ') : 'none';
    }
    function mul(a, b) {
        var o = [], i, j;
        for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
            o.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
        }
        return o;
    }
    function colorMatrix(p) {
        var s = p.s, k = 1 - p.g, q = 1 - p.sp, t = p.h * Math.PI / 180, co = Math.cos(t), si = Math.sin(t);
        var sat = [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s];
        var gray = [0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k,
        0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k,
        0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k];
        var sep = [0.393 + 0.607 * q, 0.769 - 0.769 * q, 0.189 - 0.189 * q,
        0.349 - 0.349 * q, 0.686 + 0.314 * q, 0.168 - 0.168 * q,
        0.272 - 0.272 * q, 0.534 - 0.534 * q, 0.131 + 0.869 * q];
        var hue = [0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928,
        0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.140, 0.072 - co * 0.072 - si * 0.283,
        0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072];
        return mul(hue, mul(sep, mul(gray, sat)));
    }
    function applyFilter(ctx, x, y, w, h, f) {
        if (!f || f.id === 'none') return;
        var p = fparams(f), m = colorMatrix(p);
        var img = ctx.getImageData(x, y, w, h), d = img.data;
        for (var i = 0; i < d.length; i += 4) {
            var r = d[i] / 255 * p.b, g = d[i + 1] / 255 * p.b, b = d[i + 2] / 255 * p.b;
            r = (r - 0.5) * p.c + 0.5; g = (g - 0.5) * p.c + 0.5; b = (b - 0.5) * p.c + 0.5;
            r = r < 0 ? 0 : r > 1 ? 1 : r;
            g = g < 0 ? 0 : g > 1 ? 1 : g;
            b = b < 0 ? 0 : b > 1 ? 1 : b;
            d[i] = (m[0] * r + m[1] * g + m[2] * b) * 255;
            d[i + 1] = (m[3] * r + m[4] * g + m[5] * b) * 255;
            d[i + 2] = (m[6] * r + m[7] * g + m[8] * b) * 255;
        }
        ctx.putImageData(img, x, y);
    }

    var BORDERS = [
        { id: 'none', name: 'None', bw: 0 },
        { id: 'line', name: 'Line', bw: 8 },
        { id: 'double', name: 'Double', bw: 16 },
        { id: 'mat', name: 'White mat', bw: 18 },
        { id: 'polaroid', name: 'Polaroid', bw: 16 },
        { id: 'shadow', name: 'Shadow', bw: 6 },
        { id: 'rounded', name: 'Rounded', bw: 8 },
        { id: 'film', name: 'Film', bw: 26 },
        { id: 'corners', name: 'Corners', bw: 0 },
        { id: 'stitch', name: 'Stitch', bw: 14 },
        { id: 'dotted', name: 'Dotted', bw: 14 },
        { id: 'scallop', name: 'Scallop', bw: 16 },
        { id: 'neon', name: 'Neon', bw: 12 },
        { id: 'gold', name: 'Gold', bw: 18 },
        { id: 'taped', name: 'Taped', bw: 12 },
        { id: 'washi', name: 'Washi', bw: 10 },
        { id: 'hearts', name: 'Hearts', bw: 14 },
        { id: 'stars', name: 'Stars', bw: 14 }
    ];
    function curBorder() {
        for (var i = 0; i < BORDERS.length; i++) if (BORDERS[i].id === sel.border) return BORDERS[i];
        return BORDERS[0];
    }

    function spec() {
        var f = null, i, bw = curBorder().bw;
        for (i = 0; i < FORMATS.length; i++) if (FORMATS[i].id === sel.format) f = FORMATS[i];
        if (f && f.id !== 'custom') return f;
        var cols = sel.cols, rows = sel.rows;
        return {
            id: 'custom', cols: cols, rows: rows, ar: SHAPES[sel.shape],
            cellW: Math.min(520, Math.floor((1280 - (PAD + bw) * 2 - (cols - 1) * (GAP + bw * 2)) / cols)),
            footer: 110
        };
    }
    function layout(sp) {
        var bw = curBorder().bw, pad = PAD + bw, gap = GAP + bw * 2;
        var cellH = Math.round(sp.cellW / sp.ar), rects = [], r, c;
        var framesH = sp.rows * cellH + (sp.rows - 1) * gap;
        for (r = 0; r < sp.rows; r++) for (c = 0; c < sp.cols; c++) {
            rects.push({ x: pad + c * (sp.cellW + gap), y: pad + r * (cellH + gap), w: sp.cellW, h: cellH });
        }
        return {
            W: pad * 2 + sp.cols * sp.cellW + (sp.cols - 1) * gap,
            H: pad + framesH + bw + sp.footer,
            rects: rects,
            footerY: pad + framesH + bw + sp.footer * 0.55,
            footer: sp.footer
        };
    }

    function rrect(ctx, x, y, w, h, rad) {
        ctx.beginPath();
        ctx.moveTo(x + rad, y);
        ctx.arcTo(x + w, y, x + w, y + h, rad);
        ctx.arcTo(x + w, y + h, x, y + h, rad);
        ctx.arcTo(x, y + h, x, y, rad);
        ctx.arcTo(x, y, x + w, y, rad);
        ctx.closePath();
    }
    /* Drawn behind the photo */
    function borderBefore(ctx, id, r, paper) {
        var bw = curBorder().bw;
        if (id === 'mat' || id === 'taped' || id === 'washi') {
            ctx.save();
            ctx.shadowColor = 'rgba(40, 20, 30, 0.35)';
            ctx.shadowBlur = 16;
            ctx.shadowOffsetY = 5;
            ctx.fillStyle = '#fff';
            ctx.fillRect(r.x - bw, r.y - bw, r.w + bw * 2, r.h + bw * 2);
            ctx.restore();
        } else if (id === 'polaroid') {
            ctx.save();
            ctx.shadowColor = 'rgba(40, 20, 30, 0.35)';
            ctx.shadowBlur = 16;
            ctx.shadowOffsetY = 5;
            ctx.fillStyle = '#fff';
            ctx.fillRect(r.x - bw, r.y - bw, r.w + bw * 2, r.h + bw * 2 + 14);
            ctx.restore();
        } else if (id === 'shadow') {
            ctx.save();
            ctx.shadowColor = 'rgba(40, 20, 30, 0.45)';
            ctx.shadowBlur = 22;
            ctx.shadowOffsetX = 6;
            ctx.shadowOffsetY = 10;
            ctx.fillStyle = '#fff';
            ctx.fillRect(r.x - bw, r.y - bw, r.w + bw * 2, r.h + bw * 2);
            ctx.restore();
        } else if (id === 'rounded') {
            ctx.fillStyle = '#fff';
            rrect(ctx, r.x - bw, r.y - bw, r.w + bw * 2, r.h + bw * 2, 38);
            ctx.fill();
        } else if (id === 'scallop') {
            var rad = 8, x0 = r.x - bw, y0 = r.y - bw, w0 = r.w + bw * 2, h0 = r.h + bw * 2;
            var nx = Math.max(2, Math.round(w0 / 20)), ny = Math.max(2, Math.round(h0 / 20)), k, cx, cy;
            ctx.save();
            ctx.shadowColor = 'rgba(40, 20, 30, 0.3)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 4;
            ctx.fillStyle = '#fff';
            ctx.fillRect(x0 + rad, y0 + rad, w0 - rad * 2, h0 - rad * 2);
            ctx.beginPath();
            for (k = 0; k < nx; k++) {
                cx = x0 + rad + (w0 - rad * 2) * (k + 0.5) / nx;
                ctx.moveTo(cx + rad, y0 + rad);
                ctx.arc(cx, y0 + rad, rad, 0, Math.PI * 2);
                ctx.moveTo(cx + rad, y0 + h0 - rad);
                ctx.arc(cx, y0 + h0 - rad, rad, 0, Math.PI * 2);
            }
            for (k = 0; k < ny; k++) {
                cy = y0 + rad + (h0 - rad * 2) * (k + 0.5) / ny;
                ctx.moveTo(x0 + rad + rad, cy);
                ctx.arc(x0 + rad, cy, rad, 0, Math.PI * 2);
                ctx.moveTo(x0 + w0 - rad + rad, cy);
                ctx.arc(x0 + w0 - rad, cy, rad, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.restore();
        } else if (id === 'film') {
            ctx.fillStyle = '#111';
            ctx.fillRect(r.x - bw, r.y - bw, r.w + bw * 2, r.h + bw * 2);
            var span = r.w + bw * 2, n = Math.max(1, Math.floor(span / 30)), j;
            var sx = r.x - bw + (span - (n * 30 - 14)) / 2;
            ctx.fillStyle = paper.c;
            for (j = 0; j < n; j++) {
                rrect(ctx, sx + j * 30, r.y - bw / 2 - 6, 16, 12, 3);
                ctx.fill();
                rrect(ctx, sx + j * 30, r.y + r.h + bw / 2 - 6, 16, 12, 3);
                ctx.fill();
            }
        }
    }
    /* Drawn on top of the photo */
    function borderAfter(ctx, id, r, i, ink, paper) {
        ctx.save();
        ctx.strokeStyle = ink;
        ctx.fillStyle = ink;
        if (id === 'line') {
            ctx.lineWidth = 3;
            ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
        } else if (id === 'double') {
            ctx.lineWidth = 3;
            ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
            ctx.lineWidth = 1.5;
            ctx.strokeRect(r.x - 14, r.y - 14, r.w + 28, r.h + 28);
        } else if (id === 'stitch') {
            ctx.lineWidth = 3;
            ctx.setLineDash([12, 8]);
            ctx.strokeRect(r.x - 9, r.y - 9, r.w + 18, r.h + 18);
        } else if (id === 'dotted') {
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.setLineDash([0, 14]);
            ctx.strokeRect(r.x - 9, r.y - 9, r.w + 18, r.h + 18);
        } else if (id === 'neon') {
            var glow = paper.dark ? '#ff8fc8' : '#ff2d8a';
            ctx.shadowColor = glow;
            ctx.shadowBlur = 20;
            ctx.strokeStyle = glow;
            ctx.lineWidth = 5;
            ctx.strokeRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16);
        } else if (id === 'gold') {
            ctx.strokeStyle = '#c9992b';
            ctx.lineWidth = 4;
            ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
            ctx.strokeStyle = '#f3d77a';
            ctx.lineWidth = 2;
            ctx.strokeRect(r.x - 13, r.y - 13, r.w + 26, r.h + 26);
            ctx.fillStyle = '#c9992b';
            [[r.x - 13, r.y - 13], [r.x + r.w + 13, r.y - 13], [r.x - 13, r.y + r.h + 13], [r.x + r.w + 13, r.y + r.h + 13]].forEach(function (p) {
                ctx.beginPath();
                ctx.moveTo(p[0], p[1] - 7);
                ctx.lineTo(p[0] + 7, p[1]);
                ctx.lineTo(p[0], p[1] + 7);
                ctx.lineTo(p[0] - 7, p[1]);
                ctx.closePath();
                ctx.fill();
            });
        } else if (id === 'corners') {
            var s = 42, x2 = r.x + r.w, y2 = r.y + r.h;
            ctx.fillStyle = paper.dark ? '#ffe3ee' : '#2b1020';
            [[r.x, r.y, 1, 1], [x2, r.y, -1, 1], [r.x, y2, 1, -1], [x2, y2, -1, -1]].forEach(function (p) {
                ctx.beginPath();
                ctx.moveTo(p[0], p[1]);
                ctx.lineTo(p[0] + p[2] * s, p[1]);
                ctx.lineTo(p[0], p[1] + p[3] * s);
                ctx.closePath();
                ctx.fill();
            });
        } else if (id === 'taped') {
            ctx.fillStyle = 'rgba(255, 190, 215, 0.88)';
            [[r.x + 24, -0.6], [r.x + r.w - 24, 0.6]].forEach(function (t) {
                ctx.save();
                ctx.translate(t[0], r.y + 4);
                ctx.rotate(t[1]);
                ctx.fillRect(-46, -14, 92, 28);
                ctx.restore();
            });
        } else if (id === 'washi') {
            var tapes = ['rgba(255, 190, 215, 0.9)', 'rgba(255, 232, 150, 0.9)', 'rgba(178, 235, 214, 0.9)', 'rgba(190, 220, 255, 0.9)'];
            [[r.x, r.y, -0.785], [r.x + r.w, r.y, 0.785], [r.x, r.y + r.h, 0.785], [r.x + r.w, r.y + r.h, -0.785]].forEach(function (t, k) {
                ctx.save();
                ctx.translate(t[0], t[1]);
                ctx.rotate(t[2]);
                ctx.fillStyle = tapes[k];
                ctx.fillRect(-48, -13, 96, 26);
                ctx.restore();
            });
        } else if (id === 'hearts' || id === 'stars') {
            var glyph = id === 'hearts' ? '\u2665' : '\u2605';
            ctx.font = '700 ' + (id === 'hearts' ? 30 : 28) + 'px "Segoe UI Symbol", "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            var xs = [r.x - 7, r.x + r.w / 2, r.x + r.w + 7];
            var ys = [r.y - 7, r.y + r.h / 2, r.y + r.h + 7];
            for (var a = 0; a < 3; a++) {
                for (var b = 0; b < 3; b++) {
                    if (a === 1 && b === 1) continue;
                    if (id === 'hearts' && (a === 1 || b === 1)) continue;   // hearts: corners only
                    ctx.fillText(glyph, xs[a], ys[b]);
                }
            }
        }
        ctx.restore();
    }

    /* ==================================================================
       DOM
       ================================================================== */
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

    /* ---- Camera panel: main column (view + actions) and side column (formats + filters) ---- */
    var cam = el('div', 'pn-cam');
    cam.setAttribute('aria-hidden', 'true');
    var camInner = el('div', 'pn-cam__inner');

    var main = el('div', 'pn-cam__main');
    var status = el('p', 'pn-cam__status', '');
    status.setAttribute('aria-live', 'polite');
    var view = el('div', 'pn-cam__view');
    var video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    var shown = document.createElement('canvas');
    shown.className = 'pn-cam__result';
    shown.hidden = true;
    var countEl = el('div', 'pn-cam__count');
    countEl.setAttribute('aria-hidden', 'true');
    var flash = el('div', 'pn-cam__flash');
    view.appendChild(shown);
    view.appendChild(video);
    view.appendChild(countEl);
    view.appendChild(flash);
    view.style.position = 'relative';

    var reviewBox = el('div', 'pn-cam__review');
    reviewBox.hidden = true;
    var captionInput = document.createElement('input');
    captionInput.type = 'text';
    captionInput.maxLength = 40;
    captionInput.className = 'pn-cam__input';
    captionInput.placeholder = 'Add a caption (optional)';
    captionInput.setAttribute('aria-label', 'Caption');
    reviewBox.appendChild(captionInput);

    var saveMsg = el('p', 'pn-cam__save', '');
    saveMsg.setAttribute('aria-live', 'polite');

    var camBtns = el('div', 'pn-cam__btns');
    var shotBtn = el('button', 'pn-cam__btn', 'Capture \uD83D\uDCF8');
    shotBtn.type = 'button';
    shotBtn.disabled = true;
    var retakeBtn = el('button', 'pn-cam__btn pn-cam__btn--ghost', 'Retake \u21BA');
    retakeBtn.type = 'button';
    retakeBtn.hidden = true;
    var pinBtn = el('button', 'pn-cam__btn', 'Add to pinboard \uD83D\uDCCC');
    pinBtn.type = 'button';
    pinBtn.hidden = true;
    var dlBtn = el('button', 'pn-cam__btn pn-cam__btn--ghost', 'Download \u2B07');
    dlBtn.type = 'button';
    dlBtn.hidden = true;
    var closeBtn = el('button', 'pn-cam__btn pn-cam__btn--ghost', 'Close \u2715');
    closeBtn.type = 'button';
    camBtns.appendChild(shotBtn);
    camBtns.appendChild(retakeBtn);
    camBtns.appendChild(pinBtn);
    camBtns.appendChild(dlBtn);
    camBtns.appendChild(closeBtn);

    main.appendChild(status);
    main.appendChild(view);
    main.appendChild(reviewBox);
    main.appendChild(saveMsg);
    main.appendChild(camBtns);

    /* ---- Side column ---- */
    var side = el('aside', 'pn-cam__side');
    side.setAttribute('aria-label', 'Photo booth options');
    var lockables = [];
    var fmtBtns = {}, shapeBtns = {}, filterBtns = {}, borderBtns = {}, paperBtns = [];

    function chip(label, cls) {
        var b = el('button', cls || 'pn-chip', label);
        b.type = 'button';
        return b;
    }
    function group(title) {
        var g = el('div', 'pn-side__group');
        g.appendChild(el('h3', 'pn-side__title', title));
        side.appendChild(g);
        return g;
    }

    var gFormat = group('Format');
    var fmtRow = el('div', 'pn-chips');
    FORMATS.forEach(function (f) {
        var b = chip(f.label);
        b.addEventListener('click', function () { sel.format = f.id; refreshUI(); onChange(); });
        fmtBtns[f.id] = b;
        lockables.push(b);
        fmtRow.appendChild(b);
    });
    gFormat.appendChild(fmtRow);

    var customBox = el('div', 'pn-custom');
    function stepper(label, key) {
        var row = el('div', 'pn-step');
        row.appendChild(el('span', 'pn-step__label', label));
        var minus = chip('\u2212', 'pn-step__btn');
        minus.setAttribute('aria-label', 'Fewer ' + label.toLowerCase());
        var val = el('span', 'pn-step__val');
        var plus = chip('+', 'pn-step__btn');
        plus.setAttribute('aria-label', 'More ' + label.toLowerCase());
        minus.addEventListener('click', function () { sel[key] = clamp(sel[key] - 1, 1, 4); refreshUI(); onChange(); });
        plus.addEventListener('click', function () { sel[key] = clamp(sel[key] + 1, 1, 4); refreshUI(); onChange(); });
        lockables.push(minus, plus);
        row.appendChild(minus);
        row.appendChild(val);
        row.appendChild(plus);
        customBox.appendChild(row);
        return val;
    }
    var colsVal = stepper('Columns', 'cols');
    var rowsVal = stepper('Rows', 'rows');
    var shapeRow = el('div', 'pn-chips');
    [['portrait', 'Portrait'], ['square', 'Square'], ['landscape', 'Landscape']].forEach(function (s) {
        var b = chip(s[1]);
        b.addEventListener('click', function () { sel.shape = s[0]; refreshUI(); onChange(); });
        shapeBtns[s[0]] = b;
        lockables.push(b);
        shapeRow.appendChild(b);
    });
    customBox.appendChild(shapeRow);
    gFormat.appendChild(customBox);
    var shotsNote = el('p', 'pn-side__note');
    gFormat.appendChild(shotsNote);

    var gFilter = group('Filter');
    var filterGrid = el('div', 'pn-filters');
    FILTERS.forEach(function (f) {
        var b = el('button', 'pn-filter');
        b.type = 'button';
        var sw = el('span', 'pn-filter__swatch');
        sw.style.filter = cssFilter(f);
        b.appendChild(sw);
        b.appendChild(el('span', 'pn-filter__name', f.name));
        b.addEventListener('click', function () { sel.filter = f.id; refreshUI(); onChange(); });
        filterBtns[f.id] = b;
        filterGrid.appendChild(b);
    });
    gFilter.appendChild(filterGrid);

    var gPaper = group('Paper');
    var paperRow = el('div', 'pn-papers');
    PAPERS.forEach(function (p, i) {
        var b = el('button', 'pn-paper');
        b.type = 'button';
        b.style.background = p.c;
        b.setAttribute('aria-label', p.name + ' paper');
        b.title = p.name;
        b.addEventListener('click', function () { sel.paper = i; refreshUI(); onChange(); });
        paperBtns.push(b);
        paperRow.appendChild(b);
    });
    gPaper.appendChild(paperRow);
    var gBorder = group('Border');
    var borderRow = el('div', 'pn-chips');
    BORDERS.forEach(function (b) {
        var btn = chip(b.name);
        btn.addEventListener('click', function () { sel.border = b.id; refreshUI(); onChange(); });
        borderBtns[b.id] = btn;
        borderRow.appendChild(btn);
    });
    gBorder.appendChild(borderRow);

    var gOpts = group('Options');
    var dateLabel = el('label', 'pn-check');
    var dateBox = document.createElement('input');
    dateBox.type = 'checkbox';
    dateBox.checked = sel.date;
    dateBox.addEventListener('change', function () { sel.date = dateBox.checked; onChange(); });
    dateLabel.appendChild(dateBox);
    dateLabel.appendChild(el('span', '', 'Date stamp'));
    gOpts.appendChild(dateLabel);
    var timerLabel = el('label', 'pn-check');
    timerLabel.appendChild(el('span', '', 'Timer'));
    var timerSel = document.createElement('select');
    timerSel.className = 'pn-select';
    [[0, 'Off'], [3, '3 s'], [5, '5 s']].forEach(function (o) {
        var op = document.createElement('option');
        op.value = String(o[0]);
        op.textContent = o[1];
        if (o[0] === sel.timer) op.selected = true;
        timerSel.appendChild(op);
    });
    timerSel.addEventListener('change', function () { sel.timer = parseInt(timerSel.value, 10) || 0; });
    timerLabel.appendChild(timerSel);
    gOpts.appendChild(timerLabel);

    camInner.appendChild(main);
    camInner.appendChild(side);
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

    /* ==================================================================
       Carousel
       ================================================================== */
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

        // Special handling for N <= 2: use simple linear layout instead of ring
        // to avoid the "teleport" artifact when animating on a 2-item ring
        if (N <= 2) {
            var active = mod(Math.round(pos));
            for (var i = 0; i < N; i++) {
                var it = items[i];
                // Position: active at center (0), other at -1 (left peek)
                var d = (i === active) ? 0 : -1;
                var ad = Math.abs(d);
                var scale = 1 - Math.min(ad, 2) * 0.1;
                it.style.visibility = 'visible';
                it.style.opacity = '1';
                it.style.zIndex = String(100 - Math.round(ad * 10));
                it.style.transform = 'translateX(-50%) translateX(' + (d * spacing).toFixed(2) + 'px) scale(' + scale.toFixed(3) + ')';
            }
            if (active !== lastActive) {
                lastActive = active;
                for (var j = 0; j < N; j++) items[j].classList.toggle('is-active', j === active);
                count.textContent = (active + 1) + ' / ' + N;
            }
            return;
        }

        // Normal ring layout for N >= 3
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

    /* Every pinned photo swings on its tack when you navigate */
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

    function addPhoto(p) {
        var cur = mod(Math.round(target));
        pos = target = N ? cur : 0;                         // normalise; looks identical on a ring
        photos.splice(N ? cur + 1 : 0, 0, p);
        rebuild();
        if (N > 1) go(1);
    }

    /* ==================================================================
       Booth: UI state, live view, shooting, review
       ================================================================== */
    var stream = null, camToken = 0, seqToken = 0;
    var mode = 'live';                                      // live | shooting | review | saving
    var frames = [];                                        // raw, unmirrored, uncropped video frames
    var composed = null;                                    // final sheet canvas
    var stripPreview = null;                                // canvas for progressive strip preview

    function setStatus(msg) { status.textContent = msg; }
    function setSave(msg) { saveMsg.textContent = msg; }

    /* ---- Progressive preview for multi-photo formats (strip, grid, wide, custom) ---- */
    function slotActive() {
        var sp = spec();
        return sp.cols * sp.rows >= 2 && (mode === 'live' || mode === 'shooting');
    }

    function resetSlotStyles() {
        ['position', 'left', 'top', 'width', 'height', 'objectFit', 'transform', 'borderRadius', 'zIndex']
            .forEach(function (k) { video.style[k] = ''; });
        ['position', 'left', 'top', 'width', 'height']
            .forEach(function (k) { shown.style[k] = ''; });
    }

    /* Sheet canvas (captured shots + empty slots) with the live video laid over the next empty slot */
    function renderProgressivePreview() {
        var sp = spec(), n = sp.cols * sp.rows;
        if (n < 2) return;

        var L = layout(sp);
        var paper = PAPERS[sel.paper];
        var ink = paper.dark ? '#ffe3ee' : '#9c1f58';
        var bid = sel.border;
        var active = frames.length;                         // next empty slot; equals n when the sheet is full

        if (!stripPreview) {
            stripPreview = document.createElement('canvas');
            stripPreview.className = 'pn-cam__strip-preview';
        }
        stripPreview.width = L.W;
        stripPreview.height = L.H;
        var ctx = stripPreview.getContext('2d');

        ctx.fillStyle = paper.c;
        ctx.fillRect(0, 0, L.W, L.H);

        L.rects.forEach(function (r, i) {
            borderBefore(ctx, bid, r, paper);

            if (frames[i]) {
                var fr = frames[i];
                var fw = fr.width, fh = fr.height;
                var cw = Math.min(fw, fh * sp.ar), ch = cw / sp.ar;

                var t = document.createElement('canvas');
                t.width = r.w;
                t.height = r.h;
                var tctx = t.getContext('2d');
                tctx.translate(r.w, 0);
                tctx.scale(-1, 1);
                tctx.drawImage(fr, (fw - cw) / 2, (fh - ch) / 2, cw, ch, 0, 0, r.w, r.h);
                tctx.setTransform(1, 0, 0, 1, 0, 0);
                applyFilter(tctx, 0, 0, r.w, r.h, curFilter());

                ctx.save();
                if (bid === 'rounded') { rrect(ctx, r.x, r.y, r.w, r.h, 30); ctx.clip(); }
                ctx.drawImage(t, r.x, r.y);
                ctx.restore();
            } else {
                ctx.save();
                ctx.fillStyle = paper.dark ? '#2b1020' : '#f0e6ec';
                ctx.globalAlpha = 0.3;
                if (bid === 'rounded') { rrect(ctx, r.x, r.y, r.w, r.h, 30); ctx.fill(); }
                else { ctx.fillRect(r.x, r.y, r.w, r.h); }
                ctx.globalAlpha = 1;
                if (i === active) {                         // the live feed covers this slot; outline it as a fallback
                    ctx.strokeStyle = ink;
                    ctx.lineWidth = 4;
                    ctx.strokeRect(r.x, r.y, r.w, r.h);
                } else {
                    ctx.fillStyle = ink;
                    ctx.font = '700 ' + Math.round(r.h * 0.15) + 'px "Segoe UI Symbol", "Segoe UI", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('\uD83D\uDCF8', r.x + r.w / 2, r.y + r.h / 2);
                }
                ctx.restore();
            }

            borderAfter(ctx, bid, r, i, ink, paper);
        });

        if (sel.date) {
            ctx.fillStyle = ink;
            ctx.font = '700 ' + Math.round(L.footer * 0.42) + 'px "Caveat", "Segoe Script", "Brush Script MT", cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\u2665 ' + todayStr() + ' \u2665', L.W / 2, L.footerY);
        }

        shown.width = stripPreview.width;
        shown.height = stripPreview.height;
        shown.getContext('2d').drawImage(stripPreview, 0, 0);
        fitView(L.W / L.H);

        shown.style.position = 'absolute';
        shown.style.left = '0';
        shown.style.top = '0';
        shown.style.width = '100%';
        shown.style.height = '100%';
        shown.hidden = false;

        if (active < n) {
            var a = L.rects[active];
            video.style.position = 'absolute';
            video.style.left = (a.x / L.W * 100) + '%';
            video.style.top = (a.y / L.H * 100) + '%';
            video.style.width = (a.w / L.W * 100) + '%';
            video.style.height = (a.h / L.H * 100) + '%';
            video.style.objectFit = 'cover';
            video.style.transform = 'scaleX(-1)';
            video.style.borderRadius = bid === 'rounded' ? (30 / a.w * 100) + '% / ' + (30 / a.h * 100) + '%' : '';
            video.hidden = false;
        } else {
            video.hidden = true;                            // every slot filled, waiting for review
        }
    }



    function refreshUI() {
        FORMATS.forEach(function (f) { fmtBtns[f.id].setAttribute('aria-pressed', String(sel.format === f.id)); });
        Object.keys(shapeBtns).forEach(function (k) { shapeBtns[k].setAttribute('aria-pressed', String(sel.shape === k)); });
        FILTERS.forEach(function (f) { filterBtns[f.id].setAttribute('aria-pressed', String(sel.filter === f.id)); });
        paperBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(sel.paper === i)); });
        BORDERS.forEach(function (b) { borderBtns[b.id].setAttribute('aria-pressed', String(sel.border === b.id)); });
        customBox.hidden = sel.format !== 'custom';
        colsVal.textContent = sel.cols;
        rowsVal.textContent = sel.rows;
        var sp = spec(), n = sp.cols * sp.rows;
        shotsNote.textContent = n + (n === 1 ? ' photo' : ' photos') + ' per sheet';
    }

    function fitView(ar) {
        var vw = Math.min(380, 480 * ar);
        view.style.width = 'min(' + vw.toFixed(0) + 'px, calc(100% - 12px))';
        view.style.aspectRatio = String(ar);
    }

    function setMode(m) {
        mode = m;
        var inReview = m === 'review' || m === 'saving';

        reviewBox.hidden = m !== 'review';
        shotBtn.hidden = inReview;
        shotBtn.disabled = m !== 'live' || !stream;
        retakeBtn.hidden = pinBtn.hidden = dlBtn.hidden = !inReview;
        retakeBtn.disabled = pinBtn.disabled = dlBtn.disabled = m === 'saving';
        lockables.forEach(function (b) { b.disabled = m !== 'live'; });

        if (inReview) {
            resetSlotStyles();
            video.hidden = true;
            shown.hidden = false;
        } else if (slotActive()) {
            renderProgressivePreview();
        } else {
            resetSlotStyles();
            video.hidden = false;
            shown.hidden = true;
            fitView(spec().ar);
        }
    }

    function compose() {
        var sp = spec(), L = layout(sp), f = curFilter(), paper = PAPERS[sel.paper], bid = sel.border;
        var ink = paper.dark ? '#ffe3ee' : '#9c1f58';
        var c = document.createElement('canvas');
        c.width = L.W;
        c.height = L.H;
        var ctx = c.getContext('2d');
        ctx.fillStyle = paper.c;
        ctx.fillRect(0, 0, L.W, L.H);
        L.rects.forEach(function (r, i) {
            var fr = frames[i];
            if (!fr) return;
            var fw = fr.width, fh = fr.height;
            var cw = Math.min(fw, fh * sp.ar), ch = cw / sp.ar;
            borderBefore(ctx, bid, r, paper);
            var t = document.createElement('canvas');       // filter a copy, so clipped corners stay clean
            t.width = r.w;
            t.height = r.h;
            var tctx = t.getContext('2d');
            tctx.translate(r.w, 0);
            tctx.scale(-1, 1);                              // mirrored, like the live preview
            tctx.drawImage(fr, (fw - cw) / 2, (fh - ch) / 2, cw, ch, 0, 0, r.w, r.h);
            tctx.setTransform(1, 0, 0, 1, 0, 0);
            applyFilter(tctx, 0, 0, r.w, r.h, f);
            ctx.save();
            if (bid === 'rounded') { rrect(ctx, r.x, r.y, r.w, r.h, 30); ctx.clip(); }
            ctx.drawImage(t, r.x, r.y);
            ctx.restore();
            borderAfter(ctx, bid, r, i, ink, paper);
        });
        if (sel.date) {
            ctx.fillStyle = ink;
            ctx.font = '700 ' + Math.round(L.footer * 0.42) + 'px "Caveat", "Segoe Script", "Brush Script MT", cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\u2665 ' + todayStr() + ' \u2665', L.W / 2, L.footerY);
        }
        return c;
    }

    function recompose() {
        composed = compose();
        shown.width = composed.width;
        shown.height = composed.height;
        shown.getContext('2d').drawImage(composed, 0, 0);
        fitView(composed.width / composed.height);
    }

    // Track current format to detect changes
    var currentFormatId = null;

    function onChange() {
        video.style.filter = cssFilter(curFilter());
        var sp = spec();

        if (currentFormatId !== null && currentFormatId !== sp.id) {
            frames = [];
            stripPreview = null;
            countEl.classList.remove('is-on');
            countEl.textContent = '';
        }
        currentFormatId = sp.id;

        if (mode === 'review') {
            recompose();
        } else if (slotActive()) {
            renderProgressivePreview();
        } else {
            resetSlotStyles();
            fitView(sp.ar);
            video.hidden = false;
            shown.hidden = true;
        }
    }

    function grab() {
        var c = document.createElement('canvas');
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        return c;
    }

    async function shoot() {
        if (mode !== 'live' || !stream || !video.videoWidth) return;
        var sp = spec(), n = sp.cols * sp.rows, tok = ++seqToken;
        frames = [];
        setSave('');
        setMode('shooting');

        // Show empty preview immediately for multi-photo formats
        var n = sp.cols * sp.rows;
        if (n >= 2) {
            renderProgressivePreview();
        }

        for (var i = 0; i < n; i++) {
            setStatus('Photo ' + (i + 1) + ' of ' + n + ' \u2014 Get ready!');
            for (var s = sel.timer; s > 0; s--) {
                countEl.textContent = String(s);
                countEl.classList.add('is-on');
                await wait(1000);
                if (tok !== seqToken) return;
            }
            countEl.classList.remove('is-on');
            frames.push(grab());
            flash.classList.remove('is-flash');
            void flash.offsetWidth;
            flash.classList.add('is-flash');

            // Update progressive preview after each capture
            var n2 = sp.cols * sp.rows;
            if (n2 >= 2) {
                renderProgressivePreview();
            }

            await wait(i < n - 1 ? 700 : 250);
            if (tok !== seqToken) return;
        }
        setMode('review');
        recompose();
        setStatus('Happy with it? Add a caption, then pin it.');
    }

    function retake() {
        seqToken++;
        frames = [];
        composed = null;
        stripPreview = null;
        countEl.classList.remove('is-on');
        countEl.textContent = '';
        setMode('live');
        setStatus('Smile! Tap capture when you are ready.');
    }

    /* ==================================================================
       Saving: queue photo to IndexedDB for admin approval (shared with admin/index.html)
       ================================================================== */
    function queueDb() {
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(QUEUE_DB, 1);
            req.onupgradeneeded = function () { req.result.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true }); };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    function queuePhoto(dataUrl, caption) {
        return queueDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(QUEUE_STORE, 'readwrite');
                var store = tx.objectStore(QUEUE_STORE);
                var item = { data: dataUrl, caption: caption, ts: Date.now() };
                var rq = store.add(item);
                rq.onsuccess = function () { db.close(); resolve(rq.result); };
                rq.onerror = function () { db.close(); reject(rq.error); };
            });
        });
    }

    async function pin() {
        if (mode !== 'review' || !composed) return;
        var caption = captionInput.value.trim() || todayStr();
        var dataUrl = composed.toDataURL('image/jpeg', 0.92);
        setMode('saving');
        addPhoto(makePhoto(dataUrl, caption));
        setSave('Submitting for review\u2026');
        try {
            await queuePhoto(dataUrl, caption);
            setSave('Submitted for review \u2713 It will appear after admin approval.');
        } catch (e) {
            setSave('Added to the board, but queueing failed: ' + e.message);
        }
        captionInput.value = '';
        frames = [];
        composed = null;
        stripPreview = null;
        setMode('live');
        setStatus('Smile! Tap capture when you are ready.');
    }

    function download() {
        if (!composed) return;
        composed.toBlob(function (b) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = 'pinboard-' + Date.now() + '.jpg';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        }, 'image/jpeg', 0.92);
    }

    /* ==================================================================
       Camera lifecycle
       ================================================================== */
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
                shotBtn.disabled = mode !== 'live';
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
        seqToken++;
        stopStream();
        frames = [];
        composed = null;
        stripPreview = null;
        countEl.classList.remove('is-on');
        setMode('live');
        cam.classList.remove('is-open');
        cam.setAttribute('aria-hidden', 'true');
        addBtn.setAttribute('aria-expanded', 'false');
    }

    addBtn.addEventListener('click', function () {
        if (cam.classList.contains('is-open')) closeCam(); else openCam();
    });
    shotBtn.addEventListener('click', shoot);
    retakeBtn.addEventListener('click', retake);
    pinBtn.addEventListener('click', pin);
    dlBtn.addEventListener('click', download);
    closeBtn.addEventListener('click', closeCam);
    cam.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCam(); });
    window.addEventListener('pagehide', stopStream);

    /* ---- Init ---- */
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stage);
    window.addEventListener('resize', measure);
    refreshUI();
    setMode('live');
    onChange();
    rebuild();
})();
