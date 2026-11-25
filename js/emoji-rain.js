/* emoji-rain.js - fills #emoji-rain with love emojis + subtle ASCII stars. Odd drops rise, even drops fall. */
(function () {
  var layer = document.getElementById('emoji-rain');
  if (!layer) return;

  var EMOJIS = ['\uD83D\uDC96', '\uD83D\uDC95', '\uD83D\uDC97', '\uD83D\uDC93',
              '\uD83D\uDC9E', '\uD83D\uDC98', '\uD83D\uDC9D', '\u2764\uFE0F',
              '\uD83D\uDE18', '\uD83D\uDC8F', '\uD83D\uDE0D', '\uD83D\uDE1A', '\uD83D\uDE19'];
  var STAR_GLYPHS = ['*', '\u2605', '\u2606', '\u2729', '\u2730', '\u2731', '\u274A', '\u274B'];

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* ---- Emoji drops (even fewer, more sparse) ---- */
  var count = Math.max(6, Math.min(14, Math.round(window.innerWidth / 100))); // very few
  var frag = document.createDocumentFragment();

  for (var i = 0; i < count; i++) {
    var dur = rand(18, 32); // slower, more dreamy
    var drop = document.createElement('span');
    drop.className = 'love-drop ' + (i % 2 ? 'love-drop--rise' : 'love-drop--fall');
    drop.style.setProperty('--x', ((i + Math.random()) / count * 100).toFixed(1) + '%');
    drop.style.setProperty('--size', rand(8, 16).toFixed(0) + 'px'); // smaller: 8-16px
    drop.style.setProperty('--o', rand(0.25, 0.55).toFixed(2)); // more subtle
    drop.style.setProperty('--dur', dur.toFixed(1) + 's');
    drop.style.setProperty('--delay', (-rand(0, dur)).toFixed(1) + 's');

    var glyph = document.createElement('span');
    glyph.className = 'love-drop__glyph';
    glyph.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    glyph.style.setProperty('--sway', rand(8, 22).toFixed(0) + 'px'); // gentler sway
    glyph.style.setProperty('--sway-dur', rand(4, 8).toFixed(1) + 's');

    drop.appendChild(glyph);
    frag.appendChild(drop);
  }

  /* ---- ASCII Stars (sparse, subtle) ---- */
  var starCount = Math.max(4, Math.min(10, Math.round(window.innerWidth / 140))); // even fewer
  for (var s = 0; s < starCount; s++) {
    var starDur = rand(20, 40); // very slow drift
    var star = document.createElement('span');
    star.className = 'love-drop ' + (s % 2 ? 'love-drop--rise' : 'love-drop--fall');
    star.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
    star.style.setProperty('--size', rand(6, 12).toFixed(0) + 'px'); // tiny
    star.style.setProperty('--o', rand(0.15, 0.35).toFixed(2)); // very subtle
    star.style.setProperty('--dur', starDur.toFixed(1) + 's');
    star.style.setProperty('--delay', (-rand(0, starDur)).toFixed(1) + 's');

    var starGlyph = document.createElement('span');
    starGlyph.className = 'love-drop__glyph';
    starGlyph.textContent = STAR_GLYPHS[Math.floor(Math.random() * STAR_GLYPHS.length)];
    starGlyph.style.setProperty('--sway', rand(4, 14).toFixed(0) + 'px'); // minimal sway
    starGlyph.style.setProperty('--sway-dur', rand(5, 10).toFixed(1) + 's');

    star.appendChild(starGlyph);
    frag.appendChild(star);
  }

  layer.appendChild(frag);
})();
