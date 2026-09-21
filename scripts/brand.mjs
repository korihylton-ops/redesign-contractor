#!/usr/bin/env node
// Extract brand colours, fonts and the logo from a live site.   node scripts/brand.mjs <url> --out <dir>
// Writes <dir>/brand.json (suggested config.brand + candidates), <dir>/logo.<ext>, <dir>/original-home.png.
// Needs Playwright (npm i playwright && npx playwright install chromium).
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const url = argv.find((a) => /^https?:\/\//.test(a));
const oi = argv.indexOf('--out');
if (!url) { console.error('usage: brand.mjs <url> --out <dir>'); process.exit(1); }
const out = path.resolve(oi >= 0 ? argv[oi + 1] : './_scrape');
fs.mkdirSync(out, { recursive: true });

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' })).newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(out, 'original-home.png') });

const data = await page.evaluate(() => {
  const rgb = (s) => { const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const hex = (c) => '#' + c.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  const tally = { bg: {}, text: {}, action: {} };
  const bump = (bucket, s, w = 1) => { const c = rgb(s); if (!c || c[3] < 0.5) return; const h = hex(c); tally[bucket][h] = (tally[bucket][h] || 0) + w; };
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    bump('bg', cs.backgroundColor); bump('text', cs.color);
    if (el.matches('a[class*="btn"], a[class*="button"], button, [class*="btn"], [class*="cta"], input[type=submit]')) { bump('action', cs.backgroundColor, 5); bump('action', cs.borderTopColor, 2); }
    if (el.matches('h1, h2, h3, a')) bump('action', cs.color, 1);
  });
  const fonts = {};
  document.querySelectorAll('h1, h2, h3, p, a, li').forEach((el) => { const f = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim(); const k = el.tagName.match(/^H/) ? 'display' : 'body'; fonts[k] = fonts[k] || {}; fonts[k][f] = (fonts[k][f] || 0) + 1; });
  const themeColor = (document.querySelector('meta[name="theme-color"]') || {}).content || '';
  const logos = [...document.querySelectorAll('img')].filter((i) => /logo/i.test((i.src || '') + (i.alt || '') + (i.className || '') + (i.id || '')) || i.closest('header, .header, #header, .site-header, .navbar'))
    .map((i) => ({ src: i.currentSrc || i.src, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight, inHeader: !!i.closest('header, .header, #header, .site-header, .navbar') })).filter((i) => i.src && i.w > 40);
  const og = (document.querySelector('meta[property="og:image"]') || {}).content || '';
  const icon = (document.querySelector('link[rel~="icon"]') || {}).href || '';
  const social = [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => /facebook\.com|instagram\.com|youtube\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com|pinterest\.|yelp\.com|google\.com\/maps|g\.page/i.test(h));
  const tel = (document.querySelector('a[href^="tel:"]') || {}).href || '';
  const mail = (document.querySelector('a[href^="mailto:"]') || {}).href || '';
  return { tally, fonts, themeColor, logos, og, icon, social: [...new Set(social)], tel, mail };
});
await browser.close();

/* ---- colour maths ---- */
const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hsl = (h) => { const [r, g, b] = toRgb(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; const d = mx - mn; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); return { s, l }; };
const top = (obj, pred, n = 6) => Object.entries(obj).filter(([h]) => pred(hsl(h))).sort((a, b) => b[1] - a[1]).slice(0, n).map(([h, c]) => ({ hex: h, weight: c }));
const saturated = (c) => c.s > 0.35 && c.l > 0.22 && c.l < 0.78;
const primaryCands = top(data.tally.action, saturated).concat(top(data.tally.bg, saturated, 3));
const inkCands = top(data.tally.text, (c) => c.l < 0.22, 3).concat(top(data.tally.bg, (c) => c.l < 0.2, 3));
const surfaceCands = top(data.tally.bg, (c) => c.l > 0.93 && c.l < 0.995, 3);
const fontMain = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([f]) => f).filter((f) => !/^(-apple-system|system-ui|sans-serif|serif|Arial|Helvetica|Times|Georgia|Verdana|Tahoma)$/i.test(f))[0] || '';

const brand = {
  primary: (data.themeColor && saturated(hsl(data.themeColor)) ? data.themeColor : (primaryCands[0] || {}).hex) || '#1f6feb',
  ink: (inkCands[0] || {}).hex || '#111827',
  surface: (surfaceCands[0] || {}).hex || '#f6f8fa',
  fonts: { displayFamily: fontMain(data.fonts.display) || 'Inter', bodyFamily: fontMain(data.fonts.body) || 'Inter' },
  _note: 'Suggestions only. Review original-home.png and adjust. Fonts must exist on Google Fonts: set fonts.displayCss / bodyCss (e.g. "Poppins:wght@600;700;800").'
};

/* ---- logo download (largest header image, else og:image, else icon) ---- */
const logo = data.logos.sort((a, b) => (b.inHeader - a.inHeader) || (b.w * b.h - a.w * a.h))[0];
let logoFile = '';
for (const u of [logo && logo.src, data.og, data.icon].filter(Boolean)) {
  try {
    const r = await fetch(u); if (!r.ok) continue;
    const ct = r.headers.get('content-type') || '';
    const ext = /svg/.test(ct) ? 'svg' : /webp/.test(ct) ? 'webp' : /png/.test(ct) ? 'png' : /jpe?g/.test(ct) ? 'jpg' : (u.split('?')[0].split('.').pop() || 'png').toLowerCase();
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 500) continue;
    logoFile = 'logo.' + ext; fs.writeFileSync(path.join(out, logoFile), buf); break;
  } catch { /* try next */ }
}

const result = { brand, candidates: { primary: primaryCands.slice(0, 5), ink: inkCands, surface: surfaceCands, fonts: data.fonts }, logoFile, logoSource: logo ? logo.src : '', social: data.social, tel: data.tel.replace('tel:', ''), mail: data.mail.replace('mailto:', '').split('?')[0] };
fs.writeFileSync(path.join(out, 'brand.json'), JSON.stringify(result, null, 2));
console.log('brand:', JSON.stringify(brand));
console.log('logo:', logoFile || '(none found: get one manually)', '| phone:', result.tel || '?', '| email:', result.mail || '?', '| social links:', data.social.length);
console.log('Look at', path.join(out, 'original-home.png'), 'and confirm the palette.');
