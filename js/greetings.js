/* greetings.js - Section 1 (#greetings): typewriter greeting (left) + rotating 3D ASCII bouquet
   with bloom-in transition on first appearance (right). */
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

    /* ---- Settings ---- */
    var typingSpeed = num(cfg.typingSpeed, 10, 2000);
    var startDelay  = num(cfg.startDelay, 0, 30000);
    var holdDelay   = num(cfg.holdDelay, 0, 30000);
    var deleteSpeed = Math.max(12, Math.round(typingSpeed * 0.5));
    var messages = (cfg.messages || []).map(function (m) {
        return typeof m === 'string' ? m : (m && m.text) || '';
    }).filter(function (t) { return t.trim(); });

    /* ---- DOM ---- */
    var left  = el('div', 'gr-text-col');
    var block = el('div', 'gr-block');
    var msg   = el('p', 'gr-msg');
    var ghost = el('span', 'gr-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    var wrap  = el('span', 'gr-typed-wrap');
    var typed = el('span', 'gr-typed');
    var cursor = el('span', 'gr-cursor');
    cursor.setAttribute('aria-hidden', 'true');
    wrap.appendChild(typed);
    wrap.appendChild(cursor);
    msg.appendChild(ghost);
    msg.appendChild(wrap);
    block.appendChild(msg);
    if (cfg.subtitle && String(cfg.subtitle).trim()) {
        block.appendChild(el('p', 'gr-sub', cfg.subtitle));
    }
    left.appendChild(block);

    var art   = el('div', 'gr-art');
    var stage = el('div', 'gr-stage');
    var canvas = el('canvas', 'gr-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);
    art.appendChild(stage);
    section.appendChild(left);
    section.appendChild(art);

    var ctx = canvas.getContext('2d');

    /* ================= Typewriter ================= */
    var seg = (window.Intl && Intl.Segmenter)
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;
    function split(t) {
        return seg
            ? Array.from(seg.segment(t), function (s) { return s.segment; })
            : Array.from(t);
    }
    var segs = messages.map(split);
    var idx = 0, n = 0, phase = 'wait', timer = 0;

    if (messages.length) {
        ghost.textContent = messages.reduce(function (a, b) {
            return b.length > a.length ? b : a;
        }, '');
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
    function typerStop()  { clearTimeout(timer); timer = 0; }

    if (reduce) {
        typed.textContent = messages[0] || '';
        cursor.style.display = 'none';
    }

    /* ================= 3D ASCII Bouquet ================= */
    var CFG = {
        roses: 44,
        seed: 1402,
        spin: 0.45,          // rad/s after bloom finishes
        pitch: 0.24,
        duration: 14,        // seconds for the full bloom-in sequence
        palettes: [
            ['#6b0a18', '#b3122b', '#e8344f'],
            ['#7d2a40', '#c4607a', '#e68aa0'],
            ['#9a5a6e', '#d490a2', '#f3c0cd'],
            ['#4a0612', '#8e0f24', '#c91f3d'],
            ['#b87a8c', '#e6aebb', '#fbd9e0']
        ]
    };

    var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var easeOut = function (p) { return 1 - Math.pow(1 - p, 3); };
    var easeIO  = function (p) {
        return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    };
    var hex = function (h) {
        return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
    };
    var mix = function (a, b, t) {
        return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
    };
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    var norm  = function (a) {
        var l = Math.hypot(a[0], a[1], a[2]) || 1;
        return [a[0]/l, a[1]/l, a[2]/l];
    };
    var cross = function (a, b) {
        return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    };

    var rnd = mulberry32(CFG.seed), PI2 = Math.PI * 2;
    var RAMP   = '.:-=+rxtjucnvz*o%&8#BQ@';
    var RAMP_P = "./\\|-_+:;,'`";
    var code = function (b, ramp) {
        ramp = ramp || RAMP;
        return Math.max(0, Math.min(ramp.length - 1,
            Math.floor(b * (ramp.length - 1) + (rnd() - .5) * 3)));
    };
    var jit = function (c, a) {
        var f = 1 + (rnd() - .5) * a;
        return [c[0]*f, c[1]*f, c[2]*f];
    };
    var GREEN = ['#1f7a3a','#2f9a4e','#46b862','#7de39a'].map(hex);
    var BUD   = [28, 66, 38];
    var GOLD  = [hex('#e6b422'), hex('#f5d36b')];

    /* ---- Geometry builders ---- */
    var A = { x:[], y:[], z:[], p:[], t:[], d:[], r:[], g:[], b:[], c:[], k:[] };
    function addS(x, y, z, par, t0, dur, rgb, ch, k) {
        A.x.push(x); A.y.push(y); A.z.push(z);
        A.p.push(par); A.t.push(t0); A.d.push(dur);
        A.r.push(rgb[0]); A.g.push(rgb[1]); A.b.push(rgb[2]);
        A.c.push(ch); A.k.push(k || 0);
    }

    // stalk
    for (var y = 119; y >= 94; y -= 1) {
        var n = 19;
        for (var k = 0; k < n; k++) {
            var a = k / n * PI2, br = .3 + .7 * (.5 + .5 * Math.cos(a - .8));
            addS(50 + 3.4 * Math.cos(a), y, 3.4 * Math.sin(a),
                (119 - y) / 25, 1, 2.2,
                jit(mix(GREEN[0], hex('#8dffae'), br), .2), code(br), 0);
        }
    }
    // gold ribbon
    [100.6, 102, 103.4].forEach(function (y, row) {
        for (var k = 0; k < 22; k++) {
            var a = k / 22 * PI2;
            addS(50 + 3.9 * Math.cos(a), y, 3.9 * Math.sin(a),
                0, 3.6, 1.2, jit(GOLD[row === 1 ? 1 : 0], .15),
                code(row === 1 ? .85 : .6), 0);
        }
    });
    [-1, 1].forEach(function (sd) {
        for (var k = 0; k < 18; k++) {
            var a = k / 18 * PI2;
            addS(50 + sd * 4.4 + Math.cos(a) * 3.2, 99.2 + Math.sin(a) * 2, 4.4,
                0, 4.2, 1, jit(GOLD[1], .2), code(.8), 0);
        }
        for (var yy = 101; yy < 113; yy += 1.1) {
            addS(50 + sd * (1.5 + (yy - 101) * .22), yy, 4.8,
                0, 4.4, 1, jit(GOLD[0], .2), code(.7), 0);
        }
    });
    addS(50, 100, 5, 0, 4.2, 1, GOLD[1], RAMP.length - 1, 0);

    // paper wrap
    {
        var APEX_Y = 96, RIM_Y = 30, RIM_R = 44, HEXC = Math.cos(Math.PI / 6);
        for (var aa = 1; aa <= 78; aa++) {
            var v = aa / 78, rv = Math.pow(v, .45);
            var nphi = Math.max(8, Math.round(PI2 * RIM_R * rv / 1.2));
            for (var k = 0; k < nphi; k++) {
                var phi = (k + rnd() * .6) / nphi * PI2;
                var m = ((phi % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3);
                var rh = RIM_R * HEXC / Math.cos(m - Math.PI / 6);
                var rimY = RIM_Y + 2.5 * (1 - Math.cos(6 * phi));
                var f = m / (Math.PI / 3), fold = f < .05 || f > .95, rim = v > .96;
                var br = rim ? .8 : fold ? .6 : .38 + .15 * Math.sin(v * 9 + phi * 3) + .12 * rnd();
                addS(50 + rv * rh * Math.cos(phi),
                     APEX_Y + v * (rimY - APEX_Y),
                     rv * rh * Math.sin(phi),
                     v, 3, 3.2,
                     jit([150, 150, 162], .2).map(function (c) { return c * br / .6; }),
                     rim ? 4 + (k & 1) : code(br, RAMP_P),
                     rim ? 52 : fold ? 46 : 40);
            }
        }
    }

    function leaf(ax, ay, az, d0, len, wid, t0, flat) {
        var d  = norm(d0);
        var p1 = norm(cross(d, flat ? [0, 0, 1] : [rnd()-.5, rnd()-.5, rnd()-.5]));
        var p2 = cross(d, p1);
        var nv = Math.ceil(len / 1.1);
        for (var k = 0; k <= 5; k++) {
            for (var oi = 0; oi < 2; oi++) {
                var o = oi === 0 ? 0 : .7;
                addS(ax - d[0]*k*1.1, ay - d[1]*k*1.1 + o, az - d[2]*k*1.1,
                    0, t0, 1, jit(GREEN[1], .2), code(.4), 0);
            }
        }
        for (var a = 0; a <= nv; a++) {
            var vv = a / nv;
            var wv = wid * Math.pow(Math.sin(Math.PI * Math.min(1, vv * .95 + .05)), .8) *
                     (vv < .08 ? vv / .08 : 1);
            var nu = Math.max(1, Math.round(wv * 2 / 1.1));
            for (var b = 0; b <= nu; b++) {
                var u = b / nu * 2 - 1;
                var lat = u * wv, edge = Math.abs(u) > .85 || a === nv, mid = Math.abs(u) < .12;
                var ff = .18 * Math.abs(lat);
                var br = edge ? .85 : mid ? .7 : .35 + .3 * rnd() + .1 * vv;
                addS(ax + d[0]*len*vv + p1[0]*lat + p2[0]*ff,
                     ay + d[1]*len*vv + p1[1]*lat + p2[1]*ff + .22*len*vv*vv,
                     az + d[2]*len*vv + p1[2]*lat + p2[2]*ff,
                     vv, t0, 1.6, jit(mix(GREEN[0], GREEN[3], br), .2), code(br), 0);
            }
        }
    }

    // roses
    var N = CFG.roses, AX = 38, AY = 22, AZ = 34, CY = 56, BMAX = 1.8;
    var LAY = 6, CNT = [3,4,6,8,10,12], AO = [.2,.45,.75,1,1.25,1.5], AC = [.05,.08,.12,.15,.18,.22];
    var roses = [], RP = { xm:[], ym:[], zm:[], d:[], x0:[], y0:[], z0:[], x1:[], y1:[], z1:[], r:[], g:[], b:[], c:[] };

    for (var i = 0; i < N; i++) {
        var bb = Math.acos(1 - (1 - Math.cos(BMAX)) * (i + .5) / N);
        var gg = i * 2.39996 + rnd() * .2;
        var ex = AX * Math.sin(bb) * Math.cos(gg);
        var ey = -AY * Math.cos(bb);
        var ez = AZ * Math.sin(bb) * Math.sin(gg);
        var nz = norm([ex/(AX*AX), ey/(AY*AY), ez/(AZ*AZ)]);
        var bx = cross([0,-1,0], nz);
        bx = Math.hypot(bx[0],bx[1],bx[2]) < .1 ? [1,0,0] : norm(bx);
        var by = cross(nz, bx);
        var pal = CFG.palettes[[0,0,0,1,1,3,3,2,4][Math.floor(rnd()*9)%9] % CFG.palettes.length].map(hex);
        var R  = (8.2 + rnd()*1.6) * Math.sqrt(19/N) * 1.25;
        var Rb = R * .76;
        var rose = {
            p: [50+ex, CY+ey, ez],
            bx: bx, by: by, bz: nz,
            key: bb + rnd() * .5,
            bud: 2.8 + rnd() * 2.2,
            t0: 0,
            lay: []
        };

        for (var l = 0; l < LAY; l++) {
            var a0 = RP.x0.length;
            for (var q = 0; q < CNT[l]; q++) {
                var phi = q/CNT[l]*PI2 + l*.95 + rnd()*.3;
                var Lp  = Rb * (.46 + .13*l);
                var half= Lp * (l < 2 ? .8 : .7);
                var r0  = Rb * (.04 + .035*l);
                var curl= l < 2 ? .15 : .5 + .08*l;
                var nv  = Math.max(4, Math.round(Lp / .95));
                var nu  = Math.max(3, Math.round(2*half / .95));
                for (var a = 0; a < nv; a++) {
                    var v = Math.min(1, (a+.5+(rnd()-.5)*.5)/nv);
                    var lim = v < .8 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((v-.8)/.2, 2)));
                    var wv  = half * (.3 + .7*Math.sqrt(v)) * (1 - .2*v*v);
                    for (var b = 0; b < nu; b++) {
                        var u = (b+.5+(rnd()-.5)*.5)/nu * 2 - 1;
                        if (Math.abs(u) > lim) continue;
                        var lat = u * wv;
                        var geo = function (al) {
                            var a2 = al + curl * v * .6;
                            var rad = r0 + Lp * v * Math.sin(a2) * (1 - .3*u*u*(l<3?1:.3));
                            return [
                                rad*Math.cos(phi) - lat*Math.sin(phi),
                                rad*Math.sin(phi) + lat*Math.cos(phi),
                                Lp*v*Math.cos(a2) + .07*lat*lat + (l>1?.3:.1)*v*v*v*Math.sin(u*4+phi*2)
                            ];
                        };
                        var o  = geo(AO[l]), c = geo(AC[l]), md = geo((AO[l]+AC[l])/2);
                        var tc = clamp01(.26 + .5*v + .14*l/5 + (rnd()-.5)*.12 + .05*Math.cos(u*7));
                        var edge = Math.abs(u) > .86 || v > .9;
                        var rgb = tc < .5 ? mix(pal[0], pal[1], tc*2) : mix(pal[1], pal[2], (tc-.5)*2);
                        RP.xm.push(md[0]); RP.ym.push(md[1]); RP.zm.push(md[2]);
                        RP.d.push(l * .28 + q * .04);
                        RP.x0.push(c[0]);  RP.y0.push(c[1]);  RP.z0.push(c[2]);
                        RP.x1.push(o[0]);  RP.y1.push(o[1]);  RP.z1.push(o[2]);
                        RP.r.push(rgb[0]); RP.g.push(rgb[1]); RP.b.push(rgb[2]);
                        RP.c.push(code(tc + (edge ? .1 : 0)));
                    }
                }
            }
            rose.lay.push([a0, RP.x0.length]);
        }
        roses.push(rose);

        // stems
        var B = [rose.p[0]-nz[0]*R*.5, rose.p[1]-nz[1]*R*.5, rose.p[2]-nz[2]*R*.5];
        var F = [50, 96, 0];
        var M = [(F[0]+B[0])/2+(rnd()-.5)*5, (F[1]+B[1])/2, (F[2]+B[2])/2+(rnd()-.5)*5];
        var nn = Math.ceil(Math.hypot(B[0]-F[0], B[1]-F[1], B[2]-F[2]));
        var t0 = 2.4 + rnd() * 1.8;
        for (var s = 0; s <= nn; s++) {
            var u = s/nn, w = 1-u;
            for (var oi = 0; oi < 3; oi++) {
                var off = oi === 0 ? -.7 : (oi === 1 ? 0 : .7);
                addS(w*w*F[0]+2*w*u*M[0]+u*u*B[0]+off,
                     w*w*F[1]+2*w*u*M[1]+u*u*B[1],
                     w*w*F[2]+2*w*u*M[2]+u*u*B[2]+(rnd()-.5)*.8,
                     u, t0, 2, jit(mix(GREEN[1], GREEN[2], rnd()), .3), code(.3+rnd()*.4), 0);
            }
        }
    }

    // stagger rose open times
    [].concat(roses).sort(function (a, b) { return a.key - b.key; })
      .forEach(function (r, i) {
          r.t0 = 4.6 + i / Math.max(1, N - 1) * 6.6;
      });

    // foliage
    for (var i = 0; i < 72; i++) {
        var bb = .3 + rnd()*2, gg = rnd()*PI2;
        var ex = .8*AX*Math.sin(bb)*Math.cos(gg);
        var ey = -.8*AY*Math.cos(bb);
        var ez = .8*AZ*Math.sin(bb)*Math.sin(gg);
        var nz = norm([ex/(AX*AX), ey/(AY*AY), ez/(AZ*AZ)]);
        leaf(50+ex, CY+ey, ez,
             [nz[0]+(rnd()-.5)*.6, nz[1]+.25+(rnd()-.5)*.4, nz[2]+(rnd()-.5)*.6],
             6+rnd()*5, 2+rnd()*1.3, 3 + rnd()*4);
    }
    [[0,1.5],[Math.PI,1.5],[.12,1.75],[Math.PI-.12,1.75]].forEach(function (pair, i) {
        var g = pair[0], bb = pair[1];
        var ex = .93*AX*Math.sin(bb)*Math.cos(g);
        var ey = -.93*AY*Math.cos(bb);
        var ez = .93*AZ*Math.sin(bb)*Math.sin(g);
        var nz = norm([ex/(AX*AX), ey/(AY*AY), ez/(AZ*AZ)]);
        leaf(50+ex, CY+ey, ez, [nz[0]*1.2, nz[1]+.55, nz[2]*.6],
             11+(i%2)*2, 3.4, 4.2 + i*.3, true);
    });

    // freeze
    var NS = A.x.length;
    var SX = Float32Array.from(A.x), SY = Float32Array.from(A.y), SZ = Float32Array.from(A.z);
    var SP = Float32Array.from(A.p), ST = Float32Array.from(A.t), SD = Float32Array.from(A.d);
    var SR = Uint8ClampedArray.from(A.r), SG = Uint8ClampedArray.from(A.g), SB = Uint8ClampedArray.from(A.b);
    var SC = Uint8Array.from(A.c), SK = Uint8Array.from(A.k);

    var XM = Float32Array.from(RP.xm), YM = Float32Array.from(RP.ym), ZM = Float32Array.from(RP.zm);
    var PD = Float32Array.from(RP.d);
    var X0 = Float32Array.from(RP.x0), Y0 = Float32Array.from(RP.y0), Z0 = Float32Array.from(RP.z0);
    var X1 = Float32Array.from(RP.x1), Y1 = Float32Array.from(RP.y1), Z1 = Float32Array.from(RP.z1);
    var RR = Uint8ClampedArray.from(RP.r), RG = Uint8ClampedArray.from(RP.g), RB = Uint8ClampedArray.from(RP.b);
    var RC = Uint8Array.from(RP.c);

    /* ---- Layout / render ---- */
    var W = 0, H = 0, dpr = 1, S = 1, ox = 0, oy = 0, cw = 6, chh = 8, cols = 0, rows = 0, fontStr = '';
    var ZO, ZS, CO, CS, RO, GO, BO, RS, GS, BS, AS;
    var PC = Math.cos(CFG.pitch), PS = Math.sin(CFG.pitch);

    var T = reduce ? CFG.duration + 1 : 0;   // start at full bloom if reduced-motion
    var theta = 0;
    var bloomDone = reduce;

    function plot(x, y, z, ch, r, g, b, k, c, s) {
        var dx = x - 50, xr = dx * c + z * s, z0 = -dx * s + z * c;
        var yy = y - 80, zr = z0 * PC - yy * PS, yr = yy * PC + z0 * PS;
        var pf = 1 / (1 - zr * .0035);
        var col = Math.round((ox + (50 + xr * pf) * S) / cw);
        var row = Math.round((oy + (80 + yr * pf) * S) / chh);
        if (col < 0 || col >= cols || row < 0 || row >= rows) return;
        var ci = row * cols + col;
        var df = .7 + .3 * clamp01((zr + 40) / 80);
        if (k) {
            if (zr > ZS[ci]) {
                ZS[ci] = zr; CS[ci] = ch;
                RS[ci] = r * df; GS[ci] = g * df; BS[ci] = b * df; AS[ci] = k;
            }
        } else if (zr > ZO[ci]) {
            ZO[ci] = zr; CO[ci] = ch;
            RO[ci] = r * df; GO[ci] = g * df; BO[ci] = b * df;
        }
    }

    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        ZO.fill(-1e9); ZS.fill(-1e9);
        var c = Math.cos(theta), s = Math.sin(theta);

        // static parts (stalk, paper, leaves, stems) – timed appearance
        for (var i = 0; i < NS; i++) {
            var t = ST[i];
            if (T < t) continue;
            if (SP[i] > easeOut(clamp01((T - t) / SD[i]))) continue;
            plot(SX[i], SY[i], SZ[i], SC[i], SR[i], SG[i], SB[i], SK[i], c, s);
        }

        // roses – bud → open transition
        for (var ri = 0; ri < roses.length; ri++) {
            var R = roses[ri];
            var bud = easeOut(clamp01((T - R.bud) / 1.2));
            if (bud <= 0) continue;

            var bx = R.bx, by = R.by, bz = R.bz, p = R.p;
            for (var l = 0; l < LAY; l++) {
                var rg = R.lay[l];
                for (var i = rg[0]; i < rg[1]; i++) {
                    var q = clamp01((T - R.t0 - PD[i]) / 2.2);
                    var e = q * q * q * (q * (q * 6 - 15) + 10);   // smoothstep
                    var m = .3 + .7 * e;
                    // blend closed → half → open
                    var wa = (1 - e) * (1 - 2 * e);
                    var wb = 4 * e * (1 - e);
                    var wc = e * (2 * e - 1);
                    var lx = (X0[i]*wa + XM[i]*wb + X1[i]*wc) * bud;
                    var ly = (Y0[i]*wa + YM[i]*wb + Y1[i]*wc) * bud;
                    var lz = (Z0[i]*wa + ZM[i]*wb + Z1[i]*wc) * bud;
                    plot(p[0] + lx*bx[0] + ly*by[0] + lz*bz[0],
                         p[1] + lx*bx[1] + ly*by[1] + lz*bz[1],
                         p[2] + lx*bx[2] + ly*by[2] + lz*bz[2],
                         RC[i],
                         BUD[0] + (RR[i]-BUD[0])*m,
                         BUD[1] + (RG[i]-BUD[1])*m,
                         BUD[2] + (RB[i]-BUD[2])*m,
                         0, c, s);
                }
            }
        }

        // paint
        ctx.font = fontStr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 1;
        var lr = -1, lg = -1, lb = -1;
        for (var row = 0; row < rows; row++) {
            for (var col = 0; col < cols; col++) {
                var ci = row * cols + col;
                var hasO = ZO[ci] > -1e8, hasS = ZS[ci] > -1e8;
                if (!hasO && !hasS) continue;
                var px = col * cw, py = row * chh;
                if (hasO) {
                    if (RO[ci] !== lr || GO[ci] !== lg || BO[ci] !== lb) {
                        lr = RO[ci]; lg = GO[ci]; lb = BO[ci];
                        ctx.fillStyle = 'rgb(' + lr + ',' + lg + ',' + lb + ')';
                    }
                    ctx.fillText(RAMP[CO[ci]], px, py);
                }
                if (hasS && ZS[ci] > ZO[ci]) {
                    ctx.globalAlpha = AS[ci] / 100 * (hasO ? 1 : 1.2);
                    ctx.fillStyle = 'rgb(' + RS[ci] + ',' + GS[ci] + ',' + BS[ci] + ')';
                    lr = -1;
                    ctx.fillText(RAMP_P[CS[ci] % RAMP_P.length] || '.', px, py);
                    ctx.globalAlpha = 1;
                }
            }
        }
    }

    function resize() {
        var w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        W = w; H = h;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width  = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        S  = Math.min(W * .94 / 96, H * .78 / 100);
        ox = W / 2 - 50 * S;
        oy = H * .06 - 18 * S + Math.max(0, (H * .78 - 102 * S) / 2);

        var fs = Math.max(6, Math.min(14, S * 1.55));
        cw = fs * .6;
        chh = fs * .95;
        fontStr = fs + 'px "Courier New", ui-monospace, monospace';
        cols = Math.ceil(W / cw) + 2;
        rows = Math.ceil(H / chh) + 2;
        var n = cols * rows;
        ZO = new Float32Array(n); ZS = new Float32Array(n);
        CO = new Uint8Array(n);   CS = new Uint8Array(n);
        RO = new Uint8Array(n);   GO = new Uint8Array(n); BO = new Uint8Array(n);
        RS = new Uint8Array(n);   GS = new Uint8Array(n); BS = new Uint8Array(n);
        AS = new Uint8Array(n);

        if (!running) draw();
    }

    /* ---- Animation loop ---- */
    var raf = 0, last = 0, running = false;

    function frame(now) {
        if (!running) return;
        raf = requestAnimationFrame(frame);
        if (now - last < 16) return;               // ~60 fps during bloom, then capped
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        if (!bloomDone) {
            T += dt;
            // gentle spin already during the bloom
            theta += CFG.spin * easeIO(clamp01((T - 2) / 3)) * dt;
            if (T >= CFG.duration) {
                T = CFG.duration;
                bloomDone = true;
            }
        } else {
            // after bloom: continuous spin at full speed
            theta += CFG.spin * dt;
        }

        draw();
    }

    function loopStart() {
        if (running || !W || reduce) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }
    function loopStop() {
        running = false;
        cancelAnimationFrame(raf);
    }

    /* ---- Visibility (bloom starts the first time the section is seen) ---- */
    var vis = false;
    var hasStartedBloom = reduce;   // already “done” if reduced-motion

    function sync() {
        if (vis && !document.hidden) {
            typerStart();
            if (!reduce) {
                if (!hasStartedBloom) {
                    hasStartedBloom = true;
                    T = 0;
                    theta = 0;
                    bloomDone = false;
                }
                loopStart();
            }
        } else {
            typerStop();
            loopStop();
        }
    }

    if ('ResizeObserver' in window) {
        new ResizeObserver(function () { resize(); sync(); }).observe(stage);
    }
    window.addEventListener('resize', function () { resize(); sync(); });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            vis = entries[0].isIntersecting;
            sync();
        }, { threshold: 0.1 }).observe(section);
    } else {
        vis = true;
    }
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', function () { typerStop(); loopStop(); });

    resize();
    sync();
})();