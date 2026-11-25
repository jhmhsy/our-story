# Project Documentation: MJ x Henry (test-ascii)

> A personal, password-protected multimedia love site — "Our Story" — built as a static, data-driven vanilla JS experience.

---

## 1. Project Overview

| Property | Value |
|----------|-------|
| **Name** | MJ x Henry / Our Story |
| **Type** | Static single-page application (SPA) |
| **Purpose** | Personal romantic multimedia site with 6 sections: greetings, timeline, gallery, love jar, music, love letter + ASCII art |
| **Hosting** | Apache 2.2 (static files) — `C:\Apache2.2\htdocs\test-ascii` |
| **Live URL** | https://tree.icqr.com/s/MTBodHRwczovL2pobWhzeS5naXRodWIuaW8vb3VyLXN0b3J5Lw (from README.md) |
| **Build Step** | None — pure static files |
| **Framework** | Vanilla HTML/CSS/JS (no framework) |
| **Module Pattern** | IIFE (`(function () { 'use strict'; ... })();`) |
| **Data Source** | `data/content.json` (single source of truth) |

---

## 2. Folder Structure

```
test-ascii/
├── .clinerules/              # This documentation
├── admin/
│   └── index.html            # Admin UI for editing content.json (password-protected)
├── assets/                   # Legacy libraries (NOT used in current code)
│   ├── jquery.min.js         # jQuery 3.x (unused)
│   ├── jscex-async-powerpack.min.js
│   ├── jscex-async.min.js
│   ├── jscex-builderbase.min.js
│   ├── jscex-jit.js
│   ├── jscex-parser.js
│   └── jscex.min.js          # JSCEX async library (unused)
├── css/                      # Modular per-feature stylesheets
│   ├── ascii.css             # ASCII art viewport, controls, danger bar
│   ├── default.css           # Legacy reset (body, #wrap, #text, #code, #clock-box)
│   ├── emoji-rain.css        # Floating emoji layer (z-index 1)
│   ├── gallery.css           # Swipeable photo gallery, captions, nav arrows
│   ├── greetings.css         # Section 1: typewriter column + 3D bouquet canvas
│   ├── jar.css               # Love jar modal, note cards, shake animation
│   ├── layout.css            # **Core tokens**: --pink-*, --nav-gutter, --tree-scale, section grid
│   ├── letter.css            # Envelope animation, letter panel, fold lines
│   ├── music.css             # Music player, track cards, progress bar, volume
│   ├── sidebar.css           # Desktop floating nav + mobile bottom bar
│   └── timeline.css          # Memory timeline entries, year markers, stickers
├── data/
│   └── content.json          # **All site content** (see Section 7)
├── images/                   # 36+ JPG assets (image1.jpg … image36.jpg)
├── js/                       # One file per feature/section
│   ├── ascii-art.js          # Video → colored ASCII renderer (canvas + typed arrays)
│   ├── content.js            # Entry point: fetches JSON, injects dependent scripts
│   ├── emoji-rain.js         # Background emoji particle system
│   ├── function.js           # Legacy helper (likely unused)
│   ├── gallery.js            # Touch/swipe gallery with keyboard nav
│   ├── greetings.js          # Typewriter (Intl.Segmenter) + 3D ASCII bouquet bloom
│   ├── jar.js                # Love jar: pull random note (NSFW filter)
│   ├── letter.js             # Envelope open/close, letter content from JSON
│   ├── love.js               # Legacy (likely unused)
│   ├── music.js              # Audio preview player (iTunes API URLs), playlist
│   ├── password-gate.js      # Client-side date-based unlock (localStorage session)
│   ├── sidebar.js            # Navigation, section scroll-spy, mobile bottom bar
│   └── timeline.js           # Timeline entries + positioned emoji stickers
├── videos/                   # MP4 sources for ASCII playback
│   ├── upload-mwt10mtv-1.mp4
│   └── upload-mwt11oxq-3.mp4
├── index.html                # Main entry point (XHTML 1.0 Strict)
└── README.md                 # Deploy URL only
```
---

## 3. Tech Stack Details

### Languages & Standards
| Layer | Standard | Notes |
|-------|----------|-------|
| HTML | XHTML 1.0 Strict | `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" ...>` |
| CSS | Custom Properties (Variables) | `--pink-1`…`--pink-4`, `--nav-gutter`, `--tree-scale` |
| JavaScript | ES5 + selective ES6 | `var` throughout, `Promise`, `fetch`, `IntersectionObserver`, `ResizeObserver`, `Intl.Segmenter`, typed arrays |
| Fonts | Google Fonts | `Caveat` (handwriting) @ 500/700 |

