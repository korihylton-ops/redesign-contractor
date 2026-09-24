'use strict';
// Loads content/config.json and exposes it in the shape the engine uses everywhere.
// The whole site (copy, services, suburbs, brand, trade wording) comes from this one file.
const fs = require('fs');
const path = require('path');

const FILE = process.env.SITE_CONFIG || path.join(__dirname, '..', 'content', 'config.json');
let cfg;
try { cfg = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
catch (e) { throw new Error(`Cannot read site config at ${FILE}: ${e.message}. Run the redesign-contractor skill (or copy examples/starter/config.json to content/config.json).`); }

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const digits = (s) => String(s || '').replace(/\D/g, '');

/* ---------- trade wording ---------- */
const trade = Object.assign({
  noun: 'contractor', nounPlural: 'contractors', schemaType: 'HomeAndConstructionBusiness',
  slugPrefix: '', selector: 'panel', selectorHeading: 'Pick a service to see the job and the price',
  selectorLede: 'Everything we do, in one place. Pick a service to see what is included and what it costs.',
  emergencyLabel: 'Emergency call-out'
}, cfg.trade || {});

/* ---------- business ---------- */
const b = cfg.business || {};
const e164 = b.phoneE164 || (digits(b.phone).startsWith('0') ? '+61' + digits(b.phone).slice(1) : '+' + digits(b.phone));
const business = Object.assign({
  name: 'Your Business', legalName: '', phone: '', email: '', abn: '', abnLabel: 'ABN', licences: [], insurance: '',
  rating: '', reviewCount: 0, standardRate: null, afterHoursRate: null, firstJobDiscount: null,
  yearsExperience: null, customersServed: null, people: {}, social: {}, hoursText: '', open247: false,
  address: { street: '', suburb: '', state: '', postcode: '', country: 'AU' }
}, b);
business.legalName = business.legalName || business.name;
business.phoneE164 = e164;
business.phoneHref = 'tel:' + e164;
/* Texting needs a number that can receive SMS. Australian landlines (+61 2/3/7/8) cannot: a "Text us"
   button pointed at one opens the visitor's SMS app, lets them send, and the message silently never
   arrives, which is a dead button no status check can see. A mobile in business.textNumber (or env
   TEXT_NUMBER) turns texting on; otherwise text buttons fall back to the on-page enquiry form. */
const textRaw = process.env.TEXT_NUMBER || b.textNumber || '';
const textE164 = textRaw ? (textRaw.startsWith('+') ? '+' + digits(textRaw) : digits(textRaw).startsWith('0') ? '+61' + digits(textRaw).slice(1) : '+' + digits(textRaw)) : (b.phone && !/^\+61[2378]/.test(e164) ? e164 : '');
business.textE164 = textE164;
business.canText = !!textE164;
business.reach = business.canText ? (textRaw ? `call ${b.phone} or text ${b.textNumber || textRaw}` : `call or text ${b.phone}`) : `call ${b.phone}`;
business.licenceLine = (business.licences || []).map((l) => `${l.label} ${l.number}`).join('. ');
business.city = business.address.suburb;

/* ---------- token expansion: "{{name}} in {{city}}" ---------- */
function tokens(extra) {
  return Object.assign({
    name: business.name, legalName: business.legalName, phone: business.phone, email: business.email, city: business.city,
    state: business.address.state, noun: trade.noun, nounPlural: trade.nounPlural, Noun: cap(trade.noun), Nouns: cap(trade.nounPlural),
    standardRate: business.standardRate, afterHoursRate: business.afterHoursRate, discount: business.firstJobDiscount,
    rating: business.rating, reviewCount: business.reviewCount, area: (cfg.site && cfg.site.areaLabel) || business.city,
    years: business.yearsExperience, customers: business.customersServed
  }, extra || {});
}
function T(str, extra) {
  if (typeof str !== 'string') return str;
  const t = tokens(extra);
  return str.replace(/\{\{(\w+)\}\}/g, (m, k) => (t[k] === undefined || t[k] === null ? '' : String(t[k])));
}

/* ---------- regions + suburbs ---------- */
const regions = {};
Object.entries(cfg.regions || {}).forEach(([k, r]) => { regions[k] = Object.assign({ suburbs: [] }, r); });
const suburbs = (cfg.suburbs || []).map((s) => {
  if (!regions[s.region]) regions[s.region] = { label: s.region, suburbs: [] };
  regions[s.region].suburbs.push(s.slug);
  return Object.assign({}, s, { regionLabel: regions[s.region].label });
});

/* ---------- brand ---------- */
const hex = (h) => { const m = String(h).replace('#', ''); const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m; return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)); };
const toHex = (rgb) => '#' + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
const mix = (a, c, t) => { const A = hex(a), Cc = hex(c); return toHex(A.map((v, i) => v * (1 - t) + Cc[i] * t)); };
const lum = (h) => { const [r, g, bl] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
const contrast = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* Visual themes. Every theme keeps the same page structure and features; a theme changes colours
   (light or dark), fonts, the hero treatment and the styling of cards and buttons. Each has a default
   font pairing, used when the config gives no fonts. See docs/THEMES.md for how to pick one. */
const THEMES = {
  classic: { displayFamily: 'Archivo', displayCss: 'Archivo:wdth,wght@62..125,100..900', bodyFamily: 'Hanken Grotesk', bodyCss: 'Hanken+Grotesk:wght@400;500;600;700' },
  floodlit: { displayFamily: 'Big Shoulders Display', displayCss: 'Big+Shoulders+Display:wght@700;800', bodyFamily: 'Public Sans', bodyCss: 'Public+Sans:wght@400;500;600;700' },
  harbour: { displayFamily: 'Manrope', displayCss: 'Manrope:wght@500;600;700;800', bodyFamily: 'Manrope', bodyCss: 'Manrope:wght@400;500;600;700' },
  amber: { displayFamily: 'Outfit', displayCss: 'Outfit:wght@500;600;700;800', bodyFamily: 'Outfit', bodyCss: 'Outfit:wght@400;500;600;700' },
  slate: { displayFamily: 'Barlow', displayCss: 'Barlow:wght@600;700;800', bodyFamily: 'Barlow', bodyCss: 'Barlow:wght@400;500;600;700' },
  studio: { displayFamily: 'DM Serif Display', displayCss: 'DM+Serif+Display', bodyFamily: 'Figtree', bodyCss: 'Figtree:wght@400;500;600;700' },
};
const brand = Object.assign({ primary: '#0bb2ea', ink: '#0c1e24', hazard: '#ffb000', surface: '#f4f8f9' }, cfg.brand || {});
brand.theme = Object.prototype.hasOwnProperty.call(THEMES, brand.theme) ? brand.theme : 'classic';
// Amber Bold puts dark text on the accent colour; a dark accent would be unreadable, so fall back.
if (brand.theme === 'amber' && contrast(brand.hazard, brand.ink) < 4.5) {
  console.warn(`brand.theme "amber" needs a light accent (hazard ${brand.hazard} vs ink ${brand.ink} is below 4.5:1); using "harbour".`);
  brand.theme = 'harbour';
}
brand.fonts = Object.assign({}, THEMES[brand.theme], brand.fonts || {});
// Accent for text/links must pass 4.5:1 on white; darken the primary until it does unless one is supplied.
brand.accentText = brand.accentText || (() => { let c = brand.primary; for (let i = 0; i < 12 && contrast(c, '#ffffff') < 4.6; i++) c = mix(c, '#000000', 0.12); return c; })();
brand.primaryTint = brand.primaryTint || mix(brand.primary, '#ffffff', 0.88);
brand.onPrimary = brand.onPrimary || (contrast(brand.primary, brand.ink) >= contrast(brand.primary, '#ffffff') ? brand.ink : '#ffffff');
brand.inkSoft = brand.inkSoft || mix(brand.ink, '#ffffff', 0.25);
brand.border = brand.border || mix(brand.surface, brand.ink, 0.12);

function brandCss() {
  const f = brand.fonts;
  return `:root{--ink:${brand.ink};--ink-soft:${brand.inkSoft};--cyan:${brand.primary};--cyan-tint:${brand.primaryTint};--teal:${brand.accentText};--amber:${brand.hazard};--mains:${brand.surface};--grey:${brand.border};--on-primary:${brand.onPrimary};--font-display:"${f.displayFamily}","Arial Narrow",system-ui,sans-serif;--font-body:"${f.bodyFamily}",system-ui,-apple-system,"Segoe UI",sans-serif}`;
}
function fontsUrl() { const f = brand.fonts; return `https://fonts.googleapis.com/css2?family=${f.displayCss}&family=${f.bodyCss}&display=swap`; }

/* ---------- services (form options come from them) ---------- */
const services = cfg.services || [];
const extraServices = cfg.extraServices || [];
const formServices = Array.from(new Set([].concat(services, extraServices).map((s) => s.option || s.name).concat(cfg.extraFormOptions || ['Other / not sure'])));

/* Expand the business-wide tokens ({{name}}, {{standardRate}} ...) inside data lists once, at load.
   Per-page tokens such as {{suburb}} are left intact so pages.js can fill them in later. */
const KNOWN = tokens();
function expandKnown(v) {
  if (typeof v === 'string') return v.replace(/\{\{(\w+)\}\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(KNOWN, k) ? (KNOWN[k] === null || KNOWN[k] === undefined ? '' : String(KNOWN[k])) : m));
  if (Array.isArray(v)) return v.map(expandKnown);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[k] = expandKnown(v[k]); }); return o; }
  return v;
}

const paths = {
  suburb: (slug) => '/' + trade.slugPrefix + slug,
  region: (slug) => '/' + trade.slugPrefix + slug
};

module.exports = {
  cfg, site: cfg.site || {}, trade, business, brand, brandCss, fontsUrl, T, tokens, paths, cap, THEMES,
  images: cfg.images || {}, copy: cfg.copy || {}, stats: cfg.stats || [], bento: expandKnown(cfg.bento || []), steps: expandKnown(cfg.steps || []),
  services: expandKnown(services), extraServices: expandKnown(extraServices), formServices, suburbs, regions, regionPages: cfg.regionPages || [],
  reviews: cfg.reviews || [], faqs: expandKnown(cfg.faqs || []), priceSheet: expandKnown(cfg.priceSheet || []), gallery: cfg.gallery || [],
  offers: expandKnown(cfg.offers || []), promise: cfg.promise ? expandKnown(cfg.promise) : null, chat: cfg.chat || {}, nav: cfg.nav || null
};
