(function () {
    'use strict';

    var CONTENT_URL = 'data/content.json';
    var DEPENDENTS = ['js/greetings.js', 'js/timeline.js', 'js/gallery.js', 'js/jar.js', 'js/music.js', 'js/letter.js', 'js/ascii-art.js'];
    var SECTION_IDS = ['greetings', 'story', 'gallery', 'jar', 'music', 'last'];

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.charset = 'utf-8';
            s.async = false;                         // keep execution order
            s.onload = resolve;
            s.onerror = function () { reject(new Error('Could not load ' + src)); };
            document.body.appendChild(s);
        });
    }

    /* Backgrounds from content.json (solid hex or CSS gradient).
       CSS gradients in layout.css (--grad-*) are defaults; content.json values override them. */
    function applyBackgrounds(bg) {
        if (!bg) return;
        SECTION_IDS.forEach(function (id) {
            var node = document.getElementById(id);
            if (!node) return;
            var val = bg[id];
            if (!val) return;
            // Gradient if it looks like one; otherwise treat as hex color
            if (/^linear-gradient|^radial-gradient|^conic-gradient/i.test(val.trim())) {
                node.style.background = val;
            } else if (/^#[0-9a-f]{6}$/i.test(val)) {
                node.style.backgroundColor = val;
            }
        });
        // The strip behind the mobile bottom nav matches the last section
        var last = document.getElementById('last');
        var site = document.getElementById('site-content');
        if (last && site) {
            var lastBg = last.style.background || last.style.backgroundColor;
            if (lastBg) site.style.background = lastBg;
        }
        if (typeof window.__syncTreeBackground === 'function') window.__syncTreeBackground();
    }

    fetch(CONTENT_URL, { cache: 'no-cache' })        // no-cache: edits show up on a normal refresh
        .then(function (res) {
            if (!res.ok) throw new Error(CONTENT_URL + ' returned HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            window.SITE_CONTENT = data;
            applyBackgrounds(data.backgrounds);
            return DEPENDENTS.reduce(function (chain, src) {
                return chain.then(function () { return loadScript(src); });
            }, Promise.resolve());
        })
        .catch(function (err) {
            console.error('[content] Failed to load site content:', err);
        });
})();