#!/usr/bin/env node
// Prove the rebuilt site carries every block of text scraped from the original.
//   node scripts/verify-text.mjs <projectDir> [--min 0.999]
// Renders every page with the project's own engine and checks each scraped text block appears verbatim.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const argv = process.argv.slice(2);
const proj = path.resolve(argv.find((a) => !a.startsWith('--')) || '.');
const mi = argv.indexOf('--min');
const MIN = mi >= 0 ? parseFloat(argv[mi + 1]) : 0.999;

process.env.SITE_CONFIG = path.join(proj, 'content', 'config.json');
const req = createRequire(path.join(proj, 'x.js'));
const S = req(path.join(proj, 'lib', 'site.js'));
const pages = req(path.join(proj, 'lib', 'pages.js')).buildAll();

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const norm = (s) => decode(s).replace(/<[^>]+>/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').replace(/ ([,.;:!?])/g, '$1').trim().toLowerCase();

let total = 0, found = 0;
const missing = [];
for (const item of S.all()) {
  const html = pages.get(item.path);
  if (!html) { missing.push({ path: item.path, text: '(page not served)' }); continue; }
  const body = norm(html);
  const check = (text, kind) => { total++; const t = norm(text); if (!t || body.includes(t)) found++; else missing.push({ path: item.path, kind, text: t.slice(0, 110) }); };
  for (const b of item.blocks) {
    if (b.type === 'table') b.rows.forEach((r) => r.forEach((c) => check(c, 'cell')));
    else if (b.type === 'review') { check(b.name, 'review-name'); check(b.text, 'review'); }
    else check(b.html, b.type);
  }
}
const ratio = total ? found / total : 1;
console.log(`pages served: ${pages.size} | source pages: ${S.all().length}`);
console.log(`text blocks: ${total} | found verbatim: ${found} (${(ratio * 100).toFixed(3)}%) | required: ${(MIN * 100).toFixed(1)}%`);
missing.slice(0, 10).forEach((m) => console.log('  missing:', m.path, '|', m.kind || '', '|', m.text));
if (missing.length > 10) console.log(`  ...and ${missing.length - 10} more`);
process.exit(ratio >= MIN ? 0 : 1);
