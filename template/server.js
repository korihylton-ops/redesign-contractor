'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* Minimal .env loader for local runs. In Docker the values arrive via env_file. */
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  });
} catch (e) { /* no .env file */ }

const express = require('express');
const pagesLib = require('./lib/pages');
const chat = require('./lib/chat');
const C = require('./lib/config');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SITE_URL = (process.env.SITE_URL || C.site.siteUrl || 'http://localhost:' + (process.env.PORT || 3000)).replace(/\/$/, '');
const ADMIN_HASH = (process.env.ADMIN_PASSWORD_HASH || '').toLowerCase();
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

if (!ADMIN_HASH) console.warn('[warn] ADMIN_PASSWORD_HASH is not set: admin login is disabled.');
if (!process.env.SESSION_SECRET) console.warn('[warn] SESSION_SECRET is not set: admin sessions will not survive a restart.');
if (!process.env.DEEPSEEK_API_KEY) console.warn('[warn] DEEPSEEK_API_KEY is not set: the chat assistant uses its scripted fallback.');

/* ---------- Storage: small JSON files, held in memory, written atomically ---------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
const store = {};
function load(name, fallback) {
  try { store[name] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name + '.json'), 'utf8')); }
  catch (e) { store[name] = fallback; }
}
function save(name) {
  const file = path.join(DATA_DIR, name + '.json'), tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store[name], null, 2));
  fs.renameSync(tmp, file);
}
load('leads', []); load('blocked', []); load('traffic', []); load('settings', {}); load('chats', []); load('conversions', []);

const settings = () => Object.assign({
  notifyEmail: process.env.NOTIFY_EMAIL || C.business.email, depositPercent: 20, businessName: C.business.name,
  chatEnabled: true, offers: chat.DEFAULT_OFFERS
}, store.settings);

const dirty = new Set();
let flushTimer = null;
function saveSoon(name) {
  dirty.add(name);
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flushNow(); }, 5000);
}
function flushNow() { for (const n of dirty) { try { save(n); } catch (e) { console.error(n + ' save failed', e.message); } } dirty.clear(); }
process.on('SIGTERM', () => { flushNow(); process.exit(0); });
process.on('SIGINT', () => { flushNow(); process.exit(0); });

/* ---------- Helpers ---------- */
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');
const newId = () => crypto.randomBytes(6).toString('hex');
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr); return false;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600000)) hits.delete(k); }, 600000).unref();

function sign(payload) { return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url'); }
function makeToken() { const p = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString('base64url'); return p + '.' + sign(p); }
function validToken(t) {
  if (typeof t !== 'string' || !t.includes('.')) return false;
  const [p, s] = t.split('.');
  const good = sign(p);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > Date.now(); } catch (e) { return false; }
}
function requireAdmin(req, res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ') && validToken(h.slice(7))) return next();
  res.status(401).json({ error: 'Not signed in.' });
}

async function sendEmail({ to, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM || (C.business.name + ' <onboarding@resend.dev>'), to: [to], subject, html, reply_to: replyTo })
  });
  if (!r.ok) throw new Error('Email service returned ' + r.status);
  return { sent: true };
}

let stripeClient = null;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

/* ---------- Leads (shared by the form and the chat assistant) ---------- */
const CONVERSION_TYPES = ['call', 'text', 'quote', 'chat_open', 'chat_lead', 'form_lead', 'upgrade_accept', 'reviews'];
function recordConversion(type, source, sid, pagePath, extra) {
  if (!CONVERSION_TYPES.includes(type)) return;
  store.conversions.push(Object.assign({ t: Date.now(), type, source: clean(source, 40) || 'unknown', sid: clean(sid, 40), page: clean(pagePath, 200).split('?')[0] }, extra || {}));
  if (store.conversions.length > 30000) store.conversions.splice(0, store.conversions.length - 30000);
  saveSoon('conversions');
}

function validateLead(b) {
  const name = clean(b.name, 120), phone = clean(b.phone, 40), email = clean(b.email, 200);
  if (!name) return { error: 'Please enter your name.' };
  if (phone.replace(/\D/g, '').length < 8) return { error: 'Please enter a phone number we can call.' };
  if (email && !emailOk(email)) return { error: 'That email address does not look right.' };
  const pd = clean(b.preferredDate, 10);
  return { fields: { name, phone, email, suburb: clean(b.suburb, 80), service: clean(b.service, 80), message: clean(b.message, 2000), preferredDate: isDate(pd) ? pd : '' } };
}

