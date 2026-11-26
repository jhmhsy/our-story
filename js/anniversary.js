(function () {
    'use strict';

    // ==========================================================================
    // CONFIGURATION - Change this date to your first anniversary
    // ==========================================================================
    var ANNIVERSARY_DATE = new Date('2023-02-20T00:00:00');
    var FLIP_MS = 600; // must equal 2 x --ac-flip-half in anniversary.css

    // ==========================================================================
    // DOM & STATE
    // ==========================================================================
    var clockEl = document.getElementById('anniversary-clock');
    if (!clockEl) return;

    var digitElements = {};
    var rafId = null;
    var prefersReducedMotion = false;
    var lastSecond = -1;

    var UNITS = [
        { key: 'years', label: 'Years' },
        { key: 'months', label: 'Months', max: 12 },
        { key: 'days', label: 'Days', max: 31 },
        { key: 'hours', label: 'Hours', max: 24 },
        { key: 'minutes', label: 'Minutes', max: 60 },
        { key: 'seconds', label: 'Seconds', max: 60 }
    ];

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================
    function init() {
        prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (window.matchMedia) {
            var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (mq.addEventListener) {
                mq.addEventListener('change', onReducedMotionChange);
            } else if (mq.addListener) {
                mq.addListener(onReducedMotionChange);
            }
        }

        buildClock();
        tick();
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
            var digit = createDigit(unit.key, unit.label);
            digitElements[unit.key] = digit;
            frag.appendChild(digit.wrapper);

            if (index < UNITS.length - 1) {
                frag.appendChild(createSeparator());
            }
        });

        clockEl.appendChild(frag);
    }

    function createHalf(position, flap) {
        var half = document.createElement('div');
        half.className = 'ac-half ac-half--' + position + (flap ? ' ac-flap ac-flap--' + position : '');
        half.setAttribute('aria-hidden', 'true');
        var span = document.createElement('span');
        span.textContent = '00';
        half.appendChild(span);
        return { el: half, span: span };
    }

    function createDigit(key, label) {
        var wrapper = document.createElement('div');
        wrapper.className = 'ac-digit';
        wrapper.setAttribute('data-unit', key);

        var card = document.createElement('div');
        card.className = 'ac-card';

        // Order matters: flaps come after the static halves so they paint on top
        var staticTop = createHalf('top', false);
        var staticBottom = createHalf('bottom', false);
        var flapTop = createHalf('top', true);
        var flapBottom = createHalf('bottom', true);

        card.appendChild(staticTop.el);
        card.appendChild(staticBottom.el);
        card.appendChild(flapTop.el);
        card.appendChild(flapBottom.el);

        var labelEl = document.createElement('div');
        labelEl.className = 'ac-label';
        labelEl.textContent = label;

        wrapper.appendChild(card);
        wrapper.appendChild(labelEl);

        return {
            wrapper: wrapper,
            card: card,
            staticTop: staticTop.span,
            staticBottom: staticBottom.span,
            flapTop: flapTop.span,
            flapBottom: flapBottom.span,
            lastValue: -1,
            shown: '00',
            timer: 0
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
            return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
        }

        var years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 0;
        var tempDate = new Date(ANNIVERSARY_DATE);

        while (tempDate <= now) {
            tempDate.setFullYear(tempDate.getFullYear() + 1);
            if (tempDate <= now) years++;
        }

        tempDate = new Date(ANNIVERSARY_DATE);
        tempDate.setFullYear(tempDate.getFullYear() + years);
        while (tempDate <= now) {
            tempDate.setMonth(tempDate.getMonth() + 1);
            if (tempDate <= now) months++;
        }

        tempDate = new Date(ANNIVERSARY_DATE);
        tempDate.setFullYear(tempDate.getFullYear() + years);
        tempDate.setMonth(tempDate.getMonth() + months);
        while (true) {
            var nextDay = new Date(tempDate);
            nextDay.setDate(nextDay.getDate() + 1);
            if (nextDay > now) break;
            tempDate = nextDay;
            days++;
        }

        var remainingMs = now - tempDate;
        hours = Math.floor(remainingMs / 3600000);
        remainingMs -= hours * 3600000;
        minutes = Math.floor(remainingMs / 60000);
        remainingMs -= minutes * 60000;
        seconds = Math.floor(remainingMs / 1000);

        return { years: years, months: months, days: days, hours: hours, minutes: minutes, seconds: seconds };
    }

    // ==========================================================================
    // RENDER / TICK
    // ==========================================================================
    function tick() {
        var time = getTimeSinceAnniversary();
        var currentSecond = time.seconds;

        if (currentSecond === lastSecond) return;
        lastSecond = currentSecond;

        UNITS.forEach(function (unit) {
            var digit = digitElements[unit.key];
            var value = time[unit.key];
            if (value === digit.lastValue) return;

            var padded = String(value).padStart(2, '0');
            var first = digit.lastValue === -1;
            digit.lastValue = value;

            if (first) setStatic(digit, padded);   // first render: no animation
            else updateDigit(digit, padded);
        });
    }

    function setStatic(digit, value) {
        digit.staticTop.textContent = value;
        digit.staticBottom.textContent = value;
        digit.flapTop.textContent = value;
        digit.flapBottom.textContent = value;
        digit.shown = value;
    }

    function updateDigit(digit, newValue) {
        // Finish any flip still in progress so the old value is correct
        clearTimeout(digit.timer);
        digit.card.classList.remove('is-flipping');

        if (prefersReducedMotion) {
            setStatic(digit, newValue);
            return;
        }

        var oldValue = digit.shown;
        digit.staticTop.textContent = newValue;      // revealed as the top flap falls away
        digit.staticBottom.textContent = oldValue;   // stays until the bottom flap lands
        digit.flapTop.textContent = oldValue;
        digit.flapBottom.textContent = newValue;

        void digit.card.offsetWidth;                 // restart the CSS animation
        digit.card.classList.add('is-flipping');

        digit.timer = setTimeout(function () {
            digit.staticBottom.textContent = newValue;
            digit.card.classList.remove('is-flipping');
            digit.shown = newValue;
        }, FLIP_MS);
        digit.shown = newValue;
    }

    // ==========================================================================
    // ANIMATION LOOP
    // ==========================================================================
    function loop() {
        tick();
        rafId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // CLEANUP
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

    window.__anniversaryClockDestroy = destroy;

    // ==========================================================================
    // START
    // ==========================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();