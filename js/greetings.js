/* greetings.js - Section 1 (#greetings): typewriter greeting (left) + rotating 3D ASCII bouquet
   with falling ASCII stars (right). Text and timings come from SITE_CONTENT.greetings
   (data/content.json, edited in /admin).

   Bouquet rendering: ~15k precomputed 3D points (typed arrays) are projected into a character grid
   with a z-buffer. Lighting is computed in object space (the light is rotated once per frame instead of
   every normal) and every glyph is drawn from a lazily baked sprite atlas, so a frame is only
   drawImage calls: no per-frame fillText or fillStyle changes for the bouquet. */
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
    var TAU = 6.2832;

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

    /* Colour families (each has 16 brightness levels and its own character ramp, dim -> dense):
       0 red, 1 pink, 2 cream, 3 lilac, 4 leaf, 5 stem, 6 ribbon, 7 baby's breath,
       8 sunflower petal, 9 seed disc, 10 orange, 11 yellow, 12 stamen, 13 fern, 14 coral */
    var PAL = [
        [352, 86, 20, 62], [336, 80, 34, 80], [38, 70, 38, 95], [285, 60, 34, 84],
        [138, 52, 16, 52], [125, 42, 18, 48], [44, 86, 34, 76], [0, 0, 42, 100],
        [46, 96, 38, 70], [28, 70, 10, 40], [18, 92, 38, 68], [52, 92, 40, 78],
        [8, 90, 40, 82], [95, 45, 20, 62], [14, 90, 42, 76]
    ];
    var RAMPS = [
        '.:+*#%&@', '.:;+*&%#@$', '.:-=+*#%@', '.:;il!|I%',
        ',:;il!I|', '|!:l', '=#H%', '.*+o',
        '.:=+*#%@', '.:+x%#&@8', '.:+*#%@', '.:;+=*#%',
        '.:*oO0@', '\'`:;<>/', '.:+*#%&@'
    ];
    var TWO = new Uint8Array(PAL.length);                  // two-sided (thin) surfaces: lit from both faces
    TWO[4] = 1; TWO[8] = 1; TWO[13] = 1;
    var NFAM = PAL.length, GLYPHS = 10;
    var RLEN = new Uint8Array(NFAM);
    var COLORS = [];
    PAL.forEach(function (p, fi) {
        RLEN[fi] = RAMPS[fi].length;
        for (var lv = 0; lv < 16; lv++) {
            COLORS.push('hsl(' + p[0] + ',' + p[1] + '%,' + (p[2] + (p[3] - p[2]) * lv / 15).toFixed(1) + '%)');
        }
    });

    /* ---- Point cloud builders (run once) ---- */
    var Xa = [], Ya = [], Za = [], NXa = [], NYa = [], NZa = [], Fa = [], Ta = [];
    function add(x, y, z, nx, ny, nz, fam, tex) {
        var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        Xa.push(x); Ya.push(y); Za.push(z);
        NXa.push(nx / l); NYa.push(ny / l); NZa.push(nz / l);
        Fa.push(fam); Ta.push(tex || 0);                   // tex: brightness offset (veins, ruffles, spots)
    }

    /* Local frame of the flower being built: centre fc, axes fu / fv, facing direction fn */
    var fc = [0, 0, 0], fu = [1, 0, 0], fv = [0, 1, 0], fn = [0, 0, 1];
    function setFrame(c, nrm, roll) {
        var up = Math.abs(nrm[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        var u = norm(cross(up, nrm)), v = cross(nrm, u);
        var cr = Math.cos(roll), sr = Math.sin(roll);
        fu = [u[0] * cr + v[0] * sr, u[1] * cr + v[1] * sr, u[2] * cr + v[2] * sr];
        fv = [-u[0] * sr + v[0] * cr, -u[1] * sr + v[1] * cr, -u[2] * sr + v[2] * cr];
        fn = nrm; fc = c;
    }
    function L(lx, ly, lz, nx, ny, nz, fam, tex) {         // point in the local frame
        add(fc[0] + fu[0] * lx + fv[0] * ly + fn[0] * lz,
            fc[1] + fu[1] * lx + fv[1] * ly + fn[1] * lz,
            fc[2] + fu[2] * lx + fv[2] * ly + fn[2] * lz,
            fu[0] * nx + fv[0] * ny + fn[0] * nz,
            fu[1] * nx + fv[1] * ny + fn[1] * nz,
            fu[2] * nx + fv[2] * ny + fn[2] * nz, fam, tex);
    }
    function P(r, th, h, tilt, fam, tex) {                 // polar point: radius, angle, height, outward normal tilt
        var c = Math.cos(th), s = Math.sin(th);
        L(r * c, r * s, h, c * tilt, s * tilt, 1, fam, tex);
    }

    /* ROSE: tight golden-angle spiral heart + seven scalloped, flaring petal rings with thickness */
    function rose(R, fam, rim) {
        var k, i, l, t, th, r, h, cnt, rad, f, sc;
        for (k = 0; k < 40; k++) {
            t = k / 39; th = k * 2.4;
            P(R * (0.05 + 0.28 * Math.sqrt(t)), th, R * (0.7 - 0.15 * t), 0.25 + 0.6 * t, fam, k % 5 === 0 ? 0.12 : -0.04);
        }
        for (l = 0; l < 7; l++) {
            t = l / 6; rad = R * (0.3 + 0.7 * t); cnt = 12 + l * 6; f = l >= 5 ? rim : fam;
            for (i = 0; i < cnt; i++) {
                th = i / cnt * TAU + l * 0.9 + (rand() - 0.5) * 0.15;
                sc = 1 + 0.13 * Math.cos(3 * th + l * 2);
                r = rad * sc;
                h = R * (0.52 - 0.62 * t * t) + R * 0.03 * Math.cos(6 * th);
                P(r, th, h, 0.3 + 1.2 * t, f, l === 6 ? 0.14 : (i % 4 === 0 ? 0.06 : 0));
                if (l >= 1 && l <= 5) P(r * 0.8, th + 0.1, h + R * 0.07, 0.3 + 0.9 * t, f, -0.08);
            }
        }
    }

    /* TULIP: closed cup made of six pointed petals (3 outer, 3 inner) with a lit centre ridge */
    function tulip(R, fam, tip) {
        var p, j, s, a, inner, sz, t, rr, z, hw, nz, sf, ang, cs, sn, rad;
        for (p = 0; p < 6; p++) {
            a = p * 1.0472 + (p % 2 ? 0.1 : 0); inner = p % 2; sz = inner ? 0.9 : 1;
            for (j = 1; j <= 9; j++) {
                t = j / 9;
                rr = R * sz * (0.3 + 0.5 * Math.sin(Math.PI * Math.pow(t, 0.85)));
                z = R * 1.25 * t * sz;
                hw = (inner ? 0.5 : 0.62) * Math.sin(Math.PI * Math.pow(t, 0.6));
                nz = -Math.cos(Math.PI * Math.pow(t, 0.85));
                for (s = -2; s <= 2; s++) {
                    sf = s / 2; ang = a + sf * hw; cs = Math.cos(ang); sn = Math.sin(ang);
                    rad = rr * (inner ? 0.9 : 1) * (1 - 0.12 * sf * sf);
                    L(rad * cs, rad * sn, z, 1.1 * cs - 0.7 * sf * sn, 1.1 * sn + 0.7 * sf * cs, nz,
                        t > 0.8 ? tip : fam, sf === 0 ? 0.1 : -0.04);
                }
            }
        }
    }

    /* LILY: six wide recurved petals with frilled edges and dark speckles, long stamens with anthers, a pistil */
    function lily(R, fam, anth) {
        var p, j, s, a, ca, sa, inner, len, t, r, z, w, sf, lat, zz, nr, nl, tex, i, k, b, cb, sb, tx, ty, tz;
        for (p = 0; p < 6; p++) {
            a = p * 1.0472; ca = Math.cos(a); sa = Math.sin(a);
            inner = p % 2; len = inner ? 0.9 : 1;
            for (j = 1; j <= 11; j++) {
                t = j / 11;
                r = R * 1.15 * t * len;
                z = R * (0.8 * t - 1.1 * t * t) * len;
                w = R * 0.3 * Math.sin(Math.PI * Math.pow(t, 0.65)) * (inner ? 1.2 : 0.85);
                nr = (2.2 * t - 0.8) / 1.15;
                for (s = -2; s <= 2; s++) {
                    sf = s / 2; lat = sf * w;
                    zz = z + R * 0.05 * Math.sin(t * 16 + p) * sf * sf;
                    nl = sf * 0.9;
                    tex = (t > 0.15 && t < 0.75 && rand() < 0.13) ? -0.32 : (s === 0 ? 0.12 : 0);
                    L(r * ca - lat * sa, r * sa + lat * ca, zz, nr * ca - nl * sa, nr * sa + nl * ca, 1, fam, tex);
                }
            }
        }
        for (i = 0; i < 6; i++) {                           // stamens
            b = i * 1.0472 + 0.5236; cb = Math.cos(b); sb = Math.sin(b);
            for (k = 0; k <= 7; k++) {
                t = k / 7;
                L(R * 0.5 * Math.pow(t, 1.2) * cb, R * 0.5 * Math.pow(t, 1.2) * sb, R * (0.25 + 0.65 * t), cb * 0.5, sb * 0.5, 0.8, 5, 0);
            }
            tx = R * 0.5 * cb; ty = R * 0.5 * sb; tz = R * 0.9;
            for (k = 0; k < 4; k++) L(tx + (rand() - 0.5) * R * 0.1, ty + (rand() - 0.5) * R * 0.1, tz + (rand() - 0.5) * R * 0.08, cb, sb, 1, anth, 0.2);
        }
        for (k = 0; k <= 9; k++) L(0, 0, R * (0.15 + 0.9 * k / 9), 0, 0, 1, 5, 0);   // pistil
        for (k = 0; k < 3; k++) L((rand() - 0.5) * R * 0.08, (rand() - 0.5) * R * 0.08, R * 1.1, 0, 0, 1, anth, 0.25);
    }

    /* PEONY: heavy, ruffled, domed layers (angular ruffle noise) with a golden stamen heart */
    function peony(R, fam, ctr) {
        var l, i, th, t, r, h, cnt, rf, tx, Lr = 8;
        for (l = 0; l < Lr; l++) {
            t = l / (Lr - 1); cnt = 9 + l * 8;
            for (i = 0; i < cnt; i++) {
                th = i / cnt * TAU + l * 1.3 + (rand() - 0.5) * 0.18;
                rf = 1 + 0.2 * Math.cos(5 * th + l * 1.7) + 0.08 * Math.cos(11 * th);
                r = R * (0.12 + 0.88 * t) * rf;
                h = R * (0.66 * Math.pow(1 - t, 0.9) - 0.12 * t) + R * 0.07 * Math.cos(7 * th + l);
                tx = 0.12 * Math.cos(5 * th + l * 1.7);
                P(r, th, h, 0.2 + 1.1 * t, fam, tx);
                if (l >= 4) P(r * 0.82, th + 0.12, h + R * 0.08, 0.2 + 0.9 * t, fam, -0.1 + tx * 0.5);
            }
        }
        for (i = 0; i < 14; i++) P(R * 0.12 * Math.sqrt(i / 13), i * 2.4, R * 0.72, 0.3, ctr, 0.2);
    }

    /* CHRYSANTHEMUM: pom of thin curved strands radiating from a dome, bright tips */
    function mum(R, fam, tip) {
        var l, i, k, th, u, Lr = 5, cnt;
        for (l = 0; l < Lr; l++) {
            cnt = 8 + l * 6;
            for (i = 0; i < cnt; i++) {
                th = i / cnt * TAU + l * 0.5 + (rand() - 0.5) * 0.2;
                for (k = 0; k < 3; k++) {
                    u = (l + k * 0.5) / Lr;
                    P(R * (0.08 + 0.92 * u), th, R * (0.78 * (1 - u * u) - 0.1 * u), 0.4 + 1.4 * u,
                        k === 2 ? tip : fam, k === 2 ? 0.2 : (k === 0 ? -0.05 : 0));
                }
            }
        }
    }

    /* SPIDER LILY: six thin, wavy, curled petals + long upward-arcing filaments with glowing anthers */
    function spider(R, fam, st) {
        var p, j, s, a, ca, sa, t, r, z, lat0, lat, i, k, b, cb, sb, tx, ty, tz;
        for (p = 0; p < 6; p++) {
            a = p * 1.0472 + 0.3; ca = Math.cos(a); sa = Math.sin(a);
            for (j = 1; j <= 13; j++) {
                t = j / 13; r = R * t;
                z = R * (0.55 * t - 0.95 * t * t);
                lat0 = R * 0.09 * Math.sin(t * 10 + p * 1.7) * t;
                for (s = -1; s <= 1; s++) {
                    lat = lat0 + s * R * 0.05 * (1 - 0.6 * t);
                    L(r * ca - lat * sa, r * sa + lat * ca, z, ca * 0.7, sa * 0.7, 1, fam, s === 0 ? 0.12 : -0.06);
                }
            }
        }
        for (i = 0; i < 9; i++) {
            b = i / 9 * TAU + 0.2; cb = Math.cos(b); sb = Math.sin(b);
            for (k = 0; k <= 13; k++) {
                t = k / 13;
                r = R * (0.1 + 0.75 * t); z = R * (0.25 + 1.3 * t - 0.6 * t * t);
                L(r * cb, r * sb, z, cb * 0.6, sb * 0.6, 0.8, fam, 0.04);
            }
            tx = R * 0.85 * cb; ty = R * 0.85 * sb; tz = R * 0.95;
            for (k = 0; k < 5; k++) L(tx + (rand() - 0.5) * R * 0.1, ty + (rand() - 0.5) * R * 0.1, tz + (rand() - 0.5) * R * 0.1, cb, sb, 1, st, 0.22);
        }
    }

    /* SUNFLOWER: Fermat-spiral seed disc (textured) framed by two rings of pointed rays */
    function sun(R, fPet, fDisc) {
        var k, i, j, s, K = 150, rr, th, q, ring, a, ca, sa, t, r, z, w, lat;
        for (k = 0; k < K; k++) {
            rr = R * 0.44 * Math.sqrt((k + 0.5) / K); th = k * 2.39996; q = rr / (R * 0.44);
            P(rr, th, R * 0.14 * (1 - q * q) + R * 0.02, 0.15 + 0.9 * q, fDisc, k % 3 === 0 ? 0.2 : -0.06);
        }
        for (ring = 0; ring < 2; ring++) {
            for (i = 0; i < 15; i++) {
                a = (i + ring * 0.5) / 15 * TAU; ca = Math.cos(a); sa = Math.sin(a);
                for (j = 0; j < 5; j++) {
                    t = (j + 1) / 5;
                    r = R * (0.42 + 0.6 * t * (ring ? 0.92 : 1));
                    z = R * (0.1 - 0.16 * t - ring * 0.05);
                    w = R * 0.15 * Math.sin(Math.PI * Math.pow(t, 0.6)) * (ring ? 0.9 : 1);
                    for (s = -1; s <= 1; s++) {
                        lat = s * w;
                        L(r * ca - lat * sa, r * sa + lat * ca, z + R * 0.03 * s * s,
                            0.35 * ca - 0.5 * s * sa, 0.35 * sa + 0.5 * s * ca, 1, fPet, s === 0 ? 0.12 : -0.05);
                    }
                }
            }
        }
    }

    /* Small filler flower */
    function daisy(c, nrm, R, fam, ctr) {
        var i, j, s, a, ca, sa, t, w, lat;
        setFrame(c, nrm, rand() * TAU);
        for (i = 0; i < 5; i++) {
            a = i * 1.2566; ca = Math.cos(a); sa = Math.sin(a);
            for (j = 1; j <= 3; j++) {
                t = j / 3; w = R * 0.4 * Math.sin(Math.PI * t * 0.85);
                for (s = -1; s <= 1; s++) {
                    lat = s * w * 0.6;
                    L(R * t * ca - lat * sa, R * t * sa + lat * ca, R * 0.25 * (1 - t), 0.5 * ca, 0.5 * sa, 1, fam, s === 0 ? 0.1 : 0);
                }
            }
        }
        L(0, 0, R * 0.3, 0, 0, 1, ctr, 0.25);
        L(R * 0.1, 0, R * 0.28, 0, 0, 1, ctr, 0.2);
    }

    /* Broad leaf with a lit midrib, drooping tip */
    function leaf(base, d, LL, Wd, droop, fam) {
        var side = norm(cross(d, [0, 1, 0])), ln = norm(cross(side, d)), ti, si, t, w, s;
        for (ti = 1; ti <= 16; ti++) {
            t = ti / 16; w = Math.sin(Math.PI * Math.pow(t, 0.7)) * Wd;
            for (si = -2; si <= 2; si++) {
                s = si / 2;
                add(base[0] + d[0] * t * LL + side[0] * s * w,
                    base[1] + d[1] * t * LL + side[1] * s * w - t * t * droop - Math.abs(s) * w * 0.25,
                    base[2] + d[2] * t * LL + side[2] * s * w,
                    ln[0] + side[0] * s * 0.5, ln[1] + side[1] * s * 0.5, ln[2] + side[2] * s * 0.5,
                    fam, si === 0 ? 0.14 : (ti % 4 === 0 ? 0.08 : -0.04));
            }
        }
    }

    /* Fern frond: arched spine with paired leaflets */
    function fern(p0, d, len) {
        var side = norm(cross(d, [0, 1, 0])), nr = norm(cross(side, d)), k, t, sd, q, lg, px, py, pz;
        for (k = 1; k <= 16; k++) {
            t = k / 16;
            px = p0[0] + d[0] * len * t; py = p0[1] + d[1] * len * t - 0.35 * t * t; pz = p0[2] + d[2] * len * t;
            add(px, py, pz, side[0], side[1], side[2], 5, 0);
            lg = 0.2 * (1 - 0.75 * t);
            for (sd = -1; sd <= 1; sd += 2) {
                for (q = 1; q <= 2; q++) {
                    add(px + side[0] * sd * lg * q / 2 + d[0] * 0.05 * q / 2,
                        py + side[1] * sd * lg * q / 2 + d[1] * 0.05 * q / 2 - 0.03 * q,
                        pz + side[2] * sd * lg * q / 2 + d[2] * 0.05 * q / 2,
                        nr[0], nr[1], nr[2], 13, q === 2 ? 0.1 : 0);
                }
            }
        }
    }

    function stem(s0, idx, count) {
        var ang2 = idx / count * TAU, ca = Math.cos(ang2), sa = Math.sin(ang2), k, u, m, q;
        var end = [ca * 0.1, -0.9, sa * 0.1], ctrl = [s0[0] * 0.45, -0.1, s0[2] * 0.45];
        for (k = 0; k <= 28; k++) {
            u = k / 28; m = 1 - u;
            add(m * m * s0[0] + 2 * m * u * ctrl[0] + u * u * end[0],
                m * m * s0[1] + 2 * m * u * ctrl[1] + u * u * end[1],
                m * m * s0[2] + 2 * m * u * ctrl[2] + u * u * end[2], ca, 0, sa, 5, 0);
        }
        for (k = 1; k <= 8; k++) {
            q = k / 8;
            add(end[0] + (ca * 0.06 - end[0]) * q, end[1] + (-1.45 - end[1]) * q, end[2] + (sa * 0.06 - end[2]) * q, ca, 0, sa, 5, 0);
        }
    }

    (function buildBouquet() {
        var rad = Math.PI / 180, H0 = 0.35, i, j, k;
        var MAKE = { rose: rose, tulip: tulip, lily: lily, peony: peony, mum: mum, spider: spider, sun: sun };
        var BASE = { rose: 0.36, tulip: 0.30, lily: 0.42, peony: 0.42, mum: 0.36, spider: 0.42, sun: 0.48 };
        var SHELL = { rose: 0.94, tulip: 0.86, lily: 1.0, peony: 0.94, mum: 0.94, spider: 1.0, sun: 1.02 };

        /* Dome of blooms: top, then rings of falling elevation. [type, main family, accent family] */
        var rings = [
            { e: 88, a0: 0, sz: 0.85, list: [['mum', 3, 1]] },
            { e: 64, a0: 10, sz: 0.95, list: [['peony', 1, 11], ['tulip', 10, 11], ['rose', 0, 14], ['lily', 2, 12], ['sun', 8, 9]] },
            { e: 40, a0: 20, sz: 1.0, list: [['rose', 2, 1], ['mum', 11, 10], ['spider', 0, 12], ['peony', 14, 2], ['sun', 8, 9], ['tulip', 1, 2], ['lily', 10, 12]] },
            { e: 15, a0: 5, sz: 1.0, list: [['tulip', 14, 1], ['rose', 0, 1], ['peony', 2, 11], ['mum', 3, 2], ['spider', 0, 12], ['lily', 2, 12], ['rose', 1, 2], ['tulip', 11, 10]] },
            { e: -12, a0: 15, sz: 0.85, list: [['spider', 0, 12], ['mum', 3, 1], ['rose', 14, 0], ['lily', 10, 12], ['peony', 1, 2], ['tulip', 0, 14]] }
        ];
        var total = 0;
        rings.forEach(function (r) { total += r.list.length; });

        /* leaves and ferns first: they sit behind and underneath the blooms */
        for (i = 0; i < 9; i++) {                           // collar of broad leaves under the dome
            var la = (i * 40 + 5) * rad, lca = Math.cos(la), lsa = Math.sin(la);
            leaf([lca * 0.3, -0.15, lsa * 0.3], norm([lca, 0.5, lsa]), 1.15, 0.27, 0.35, 4);
        }
        for (i = 0; i < 6; i++) {                           // upper accent leaves between flowers
            var ua = (i * 60 + 35) * rad, uca = Math.cos(ua), usa = Math.sin(ua);
            leaf([uca * 0.2, 0.3, usa * 0.2], norm([uca, 0.8, usa]), 0.95, 0.22, 0.25, 4);
        }
        for (i = 0; i < 9; i++) {
            var fa = (i * 40 + 12) * rad, fe = ((i % 3) * 22 + 2) * rad;
            var fd = [Math.cos(fe) * Math.cos(fa), Math.sin(fe), Math.cos(fe) * Math.sin(fa)];
            fern([fd[0] * 0.6, H0 + fd[1] * 0.55, fd[2] * 0.6], fd, 0.85);
        }

        /* blooms + stems */
        var bi = 0;
        rings.forEach(function (ring) {
            ring.list.forEach(function (sp, idxIn) {
                var type = sp[0];
                var a = (ring.a0 + idxIn * 360 / ring.list.length) * rad, e = ring.e * rad;
                var ds = SHELL[type] + 0.06 * rand();
                var dir = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
                var c = [dir[0] * 0.98 * ds, H0 + dir[1] * 0.85 * ds, dir[2] * 0.98 * ds];
                var nrm = norm([dir[0], dir[1] + 0.4, dir[2]]);
                var R = BASE[type] * ring.sz * (0.92 + 0.16 * rand());
                setFrame(c, nrm, rand() * TAU);
                MAKE[type](R, sp[1], sp[2]);
                stem([c[0] - nrm[0] * 0.04, c[1] - nrm[1] * 0.04, c[2] - nrm[2] * 0.04], bi++, total);
            });
        });

        /* filler daisies on the outer shell, each with a short stem */
        var DF = [7, 3, 2, 1];
        for (i = 0; i < 28; i++) {
            var de = (-20 + rand() * 100) * rad, da = rand() * TAU;
            var dd = [Math.cos(de) * Math.cos(da), Math.sin(de), Math.cos(de) * Math.sin(da)];
            var dc = [dd[0] * 1.16, H0 + dd[1] * 1.0, dd[2] * 1.16];
            daisy(dc, norm([dd[0], dd[1] + 0.3, dd[2]]), 0.07 + 0.04 * rand(), DF[i % 4], 11);
            for (k = 1; k <= 6; k++) add(dc[0] * (1 - 0.1 * k), dc[1] - 0.05 * k, dc[2] * (1 - 0.1 * k), dd[0], 0, dd[2], 5, 0);
        }

        /* baby's breath */
        for (i = 0; i < 16; i++) {
            var be = (-10 + rand() * 90) * rad, ba = rand() * TAU, br = 1.2 + rand() * 0.12;
            var bc = [Math.cos(be) * Math.cos(ba) * br, H0 + Math.sin(be) * br * 0.9, Math.cos(be) * Math.sin(ba) * br];
            for (k = 1; k <= 5; k++) add(bc[0] * (1 - 0.06 * k), bc[1] - 0.04 * k, bc[2] * (1 - 0.06 * k), 0, 1, 0, 5, 0);
            for (j = 0; j < 10; j++) {
                var o = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
                add(bc[0] + o[0] * 0.14, bc[1] + o[1] * 0.14, bc[2] + o[2] * 0.14, o[0], o[1], o[2] + 0.4, 7, 0);
            }
        }

        /* ribbon band */
        var row, q2, ra;
        for (row = 0; row < 5; row++) {
            for (q2 = 0; q2 < 40; q2++) {
                ra = q2 / 40 * TAU;
                add(Math.cos(ra) * 0.15, -0.9 - row * 0.045, Math.sin(ra) * 0.15, Math.cos(ra), 0, Math.sin(ra), 6, row === 0 ? 0.1 : 0);
            }
        }
        /* bow loops + tails */
        var sd, rr, rs, p, pa, tt, tq;
        for (sd = -1; sd <= 1; sd += 2) {
            for (rr = 0; rr < 2; rr++) {
                rs = rr ? 1 : 0.7;
                for (p = 0; p < 22; p++) {
                    pa = p / 22 * TAU;
                    add(sd * 0.17 + Math.cos(pa) * 0.15 * rs, -0.97 + Math.sin(pa) * 0.09 * rs, 0.17, 0, 0, 1, 6, 0);
                }
            }
            for (tt = 0; tt <= 14; tt++) {
                tq = tt / 14;
                add(sd * (0.03 + 0.17 * tq), -1.0 - 0.38 * tq, 0.17 + 0.01 * tq, 0, 0, 1, 6, 0);
                add(sd * (0.03 + 0.17 * tq) + 0.014, -1.0 - 0.38 * tq, 0.17 + 0.01 * tq, 0, 0, 1, 6, 0);
            }
        }
    })();

    /* Freeze into typed arrays (fast per-frame loops, no GC) */
    var X = Float32Array.from(Xa), Y = Float32Array.from(Ya), Z = Float32Array.from(Za);
    var NX = Float32Array.from(NXa), NY = Float32Array.from(NYa), NZ = Float32Array.from(NZa);
    var F = Uint8Array.from(Fa), T = Float32Array.from(Ta);
    Xa = Ya = Za = NXa = NYa = NZa = Fa = Ta = null;
    var N = X.length;

    var D = 6;                                              // camera distance (perspective)
    var LX = -0.35, LY = 0.55, LZ = 0.8;
    (function () { var l = Math.sqrt(LX * LX + LY * LY + LZ * LZ); LX /= l; LY /= l; LZ /= l; })();

    /* ---- Glyph sprite atlas: one baked sprite per (colour level, character), created on first use ---- */
    var ATLAS_COLS = 60, SLOTS = NFAM * 16 * GLYPHS;
    var atlas = document.createElement('canvas');
    var actx = atlas.getContext('2d');
    var built = new Uint8Array(SLOTS);

    function bakeGlyph(slot) {
        var cc = (slot / GLYPHS) | 0, ci = slot - cc * GLYPHS;
        var sx = (slot % ATLAS_COLS) * cwD, sy = ((slot / ATLAS_COLS) | 0) * chD;
        actx.save();
        actx.beginPath();
        actx.rect(sx, sy, cwD, chD);
        actx.clip();                                         // a glyph can never bleed into a neighbour slot
        actx.font = fsD + 'px "Courier New", monospace';
        actx.textAlign = 'center';
        actx.textBaseline = 'middle';
        actx.fillStyle = COLORS[cc];
        actx.fillText(RAMPS[cc >> 4].charAt(ci), sx + cwD / 2, sy + chD * 0.5);
        actx.restore();
        built[slot] = 1;
    }

    var W = 0, H = 0, dpr = 1, fs = 12, fsD = 12, cwD = 8, chD = 13, cols = 0, rows = 0, padX = 0, padY = 0;
    var zbuf, cellSlot, occ;
    var ang = 0.6, time = 0, SPIN = 0.55;

    function drawBouquet() {
        var SD = Math.min(H * 0.27, W * 0.25) * dpr;        // pixels per world unit (device px)
        var ox = cols * 0.5, oy = rows * 0.5 + 0.075 * SD / chD;
        var kx = SD / cwD, ky = SD / chD;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var tilt = 0.3 + 0.05 * Math.sin(time * 0.7), tc = Math.cos(tilt), ts = Math.sin(tilt);
        /* light rotated once into object space, so normals never need rotating */
        var lb = LY * tc + LZ * ts, lc = -LY * ts + LZ * tc;
        var lox = LX * ca - lc * sa, loy = lb, loz = LX * sa + lc * ca;

        zbuf.fill(-1e9);
        var occN = 0, i;
        for (i = 0; i < N; i++) {
            var xi = X[i], zi = Z[i], yi = Y[i];
            var x = xi * ca + zi * sa, z = zi * ca - xi * sa;
            var y2 = yi * tc - z * ts, z2 = yi * ts + z * tc;
            var f = D / (D - z2);
            var px = ox + x * f * kx, py = oy - y2 * f * ky;
            if (px < 0 || py < 0) continue;
            var col = px | 0, row = py | 0;
            if (col >= cols || row >= rows) continue;
            var id = row * cols + col;
            var zb = zbuf[id];
            if (z2 <= zb) continue;
            var fam = F[i];
            var dif = NX[i] * lox + NY[i] * loy + NZ[i] * loz;
            if (dif < 0) dif = TWO[fam] ? -dif : 0;
            var d2 = dif * dif, d4 = d2 * d2;
            var b = (0.18 + 0.82 * dif + 0.28 * d4 * d4 + T[i]) * (0.6 + 0.4 * (z2 + 1.9) / 3.8);
            var lv = b <= 0 ? 0 : (b >= 1 ? 15 : (b * 15 + 0.5) | 0);
            if (zb === -1e9) occ[occN++] = id;
            zbuf[id] = z2;
            cellSlot[id] = (fam * 16 + lv) * GLYPHS + ((lv * RLEN[fam]) >> 4);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);                  // grid is in whole device pixels: crisp sprites
        for (var k = 0; k < occN; k++) {
            var o = occ[k], slot = cellSlot[o];
            if (!built[slot]) bakeGlyph(slot);
            var r2 = (o / cols) | 0, c2 = o - r2 * cols;
            ctx.drawImage(atlas, (slot % ATLAS_COLS) * cwD, ((slot / ATLAS_COLS) | 0) * chD, cwD, chD,
                padX + c2 * cwD, padY + r2 * chD, cwD, chD);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
        fs = clamp(Math.round(Math.min(H / 58, W / 60)), 7, 14);
        fsD = Math.round(fs * dpr);
        cwD = Math.max(4, Math.ceil(fsD * 0.6));            // whole-pixel cell size
        chD = Math.max(6, Math.round(fsD * 1.06));
        cols = Math.max(1, Math.floor(canvas.width / cwD));
        rows = Math.max(1, Math.floor(canvas.height / chD));
        padX = (canvas.width - cols * cwD) >> 1;
        padY = (canvas.height - rows * chD) >> 1;
        var cells = cols * rows;
        zbuf = new Float32Array(cells);
        cellSlot = new Uint16Array(cells);
        occ = new Int32Array(cells);
        atlas.width = ATLAS_COLS * cwD;                      // resizing also clears the atlas
        atlas.height = Math.ceil(SLOTS / ATLAS_COLS) * chD;
        built = new Uint8Array(SLOTS);
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
    // Also listen for window resize to handle cases like password gate unlock where
    // the stage becomes visible but its size doesn't change (ResizeObserver won't fire)
    window.addEventListener('resize', function () { resize(); sync(); });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) { vis = entries[0].isIntersecting; sync(); }, { threshold: 0.1 }).observe(section);
    } else { vis = true; }
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', function () { typerStop(); loopStop(); });
    resize();
    sync();
})();