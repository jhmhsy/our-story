(function () {
    'use strict';

    var CONTENT_URL = 'data/content.json';
    var DEPENDENTS = ['js/greetings.js', 'js/timeline.js', 'js/gallery.js', 'js/jar.js', 'js/music.js', 'js/letter.js', 'js/ascii-art.js'];
    var SECTION_IDS = ['greetings', 'story', 'gallery', 'jar', 'music', 'last'];

    // WCAG Contrast thresholds
    var CONTRAST_BODY = 4.5;   // 4.5:1 for body text
    var CONTRAST_LARGE = 3.0;  // 3:1 for large text (18pt+ or 14pt+ bold)

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.charset = 'utf-8';
            s.async = false;
            s.onload = resolve;
            s.onerror = function () { reject(new Error('Could not load ' + src)); };
            document.body.appendChild(s);
        });
    }

    /* Parse hex color to RGB */
    function parseHex(hex) {
        var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
        if (!m) return null;
        return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
    }

    /* Calculate relative luminance (sRGB) */
    function luminance(rgb) {
        var rsrgb = rgb.r / 255, gsrgb = rgb.g / 255, bsrgb = rgb.b / 255;
        var r = rsrgb <= 0.03928 ? rsrgb / 12.92 : Math.pow((rsrgb + 0.055) / 1.055, 2.4);
        var g = gsrgb <= 0.03928 ? gsrgb / 12.92 : Math.pow((gsrgb + 0.055) / 1.055, 2.4);
        var b = bsrgb <= 0.03928 ? bsrgb / 12.92 : Math.pow((bsrgb + 0.055) / 1.055, 2.4);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /* Calculate contrast ratio between two colors */
    function contrastRatio(rgb1, rgb2) {
        var l1 = luminance(rgb1), l2 = luminance(rgb2);
        var lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    /* Extract gradient stop colors (first and last hex) */
    function extractGradientStops(gradient) {
        var stops = [];
        var hexMatches = gradient.match(/#[0-9a-f]{6}/gi);
        if (hexMatches && hexMatches.length >= 2) {
            stops.push(parseHex(hexMatches[0]));
            stops.push(parseHex(hexMatches[hexMatches.length - 1]));
        }
        return stops;
    }

    /* Validate contrast for a section's background/text pair */
    function validateSectionContrast(sectionId, bgValue, textColor, mutedColor, isDark) {
        var errors = [];
        var warnings = [];

        var bgStops = [];
        if (/^linear-gradient|^radial-gradient|^conic-gradient/i.test(bgValue.trim())) {
            bgStops = extractGradientStops(bgValue);
        } else if (/^#[0-9a-f]{6}$/i.test(bgValue)) {
            var solid = parseHex(bgValue);
            if (solid) bgStops = [solid, solid];
        }

        if (bgStops.length < 2) {
            warnings.push('[' + sectionId + '] Could not extract gradient stops for contrast check');
            return { errors: errors, warnings: warnings };
        }

        var textRgb = parseHex(textColor);
        var mutedRgb = parseHex(mutedColor);

        if (!textRgb || !mutedRgb) {
            errors.push('[' + sectionId + '] Invalid text/muted color format');
            return { errors: errors, warnings: warnings };
        }

        var lightestBg = luminance(bgStops[0]) > luminance(bgStops[1]) ? bgStops[0] : bgStops[1];
        var darkestBg = luminance(bgStops[0]) < luminance(bgStops[1]) ? bgStops[0] : bgStops[1];

        var textContrastLight = contrastRatio(textRgb, lightestBg);
        var textContrastDark = contrastRatio(textRgb, darkestBg);
        var minTextContrast = Math.min(textContrastLight, textContrastDark);

        var mutedContrastLight = contrastRatio(mutedRgb, lightestBg);
        var mutedContrastDark = contrastRatio(mutedRgb, darkestBg);
        var minMutedContrast = Math.min(mutedContrastLight, mutedContrastDark);

        var themeLabel = isDark ? 'DARK' : 'LIGHT';

        if (minTextContrast < CONTRAST_BODY) {
            errors.push('[' + themeLabel + '][' + sectionId + '] Body text contrast ' + minTextContrast.toFixed(2) + ':1 FAILS WCAG AA (need 4.5:1). Lightest: ' + textContrastLight.toFixed(2) + ':1, Darkest: ' + textContrastDark.toFixed(2) + ':1');
        }

        if (minMutedContrast < CONTRAST_LARGE) {
            warnings.push('[' + themeLabel + '][' + sectionId + '] Muted text contrast ' + minMutedContrast.toFixed(2) + ':1 below large-text threshold (3:1). Lightest: ' + mutedContrastLight.toFixed(2) + ':1, Darkest: ' + mutedContrastDark.toFixed(2) + ':1');
        }

        if (minMutedContrast < CONTRAST_BODY) {
            warnings.push('[' + themeLabel + '][' + sectionId + '] Muted text contrast ' + minMutedContrast.toFixed(2) + ':1 below body threshold (4.5:1)');
        }

        return { errors: errors, warnings: warnings };
    }

    /* Apply backgrounds and text colors from content.json (new schema with bg/text/muted) */
    function applyBackgrounds(bg, darkBg) {
        if (!bg) return;

        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var allErrors = [];
        var allWarnings = [];

        SECTION_IDS.forEach(function (id) {
            var node = document.getElementById(id);
            if (!node) return;

            // Skip greetings - it has fixed background in CSS
            if (id === 'greetings') return;

            var lightSection = bg[id];
            var darkSection = darkBg && darkBg[id];

            var sectionData = null;
            if (isDark && darkSection) {
                sectionData = darkSection;
            } else if (lightSection) {
                sectionData = lightSection;
            } else if (isDark && !darkSection) {
                // Fallback to global dark palette
                var html = document.documentElement;
                var computedStyle = getComputedStyle(html);
                var fallbackBg = computedStyle.getPropertyValue('--grad-' + id).trim();
                if (fallbackBg) {
                    sectionData = {
                        bg: fallbackBg,
                        text: computedStyle.getPropertyValue('--text-primary').trim() || '#f5e6f0',
                        muted: computedStyle.getPropertyValue('--text-secondary').trim() || '#d4b8c8'
                    };
                }
            }

            if (!sectionData || !sectionData.bg) return;

            var val = sectionData.bg;
            var textColor = sectionData.text;
            var mutedColor = sectionData.muted;

            // Validate contrast
            var validation = validateSectionContrast(id, val, textColor, mutedColor, isDark);
            allErrors.push.apply(allErrors, validation.errors);
            allWarnings.push.apply(allWarnings, validation.warnings);

            // Apply background via CSS custom property (so it responds to theme changes)
            // Use --section-bg which the CSS will reference with fallback to --grad-{id}
            if (/^linear-gradient|^radial-gradient|^conic-gradient/i.test(val.trim())) {
                node.style.setProperty('--section-bg', val);
            } else if (/^#[0-9a-f]{6}$/i.test(val)) {
                node.style.setProperty('--section-bg', val);
            }

            // Apply text colors via CSS custom properties for the section
            if (textColor) {
                node.style.setProperty('--section-text', textColor);
                node.style.setProperty('--section-text-muted', mutedColor || textColor);
            }
        });

        // The strip behind the mobile bottom nav matches the last section
        var last = document.getElementById('last');
        var site = document.getElementById('site-content');
        if (last && site) {
            var lastBg = last.style.getPropertyValue('--section-bg');
            if (lastBg) site.style.setProperty('--section-bg', lastBg);
        }
        if (typeof window.__syncTreeBackground === 'function') window.__syncTreeBackground();

        // Report validation results
        if (allErrors.length > 0) {
            console.error('[CONTRAST VALIDATION] FAILED - The following contrast requirements are not met:');
            allErrors.forEach(function (e) { console.error(e); });
            throw new Error('Contrast validation failed: ' + allErrors.length + ' errors. See console for details.');
        }
        if (allWarnings.length > 0) {
            console.warn('[CONTRAST VALIDATION] Warnings:');
            allWarnings.forEach(function (w) { console.warn(w); });
        } else {
            console.log('[CONTRAST VALIDATION] All sections pass WCAG AA contrast requirements.');
        }
    }

    fetch(CONTENT_URL, { cache: 'no-cache' })
        .then(function (res) {
            if (!res.ok) throw new Error(CONTENT_URL + ' returned HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            window.SITE_CONTENT = data;
            applyBackgrounds(data.backgrounds, data['dark-backgrounds']);
            return DEPENDENTS.reduce(function (chain, src) {
                return chain.then(function () { return loadScript(src); });
            }, Promise.resolve());
        })
        .catch(function (err) {
            console.error('[content] Failed to load site content:', err);
        });
})();