### Browser APIs Used
- **Canvas 2D** — ASCII art rendering, 3D bouquet (`greetings.js`)
- **Video** — `HTMLVideoElement` (muted, playsinline, CORS `crossOrigin="anonymous"`)
- **Fetch** — `data/content.json` with `{ cache: 'no-cache' }`
- **IntersectionObserver** — Section visibility for play/pause, bloom trigger
- **ResizeObserver** — Canvas resize, layout recalculation
- **Touch Events** — Pinch zoom (ASCII), swipe (gallery), tap (jar)
- **Wheel Event** — Scroll zoom (ASCII viewport)
- **localStorage** — Password gate session, music volume, jar NSFW preference
- **Fullscreen API** — Not used (viewport-fit=cover for mobile notch handling)

### External Dependencies
| Resource | Purpose | Load Method |
|----------|---------|-------------|
| Google Fonts (Caveat) | Handwriting font for letter/greetings | `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` |
| iTunes Preview API | 30-sec audio clips for music section | Direct audio URLs in `content.json` |
| Image CDN (mzstatic.com) | Album cover images | Direct HTTPS URLs in `content.json` |

### Legacy / Unused
- **jQuery** (`assets/jquery.min.js`) — Not imported anywhere
- **JSCEX** (`assets/jscex-*.js`) — Async library, not imported
- **`js/function.js`**, **`js/love.js`** — No references in `index.html` or `content.js` dependents list

---

## 4. Architecture Patterns

### 4.1 Module System: IIFE + Global Namespace
```javascript
// Every JS file follows this pattern:
(function () {
    'use strict';
    // Private vars/functions
    // DOM references cached at top
    // Init at bottom (often deferred via IntersectionObserver)
})();
```
- No bundler, no `import`/`export`
- Scripts loaded **in order** by `content.js` via Promise chain
- Shared state via `window.SITE_CONTENT` (populated from JSON)

### 4.2 Data Flow
```
index.html (static shell)
    ↓ loads
js/content.js → fetch('data/content.json')
    ↓ populates
window.SITE_CONTENT = { greetings, videos, timeline, gallery, jar, letter, backgrounds, music }
    ↓ injects (sequential)
js/greetings.js → js/timeline.js → js/gallery.js → js/jar.js → js/music.js → js/letter.js → js/ascii-art.js
    ↓ each reads
window.SITE_CONTENT.<section>
    ↓ builds DOM into
<section id="..."> (pre-defined in index.html)
```

### 4.3 Script Loading (`content.js`)
---

## 5. Coding Conventions

### 5.1 JavaScript
| Convention | Example |
|------------|---------|
| **Strict mode** | `'use strict';` at top of every IIFE |
| **Variable declaration** | `var` only (ES5 compatible) |
| **Naming** | `camelCase` for vars/functions, `UPPER_SNAKE` for constants |
| **DOM caching** | `var output = document.getElementById('output');` at module top |
| **Early returns** | `if (!output || !canvas) return;` |
| **Feature detection** | `'IntersectionObserver' in window`, `window.Intl && Intl.Segmenter` |
| **Reduced motion** | `window.matchMedia('(prefers-reduced-motion: reduce)').matches` |
| **Performance** | `Float32Array`, `Uint8Array`, `Uint8ClampedArray` for per-frame data; `requestAnimationFrame` loops; `getImageData` with `willReadFrequently: true` |
| **Error handling** | `try/catch` around `getImageData` (CORS), `.catch()` on `video.play()`, `fetch` |
| **Cleanup** | `cancelAnimationFrame`, `removeEventListener`, `disconnect()` on observers |

### 5.2 CSS
| Convention | Example |
|------------|---------|
| **Custom properties** | `:root { --pink-1: #fde3ee; --nav-gutter: 84px; --tree-scale: 1; }` |
| **BEM-ish classes** | `.gr-text-col`, `.gr-typed-wrap`, `.ascii-viewport`, `.jar-modal` |
| **Mobile-first** | Base styles → `@media (max-width: 900px)` → `@media (max-width: 600px)` |
| **Safe area insets** | `env(safe-area-inset-bottom)`, `padding-bottom: var(--nav-space)` |
| **z-index layers** | 0: section bg, 1: emoji rain, 2: tree stage, 100: sidebar/modals |
| **Transitions** | `transition: transform 0.3s, opacity 0.3s;` for modals, panels |

