#!/usr/bin/env node
// Generic end-to-end QA for a running generated site.
//   node scripts/qa.mjs <projectDir> [--url http://localhost:3000] [--shots <dir>]
// Checks pages, console errors, unresolved tokens, duplicate ids, images, form -> admin lead, chat, conversion tracking, mobile overflow.
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const proj = path.resolve(argv.find((a) => !a.startsWith('--')) || '.');
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SITE = opt('url', 'http://localhost:3000').replace(/\/$/, '');
const shots = path.resolve(opt('shots', path.join(proj, 'qa-shots')));
fs.mkdirSync(shots, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(path.join(proj, 'content', 'config.json'), 'utf8'));
const PW = fs.readFileSync(path.join(proj, '.admin-password.txt'), 'utf8').trim();
const prefix = (cfg.trade && cfg.trade.slugPrefix) || '';
const { chromium } = await import('playwright');

const results = [];
const ok = (n, c, d = '') => results.push([c ? 'PASS' : 'FAIL', n, d]);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
process.on('uncaughtException', (e) => { results.forEach((r) => console.log(r.join(' '))); console.log('CRASH:', String(e.message).slice(0, 300)); process.exit(1); });

const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|ERR_|Failed to load resource|favicon/.test(m.text())) errs.push(m.text()); });

const paths = ['/', '/' + cfg.services[0].slug, '/' + prefix + cfg.suburbs[0].slug, '/' + prefix + cfg.regionPages[0].slug, '/robots.txt', '/sitemap.xml', '/admin.html'];
for (const u of paths) { const r = await ctx.request.get(SITE + u); ok('GET ' + u + ' is 200', r.status() === 200, String(r.status())); }
ok('unknown path is 404', (await ctx.request.get(SITE + '/no-such-page')).status() === 404);

await p.goto(SITE, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(shots, 'home.png') });
const html = await p.content();
ok('no unresolved {{tokens}} on home', !/\{\{\w+\}\}/.test(html), (html.match(/\{\{\w+\}\}/g) || []).slice(0, 3).join(','));
ok('no duplicate ids on home', await p.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.length === new Set(ids).size; }));
ok('hero image loaded', await p.evaluate(() => { const i = document.querySelector('.hero__photo img'); return !i || (i.complete && i.naturalWidth > 0); }));
ok('logo loaded', await p.evaluate(() => { const i = document.querySelector('.head__logo img'); return i.complete && i.naturalWidth > 0; }));
ok('brand colour applied', (await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim().toLowerCase())) === String(cfg.brand.primary).toLowerCase());
ok('Motion library loaded', await p.evaluate(() => !!window.Motion));
ok('services selector switches panels', await (async () => { const tabs = await p.$$('.breaker'); if (tabs.length < 2) return false; await tabs[1].click(); await p.waitForTimeout(500); return (await p.locator('#spec-1').isVisible()) && !(await p.locator('#spec-0').isVisible()); })());
ok('every configured suburb is linked', (await p.locator('.regions a').count()) === cfg.suburbs.length, `${await p.locator('.regions a').count()}/${cfg.suburbs.length}`);
for (const im of await p.locator('.work img').all()) await im.scrollIntoViewIfNeeded();
await p.waitForTimeout(1500);
ok('gallery images load', await p.$$eval('.work img', (a) => a.length > 0 && a.every((i) => i.complete && i.naturalWidth > 0)));

// form -> backend
await p.locator('#quote').scrollIntoViewIfNeeded();
await p.fill('#f-name', 'QA Tester'); await p.fill('#f-phone', '0400 123 456'); await p.fill('#f-msg', 'automated QA lead');
await p.click('.form button[type=submit]'); await p.waitForTimeout(900);
ok('lead form submits', /Thanks/.test(await p.locator('.form__status').textContent()));

