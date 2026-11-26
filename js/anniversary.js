(function () {
    'use strict';

    // ==========================================================================
    // CONFIGURATION - Change this date to your first anniversary
    // ==========================================================================
    var ANNIVERSARY_DATE = new Date('2023-02-20T00:00:00'); // Year, Month (0-indexed), Day

    // ==========================================================================
    // DOM & STATE
    // ==========================================================================
    var clockEl = document.getElementById('anniversary-clock');
    if (!clockEl) return;

    var cards = {};           // Map unit -> { topEl, bottomEl, labelEl, lastValue }
    var rafId = null;
    var prefersReducedMotion = false;

    // Unit definitions: [key, label, maxValue(for rollover logic)]
    var UNITS = [
        { key: 'years', label: 'Years' },
        { key: 'months', label: 'Months', max: 12 },
        { key: 'days', label: 'Days', max: 31 }, // approximate
        { key: 'hours', label: 'Hours', max: 24 },
        { key: 'minutes', label: 'Minutes', max: 60 },
        { key: 'seconds', label: 'Seconds', max: 60 }
    ];

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================
    function init() {
        // Check reduced motion preference
        prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Listen for theme changes to update colors (handled by CSS, but good to know)
        if (window.matchMedia) {
            var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (mq.addEventListener) {
                mq.addEventListener('change', onReducedMotionChange);
            } else if (mq.addListener) {
                mq.addListener(onReducedMotionChange);
            }
        }

        // Build the clock DOM
        buildClock();

        // Initial render
        tick();

        // Start the animation loop
        rafId = requestAnimationFrame(loop);
    }

    function onReducedMotionChange(e) {
        prefersReducedMotion = e.matches;
    }

    // ==========================================================================
    // BUILD CLOCK DOM
    // ==========================================================================
    function buildClock() {
        var frag = document.createDocumentFragment();

        UNITS.forEach(function (unit, index) {
            var card = createCard(unit.key, unit.label);
            cards[unit.key] = card;
            frag.appendChild(card.wrapper);

            // Add separator after years, months, days (not after seconds)
            if (index < UNITS.length - 1) {
                var sep = createSeparator();
                frag.appendChild(sep);
            }
        });

        clockEl.appendChild(frag);
    }

    function createCard(key, label) {
        var wrapper = document.createElement('div');
        wrapper.className = 'ac-card';
        wrapper.setAttribute('data-unit', key);

        var flipper = document.createElement('div');
        flipper.className = 'ac-flipper';

        var topHalf = document.createElement('div');
        topHalf.className = 'ac-half ac-half--top';
        topHalf.setAttribute('aria-hidden', 'true');
        topHalf.textContent = '00';

        var bottomHalf = document.createElement('div');
        bottomHalf.className = 'ac-half ac-half--bottom';
        bottomHalf.setAttribute('aria-hidden', 'true');
        bottomHalf.textContent = '00';

        flipper.appendChild(topHalf);
        flipper.appendChild(bottomHalf);

        var labelEl = document.createElement('div');
        labelEl.className = 'ac-label';
        labelEl.textContent = label;

        wrapper.appendChild(flipper);
        wrapper.appendChild(labelEl);

        return {
            wrapper: wrapper,
            flipper: flipper,
            topEl: topHalf,
            bottomEl: bottomHalf,
            labelEl: labelEl,
            lastValue: -1
        };
    }

    function createSeparator() {
        var sep = document.createElement('div');
        sep.className = 'ac-separator';
        sep.setAttribute('aria-hidden', 'true');
        sep.innerHTML =
            '<span class="ac-separator__dot"></span>' +
            '<span class="ac-separator__dot"></span>';
        return sep;
    }
// ==========================================================================
// TIME CALCULATION
// ==========================================================================
function getTimeSinceAnniversary() {
    var now = new Date();
    var diff = now - ANNIVERSARY_DATE;

    if (diff < 0) {
        // Anniversary hasn't happened yet
        return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    var years = 0;
    var months = 0;
    var days = 0;
    var hours = 0;
    var minutes = 0;
    var seconds = 0;

    // Calculate years
    var tempDate = new Date(ANNIVERSARY_DATE);
    while (tempDate <= now) {
        tempDate.setFullYear(tempDate.getFullYear() + 1);
        if (tempDate <= now) years++;
    }

    // Calculate months
    tempDate = new Date(ANNIVERSARY_DATE);
    tempDate.setFullYear(tempDate.getFullYear() + years);
    while (tempDate <= now) {
        tempDate.setMonth(tempDate.getMonth() + 1);
        if (tempDate <= now) months++;
    }

    // Calculate days
    tempDate = new Date(ANNIVERSARY_DATE);
    tempDate.setFullYear(tempDate.getFullYear() + years);
    tempDate.setMonth(tempDate.getMonth() + months);
    while (tempDate <= now) {
        tempDate.setDate(tempDate.getDate() + 1);
        if (tempDate <= now) days++;
    }

    // Remaining time in milliseconds
    var remainingMs = now - tempDate;
    hours = Math.floor(remainingMs / (1000 * 60 * 60));
    remainingMs -= hours * 1000 * 60 * 60;
    minutes = Math.floor(remainingMs / (1000 * 60));
    remainingMs -= minutes * 1000 * 60;
    seconds = Math.floor(remainingMs / 1000);

    return { years: years, months: months, days: days, hours: hours, minutes: minutes, seconds: seconds };
}

// ==========================================================================
// RENDER / TICK
// ==========================================================================
function tick() {
    var time = getTimeSinceAnniversary();

    UNITS.forEach(function (unit) {
        var card = cards[unit.key];
        var value = time[unit.key];
        var padded = String(value).padStart(2, '0');

        if (value !== card.lastValue) {
            updateCard(card, padded);
            card.lastValue = value;
        }
    });
}

function updateCard(card, newValue) {
    // Update bottom half immediately (it's the "next" value)
    card.bottomEl.textContent = newValue;

    if (prefersReducedMotion) {
        // No animation: just swap
        card.topEl.textContent = newValue;
        return;
    }

    // Trigger flip animation
    card.wrapper.classList.add('is-flipping');

    // After animation completes, update top half and clean up
    setTimeout(function () {
        card.topEl.textContent = newValue;
        card.wrapper.classList.remove('is-flipping');
    }, 400); // Match animation duration
}

// ==========================================================================
// ANIMATION LOOP
// ==========================================================================
function loop() {
    tick();
    rafId = requestAnimationFrame(loop);
}

// ==========================================================================
// CLEANUP (not strictly needed for a permanent clock, but good practice)
// ==========================================================================
function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq.removeEventListener) {
            mq.removeEventListener('change', onReducedMotionChange);
        } else if (mq.removeListener) {
            mq.removeListener(onReducedMotionChange);
        }
    }
}

// Expose for potential cleanup (unlikely needed)
window.__anniversaryClockDestroy = destroy;

// ==========================================================================
// START
// ==========================================================================
// Wait for DOM to be ready (content.js loads scripts after DOMContentLoaded)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
})();