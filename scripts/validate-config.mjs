#!/usr/bin/env node
// Enforce the content floors on a project.  node scripts/validate-config.mjs <projectDir> [--floors floors.json] [--json]
// Exits 1 if any hard requirement fails. The agent must fix failures (write more real content) and re-run.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const proj = path.resolve(argv.find((a) => !a.startsWith('--')) || '.');
const fi = argv.indexOf('--floors');
const floors = JSON.parse(fs.readFileSync(fi >= 0 ? argv[fi + 1] : path.join(here, 'floors.json'), 'utf8'));
const asJson = argv.includes('--json');

const cfgFile = path.join(proj, 'content', 'config.json');
if (!fs.existsSync(cfgFile)) { console.error('No content/config.json in ' + proj); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(proj, 'content', 'site', f), 'utf8')); } catch { return []; } };
const scraped = load('pages.json'), generated = load('generated.json');

// Build the real page set with the engine itself, so counts match what will be served.
process.env.SITE_CONFIG = cfgFile;
const req = createRequire(path.join(proj, 'x.js'));
const built = req(path.join(proj, 'lib', 'pages.js')).buildAll();

const words = (s) => (s || '').split(/\s+/).filter(Boolean).length;
const blockWords = (blocks) => blocks.reduce((n, b) => n + (b.type === 'table' ? words(b.rows.map((r) => r.join(' ')).join(' ')) : words(b.text)), 0);
const items = scraped.concat(generated.filter((g) => !scraped.some((s) => s.path === g.path)));
const wordsByPath = Object.fromEntries(items.map((i) => [i.path, blockWords(i.blocks || [])]));
const sub = cfg.suburbs || [], prefix = (cfg.trade && cfg.trade.slugPrefix) || '';
const shortSub = sub.filter((s) => (wordsByPath['/' + prefix + s.slug] || 0) + words(s.intro) < floors.minWordsPerSuburbPage).map((s) => s.name);
const svc = [].concat(cfg.services || [], cfg.extraServices || []);
const shortSvc = svc.filter((s) => (wordsByPath['/' + s.slug] || 0) + words(s.intro) < floors.minWordsPerServicePage).map((s) => s.name);
const totalWords = items.reduce((n, i) => n + blockWords(i.blocks || []), 0);
const heroFile = cfg.images && cfg.images.hero && path.join(proj, 'public', 'images', cfg.images.hero);
const heroKB = heroFile && fs.existsSync(heroFile) ? Math.round(fs.statSync(heroFile).size / 1024) : 0;
const missingImages = [cfg.images && cfg.images.logo, cfg.images && cfg.images.hero, cfg.images && cfg.images.about, ...(cfg.gallery || []).map((g) => g.src), ...svc.map((s) => s.image)].filter(Boolean).filter((f) => !fs.existsSync(path.join(proj, 'public', 'images', /\.[a-z0-9]{3,4}$/i.test(f) ? f : f + '.jpg')));
const b = cfg.business || {};

const checks = [];
const need = (name, actual, min, hard = true, note = '') => checks.push({ name, actual, min, ok: actual >= min, hard, note });
const truthy = (name, ok, note = '', hard = true) => checks.push({ name, actual: ok ? 'yes' : 'no', min: 'yes', ok: !!ok, hard, note });

truthy('business name, phone, suburb, email present', b.name && b.phone && b.address && b.address.suburb && b.email, 'Fill business.name/phone/email/address');
truthy('trade wording set (noun, nounPlural, schemaType, slugPrefix)', cfg.trade && cfg.trade.noun && cfg.trade.nounPlural && cfg.trade.schemaType && cfg.trade.slugPrefix, 'Set config.trade');
truthy('brand colours set', cfg.brand && cfg.brand.primary && cfg.brand.ink, 'Set config.brand.primary and .ink from the client site');
truthy('licence or registration listed', (b.licences || []).length > 0, 'Trade licence numbers build trust; add business.licences (or set to [] only if the trade is unlicensed)', false);
need('suburbs covered', sub.length, floors.suburbs);
need('regions', Object.keys(cfg.regions || {}).length, floors.regions);
truthy('every suburb has a valid region', sub.every((s) => cfg.regions && cfg.regions[s.region]), 'Each suburbs[].region must exist in regions');
need('region pages', (cfg.regionPages || []).length, floors.regionPages);
need('featured services (selector)', (cfg.services || []).length, floors.servicesFeatured);
need('services total', svc.length, floors.servicesTotal);
need('FAQs', (cfg.faqs || []).length, floors.faqs);
need('reviews (real, from the client site)', (cfg.reviews || []).length + scraped.reduce((n, i) => n + (i.path === '/' ? (i.blocks || []).filter((x) => x.type === 'review').length : 0), 0), floors.reviews);
need('gallery photos', (cfg.gallery || []).length, floors.gallery);
need('stats', (cfg.stats || []).length, floors.stats);
need('why-us tiles (bento)', (cfg.bento || []).length, floors.bento);
need('process steps', (cfg.steps || []).length, floors.steps);
need('price sheet rows', (cfg.priceSheet || []).length, floors.priceSheet, !cfg.business || !cfg.business.noPrices, 'Set business.noPrices=true only if the client never publishes prices');
need('upgrade offers', (cfg.offers || []).length, floors.offers);
need('total pages served', built.size, floors.totalPages);
need('total words across pages', totalWords, floors.totalWords);
need('suburb pages with enough text', sub.length - shortSub.length, sub.length, true, shortSub.length ? 'Too short: ' + shortSub.slice(0, 8).join(', ') + (shortSub.length > 8 ? '...' : '') : '');
need('service pages with enough text', svc.length - shortSvc.length, svc.length, true, shortSvc.length ? 'Too short: ' + shortSvc.slice(0, 8).join(', ') : '');
const heroGenerated = ((cfg.images || {}).generatedFiles || []).includes(cfg.images && cfg.images.hero);
need('hero image size (KB)', heroKB, floors.heroImageMinKB, !heroGenerated, heroGenerated ? 'Hero is a generated illustration: replace it with a real photo when one is available' : 'Use a sharp, large hero photo');
truthy('all referenced images exist in public/images', missingImages.length === 0, missingImages.slice(0, 6).join(', '));

const fails = checks.filter((c) => !c.ok && c.hard), warns = checks.filter((c) => !c.ok && !c.hard);
if (asJson) { console.log(JSON.stringify({ built: built.size, totalWords, checks }, null, 2)); process.exit(fails.length ? 1 : 0); }
console.log(`Content floors for ${b.name || proj}  (pages ${built.size}, words ${totalWords})\n`);
checks.forEach((c) => console.log(`${c.ok ? 'PASS' : c.hard ? 'FAIL' : 'WARN'}  ${c.name}: ${c.actual} (need ${c.min})${!c.ok && c.note ? '  -> ' + c.note : ''}`));
console.log(`\n${checks.length - fails.length - warns.length} passed, ${warns.length} warnings, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
