/* timeline.js - builds Section 2 (#story) from SITE_CONTENT.timeline. */
(function () {
    'use strict';
    var cfg = window.SITE_CONTENT && window.SITE_CONTENT.timeline;
    var section = document.getElementById('story');
    if (!cfg || !section || section.getAttribute('data-built')) return;
    section.setAttribute('data-built', '1');

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    /* ---- Scrapbook stickers (decorative, click-through, behind the cards) ---- */
    var layer = el('div', 'tl-stickers');
    layer.setAttribute('aria-hidden', 'true');
    (cfg.stickers || []).forEach(function (s, i) {
        var n = el('span', 'tl-sticker', s.emoji);
        ['top', 'left', 'right', 'bottom'].forEach(function (k) {
            if (s[k] != null) n.style[k] = s[k];
        });
        n.style.setProperty('--size', (s.size || 52) + 'px');
        n.style.setProperty('--rot', (s.rotate || 0) + 'deg');
        n.style.setProperty('--i', i);
        layer.appendChild(n);
    });
    section.appendChild(layer);

    /* ---- Timeline ---- */
    var root = el('div', 'tl');
    var head = el('header', 'tl__head');
    head.appendChild(el('h2', 'tl__title', cfg.title || 'Our Story'));
    if (cfg.subtitle) head.appendChild(el('p', 'tl__subtitle', cfg.subtitle));
    root.appendChild(head);

    var list = el('ol', 'tl__list');
    (cfg.entries || []).forEach(function (e, i) {
        var side = i % 2 === 0 ? 'left' : 'right';
        var li = el('li', 'tl-entry tl-entry--' + side);
        li.appendChild(el('span', 'tl-entry__marker', '\u2665'));

        var card = el('article', 'tl-card');
        var photo = el('figure', 'tl-card__photo');
        var img = document.createElement('img');
        img.src = e.image;
        img.alt = e.alt || e.title || e.year || '';
        img.draggable = false;
        photo.appendChild(img);
        card.appendChild(photo);

        var meta = el('div', 'tl-card__meta');
        meta.appendChild(el('span', 'tl-card__year', e.year));
        if (e.date) meta.appendChild(el('span', 'tl-card__date', e.date));
        card.appendChild(meta);
        if (e.title) card.appendChild(el('h3', 'tl-card__heading', e.title));
        if (e.caption) card.appendChild(el('p', 'tl-card__caption', e.caption));

        card.appendChild(el('span', 'tl-card__heart tl-card__heart--a', '\u2665'));
        card.appendChild(el('span', 'tl-card__heart tl-card__heart--b', '\u2665'));
        li.appendChild(card);
        list.appendChild(li);
    });
    root.appendChild(list);
    section.appendChild(root);

    /* ---- Reveal on scroll (content stays visible if IntersectionObserver is missing) ---- */
    var entries = Array.prototype.slice.call(list.children);
    if (reduce || !('IntersectionObserver' in window)) {
        entries.forEach(function (n) { n.classList.add('is-in'); });
        layer.classList.add('is-in');
        return;
    }
    root.classList.add('tl--js');

    var io = new IntersectionObserver(function (items) {
        items.forEach(function (it) {
            if (it.isIntersecting) {
                it.target.classList.add('is-in');
                io.unobserve(it.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    entries.forEach(function (n) { io.observe(n); });

    var stickerIo = new IntersectionObserver(function (items) {
        if (items[0].isIntersecting) {
            layer.classList.add('is-in');
            stickerIo.disconnect();
        }
    }, { threshold: 0.1 });
    stickerIo.observe(section);
})();