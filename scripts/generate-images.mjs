#!/usr/bin/env node
// Fill in any image the config references but the project does not have (real photos come first: scripts/photos.mjs).
//   node scripts/generate-images.mjs <projectDir> [--provider auto|openai|illustration] [--force <file,file>]
// Providers:
//   openai        OPENAI_API_KEY in the environment (model IMAGE_MODEL, default gpt-image-1): AI photographs, no people/text/logos.
//   illustration  built in, no key: clean brand-coloured illustrations with a trade icon (always available).
// "auto" uses openai when a key is present, otherwise illustration.
// Generated images are recorded in config.images.generatedFiles so the site never presents them as real jobs or a real team.
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const proj = path.resolve(argv.find((a) => !a.startsWith('--')) || '.');
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const cfgFile = path.join(proj, 'content', 'config.json');
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const imgDir = path.join(proj, 'public', 'images');
fs.mkdirSync(imgDir, { recursive: true });
const provider = opt('provider', 'auto') === 'auto' ? (process.env.OPENAI_API_KEY ? 'openai' : 'illustration') : opt('provider');
const force = (opt('force', '') || '').split(',').filter(Boolean);

const renames = {};
const withExt = (f) => { if (!f) return f; const m = f.match(/\.([a-z0-9]{3,4})$/i); if (!m) return f + '.jpg'; if (/^(jpe?g|png)$/i.test(m[1])) return f; const nf = f.replace(/\.[a-z0-9]{3,4}$/i, '.jpg'); renames[f] = nf; return nf; };
const brand = Object.assign({ primary: '#1f6feb', ink: '#111827', surface: '#f6f8fa' }, cfg.brand || {});
const trade = (cfg.trade && cfg.trade.noun) || 'contractor';
const area = (cfg.site && cfg.site.areaLabel) || '';
const bizName = (cfg.business && cfg.business.name) || 'Business';

/* ---- what is needed ---- */
const jobs = [];
const want = (file, role, subject) => { if (!file) return; const f = withExt(file); if (jobs.some((j) => j.file === f)) return; if (!fs.existsSync(path.join(imgDir, f)) || force.includes(f)) jobs.push({ file: f, role, subject }); };
const I = cfg.images || {};
want(I.hero, 'hero', `a clean, unmarked ${trade} work van parked outside a well-kept suburban home`);
want(I.about, 'square', `tidy ${trade} tools and equipment neatly arranged on a workbench`);
want(I.expand, 'wide', `a finished, professional ${trade} installation in a modern home`);
want(I.og || I.hero, 'hero', `a clean, unmarked ${trade} work van parked outside a well-kept suburban home`);
[].concat(cfg.services || [], cfg.extraServices || []).forEach((s) => want(s.image, 'portrait', `${s.name}, a finished ${trade} job`));
(cfg.gallery || []).forEach((g, i) => want(g.src, i % 3 === 2 ? 'square' : 'portrait', g.alt || `a finished ${trade} job`));
(cfg.regionPages || []).forEach((r) => want(r.image, 'landscape', `a suburban street in ${r.name}`));
(cfg.suburbs || []).forEach((s) => want(s.image, 'landscape', `a suburban street in ${s.name}`));
const logoFile = I.logo ? (/\.(jpe?g|png)$/i.test(I.logo) ? I.logo : I.logo.replace(/\.[a-z0-9]{3,4}$/i, '') + '.png') : '';
if (I.logo && logoFile !== I.logo) renames[I.logo] = logoFile;
const logoMissing = I.logo && !fs.existsSync(path.join(imgDir, I.logo)) && !fs.existsSync(path.join(imgDir, logoFile));

if (!jobs.length && !logoMissing) { console.log('Nothing to generate: every referenced image exists.'); process.exit(0); }
console.log(`${jobs.length} image(s) to generate${logoMissing ? ' + a text logo' : ''} using "${provider}"`);

const SIZES = { hero: [900, 1200], portrait: [900, 1200], square: [800, 800], wide: [1600, 800], landscape: [1200, 800] };
const ICONS = {
  bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',
  droplet: '<path d="M12 2.7c3.5 4.2 6 7.2 6 10.3a6 6 0 0 1-12 0c0-3.1 2.5-6.1 6-10.3z"/>',
  snow: '<path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>',
  roof: '<path d="M3 11 12 3l9 8M5 10v10h14V10M10 20v-6h4v6"/>',
  leaf: '<path d="M5 21C5 12 10 5 21 5c0 11-7 16-16 16zM5 21c3-6 6-9 10-11"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'
};
const iconFor = () => (/electric/i.test(trade) ? 'bolt' : /plumb|drain|gas/i.test(trade) ? 'droplet' : /hvac|air|cool|heat|refrig/i.test(trade) ? 'snow' : /roof|gutter/i.test(trade) ? 'roof' : /landscap|garden|lawn|tree/i.test(trade) ? 'leaf' : 'wrench');

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hexToRgb(a).map((v, i) => Math.round(v * (1 - t) + hexToRgb(b)[i] * t).toString(16).padStart(2, '0')).join('');

