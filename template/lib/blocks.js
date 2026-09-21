'use strict';
// Turns the scraped text blocks into HTML. Inline HTML in blocks was sanitised at scrape time
// (only a, strong, em survive), so it is safe to emit as is.
const C = require('./config');
const PHONE_DIGITS = String(C.business.phone || '').replace(/\D/g, '');
const PHONE_RE = PHONE_DIGITS.length >= 8 ? new RegExp('(' + PHONE_DIGITS.split('').join('[\\s\\u00a0-]?') + ')', 'g') : /$^/g;
const CALLOUT_RE = /^(Book [^:]{3,60}:|Need an? [a-z ]{3,30}\?|Call\s)/i;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const slugify = (s) => unesc(s.replace(/<[^>]+>/g, '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';

/* Make phone numbers tappable (and trackable) without touching text already inside links. */
function linkPhone(html, src) {
  return html.split(/(<a\b[\s\S]*?<\/a>)/i).map((seg, i) => (i % 2 ? seg : seg.replace(PHONE_RE, `<a href="${C.business.phoneHref}" data-track="call" data-src="${src}">$1</a>`))).join('');
}

/**
 * @param blocks scraped blocks
 * @param opts { h1: 'drop' | 'demote', src: tracking source label }
 * @returns { html, toc:[{id,text}] }
 */
function renderBlocks(blocks, opts) {
  opts = opts || {};
  const src = opts.src || 'article';
  const out = [];
  const toc = [];
  const used = new Set();
  let list = false;
  let firstH1 = true;
  const closeList = () => { if (list) { out.push('</ul>'); list = false; } };

  for (const b of blocks) {
    if (b.type === 'li') {
      if (!list) { out.push('<ul>'); list = true; }
      out.push(`<li>${linkPhone(b.html, src)}</li>`);
      continue;
    }
    closeList();
    if (b.type === 'table') {
      const rows = b.rows;
      const head = b.header ? rows[0] : null;
      const body = b.header ? rows.slice(1) : rows;
      out.push('<div class="tablewrap"><table>' +
        (head ? `<thead><tr>${head.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>` : '') +
        `<tbody>${body.map((r) => `<tr>${r.map((c, i) => (!head && i === 0 && r.length > 1 ? `<th scope="row">${c}</th>` : `<td>${linkPhone(c, src)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (b.type === 'review') {
      out.push(`<figure class="quote"><div class="stars" aria-label="5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div><p>${b.html}</p><footer>${esc(b.name)}, Google review</footer></figure>`);
      continue;
    }
    if (/^h[1-6]$/.test(b.type)) {
      let level = Number(b.type[1]);
      if (level === 1) {
        if (opts.h1 === 'drop' && firstH1) { firstH1 = false; continue; }
        firstH1 = false;
        level = 2;
      }
      let id = 'sec-' + slugify(b.html);
      while (used.has(id)) id += '-2';
      used.add(id);
      if (level === 2) toc.push({ id, text: unesc(b.html.replace(/<[^>]+>/g, '')) });
      out.push(`<h${level} id="${id}">${b.html}</h${level}>`);
      continue;
    }
    if (b.type === 'quote') { out.push(`<blockquote>${b.html}</blockquote>`); continue; }
    if (CALLOUT_RE.test(b.text)) { out.push(`<p class="callout">${linkPhone(b.html, src)}</p>`); continue; }
    out.push(`<p>${linkPhone(b.html, src)}</p>`);
  }
  closeList();
  return { html: out.join('\n'), toc };
}

module.exports = { renderBlocks, esc, unesc, slugify };
