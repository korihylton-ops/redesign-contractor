#!/usr/bin/env node
// Add clearly labelled EXAMPLE listings to a site's shop, for a sales demo (docs/SHOP.md).
// Every item is marked demo: it shows an "Example listing" badge, and the owner removes them all with one tap
// (admin, Shop, "Remove example listings"). Never seed examples as if they were the client's real stock.
//
//   node scripts/seed-shop-demo.mjs --url https://<site> --password <admin password> --items items.json
//
// items.json: [{ "title": "...", "price": 85, "condition": "Good", "category": "Ceiling fans", "qty": 1,
//                "photos": ["../public/images/photos/fan-1.jpg"], "tested": true, "status": "reserved",
//                "description": "..." }]   (photo paths are relative to items.json; JPEG only)
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const base = (opt('url') || '').replace(/\/$/, ''), pw = opt('password'), file = opt('items');
if (!base || !pw || !file) { console.error('usage: seed-shop-demo.mjs --url <site> --password <admin password> --items items.json'); process.exit(1); }
const dir = path.dirname(path.resolve(file));
const items = JSON.parse(fs.readFileSync(file, 'utf8'));
const photo = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(path.resolve(dir, p)).toString('base64');

const login = await (await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })).json();
if (!login.token) { console.error('Admin login failed: ' + (login.error || 'no token')); process.exit(1); }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token };
for (const it of items.slice().reverse()) {
  const r = await fetch(base + '/api/products', { method: 'POST', headers: H, body: JSON.stringify(Object.assign({ install: true }, it, { demo: true, status: undefined, photos: (it.photos || []).map(photo) })) });
  const j = await r.json();
  if (!r.ok) { console.error(it.title + ': ' + j.error); process.exit(1); }
  if (it.status && it.status !== 'available') await fetch(base + '/api/products/' + j.product.id, { method: 'PATCH', headers: H, body: JSON.stringify({ status: it.status }) });
  console.log('listed', base + j.product.url);
}
