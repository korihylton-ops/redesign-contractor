#!/usr/bin/env node
/* Exhaustive real-interaction audit for a running generated site.
     node scripts/click-audit.mjs [--url https://the-site] [--pages 8]

   Why this exists alongside qa.mjs: qa.mjs proves the machinery works (pages return 200, a lead
   reaches the admin, the chatbot answers). It does not prove that every button a visitor can see
   actually *does something they can see*. This script clicks every anchor and button on every page
   and judges the result the way a person would.

   The rule that motivated it: on any device with no mail or phone app registered (most desktops,
   every headless browser) a mailto:/tel:/sms: button produces no navigation, no error and no visible
   feedback, which is indistinguishable from a dead button. So a prominent mailto: .btn always FAILS.
   A tel:/sms: .btn is clicked for real and passes only if the page then shows the visitor the number
   (the engine's desktop number panel); otherwise it FAILS too. Bare inline contact text is fine,
   because the address itself is readable and copyable even when the handoff silently does nothing. */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const SITE = opt('url', 'http://localhost:3000').replace(/\/$/, '');
const MAX_PAGES = Number(opt('pages', 8));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

const results = [];
const manual = [];
let events = [];
p.on('popup', (pg) => events.push('POPUP:' + pg.url()));
p.on('dialog', async (d) => { events.push('DIALOG:' + d.message()); await d.dismiss(); });
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.|Failed to load resource/.test(m.text())) events.push('CONSOLE_ERROR:' + m.text()); });
p.on('pageerror', (e) => events.push('PAGE_ERROR:' + e.message));

const log = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const errsIn = (ev) => ev.filter((e) => /ERROR/.test(e));

