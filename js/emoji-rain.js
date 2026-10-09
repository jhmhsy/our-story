/* emoji-rain.js - fills #emoji-rain with love emojis. Odd drops rise, even drops fall. */
(function () {
  var layer = document.getElementById('emoji-rain');
  if (!layer) return;

  var EMOJIS = ['\uD83D\uDC96', '\uD83D\uDC95', '\uD83D\uDC97', '\uD83D\uDC93',
              '\uD83D\uDC9E', '\uD83D\uDC98', '\uD83D\uDC9D', '\u2764\uFE0F',
              '\uD83D\uDE18', '\uD83D\uDC8F', '\uD83D\uDE0D', '\uD83D\uDE1A', '\uD83D\uDE19'];

  function rand(min, max) { return min + Math.random() * (max - min); }

  var count = Math.max(12, Math.min(30, Math.round(window.innerWidth / 55)));
  var frag = document.createDocumentFragment();

  for (var i = 0; i < count; i++) {
    var dur = rand(10, 20);
    var drop = document.createElement('span');
    drop.className = 'love-drop ' + (i % 2 ? 'love-drop--rise' : 'love-drop--fall');
    drop.style.setProperty('--x', ((i + Math.random()) / count * 100).toFixed(1) + '%');
    drop.style.setProperty('--size', rand(16, 34).toFixed(0) + 'px');
    drop.style.setProperty('--o', rand(0.45, 0.9).toFixed(2));
    drop.style.setProperty('--dur', dur.toFixed(1) + 's');
    drop.style.setProperty('--delay', (-rand(0, dur)).toFixed(1) + 's'); // start mid-flight

    var glyph = document.createElement('span');
    glyph.className = 'love-drop__glyph';
    glyph.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    glyph.style.setProperty('--sway', rand(14, 42).toFixed(0) + 'px');
    glyph.style.setProperty('--sway-dur', rand(2.5, 5).toFixed(1) + 's');

    drop.appendChild(glyph);
    frag.appendChild(drop);
  }
  layer.appendChild(frag);
})();
