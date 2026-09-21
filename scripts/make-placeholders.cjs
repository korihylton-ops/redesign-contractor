// Writes neutral SVG placeholders for the starter example (no dependencies).
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'examples', 'starter', 'images');
fs.mkdirSync(out, { recursive: true });

const svg = (w, h, hue, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 82%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 66%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><g fill="none" stroke="hsl(${hue} 40% 30%)" stroke-opacity=".35" stroke-width="3"><circle cx="${w * 0.72}" cy="${h * 0.38}" r="${Math.min(w, h) * 0.18}"/><path d="M${w * 0.15} ${h * 0.78}h${w * 0.7}"/></g><text x="50%" y="52%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(Math.min(w, h) / 14)}" fill="hsl(${hue} 40% 22%)" fill-opacity=".7">${label}</text></svg>`;

fs.writeFileSync(path.join(out, 'logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="88" viewBox="0 0 250 88"><circle cx="40" cy="44" r="22" fill="#1f7ae0"/><path d="M30 44h20M40 34v20" stroke="#fff" stroke-width="5" stroke-linecap="round"/><text x="74" y="42" font-family="Arial, sans-serif" font-weight="800" font-size="26" fill="#0d1b2a">HARBOUR</text><text x="74" y="66" font-family="Arial, sans-serif" font-size="16" letter-spacing="4" fill="#0d1b2a">PLUMBING CO</text></svg>`);
fs.writeFileSync(path.join(out, 'hero.svg'), svg(900, 1200, 210, 'Hero photo placeholder'));
fs.writeFileSync(path.join(out, 'about.svg'), svg(800, 800, 190, 'Team photo placeholder'));
fs.writeFileSync(path.join(out, 'expand.svg'), svg(1600, 800, 220, 'Wide feature photo placeholder'));
for (let i = 1; i <= 12; i++) fs.writeFileSync(path.join(out, `work-${String(i).padStart(2, '0')}.svg`), svg(900, i % 3 === 0 ? 900 : 1200, (i * 29) % 360, 'Job photo ' + i));
console.log('placeholders written to', out);
