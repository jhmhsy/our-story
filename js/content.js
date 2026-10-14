(function () {
    'use strict';

    var CONTENT_URL = 'data/content.json';
    var DEPENDENTS = ['js/timeline.js', 'js/gallery.js', 'js/letter.js'];

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

    fetch(CONTENT_URL, { cache: 'no-cache' })        // no-cache: edits show up on a normal refresh
        .then(function (res) {
            if (!res.ok) throw new Error(CONTENT_URL + ' returned HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            window.SITE_CONTENT = data;
            return DEPENDENTS.reduce(function (chain, src) {
                return chain.then(function () { return loadScript(src); });
            }, Promise.resolve());
        })
        .catch(function (err) {
            console.error('[content] Failed to load site content:', err);
        });
})();