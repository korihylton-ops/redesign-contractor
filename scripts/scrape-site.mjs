#!/usr/bin/env node
// Scrape every page of a contractor's existing website into <out>/raw-pages.json + raw-posts.json (WordPress REST shape).
//   node scripts/scrape-site.mjs <url> --out <dir> [--max 600] [--browser]
// 1) WordPress: /wp-json/wp/v2/pages|posts|media (fast, complete).  2) Anything else: sitemap.xml, then a link crawl.
// --browser renders pages with Playwright (for JS-only sites). Sites behind bot protection (403 for both) need manual sources.
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const argv = process.argv.slice(2);
const url = argv.find((a) => /^https?:\/\//.test(a));
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
if (!url) { console.error('usage: scrape-site.mjs <url> --out <dir> [--max 600] [--browser]'); process.exit(1); }
const out = path.resolve(opt('out', './_scrape'));
const MAX = parseInt(opt('max', '600'), 10);
const useBrowser = argv.includes('--browser');
fs.mkdirSync(out, { recursive: true });

const origin = new URL(url).origin;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' };
const decode = (s) => cheerio.load('<x>' + s + '</x>')('x').text();
const norm = (s) => s.replace(/\s+/g, ' ').trim();

async function getJson(u) { const r = await fetch(u, { headers }); if (!r.ok) return null; try { return await r.json(); } catch { return null; } }
async function getHtml(u) {
  if (useBrowser) return renderWithBrowser(u);
  const r = await fetch(u, { headers, redirect: 'follow' });
  if (!r.ok) return { status: r.status, html: '' };
  return { status: r.status, html: await r.text() };
}

let browser, page;
async function renderWithBrowser(u) {
  if (!browser) { const { chromium } = await import('playwright'); browser = await chromium.launch(); page = await (await browser.newContext({ userAgent: UA })).newPage(); }
  const res = await page.goto(u, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => null);
  await page.waitForTimeout(1200);
  return { status: res ? res.status() : 0, html: await page.content() };
}

/* ---------- 1. WordPress ---------- */
async function wpAll(type) {
  const list = [];
  for (let p = 1; p <= 30; p++) {
    const j = await getJson(`${origin}/wp-json/wp/v2/${type}?per_page=100&page=${p}&_fields=id,slug,link,title,date,modified,type,parent,content,excerpt,yoast_head_json`);
    if (!Array.isArray(j) || !j.length) break;
    list.push(...j);
    if (j.length < 100) break;
  }
  return list;
}

const probe = await getJson(`${origin}/wp-json/wp/v2/pages?per_page=1&_fields=id`);
let pages = [], posts = [], platform = 'unknown';
if (Array.isArray(probe)) {
  platform = 'wordpress';
  console.log('WordPress detected: using the REST API');
  pages = await wpAll('pages');
  posts = await wpAll('posts');
  const media = [];
  for (let p = 1; p <= 10; p++) {
    const j = await getJson(`${origin}/wp-json/wp/v2/media?per_page=100&page=${p}&_fields=id,source_url,alt_text,media_details,mime_type,date`);
    if (!Array.isArray(j) || !j.length) break; media.push(...j); if (j.length < 100) break;
  }
  fs.writeFileSync(path.join(out, 'media.json'), JSON.stringify(media));
  console.log(`  pages ${pages.length}, posts ${posts.length}, media ${media.length}`);
} else {
  /* ---------- 2. Generic crawl ---------- */
  console.log('Not WordPress (or REST disabled): crawling sitemap and links' + (useBrowser ? ' with a browser' : ''));
  const seen = new Set();
  const queue = [];
  const add = (u) => { try { const x = new URL(u, origin); if (x.origin !== origin) return; x.hash = ''; x.search = ''; let p = x.pathname.replace(/\/+$/, '') || '/'; if (/\.(jpe?g|png|gif|webp|svg|pdf|zip|css|js|xml|ico|mp4|woff2?)$/i.test(p)) return; const k = origin + p; if (!seen.has(k)) { seen.add(k); queue.push(k); } } catch { /* skip */ } };
  add(url);
  async function sitemap(u, depth = 0) {
    const r = await fetch(u, { headers }).catch(() => null);
    if (!r || !r.ok) return;
    const $ = cheerio.load(await r.text(), { xmlMode: true });
    const subs = $('sitemap > loc').map((_, e) => $(e).text().trim()).get();
    if (subs.length && depth < 2) for (const s of subs.slice(0, 20)) await sitemap(s, depth + 1);
    $('url > loc').each((_, e) => add($(e).text().trim()));
  }
  await sitemap(origin + '/sitemap.xml'); await sitemap(origin + '/sitemap_index.xml');
  console.log('  sitemap gave', queue.length, 'urls');
  const collected = [];
  let blocked = 0;
  for (let i = 0; i < queue.length && collected.length < MAX; i++) {
    const u = queue[i];
    const { status, html } = await getHtml(u).catch(() => ({ status: 0, html: '' }));
    if (status === 403 || status === 406 || status === 429) { blocked++; continue; }
    if (!html || status >= 400) continue;
    const $ = cheerio.load(html);
    $('a[href]').each((_, a) => { if (queue.length < MAX * 2) add($(a).attr('href')); });
    const title = norm($('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text());
    const description = norm($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '');
    $('script,style,noscript,svg,iframe,form,header,footer,nav,aside,.cookie,[class*="cookie"],[id*="cookie"]').remove();
    const main = $('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('#content, .entry-content, .content, #main').first().length ? $('#content, .entry-content, .content, #main').first() : $('body');
    const p = new URL(u).pathname.replace(/\/+$/, '') || '/';
    const isPost = /^\/(blog|news|posts?|articles?|insights|guides|journal)\//.test(p);
    collected.push({
      id: collected.length + 1, slug: p.split('/').pop() || 'home', link: u + (p === '/' ? '' : '/'), type: isPost ? 'post' : 'page',
      title: { rendered: title.replace(/\s*[|\-–].*$/, '') || title }, date: new Date().toISOString(), modified: new Date().toISOString(),
      excerpt: { rendered: description }, content: { rendered: main.html() || '' }, yoast_head_json: { title, description }
    });
    if (collected.length % 25 === 0) console.log('  crawled', collected.length);
  }
  if (blocked && !collected.length) console.error('All requests were blocked (403/406). The site has bot protection. Try --browser, or gather text from Google Maps / Facebook / directories instead.');
  posts = collected.filter((c) => c.type === 'post'); pages = collected.filter((c) => c.type !== 'post');
  platform = 'crawl';
  console.log(`  pages ${pages.length}, posts ${posts.length}` + (blocked ? `, blocked ${blocked}` : ''));
}
if (browser) await browser.close();

fs.writeFileSync(path.join(out, 'raw-pages.json'), JSON.stringify(pages));
fs.writeFileSync(path.join(out, 'raw-posts.json'), JSON.stringify(posts));
fs.writeFileSync(path.join(out, 'site.json'), JSON.stringify({ origin, platform, scrapedAt: new Date().toISOString(), pages: pages.length, posts: posts.length }, null, 2));
const homeText = pages.length ? decode(((pages.find((p) => /\/$/.test(p.link.replace(origin, '')) && p.link.replace(origin, '') === '/') || pages[0]).content || {}).rendered || '').replace(/\s+/g, ' ').slice(0, 300) : '';
console.log(`\nDone: ${pages.length + posts.length} items saved to ${out}\nHome text starts: ${homeText}`);
if (!pages.length && !posts.length) process.exit(2);