### 5.3 HTML
- XHTML 1.0 Strict: self-closing tags (`<br />`, `<input />`), quoted attributes
- `aria-*` attributes on interactive elements
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on modals
- `hidden` attribute for initially hidden sections (`#site-content`)
- `viewport-fit=cover` + `env(safe-area-inset-*)` for notch handling

### 5.4 Accessibility
- **Keyboard**: `tabindex="0"` on ASCII viewport, focus styles
- **Screen readers**: `aria-label`, `aria-hidden="true"` on decorative canvas/emojis
- **Reduced motion**: Disables typewriter, bouquet bloom, emoji rain, auto-play
- **Color contrast**: Dark mode ASCII viewport (`#0b0610`), pink theme meets AA on large text

---

## 6. Key Modules Reference

| File | Purpose | Key Features |
|------|---------|--------------|
| **content.js** | Bootstrap | Fetches JSON, applies backgrounds, loads dependents in order |
| **password-gate.js** | Gatekeeper | Client-side date password, `localStorage` session, blocks `#site-content` |
| **sidebar.js** | Navigation | Desktop floating + mobile bottom bar, scroll-spy, smooth scroll |
| **emoji-rain.js** | Background | Canvas particle system, respects `prefers-reduced-motion` |
| **greetings.js** | Section 1 | Typewriter (grapheme-aware via `Intl.Segmenter`), 3D ASCII bouquet bloom-in (14s), continuous spin |
| **timeline.js** | Section 2 | Year-grouped entries, images, positioned emoji stickers (CSS `top/left/bottom/right`) |
| **gallery.js** | Section 3 | Touch swipe, mouse drag, keyboard arrows, caption overlay, lazy load |
| **jar.js** | Section 4 | Shake-to-pull, random note (shuffle bag), NSFW toggle (localStorage), modal |
| **music.js** | Section 5 | Playlist from JSON, 30-sec iTunes previews, cover art, progress, volume (persisted) |
| **letter.js** | Section 6 (left) | Envelope open/close animation, letter content from JSON, fold lines |
| **ascii-art.js** | Section 6 (right) | Video → colored ASCII, pixel-size slider, zoom (wheel/pinch/buttons), palette auto-levels, shuffle playlist |

### ascii-art.js — Notable Implementation Details
- **Color pipeline**: Video frame → `COLOR_SCALE`× downscaled canvas → exact box average in linear light → gamma-correct → auto-levels (2nd/98th percentile, smoothed) → per-cell color map → CSS `background-clip: text` on monospace glyphs
- **Glyph ramp**: `' .:-=+*#%@'` (10 levels), dense = bright (dark mode)
- **Zoom**: Font-size scaling (`BASE_FONT * zoom`), center-anchored scroll
- **Playlist**: Fisher-Yates shuffle bag, no immediate repeat
```javascript
var DEPENDENTS = [
    'js/greetings.js', 'js/timeline.js', 'js/gallery.js',
    'js/jar.js', 'js/music.js', 'js/letter.js', 'js/ascii-art.js'
];
// Loaded sequentially to respect DOM dependencies
DEPENDENTS.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve());
```

### 4.4 Section Structure (index.html)
Each section is an empty `<section id="...">` in HTML, populated by its JS module:
| Section ID | Module | ARIA Label |
|------------|--------|------------|
| `greetings` | `greetings.js` | "Greetings" |
| `story` | `timeline.js` | "Memory Timeline" |
| `gallery` | `gallery.js` | "Photo Booth Gallery" |
| `jar` | `jar.js` | "Love Jar" |
| `music` | `music.js` | "Music" |
| `last` | `letter.js` + `ascii-art.js` | "Love Letter and ASCII Artwork" |
---

## 7. Content Management (`data/content.json`)

