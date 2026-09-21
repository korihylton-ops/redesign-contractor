'use strict';
// Text content store. Two sources, merged by path:
//   content/site/pages.json      text scraped from the client's original website (scripts/extract-content.mjs)
//   content/site/generated.json  extra pages written for the new site to meet the content floors (same shape)
// Page shape: { kind:'page'|'post', path, title, seoTitle, seoDescription, excerpt, date, modified, id,
//               blocks:[{type:'h2'|'h3'|'p'|'li'|'quote'|'table'|'review', html, text, rows?, name?}] }
const fs = require('fs');
const path = require('path');

function load(name) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'site', name), 'utf8')); } catch (e) { return []; }
}

const scraped = load('pages.json');
const generated = load('generated.json');
const seen = new Set(scraped.map((i) => i.path));
const items = scraped.concat(generated.filter((g) => g && g.path && !seen.has(g.path)).map((g, n) => Object.assign({
  kind: 'page', id: 900000 + n, date: new Date().toISOString().slice(0, 10), modified: new Date().toISOString().slice(0, 10), seoTitle: '', seoDescription: '', excerpt: ''
}, g)));
const byPath = new Map(items.map((i) => [i.path, i]));

const posts = items.filter((i) => i.kind === 'post').sort((a, b) => (a.date < b.date ? 1 : -1));

function get(p) { return byPath.get(p) || null; }
function all() { return items; }

/* Pages that share the first path segment (e.g. /plumber-ashfield/*), excluding the page itself. */
function siblings(p, limit) {
  const seg = p.split('/').filter(Boolean);
  if (seg.length < 1) return [];
  const root = '/' + seg[0];
  const out = items.filter((i) => i.path !== p && (i.path === root || i.path.startsWith(root + '/')));
  return limit ? out.slice(0, limit) : out;
}

module.exports = { get, all, posts, siblings };