function createLead(fields, meta) {
  const lead = Object.assign({
    id: newId(), createdAt: new Date().toISOString(), status: 'new', source: meta.source || 'website',
    page: clean(meta.page, 200), chatId: meta.chatId || '', upgrade: null,
    scheduledDate: '', scheduledTime: '', value: null, notes: ''
  }, fields);
  store.leads.unshift(lead);
  save('leads');
  recordConversion(meta.source === 'chatbot' ? 'chat_lead' : 'form_lead', meta.source === 'chatbot' ? 'chat' : 'form', meta.sid, meta.page);
  const to = settings().notifyEmail;
  if (to) {
    sendEmail({
      to, replyTo: lead.email || undefined, subject: `New ${lead.source === 'chatbot' ? 'chat lead' : 'quote request'}: ${lead.service || 'Electrical'} (${lead.name})`,
      html: `<h2>New ${lead.source === 'chatbot' ? 'chat lead' : 'quote request'}</h2><p><b>${escHtml(lead.name)}</b><br>Phone: ${escHtml(lead.phone)}<br>Email: ${escHtml(lead.email || 'not given')}<br>Suburb: ${escHtml(lead.suburb || 'not given')}<br>Service: ${escHtml(lead.service || 'not given')}<br>Preferred date: ${escHtml(lead.preferredDate || 'not given')}</p><p>${escHtml(lead.message || '(no message)')}</p><p><a href="${SITE_URL}/admin.html">Open the dashboard</a></p>`
    }).catch((e) => console.error('lead email failed:', e.message));
  }
  return lead;
}

/* ---------- App ---------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (process.env.NOINDEX === '1') res.setHeader('X-Robots-Tag', 'noindex, nofollow'); // demo sites must not compete with the client's real site
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  next();
});

/* Stripe webhook needs the raw body, so it is registered before express.json(). */
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const s = stripe(), secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return res.status(503).end();
  let event;
  try { event = s.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret); } catch (e) { return res.status(400).send('Bad signature'); }
  if (event.type === 'checkout.session.completed') {
    const lead = store.leads.find((l) => l.id === (event.data.object.metadata || {}).leadId);
    if (lead) { lead.payment = Object.assign(lead.payment || {}, { status: 'paid', paidAt: new Date().toISOString() }); save('leads'); }
  }
  res.json({ received: true });
});

app.use(express.json({ limit: '20kb' }));

/* ----- Public API ----- */
app.post('/api/leads', (req, res) => {
  const b = req.body || {};
  if (clean(b.website, 200)) return res.json({ ok: true }); // honeypot: pretend success to bots
  if (limited('lead:' + req.ip, 6, 3600000)) return res.status(429).json({ error: 'Too many requests. Please call us instead.' });
  const v = validateLead(b);
  if (v.error) return res.status(400).json({ error: v.error });
  createLead(v.fields, { source: 'website', page: b.page, sid: b.sid });
  res.json({ ok: true });
});

app.post('/api/track', (req, res) => {
  res.status(204).end();
  const ua = req.headers['user-agent'] || '';
  if (!ua || /bot|crawl|spider|slurp|headless|lighthouse|monitor/i.test(ua)) return;
  const b = req.body || {};
  const p = clean(b.path, 200).split('?')[0];
  if (!p.startsWith('/') || p.startsWith('/admin')) return;
  if (limited('track:' + req.ip, 120, 3600000)) return;
  let ref = '';
  try { ref = b.ref ? new URL(String(b.ref)).hostname.replace(/^www\./, '') : ''; } catch (e) { ref = ''; }
  if (ref === new URL(SITE_URL).hostname.replace(/^www\./, '')) ref = '';
  store.traffic.push({ t: Date.now(), p, r: ref.slice(0, 80), d: /mobile|android|iphone/i.test(ua) ? 'Mobile' : /ipad|tablet/i.test(ua) ? 'Tablet' : 'Desktop', s: clean(b.sid, 40) });
  if (store.traffic.length > 30000) store.traffic.splice(0, store.traffic.length - 30000);
  saveSoon('traffic');
});

