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
                    title: 'Where it all began',
                    caption: 'Sample caption: the first hello that quietly changed everything.',
                    image: sample('\uD83D\uDC8C', '2023', '#ff9fc0', '#e5457f'),
                    alt: 'Sample photo for 2023'
                },
                {
                    year: '2024',
                    date: 'Summer 2024',
                    title: 'Adventures together',
                    caption: 'Sample caption: new places, bad jokes and way too many photos.',
                    image: sample('\uD83C\uDF38', '2024', '#ffc2d6', '#f06a9b'),
                    alt: 'Sample photo for 2024'
                },
                {
                    year: '2025',
                    date: 'December 2025',
                    title: 'Still choosing each other',
                    caption: 'Sample caption: ordinary days that turned into favourites.',
                    image: sample('\uD83E\uDDF8', '2025', '#ffb3cc', '#d93d78'),
                    alt: 'Sample photo for 2025'
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
            // One object per print. `caption` is written on the white bottom margin.
            photos: [
                { src: sample('\uD83D\uDCF8', 'Booth night', '#ffb3cc', '#e5457f'), caption: 'Booth night' },
                { src: sample('\u2615', 'Coffee date', '#ffc9a8', '#ef6f8f'), caption: 'Coffee date' },
                { src: sample('\uD83C\uDF05', 'Golden hour', '#ffd0a6', '#e0527f'), caption: 'Golden hour' },
                { src: sample('\uD83C\uDF0A', 'Beach day', '#ffbfd8', '#c93a82'), caption: 'Beach day' },
                { src: sample('\uD83C\uDFAC', 'Movie night', '#f7a6c8', '#b83a76'), caption: 'Movie night' },
                { src: sample('\uD83D\uDE1C', 'Silly faces', '#ffc4dc', '#ea5a8e'), caption: 'Silly faces' },
                { src: sample('\uD83D\uDC96', 'Us', '#ff9fc0', '#d63a76'), caption: 'Us' }
            ]
        },

        /* ---------- SECTION 4: LOVE LETTER ---------- */
        letter: {
            hint: 'Tap the envelope to open \uD83D\uDC8C',
            openLabel: 'Open the love letter',
            closeLabel: 'Close letter \u2715',
            to: 'My dearest love,',
            // One string per paragraph.
            paragraphs: [
                'This is a sample letter. Replace these words with your own. Every line lives in js/content.js, so you never have to touch the envelope code.',
                'I wanted a little corner of the internet that only we can open, with the things I never say out loud quite right.',
                'Thank you for every ordinary day that somehow turned into my favourite one.'
            ],
            closing: 'Forever yours,',
            from: 'Your lablab \u2764\uFE0F'
        }
    };
})();