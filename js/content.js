/* content.js - EDIT YOUR MEMORIES HERE (the only file you need to touch for text/photos).
   Load this BEFORE timeline.js, gallery.js and letter.js.

   Photos: replace any `image` / `src` value with your own path, e.g. 'images/2023.jpg'.
   The sample photos below are generated pink placeholders so nothing 404s.            */
(function () {
    /* Placeholder generator - delete it once every image is a real file. */
    function sample(emoji, label, c1, c2) {
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/>' +
            '</linearGradient></defs>' +
            '<rect width="640" height="800" fill="url(#g)"/>' +
            '<text x="320" y="420" font-size="220" text-anchor="middle">' + emoji + '</text>' +
            '<text x="320" y="610" font-size="44" text-anchor="middle" fill="#ffffff" ' +
            'font-family="Georgia, serif" font-style="italic">' + label + '</text></svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    window.SITE_CONTENT = {

        /* ---------- SECTION 2: MEMORY TIMELINE ---------- */
        timeline: {
            title: 'Our Story',
            subtitle: 'Little moments we keep forever',

            // One object per memory. Add, remove or reorder freely; sides alternate automatically.
            entries: [
                {
                    year: '2023',
                    date: 'February 2023',
                    title: 'The first hello',
                    caption: 'That quiet little moment when everything suddenly felt brighter.',
                    image: 'images/image2.jpg',
                    alt: 'The first hello'
                },
                {
                    year: '2024',
                    date: 'Summer 2024',
                    title: 'Little adventures',
                    caption: 'New places, laughter, and the kind of memories we still smile about.',
                    image: 'images/image3.jpg',
                    alt: 'Little adventures'
                },
                {
                    year: '2025',
                    date: 'March 2025',
                    title: 'Our favorite rhythm',
                    caption: 'The ordinary days that turned into our favorite story.',
                    image: 'images/image4.jpg',
                    alt: 'Our favorite rhythm'
                },
                {
                    year: '2026',
                    date: 'Now',
                    title: 'Still choosing us',
                    caption: 'Every day with you feels like a small love letter we get to keep.',
                    image: 'images/image5.jpg',
                    alt: 'Still choosing us'
                }
            ],

            // Scrapbook stickers. Position with top/left/right/bottom (any CSS length), size in px, rotate in deg.
            stickers: [
                { emoji: '\uD83C\uDF80', top: '5%', left: '12%', size: 58, rotate: -16 },
                { emoji: '\u2B50', top: '27%', right: '4%', size: 46, rotate: 14 },
                { emoji: '\uD83E\uDDF8', top: '58%', left: '9%', size: 64, rotate: -8 },
                { emoji: '\uD83C\uDF38', bottom: '5%', right: '9%', size: 52, rotate: 20 }
            ]
        },

        /* ---------- SECTION 3: PHOTO BOOTH GALLERY ---------- */
        gallery: {
            title: 'Photo Booth',
            subtitle: 'Drag, swipe or use the arrows',
            photos: [
                { src: 'images/image5.jpg', caption: 'Us in bloom' },
                { src: 'images/image6.jpg', caption: 'Sweet little moments' },
                { src: 'images/image7.jpg', caption: 'Golden hour' },
                { src: 'images/image8.jpg', caption: 'Happy us' },
                { src: 'images/image9.jpg', caption: 'Always together' },
                { src: 'images/image10.jpg', caption: 'Forever favorite' }
            ]
        },

        /* ---------- SECTION 4: LOVE LETTER ---------- */
        letter: {
            hint: 'Tap the envelope to open \uD83D\uDC8C',
            openLabel: 'Open the love letter',
            closeLabel: 'Close letter \u2715',
            to: 'My dearest MJ,',
            // One string per paragraph.
            paragraphs: [
                'I wanted a little corner of the internet that only we can open, with the things I never say out loud quite right.',
                'Thank you for every ordinary day that you chose to spend with me :)',
                'I hope we get to spend many more together in the future.'
            ],
            closing: 'Forever yours,',
            from: 'Your lablab \u2764\uFE0F'
        }
    };
})();