async function illustrate(job, n) {
  const [w, h] = SIZES[job.role] || SIZES.portrait;
  const a = mix(brand.primary, '#ffffff', 0.35 + (n % 4) * 0.05), b = brand.primary, c = mix(brand.primary, brand.ink, 0.72);
  const angle = 120 + (n * 37) % 90;
  const label = job.role === 'hero' || job.role === 'wide' || job.role === 'square' ? '' : job.subject.split(',')[0].replace(/^a finished .* job$/, '');
  const S = Math.min(w, h);
  const html = `<body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;background:linear-gradient(${angle}deg,${a},${b} 48%,${c});font-family:system-ui,Arial,sans-serif">
    <svg width="${w}" height="${h}" style="position:absolute;inset:0" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="p" width="46" height="46" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="#fff" fill-opacity=".13"/></pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>
      <circle cx="${w * 0.82}" cy="${h * 0.16}" r="${S * 0.42}" fill="#fff" fill-opacity=".07"/><circle cx="${w * 0.12}" cy="${h * 0.9}" r="${S * 0.36}" fill="#000" fill-opacity=".10"/>
      <g transform="translate(${w / 2 - S * 0.19} ${h * 0.44 - S * 0.19}) scale(${(S * 0.38) / 24})" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconFor()]}</g>
    </svg>
    ${label ? `<div style="position:absolute;left:${S * 0.07}px;right:${S * 0.07}px;bottom:${S * 0.1}px;color:#fff;font-weight:700;font-size:${Math.round(S * 0.055)}px;line-height:1.15;text-shadow:0 2px 12px rgba(0,0,0,.25)">${label.replace(/[<>&]/g, '')}</div>` : ''}
    <div style="position:absolute;right:${S * 0.04}px;bottom:${S * 0.03}px;color:#fff;opacity:.7;font-size:${Math.round(S * 0.022)}px">Illustration</div></body>`;
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html);
  await page.waitForTimeout(150);
  return page.screenshot({ type: 'jpeg', quality: 88 });
}

async function openai(job) {
  const [w, h] = SIZES[job.role] || SIZES.portrait;
  const size = w === h ? '1024x1024' : w > h ? '1536x1024' : '1024x1536';
  const prompt = `Professional natural-light photograph of ${job.subject}${area ? ', in ' + area : ''}. Realistic, well composed, high quality. No people, no text, no logos, no watermarks, no signage.`;
  const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.IMAGE_MODEL || 'gpt-image-1', prompt, size, n: 1, quality: 'medium' }), signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('image API ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const b64 = j.data && j.data[0] && (j.data[0].b64_json || null);
  if (!b64) throw new Error('image API returned no image');
  // convert whatever came back to a JPEG at the target size
  const jpg = await page.evaluate(async ({ b64, w, h }) => {
    const img = new Image(); await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); const s = Math.min(1, Math.max(w, h) * 1.4 / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, { b64, w, h });
  return Buffer.from(jpg, 'base64');
}

const done = [];
let n = 0;
for (const job of jobs) {
  n++;
  try {
    const buf = provider === 'openai' ? await openai(job) : await illustrate(job, n);
    fs.writeFileSync(path.join(imgDir, job.file), buf);
    done.push(job.file);
    console.log(`  generated ${job.file} (${Math.round(buf.length / 1024)}KB, ${provider})`);
  } catch (e) {
    console.log(`  ${job.file}: ${provider} failed (${e.message}); using an illustration instead`);
    const buf = await illustrate(job, n); fs.writeFileSync(path.join(imgDir, job.file), buf); done.push(job.file);
  }
}
if (logoMissing) {
  const initials = bizName;
  const html = `<body style="margin:0;background:transparent"><div style="display:inline-flex;align-items:center;gap:14px;padding:14px 18px;font-family:system-ui,Arial,sans-serif"><div style="width:52px;height:52px;border-radius:14px;background:${brand.primary};display:grid;place-items:center"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconFor()]}</svg></div><div style="font-weight:800;font-size:28px;color:${brand.ink};letter-spacing:-.01em;line-height:1.05">${initials.replace(/[<>&]/g, '')}</div></div></body>`;
  await page.setViewportSize({ width: 640, height: 110 });
  await page.setContent(html);
  const el = await page.$('div');
  await el.screenshot({ path: path.join(imgDir, logoFile), omitBackground: true, type: /\.jpe?g$/i.test(logoFile) ? 'jpeg' : 'png' });
  console.log('  generated a text logo (replace it with the real logo when you have it)');
  done.push(logoFile);
}
await browser.close();

const R = (v) => (v && renames[v] ? renames[v] : v);
Object.assign(cfg.images = cfg.images || {}, { logo: R(cfg.images.logo), hero: R(cfg.images.hero), about: R(cfg.images.about), expand: R(cfg.images.expand), og: R(cfg.images.og) });
(cfg.gallery || []).forEach((g) => { g.src = R(g.src); });
[].concat(cfg.services || [], cfg.extraServices || [], cfg.regionPages || [], cfg.suburbs || []).forEach((x) => { if (x.image) x.image = R(x.image); });

/* record what was generated so the site can be honest about it */
cfg.images = Object.assign({}, cfg.images, { generatedFiles: Array.from(new Set((I.generatedFiles || []).concat(done))) });
const galleryFiles = (cfg.gallery || []).map((g) => withExt(g.src));
cfg.images.generatedGallery = galleryFiles.length > 0 && galleryFiles.filter((f) => cfg.images.generatedFiles.includes(f)).length >= galleryFiles.length / 2;
fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
console.log(`Done. ${done.length} file(s) generated. ${cfg.images.generatedGallery ? 'The gallery is now labelled as illustrative.' : ''}`);
console.log('Report these as generated in your summary. They are not the client\'s real work or team.');