/* Conversion clicks: call, text, quote buttons and chat events. */
app.post('/api/convert', (req, res) => {
  res.status(204).end();
  const ua = req.headers['user-agent'] || '';
  if (!ua || /bot|crawl|spider|headless/i.test(ua)) return;
  if (limited('conv:' + req.ip, 60, 3600000)) return;
  const b = req.body || {};
  recordConversion(clean(b.type, 20), b.source, b.sid, b.page);
});

/* ----- Chat assistant ----- */
function chatChips() {
  if (C.chat.chips && C.chat.chips.length) return C.chat.chips.slice(0, 6);
  const em = C.services.find((x) => x.emergency);
  return [].concat(em ? ['I need an emergency call-out'] : [], C.services.filter((x) => !x.emergency).slice(0, 3).map((x) => 'Quote for ' + x.name.toLowerCase()), ['How much do you charge?']).slice(0, 5);
}
app.get('/api/chat/config', (req, res) => {
  const s = settings();
  res.json({ enabled: s.chatEnabled !== false, ai: chat.hasKey(), chips: chatChips() });
});

function chatRecord(sid, pagePath) {
  let c = store.chats.find((x) => x.sid === sid);
  if (!c) {
    c = { id: newId(), sid, startedAt: new Date().toISOString(), updatedAt: '', page: clean(pagePath, 200), mode: chat.hasKey() ? 'ai' : 'scripted', messages: [], leadId: '', upgrade: null };
    store.chats.unshift(c);
    if (store.chats.length > 2000) store.chats.length = 2000;
  }
  return c;
}

app.post('/api/chat', async (req, res) => {
  const s = settings();
  if (s.chatEnabled === false) return res.json({ reply: `Chat is offline right now. Please call or text ${C.business.phone}.`, offline: true });
  const b = req.body || {};
  const sid = clean(b.sid, 40);
  if (!sid) return res.status(400).json({ error: 'Missing session.' });
  if (limited('chat:' + req.ip, 40, 600000)) return res.status(429).json({ error: `You are sending messages quickly. Please call or text ${C.business.phone}.` });
  const incoming = Array.isArray(b.messages) ? b.messages.slice(-14) : [];
  const history = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
  const last = history[history.length - 1];
  if (!last || last.role !== 'user' || !last.content.trim()) return res.status(400).json({ error: 'Say something and I will help.' });

  const rec = chatRecord(sid, b.page);
  if (rec.messages.length >= 60) return res.json({ reply: `We have covered a lot. Please call or text ${C.business.phone} and the team will take it from here.` });
  rec.messages.push({ role: 'user', content: last.content, t: Date.now() });

  let savedLead = null;
  const deps = {
    saveLead(args) {
      if (savedLead || rec.leadId) return { ok: true, lead: store.leads.find((l) => l.id === rec.leadId) || savedLead };
      const v = validateLead({ name: args.name, phone: args.phone, email: args.email, suburb: args.suburb, service: args.service, message: args.message });
      if (v.error) return { ok: false, error: v.error };
      savedLead = createLead(v.fields, { source: 'chatbot', page: rec.page, sid, chatId: rec.id });
      rec.leadId = savedLead.id;
      return { ok: true, lead: savedLead };
    }
  };

  let out;
  try {
    if (chat.hasKey()) { out = await chat.aiTurn(history, s.offers, deps); rec.mode = 'ai'; }
    else { out = chat.scripted(b.state, last.content, deps); rec.mode = 'scripted'; }
  } catch (e) {
    console.error('chat AI failed, using scripted fallback:', e.message);
    out = chat.scripted(b.state, last.content, deps);
    out.reply = out.reply;
    rec.mode = 'scripted-fallback';
  }
  rec.messages.push({ role: 'assistant', content: out.reply, t: Date.now() });
  rec.updatedAt = new Date().toISOString();
  saveSoon('chats');

  let offer = null;
  const activeOffers = (s.offers || []).filter((o) => o.active);
  if (savedLead && activeOffers.length && !rec.upgrade) offer = { id: activeOffers[0].id, title: activeOffers[0].title, body: activeOffers[0].body };
  res.json({ reply: out.reply, state: out.state, leadSaved: !!savedLead, offer });
});

