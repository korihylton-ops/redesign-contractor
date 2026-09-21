#!/usr/bin/env node
// Turn scraped HTML (scrape-site.mjs output) into clean, ordered text blocks: content/site/pages.json
//   node scripts/extract-content.mjs --in <scrapeDir> --out <project>/content/site/pages.json
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const IN = path.resolve(opt('in', './_scrape'));
const OUT = path.resolve(opt('out', './content/site/pages.json'));
const siteInfo = JSON.parse(fs.readFileSync(path.join(IN, 'site.json'), 'utf8'));
const B = siteInfo.origin;
const pages = JSON.parse(fs.readFileSync(path.join(IN, 'raw-pages.json'), 'utf8'));
const posts = JSON.parse(fs.readFileSync(path.join(IN, 'raw-posts.json'), 'utf8'));

const decode = (s) => cheerio.load('<x>' + s + '</x>')('x').text();
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const BLOCK = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'dt', 'dd', 'figcaption']);
const STRUCT = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,dt,dd,figcaption,table,div,ul,ol,section,article';
const SKIP = new Set(['script', 'style', 'noscript', 'svg', 'form', 'select', 'option', 'input', 'textarea', 'iframe', 'img', 'button']);
const CHROME = /^(posted on google|excellent|based on \d+ reviews|read more|learn more|submit)$/i;
const esc = (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]);

function localHref(h) {
  if (!h) return null;
  if (h.startsWith(B)) return (h.slice(B.length).replace(/\/+$/, '') || '/') + '';
  if (h.startsWith('/') && !h.startsWith('//')) return h.replace(/\/+$/, '') || '/';
  if (/^(https?:|tel:|mailto:|sms:)/i.test(h)) return h;
  return null;
}

