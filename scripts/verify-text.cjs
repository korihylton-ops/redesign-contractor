// Verifies that every scraped text block appears in the rendered HTML of the rebuilt page.
const S = require('../lib/site');
const pages = require('../lib/pages').buildAll();

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const norm = (s) => decode(s).replace(/<[^>]+>/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

let totalBlocks = 0, found = 0;
const missing = [];
for (const item of S.all()) {
  const html = pages.get(item.path);
  if (!html) { missing.push({ path: item.path, text: '(PAGE NOT SERVED)' }); continue; }
  const body = norm(html);
  const check = (text, kind) => {
    totalBlocks++;
    const t = norm(text);
    if (!t) { found++; return; }
    if (body.includes(t)) found++; else missing.push({ path: item.path, kind, text: t.slice(0, 110) });
  };
  for (const b of item.blocks) {
    if (b.type === 'table') b.rows.forEach((r) => r.forEach((c) => check(c, 'cell')));
    else if (b.type === 'review') { check(b.name, 'review-name'); check(b.text, 'review'); }
    else check(b.html, b.type);
  }
}
const pct = ((found / totalBlocks) * 100).toFixed(2);
console.log(`pages served: ${pages.size} (store items ${S.all().length})`);
console.log(`text blocks: ${totalBlocks}, found verbatim in rendered pages: ${found} (${pct}%)`);
console.log('missing:', missing.length);
const byPath = {};
missing.forEach((m) => { byPath[m.path] = (byPath[m.path] || 0) + 1; });
Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([p, n]) => console.log('  ', n, p));
missing.slice(0, 8).forEach((m) => console.log('   e.g.', m.path, '|', m.kind, '|', m.text));