/* Pages come from the site's own sitemap, so a site with suburb and blog pages is covered too. */
const sitemap = await ctx.request.get(SITE + '/sitemap.xml').catch(() => null);
const urls = sitemap && sitemap.ok() ? [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : [SITE + '/'];
const PAGES = [...new Set(urls.map((u) => new URL(u).pathname))].slice(0, MAX_PAGES);

async function go(path) {
  events = [];
  await p.goto(SITE + path, { waitUntil: 'domcontentloaded' });
  // Entrance animations and marquees keep nodes moving for a moment, and Playwright refuses to
  // click anything it considers unstable. Let the page settle before touching it.
  await p.waitForTimeout(1200);
  await p.$$eval('a[href], button', (els) => els.forEach((e, i) => e.setAttribute('data-audit', String(i))));
}

/* Clicks the way a determined visitor would, with two fallbacks for elements a person has no
   trouble with: anything still drifting in a marquee (force click), and the accessibility skip
   link, which sits off-screen until focused and so is reached by focus + Enter. */
async function clickAudited(idx) {
  const loc = p.locator(`[data-audit="${idx}"]`);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  try { await loc.click({ timeout: 1500 }); return ''; }
  catch {
    try { await loc.click({ timeout: 4000, force: true }); return ' (forced click: element animating)'; }
    catch { await loc.focus(); await p.keyboard.press('Enter'); return ' (keyboard activation: off-screen skip link)'; }
  }
}

/* Each navigation destination is clicked for real once per page (and header/footer links once per
   site). Repeats of the same href, such as the two copies of a suburb marquee, inherit that result.
   A full sweep otherwise reloads the page hundreds of times for identical links and takes hours. */
const siteWide = new Map();
for (const path of PAGES) {
  const seen = new Map();
  console.log(`\n\n########## PAGE ${path} ##########`);
  await go(path);
  const items = await p.$$eval('a[href], button', (els) => els.map((e) => ({
    idx: e.getAttribute('data-audit'),
    tag: e.tagName.toLowerCase(),
    text: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    href: e.getAttribute('href'),
    isBtn: /\bbtn\b/.test(e.className || ''),
    visible: !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length),
    inChrome: !!e.closest('header, footer, .head, .foot'),
  })));
  console.log(`(${items.length} clickable elements)`);

  for (const it of items) {
    const label = `${path} ${it.tag}"${it.text || '(no text)'}"${it.href ? ' -> ' + it.href : ''}`;
    if (it.tag === 'a' && it.href && !it.href.startsWith('#') && !/^(tel:|sms:|mailto:)/.test(it.href)) {
      const prev = seen.has(it.href) ? seen.get(it.href) : it.inChrome && siteWide.has(it.href) ? siteWide.get(it.href) : null;
      if (prev !== null) { const r = results[prev]; log(label, !!(r && r.ok), 'same destination as an earlier real click' + (r && !r.ok ? ' (which FAILED)' : '')); continue; }
      seen.set(it.href, results.length);
      if (it.inChrome) siteWide.set(it.href, results.length);
    }
    // Any previous click may have navigated away, and every check below reads this page's DOM.
    await go(path);

    if (it.href && /^(mailto:|tel:|sms:)/.test(it.href)) {
      if (!it.isBtn) { log(label, true, 'inline scheme link on readable text (acceptable)'); continue; }
      if (/^mailto:/.test(it.href)) { log(label, false, 'PROMINENT BUTTON using mailto: — shows nothing on a device with no mail client'); continue; }
      // tel:/sms: dial on a phone. On a desktop with no phone app they only count as working if the
      // page itself shows the visitor something (the engine's number panel). Click it for real,
      // with the external navigation blocked, and judge what appears on screen.
      if (!it.visible) { log(label, true, 'phone scheme, hidden in default state'); continue; }
      await p.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a[href^="tel:"],a[href^="sms:"]')) e.preventDefault(); }));
      try { await clickAudited(it.idx); await p.waitForTimeout(500); }
      catch (e) { log(label, false, 'CLICK THREW: ' + e.message.split('\n')[0]); continue; }
      const shown = await p.evaluate(() => { const t = document.querySelector('[data-num-toast]'); return !!(t && !t.hidden && t.offsetHeight && /\d{3}/.test(t.textContent)); });
      log(label, shown, shown ? 'dials on a phone; on desktop shows the number with a copy button' : 'PROMINENT phone BUTTON with no visible result on a desktop without a phone app');
      continue;
    }

    if (it.href && it.href.startsWith('#')) {
      const id = it.href.slice(1);
      if (!id) { log(label, false, 'empty hash — goes nowhere'); continue; }
      if (!(await p.evaluate((i) => !!document.getElementById(i), id))) { log(label, false, `target #${id} DOES NOT EXIST on this page — dead link`); continue; }
      if (!it.visible) { log(label, true, 'target exists; element hidden in default state'); continue; }
      events = [];
      const beforeY = await p.evaluate(() => window.scrollY);
      let note = '';
      try {
        note = await clickAudited(it.idx);
        // Wait for the scroll to finish (it can be long on a big page), not a fixed guess: judge where
        // the visitor ends up, which is also what exposes a scroll that stops short and stays there.
        await p.waitForTimeout(400);
        // Sample, wait, compare in Node: a Promise returned to waitForFunction is not reliably awaited,
        // which made this judge mid-glide. Settled = no movement across 700ms, capped at 10s.
        for (let waited = 0, y = await p.evaluate(() => window.scrollY); waited < 10000; waited += 700) {
          await p.waitForTimeout(700);
          const y2 = await p.evaluate(() => window.scrollY);
          if (Math.abs(y2 - y) < 1) break;
          y = y2;
        }
      }
      catch (e) { log(label, false, 'CLICK THREW: ' + e.message.split('\n')[0]); continue; }
      // What a visitor judges: is the thing I clicked towards now on screen? Not an exact scroll
      // number — a sticky header plus scroll-margin-top legitimately stops short of the raw offset.
      const onScreen = await p.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }, id);
      const afterY = await p.evaluate(() => window.scrollY);
      log(label, onScreen && !errsIn(events).length, `scrollY ${beforeY}->${afterY}, target on screen=${onScreen}${note} ${errsIn(events).join('|')}`);
      continue;
    }

    if (it.href && /^https?:\/\//.test(it.href) && !it.href.startsWith(SITE)) {
      // A Google Maps directions link always answers 200, even when the destination is nonsense
      // ("Australia, Australia" from a config with no street address). Judge the destination, not
      // the status code — this is precisely the failure a status check cannot see.
      const dest = /google\.[a-z.]+\/maps/.test(it.href) ? new URL(it.href).searchParams.get('destination') : null;
      if (dest !== null) {
        const parts = [...new Set(dest.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
        log(label, parts.length >= 2, parts.length >= 2 ? `destination="${dest}"` : `MEANINGLESS MAP DESTINATION "${dest}" — too vague to give directions to (returns 200 anyway)`);
        continue;
      }
      const res = await ctx.request.get(it.href, { timeout: 20000 }).catch((e) => ({ err: e.message }));
      // Facebook, Instagram, LinkedIn and TikTok answer 400/403/429 to every automated request, real
      // page or not, so the status code proves nothing either way. Don't call these dead or working:
      // list them under CHECK BY HAND so a person opens each one once in a real browser.
      const st = res && res.status ? res.status() : 0;
      if (/(^|\.)(facebook|instagram|linkedin|tiktok)\.com$/i.test(new URL(it.href).hostname) && [400, 403, 429, 999].includes(st)) {
        if (!manual.includes(it.href)) manual.push(it.href);
        log(label, true, `status=${st}: social network refuses automated browsers; listed under CHECK BY HAND`);
        continue;
      }
      log(label, !!(res && res.ok && res.ok()), st ? 'status=' + st : 'unreachable: ' + (res && res.err));
      continue;
    }

    if (it.tag === 'a' && it.href) {
      if (!it.visible) { log(label, true, 'hidden in default state — skipped'); continue; }
      if (it.href.replace(/\/$/, '') === path.replace(/\/$/, '')) { log(label, true, 'self-link (nav item for the current page)'); continue; }
      events = [];
      let note = '';
      try {
        note = await clickAudited(it.idx);
        await p.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(600);
      } catch (e) { log(label, false, 'CLICK THREW: ' + e.message.split('\n')[0]); continue; }
      const nowUrl = p.url();
      const h1 = await p.locator('h1').first().innerText().catch(() => '');
      const is404 = /not found|404/i.test(h1) || /404/.test(await p.title());
      const samePage = nowUrl.replace(/\/$/, '') === (SITE + path).replace(/\/$/, '');
      log(label, !samePage && !is404, `landed=${nowUrl} h1="${h1.slice(0, 50)}"${note}`);
      continue;
    }

    log(label, true, 'form/widget button — covered by the dedicated tests below');
  }
}

