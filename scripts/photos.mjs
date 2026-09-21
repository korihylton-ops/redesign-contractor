#!/usr/bin/env node
// Collect, de-duplicate and optimise the client's photos, then let the agent pick the best.
//   node scripts/photos.mjs collect --in <scrapeDir> --out <dir>      -> <dir>/candidates/*.jpg, contact-sheet-N.png, candidates.json
//   node scripts/photos.mjs pick --from <dir>/candidates --map map.json --out <project>/public/images
//        map.json: { "<candidate id>": "hero", "<id>": "about", "<id>": "work-01", ... }  (writes <name>.jpg)
// Needs Playwright (for resizing, perceptual de-duplication and the contact sheets).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import * as cheerio from 'cheerio';

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

if (mode === 'pick') {
  const from = path.resolve(opt('from')), out = path.resolve(opt('out')), map = JSON.parse(fs.readFileSync(path.resolve(opt('map')), 'utf8'));
  fs.mkdirSync(out, { recursive: true });
  for (const [id, name] of Object.entries(map)) {
    const src = fs.readdirSync(from).find((f) => f.split('.')[0] === String(id));
    if (!src) { console.log('missing candidate', id); continue; }
    fs.copyFileSync(path.join(from, src), path.join(out, name.replace(/\.[a-z0-9]+$/i, '') + '.jpg'));
    console.log('picked', id, '->', name + '.jpg');
  }
  process.exit(0);
}
if (mode !== 'collect') { console.error('usage: photos.mjs collect|pick ...'); process.exit(1); }

const IN = path.resolve(opt('in', './_scrape')), OUT = path.resolve(opt('out', IN));
const CAND = path.join(OUT, 'candidates');
fs.mkdirSync(CAND, { recursive: true });
const site = JSON.parse(fs.readFileSync(path.join(IN, 'site.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const JUNK = /logo|icon|sprite|favicon|avatar|gravatar|emoji|badge|trustindex|star|placeholder|flyer|business-card|banner-ad|map|pixel|spacer|button|arrow|loader/i;

/* ---- 1. gather candidate URLs ---- */
const urls = new Map(); // url -> source
const add = (u, from) => { try { const x = new URL(u, site.origin).href.split('#')[0]; if (/\.(jpe?g|png|webp)(\?|$)/i.test(x) && !JUNK.test(x)) urls.set(x, from); } catch { /* skip */ } };
try { JSON.parse(fs.readFileSync(path.join(IN, 'media.json'), 'utf8')).forEach((m) => { if (m.source_url && (m.media_details && m.media_details.width >= 800)) add(m.source_url, 'media'); }); } catch { /* not WordPress */ }
for (const f of ['raw-pages.json', 'raw-posts.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(IN, f), 'utf8')).forEach((p) => {
      const $ = cheerio.load((p.content || {}).rendered || '');
      $('img').each((_, el) => {
        const ss = ($(el).attr('srcset') || '').split(',').map((s) => s.trim().split(/\s+/)).filter((x) => x[0]);
        const best = ss.sort((a, b) => parseInt(b[1] || '0', 10) - parseInt(a[1] || '0', 10))[0];
        add((best && best[0]) || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('src'), p.link);
      });
      $('[style*="background"]').each((_, el) => { const m = ($(el).attr('style') || '').match(/url\(['"]?([^'")]+)/); if (m) add(m[1], p.link); });
    });
  } catch { /* file missing */ }
}
const LIMIT = parseInt(opt('limit', '160'), 10);
console.log('candidate urls:', urls.size, urls.size > LIMIT ? `(capping to ${LIMIT}, media-library images first)` : '');

/* ---- 2. download (>20KB), exact de-dupe by SHA-256 ---- */
const files = [];
const hashes = new Set();
let n = 0;
for (const [u] of [...urls].sort((a, b) => (b[1] === 'media') - (a[1] === 'media')).slice(0, LIMIT)) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 20 * 1024) continue;
    const h = crypto.createHash('sha256').update(buf).digest('hex'); if (hashes.has(h)) continue; hashes.add(h);
    const ext = (u.split('?')[0].match(/\.(jpe?g|png|webp)$/i) || ['', 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
    const id = String(++n).padStart(3, '0');
    fs.writeFileSync(path.join(CAND, `raw-${id}.${ext}`), buf);
    files.push({ id, raw: `raw-${id}.${ext}`, url: u, kb: Math.round(buf.length / 1024) });
  } catch { /* skip */ }
}
console.log('downloaded', files.length, 'unique images');

/* ---- 3. resize to <=1800px JPEG, perceptual de-dupe, contact sheets (Playwright) ---- */
const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id=c></canvas>');
const kept = [];
const seenHash = [];
for (const f of files) {
  const buf = fs.readFileSync(path.join(CAND, f.raw));
  const mime = /png$/.test(f.raw) ? 'image/png' : /webp$/.test(f.raw) ? 'image/webp' : 'image/jpeg';
  const r = await page.evaluate(async ({ b64, mime }) => {
    const img = new Image(); await new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = 'data:' + mime + ';base64,' + b64; });
    if (!img.naturalWidth) return null;
    const c = document.getElementById('c'); const s = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const t = document.createElement('canvas'); t.width = t.height = 16; const tc = t.getContext('2d'); tc.drawImage(img, 0, 0, 16, 16);
    const d = tc.getImageData(0, 0, 16, 16).data; const g = []; for (let i = 0; i < d.length; i += 4) g.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    const avg = g.reduce((a, b) => a + b, 0) / g.length;
    return { jpg: c.toDataURL('image/jpeg', 0.8).split(',')[1], w: c.width, h: c.height, ow: img.naturalWidth, oh: img.naturalHeight, hash: g.map((v) => (v > avg ? '1' : '0')).join('') };
  }, { b64: buf.toString('base64'), mime });
  fs.unlinkSync(path.join(CAND, f.raw));
  if (!r || r.ow < 700 || r.oh < 500) continue;
  if (seenHash.some((h) => h.split('').filter((ch, i) => ch === r.hash[i]).length / 256 >= 0.92)) continue; // near-duplicate
  seenHash.push(r.hash);
  const b = Buffer.from(r.jpg, 'base64'); fs.writeFileSync(path.join(CAND, `${f.id}.jpg`), b);
  kept.push({ id: f.id, file: `${f.id}.jpg`, width: r.w, height: r.h, kb: Math.round(b.length / 1024), url: f.url });
}
fs.writeFileSync(path.join(OUT, 'candidates.json'), JSON.stringify(kept, null, 1));
console.log('kept after size/duplicate filter:', kept.length);

const per = 28;
await page.setViewportSize({ width: 1600, height: 1000 });
for (let s = 0; s < kept.length; s += per) {
  const html = '<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:6px;font:16px sans-serif;color:#fff">' + kept.slice(s, s + per).map((k) => `<div><img src="${pathToFileURL(path.join(CAND, k.file)).href}" style="width:100%;height:210px;object-fit:cover"><div>${k.id} &middot; ${k.width}x${k.height}</div></div>`).join('') + '</body>';
  const sheet = path.join(OUT, `sheet-${s / per}.html`);
  fs.writeFileSync(sheet, html);
  await page.goto(pathToFileURL(sheet).href); await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `contact-sheet-${s / per}.png`), fullPage: true });
  fs.unlinkSync(sheet);
}
await browser.close();
console.log(`Contact sheets: ${path.join(OUT, 'contact-sheet-N.png')}. View them, then run "photos.mjs pick" with an id->name map.`);
console.log('Skip anything with baked-in text, stock photography, screenshots and low-quality shots. Pick a hero >100KB.');
