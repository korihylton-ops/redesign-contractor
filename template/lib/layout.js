'use strict';
// Shared page chrome: <head>, header, footer (with chat widget), quote form, FAQ, schema.org.
const C = require('./config');
const S = require('./site');
const { business: B, trade, T } = C;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = (name) => (name ? (/\.[a-z0-9]{3,4}$/i.test(name) ? `/images/${name}` : `/images/${name}.jpg`) : '');
const SITE = () => (process.env.SITE_URL || C.site.siteUrl || 'http://localhost:3000').replace(/\/$/, '');
const TEXT_NUMBER = () => process.env.TEXT_NUMBER || B.phoneE164;
const smsHref = (body) => `sms:${TEXT_NUMBER()}?&body=${encodeURIComponent(body || T('Hi {{name}}, I would like a quote.'))}`;

const fullAddress = [B.address.street, [B.address.suburb, B.address.state, B.address.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress + ', ' + (B.address.country === 'AU' ? 'Australia' : B.address.country || ''))}`;
const serviceOptions = C.formServices;
const has = (p) => !!S.get(p);

/* Tracked call / text buttons. Every one reports a conversion to /api/convert (see site.js). */
const callBtn = (src, label, cls) => `<a class="btn ${cls || 'btn--call'}" href="${B.phoneHref}" data-track="call" data-src="${src}">${label || 'Call ' + esc(B.phone)}</a>`;
const textBtn = (src, label, cls, body) => `<a class="btn ${cls || 'btn--line'}" href="${esc(smsHref(body))}" data-track="text" data-src="${src}">${label || 'Text us'}</a>`;

function head({ title, description, path, jsonld = [], image, type }) {
  const url = SITE() + path;
  const ogImage = SITE() + (image || img(C.images.og || C.images.hero));
  return `<!doctype html>
<html lang="${esc((C.site.locale || 'en-AU'))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="${esc(C.brand.ink)}">
<meta property="og:type" content="${type || 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="${esc((C.site.locale || 'en-AU').replace('-', '_'))}">
<link rel="icon" href="/images/${esc(C.images.logo || 'logo.webp')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${C.fontsUrl()}" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/enterprise.css">
<link rel="stylesheet" href="/assets/chat.css">
<style id="brand">${C.brandCss()}</style>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>`;
}

function navItems() {
  if (C.nav) return C.nav;
  const items = [['/#services', 'Services']];
  if (C.priceSheet.length) items.push(['/#pricing', 'Pricing']);
  items.push(['/#reviews', 'Reviews'], ['/#areas', 'Areas']);
  if (S.posts.length) items.push(['/blog', 'Guides']);
  items.push([has('/contact') ? '/contact' : '/#quote', 'Contact']);
  return items;
}

function header() {
  const logo = img(C.images.logo || 'logo.webp');
  return `<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"><i></i></div>
<header class="head">
  <div class="wrap head__row">
    <a class="head__logo" href="/" aria-label="${esc(B.name)} home"><img src="${logo}" alt="${esc(B.name)}" height="44"></a>
    <nav class="nav" id="nav" aria-label="Main">
      ${navItems().map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('\n      ')}
    </nav>
    ${callBtn('header', 'Call ' + esc(B.phone), 'btn--call head__call')}
    <button class="head__toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav"><span></span><span></span></button>
  </div>
</header>`;
}

function chatWidget() {
  return `<div class="chat" id="chat" data-phone="${esc(B.phone)}" data-phone-href="${B.phoneHref}" data-sms="${esc(smsHref(T('Hi {{name}}, I have a question.')))}" data-name="${esc(B.name)}">
  <button class="chat__launch" type="button" aria-expanded="false" aria-controls="chat-panel"><span class="chat__dot" aria-hidden="true"></span><span class="chat__launch-label">Chat with us</span></button>
  <section class="chat__panel" id="chat-panel" role="dialog" aria-label="Chat with ${esc(B.name)}" hidden>
    <header class="chat__head">
      <span class="chat__avatar" aria-hidden="true">${esc((B.name || 'C')[0].toUpperCase())}</span>
      <span class="chat__title"><b>${esc(B.name)} assistant</b><small>Ask a question or get a quote</small></span>
      <button class="chat__close" type="button" aria-label="Close chat">&times;</button>
    </header>
    <div class="chat__log" role="log" aria-live="polite"></div>
    <div class="chat__chips"></div>
    <div class="chat__cta">${callBtn('chat', 'Call now', 'btn--call')}${textBtn('chat', 'Text us', 'btn--line')}</div>
    <form class="chat__form" autocomplete="off"><label class="sr" for="chat-input">Your message</label><input id="chat-input" maxlength="500" placeholder="Type your message"><button class="btn btn--ink" type="submit">Send</button></form>
    <p class="chat__note">AI assistant. For urgent jobs, call ${esc(B.phone)}.</p>
  </section>