app.post('/api/chat/upgrade', (req, res) => {
  const b = req.body || {};
  const sid = clean(b.sid, 40);
  const rec = store.chats.find((x) => x.sid === sid);
  const offer = (settings().offers || []).find((o) => o.id === b.offerId);
  if (!rec || !offer) return res.status(400).json({ error: 'Unknown offer.' });
  const accepted = b.accepted === true;
  rec.upgrade = { offerId: offer.id, title: offer.title, accepted, t: new Date().toISOString() };
  const lead = store.leads.find((l) => l.id === rec.leadId);
  if (lead) { lead.upgrade = { offerId: offer.id, title: offer.title, accepted }; save('leads'); }
  if (accepted) recordConversion('upgrade_accept', 'chat', sid, rec.page, { offer: offer.id });
  saveSoon('chats');
  res.json({ ok: true, reply: accepted ? `Done. I have noted ${offer.title} on your request and the team will confirm details and price when they call.` : 'No problem. The team will still call you back shortly.' });
});

/* ----- Admin API ----- */
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_HASH) return res.status(503).json({ error: 'Admin login is not configured.' });
  if (limited('login:' + req.ip, 8, 900000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const given = crypto.createHash('sha256').update(String((req.body || {}).password || '')).digest('hex');
  const ok = given.length === ADMIN_HASH.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(ADMIN_HASH));
  if (!ok) return res.status(401).json({ error: 'Wrong password.' });
  res.json({ token: makeToken(), expiresInMs: TOKEN_TTL_MS });
});

app.get('/api/leads', requireAdmin, (req, res) => res.json({ leads: store.leads }));

const STATUSES = ['new', 'contacted', 'quoted', 'booked', 'completed', 'cancelled'];
app.post('/api/leads/manual', requireAdmin, (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 120);
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const lead = {
    id: newId(), createdAt: new Date().toISOString(), status: 'booked', source: 'manual',
    name, phone: clean(b.phone, 40), email: clean(b.email, 200), suburb: clean(b.suburb, 80), service: clean(b.service, 80),
    message: clean(b.message, 2000), preferredDate: '', page: '', chatId: '', upgrade: null,
    scheduledDate: isDate(clean(b.scheduledDate, 10)) ? clean(b.scheduledDate, 10) : '', scheduledTime: isTime(clean(b.scheduledTime, 5)) ? clean(b.scheduledTime, 5) : '',
    value: Number.isFinite(Number(b.value)) && b.value !== '' ? Number(b.value) : null, notes: ''
  };
  store.leads.unshift(lead); save('leads'); res.json({ lead });
});