// chat (uses DeepSeek if a key is configured, otherwise the scripted flow)
await p.click('.chat__launch'); await p.waitForTimeout(500);
ok('chat opens with greeting and chips', (await p.locator('.msg--bot').count()) === 1 && (await p.locator('.chat__chips button').count()) >= 3);
await p.locator('.chat__chips button').nth(1).click();
await p.waitForFunction(() => document.querySelectorAll('.msg--bot:not(.msg--typing)').length >= 2, null, { timeout: 45000 }).catch(() => {});
ok('chat replies', (await p.locator('.msg--bot:not(.msg--typing)').count()) >= 2);
// The chat CTAs are tel:/sms: for a business with a phone line and #quote jumps for one without,
// so click whatever is actually rendered rather than assuming a phone exists (that assumption used
// to hang for 30s and crash QA on email-only businesses).
await p.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a[href^="tel:"],a[href^="sms:"],a[href^="mailto:"]')) e.preventDefault(); }));
const chatCtas = await p.locator('.chat__cta a').all();
ok('chat panel offers at least one CTA', chatCtas.length > 0);
for (const c of chatCtas) await c.click().catch(() => {});
await p.click('.chat__close');
// .head__call is the header CTA whatever it resolves to (call, or a jump to the enquiry form).
await p.locator('.head__call').click(); await p.waitForTimeout(800);

// admin
const a = await ctx.newPage();
await a.goto(SITE + '/admin.html', { waitUntil: 'networkidle' });
await a.fill('input[type=password]', 'wrong-password'); await a.click('button[type=submit]'); await a.waitForTimeout(500);
ok('wrong admin password rejected', /Wrong password/.test(await a.locator('.msg').textContent()));
await a.fill('input[type=password]', PW); await a.click('button[type=submit]'); await a.waitForSelector('.tabs', { timeout: 8000 });
const token = await a.evaluate(() => sessionStorage.getItem('cx_admin'));
const get = async (u) => (await ctx.request.get(SITE + u, { headers: { Authorization: 'Bearer ' + token } })).json();
ok('admin shows the form lead', (await a.locator('.row', { hasText: 'QA Tester' }).count()) >= 1);
for (const tab of ['chats', 'calendar', 'traffic', 'settings']) { await a.click(`[data-tab=${tab}]`); await a.waitForTimeout(700); }
await a.screenshot({ path: path.join(shots, 'admin-settings.png'), fullPage: true });
const cv = await get('/api/conversions?days=30');
ok('conversions recorded: call, text, chat_open, form_lead', (cv.totals.call || 0) >= 2 && (cv.totals.text || 0) >= 1 && cv.totals.chat_open >= 1 && cv.totals.form_lead >= 1, JSON.stringify(cv.totals));
ok('admin has no page errors', errs.length === 0, errs.join(' | ').slice(0, 200));

// mobile
const m = await (await browser.newContext({ userAgent: UA, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
for (const u of ['/', '/' + cfg.services[0].slug, '/' + prefix + cfg.suburbs[0].slug]) {
  await m.goto(SITE + u, { waitUntil: 'networkidle' }); await m.waitForTimeout(1200);
  ok('mobile no horizontal overflow ' + u, await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), await m.evaluate(() => document.documentElement.scrollWidth + ' vs ' + innerWidth));
}
await m.goto(SITE, { waitUntil: 'networkidle' }); await m.waitForTimeout(1500); await m.screenshot({ path: path.join(shots, 'mobile-home.png') });
ok('mobile hamburger visible', await m.locator('.head__toggle').isVisible());

// cleanup + report
for (const l of (await get('/api/leads')).leads.filter((x) => x.name === 'QA Tester')) await ctx.request.delete(SITE + '/api/leads/' + l.id, { headers: { Authorization: 'Bearer ' + token } });
await browser.close();
results.forEach((r) => console.log(r.join(' ')));
const f = results.filter((r) => r[0] === 'FAIL');
console.log(`\n${results.length - f.length}/${results.length} passed`);
process.exit(f.length ? 1 : 0);