</div>`;
}

function footer() {
  const s = B.social || {};
  const social = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['x', 'X'], ['pinterest', 'Pinterest'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['google', 'Google reviews']]
    .filter(([k]) => s[k]).map(([k, l]) => `<li><a href="${esc(s[k])}" rel="noopener">${l}</a></li>`).join('');
  const company = [['/about', 'About'], ['/prices', 'Prices'], ['/all-locations', 'All locations'], ['/blog', 'Guides and advice'], ['/contact', 'Contact'], ['/get-a-free-estimate', 'Free estimate']]
    .filter(([p]) => has(p) || (p === '/blog' && S.posts.length)).map(([p, l]) => `<li><a href="${p}">${l}</a></li>`).join('');
  const areaLinks = C.regionPages.slice(0, 2).map((r) => `<li><a href="${C.paths.region(r.slug)}">${esc(r.name)}</a></li>`)
    .concat(C.suburbs.slice(0, 3).map((x) => `<li><a href="${C.paths.suburb(x.slug)}">${esc(x.name)}</a></li>`)).join('');
  const legalBits = [B.licenceLine, B.abn ? `${B.abnLabel} ${B.abn}` : ''].filter(Boolean).join('. ');
  return `<footer class="foot">
  <div class="wrap">
    <div class="foot__grid">
      <div>
        <span class="foot__logo"><img src="${img(C.images.logo || 'logo.webp')}" alt="${esc(B.name)}" height="40"></span>
        <p>${esc(B.legalName)}<br>${esc(fullAddress)}<br><a href="${B.phoneHref}" data-track="call" data-src="footer">${esc(B.phone)}</a><br><a href="mailto:${esc(B.email)}">${esc(B.email)}</a></p>
      </div>
      <div>
        <h3>Services</h3>
        <ul>${C.services.map((x) => `<li><a href="/${x.slug}">${esc(x.name)}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h3>Company</h3>
        <ul>${company}${areaLinks}<li><a href="/#areas">All suburbs</a></li></ul>
      </div>
      <div>
        <h3>Follow</h3>
        <ul>${social}<li><a href="${mapsUrl}" rel="noopener">Get directions</a></li></ul>
      </div>
    </div>
    <div class="foot__legal">
      <span>${esc(legalBits)}</span>
      <span>&copy; ${new Date().getFullYear()} ${esc(B.legalName)}.${has('/privacy-policy') ? ' <a href="/privacy-policy">Privacy</a>.' : ''}${has('/terms-conditions') ? ' <a href="/terms-conditions">Terms</a>.' : ''}${has('/sitemap') ? ' <a href="/sitemap">Sitemap</a>.' : ''} <a href="/admin.html">Staff login</a></span>
    </div>
  </div>
</footer>
<div class="callbar">${callBtn('callbar', 'Call now')}<a class="btn btn--ink" href="#quote" data-track="quote" data-src="callbar">Get a quote</a></div>
${chatWidget()}
<script src="https://cdn.jsdelivr.net/npm/motion@12/dist/motion.js" defer></script>
<script src="/assets/site.js" defer></script>
<script src="/assets/chat.js" defer></script>
</body></html>`;
}

function quoteForm({ suburb = '' } = {}) {
  return `<form class="form js-lead" data-phone="${esc(B.phone)}" novalidate>
  <div class="field"><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required maxlength="120"></div>
  <div class="field"><label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" required maxlength="40"></div>
  <div class="field"><label for="f-email">Email (optional)</label><input id="f-email" name="email" type="email" autocomplete="email" maxlength="200"></div>
  <div class="field"><label for="f-suburb">Suburb</label><input id="f-suburb" name="suburb" value="${esc(suburb)}" autocomplete="address-level2" maxlength="80"></div>
  <div class="field"><label for="f-service">What do you need?</label>
    <select id="f-service" name="service">${serviceOptions.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>
  <div class="field"><label for="f-date">Preferred date (optional)</label><input id="f-date" name="preferredDate" type="date"></div>
  <div class="field field--full"><label for="f-msg">Tell us about the job</label><textarea id="f-msg" name="message" maxlength="2000"></textarea></div>
  <div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <p class="form__status" role="status" aria-live="polite"></p>
  <button class="btn btn--call" type="submit">Send quote request</button>
</form>`;
}

function quoteSection({ suburb, heading, id } = {}) {
  const q = C.copy.quote || {};
  return `<section class="section section--ink" id="${id || 'quote'}">
  <div class="wrap quote-grid">
    <div>
      <h2 style="color:#fff">${esc(T(heading || q.heading || 'Get a fixed-price quote'))}</h2>
      <p class="lede">${esc(T(q.lede || 'Tell us what you need and we will call you back. If it cannot wait, call or text now.'))}</p>
      <div class="hero__cta" style="margin:20px 0 0">${callBtn('quote-section')}${textBtn('quote-section', 'Text us', 'btn--line')}</div>
      <ul class="contact-list">
        <li><b>Phone</b><a href="${B.phoneHref}" data-track="call" data-src="quote-section">${esc(B.phone)}</a></li>
        ${B.email ? `<li><b>Email</b><a href="mailto:${esc(B.email)}">${esc(B.email)}</a></li>` : ''}
        ${fullAddress ? `<li><b>Workshop</b><a href="${mapsUrl}" rel="noopener">${esc(fullAddress)}</a></li>` : ''}
        ${B.hoursText ? `<li><b>Hours</b><span>${esc(B.hoursText)}</span></li>` : ''}
      </ul>
    </div>
    ${quoteForm({ suburb })}
  </div>
</section>`;
}

function faqHtml(list) {
  return `<div class="faq">${list.map((f) => `<details><summary>${esc(T(f.q))}</summary><div class="faq__a"><p>${esc(T(f.a))}</p></div></details>`).join('')}</div>`;
}

function localBusinessLd(extra = {}) {
  const ld = {
    '@context': 'https://schema.org', '@type': [trade.schemaType, 'LocalBusiness'], '@id': SITE() + '/#business',
    name: B.name, legalName: B.legalName, url: SITE(), telephone: B.phoneE164, email: B.email,
    image: SITE() + img(C.images.og || C.images.hero), logo: SITE() + img(C.images.logo || 'logo.webp'), priceRange: '$$',
    address: { '@type': 'PostalAddress', streetAddress: B.address.street, addressLocality: B.address.suburb, addressRegion: B.address.state, postalCode: B.address.postcode, addressCountry: B.address.country || 'AU' },
    areaServed: C.suburbs.map((s) => ({ '@type': 'City', name: s.name })),
    sameAs: Object.values(B.social || {}).filter(Boolean)
  };
  if (B.open247) ld.openingHoursSpecification = [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' }];
  if (B.rating && B.reviewCount) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: String(B.rating), reviewCount: String(B.reviewCount) };
  if ((B.licences || []).length) ld.hasCredential = B.licences.map((l) => `${l.label} ${l.number}`);
  return Object.assign(ld, extra);
}

function faqLd(list) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: list.map((f) => ({ '@type': 'Question', name: T(f.q), acceptedAnswer: { '@type': 'Answer', text: T(f.a) } })) };
}

function areasHtml() {
  const groups = Object.values(C.regions).filter((r) => r.suburbs.length).map((r) => `<div><h3>${esc(r.label)}</h3><ul>${r.suburbs.map((s) => {
    const n = C.suburbs.find((x) => x.slug === s).name;
    return `<li><a href="${C.paths.suburb(s)}">${esc(n)}</a></li>`;
  }).join('')}</ul></div>`);
  return `<div class="regions">${groups.join('')}</div>`;
}

module.exports = { esc, img, SITE, smsHref, serviceOptions, fullAddress, mapsUrl, callBtn, textBtn, head, header, footer, quoteForm, quoteSection, faqHtml, localBusinessLd, faqLd, areasHtml };
