(function () {
  'use strict';
  var app = document.getElementById('app');
  var STATUSES = ['new', 'contacted', 'quoted', 'booked', 'completed', 'cancelled'];
  var SERVICES = [];
  var META = { name: 'Admin', logo: '/images/logo.webp' };
  var state = { leads: [], blocked: [], tab: 'leads', filter: 'all', q: '', open: null, month: new Date(), selDay: null };

  /* All UI is built with DOM methods and textContent, never innerHTML on stored data. */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    var add = function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    };
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }
  function field(label, input, id) { input.id = id; return h('div', { class: 'field' }, h('label', { for: id, text: label }), input); }
  function token() { try { return sessionStorage.getItem('cx_admin'); } catch (e) { return null; } }
  function setToken(t) { try { t ? sessionStorage.setItem('cx_admin', t) : sessionStorage.removeItem('cx_admin'); } catch (e) { /* ignore */ } }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (token()) headers.Authorization = 'Bearer ' + token();
    return fetch('/api' + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && path !== '/admin/login') { setToken(null); renderLogin('Your session ended. Sign in again.'); throw new Error('signed out'); }
          if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
          return j;
        });
      });
  }
  function money(n) { return n === null || n === undefined || n === '' ? '' : '$' + Number(n).toLocaleString('en-AU', { maximumFractionDigits: 2 }); }
  function fmtDate(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function say(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); }

  /* ---------- Login ---------- */
  function renderLogin(note) {
    app.replaceChildren();
    var msg = h('p', { class: 'msg err', role: 'alert', text: note || '' });
    var pw = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    var btn = h('button', { class: 'btn btn--primary', type: 'submit', text: 'Sign in' });
    var form = h('form', { class: 'login__box', onsubmit: function (e) {
      e.preventDefault(); btn.disabled = true; msg.textContent = '';
      api('/admin/login', { method: 'POST', body: { password: pw.value } })
        .then(function (j) { setToken(j.token); boot(); })
        .catch(function (err) { say(msg, err.message); btn.disabled = false; });
    } },
    h('img', { src: META.logo, alt: META.name }),
    h('h1', { text: 'Admin sign in' }),
    field('Password', pw, 'pw'), btn, msg);
    app.appendChild(h('div', { class: 'login' }, form));
    pw.focus();
  }

  /* ---------- Shell ---------- */
  function renderShell() {
    app.replaceChildren();
    var tabs = [['leads', 'Bookings and leads'], ['chats', 'Chats'], ['calendar', 'Calendar'], ['traffic', 'Traffic and conversions'], ['settings', 'Settings']];
    var tablist = h('div', { class: 'tabs', role: 'tablist' });
    tabs.forEach(function (t) {
      tablist.appendChild(h('button', { role: 'tab', type: 'button', 'aria-selected': state.tab === t[0] ? 'true' : 'false', 'data-tab': t[0], text: t[1], onclick: function () { state.tab = t[0]; renderShell(); } }));
    });
    app.appendChild(h('div', { class: 'bar' },
      h('div', { class: 'bar__row' },
        h('span', { class: 'bar__logo' }, h('img', { src: META.logo, alt: META.name })),
        h('span', { class: 'bar__title', text: 'Dashboard' }),
        h('a', { href: '/', text: 'View site' }),
        h('button', { class: 'btn', type: 'button', text: 'Sign out', onclick: function () { setToken(null); renderLogin(''); } })),
      tablist));
    var main = h('main', { id: 'main' });
    app.appendChild(main);
    ({ leads: viewLeads, chats: viewChats, calendar: viewCalendar, traffic: viewTraffic, settings: viewSettings })[state.tab](main);
  }

  /* ---------- Leads ---------- */
  function viewLeads(main) {
    var now = new Date(), month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var L = state.leads;
    var stat = function (n, label) { return h('div', { class: 'stat' }, h('b', { text: String(n) }), h('span', { text: label })); };
    var pipeline = L.filter(function (l) { return l.value && (l.status === 'quoted' || l.status === 'booked'); }).reduce(function (s, l) { return s + Number(l.value); }, 0);
    main.appendChild(h('div', { class: 'stats' },
      stat(L.filter(function (l) { return l.status === 'new'; }).length, 'New, need a call'),
      stat(L.filter(function (l) { return l.status === 'booked'; }).length, 'Booked'),
      stat(L.filter(function (l) { return l.createdAt.slice(0, 7) === month; }).length, 'Requests this month'),
      stat(money(pipeline) || '$0', 'Quoted and booked value')));

    var list = h('div', { class: 'list', 'aria-live': 'polite' });
    var search = h('input', { type: 'search', placeholder: 'Name, phone, suburb...', value: state.q, oninput: function () { state.q = search.value; draw(); } });
    var filter = h('select', { onchange: function () { state.filter = filter.value; draw(); } }, h('option', { value: 'all', text: 'All statuses' }));
    STATUSES.forEach(function (s) { filter.appendChild(h('option', { value: s, text: s[0].toUpperCase() + s.slice(1) })); });
    filter.value = state.filter;
    main.appendChild(h('div', { class: 'toolbar' }, field('Search', search, 'q'), field('Status', filter, 'flt'),
      h('button', { class: 'btn btn--ghost', type: 'button', text: 'Refresh', onclick: function () { reload().then(renderShell); } }),
      h('button', { class: 'btn btn--ghost', type: 'button', text: 'Export CSV', onclick: exportCsv })));
    main.appendChild(list);

    function draw() {
      list.replaceChildren();
      var q = state.q.trim().toLowerCase();
      var rows = L.filter(function (l) {
        return (state.filter === 'all' || l.status === state.filter) && (!q || [l.name, l.phone, l.email, l.suburb, l.service].join(' ').toLowerCase().indexOf(q) > -1);
      });
      if (!rows.length) { list.appendChild(h('div', { class: 'empty', text: L.length ? 'No leads match those filters.' : 'No leads yet. Requests from the website form will show up here.' })); return; }
      rows.forEach(function (l) { list.appendChild(leadRow(l)); });
    }
    draw();
  }

  function leadRow(l) {
    var open = state.open === l.id;
    var head = h('button', { type: 'button', 'aria-expanded': open ? 'true' : 'false', onclick: function () { state.open = open ? null : l.id; renderShell(); } },
      h('span', null, h('span', { class: 'row__name', text: l.name }), h('br'), h('span', { class: 'row__sub', text: [l.phone, l.suburb].filter(Boolean).join(', ') })),
      h('span', { class: 'row__sub', text: l.service || 'General enquiry' }),
      h('span', { class: 'row__sub', text: fmtDate(l.createdAt) }),
      h('span', { class: 'pill pill--' + l.status, text: l.status }));
    var row = h('div', { class: 'row' }, head);
    if (open) row.appendChild(leadDetail(l));
    return row;
  }

  function leadDetail(l) {
    var msg = h('p', { class: 'msg', role: 'status' });
    var status = h('select', null); STATUSES.forEach(function (s) { status.appendChild(h('option', { value: s, text: s })); }); status.value = l.status;
    var date = h('input', { type: 'date', value: l.scheduledDate || '' });
    var time = h('input', { type: 'time', value: l.scheduledTime || '' });
    var value = h('input', { type: 'number', min: '0', step: '0.01', value: l.value === null ? '' : l.value });
    var notes = h('textarea', { value: l.notes || '' });
    var amount = h('input', { type: 'number', min: '1', step: '0.01', value: l.value ? Math.round(l.value * 0.2 * 100) / 100 : '' });
    var save = h('button', { class: 'btn btn--primary', type: 'button', text: 'Save changes', onclick: function () {
      api('/leads/' + l.id, { method: 'PATCH', body: { status: status.value, scheduledDate: date.value, scheduledTime: time.value, value: value.value, notes: notes.value } })
        .then(function (j) { Object.assign(l, j.lead); say(msg, 'Saved.', true); }).catch(function (e) { say(msg, e.message); });
    } });
    var del = h('button', { class: 'btn btn--danger', type: 'button', text: 'Delete lead', onclick: function () {
      if (!confirm('Delete this lead permanently?')) return;
      api('/leads/' + l.id, { method: 'DELETE' }).then(function () { state.leads = state.leads.filter(function (x) { return x.id !== l.id; }); state.open = null; renderShell(); }).catch(function (e) { say(msg, e.message); });
    } });
    var payInfo = l.payment ? h('p', { class: 'row__sub', text: 'Deposit ' + money(l.payment.amount) + ': ' + l.payment.status + (l.payment.emailedAt ? ' (emailed ' + fmtDate(l.payment.emailedAt) + ')' : '') }) : null;
    function pay(kind) {
      say(msg, 'Working...', true);
      api(kind === 'email' ? '/send-deposit-email' : '/create-checkout', { method: 'POST', body: { leadId: l.id, amount: amount.value, description: (l.service || 'Electrical work') + ' deposit' } })
        .then(function (j) {
          if (kind === 'email') return say(msg, 'Deposit email sent to ' + l.email + '.', true);
          if (navigator.clipboard) navigator.clipboard.writeText(j.url).catch(function () {});
          say(msg, 'Payment link created and copied: ' + j.url, true);
        }).catch(function (e) { say(msg, e.message); });
    }
    return h('div', { class: 'detail' },
      h('div', { class: 'detail__grid' },
        h('div', null, h('b', { text: 'Contact' }), h('br'), h('a', { href: 'tel:' + l.phone.replace(/[^\d+]/g, ''), text: l.phone }), h('br'), l.email ? h('a', { href: 'mailto:' + l.email, text: l.email }) : 'No email'),
        h('div', null, h('b', { text: 'Job' }), h('br'), (l.service || 'General enquiry') + (l.suburb ? ' in ' + l.suburb : ''), h('br'), l.preferredDate ? 'Prefers ' + l.preferredDate : 'No preferred date'),
        h('div', null, h('b', { text: 'Came from' }), h('br'), l.source === 'manual' ? 'Added by staff' : l.source === 'chatbot' ? 'Chat assistant' + (l.page ? ' on ' + l.page : '') : (l.page || 'website'), l.upgrade ? h('br') : null, l.upgrade ? h('span', { class: 'pill ' + (l.upgrade.accepted ? 'pill--booked' : ''), text: 'Upgrade: ' + l.upgrade.title + (l.upgrade.accepted ? ' (wanted)' : ' (declined)') }) : null)),
      h('p', { class: 'detail__msg', text: l.message || '(no message)' }),
      h('div', { class: 'detail__grid' }, field('Status', status, 'st-' + l.id), field('Scheduled date', date, 'dt-' + l.id), field('Time', time, 'tm-' + l.id), field('Job value ($)', value, 'val-' + l.id)),
      field('Internal notes', notes, 'nt-' + l.id),
      h('div', { class: 'actions' }, save, del),
      h('div', { class: 'actions' }, field('Deposit amount ($)', amount, 'amt-' + l.id),
        h('button', { class: 'btn btn--ghost', type: 'button', text: 'Email deposit request', onclick: function () { pay('email'); } }),
        h('button', { class: 'btn btn--ghost', type: 'button', text: 'Copy payment link', onclick: function () { pay('link'); } })),
      payInfo, msg);
  }

  function exportCsv() {
    var cols = ['createdAt', 'status', 'name', 'phone', 'email', 'suburb', 'service', 'preferredDate', 'scheduledDate', 'scheduledTime', 'value', 'message', 'notes'];
    var safe = function (v) { v = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var csv = [cols.join(',')].concat(state.leads.map(function (l) { return cols.map(function (c) { return safe(l[c]); }).join(','); })).join('\n');
    var a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: (META.name || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-leads-' + ymd(new Date()) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Calendar ---------- */
  function viewCalendar(main) {
    var y = state.month.getFullYear(), m = state.month.getMonth();
    var first = new Date(y, m, 1), start = new Date(y, m, 1 - ((first.getDay() + 6) % 7)); // weeks start Monday
    var todayKey = ymd(new Date());
    var blocked = {}; state.blocked.forEach(function (b) { blocked[b.date] = b; });
    var byDay = {};
    state.leads.forEach(function (l) {
      if (l.status === 'cancelled') return;
      if (l.scheduledDate) (byDay[l.scheduledDate] = byDay[l.scheduledDate] || []).push({ l: l, pref: false });
      else if (l.preferredDate && l.status === 'new') (byDay[l.preferredDate] = byDay[l.preferredDate] || []).push({ l: l, pref: true });
    });
    main.appendChild(h('div', { class: 'cal__head' },
      h('h2', { text: first.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }) }),
      h('button', { class: 'btn btn--ghost', type: 'button', 'aria-label': 'Previous month', text: 'Prev', onclick: function () { state.month = new Date(y, m - 1, 1); renderShell(); } }),
      h('button', { class: 'btn btn--ghost', type: 'button', text: 'Today', onclick: function () { state.month = new Date(); renderShell(); } }),
      h('button', { class: 'btn btn--ghost', type: 'button', 'aria-label': 'Next month', text: 'Next', onclick: function () { state.month = new Date(y, m + 1, 1); renderShell(); } })));
    var grid = h('div', { class: 'cal', role: 'grid' });
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d) { grid.appendChild(h('div', { class: 'cal__dow', text: d })); });
    for (var i = 0; i < 42; i++) {
      (function (d) {
        var key = ymd(d), items = byDay[key] || [];
        var cls = 'cal__day' + (d.getMonth() !== m ? ' cal__day--out' : '') + (key === todayKey ? ' cal__day--today' : '') + (blocked[key] ? ' cal__day--blocked' : '') + (state.selDay === key ? ' cal__day--sel' : '');
        var cell = h('button', { class: cls, type: 'button', 'aria-label': d.toDateString() + (items.length ? ', ' + items.length + ' jobs' : '') + (blocked[key] ? ', blocked' : ''), onclick: function () { state.selDay = key; renderShell(); } },
          h('span', { class: 'cal__num', text: String(d.getDate()) }));
        items.slice(0, 3).forEach(function (it) { cell.appendChild(h('span', { class: 'chip pill--' + it.l.status + (it.pref ? ' chip--pref' : ''), text: (it.l.scheduledTime ? it.l.scheduledTime + ' ' : '') + it.l.name })); });
        if (items.length > 3) cell.appendChild(h('span', { class: 'chip', text: '+' + (items.length - 3) + ' more' }));
        if (items.length) cell.appendChild(h('span', { class: 'dot' }));
        if (blocked[key]) cell.appendChild(h('span', { class: 'chip', text: 'Blocked' + (blocked[key].reason ? ': ' + blocked[key].reason : '') }));
        grid.appendChild(cell);
      })(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    main.appendChild(grid);
    main.appendChild(h('p', { class: 'row__sub', text: 'Solid chips are scheduled jobs. Dashed chips are new requests showing the customer\'s preferred date. Click a day to add a job or block it.' }));
    if (state.selDay) main.appendChild(dayPanel(state.selDay, byDay[state.selDay] || [], blocked[state.selDay]));
  }

  function dayPanel(key, items, block) {
    var msg = h('p', { class: 'msg', role: 'status' });
    var name = h('input', { required: true }), phone = h('input', { type: 'tel' }), suburb = h('input'), time = h('input', { type: 'time' }), val = h('input', { type: 'number', min: '0', step: '0.01' });
    var svc = h('select'); SERVICES.forEach(function (s) { svc.appendChild(h('option', { text: s })); });
    var reason = h('input', { placeholder: 'Reason (optional)', value: block ? block.reason : '' });
    var panel = h('section', { class: 'panel', 'aria-label': 'Day details' }, h('h3', { text: new Date(key + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) }));
    if (items.length) {
      var ul = h('div', { class: 'list' });
      items.forEach(function (it) {
        ul.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', onclick: function () { state.tab = 'leads'; state.open = it.l.id; renderShell(); } },
          h('span', { class: 'row__name', text: (it.l.scheduledTime ? it.l.scheduledTime + '  ' : '') + it.l.name }), h('span', { class: 'row__sub', text: (it.l.service || '') + (it.pref ? ' (preferred date)' : '') }), h('span', { text: '' }), h('span', { class: 'pill pill--' + it.l.status, text: it.l.status }))));
      });
      panel.appendChild(ul);
    } else panel.appendChild(h('p', { class: 'row__sub', text: 'Nothing scheduled.' }));
    panel.appendChild(h('form', { onsubmit: function (e) {
      e.preventDefault();
      api('/leads/manual', { method: 'POST', body: { name: name.value, phone: phone.value, suburb: suburb.value, service: svc.value, scheduledDate: key, scheduledTime: time.value, value: val.value } })
        .then(function (j) { state.leads.unshift(j.lead); renderShell(); }).catch(function (er) { say(msg, er.message); });
    }, class: 'detail__grid' },
    h('h3', { text: 'Add a job to this day', style: 'grid-column:1/-1;margin:0' }),
    field('Customer name', name, 'm-name'), field('Phone', phone, 'm-phone'), field('Suburb', suburb, 'm-sub'), field('Service', svc, 'm-svc'), field('Time', time, 'm-time'), field('Value ($)', val, 'm-val'),
    h('button', { class: 'btn btn--primary', type: 'submit', text: 'Add job' })));
    panel.appendChild(h('div', { class: 'actions' }, field('Block this day', reason, 'm-reason'),
      block ? h('button', { class: 'btn btn--ghost', type: 'button', text: 'Unblock day', onclick: function () { api('/blocked/' + key, { method: 'DELETE' }).then(function (j) { state.blocked = j.blocked; renderShell(); }).catch(function (e) { say(msg, e.message); }); } })
        : h('button', { class: 'btn btn--ghost', type: 'button', text: 'Block day', onclick: function () { api('/blocked', { method: 'POST', body: { date: key, reason: reason.value } }).then(function (j) { state.blocked = j.blocked; renderShell(); }).catch(function (e) { say(msg, e.message); }); } })));
    panel.appendChild(msg);
    return panel;
  }

  /* ---------- Traffic ---------- */
  function viewTraffic(main) {
    var box = h('div', null, h('p', { class: 'row__sub', text: 'Loading...' }));
    main.appendChild(box);
    renderConversions(main);
    api('/traffic?days=30').then(function (t) {
      box.replaceChildren();
      var stat = function (n, label) { return h('div', { class: 'stat' }, h('b', { text: String(n) }), h('span', { text: label })); };
      box.appendChild(h('div', { class: 'stats' }, stat(t.sessions, 'Sessions, last ' + t.days + ' days'), stat(t.views, 'Page views'), stat(t.sessions ? (t.views / t.sessions).toFixed(1) : '0', 'Pages per session'),
        stat(state.leads.filter(function (l) { return l.source === 'website' && Date.now() - Date.parse(l.createdAt) < 30 * 86400000; }).length, 'Quote requests')));
      var max = Math.max.apply(null, t.daily.map(function (d) { return d.views; }).concat([1]));
      var bars = h('div', { class: 'bars', role: 'img', 'aria-label': 'Daily page views for the last ' + t.days + ' days' });
      t.daily.forEach(function (d) { bars.appendChild(h('i', { style: 'height:' + Math.max(2, Math.round(d.views / max * 100)) + '%', title: d.date + ': ' + d.views + ' views' })); });
      box.appendChild(h('div', { class: 'panel', style: 'margin-top:0' }, h('h3', { text: 'Daily page views' }), bars));
      var tally = function (title, rows) { return h('div', { class: 'panel', style: 'margin:0' }, h('h3', { text: title }), rows.length ? h('ul', { class: 'tally' }, rows.map(function (r) { return h('li', null, h('span', { text: r.name }), h('b', { text: String(r.count) })); })) : h('p', { class: 'row__sub', text: 'No data yet.' })); };
      box.appendChild(h('div', { class: 'cols' }, tally('Top pages', t.pages), tally('Top sources', t.sources), tally('Devices', t.devices)));
    }).catch(function (e) { box.replaceChildren(h('p', { class: 'msg err', text: e.message })); });
  }

  /* ---------- Settings ---------- */
  function viewSettings(main) {
    var box = h('div', null, h('p', { class: 'row__sub', text: 'Loading...' }));
    main.appendChild(box);
    api('/settings').then(function (r) {
      box.replaceChildren();
      var s = r.settings, i = r.integrations, msg = h('p', { class: 'msg', role: 'status' });
      settingsChat(box, r);
      var email = h('input', { type: 'email', value: s.notifyEmail || '' }), pct = h('input', { type: 'number', min: '1', max: '100', value: s.depositPercent });
      var tag = function (on, yes, no) { return h('span', { class: 'tag ' + (on ? 'tag--on' : 'tag--off'), text: on ? yes : no }); };
      box.appendChild(h('form', { class: 'panel', style: 'margin-top:0', onsubmit: function (e) {
        e.preventDefault();
        api('/settings', { method: 'PUT', body: { notifyEmail: email.value, depositPercent: pct.value } }).then(function () { say(msg, 'Settings saved.', true); }).catch(function (er) { say(msg, er.message); });
      } }, h('h2', { text: 'Notifications' }),
      field('Send new-lead alerts to', email, 's-email'), field('Default deposit (% of job value)', pct, 's-pct'),
      h('div', { class: 'actions' }, h('button', { class: 'btn btn--primary', type: 'submit', text: 'Save settings' })), msg));
      box.appendChild(h('div', { class: 'panel' }, h('h2', { text: 'Connections' }), h('div', { class: 'integ' },
        h('div', null, h('h3', { text: 'Email (Resend)' }), tag(i.resend, 'Connected', 'Not connected'), h('p', { class: 'row__sub', text: i.resend ? 'Lead alerts and deposit emails send from ' + (i.from || 'the default sender') + '.' : 'Set RESEND_API_KEY on the server to send lead alerts and deposit emails.' })),
        h('div', null, h('h3', { text: 'Stripe payments' }), tag(i.stripe, 'Connected', 'Not connected'), h('p', { class: 'row__sub', text: i.stripe ? (i.stripeWebhook ? 'Deposits work and paid status updates automatically.' : 'Deposits work. Add STRIPE_WEBHOOK_SECRET to mark paid deposits automatically.') : 'Set STRIPE_SECRET_KEY on the server to take deposits.' })),
        h('div', null, h('h3', { text: 'PayPal' }), h('span', { class: 'tag', text: 'Not built yet' }), h('p', { class: 'row__sub', text: 'Stripe handles card payments. PayPal can be added on request.' })),
        h('div', null, h('h3', { text: 'Google Calendar' }), h('span', { class: 'tag', text: 'Not built yet' }), h('p', { class: 'row__sub', text: 'The Calendar tab is built in. Two-way Google Calendar sync can be added on request.' })))));
    }).catch(function (e) { box.replaceChildren(h('p', { class: 'msg err', text: e.message })); });
  }

  /* ---------- Chats ---------- */
  function viewChats(main) {
    var box = h('div', { class: 'list' }, h('p', { class: 'row__sub', text: 'Loading...' }));
    main.appendChild(h('p', { class: 'row__sub', text: 'Every conversation with the website assistant. Leads it captures also appear in Bookings and leads.' }));
    main.appendChild(box);
    api('/chats').then(function (r) {
      box.replaceChildren();
      if (!r.chats.length) { box.appendChild(h('div', { class: 'empty', text: 'No chats yet. Conversations from the website chat widget will show up here.' })); return; }
      r.chats.forEach(function (c) {
        var open = state.openChat === c.id;
        var first = (c.messages.find(function (m) { return m.role === 'user'; }) || {}).content || '(no message)';
        var head = h('button', { type: 'button', 'aria-expanded': open ? 'true' : 'false', onclick: function () { state.openChat = open ? null : c.id; renderShell(); } },
          h('span', null, h('span', { class: 'row__name', text: first.slice(0, 70) }), h('br'), h('span', { class: 'row__sub', text: c.messages.length + ' messages on ' + (c.page || '/') })),
          h('span', { class: 'row__sub', text: c.mode }),
          h('span', { class: 'row__sub', text: fmtDate(c.startedAt) }),
          h('span', { class: 'pill ' + (c.leadId ? 'pill--booked' : ''), text: c.leadId ? (c.upgrade && c.upgrade.accepted ? 'lead + upgrade' : 'lead captured') : 'no lead' }));
        var row = h('div', { class: 'row' }, head);
        if (open) {
          var log = h('div', { class: 'detail' });
          c.messages.forEach(function (m) { log.appendChild(h('p', { class: 'detail__msg', style: m.role === 'user' ? 'background:#e2f5fc' : '' }, h('b', { text: (m.role === 'user' ? 'Customer: ' : 'Assistant: ') }), m.content)); });
          if (c.upgrade) log.appendChild(h('p', { class: 'row__sub', text: 'Upgrade offer "' + c.upgrade.title + '": ' + (c.upgrade.accepted ? 'customer wants it' : 'declined') }));
          if (c.leadId) log.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn btn--ghost', type: 'button', text: 'Open lead', onclick: function () { state.tab = 'leads'; state.open = c.leadId; renderShell(); } })));
          row.appendChild(log);
        }
        box.appendChild(row);
      });
    }).catch(function (e) { box.replaceChildren(h('p', { class: 'msg err', text: e.message })); });
  }

  /* ---------- Conversions (calls, texts, chat and form leads) ---------- */
  function renderConversions(main) {
    var box = h('div', { style: 'margin-top:28px' }, h('h2', { text: 'Conversions, last 30 days' }));
    main.appendChild(box);
    api('/conversions?days=30').then(function (c) {
      var t = c.totals, n = function (k) { return String(t[k] || 0); };
      var stat = function (v, label) { return h('div', { class: 'stat' }, h('b', { text: v }), h('span', { text: label })); };
      box.appendChild(h('div', { class: 'stats' },
        stat(n('call'), 'Call button clicks'), stat(n('text'), 'Text button clicks'), stat(n('chat_lead'), 'Leads from chat'), stat(n('form_lead'), 'Leads from forms'),
        stat(n('quote'), 'Quote button clicks'), stat(String(c.chats), 'Chats started'), stat(n('upgrade_accept'), 'Upgrades accepted'), stat(c.rate + '%', 'Visits that took action')));
      var max = Math.max.apply(null, c.daily.map(function (d) { return d.count; }).concat([1]));
      var bars = h('div', { class: 'bars', role: 'img', 'aria-label': 'Daily conversions' });
      c.daily.forEach(function (d) { bars.appendChild(h('i', { style: 'height:' + Math.max(2, Math.round(d.count / max * 100)) + '%', title: d.date + ': ' + d.count })); });
      var label = { call: 'Call', text: 'Text', quote: 'Quote click', chat_open: 'Chat opened', chat_lead: 'Chat lead', form_lead: 'Form lead', upgrade_accept: 'Upgrade accepted', reviews: 'Reviews click' };
      box.appendChild(h('div', { class: 'cols' },
        h('div', { class: 'panel', style: 'margin:0' }, h('h3', { text: 'Calls, texts and leads per day' }), bars),
        h('div', { class: 'panel', style: 'margin:0' }, h('h3', { text: 'Where conversions come from' }),
          c.bySource.length ? h('ul', { class: 'tally' }, c.bySource.map(function (r) { return h('li', null, h('span', { text: (label[r.type] || r.type) + ' from ' + r.source }), h('b', { text: String(r.count) })); })) : h('p', { class: 'row__sub', text: 'No conversions recorded yet.' }))));
    }).catch(function (e) { box.appendChild(h('p', { class: 'msg err', text: e.message })); });
  }

  /* ---------- Chatbot settings ---------- */
  function settingsChat(box, r) {
    var s = r.settings, i = r.integrations, msg = h('p', { class: 'msg', role: 'status' });
    var enabled = h('input', { type: 'checkbox', id: 'chat-on' }); enabled.checked = s.chatEnabled !== false;
    var offerEls = (s.offers || []).map(function (o, idx) {
      var on = h('input', { type: 'checkbox', id: 'of-on-' + idx }); on.checked = o.active === true;
      var title = h('input', { value: o.title }), body = h('textarea', { value: o.body });
      return { o: o, on: on, title: title, body: body, node: h('div', { class: 'panel', style: 'margin:0' },
        h('label', { for: 'of-on-' + idx, style: 'font-weight:700' }, on, ' Offer this upgrade in the chat'),
        field('Title', title, 'of-t-' + idx), field('What the customer hears', body, 'of-b-' + idx)) };
    });
    var save = h('button', { class: 'btn btn--primary', type: 'button', text: 'Save chatbot settings', onclick: function () {
      api('/settings', { method: 'PUT', body: { notifyEmail: s.notifyEmail, depositPercent: s.depositPercent, chatEnabled: enabled.checked,
        offers: offerEls.map(function (e) { return { id: e.o.id, title: e.title.value, body: e.body.value, active: e.on.checked }; }) } })
        .then(function () { say(msg, 'Chatbot settings saved.', true); }).catch(function (er) { say(msg, er.message); });
    } });
    box.appendChild(h('div', { class: 'panel', style: 'margin-top:0' },
      h('h2', { text: 'Chat assistant' }),
      h('p', { class: 'row__sub' }, h('span', { class: 'tag ' + (i.deepseek ? 'tag--on' : 'tag--off'), text: i.deepseek ? 'DeepSeek connected' : 'DeepSeek key missing' }), ' ',
        i.deepseek ? 'Model: ' + i.deepseekModel + '. Replies are generated by AI and leads are saved automatically.' : 'Using the built-in scripted flow. Add DEEPSEEK_API_KEY on the server for AI replies.'),
      h('label', { for: 'chat-on', style: 'font-weight:700' }, enabled, ' Show the chat widget on the website'),
      h('h3', { text: 'Upgrade offers' }),
      h('p', { class: 'row__sub', text: 'After the chat captures a lead, the assistant offers the first active upgrade. These are placeholders. Confirm what you actually sell and the pricing before going live; the assistant never quotes a price for them.' }),
      h('div', { class: 'cols' }, offerEls.map(function (e) { return e.node; })),
      h('div', { class: 'actions' }, save), msg));
  }

  /* ---------- Boot ---------- */
  function reload() {
    return Promise.all([api('/leads'), api('/blocked')]).then(function (r) { state.leads = r[0].leads; state.blocked = r[1].blocked; });
  }
  function boot() {
    if (!token()) return renderLogin('');
    reload().then(renderShell).catch(function () { /* 401 already routed to login */ });
  }
  /* Brand the dashboard from /api/site-meta, then start. */
  fetch('/api/site-meta').then(function (r) { return r.json(); }).then(function (m) {
    META = m; SERVICES = m.services || [];
    document.title = m.name + ' Admin';
    var b = m.brand || {}, st = document.documentElement.style;
    [['--cyan', b.primary], ['--ink', b.ink], ['--teal', b.accentText], ['--cyan-tint', b.primaryTint], ['--mains', b.surface], ['--grey', b.border], ['--amber', b.hazard], ['--on-primary', b.onPrimary]].forEach(function (p) { if (p[1]) st.setProperty(p[0], p[1]); });
    if (m.fontsUrl) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = m.fontsUrl; document.head.appendChild(l); }
    if (m.fonts) { st.setProperty('--font-display', '"' + m.fonts.display + '", system-ui, sans-serif'); st.setProperty('--font-body', '"' + m.fonts.body + '", system-ui, sans-serif'); }
  }).catch(function () { /* fall back to defaults */ }).then(boot);
})();