### Structure Overview
```json
{
  "greetings": { "subtitle", "typingSpeed", "startDelay", "holdDelay", "messages": [{ "text" }] },
  "videos": [{ "src" }],
  "asciiMode": boolean,
  "timeline": { "title", "subtitle", "entries": [{ "year", "date", "title", "caption", "image", "alt" }], "stickers": [{ "emoji", "top/left/bottom/right", "size", "rotate" }] },
  "gallery": { "title", "subtitle", "photos": [{ "src", "caption" }] },
  "letter": { "hint", "openLabel", "closeLabel", "to", "paragraphs": [], "closing", "from" },
  "jar": { "title", "subtitle", "hint", "moreLabel", "closeLabel", "notes": [{ "text", "nsfw": boolean }] },
  "backgrounds": { "greetings", "story", "gallery", "jar", "last", "songs": "#hex" },
  "music": { "title", "songs": [{ "title", "artist", "cover", "audio" }] }
}
```

### Admin Interface (`admin/index.html`)
- Password-protected (separate from site password)
- Edits `content.json` via `fetch('/data/content.json', { method: 'PUT' })` — requires server support
- UI for all sections: text inputs, textarea, file upload for images/videos, drag-drop reorder
- Color pickers for `backgrounds`
- **Note**: PUT endpoint must be configured on Apache (WebDAV / PHP / CGI)

### Image/Video Conventions
- **Images**: `images/image{N}.jpg` (1–36), referenced by relative path
- **Videos**: `videos/{filename}.mp4`, referenced in `videos[]` array
- **Covers/Audio**: External HTTPS URLs (iTunes CDN) — no local hosting

---

## 8. Build & Deploy

### No Build Step
- Direct file editing → refresh browser
- `content.json` loaded with `cache: 'no-cache'` → edits visible on normal refresh
- Apache serves static files from `C:\Apache2.2\htdocs\test-ascii`

### Deployment Checklist
- [ ] All paths relative (no absolute `file://` or `C:\` paths)
- [ ] `data/content.json` valid JSON (no trailing commas)
- [ ] Image/video files exist at referenced paths
- [ ] Apache MIME types: `.mp4` → `video/mp4`, `.json` → `application/json`
- [ ] CORS headers for video (if hosted on different origin): `Access-Control-Allow-Origin: *`
- [ ] HTTPS required for `video.crossOrigin = 'anonymous'` + `getImageData` to work

### Local Development
```bash
# From project root
# Apache already configured to serve C:\Apache2.2\htdocs\test-ascii
# Access via http://localhost/test-ascii/ (or configured vhost)
```

---

## 9. Gotchas & Legacy Code

| Issue | Location | Impact | Resolution |
|-------|----------|--------|------------|
| XHTML 1.0 Strict doctype | `index.html:1` | Strict parsing, self-closing tags required | Keep as-is; modern browsers handle it |
| `default.css` legacy selectors | `css/default.css` | `#wrap`, `#text`, `#code`, `#clock-box` — tree animation from previous version | Used by `layout.css` `.tree-scaler` → `#wrap`; keep |
| Unused `assets/` libs | `assets/` | ~130 KB dead weight | Safe to delete if confirmed unused |
| Unused `js/function.js`, `js/love.js` | `js/` | Confusion during maintenance | Verify no dynamic `import`/`eval`; safe to archive |
| `asciiMode: false` in JSON | `content.json:21` | Shows actual `<video>` instead of ASCII | Toggle for testing; default `true` |
| Client-side password | `password-gate.js` | Security through obscurity only | Acceptable for personal use; not for sensitive data |
| iTunes preview URLs | `content.json:music.songs[].audio` | 30-sec only, may rot/expire | Monitor; replace with self-hosted if needed |
| `fetch` PUT for admin | `admin/index.html` | Requires server-side endpoint | Configure Apache `mod_dav` or PHP handler |
| `viewport-fit=cover` | `index.html:6` | Content under notch on iOS | Tested with `env(safe-area-inset-*)` in CSS |

---

## 10. Quick Reference: Adding a New Section

1. **Add `<section id="new" class="section section--custom" aria-label="..."></section>`** in `index.html` (inside `#site-content`)
2. **Create `css/new.css`** — import in `<head>`
3. **Create `js/new.js`** — IIFE pattern, read `window.SITE_CONTENT.new`
4. **Add `js/new.js` to `DEPENDENTS` in `content.js`** (correct order)
5. **Add content schema to `data/content.json`**
6. **Add nav link in `#love-nav`** (index.html)
7. **Test mobile/responsive** — `--nav-gutter`, `--nav-space`, safe-area insets

---

*Generated from codebase analysis on 2026-11-25. Update when architecture changes.*