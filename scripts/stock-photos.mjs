#!/usr/bin/env node
// Free stock photos (Unsplash licence: free for commercial use, no attribution required) for when the
// client's own photos are too few. Real photos beat generated illustrations; see docs/DESIGN.md.
//
//   1. Collect photo ids per topic (Unsplash search needs a browser; see docs/DESIGN.md "Finding photos")
//      into ids.txt, one line per topic:   switchboard=1544724569-5f546fd6f2b5,1635335874521-7987db781153
//   2. node scripts/stock-photos.mjs sheets --ids ids.txt --out <work>/_stock
//      -> thumbnails plus labelled contact sheets (sheet-N.png, labels like "switchboard-3"). View every sheet.
//   3. Write map.json {"hero-home": "night-12", "board-1": "switchboard-3", ...} (file name -> label)
//      node scripts/stock-photos.mjs pick --ids ids.txt --map map.json --out <project>/public/images/photos
//      -> full-size JPEGs plus CREDITS.json (source page of every photo).
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const [cmd, ...rest] = process.argv.slice(2);
const opt = (k) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : null; };
const idsFile = opt('ids'), out = opt('out');
if (!['sheets', 'pick'].includes(cmd) || !idsFile || !out) {
  console.error('usage: stock-photos.mjs sheets --ids ids.txt --out dir | pick --ids ids.txt --map map.json --out dir');
  process.exit(1);
}
const cats = fs.readFileSync(idsFile, 'utf8').trim().split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => { const [k, v] = l.split('='); return [k.trim(), v.split(',').map((x) => x.trim().replace(/^photo-/, '')).filter(Boolean)]; });
const byCat = Object.fromEntries(cats);
const url = (id, w, h) => `https://images.unsplash.com/photo-${id}?w=${w}${h ? `&h=${h}&fit=crop` : '&fit=max'}&q=${h ? 60 : 72}&fm=jpg`;
fs.mkdirSync(out, { recursive: true });

if (cmd === 'sheets') {
  const thumbs = path.join(out, 'thumbs');
  fs.mkdirSync(thumbs, { recursive: true });
  const all = cats.flatMap(([cat, ids]) => ids.map((id) => ({ cat, id })));
  await Promise.all(all.map(async ({ id }) => {
    const f = path.join(thumbs, id + '.jpg');
    if (fs.existsSync(f)) return;
    const r = await fetch(url(id, 360, 240));
    if (r.ok) fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  let n = 0;
  for (let i = 0; i < cats.length; i += 3) {
    const html = cats.slice(i, i + 3).map(([cat, ids]) => `<h2>${cat}</h2><div class="g">${ids.map((id, k) => {
      const f = path.join(thumbs, id + '.jpg');
      return fs.existsSync(f) ? `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${cat}-${k}</figcaption></figure>` : '';
    }).join('')}</div>`).join('');
    await p.setContent(`<style>body{margin:8px;font:14px sans-serif}h2{margin:6px 0}.g{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}figure{margin:0}img{width:100%;display:block}figcaption{font-weight:700}</style>${html}`);
    await p.screenshot({ path: path.join(out, `sheet-${++n}.png`), fullPage: true });
  }
  await b.close();
  console.log(`${n} contact sheets in ${out} (${fs.readdirSync(thumbs).length} thumbnails). Open every sheet before picking.`);
} else {
  const map = JSON.parse(fs.readFileSync(opt('map'), 'utf8'));
  const credits = [];
  let failed = 0;
  await Promise.all(Object.entries(map).map(async ([name, label]) => {
    const m = String(label).match(/^(.*)-(\d+)$/);
    const id = m && byCat[m[1]] && byCat[m[1]][Number(m[2])];
    if (!id) { console.log('unknown label', label); failed++; return; }
    const wide = /^(hero|band|coast|wide)/.test(name);
    const r = await fetch(url(id, wide ? 1800 : 1100));
    if (!r.ok) { console.log('download failed', name, r.status); failed++; return; }
    fs.writeFileSync(path.join(out, name + '.jpg'), Buffer.from(await r.arrayBuffer()));
    credits.push({ file: name + '.jpg', source: 'https://images.unsplash.com/photo-' + id, licence: 'Unsplash License (https://unsplash.com/license)' });
  }));
  fs.writeFileSync(path.join(out, 'CREDITS.json'), JSON.stringify(credits.sort((a, b) => a.file.localeCompare(b.file)), null, 1));
  console.log(`saved ${credits.length} photos to ${out}${failed ? `, ${failed} failed` : ''}`);
  process.exit(failed ? 1 : 0);
}
