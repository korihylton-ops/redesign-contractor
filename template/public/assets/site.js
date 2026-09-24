(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var M = window.Motion; // CDN. Everything below tolerates it being absent: content is visible by default.
  var canAnimate = !!(M && M.animate && !reduced);

  var sid;
  try { sid = sessionStorage.getItem('cx_sid'); if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('cx_sid', sid); } } catch (e) { sid = 'anon'; }

  function beacon(url, obj) {
    var body = JSON.stringify(obj);
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      else fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) { /* tracking must never break the page */ }
  }

  /* Conversion tracking: any call, text or quote button reports where it was clicked. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"], [data-track]');
    if (!a) return;
    var type = a.getAttribute('data-track') || (/^tel:/i.test(a.getAttribute('href') || '') ? 'call' : 'text');
    var src = a.getAttribute('data-src') || (a.closest('.chat') ? 'chat' : a.closest('.foot') ? 'footer' : a.closest('.head') ? 'header' : 'page');
    beacon('/api/convert', { type: type, source: src, sid: sid, page: location.pathname });
  }, true);

  /* Call and text buttons on a desktop. tel:/sms: dial straight away on a phone, but on a computer
     with no phone app the click does nothing visible, which looks like a dead button. So on devices
     without a touch screen we also show the number in a small panel with a copy button. The link
     still fires, so a desktop with a calling app (Phone Link, Skype, FaceTime) opens it as normal. */
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var toast;
  function showNumber(kind, number) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'num-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('data-num-toast', '');
      toast.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483000;background:var(--ink,#0f1f38);color:#fff;padding:14px 16px 14px 20px;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.28);display:flex;gap:14px;align-items:center;font:500 15px/1.35 var(--font-body,system-ui,sans-serif);max-width:calc(100vw - 32px)';
      document.body.appendChild(toast);
    }
    toast.innerHTML = '';
    var msg = document.createElement('span');
    msg.textContent = (kind === 'text' ? 'Text us on ' : 'Call us on ') + number;
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy number';
    copy.style.cssText = 'border:0;border-radius:10px;padding:9px 14px;background:#fff;color:var(--ink,#0f1f38);font:600 14px var(--font-body,system-ui,sans-serif);cursor:pointer';
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = 'Copied'; };
      try { navigator.clipboard.writeText(number).then(done, done); } catch (e) { done(); }
    });
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.style.cssText = 'border:0;background:transparent;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 4px';
    close.addEventListener('click', function () { toast.hidden = true; });
    toast.appendChild(msg); toast.appendChild(copy); toast.appendChild(close);
    toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.hidden = true; }, 12000);
  }
  document.addEventListener('click', function (e) {
    if (coarse) return;
    var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]');
    if (!a) return;
    var sms = /^sms:/i.test(a.getAttribute('href'));
    var chat = document.getElementById('chat');
    var shown = (a.textContent.match(/[+()0-9][0-9 ()+-]{6,}/) || [])[0];
    var fromHref = a.getAttribute('href').replace(/^(tel|sms):/i, '').split('?')[0];
    // A text number can differ from the main line, so texts always use the number in the link.
    var number = (sms ? ((chat && chat.getAttribute('data-text')) || fromHref) : (shown || (chat && chat.getAttribute('data-phone')) || fromHref)).trim();
    showNumber(sms ? 'text' : 'call', number);
  });

  /* In-page links (#quote, /#pricing). Lazy images and reveal animations grow the page while a
     smooth scroll is in flight, so the browser lands where the target used to be, often thousands
     of pixels short on a fresh load, and can sit there. Waiting for the scroll to "settle" is not
     reliable (it can pause mid-way while images load), so re-check the target on a fixed schedule
     for about five seconds and re-aim whenever it has drifted. Any scrolling by the visitor
     (wheel, touch, keys) cancels the correction immediately. */
  var aimRun = 0;
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { aimRun++; }, { passive: true }); });
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a) return;
    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash.length < 2) return;
    var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    try { history.pushState(null, '', url.hash); } catch (err) { /* ignore */ }
    var run = ++aimRun;
    target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    // Every 150ms for 5s, work out where the target is now. If it has moved since the scroll was aimed,
    // re-aim immediately (mid-flight, so the glide never heads for a stale spot); if the scroll has
    // stopped short, finish it. 'instant' is explicit because 'auto' defers to the stylesheet's
    // scroll-behavior: smooth and would glide again.
    var dest = function () { return window.scrollY + target.getBoundingClientRect().top - (parseFloat(getComputedStyle(target).scrollMarginTop) || 0); };
    var aimed = dest(), lastY = window.scrollY, elapsed = 0;
    var tick = setInterval(function () {
      elapsed += 150;
      if (run !== aimRun || elapsed > 5000) { clearInterval(tick); return; } // the visitor took over
      var y = window.scrollY, moving = Math.abs(y - lastY) > 1, now = dest();
      lastY = y;
      var maxY = document.documentElement.scrollHeight - window.innerHeight;
      var goal = Math.min(now, maxY);
      if (Math.abs(goal - y) <= 24) return; // arrived
      if (Math.abs(now - aimed) > 24) { aimed = now; target.scrollIntoView({ behavior: reduced || elapsed > 1200 ? 'instant' : 'smooth', block: 'start' }); return; }
      if (!moving) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, 150);
  });

  /* Page-view tracking for the admin Traffic tab */
  beacon('/api/track', { path: location.pathname, ref: document.referrer || '', sid: sid });

  /* Mobile nav */
  var toggle = $('.head__toggle'), nav = $('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* Sticky header shrink */
  var head = $('.head');
  if (head) {
    var onScroll = function () { head.classList.toggle('is-scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* Motion helpers */
  function onView(target, fn, amount) {
    var els = typeof target === 'string' ? $$(target) : [target];
    if (!els.length) return;
    if (M && M.inView) {
      els.forEach(function (el) { M.inView(el, function (a) { var node = a && a.target ? a.target : a; fn(node); }, { amount: amount || 0.25 }); });
    } else els.forEach(fn);
  }

  if (canAnimate) {
    /* Scroll progress bar */
    var bar = $('.progress i');
    if (bar && M.scroll) M.scroll(M.animate(bar, { scaleX: [0, 1] }, { ease: 'linear' }));

    /* Section headings: words rise into place as they enter the viewport */
    $$('[data-split]').forEach(function (h) {
      var words = h.textContent.trim().split(/\s+/);
      h.setAttribute('aria-label', h.textContent.trim());
      h.replaceChildren();
      words.forEach(function (w, i) {
        var span = document.createElement('span'); span.className = 'w'; span.setAttribute('aria-hidden', 'true');
        var inner = document.createElement('i'); inner.textContent = w; span.appendChild(inner);
        h.appendChild(span); if (i < words.length - 1) h.appendChild(document.createTextNode(' '));
      });
      h.classList.add('split-ready');
      onView(h, function (node) {
        M.animate($$('.w > i', node), { y: ['105%', '0%'] }, { duration: 0.7, delay: M.stagger ? M.stagger(0.045) : 0, ease: [0.2, 0.7, 0.2, 1] });
      }, 0.6);
      setTimeout(function () { $$('.w > i', h).forEach(function (i) { i.style.transform = 'none'; }); }, 9000); // fail-safe
    });

    /* Bento tiles: staggered entrance */
    $$('[data-stagger]').forEach(function (grid) {
      var kids = Array.prototype.slice.call(grid.children);
      kids.forEach(function (k) { k.style.opacity = '0'; });
      onView(grid, function () { M.animate(kids, { opacity: [0, 1], y: [28, 0] }, { duration: 0.6, delay: M.stagger ? M.stagger(0.07) : 0, ease: [0.2, 0.7, 0.2, 1] }); }, 0.15);
      setTimeout(function () { kids.forEach(function (k) { k.style.opacity = ''; }); }, 9000);
    });

    /* Stat counters */
    $$('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count')), dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var fmt = function (v) { return Number(v).toLocaleString('en-AU', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
      el.textContent = fmt(0);
      onView(el, function () { M.animate(0, target, { duration: 1.8, ease: [0.16, 1, 0.3, 1], onUpdate: function (v) { el.textContent = fmt(v); } }); }, 0.6);
      setTimeout(function () { el.textContent = fmt(target); }, 9000);
    });

    /* Hero photo parallax and the scroll-expanding media band */
    var photo = $('[data-parallax] img');
    if (photo && M.scroll) M.scroll(M.animate(photo, { y: ['-6%', '6%'], scale: [1.08, 1.08] }, { ease: 'linear' }), { target: photo.parentElement, offset: ['start end', 'end start'] });
    var frame = $('[data-expand]');
    if (frame && M.scroll) {
      M.scroll(M.animate(frame, { scale: [0.86, 1], borderRadius: ['40px', '28px'] }, { ease: 'linear' }), { target: frame, offset: ['start end', 'center center'] });
    }

    /* Timeline rail draws as the section scrolls */
    var rail = $('.steps__rail i');
    if (rail && M.scroll) M.scroll(M.animate(rail, { scaleY: [0, 1] }, { ease: 'linear' }), { target: $('.steps'), offset: ['start 75%', 'end 60%'] });

    /* Magnetic call-to-action buttons */
    if (finePointer) {
      $$('.hero__cta .btn, .head__call').forEach(function (b) {
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          M.animate(b, { x: (e.clientX - r.left - r.width / 2) * 0.18, y: (e.clientY - r.top - r.height / 2) * 0.28 }, { duration: 0.2 });
        });
        b.addEventListener('pointerleave', function () { M.animate(b, { x: 0, y: 0 }, { type: 'spring', stiffness: 300, damping: 18 }); });
      });
    }

    /* FAQ answers ease open */
    $$('.faq details').forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open) M.animate($('.faq__a', d), { opacity: [0, 1], y: [-8, 0] }, { duration: 0.28, ease: 'easeOut' }); });
    });
  } else {
    $$('.tcard[aria-hidden="true"]').forEach(function (c) { c.hidden = true; });
  }

  /* Spotlight cards follow the pointer (pure CSS variables, no library needed) */
  if (finePointer) {
    $$('.spot').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* Hero load-in: the conductor line runs down the trust list and each licence energises. */
  var trace = $('.trace');
  if (trace && canAnimate) {
    var items = $$('li', trace), line = $('.trace__line');
    var lines = $$('.hero h1 span');
    lines.forEach(function (l) { l.style.opacity = '0'; });
    if (line) line.style.transform = 'scaleY(0)';
    items.forEach(function (li) { li.style.opacity = '0.35'; });
    M.animate(lines, { opacity: [0, 1], y: [18, 0] }, { duration: 0.6, delay: M.stagger ? M.stagger(0.12) : 0, ease: 'easeOut' });
    setTimeout(function () {
      lines.forEach(function (l) { l.style.opacity = ''; l.style.transform = ''; });
      if (line) line.style.transform = '';
      items.forEach(function (li) { li.style.opacity = ''; li.classList.add('is-live'); });
    }, 3200);
    if (line) M.animate(line, { scaleY: [0, 1] }, { duration: 1.5, delay: 0.5, ease: 'linear' });
    items.forEach(function (li, i) {
      var t = 0.5 + (1.5 * (i + 0.5)) / items.length;
      setTimeout(function () { li.classList.add('is-live'); M.animate(li, { opacity: 1 }, { duration: 0.4 }); }, t * 1000);
    });
  } else if (trace) {
    $$('li', trace).forEach(function (li) { li.classList.add('is-live'); });
  }

  /* Switchboard: vertical tabs that look like breakers */
  var board = $('.board');
  if (board) {
    var tabs = $$('.breaker', board), panels = $$('.spec');
    var select = function (tab, focus) {
      tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); t.tabIndex = t === tab ? 0 : -1; });
      panels.forEach(function (p) {
        var on = p.id === tab.getAttribute('aria-controls');
        var was = !p.hidden;
        p.hidden = !on;
        if (on && !was && canAnimate) M.animate(p, { opacity: [0, 1], y: [10, 0] }, { duration: 0.35, ease: 'easeOut' });
      });
      if (focus) tab.focus();
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var n = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (n) { e.preventDefault(); select(tabs[(i + n + tabs.length) % tabs.length], true); }
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  }

  /* "Quote this job" pre-selects the service */
  $$('[data-service]').forEach(function (a) {
    a.addEventListener('click', function () { var sel = $('#f-service'); if (sel) sel.value = a.getAttribute('data-service'); });
  });

  /* Suburb filter */
  var search = $('#area-search');
  if (search) {
    var chips = $$('.regions li'), none = $('.areas__none');
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase(), shown = 0;
      chips.forEach(function (li) { var hit = !q || li.textContent.toLowerCase().indexOf(q) > -1; li.hidden = !hit; if (hit) shown++; });
      $$('.regions > div').forEach(function (g) { g.hidden = !$$('li:not([hidden])', g).length; });
      if (none) none.style.display = shown ? 'none' : 'block';
    });
  }

  /* Generic list filter (guides index) */
  $$('[data-filter]').forEach(function (input) {
    var rows = $$(input.getAttribute('data-filter'));
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      rows.forEach(function (r) { r.hidden = !!q && r.textContent.toLowerCase().indexOf(q) === -1; });
    });
  });

  /* Lightbox */
  var lb = $('.lightbox');
  if (lb && lb.showModal) {
    var lbImg = $('img', lb);
    $$('.work button').forEach(function (b) {
      b.addEventListener('click', function () { lbImg.src = b.getAttribute('data-full'); lbImg.alt = b.getAttribute('data-alt') || ''; lb.showModal(); });
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'BUTTON') lb.close(); });
  }

  /* Lead forms post to the same-origin Express backend */
  $$('form.js-lead').forEach(function (form) {
    var status = $('.form__status', form), btn = $('button[type=submit]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form__status'; status.textContent = '';
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.page = location.pathname; data.sid = sid;
      btn.disabled = true; btn.textContent = 'Sending...';
      fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error((res.j && res.j.error) || 'Something went wrong.');
          form.reset();
          status.className = 'form__status is-ok';
          var phone = form.getAttribute('data-phone'), email = form.getAttribute('data-email');
          status.textContent = phone
            ? 'Thanks. We have your request and will call you back shortly. For an emergency, call ' + phone + ' now.'
            : 'Thanks. We have your request and will be in touch shortly.' + (email ? ' You can also reach us at ' + email + '.' : '');
        })
        .catch(function (err) {
          status.className = 'form__status is-err';
          var phone = form.getAttribute('data-phone'), email = form.getAttribute('data-email');
          status.textContent = err.message + (phone ? ' You can also call ' + phone + ' directly.' : email ? ' You can also email ' + email + '.' : '');
        })
        .finally(function () { btn.disabled = false; btn.textContent = 'Send quote request'; });
    });
  });
})();
