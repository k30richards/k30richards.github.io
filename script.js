/* ==========================================================================
   script.js  -  the moving parts of the page:
     1. the Constellation background,
     2. the scroll-linked Reveal of Panels and Section headings,
     3. the Timeline line in Experience,
     4. the Active Section highlight and the progress line in the top bar.

   Everything here is an enhancement. Without it the page is complete and
   static, and with reduced motion only the top bar state is kept.
   Strength and colors come from the variables at the top of styles.css.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var theme = getComputedStyle(root);

  function themeNumber(name, fallback) {
    var n = parseFloat(theme.getPropertyValue(name));
    return isNaN(n) ? fallback : n;
  }

  // "#4d9bff" (or "#49f") -> "77, 155, 255", ready for rgba().
  function themeRgb(name, fallback) {
    var hex = theme.getPropertyValue(name).trim().replace('#', '');
    if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
    return [0, 2, 4].map(function (i) { return parseInt(hex.substr(i, 2), 16); }).join(', ');
  }

  // Page position of an element's top, ignoring transforms (the Reveal
  // moves Panels, and that must not feed back into where they "are").
  function pageTop(el) {
    var top = 0;
    for (var e = el; e; e = e.offsetParent) top += e.offsetTop;
    return top;
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  /* ------------------------------------------------------------------------
     1. Constellation
     ------------------------------------------------------------------------ */

  var canvas = document.getElementById('constellation');
  var ctx = canvas && canvas.getContext && canvas.getContext('2d');

  var LINK_DISTANCE  = 140;    // px: nodes closer than this are joined
  var POINTER_REACH  = 190;    // px: nodes this close to the pointer light up
  var AREA_PER_NODE  = 11000;  // px²: same density on every screen size
  var MAX_SPEED      = 14;     // px per second of drift

  var nodeRgb = themeRgb('--accent', '77, 155, 255');
  var litRgb = themeRgb('--accent-2', '111, 227, 255');
  var depthDrift = reduceMotion ? 0 : themeNumber('--depth-drift', 0.1);

  var nodes = [];
  var width = 0, height = 0;
  var pointer = null;          // {x, y} in viewport px, or null
  var frameId = 0, lastTime = 0;

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var wanted = Math.max(12, Math.round(width * height / AREA_PER_NODE));
    while (nodes.length < wanted) {
      var angle = Math.random() * Math.PI * 2;
      var speed = MAX_SPEED * (0.3 + Math.random() * 0.7);
      nodes.push({
        x: Math.random() * width, y: Math.random() * height,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed
      });
    }
    nodes.length = wanted;
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].x %= width;
      nodes[i].y %= height;
    }
  }

  function moveNodes(seconds) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x = (n.x + n.vx * seconds + width) % width;
      n.y = (n.y + n.vy * seconds + height) % height;
    }
  }

  function drawConstellation() {
    ctx.clearRect(0, 0, width, height);

    // Depth: the field slides up at a fraction of the scroll and wraps.
    var offset = (window.scrollY * depthDrift) % height;
    var points = new Array(nodes.length);
    for (var i = 0; i < nodes.length; i++) {
      var y = nodes[i].y - offset;
      if (y < 0) y += height;
      points[i] = { x: nodes[i].x, y: y };
    }

    // Bucket points into a grid of LINK_DISTANCE cells so each one is only
    // compared with its neighbours, not with every other node.
    var cols = Math.ceil(width / LINK_DISTANCE) + 1;
    var cells = {};
    points.forEach(function (p, idx) {
      var key = Math.floor(p.y / LINK_DISTANCE) * cols + Math.floor(p.x / LINK_DISTANCE);
      (cells[key] || (cells[key] = [])).push(idx);
    });

    ctx.lineWidth = 1;
    points.forEach(function (p, idx) {
      var cx = Math.floor(p.x / LINK_DISTANCE), cy = Math.floor(p.y / LINK_DISTANCE);
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var bucket = cells[(cy + dy) * cols + (cx + dx)];
          if (!bucket) continue;
          for (var k = 0; k < bucket.length; k++) {
            var j = bucket[k];
            if (j <= idx) continue;
            var q = points[j];
            var d = Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
            if (d >= LINK_DISTANCE) continue;
            ctx.strokeStyle = 'rgba(' + nodeRgb + ', ' + ((1 - d / LINK_DISTANCE) * 0.4).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
    });

    points.forEach(function (p) {
      var lit = false;
      if (pointer) {
        var d = Math.sqrt((p.x - pointer.x) * (p.x - pointer.x) + (p.y - pointer.y) * (p.y - pointer.y));
        if (d < POINTER_REACH) {
          lit = true;
          ctx.strokeStyle = 'rgba(' + litRgb + ', ' + ((1 - d / POINTER_REACH) * 0.7).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = lit ? 'rgba(' + litRgb + ', 1)' : 'rgba(' + nodeRgb + ', 0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, lit ? 2.6 : 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function animate(time) {
    var seconds = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
    lastTime = time;
    moveNodes(seconds);
    drawConstellation();
    frameId = requestAnimationFrame(animate);
  }

  function startAnimating() {
    if (frameId || reduceMotion) return;
    lastTime = 0;
    frameId = requestAnimationFrame(animate);
  }

  function stopAnimating() {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  if (ctx) {
    sizeCanvas();
    if (reduceMotion) {
      drawConstellation();     // one still frame
    } else {
      startAnimating();

      // The cursor on computers, a finger on phones (touch events keep
      // firing while the page scrolls under the finger; pointer events stop).
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'touch') pointer = { x: e.clientX, y: e.clientY };
      }, { passive: true });
      document.addEventListener('mouseleave', function () { pointer = null; });
      ['touchstart', 'touchmove'].forEach(function (type) {
        window.addEventListener(type, function (e) {
          var t = e.touches[0];
          if (t) pointer = { x: t.clientX, y: t.clientY };
        }, { passive: true });
      });
      ['touchend', 'touchcancel'].forEach(function (type) {
        window.addEventListener(type, function (e) {
          if (!e.touches.length) pointer = null;
        }, { passive: true });
      });

      // No drawing while the tab is hidden.
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopAnimating(); else startAnimating();
      });
    }
  }

  /* ------------------------------------------------------------------------
     2-4. Reveal, Timeline, Active Section and progress
     All driven by scroll position, measured once per layout change and
     applied at most once per frame.
     ------------------------------------------------------------------------ */

  var REVEAL_SPAN = 0.35;      // a Reveal runs over this fraction of the viewport,
  var REVEAL_DONE = 1 - REVEAL_SPAN;  // ending when the top reaches 65% of it
  var ACTIVE_LINE = 0.4;       // a Section is active once its top passes 40%

  var revealed = Array.prototype.slice.call(document.querySelectorAll('.panel, .section-title'));
  var timeline = document.querySelector('.timeline');
  var timelineRoles = timeline ? timeline.querySelectorAll('.panel') : [];
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.topbar nav a[href^="#"]'));
  var navSections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var topbar = document.querySelector('.topbar');

  var view = 0, maxScroll = 0, revealTops = [], sectionTops = [];
  var timelineStart = 0, timelineEnd = 0;
  var updateQueued = false;

  function measure() {
    view = window.innerHeight;
    maxScroll = Math.max(0, root.scrollHeight - view);
    revealTops = revealed.map(pageTop);
    sectionTops = navSections.map(function (s) { return s ? pageTop(s) : Infinity; });
    if (timelineRoles.length) {
      // The line starts drawing as the Timeline's top crosses 65% of the
      // viewport and is complete when the last role's top gets there.
      timelineStart = pageTop(timeline) - REVEAL_DONE * view;
      timelineEnd = pageTop(timelineRoles[timelineRoles.length - 1]) - REVEAL_DONE * view;
    }
  }

  // Progress between two scroll positions, with the end pulled back to the
  // bottom of the page so nothing is ever left half-done at max scroll
  // (less a pixel: the real maximum is often fractional).
  function progress(y, start, end) {
    end = Math.min(end, maxScroll - 1);
    if (end - start < 1) return y >= end ? 1 : 0;
    return clamp01((y - start) / (end - start));
  }

  // A Section jumped to from a link arrives fully revealed, even Panels still
  // low on the screen. Each one stays held until it has been on screen and
  // then scrolled back below it (or would be fully revealed anyway); from
  // then on it follows the scroll again.
  var HELD = 1, HELD_AND_SEEN = 2;
  var held = revealed.map(function () { return 0; });

  function holdSection(hash) {
    var target = hash && hash.length > 1 && document.getElementById(hash.slice(1));
    if (!target) return;
    revealed.forEach(function (el, i) { held[i] = target.contains(el) ? HELD : 0; });
    queueUpdate();
  }

  function update() {
    updateQueued = false;
    var y = window.scrollY;

    if (!reduceMotion) {
      for (var i = 0; i < revealed.length; i++) {
        // Starts with the top at the viewport's bottom edge, ends at 65%.
        var p = progress(y, revealTops[i] - view, revealTops[i] - REVEAL_DONE * view);
        if (held[i]) {
          if (p >= 1) held[i] = 0;
          else if (revealTops[i] - y < view) held[i] = HELD_AND_SEEN;
          else if (held[i] === HELD_AND_SEEN) held[i] = 0;
          if (held[i]) p = 1;
        }
        revealed[i].style.setProperty('--reveal', p.toFixed(4));
      }
      if (timelineRoles.length) {
        timeline.style.setProperty('--drawn', progress(y, timelineStart, timelineEnd).toFixed(4));
      }
    }

    var active = -1;
    if (y >= maxScroll - 1) {
      active = navLinks.length - 1;
    } else {
      for (var s = 0; s < sectionTops.length; s++) {
        if (sectionTops[s] - y <= ACTIVE_LINE * view) active = s;
      }
    }
    navLinks.forEach(function (a, idx) {
      if (idx === active) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });

    if (topbar) topbar.style.setProperty('--progress', (maxScroll > 0 ? clamp01(y / maxScroll) : 0).toFixed(4));
  }

  function queueUpdate() {
    if (updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(update);
  }

  function relayout() {
    measure();
    update();
    if (ctx && reduceMotion && (canvas.clientWidth !== width || canvas.clientHeight !== height)) {
      sizeCanvas();
      drawConstellation();
    }
  }

  measure();
  holdSection(location.hash);
  update();

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('hashchange', function () { holdSection(location.hash); });
  // A click on a link to the hash already in the address bar fires no
  // hashchange, so watch the clicks too.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (link) holdSection(link.getAttribute('href'));
  });
  window.addEventListener('resize', function () {
    if (ctx && !reduceMotion) sizeCanvas();
    relayout();
  });
  // Web fonts and late layout shifts move everything; re-measure when the
  // page's height changes.
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
  window.addEventListener('load', relayout);
}());