function inline($, el) {
  let out = '';
  $(el).contents().each((_, n) => {
    if (n.type === 'text') out += n.data.replace(/[&<>"]/g, esc);
    else if (n.type === 'tag') {
      const t = n.name.toLowerCase();
      if (SKIP.has(t)) return;
      const inner = inline($, n);
      if (t === 'a') { const h = localHref($(n).attr('href')); out += h ? `<a href="${h.replace(/"/g, '&quot;')}">${inner}</a>` : inner; }
      else if (t === 'strong' || t === 'b') out += inner.trim() ? `<strong>${inner}</strong>` : inner;
      else if (t === 'em' || t === 'i') out += inner.trim() ? `<em>${inner}</em>` : inner;
      else out += (t === 'br' ? ' ' : inner);
    }
  });
  return out.replace(/\s+/g, ' ').trim();
}

function extract(html) {
  const $ = cheerio.load(html);
  const blocks = [];
  const seen = new Set();
  const push = (b) => {
    const text = b.type === 'table' ? b.rows.map((r) => r.join(' ')).join(' ') : b.text;
    const t = norm(decode(text));
    if (!t || (b.type !== 'table' && (CHROME.test(t) || t.length < 2))) return;
    const key = b.type + '|' + t;
    if (!/^Trustindex verifies/i.test(t)) { if (seen.has(key)) return; seen.add(key); }
    blocks.push(b);
  };
  const para = (type, el) => { const h = inline($, el); push({ type, html: h, text: norm(decode(h)) }); };

  function visit(el, ctx) {
    const t = (el.name || '').toLowerCase();
    if (SKIP.has(t)) return;
    if (t === 'table') {
      const rows = [];
      $(el).find('tr').each((_, tr) => { const cells = []; $(tr).children('th,td').each((__, c) => cells.push(inline($, c))); if (cells.some(Boolean)) rows.push(cells); });
      if (rows.length) push({ type: 'table', rows, header: $(el).find('th').length > 0 });
      return;
    }
    if (BLOCK.has(t)) {
      const nested = $(el).find(STRUCT).length;
      const type = /^h[1-6]$/.test(t) ? t : t === 'li' ? 'li' : t === 'blockquote' ? 'quote' : 'p';
      if (!nested) { para(type, el); return; }
      // block with structured children (e.g. li containing p/ul): keep direct text, recurse for the rest
      $(el).contents().each((_, n) => { if (n.type === 'text') { const s = norm(n.data); if (s) push({ type, html: s.replace(/[&<>"]/g, esc), text: s }); } else if (n.type === 'tag') visit(n, type === 'li' ? 'li' : ctx); });
      return;
    }
    const nested = $(el).find(STRUCT).length;
    if (!nested) { if (norm($(el).text())) para(ctx === 'li' ? 'li' : 'p', el); return; }
    $(el).contents().each((_, n) => {
      if (n.type === 'text') { const s = norm(n.data); if (s) push({ type: ctx === 'li' ? 'li' : 'p', html: s.replace(/[&<>"]/g, esc), text: s }); }
      else if (n.type === 'tag') visit(n, ctx);
    });
  }
  $('body').contents().each((_, n) => { if (n.type === 'tag') visit(n, ''); else if (n.type === 'text' && norm(n.data)) push({ type: 'p', html: norm(n.data), text: norm(n.data) }); });
  return blocks;
}

function fixReviews(blocks) {
  // Widget layout: [name] [Trustindex verifies... (chrome)] [review text]. Older layout put the text on the same line.
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const m = b.text && b.text.match(/^Trustindex verifies that the original source of the review is Google\.?\s*(.*)$/i);
    const last = out[out.length - 1];
    if (m && last && last.type === 'p') {
      const prev = out.pop();
      let text = m[1], html = m[1];
      if (!text && blocks[i + 1] && blocks[i + 1].type === 'p') { i++; text = blocks[i].text; html = blocks[i].html; }
      const rk = (prev.text + '|' + text).toLowerCase();
      if (!out.some((o) => o.type === 'review' && (o.name + '|' + o.text).toLowerCase() === rk)) out.push({ type: 'review', name: prev.text, html, text });
    } else out.push(b);
  }
  // Drop widget boilerplate that carries no site content (the marker line, or reviews made only of it).
  const isMarker = (t) => /^Trustindex verifies that the original source of the review is Google\.?$/i.test((t || '').trim());
  return out.filter((b) => !(isMarker(b.text) || (b.type === 'review' && (!b.text || /^Trustindex/i.test(b.name)))));
}

const items = [];
for (const [kind, list] of [['page', pages], ['post', posts]]) {
  for (const it of list) {
    const path = it.link.replace(B, '').replace(/\/+$/, '') || '/';
    const blocks = fixReviews(extract(it.content.rendered));
    const src = norm(decode(it.content.rendered.replace(/<(script|style|noscript|form|select)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const out = new Set(norm(blocks.map((b) => (b.name ? b.name + ' ' : '') + (b.type === 'table' ? b.rows.map((r) => r.join(' ')).join(' ') : b.text)).join(' ')).toLowerCase().split(/\W+/));
    const missed = src.filter((w) => !out.has(w));
    const y = it.yoast_head_json || {};
    items.push({
      kind, path, slug: it.slug, id: it.id, title: norm(decode(it.title.rendered)), date: it.date.slice(0, 10), modified: it.modified.slice(0, 10),
      seoTitle: y.title ? norm(decode(y.title)) : '', seoDescription: y.description ? norm(decode(y.description)) : '',
      excerpt: norm(decode(it.excerpt ? it.excerpt.rendered : '')).slice(0, 300), blocks,
      coverage: src.length ? +(1 - missed.length / src.length).toFixed(3) : 1, missedSample: [...new Set(missed)].slice(0, 10)
    });
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(items));
const low = items.filter((i) => i.coverage < 0.98).sort((a, b) => a.coverage - b.coverage);
const types = {};
items.forEach((i) => i.blocks.forEach((b) => { types[b.type] = (types[b.type] || 0) + 1; }));
const words = items.reduce((n, i) => n + i.blocks.reduce((m, b) => m + ((b.type === 'table' ? b.rows.map((r) => r.join(' ')).join(' ') : b.text || '').split(/\s+/).length), 0), 0);
console.log('items', items.length, '| blocks', items.reduce((s, i) => s + i.blocks.length, 0), '| words', words, '| avg coverage', (items.reduce((s, i) => s + i.coverage, 0) / items.length).toFixed(4));
console.log('block types', JSON.stringify(types));
console.log('pages below 98% word coverage:', low.length);
low.slice(0, 8).forEach((i) => console.log(' ', i.coverage, i.path, '|', i.missedSample.join(',')));
console.log('written', OUT);