app.patch('/api/leads/:id', requireAdmin, (req, res) => {
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  const b = req.body || {};
  if (b.status !== undefined) { if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status.' }); lead.status = b.status; }
  if (b.notes !== undefined) lead.notes = clean(b.notes, 4000);
  if (b.scheduledDate !== undefined) lead.scheduledDate = b.scheduledDate === '' ? '' : (isDate(b.scheduledDate) ? b.scheduledDate : lead.scheduledDate);
  if (b.scheduledTime !== undefined) lead.scheduledTime = b.scheduledTime === '' ? '' : (isTime(b.scheduledTime) ? b.scheduledTime : lead.scheduledTime);
  if (b.value !== undefined) lead.value = b.value === '' || b.value === null ? null : (Number.isFinite(Number(b.value)) ? Number(b.value) : lead.value);
  for (const k of ['name', 'phone', 'email', 'suburb', 'service']) if (b[k] !== undefined) lead[k] = clean(b[k], k === 'email' ? 200 : 120);
  lead.updatedAt = new Date().toISOString();
  save('leads'); res.json({ lead });
});

app.delete('/api/leads/:id', requireAdmin, (req, res) => {
  const i = store.leads.findIndex((l) => l.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Lead not found.' });
  store.leads.splice(i, 1); save('leads'); res.json({ ok: true });
});

app.get('/api/chats', requireAdmin, (req, res) => res.json({ chats: store.chats.slice(0, 200) }));

app.get('/api/blocked', requireAdmin, (req, res) => res.json({ blocked: store.blocked }));
app.post('/api/blocked', requireAdmin, (req, res) => {
  const date = clean((req.body || {}).date, 10), reason = clean((req.body || {}).reason, 120);
  if (!isDate(date)) return res.status(400).json({ error: 'Choose a valid date.' });
  if (!store.blocked.some((b) => b.date === date)) { store.blocked.push({ date, reason }); save('blocked'); }
  res.json({ blocked: store.blocked });
});
app.delete('/api/blocked/:date', requireAdmin, (req, res) => {
  store.blocked = store.blocked.filter((b) => b.date !== req.params.date); save('blocked'); res.json({ blocked: store.blocked });
});

app.get('/api/traffic', requireAdmin, (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
  const since = Date.now() - days * 86400000;
  const rows = store.traffic.filter((r) => r.t >= since);
  const tally = (key) => { const m = {}; rows.forEach((r) => { const k = r[key] || (key === 'r' ? 'Direct' : '(unknown)'); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })); };
  const daily = {};
  for (let i = days - 1; i >= 0; i--) daily[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
  rows.forEach((r) => { const d = new Date(r.t).toISOString().slice(0, 10); if (d in daily) daily[d]++; });
  res.json({ days, views: rows.length, sessions: new Set(rows.map((r) => r.s)).size, daily: Object.entries(daily).map(([date, views]) => ({ date, views })), pages: tally('p'), sources: tally('r'), devices: tally('d') });
});

app.get('/api/conversions', requireAdmin, (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
  const since = Date.now() - days * 86400000;
  const rows = store.conversions.filter((r) => r.t >= since);
  const totals = {}, bySource = {}, daily = {};
  for (let i = days - 1; i >= 0; i--) daily[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
  rows.forEach((r) => {
    totals[r.type] = (totals[r.type] || 0) + 1;
    const k = r.type + '|' + r.source; bySource[k] = (bySource[k] || 0) + 1;
    if (['call', 'text', 'chat_lead', 'form_lead'].includes(r.type)) { const d = new Date(r.t).toISOString().slice(0, 10); if (d in daily) daily[d]++; }
  });
  const sessions = new Set(store.traffic.filter((r) => r.t >= since).map((r) => r.s)).size;
  const actions = (totals.call || 0) + (totals.text || 0) + (totals.chat_lead || 0) + (totals.form_lead || 0);
  const actionSessions = new Set(rows.filter((r) => ['call', 'text', 'chat_lead', 'form_lead'].includes(r.type) && r.sid).map((r) => r.sid)).size;
  res.json({
    days, totals, sessions, actions, rate: sessions ? Math.min(100, +(actionSessions / sessions * 100).toFixed(1)) : 0,
    bySource: Object.entries(bySource).map(([k, count]) => { const [type, source] = k.split('|'); return { type, source, count }; }).sort((a, b) => b.count - a.count).slice(0, 30),
    daily: Object.entries(daily).map(([date, count]) => ({ date, count })),
    chats: store.chats.filter((c) => Date.parse(c.startedAt) >= since).length
  });
});

app.get('/api/settings', requireAdmin, (req, res) => res.json({ settings: settings(), integrations: { stripe: !!process.env.STRIPE_SECRET_KEY, stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET, resend: !!process.env.RESEND_API_KEY, from: process.env.RESEND_FROM || '', deepseek: chat.hasKey(), deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat' } }));
app.put('/api/settings', requireAdmin, (req, res) => {
  const b = req.body || {}, email = clean(b.notifyEmail, 200);
  if (email && !emailOk(email)) return res.status(400).json({ error: 'Enter a valid notification email.' });
  const pct = Number(b.depositPercent);
  const offers = Array.isArray(b.offers) ? b.offers.slice(0, 6).map((o, i) => ({ id: clean(o.id, 30) || 'offer-' + (i + 1), title: clean(o.title, 80), body: clean(o.body, 300), active: o.active === true })).filter((o) => o.title) : settings().offers;
  store.settings = { notifyEmail: email, depositPercent: Number.isFinite(pct) ? Math.min(Math.max(pct, 1), 100) : 20, businessName: clean(b.businessName, 80) || C.business.name, chatEnabled: b.chatEnabled === undefined ? settings().chatEnabled !== false : b.chatEnabled !== false, offers };
  save('settings'); res.json({ settings: settings() });
});

async function makeCheckout(lead, amount, description) {
  const s = stripe();
  if (!s) throw Object.assign(new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to the server environment.'), { status: 503 });
  const session = await s.checkout.sessions.create({
    mode: 'payment', customer_email: lead.email || undefined,
    line_items: [{ quantity: 1, price_data: { currency: 'aud', unit_amount: Math.round(amount * 100), product_data: { name: description } } }],
    success_url: SITE_URL + '/?payment=success', cancel_url: SITE_URL + '/?payment=cancelled', metadata: { leadId: lead.id }
  });
  lead.payment = { status: 'requested', amount, url: session.url, sessionId: session.id, createdAt: new Date().toISOString() };
  save('leads');
  return session.url;
}
function payInput(req, res) {
  const lead = store.leads.find((l) => l.id === (req.body || {}).leadId);
  const amount = Number((req.body || {}).amount);
  if (!lead) { res.status(404).json({ error: 'Lead not found.' }); return null; }
  if (!Number.isFinite(amount) || amount < 1 || amount > 50000) { res.status(400).json({ error: 'Enter an amount between $1 and $50,000.' }); return null; }
  return { lead, amount, description: clean((req.body || {}).description, 120) || `${lead.service || 'Electrical work'} deposit` };
}
app.post('/api/create-checkout', requireAdmin, async (req, res) => {
  const p = payInput(req, res); if (!p) return;
  try { res.json({ url: await makeCheckout(p.lead, p.amount, p.description) }); }
  catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});
app.post('/api/send-deposit-email', requireAdmin, async (req, res) => {
  const p = payInput(req, res); if (!p) return;
  if (!p.lead.email) return res.status(400).json({ error: 'This lead has no email address.' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email is not configured. Add RESEND_API_KEY to the server environment.' });
  try {
    const url = await makeCheckout(p.lead, p.amount, p.description);
    await sendEmail({
      to: p.lead.email, replyTo: C.business.email, subject: `Your ${C.business.name} deposit request`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:${C.brand.ink}"><h2 style="margin:0 0 12px">Hi ${escHtml(p.lead.name.split(' ')[0])},</h2><p>Thanks for choosing ${C.business.name}. To lock in your booking${p.lead.scheduledDate ? ' on ' + escHtml(p.lead.scheduledDate) : ''}, please pay the deposit of <b>$${p.amount.toFixed(2)} AUD</b> for: ${escHtml(p.description)}.</p><p style="margin:24px 0"><a href="${escHtml(url)}" style="background:${C.brand.primary};color:${C.brand.onPrimary};padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:700">Pay deposit securely</a></p><p>Questions? Call ${C.business.phone} or reply to this email.</p><p style="color:#666;font-size:13px">${C.business.legalName}. ${C.business.licenceLine}${C.business.abn ? ' ' + C.business.abnLabel + ' ' + C.business.abn + '.' : ''}</p></div>`
    });
    p.lead.payment.emailedAt = new Date().toISOString(); save('leads');
    res.json({ ok: true, url });
  } catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});

/* Public, non-secret info the admin dashboard needs to brand itself. */
app.get('/api/site-meta', (req, res) => res.json({
  name: C.business.name, logo: '/images/' + (C.images.logo || 'logo.webp'), services: C.formServices,
  brand: { primary: C.brand.primary, ink: C.brand.ink, accentText: C.brand.accentText, primaryTint: C.brand.primaryTint, surface: C.brand.surface, border: C.brand.border, onPrimary: C.brand.onPrimary, hazard: C.brand.hazard },
  fontsUrl: C.fontsUrl(), fonts: { display: C.brand.fonts.displayFamily, body: C.brand.fonts.bodyFamily }
}));

/* ---------- Site ---------- */
app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '7d', setHeaders: (res, p) => { if (p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css')) res.setHeader('Cache-Control', 'no-cache'); } }));

const pages = pagesLib.buildAll();
const sendHtml = (res, html, status) => res.status(status || 200).type('html').set('Cache-Control', 'no-cache').send(html);

app.get('/robots.txt', (req, res) => res.type('text/plain').send(process.env.NOINDEX === '1' ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const urls = [...pages.keys()].map((p) => `<url><loc>${SITE_URL}${p === '/' ? '/' : p}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

app.get('*', (req, res) => {
  const p = req.path;
  if (p.length > 1 && p.endsWith('/')) return res.redirect(301, p.replace(/\/+$/, '') + req.url.slice(req.path.length));
  if (p === '/index.html') return res.redirect(301, '/');
  if (pages.has(p)) return sendHtml(res, pages.get(p));
  sendHtml(res, pagesLib.notFound(), 404);
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

app.listen(PORT, () => console.log(`${C.business.name} listening on :${PORT} (${pages.size} pages, chat: ${chat.hasKey() ? 'DeepSeek' : 'scripted fallback'})`));
