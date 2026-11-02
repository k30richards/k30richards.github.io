/* ==========================================================================
   script.js  -  the moving parts of the page:
     1. the Constellation background,
     2. the scroll-linked Reveal of Panels and Section headings,
     3. the Timeline line in Experience,
     4. the Active Section highlight and the progress line in the top bar,
     5. the Section pop-ups opened from the Hero's Section buttons.

   Everything here is an enhancement. Without it the page is complete and
   static, and with reduced motion only the top bar state is kept.
   Strength and colors come from the variables at the top of styles.css.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rootStyle = getComputedStyle(root);

  function themeNumber(name, fallback) {
    var n = parseFloat(rootStyle.getPropertyValue(name));
    return isNaN(n) ? fallback : n;
  }

  // "#4d9bff" (or "#49f") -> "77, 155, 255", ready for rgba().
  function themeRgb(name, fallback) {
    var hex = rootStyle.getPropertyValue(name).trim().replace('#', '');
    if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
    return [0, 2, 4].map(function (i) { return parseInt(hex.substr(i, 2), 16); }).join(', ');
  }

  function rgba(rgb, alpha) { return 'rgba(' + rgb + ', ' + alpha.toFixed(3) + ')'; }

  // Page position of an element's top, ignoring transforms (the Reveal
  // moves Panels, and that must not feed back into where they "are").
  function pageTop(el) {
    var top = 0;
    for (var e = el; e; e = e.offsetParent) top += e.offsetTop;
    return top;
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // x wrapped into [0, size), negative x included.
  function wrap(x, size) { return ((x % size) + size) % size; }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ------------------------------------------------------------------------
     1. Constellation
     ------------------------------------------------------------------------ */

  var canvas = document.getElementById('constellation');
  var ctx = canvas && canvas.getContext && canvas.getContext('2d');

  var LINK_DISTANCE  = 140;    // px: nodes closer than this are joined
  var POINTER_REACH  = 190;    // px: nodes this close to the pointer light up
  var AREA_PER_NODE  = 11000;  // px²: same density on every screen size
  var MAX_SPEED      = 14;     // px per second of drift
  var LINE_SHADES    = 8;      // line fades are drawn in this many steps,
                               // one path per step (much cheaper on phones)

  // Touch-first screens (mostly phones) redraw at most about 30 times a
  // second. Motion is timed, so the drift looks the same everywhere.
  var FRAME_MS = window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches ? 1000 / 30 : 0;

  var nodeRgb = themeRgb('--accent', '77, 155, 255');
  var litRgb = themeRgb('--accent-2', '111, 227, 255');
  var depthDrift = reduceMotion ? 0 : themeNumber('--depth-drift', 0.1);

  // Stroke styles per fade step, from faintest to strongest.
  function shadeStyles(rgb, maxAlpha) {
    var styles = [];
    for (var s = 0; s < LINE_SHADES; s++) styles.push(rgba(rgb, (s + 0.5) / LINE_SHADES * maxAlpha));
    return styles;
  }
  var linkStyles = shadeStyles(nodeRgb, 0.4);
  var pointerStyles = shadeStyles(litRgb, 0.7);

  // The fade step for a line of length d that fades out at reach.
  function shadeOf(d, reach) {
    return Math.min(LINE_SHADES - 1, Math.floor((1 - d / reach) * LINE_SHADES));
  }

  var nodes = [];
  var width = 0, height = 0, pixelRatio = 0;
  var pointer = null;          // {x, y} in viewport px, or null
  var frameId = 0, lastTime = 0;

  // Fits the canvas to its box; returns true if it changed (which clears it).
  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    // A hidden frame or print layout can report 0; keep the last real size.
    if (!w || !h || (w === width && h === height && dpr === pixelRatio)) return false;

    // Existing nodes keep their place, scaled to the new size, so a phone's
    // toolbar sliding in or out doesn't reshuffle the field.
    if (width) {
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].x *= w / width;
        nodes[i].y *= h / height;
      }
    }
    width = w;
    height = h;
    pixelRatio = dpr;
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
    return true;
  }

  function moveNodes(seconds) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x = wrap(n.x + n.vx * seconds, width);
      n.y = wrap(n.y + n.vy * seconds, height);
    }
  }

  // segments: one flat [x1, y1, x2, y2, ...] list per fade step.
  function strokeShades(segments, styles) {
    for (var s = 0; s < LINE_SHADES; s++) {
      var seg = segments[s];
      if (!seg.length) continue;
      ctx.strokeStyle = styles[s];
      ctx.beginPath();
      for (var k = 0; k < seg.length; k += 4) {
        ctx.moveTo(seg[k], seg[k + 1]);
        ctx.lineTo(seg[k + 2], seg[k + 3]);
      }
      ctx.stroke();
    }
  }

  function fillDots(points, radius, style) {
    if (!points.length) return;
    ctx.fillStyle = style;
    ctx.beginPath();
    points.forEach(function (p) {
      ctx.moveTo(p.x + radius, p.y);
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    });
    ctx.fill();
  }

  function drawConstellation() {
    ctx.clearRect(0, 0, width, height);
    if (!nodes.length) return;

    // Depth: the field slides up at a fraction of the scroll and wraps
    // (scrollY can be negative during an iOS overscroll bounce).
    var offset = wrap(window.scrollY * depthDrift, height);
    var points = new Array(nodes.length);
    for (var i = 0; i < nodes.length; i++) {
      points[i] = { x: nodes[i].x, y: wrap(nodes[i].y - offset, height) };
    }

    // Bucket points into a grid of LINK_DISTANCE cells so each one is only
    // compared with its neighbours, not with every other node.
    var cols = Math.ceil(width / LINK_DISTANCE) + 1;
    var cells = {};
    points.forEach(function (p, idx) {
      var key = Math.floor(p.y / LINK_DISTANCE) * cols + Math.floor(p.x / LINK_DISTANCE);
      (cells[key] || (cells[key] = [])).push(idx);
    });

    var links = [], toPointer = [];
    for (var s = 0; s < LINE_SHADES; s++) { links.push([]); toPointer.push([]); }

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
            var d = dist(p, q);
            if (d < LINK_DISTANCE) links[shadeOf(d, LINK_DISTANCE)].push(p.x, p.y, q.x, q.y);
          }
        }
      }
    });

    var plain = [], lit = [];
    points.forEach(function (p) {
      var d = pointer ? dist(p, pointer) : Infinity;
      if (d < POINTER_REACH) {
        lit.push(p);
        toPointer[shadeOf(d, POINTER_REACH)].push(p.x, p.y, pointer.x, pointer.y);
      } else {
        plain.push(p);
      }
    });

    ctx.lineWidth = 1;
    strokeShades(links, linkStyles);
    strokeShades(toPointer, pointerStyles);
    fillDots(plain, 2, rgba(nodeRgb, 0.85));
    fillDots(lit, 2.6, rgba(litRgb, 1));
  }

  function animate(time) {
    frameId = requestAnimationFrame(animate);
    if (lastTime && time - lastTime < FRAME_MS * 0.9) return;
    var seconds = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
    lastTime = time;
    moveNodes(seconds);
    drawConstellation();
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
      root.addEventListener('mouseleave', function () { pointer = null; });
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

  function all(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }

  var revealTargets = all('.panel, .section-title');
  var sections = all('.hero, .section');
  var timeline = document.querySelector('.timeline');
  var timelineRoles = timeline ? timeline.querySelectorAll('.panel') : [];
  var inTimeline = revealTargets.map(function (el) { return !!timeline && timeline.contains(el); });
  var navLinks = all('.topbar nav a[href^="#"]');
  var navSections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var topbar = document.querySelector('.topbar');

  var viewHeight = 0, maxScroll = 0, revealTops = [], sectionTops = [];
  var timelineStart = 0, timelineEnd = 0;
  var updateQueued = false;

  function measure() {
    // The layout viewport's height: unlike innerHeight it stays put while a
    // phone's toolbars slide in and out, so no threshold jumps mid-scroll.
    viewHeight = root.clientHeight;
    maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
    revealTops = revealTargets.map(pageTop);
    sectionTops = navSections.map(function (s) { return s ? pageTop(s) : Infinity; });
    if (timelineRoles.length) {
      // The line starts drawing as the Timeline's top crosses 65% of the
      // viewport and is complete when the last role's top gets there.
      timelineStart = pageTop(timeline) - REVEAL_DONE * viewHeight;
      timelineEnd = pageTop(timelineRoles[timelineRoles.length - 1]) - REVEAL_DONE * viewHeight;
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

  // A Section jumped to from a link arrives fully revealed: the Panels and
  // heading whose tops will be on screen once it lands are held (the rest
  // still Reveal as they come up). Each one stays held until it has been on
  // screen and then scrolled back below it (or would be fully revealed
  // anyway); from then on it follows the scroll again. Jumps to anything
  // but a Section, like the skip link to <main>, hold nothing.
  var FREE = 0, HELD = 1, HELD_AND_SEEN = 2;
  var held = revealTargets.map(function () { return FREE; });

  function holdSection(hash) {
    var target = hash && hash.length > 1 && document.getElementById(hash.slice(1));
    if (sections.indexOf(target) < 0) return;
    var landing = pageTop(target) - (parseFloat(rootStyle.scrollPaddingTop) || 0);
    landing = Math.min(Math.max(0, landing), maxScroll);
    revealTargets.forEach(function (el, i) {
      held[i] = target.contains(el) && revealTops[i] < landing + viewHeight ? HELD : FREE;
    });
    queueUpdate();
  }

  function update() {
    updateQueued = false;
    var y = window.scrollY;

    if (!reduceMotion) {
      var roleHeld = false;
      for (var i = 0; i < revealTargets.length; i++) {
        // Starts with the top at the viewport's bottom edge, ends at 65%.
        var p = progress(y, revealTops[i] - viewHeight, revealTops[i] - REVEAL_DONE * viewHeight);
        if (held[i]) {
          if (p >= 1) held[i] = FREE;
          else if (revealTops[i] - y < viewHeight) held[i] = HELD_AND_SEEN;
          else if (held[i] === HELD_AND_SEEN) held[i] = FREE;
          if (held[i]) {
            p = 1;
            if (inTimeline[i]) roleHeld = true;
          }
        }
        revealTargets[i].style.setProperty('--reveal', p.toFixed(4));
      }
      if (timelineRoles.length) {
        // While a role is held after a jump, the line beside it is drawn too.
        var drawn = roleHeld ? 1 : progress(y, timelineStart, timelineEnd);
        timeline.style.setProperty('--drawn', drawn.toFixed(4));
      }
    }

    var active = -1;
    if (y >= maxScroll - 1) {
      active = navLinks.length - 1;
    } else {
      for (var s = 0; s < sectionTops.length; s++) {
        if (sectionTops[s] - y <= ACTIVE_LINE * viewHeight) active = s;
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

  // Also refits the canvas: the window can be resized, moved to a screen
  // with another pixel ratio, or gain a scrollbar. Resizing clears the
  // canvas, so a still (reduced-motion) frame is drawn again.
  function relayout() {
    measure();
    update();
    if (ctx && sizeCanvas() && reduceMotion) drawConstellation();
  }

  measure();
  holdSection(location.hash);
  update();

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('hashchange', function () { holdSection(location.hash); });
  // A click on a link to the hash already in the address bar fires no
  // hashchange, so watch the clicks too. A link that opened a pop-up
  // instead of jumping holds nothing.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (link && !e.defaultPrevented) holdSection(link.getAttribute('href'));
  });
  window.addEventListener('resize', relayout);
  // Web fonts and late layout shifts move everything; re-measure when the
  // page's height changes.
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
  window.addEventListener('load', relayout);

  /* ------------------------------------------------------------------------
     5. Section pop-ups
     Each Section button in the Hero opens its Section in one shared
     <dialog>, built here from the Section's own content, so everything is
     still edited in one place in index.html. Once the pop-ups are built
     the page is just the Hero (html.popups in styles.css). Without the
     script, or in a browser with no <dialog>, the buttons jump to the
     Sections of the full long page instead.
     ------------------------------------------------------------------------ */

  var WIDE_FACT = 60;          // facts longer than this (characters) span a whole row

  var uid = 0;

  function within(scope, selector) {
    return Array.prototype.slice.call(scope.querySelectorAll(selector));
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function button(className) {
    var b = el('button', className);
    b.type = 'button';
    return b;
  }

  function newId(prefix) { return prefix + '-' + (++uid); }

  function textOf(node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }

  function appendClone(parent, node) {
    if (node) parent.appendChild(node.cloneNode(true));
  }

  function labelled(text, content) {
    var box = el('div');
    box.appendChild(el('h3', 'popup-label', text));
    box.appendChild(content);
    return box;
  }

  // One tab per item, following the ARIA tabs pattern: arrow keys, Home
  // and End move between tabs, and only the selected tab is in Tab order.
  // Each item is {name, when, fill(panel)}.
  function tabbed(page, label, items) {
    if (!items.length) return;
    var list = el('div', 'popup-tabs');
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', label);
    page.appendChild(list);

    var tabs = [], panels = [];
    items.forEach(function (item) {
      var tab = button('popup-tab');
      var panel = el('div', 'popup-tabpanel');
      tab.id = newId('popup-tab');
      panel.id = newId('popup-tabpanel');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      tab.appendChild(el('span', 'popup-tab-name', item.name));
      if (item.when) tab.appendChild(el('span', 'popup-tab-when', item.when));
      item.fill(panel);

      tab.addEventListener('click', function () { select(tabs.indexOf(tab)); });
      tabs.push(tab);
      panels.push(panel);
      list.appendChild(tab);
      page.appendChild(panel);
    });

    function select(i) {
      tabs.forEach(function (t, k) {
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
        panels[k].hidden = k !== i;
      });
    }

    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      var to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (i < 0 || to === undefined) return;
      e.preventDefault();
      select(wrap(to, tabs.length));
      tabs[wrap(to, tabs.length)].focus();
    });

    select(0);
  }

  function buildAbout(section, page) {
    var bio = section.querySelector('.about-body');
    if (bio) {
      var text = el('div', 'popup-bio');
      within(bio, 'p').forEach(function (p) { appendClone(text, p); });
      page.appendChild(text);
    }

    // A long fact (like Seeking) gets a whole row instead of a narrow tile.
    var facts = el('ul', 'popup-facts');
    within(section, '.facts > div').forEach(function (row) {
      var item = el('li', 'popup-fact');
      var value = textOf(row.querySelector('dd'));
      if (value.length > WIDE_FACT) item.classList.add('popup-fact-wide');
      item.appendChild(el('span', 'popup-fact-label', textOf(row.querySelector('dt'))));
      item.appendChild(el('span', 'popup-fact-value', value));
      facts.appendChild(item);
    });
    if (facts.children.length) page.appendChild(labelled('Quick facts', facts));

    var groups = within(section, '.toolkit-group');
    if (groups.length) {
      var toolkit = el('div');
      groups.forEach(function (g) { appendClone(toolkit, g); });
      page.appendChild(labelled('Toolkit', toolkit));
    }
  }

  // Tabs carry the employer and dates; the panel has the role title,
  // the description and the skills.
  function buildExperience(section, page) {
    tabbed(page, 'Roles', within(section, '.role').map(function (role) {
      return {
        name: textOf(role.querySelector('.role-org')),
        when: textOf(role.querySelector('.role-dates')),
        fill: function (panel) {
          panel.appendChild(el('h3', 'popup-tabpanel-title', textOf(role.querySelector('.role-title'))));
          appendClone(panel, role.querySelector('.role-text'));
          appendClone(panel, role.querySelector('.tags'));
        }
      };
    }));
  }

  // Tabs carry the project title and dates; the panel has the
  // description, the skills and any Source link.
  function buildProjects(section, page) {
    tabbed(page, 'Projects', within(section, '.card').map(function (card) {
      return {
        name: textOf(card.querySelector('.card-title')),
        when: textOf(card.querySelector('.card-dates')),
        fill: function (panel) {
          appendClone(panel, card.querySelector('.card-text'));
          appendClone(panel, card.querySelector('.tags'));
          appendClone(panel, card.querySelector('.card-links'));
        }
      };
    }));
  }

  var builders = { about: buildAbout, experience: buildExperience, work: buildProjects };

  function buildPopups(links) {
    var entries = [];
    links.forEach(function (a) {
      var section = document.querySelector(a.getAttribute('href'));
      var build = section && builders[section.id];
      if (!build) return;
      var title = section.querySelector('.section-title');
      var num = textOf(title && title.querySelector('.section-num'));
      var page = el('div', 'popup-page');
      page.hidden = true;
      build(section, page);
      entries.push({
        link: a, page: page, num: num, hash: '#' + section.id,
        name: title ? textOf(title).replace(num, '').trim() : textOf(a)
      });
    });
    if (!entries.length) return;

    var dialog = el('dialog', 'popup');
    var card = el('div', 'popup-card');
    var bar = el('div', 'popup-bar');
    var heading = el('h2', 'popup-title');
    var headingNum = el('span', 'section-num');
    var headingName = el('span');
    var close = button('popup-close');
    var body = el('div', 'popup-body');
    var live = el('p', 'visually-hidden');
    var current = 0, opener = null, pressedOnDim = false;

    heading.id = 'popup-title';
    heading.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.setAttribute('aria-modal', 'true');
    live.setAttribute('aria-live', 'polite');
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    // Previous and Next step through the Sections in order. Neither wraps
    // around: the first Section has no Previous and the last has no Next.
    var steps = [
      { delta: -1, word: 'Previous', path: 'M19 12H5M11 6l-6 6 6 6' },
      { delta: 1, word: 'Next', path: 'M5 12h14M13 6l6 6-6 6' }
    ];
    steps.forEach(function (step) {
      var icon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + step.path + '"/></svg>';
      step.button = button('popup-step');
      step.name = el('span', 'popup-step-name');
      step.button.appendChild(step.name);
      step.button.insertAdjacentHTML(step.delta < 0 ? 'afterbegin' : 'beforeend', icon);
      step.button.addEventListener('click', function () {
        show(current + step.delta);
        live.textContent = entries[current].name + ', ' + (current + 1) + ' of ' + entries.length;
        // Focus stays on the arrow so it can be pressed again, unless it
        // just disappeared at either end.
        if (step.button.hidden) {
          var other = steps[step.delta < 0 ? 1 : 0].button;
          (other.hidden ? heading : other).focus();
        }
      });
    });

    heading.appendChild(headingNum);
    heading.appendChild(document.createTextNode(' '));   // reads "02 Experience"
    heading.appendChild(headingName);
    bar.appendChild(heading);
    steps.forEach(function (step) { bar.appendChild(step.button); });
    bar.appendChild(close);
    entries.forEach(function (entry) { body.appendChild(entry.page); });
    card.appendChild(bar);
    card.appendChild(body);
    dialog.appendChild(card);
    dialog.appendChild(live);
    document.body.appendChild(dialog);
    root.classList.add('popups');

    function show(i) {
      current = i;
      entries.forEach(function (entry, k) { entry.page.hidden = k !== i; });
      headingNum.textContent = entries[i].num;
      headingName.textContent = entries[i].name;
      steps.forEach(function (step) {
        var to = entries[i + step.delta];
        step.button.hidden = !to;
        if (!to) return;
        step.name.textContent = to.name;
        step.button.setAttribute('aria-label', step.word + ': ' + to.name);
      });
      body.scrollTop = 0;
    }

    function open(i, from) {
      opener = from;
      live.textContent = '';
      show(i);
      root.classList.add('popup-open');
      dialog.showModal();
      heading.focus();
    }

    close.addEventListener('click', function () { dialog.close(); });

    // Esc fires "cancel" and closes the dialog natively; every way of
    // closing ends here.
    dialog.addEventListener('close', function () {
      root.classList.remove('popup-open');
      if (opener) opener.focus();
    });

    // A click on the dimmed page around the card closes it, but not the
    // end of a text selection dragged out of the card.
    dialog.addEventListener('pointerdown', function (e) { pressedOnDim = e.target === dialog; });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog && pressedOnDim) dialog.close();
    });

    // Tab and Shift+Tab cycle inside the dialog and never reach the
    // browser's own toolbar.
    dialog.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var stops = within(dialog, 'a[href], button, [tabindex]').filter(function (n) {
        return n.tabIndex >= 0 && !n.disabled && n.getClientRects().length;
      });
      if (!stops.length) return;
      var first = stops[0], last = stops[stops.length - 1], at = document.activeElement;
      if (e.shiftKey && (at === first || stops.indexOf(at) < 0)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    });

    entries.forEach(function (entry, i) {
      entry.link.setAttribute('aria-haspopup', 'dialog');
      entry.link.addEventListener('click', function (e) {
        // Ctrl/Cmd/Shift-click and middle-click keep their usual meaning.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(i, entry.link);
      });
    });

    // A shared link like ".../#experience" opens that Section's pop-up.
    entries.forEach(function (entry, i) {
      if (location.hash === entry.hash) open(i, entry.link);
    });
  }

  if (window.HTMLDialogElement && typeof HTMLDialogElement.prototype.showModal === 'function') {
    buildPopups(all('.hero-sections a[href^="#"]'));
  }
}());
