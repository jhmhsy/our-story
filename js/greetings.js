/* greetings.js - Section 1 (#greetings): typewriter greeting (left) + rotating 3D ASCII bouquet
   with falling ASCII stars (right). Text and timings come from SITE_CONTENT.greetings
   (data/content.json, edited in /admin). */
(function () {
    'use strict';
    var section = document.getElementById('greetings');
    if (!section || section.getAttribute('data-built')) return;
    section.setAttribute('data-built', '1');

    var cfg = (window.SITE_CONTENT && window.SITE_CONTENT.greetings) || {};
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function num(v, min, max) {
        var n = Number(v);
        if (!isFinite(n)) n = min;
        return clamp(n, min, max);
    }

    /* ---- Settings (all from the admin) ---- */
    var typingSpeed = num(cfg.typingSpeed, 10, 2000);      // ms per character
    var startDelay = num(cfg.startDelay, 0, 30000);        // ms before typing starts
    var holdDelay = num(cfg.holdDelay, 0, 30000);          // ms before deleting / restarting
    var deleteSpeed = Math.max(12, Math.round(typingSpeed * 0.5));
    var messages = (cfg.messages || []).map(function (m) {
        return typeof m === 'string' ? m : (m && m.text) || '';
    }).filter(function (t) { return t.trim(); });

    /* ---- DOM ---- */
    var left = el('div', 'gr-text-col');
    var block = el('div', 'gr-block');
    var msg = el('p', 'gr-msg');
    var ghost = el('span', 'gr-ghost');                    // invisible longest message: keeps the block height stable
    ghost.setAttribute('aria-hidden', 'true');
    var wrap = el('span', 'gr-typed-wrap');
    var typed = el('span', 'gr-typed');
    var cursor = el('span', 'gr-cursor');
    cursor.setAttribute('aria-hidden', 'true');
    wrap.appendChild(typed);
    wrap.appendChild(cursor);
    msg.appendChild(ghost);
    msg.appendChild(wrap);
    block.appendChild(msg);
    if (cfg.subtitle && String(cfg.subtitle).trim()) block.appendChild(el('p', 'gr-sub', cfg.subtitle));
    left.appendChild(block);

    var art = el('div', 'gr-art');
    var stage = el('div', 'gr-stage');
    var canvas = el('canvas', 'gr-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);
    art.appendChild(stage);
    section.appendChild(left);
    section.appendChild(art);

    var ctx = canvas.getContext('2d');

    /* ================= Typewriter ================= */
    var seg = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    function split(t) {
        return seg ? Array.from(seg.segment(t), function (s) { return s.segment; }) : Array.from(t);
    }
    var segs = messages.map(split);
    var idx = 0, n = 0, phase = 'wait', timer = 0;

    if (messages.length) {
        ghost.textContent = messages.reduce(function (a, b) { return b.length > a.length ? b : a; }, '');
    }

    function drawText() { typed.textContent = segs[idx].slice(0, n).join(''); }
    function later(ms) { timer = setTimeout(step, ms); }
    function step() {
        timer = 0;
        var s = segs[idx];
        if (phase === 'wait') { phase = 'type'; later(startDelay); return; }
        if (phase === 'type') {
            if (n < s.length) { n++; drawText(); later(typingSpeed); return; }
            phase = 'delete';
            later(holdDelay);
            return;
        }
        if (n > 0) { n--; drawText(); later(deleteSpeed); return; }
        idx = (idx + 1) % segs.length;
        phase = 'type';
        later(350);
    }
    function typerStart() { if (!timer && segs.length && !reduce) later(0); }
    function typerStop() { clearTimeout(timer); timer = 0; }

    if (reduce) {
        typed.textContent = messages[0] || '';
        cursor.style.display = 'none';
    }

    /* ================= 3D ASCII bouquet ================= */
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    var rand = mulberry32(20230214);                       // fixed seed: same bouquet every visit

    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function norm(a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

    /* families: 0 rose, 1 red, 2 cream, 3 lilac, 4 leaf, 5 stem, 6 ribbon, 7 baby's breath */
    var PAL = [[338, 88, 26, 74], [352, 86, 22, 62], [38, 70, 38, 94], [285, 62, 34, 82],
               [138, 52, 16, 52], [125, 42, 18, 48], [44, 86, 34, 76], [0, 0, 42, 100]];
    var RAMPS = ['.:-=+*#%@', '.:-=+*#%@', '.:-=+*#%@', '.:-=+*#%@', ',:;il!I|', '|!:l', '=#H%', '.*+*'];
    var COLORS = [];
    PAL.forEach(function (p) {
        for (var lv = 0; lv < 16; lv++) {
            COLORS.push('hsl(' + p[0] + ',' + p[1] + '%,' + (p[2] + (p[3] - p[2]) * lv / 15).toFixed(1) + '%)');
        }
    });

    var X = [], Y = [], Z = [], NX = [], NY = [], NZ = [], F = [];
    function add(x, y, z, nx, ny, nz, fam) {
        var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        X.push(x); Y.push(y); Z.push(z); NX.push(nx / l); NY.push(ny / l); NZ.push(nz / l); F.push(fam);
    }

    function bloom(c, nrm, R, fam) {
        var up = Math.abs(nrm[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        var u = norm(cross(up, nrm)), v = cross(nrm, u);
        var L = 6;
        for (var l = 0; l < L; l++) {
            var t = l / (L - 1), rad = R * (0.1 + 0.9 * t), cnt = 8 + l * 8;
            var h = R * (0.5 * (1 - t * t) - 0.2 * t);
            for (var i = 0; i < cnt; i++) {
                var th = i / cnt * 6.2832 + l * 0.7 + (rand() - 0.5) * 0.2;
                var r = rad * (1 + 0.16 * Math.cos(5 * th + l * 1.3));
                var cs = Math.cos(th), sn = Math.sin(th);
                var dx = u[0] * cs + v[0] * sn, dy = u[1] * cs + v[1] * sn, dz = u[2] * cs + v[2] * sn;
                var k = 0.9 * t;
                add(c[0] + dx * r + nrm[0] * h, c[1] + dy * r + nrm[1] * h, c[2] + dz * r + nrm[2] * h,
                    nrm[0] + dx * k, nrm[1] + dy * k, nrm[2] + dz * k, fam);
            }
        }
    }

    (function buildBouquet() {
        var H = [0, 0.5, 0], rho = 0.78, rad = Math.PI / 180;
        var blooms = [{ e: 90, a: 0, R: 0.34, f: 1 }];
        var ring1 = [0, 2, 0, 3, 2], ring2 = [3, 0, 1, 0, 2], i;
        for (i = 0; i < 5; i++) blooms.push({ e: 52, a: i * 72 + 15, R: 0.3, f: ring1[i] });
        for (i = 0; i < 5; i++) blooms.push({ e: 16, a: i * 72 + 51, R: 0.28, f: ring2[i] });

        /* leaves (drawn first in the arrays; z-buffer decides what is in front) */
        for (i = 0; i < 8; i++) {
            var a = (i * 45 + 20) * rad;
            var d = norm([Math.cos(a), i % 2 ? 0.5 : -0.2, Math.sin(a)]);
            var base = [H[0] + Math.cos(a) * 0.5, H[1] - 0.12, H[2] + Math.sin(a) * 0.5];
            var side = norm(cross(d, [0, 1, 0]));
            var ln = norm(cross(side, d));
            var LL = 0.8, W = 0.2;
            for (var ti = 0; ti <= 20; ti++) {
                var t = ti / 20, w = Math.sin(Math.PI * Math.pow(t, 0.7)) * W;
                for (var si = -3; si <= 3; si++) {
                    var s = si / 3 + (rand() - 0.5) * 0.1;
                    add(base[0] + d[0] * t * LL + side[0] * s * w,
                        base[1] + d[1] * t * LL + side[1] * s * w - t * t * 0.18,
                        base[2] + d[2] * t * LL + side[2] * s * w,
                        ln[0], ln[1], ln[2], 4);
                }
            }
        }

        /* stems + bundle */
        for (i = 0; i < blooms.length; i++) {
            var b = blooms[i], e = b.e * rad, an = b.a * rad;
            var dir = [Math.cos(e) * Math.cos(an), Math.sin(e), Math.cos(e) * Math.sin(an)];
            var c = [H[0] + dir[0] * rho, H[1] + dir[1] * rho, H[2] + dir[2] * rho];
            var nrm = norm([dir[0], dir[1] + 0.3, dir[2]]);
            bloom(c, nrm, b.R, b.f);

            var ang = i / blooms.length * 6.2832;
            var ca = Math.cos(ang), sa = Math.sin(ang);
            var end = [ca * 0.11, -0.85, sa * 0.11], ctrl = [c[0] * 0.35, -0.25, c[2] * 0.35];
            for (var k = 0; k <= 55; k++) {
                var u2 = k / 55, m = 1 - u2;
                add(m * m * c[0] + 2 * m * u2 * ctrl[0] + u2 * u2 * end[0],
                    m * m * c[1] + 2 * m * u2 * ctrl[1] + u2 * u2 * end[1],
                    m * m * c[2] + 2 * m * u2 * ctrl[2] + u2 * u2 * end[2], ca, 0, sa, 5);
            }
            for (k = 1; k <= 10; k++) {
                var q = k / 10;
                add(end[0] + (ca * 0.07 - end[0]) * q, end[1] + (-1.5 - end[1]) * q, end[2] + (sa * 0.07 - end[2]) * q, ca, 0, sa, 5);
            }
        }

        /* baby's breath */
        for (i = 0; i < 14; i++) {
            var fe = (-10 + rand() * 80) * rad, fa = rand() * 6.2832, fr = 0.95 + rand() * 0.15;
            var fc = [H[0] + Math.cos(fe) * Math.cos(fa) * fr, H[1] + Math.sin(fe) * fr, H[2] + Math.cos(fe) * Math.sin(fa) * fr];
            for (var j = 0; j < 10; j++) {
                var o = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
                add(fc[0] + o[0] * 0.14, fc[1] + o[1] * 0.14, fc[2] + o[2] * 0.14, o[0], o[1], o[2] + 0.4, 7);
            }
        }

        /* ribbon band */
        for (var row = 0; row < 5; row++) {
            for (var q2 = 0; q2 < 40; q2++) {
                var ra = q2 / 40 * 6.2832;
                add(Math.cos(ra) * 0.15, -0.9 - row * 0.045, Math.sin(ra) * 0.15, Math.cos(ra), 0, Math.sin(ra), 6);
            }
        }
        /* bow loops + tails */
        for (var sd = -1; sd <= 1; sd += 2) {
            for (var rr = 0; rr < 2; rr++) {
                var rs = rr ? 1 : 0.7;
                for (var p = 0; p < 22; p++) {
                    var pa = p / 22 * 6.2832;
                    add(sd * 0.17 + Math.cos(pa) * 0.15 * rs, -0.97 + Math.sin(pa) * 0.09 * rs, 0.17, 0, 0, 1, 6);
                }
            }
            for (var tt = 0; tt <= 14; tt++) {
                var tq = tt / 14;
                add(sd * (0.03 + 0.17 * tq), -1.0 - 0.38 * tq, 0.17 + 0.01 * tq, 0, 0, 1, 6);
                add(sd * (0.03 + 0.17 * tq) + 0.014, -1.0 - 0.38 * tq, 0.17 + 0.01 * tq, 0, 0, 1, 6);
            }
        }
    })();

    var N = X.length;
    var D = 5;                                              // camera distance (perspective)
    var LX = -0.35, LY = 0.55, LZ = 0.8;
    (function () { var l = Math.sqrt(LX * LX + LY * LY + LZ * LZ); LX /= l; LY /= l; LZ /= l; })();

    var W = 0, H = 0, dpr = 1, fs = 12, cw = 7.4, chh = 12.7, cols = 0, rows = 0;
    var zbuf, cellCh, cellCol, occ, order;
    var colCount = new Int32Array(PAL.length * 16);
    var ang = 0.6, time = 0, SPIN = 0.55;

    function drawBouquet() {
        var S = Math.min(H * 0.27, W * 0.30), cx = W / 2, cy = H / 2;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var tilt = 0.22 + 0.04 * Math.sin(time * 0.7), tc = Math.cos(tilt), ts = Math.sin(tilt);
        zbuf.fill(-1e9);
        var occN = 0, i;
        for (i = 0; i < N; i++) {
            var x = X[i] * ca + Z[i] * sa, z = -X[i] * sa + Z[i] * ca, y = Y[i];
            var y2 = y * tc - z * ts, z2 = y * ts + z * tc;
            var f = D / (D - z2);
            var col = ((cx + x * f * S) / cw) | 0, row = ((cy - y2 * f * S) / chh) | 0;
            if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
            var id = row * cols + col;
            if (z2 <= zbuf[id]) continue;
            var nx = NX[i] * ca + NZ[i] * sa, nz0 = -NX[i] * sa + NZ[i] * ca;
            var ny2 = NY[i] * tc - nz0 * ts, nz2 = NY[i] * ts + nz0 * tc;
            var dif = nx * LX + ny2 * LY + nz2 * LZ, fam = F[i];
            if (fam === 4) dif = Math.abs(dif); else if (dif < 0) dif = 0;
            var b = (0.2 + 0.8 * dif) * (0.6 + 0.4 * (z2 + 1.6) / 3.2);
            var lv = clamp(Math.round(b * 15), 0, 15);
            var ramp = RAMPS[fam];
            if (zbuf[id] === -1e9) occ[occN++] = id;
            zbuf[id] = z2;
            cellCh[id] = ramp.charAt(Math.min(ramp.length - 1, (lv / 15 * ramp.length) | 0));
            cellCol[id] = fam * 16 + lv;
        }
        /* counting sort by colour: few fillStyle changes */
        colCount.fill(0);
        var k, sum = 0, c;
        for (k = 0; k < occN; k++) colCount[cellCol[occ[k]]]++;
        for (c = 0; c < colCount.length; c++) { var tmp = colCount[c]; colCount[c] = sum; sum += tmp; }
        for (k = 0; k < occN; k++) { var oi = occ[k]; order[colCount[cellCol[oi]]++] = oi; }

        ctx.font = fs + 'px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        var last = -1;
        for (k = 0; k < occN; k++) {
            var o = order[k], cc = cellCol[o];
            if (cc !== last) { ctx.fillStyle = COLORS[cc]; last = cc; }
            var r2 = (o / cols) | 0;
            ctx.fillText(cellCh[o], (o - r2 * cols) * cw, r2 * chh + chh * 0.5);
        }
    }

    /* ================= ASCII stars ================= */
    var STAR_CH = ['*', '.', '+', '\u2726'], STAR_COL = ['#ffffff', '#ffd6e6', '#ffe9a8'], STAR_SIZE = [8, 10, 13, 17];
    var stars = [];
    function initStars() {
        var count = clamp(Math.round(W * H / 9000), 24, 90);
        stars = [];
        for (var i = 0; i < count; i++) {
            var ch = STAR_CH[Math.floor(Math.random() * STAR_CH.length)];
            stars.push({
                x: Math.random() * W, y: Math.random() * H, vy: 10 + Math.random() * 38,
                amp: 4 + Math.random() * 14, fr: 0.3 + Math.random() * 0.9, ph: Math.random() * 6.28,
                tw: 0.8 + Math.random() * 2.2, tp: Math.random() * 6.28, a: 0.25 + Math.random() * 0.65,
                ch: ch, size: STAR_SIZE[Math.floor(Math.random() * STAR_SIZE.length)],
                col: STAR_COL[Math.floor(Math.random() * STAR_COL.length)],
                glow: Math.random() < 0.18 && ch !== '.'
            });
        }
        stars.sort(function (a, b) { return a.size - b.size; });
    }
    function drawStars(dt) {
        var pass, i, s, curSize = 0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (pass = 0; pass < 2; pass++) {
            ctx.shadowBlur = pass ? 9 : 0;
            for (i = 0; i < stars.length; i++) {
                s = stars[i];
                if (pass === 0 && dt > 0) {
                    s.y += s.vy * dt;
                    if (s.y > H + 20) { s.y = -20; s.x = Math.random() * W; }
                }
                if (s.glow !== (pass === 1)) continue;
                if (s.size !== curSize) { ctx.font = s.size + 'px monospace'; curSize = s.size; }
                ctx.globalAlpha = s.a * (0.65 + 0.35 * Math.sin(time * s.tw + s.tp));
                ctx.fillStyle = s.col;
                if (pass) ctx.shadowColor = s.col;
                ctx.fillText(s.ch, s.x + Math.sin(time * s.fr + s.ph) * s.amp, s.y);
            }
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    /* ================= Render loop ================= */
    function render(dt) {
        ctx.clearRect(0, 0, W, H);
        drawStars(dt);
        drawBouquet();
    }

    function resize() {
        var w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;                               // still behind the password gate
        W = w; H = h;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        fs = clamp(Math.round(Math.min(H / 52, W / 56)), 8, 15);
        cw = fs * 0.62;
        chh = fs * 1.06;
        cols = Math.max(1, Math.floor(W / cw));
        rows = Math.max(1, Math.floor(H / chh));
        var cells = cols * rows;
        zbuf = new Float32Array(cells);
        cellCh = new Array(cells);
        cellCol = new Uint8Array(cells);
        occ = new Int32Array(cells);
        order = new Int32Array(cells);
        initStars();
        if (!running) render(0);
    }

    var raf = 0, last = 0, running = false;
    function frame(now) {
        if (!running) return;
        raf = requestAnimationFrame(frame);
        if (now - last < 24) return;                        // ~40 fps cap
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;
        ang += dt * SPIN;
        render(dt);
    }
    function loopStart() {
        if (running || !W) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }
    function loopStop() { running = false; cancelAnimationFrame(raf); }

    /* ---- Run only while the section is on screen and the tab is visible ---- */
    var vis = false;
    function sync() {
        if (vis && !document.hidden) { typerStart(); if (!reduce) loopStart(); }
        else { typerStop(); loopStop(); }
    }
    if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); sync(); }).observe(stage);
    else window.addEventListener('resize', function () { resize(); sync(); });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) { vis = entries[0].isIntersecting; sync(); }, { threshold: 0.1 }).observe(section);
    } else { vis = true; }
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', function () { typerStop(); loopStop(); });
    resize();
    sync();
})();