/* ---------- chat widget: open, use its CTAs, hold a real exchange, close ---------- */
console.log('\n\n########## CHAT WIDGET ##########');
await go('/');
try {
  await p.locator('.chat__launch').click({ timeout: 5000 });
  await p.waitForTimeout(500);
  log('chat: panel opens on launcher click', await p.locator('#chat-panel').isVisible());

  // These CTAs live inside the panel, so the page sweep above saw them as invisible.
  const ctas = await p.$$eval('.chat__cta a', (els) => els.map((e) => ({ text: e.textContent.trim(), href: e.getAttribute('href'), isBtn: /\bbtn\b/.test(e.className) })));
  log('chat: panel offers at least one CTA', ctas.length > 0);
  for (const c of ctas) {
    if (/^(mailto:|sms:|tel:)/.test(c.href || '')) {
      // tel:/sms: is the right affordance on a phone; mailto: on a button is the dead-button trap.
      log(`chat CTA "${c.text}" -> ${c.href}`, !/^mailto:/.test(c.href), /^mailto:/.test(c.href) ? 'mailto: on a chat BUTTON — no visible result without a mail client' : 'phone scheme, valid on mobile');
      continue;
    }
    const beforeY = await p.evaluate(() => window.scrollY);
    await p.locator(`.chat__cta a[href="${c.href}"]`).first().click();
    await p.waitForTimeout(1100);
    const onScreen = await p.evaluate((h) => { const el = document.getElementById(h.replace('#', '')); return !!el && el.getBoundingClientRect().top < window.innerHeight; }, c.href);
    log(`chat CTA "${c.text}" -> ${c.href}`, onScreen, `scrollY ${beforeY}->${await p.evaluate(() => window.scrollY)}`);
    if (!(await p.locator('#chat-panel').isVisible())) await p.locator('.chat__launch').click();
  }

  await p.locator('#chat-input').fill('What services do you offer?');
  await p.locator('.chat__form button[type=submit]').click();
  await p.waitForTimeout(8000);
  const msgs = await p.locator('.chat__log').innerText();
  log('chat: assistant replies to a real question', msgs.trim().length > 40 && !/sorry, something/i.test(msgs), `reply chars=${msgs.trim().length}`);

  await p.locator('.chat__close').click();
  await p.waitForTimeout(400);
  log('chat: panel closes', !(await p.locator('#chat-panel').isVisible()));
} catch (e) { log('chat widget', false, 'THREW: ' + e.message.split('\n')[0]); }

/* ---------- quote form: a real submit must produce a real confirmation ---------- */
console.log('\n\n########## QUOTE FORM ##########');
await go('/');
try {
  const form = p.locator('form.js-lead').first();
  await form.scrollIntoViewIfNeeded();
  for (const [sel, val] of [['#f-name', 'Audit Bot'], ['#f-phone', '0400000000'], ['#f-email', 'audit@example.com'], ['#f-suburb', 'Test'], ['#f-msg', 'Automated click audit — please ignore.']]) {
    await form.locator(sel).fill(val).catch(() => {});
  }
  await form.locator('#f-service').selectOption({ index: 1 }).catch(() => {});
  await form.locator('button[type=submit]').click();
  await p.waitForTimeout(3000);
  const status = await form.locator('.form__status').innerText();
  const cls = await form.locator('.form__status').getAttribute('class');
  log('quote form: submit shows a real success message', /is-ok/.test(cls || '') && /thank/i.test(status), `status="${status}"`);
} catch (e) { log('quote form', false, 'THREW: ' + e.message.split('\n')[0]); }

console.log('\n\n===== SUMMARY =====');
const fails = results.filter((r) => !r.ok);
console.log(`${results.length} interactions, ${results.length - fails.length} passed, ${fails.length} FAILED`);
if (manual.length) { console.log('\nCHECK BY HAND (open each once in a real browser; automated requests are blocked):'); manual.forEach((u) => console.log('  - ' + u)); }
if (fails.length) { console.log('\nFAILURES:'); fails.forEach((f) => console.log('  -', f.name, '\n      ', f.detail)); }

await browser.close();
process.exit(fails.length ? 1 : 0);
