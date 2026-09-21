(function () {
  'use strict';
  var root = document.getElementById('chat');
  if (!root) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var launch = $('.chat__launch'), panel = $('.chat__panel'), log = $('.chat__log'), chips = $('.chat__chips');
  var form = $('.chat__form'), input = $('.chat__form input'), closeBtn = $('.chat__close');
  var phone = root.getAttribute('data-phone');
  var M = function () { return window.Motion; };

  var sid;
  try { sid = sessionStorage.getItem('cx_sid'); if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('cx_sid', sid); } } catch (e) { sid = Math.random().toString(36).slice(2); }

  var history = [], state = null, busy = false, greeted = false, leadDone = false;
  var STORE = 'cx_chat';
  var NAME = root.getAttribute('data-name') || 'our';
  var CHIPS = ['Get a quote', 'How much do you charge?', 'Are you available this week?'];

  function convert(type, source) {
    var body = JSON.stringify({ type: type, source: source, sid: sid, page: location.pathname });
    try { if (navigator.sendBeacon) navigator.sendBeacon('/api/convert', new Blob([body], { type: 'application/json' })); else fetch('/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }); } catch (e) { /* ignore */ }
  }

  /* Persist the conversation for the tab so it survives page navigation. */
  function persist() { try { sessionStorage.setItem(STORE, JSON.stringify({ history: history.slice(-14), state: state, greeted: greeted, leadDone: leadDone })); } catch (e) { /* ignore */ } }
  function restore() {
    try {
      var s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (!s) return;
      history = s.history || []; state = s.state || null; greeted = !!s.greeted; leadDone = !!s.leadDone;
      history.forEach(function (m) { bubble(m.role === 'user' ? 'me' : 'bot', m.content, true); });
    } catch (e) { /* ignore */ }
  }

  /* Text is always inserted with textContent; only **bold** becomes <strong>, built from DOM nodes. */
  function bubble(who, text, quiet) {
    var el = document.createElement('div');
    el.className = 'msg msg--' + who;
    String(text).split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) { var b = document.createElement('strong'); b.textContent = part.slice(2, -2); el.appendChild(b); }
      else el.appendChild(document.createTextNode(part));
    });
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    if (!quiet && M() && M().animate && !reduced) M().animate(el, { opacity: [0, 1], y: [8, 0] }, { duration: 0.28, ease: 'easeOut' });
    return el;
  }
  function typing() { var el = document.createElement('div'); el.className = 'msg msg--bot msg--typing'; el.setAttribute('aria-label', 'Typing'); el.innerHTML = '<i></i><i></i><i></i>'; log.appendChild(el); log.scrollTop = log.scrollHeight; return el; }

  function setChips(list) {
    chips.replaceChildren();
    (list || []).forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t;
      b.addEventListener('click', function () { send(t); });
      chips.appendChild(b);
    });
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    bubble('bot', 'Hi, I am the ' + NAME + ' assistant. Tell me what you need and I can get you a quote, answer questions, or pass your details to the team. For anything urgent, call ' + phone + '.');
    setChips(CHIPS);
    persist();
  }

  function offerCard(offer) {
    var card = document.createElement('div'); card.className = 'offer';
    var t = document.createElement('b'); t.textContent = 'Upgrade: ' + offer.title;
    var p = document.createElement('p'); p.textContent = offer.body;
    var btns = document.createElement('div'); btns.className = 'offer__btns';
    function answer(accepted) {
      card.remove();
      fetch('/api/chat/upgrade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: sid, offerId: offer.id, accepted: accepted }) })
        .then(function (r) { return r.json(); }).then(function (j) { if (j.reply) { bubble('bot', j.reply); history.push({ role: 'assistant', content: j.reply }); persist(); } })
        .catch(function () { bubble('bot', 'Sorry, that did not go through. The team will confirm when they call.'); });
    }
    var yes = document.createElement('button'); yes.type = 'button'; yes.textContent = 'Yes, add it'; yes.addEventListener('click', function () { answer(true); });
    var no = document.createElement('button'); no.type = 'button'; no.textContent = 'No thanks'; no.addEventListener('click', function () { answer(false); });
    btns.appendChild(yes); btns.appendChild(no);
    card.appendChild(t); card.appendChild(p); card.appendChild(btns);
    log.appendChild(card); log.scrollTop = log.scrollHeight;
    if (M() && M().animate && !reduced) M().animate(card, { opacity: [0, 1], y: [10, 0] }, { duration: 0.3 });
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true; input.value = ''; setChips([]);
    bubble('me', text);
    history.push({ role: 'user', content: text });
    var t = typing();
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: sid, messages: history.slice(-14), state: state, page: location.pathname }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        t.remove();
        var reply = res.j.reply || res.j.error || 'Sorry, something went wrong. Please call or text ' + phone + '.';
        bubble('bot', reply);
        if (res.ok && res.j.reply) history.push({ role: 'assistant', content: res.j.reply });
        if (res.j.state) state = res.j.state;
        if (res.j.leadSaved) { leadDone = true; var ok = document.createElement('div'); ok.className = 'msg msg--ok'; ok.textContent = 'Request sent to the team'; log.appendChild(ok); }
        if (res.j.offer) offerCard(res.j.offer);
        persist();
      })
      .catch(function () { t.remove(); bubble('bot', 'Sorry, I could not send that. Please call or text ' + phone + '.'); })
      .finally(function () { busy = false; log.scrollTop = log.scrollHeight; });
  }

  var opened = false;
  function open() {
    if (opened) return;
    opened = true;
    panel.hidden = false; launch.setAttribute('aria-expanded', 'true');
    if (M() && M().animate && !reduced) M().animate(panel, { opacity: [0, 1], scale: [0.94, 1], y: [14, 0] }, { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] });
    if (!log.childNodes.length) { restore(); }
    greet();
    try { if (!sessionStorage.getItem('cx_chat_open')) { sessionStorage.setItem('cx_chat_open', '1'); convert('chat_open', 'chat'); } } catch (e) { convert('chat_open', 'chat'); }
    setTimeout(function () { input.focus(); }, 60);
  }
  function close() {
    if (!opened) return;
    opened = false; panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); launch.focus();
  }
  launch.addEventListener('click', function () { opened ? close() : open(); });
  closeBtn.addEventListener('click', close);
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-open-chat]'); if (b) { e.preventDefault(); open(); } });

  /* Hide the widget entirely if staff have switched chat off in the admin settings. */
  fetch('/api/chat/config').then(function (r) { return r.json(); }).then(function (c) { if (c && c.enabled === false) root.hidden = true; if (c && c.chips && c.chips.length) { CHIPS = c.chips; if (!greeted && opened) setChips(CHIPS); } }).catch(function () { /* keep the widget */ });
})();
