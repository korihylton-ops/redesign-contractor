'use strict';
/* Shop: second-hand and stock items the owner lists from their phone (admin, "Shop" tab).
   Built for trades who sell a few items alongside their services: no catalogue to maintain,
   one tap to mark an item sold, and every item offers installation by the business.
   Visitors reserve an item (it lands in the leads dashboard); there is no online payment. */
const fs = require('fs');
const path = require('path');
const C = require('./config');
const L = require('./layout');
const { esc, slugify } = require('./blocks');
const { business: B, T } = C;

const DEFAULTS = {
  enabled: false,
  heading: 'In stock now',
  lede: 'Quality second-hand and surplus items, checked before they are listed. Reserve one online and pick it up, or have it installed.',
  categories: ['Lighting', 'Ceiling fans', 'Appliances', 'Smart home', 'Outdoor', 'Parts and accessories'],
  conditions: ['As new', 'Excellent', 'Good', 'Fair', 'For parts'],
  installOffer: true,
  soldVisibleDays: 14,
};
const cfg = () => Object.assign({}, DEFAULTS, (C.cfg && C.cfg.shop) || {});
const enabled = () => !!cfg().enabled;
const money = (n) => (n === null || n === undefined || n === '' ? '' : '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }));

function visible(store) {
  const keepSold = cfg().soldVisibleDays * 86400000, now = Date.now();
  return (store.products || []).filter((p) => p.status !== 'sold' || (p.soldAt && now - Date.parse(p.soldAt) < keepSold));
}
const publicProduct = (p) => ({
  id: p.id, slug: p.slug, title: p.title, price: p.price, priceNote: p.priceNote || '', condition: p.condition, category: p.category,
  description: p.description, qty: p.qty, status: p.status, install: !!p.install, tested: !!p.tested, demo: !!p.demo,
  photos: (p.photos || []).map((f) => '/shop-photos/' + f), url: '/shop/' + p.slug, createdAt: p.createdAt,
});

/* ---------- Pages (rendered per request, so a new listing is live the moment it is posted) ---------- */
const statusBadge = (p) => (p.status === 'sold' ? '<span class="shop-badge shop-badge--sold">Sold</span>' : p.status === 'reserved' ? '<span class="shop-badge shop-badge--res">Reserved</span>' : '');
function card(p) {
  const pp = publicProduct(p);
  return `<a class="shop-card${p.status === 'sold' ? ' is-sold' : ''}" href="${pp.url}" data-cat="${esc(p.category || '')}">
    <span class="shop-card__img">${pp.photos[0] ? `<img src="${pp.photos[0]}" alt="${esc(p.title)}" loading="lazy">` : ''}${statusBadge(p)}${p.demo ? '<span class="shop-badge shop-badge--demo">Example listing</span>' : ''}</span>
    <span class="shop-card__body"><b>${esc(p.title)}</b><span class="shop-card__meta">${esc(p.condition || '')}${p.category ? ' · ' + esc(p.category) : ''}</span>
    <span class="shop-card__price">${p.price !== null && p.price !== undefined ? money(p.price) : 'Ask for price'}</span></span>
  </a>`;
}

function shopIndex(store) {
  const s = cfg();
  const items = visible(store).sort((a, b) => (a.status === 'sold') - (b.status === 'sold') || (a.createdAt < b.createdAt ? 1 : -1));
  const cats = [...new Set(items.map((p) => p.category).filter(Boolean))];
  const anyDemo = items.some((p) => p.demo);
  const body = `
<section class="inner-hero shop-hero"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / Shop</p>
  <h1>${esc(T(s.heading))}</h1>
  <p class="lede">${esc(T(s.lede))}</p>
  ${s.installOffer ? `<p class="shop-hero__install">Every item can be installed by ${esc(B.name)}. Tick "install it for me" when you reserve.</p>` : ''}
</div></section>
<section class="section shop"><div class="wrap">
  ${anyDemo ? '<p class="shop-note">These are example listings to show how the shop works. Real stock appears here as soon as it is listed.</p>' : ''}
  ${cats.length > 1 ? `<div class="shop-filter" role="group" aria-label="Filter by category"><button type="button" class="is-on" data-shop-cat="">All</button>${cats.map((c) => `<button type="button" data-shop-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
  ${items.length ? `<div class="shop-grid">${items.map(card).join('')}</div>` : `<p class="shop-empty">Nothing listed right now. New stock comes in regularly, so call or text ${esc(B.phone)} if you are after something specific.</p>`}
</div></section>`;
  return L.head({ title: `${T(s.heading)} | ${B.name}`, description: T(s.lede), path: '/shop' }) + `
<body>
${L.header()}
<main id="main">${body}
${L.quoteSection({ heading: 'Looking for something specific?' })}
</main>
${L.footer()}`;
}

function productPage(store, slug) {
  const p = (store.products || []).find((x) => x.slug === slug);
  if (!p) return null;
  const s = cfg(), pp = publicProduct(p);
  const price = p.price !== null && p.price !== undefined ? money(p.price) : 'Ask for price';
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.title, description: p.description || p.title,
    image: pp.photos.map((u) => L.SITE() + u), category: p.category || undefined,
    offers: { '@type': 'Offer', priceCurrency: 'AUD', price: p.price !== null && p.price !== undefined ? String(p.price) : undefined, itemCondition: p.condition === 'As new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      availability: p.status === 'available' ? 'https://schema.org/InStock' : p.status === 'reserved' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/SoldOut', seller: { '@id': L.SITE() + '/#business' } },
  };
  const textBody = `Hi ${B.name}, is the ${p.title} (${price}) still available?`;
  const open = p.status !== 'sold';
  const body = `
<section class="section product"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / <a href="/shop">Shop</a> / ${esc(p.title)}</p>
  <div class="product__grid">
    <div class="product__media">
      <div class="product__main">${pp.photos[0] ? `<img id="product-photo" src="${pp.photos[0]}" alt="${esc(p.title)}">` : ''}${statusBadge(p)}${p.demo ? '<span class="shop-badge shop-badge--demo">Example listing</span>' : ''}</div>
      ${pp.photos.length > 1 ? `<div class="product__thumbs">${pp.photos.map((u, i) => `<button type="button" data-photo="${u}" aria-label="Show photo ${i + 1}"><img src="${u}" alt=""></button>`).join('')}</div>` : ''}
    </div>
    <div class="product__info">
      <h1>${esc(p.title)}</h1>
      <p class="product__price">${price}${p.priceNote ? ` <small>${esc(p.priceNote)}</small>` : ''}</p>
      <ul class="product__facts">
        ${p.condition ? `<li><b>Condition</b>${esc(p.condition)}</li>` : ''}
        ${p.category ? `<li><b>Category</b>${esc(p.category)}</li>` : ''}
        ${open && p.qty > 1 ? `<li><b>Available</b>${p.qty}</li>` : ''}
        ${p.tested ? `<li><b>Checked</b>${esc(cfg().testedLabel || 'Tested by a licensed ' + (C.trade.noun || 'tradesperson'))}</li>` : ''}
      </ul>
      ${p.description ? `<div class="product__desc">${esc(p.description).split(/\n{2,}/).map((x) => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
      ${open ? `
      <form class="reserve" data-product="${esc(p.title)}" data-price="${esc(price)}" novalidate>
        <h2>Reserve this item</h2>
        <div class="reserve__row"><div class="field"><label for="r-name">Your name</label><input id="r-name" name="name" autocomplete="name" required></div>
        <div class="field"><label for="r-phone">Phone</label><input id="r-phone" name="phone" type="tel" autocomplete="tel" required></div></div>
        <div class="field"><label for="r-suburb">Suburb</label><input id="r-suburb" name="suburb" autocomplete="address-level2"></div>
        ${s.installOffer && p.install !== false ? `<label class="reserve__install"><input type="checkbox" name="install" value="yes"> Install it for me (we will quote the installation)</label>` : ''}
        <div class="field"><label for="r-note">Anything else? (optional)</label><textarea id="r-note" name="note" rows="2"></textarea></div>
        <button class="btn btn--call" type="submit">Reserve this item</button>
        <p class="form__status" role="status" aria-live="polite"></p>
      </form>
      <div class="product__or">${L.callBtn('product')}${L.textBtn('product', 'Text about this item', 'btn--line', textBody)}</div>` : `<p class="product__gone">This one has sold. New stock comes in regularly: call or text ${esc(B.phone)} and we will tell you when something similar arrives.</p><div class="product__or"><a class="btn btn--line" href="/shop">See what is in stock</a></div>`}
    </div>
  </div>
</div></section>`;
  return L.head({ title: `${p.title} (${p.condition || 'second-hand'}) | ${B.name}`, description: (p.description || p.title).slice(0, 155), path: '/shop/' + p.slug, jsonld: [ld], image: pp.photos[0], type: 'product' }) + `
<body>
${L.header()}
<main id="main">${body}</main>
${L.footer()}`;
}

/* ---------- API ---------- */
function register(app, { express, store, save, requireAdmin, isAdmin, clean, newId, DATA_DIR, sendHtml }) {
  if (!store.products) store.products = [];
  const DIR = path.join(DATA_DIR, 'shop');
  fs.mkdirSync(DIR, { recursive: true });
  const num = (v) => { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).replace(/[$,\s]/g, '')); return Number.isFinite(n) && n >= 0 && n < 1e6 ? Math.round(n * 100) / 100 : null; };
  const uniqueSlug = (title, id) => { const base = slugify(title).slice(0, 60) || 'item'; let s = base, i = 2; while (store.products.some((p) => p.slug === s && p.id !== id)) s = base + '-' + i++; return s; };
  const savePhotos = (list) => {
    const files = [];
    fs.mkdirSync(DIR, { recursive: true });
    for (const d of (Array.isArray(list) ? list : []).slice(0, 6)) {
      const m = typeof d === 'string' && d.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
      if (!m) continue;
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length < 2000 || buf.length > 6 * 1024 * 1024 || buf[0] !== 0xff || buf[1] !== 0xd8) continue;
      const f = newId() + '.jpg';
      fs.writeFileSync(path.join(DIR, f), buf);
      files.push(f);
    }
    return files;
  };
  const fields = (b, p) => {
    const s = cfg();
    if (b.title !== undefined) p.title = clean(b.title, 120);
    if (b.price !== undefined) p.price = num(b.price);
    if (b.priceNote !== undefined) p.priceNote = clean(b.priceNote, 60);
    if (b.condition !== undefined) p.condition = s.conditions.includes(b.condition) ? b.condition : clean(b.condition, 30);
    if (b.category !== undefined) p.category = clean(b.category, 40);
    if (b.description !== undefined) p.description = clean(String(b.description).replace(/\r/g, ''), 1500).replace(/ {2,}/g, ' ');
    if (b.qty !== undefined) p.qty = Math.max(0, Math.min(999, parseInt(b.qty, 10) || 1));
    if (b.install !== undefined) p.install = !!b.install;
    if (b.tested !== undefined) p.tested = !!b.tested;
    if (b.status !== undefined && ['available', 'reserved', 'sold'].includes(b.status)) {
      p.status = b.status; p.soldAt = b.status === 'sold' ? new Date().toISOString() : null;
    }
  };

  app.post('/api/products', requireAdmin, express.json({ limit: '25mb' }), (req, res) => {
    const b = req.body || {};
    if (!clean(b.title, 120)) return res.status(400).json({ error: 'Give the item a title.' });
    const p = { id: newId(), createdAt: new Date().toISOString(), status: 'available', qty: 1, install: true, tested: false, photos: [] };
    fields(b, p);
    p.demo = !!b.demo; // example listings for demos; removable in one tap from the admin
    p.photos = savePhotos(b.photos);
    // "List another like this": reuse the photos of an existing listing when no new ones were taken.
    if (!p.photos.length && b.copyPhotosFrom) { const src = store.products.find((x) => x.id === b.copyPhotosFrom); if (src) p.photos = src.photos.slice(); }
    if (!p.photos.length) return res.status(400).json({ error: 'Add at least one photo.' });
    p.slug = uniqueSlug(p.title, p.id);
    store.products.unshift(p);
    save('products');
    res.json({ product: publicProduct(p) });
  });
  app.patch('/api/products/:id', requireAdmin, express.json({ limit: '25mb' }), (req, res) => {
    const p = store.products.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    fields(b, p);
    if (b.title !== undefined) p.slug = uniqueSlug(p.title, p.id);
    if (Array.isArray(b.addPhotos)) p.photos = p.photos.concat(savePhotos(b.addPhotos)).slice(0, 6);
    p.updatedAt = new Date().toISOString();
    save('products');
    res.json({ product: publicProduct(p) });
  });
  app.delete('/api/products/:id', requireAdmin, (req, res) => {
    const i = store.products.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Not found.' });
    const [p] = store.products.splice(i, 1);
    const shared = new Set(store.products.flatMap((x) => x.photos));
    (p.photos || []).filter((f) => !shared.has(f)).forEach((f) => fs.rm(path.join(DIR, f), () => {}));
    save('products');
    res.json({ ok: true });
  });
  app.post('/api/products-clear-demo', requireAdmin, (req, res) => {
    const demo = store.products.filter((p) => p.demo);
    store.products = store.products.filter((p) => !p.demo);
    const shared = new Set(store.products.flatMap((x) => x.photos));
    demo.flatMap((p) => p.photos).filter((f) => !shared.has(f)).forEach((f) => fs.rm(path.join(DIR, f), () => {}));
    save('products');
    res.json({ removed: demo.length });
  });
  app.get('/api/products', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    // The admin sees everything (including long-sold items); visitors see live stock plus recently sold.
    let list = req.query.all === '1' && isAdmin(req) ? store.products : visible(store);
    if (req.query.available === '1') list = list.filter((p) => p.status !== 'sold');
    res.json({ products: list.slice(0, Math.min(Number(req.query.limit) || 60, 200)).map(publicProduct), settings: { categories: cfg().categories, conditions: cfg().conditions } });
  });
  app.use('/shop-photos', express.static(DIR, { maxAge: '30d', fallthrough: false }));

  app.get('/shop', (req, res) => (enabled() ? sendHtml(res, shopIndex(store)) : res.status(404).end()));
  app.get('/shop/:slug', (req, res, next) => {
    if (!enabled()) return next();
    const html = productPage(store, req.params.slug);
    return html ? sendHtml(res, html) : next();
  });
}

/* Home page strip: filled in the browser from /api/products, hidden when nothing is listed. */
function homeSection(cls) {
  if (!enabled()) return '';
  const c = cfg();
  return `<section class="${cls || 'section'} stock" id="stock" data-stock="4" hidden>
  <div class="wrap">
    <div class="ink-head"><h2>${esc(T(c.heading))}</h2><p>${esc(T(c.homeLede || c.lede))}</p></div>
    <div class="stock-grid"></div>
    <p class="stock__more"><a class="btn btn--line" href="/shop">See everything in the shop</a></p>
  </div>
</section>`;
}

const sitemapUrls = (store) => (enabled() ? ['/shop'].concat(visible(store).filter((p) => p.status !== 'sold').map((p) => '/shop/' + p.slug)) : []);

module.exports = { register, sitemapUrls, enabled, cfg, homeSection };
