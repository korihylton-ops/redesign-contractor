'use strict';
/* Example custom home layout (docs/DESIGN.md), first built for a residential electrician whose logo was a
   hand-drawn black bulb on sky blue: ink line-work, arch photo frames, and one signature moment (the hero
   home's lights switch on as the page loads). Copy to <project>/lib/home-custom.js as a STARTING POINT ONLY:
   every client gets its own layout idea, fonts and shapes. Never ship this one unchanged. */
const C = require('./config');
const L = require('./layout');
const { esc } = require('./blocks');
const { business: B, T } = C;
const { img, callBtn, textBtn, faqHtml, areasHtml } = L;

const t = (s) => esc(T(s));
const sec = (k) => Object.assign({}, C.copy[k] || {});

/* The logo's bulb, redrawn as a single stroke so the filament can draw itself. */
const bulbSvg = `<img class="bulb" src="${img(C.images.logo)}" alt="" width="120" height="120">`;

function reviewsBlock() {
  const rs = C.reviews;
  if (!rs.length) return '';
  const [lead, ...rest] = rs;
  const rv = sec('reviews');
  return `<section class="ink-reviews" id="reviews">
  <div class="wrap">
    <div class="ink-head">
      <h2>${t(rv.heading || '{{rating}} from {{reviewCount}} Google reviews')}</h2>
      <p>${t(rv.lede || 'Written by local customers.')}</p>
    </div>
    <div class="ink-reviews__grid">
      <figure class="ink-quote">
        <span class="ink-stars" aria-label="5 out of 5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
        <blockquote><p>${esc(lead.text)}</p></blockquote>
        <figcaption>${esc(lead.name)}, Google review</figcaption>
      </figure>
      <div class="ink-notes">
        ${rest.map((r) => `<figure class="ink-note"><span class="ink-stars" aria-label="5 out of 5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span><blockquote><p>${esc(r.text)}</p></blockquote><figcaption>${esc(r.name)}</figcaption></figure>`).join('')}
      </div>
    </div>
    ${B.social && B.social.google ? `<p class="ink-reviews__more"><a class="btn btn--line" href="${esc(B.social.google)}" rel="noopener" target="_blank" data-track="reviews" data-src="reviews">Read all ${esc(String(B.reviewCount))} reviews on Google</a></p>` : ''}
  </div>
</section>`;
}

function body() {
  const hero = sec('hero'), svc = sec('services'), why = sec('why'), proc = sec('process'), ab = sec('about'), wk = sec('work'), ar = sec('areas'), fq = sec('faq');
  const featured = C.services, extra = C.extraServices;
  const lines = (hero.lines || []).map((l) => `<span>${t(l)}</span>`).join(' ');

  const svcRows = featured.map((s, i) => `<li><a href="/${s.slug}" data-photo="${img(s.image)}" data-alt="${esc(s.h1)}"${i === 0 ? ' aria-current="true"' : ''}>
        <span class="svc-index__name">${esc(s.name)}</span>
        <span class="svc-index__line">${esc(s.intro)}</span>
      </a></li>`).join('');

  const why6 = C.bento.map((x) => `<li><h3>${t(x.t)}</h3><p>${t(x.d)}</p></li>`).join('');
  const steps = C.steps.map((s, i) => `<li><span class="ink-steps__n" aria-hidden="true">${i + 1}</span><h3>${t(s.t)}</h3><p>${t(s.d)}</p></li>`).join('');
  const work = C.gallery.map((g) => `<button type="button" data-full="${img(g.src)}" data-alt="${esc(g.alt)}" aria-label="Enlarge: ${esc(g.alt)}"><img src="${img(g.src)}" alt="${esc(g.alt)}" loading="lazy"></button>`).join('');
  const regions = C.regionPages.map((r) => `<a href="${C.paths.region(r.slug)}">${esc(r.name.replace(/^the /, ''))}</a>`).join('');
  const licence = (B.licences || [])[0];
  const collage = (C.images.collage && C.images.collage.length >= 3) ? C.images.collage : C.gallery.slice(0, 3).map((g) => g.src);

  return `
<section class="ink-hero">
  <div class="wrap ink-hero__grid">
    <div class="ink-hero__copy">
      <h1>${lines}</h1>
      <p class="ink-hero__lede">${t(hero.lede)}</p>
      <div class="ink-hero__cta">
        ${callBtn('hero')}
        ${textBtn('hero', 'Text a photo of the job', 'btn--line')}
      </div>
      <dl class="ink-facts">
        ${licence ? `<div><dt>NSW licence</dt><dd>${esc(licence.number)}</dd></div>` : ''}
        ${B.rating ? `<div><dt>Google rating</dt><dd>${esc(B.rating)} from ${esc(String(B.reviewCount))}</dd></div>` : ''}
        ${B.open247 ? '<div><dt>Emergencies</dt><dd>Open 24 hours</dd></div>' : ''}
      </dl>
    </div>
    <figure class="ink-hero__art">
      ${bulbSvg}
      <div class="ink-arch" data-lights>
        <img src="${img(C.images.hero)}" alt="${esc(C.images.heroAlt)}" width="1100" height="1300" fetchpriority="high">
        <span class="ink-arch__night" aria-hidden="true"></span>
      </div>
      <figcaption class="ink-hero__note"><b>Based in ${esc(B.address.suburb)}.</b> ${t(sec('heroNote').text || 'Covering {{area}}.')}</figcaption>
    </figure>
  </div>
</section>

<section class="ink-svc" id="services">
  <div class="wrap ink-svc__grid">
    <div class="ink-svc__media">
      <div class="ink-arch ink-arch--tall"><img id="svc-photo" src="${img(featured[0].image)}" alt="${esc(featured[0].h1)}" loading="lazy" width="900" height="1200"></div>
    </div>
    <div>
      <div class="ink-head ink-head--left">
        <h2>${t(svc.heading || 'What we do')}</h2>
        <p>${t(svc.lede || 'Residential electrical work, from one power point to a full rewire.')}</p>
      </div>
      <ol class="svc-index">${svcRows}</ol>
      ${extra.length ? `<div class="svc-more"><h3>${t(svc.moreHeading || 'More services')}</h3><ul>${extra.map((s) => `<li><a href="/${s.slug}">${esc(s.name)}</a></li>`).join('')}</ul></div>` : ''}
      <div class="svc-help"><p>${t(svc.help)}</p><div class="ink-row">${callBtn('services')}<button class="btn btn--line" type="button" data-open-chat>Ask the assistant</button></div></div>
    </div>
  </div>
</section>

<section class="ink-band" aria-labelledby="band-h">
  <img src="${img(C.images.expand)}" alt="${esc(C.images.expandAlt)}" loading="lazy">
  <div class="wrap">
    <div class="ink-band__panel">
      <h2 id="band-h">${t(sec('band').heading || 'Where we work')}</h2>
      <p>${t(sec('band').body || C.suburbs.length + ' suburbs across {{area}}, all a short drive from our base in {{city}}.')}</p>
      <div class="ink-band__links">${regions}<a href="#areas">Find your suburb</a></div>
    </div>
  </div>
</section>

<section class="ink-why" id="why">
  <div class="wrap ink-why__grid">
    <div class="ink-collage" aria-hidden="true">
      <img class="ink-collage__a" src="${img(collage[0])}" alt="" loading="lazy">
      <img class="ink-collage__b" src="${img(collage[1])}" alt="" loading="lazy">
      <img class="ink-collage__c" src="${img(collage[2])}" alt="" loading="lazy">
    </div>
    <div>
      <div class="ink-head ink-head--left"><h2>${t(why.heading)}</h2><p>${t(why.lede || '')}</p></div>
      <ul class="ink-checks">${why6}</ul>
    </div>
  </div>
</section>

${reviewsBlock()}

<section class="ink-work" id="work">
  <div class="wrap">
    <div class="ink-head"><h2>${t(wk.heading || 'Recent jobs')}</h2><p class="lede">${t(wk.lede || '')}</p></div>
    <div class="work">${work}</div>
    <dialog class="lightbox" aria-label="Photo"><img alt=""><button type="button" aria-label="Close">&times;</button></dialog>
  </div>
</section>

<section class="ink-process" id="process">
  <div class="wrap">
    <div class="ink-head"><h2>${t(proc.heading)}</h2><p>${t(proc.lede || '')}</p></div>
    <ol class="ink-steps">${steps}</ol>
  </div>
</section>

<section class="ink-about" id="about">
  <div class="wrap ink-about__grid">
    <div class="ink-arch ink-arch--about"><img src="${img(C.images.about)}" alt="${esc(C.images.aboutAlt)}" loading="lazy" width="800" height="1000"></div>
    <div>
      <h2>${t(ab.heading)}</h2>
      ${(ab.paras || []).map((p) => `<p>${t(p)}</p>`).join('')}
      <div class="ink-row">${callBtn('about')}${textBtn('about', 'Text us', 'btn--line')}</div>
    </div>
  </div>
</section>

<section class="ink-areas" id="areas">
  <div class="wrap">
    <div class="ink-head"><h2>${t(ar.heading || 'Where we work')}</h2><p>${t(ar.lede || '')}</p></div>
    <div class="areas__tools"><div class="field"><label for="area-search">Search your suburb</label><input id="area-search" type="search" autocomplete="off" placeholder="Start typing a suburb"></div></div>
    ${areasHtml()}
    <p class="areas__none">No match yet. Call ${esc(B.phone)} and we will tell you if we can reach you.</p>
  </div>
</section>

${C.faqs.length ? `<section class="ink-faq" id="faq">
  <div class="wrap ink-faq__grid">
    <div class="ink-head ink-head--left"><h2>${t(fq.heading || 'Questions we get asked')}</h2><p>Still not sure? Call or text ${esc(B.phone)}.</p></div>
    ${faqHtml(C.faqs)}
  </div>
</section>` : ''}`;
}

module.exports = { body };
