'use strict';
const C = require('./config');
const S = require('./site');
const L = require('./layout');
const { renderBlocks, esc } = require('./blocks');
const { business: B, trade, T } = C;
const { img, callBtn, textBtn, head, header, footer, quoteSection, faqHtml, localBusinessLd, faqLd, areasHtml } = L;

const cp = C.copy;
const sec = (k) => Object.assign({}, cp[k] || {});
const t = (s, extra) => esc(T(s, extra));

/* ---------- Derived content with sensible defaults ---------- */
const credentials = (B.credentials && B.credentials.length) ? B.credentials : [].concat(
  (B.licences || []).map((l) => ({ title: `${l.label} ${l.number}`, sub: l.detail || '' })),
  B.insurance ? [{ title: B.insurance, sub: '' }] : [],
  B.rating && B.reviewCount ? [{ title: `${B.rating} on Google from ${B.reviewCount} reviews`, sub: 'Real local customers' }] : []
).slice(0, 4);

const stars = '<div class="stars" aria-label="5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>';

function allReviews() {
  const home = S.get('/');
  const fromSite = home ? home.blocks.filter((b) => b.type === 'review').map((b) => ({ name: b.name, text: b.text })) : [];
  const seen = new Set();
  return C.reviews.concat(fromSite).filter((r) => { const k = r.name.toLowerCase().replace(/\s+/g, ' '); if (seen.has(k)) return false; seen.add(k); return true; });
}

function testimonialCols() {
  const rs = allReviews();
  if (!rs.length) return '';
  const cols = [[], [], []];
  rs.forEach((r, i) => cols[i % 3].push(r));
  const card = (r, hidden) => `<figure class="tcard"${hidden ? ' aria-hidden="true"' : ''}>${stars}<p>${esc(r.text)}</p><figcaption>${esc(r.name)}<span>Google review</span></figcaption></figure>`;
  return `<div class="tcols">${cols.filter((c) => c.length).map((c, i) => `<div class="tcol tcol--${i + 1}"><div class="tcol__track">${c.map((r) => card(r)).join('')}${c.map((r) => card(r, true)).join('')}</div></div>`).join('')}</div>`;
}

function suburbMarquee() {
  const real = C.suburbs.map((s) => `<a href="${C.paths.suburb(s.slug)}">${esc(s.name)}</a>`).join('');
  const dup = C.suburbs.map((s) => `<a href="${C.paths.suburb(s.slug)}" tabindex="-1">${esc(s.name)}</a>`).join('');
  return `<div class="marquee" aria-label="Suburbs we serve"><div class="marquee__track">${real}<span aria-hidden="true">${dup}</span></div></div>`;
}

const bgPaths = `<svg class="bgpaths" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  ${[0, 1, 2, 3, 4, 5].map((i) => `<path pathLength="1" d="M${-40 + i * 30} ${40 + i * 12}C${180 + i * 20} ${-40 + i * 40} ${260 - i * 10} ${300 + i * 20} ${520 + i * 24} ${240 - i * 14}S${700 + i * 10} ${420 + i * 10} ${860} ${300 + i * 34}" />`).join('')}
</svg>`;

/* ---------- Article / prose (all text carried over from the original site) ---------- */
function relatedFor(item, limit) {
  if (item.kind === 'post') {
    const sub = C.suburbs.find((s) => item.title.toLowerCase().includes(s.name.toLowerCase()));
    const same = sub ? S.posts.filter((p) => p.path !== item.path && p.title.toLowerCase().includes(sub.name.toLowerCase())) : [];
    return same.concat(S.posts.filter((p) => p.path !== item.path && !same.includes(p))).slice(0, limit);
  }
  return S.siblings(item.path, limit);
}

function aside(item, toc, src) {
  const rel = relatedFor(item, 8);
  return `<aside class="aside">
    <div class="aside__cta"><h3>Need ${esc(/^[aeiou]/i.test(trade.noun) ? 'an' : 'a')} ${esc(trade.noun)}?</h3><p>${t(sec('aside').text || 'Call or text and we will get back to you fast.')}</p>
      <div class="aside__btns">${callBtn(src + '-aside')}${textBtn(src + '-aside', 'Text us', 'btn--line')}<a class="btn btn--ink" href="#quote" data-track="quote" data-src="${src}-aside">Get a quote</a></div></div>
    ${toc.length >= 4 ? `<nav class="aside__toc" aria-label="On this page"><h3>On this page</h3><ul>${toc.slice(0, 14).map((x) => `<li><a href="#${x.id}">${esc(x.text)}</a></li>`).join('')}</ul></nav>` : ''}
    ${rel.length ? `<nav class="aside__rel" aria-label="Related pages"><h3>${item.kind === 'post' ? 'More guides' : 'More from this section'}</h3><ul>${rel.map((r) => `<li><a href="${r.path}">${esc(r.title)}</a></li>`).join('')}</ul></nav>` : ''}
  </aside>`;
}

function proseSection(item, { solo, heading }) {
  const { html, toc } = renderBlocks(item.blocks, { h1: solo ? 'demote' : 'drop', src: 'article' });
  return `<section class="section${solo ? ' section--paper' : ''}" id="details"><div class="wrap article">
    <div class="prose">${heading ? `<p class="prose__label">${esc(heading)}</p>` : ''}${html}</div>
    ${aside(item, toc, 'article')}
  </div></section>`;
}

const metaFor = (item, title, desc) => ({ title: item ? (item.seoTitle || title) : title, description: item ? (item.seoDescription || item.excerpt || desc) : desc });
const heroPhotoFor = (item) => { const pool = C.gallery.map((g) => g.src); return pool.length ? pool[(item.id || 0) % pool.length] : C.images.hero; };

function innerHero({ crumbs, h1, intro, image, alt, extra }) {
  return `<section class="inner-hero">
  <div class="wrap inner-hero__grid">
    <div>
      <p class="crumbs">${crumbs}</p>
      <h1>${esc(h1)}</h1>
      ${intro ? `<p class="lede">${esc(intro)}</p>` : ''}
      ${extra || ''}
      <div class="hero__cta" style="margin-bottom:0">${callBtn('hero-inner')}${textBtn('hero-inner', 'Text us', 'btn--line')}<a class="btn btn--line" href="#quote" data-track="quote" data-src="hero-inner">Get a quote</a></div>
    </div>
    <div class="inner-hero__photo"><img src="${image}" alt="${esc(alt || '')}" width="800" height="600" fetchpriority="high"></div>
  </div>
</section>`;
}

function shell(meta, path, jsonld, hero, body, formSuburb) {
  return head({ title: meta.title, description: meta.description, path, jsonld, image: meta.image, type: meta.type }) + `
<body>
${header()}
<main id="main">
${hero}
${body}
${quoteSection({ suburb: formSuburb })}
</main>
${footer()}`;
}

const crumbsTo = (parts) => parts.map((p, i) => (p.href && i < parts.length - 1 ? `<a href="${p.href}">${esc(p.text)}</a>` : esc(p.text))).join(' / ');
const rateLine = () => (B.standardRate ? `Rates: $${B.standardRate} per hour standard${B.afterHoursRate ? `, $${B.afterHoursRate} per hour after hours` : ''}. Fixed-price quotes are given in writing before work starts.` : 'Fixed-price quotes are given in writing before work starts.');

/* ---------- Home ---------- */
function home() {
  const sw = C.services;
  const item = S.get('/');
  const hero = sec('hero'), svc = sec('services'), why = sec('why'), proc = sec('process'), pr = sec('pricing'), ex = sec('expand'), ab = sec('about'), rv = sec('reviews'), wk = sec('work'), ar = sec('areas'), fq = sec('faq'), meta0 = sec('meta');
  const meta = metaFor(item, T(meta0.homeTitle || '{{Noun}} {{area}} | {{name}}'), T(meta0.homeDescription || '{{name}}: {{nounPlural}} serving {{area}}. Call {{phone}}.'));
  const breaker = trade.selector === 'breaker';

  const breakers = sw.map((s, i) => `<button class="breaker${s.emergency ? ' breaker--hazard' : ''}" role="tab" id="tab-${i}" aria-controls="spec-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" type="button">
      <span>${esc(s.name)}<small>${esc(s.price || '')}</small></span><span class="breaker__switch" aria-hidden="true"></span></button>`).join('');
  const specs = sw.map((s, i) => `<article class="spec" role="tabpanel" id="spec-${i}" aria-labelledby="tab-${i}"${i === 0 ? '' : ' hidden'}>
      <img src="${img(s.image)}" alt="" loading="lazy" width="675" height="900">
      <div class="spec__body">
        <h3>${esc(s.h1)}</h3>
        <p>${esc(s.intro)}</p>
        ${s.price ? `<div class="spec__price"><strong>${esc(s.price)}</strong><span>${esc(s.priceNote || '')}</span></div>` : ''}
        <ul class="ticks">${(s.points || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <div class="spec__actions"><a class="btn btn--call" href="#quote" data-service="${esc(s.option || s.name)}" data-track="quote" data-src="services">Quote this job</a><a class="btn btn--line" href="/${s.slug}">Read more</a></div>
      </div></article>`).join('');
  const sheet = C.priceSheet.map((p) => `<li><span><b>${esc(p.item)}</b><em>${esc(p.note || '')}</em></span><strong>${esc(p.price)}</strong></li>`).join('');
  const work = C.gallery.map((g) => `<button type="button" data-full="${img(g.src)}" data-alt="${esc(g.alt)}" aria-label="Enlarge: ${esc(g.alt)}"><img src="${img(g.src)}" alt="${esc(g.alt)}" loading="lazy"></button>`).join('');
  const statsHtml = C.stats.map((s) => `<div class="stat"><b><span data-count="${s.n}" data-decimals="${s.decimals || 0}">${s.n}</span>${esc(s.suffix || '')}</b><span>${esc(s.label)}</span></div>`).join('');
  const bento = C.bento.map((x) => `<div class="tile spot${x.wide ? ' tile--wide' : ''}${x.accent ? ' tile--accent' : ''}${x.hazard ? ' tile--hazard' : ''}"><h3>${t(x.t)}</h3><p>${t(x.d)}</p></div>`).join('');
  const steps = C.steps.map((s, i) => `<li class="step"><span class="step__n" aria-hidden="true">${i + 1}</span><div><h3>${t(s.t)}</h3><p>${t(s.d)}</p></div></li>`).join('');
  const trace = credentials.map((c) => `<li>${esc(c.title)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</li>`).join('');
  const lines = (hero.lines && hero.lines.length ? hero.lines : ['{{Nouns}} in {{area}},', 'ready when you are.']).map((l) => `<span>${t(l)}</span>`).join('');
  const promise = C.promise;
  const aboutParas = (ab.paras && ab.paras.length ? ab.paras : []).map((p) => `<p>${t(p)}</p>`).join('');
  const chips = (B.licences || []).map((l) => `<li>${esc(l.short || l.label)} ${esc(l.number)}<small>${esc(l.detail || '')}</small></li>`).concat(B.insurance ? [`<li>${esc(B.insurance)}<small>Insurance</small></li>`] : []).join('');

  const body = `
<section class="hero hero--ent">
  ${bgPaths}
  <div class="wrap hero__grid">
    <div>
      <h1>${lines}</h1>
      <p class="lede">${t(hero.lede || '{{name}} is a local team based in {{city}}.')}</p>
      <div class="hero__cta">
        ${callBtn('hero')}
        ${textBtn('hero', 'Text us', 'btn--line')}
        <a class="btn btn--line" href="#quote" data-track="quote" data-src="hero">${t(hero.quoteLabel || 'Get a fixed-price quote')}</a>
      </div>
      ${trace ? `<div class="trace-wrap"><span class="trace__line" aria-hidden="true"></span><ul class="trace" aria-label="Licences and credentials">${trace}</ul></div>` : ''}
    </div>
    <div class="hero__photo" data-parallax>
      <img src="${img(C.images.hero)}" alt="${esc(C.images.heroAlt || B.name)}" width="900" height="1200" fetchpriority="high">
      <div class="hero__badge"><i aria-hidden="true"></i><span>${t(hero.badge || (B.open247 ? 'Open 24/7 for emergencies.<br>Call {{phone}}' : 'Call {{phone}}<br>for a free quote')).replace(/&lt;br&gt;/g, '<br>')}</span></div>
      ${B.rating ? `<div class="float float--a" aria-hidden="true"><b>${esc(B.rating)}</b> Google rating</div>` : ''}
      ${hero.floatB ? `<div class="float float--b" aria-hidden="true">${t(hero.floatB)}</div>` : (B.open247 ? '<div class="float float--b" aria-hidden="true"><b>24/7</b> emergency response</div>' : '')}
    </div>
  </div>
</section>

${C.suburbs.length ? `<section class="strip" aria-label="Suburbs we serve">${suburbMarquee()}</section>` : ''}

${C.stats.length ? `<section class="section section--ink stats" aria-label="${esc(B.name)} in numbers"><div class="wrap stats__row">${statsHtml}</div></section>` : ''}

<section class="section section--paper" id="services">
  <div class="wrap">
    <h2 data-split>${t(svc.heading || trade.selectorHeading)}</h2>
    <p class="lede">${t(svc.lede || trade.selectorLede)}</p>
    <div class="board-wrap">
      <div><div class="board${breaker ? '' : ' board--panel'}" role="tablist" aria-label="Services" aria-orientation="vertical">${breakers}</div>
        <div class="board-help"><p>${t(svc.help || 'Not sure which one you need? Describe the problem and we will tell you.')}</p><div class="hero__cta" style="margin:0">${callBtn('services')}<button class="btn btn--line" type="button" data-open-chat>Ask the assistant</button></div></div></div>
      <div>${specs}</div>
    </div>
  </div>
</section>

${C.bento.length ? `<section class="section" id="why">
  <div class="wrap">
    <h2 data-split>${t(why.heading || 'Why choose {{name}}')}</h2>
    ${why.lede ? `<p class="lede">${t(why.lede)}</p>` : ''}
    <div class="bento" data-stagger>${bento}</div>
  </div>
</section>` : ''}

${C.steps.length ? `<section class="section section--paper" id="process">
  <div class="wrap process">
    <div><h2 data-split>${t(proc.heading || 'How every job runs')}</h2><p class="lede">${t(proc.lede || 'Simple, written and fixed.')}</p>
      <div class="hero__cta" style="margin-top:24px">${callBtn('process')}${textBtn('process', 'Text us', 'btn--line')}</div></div>
    <div class="steps"><span class="steps__rail" aria-hidden="true"><i></i></span><ol>${steps}</ol></div>
  </div>
</section>` : ''}

${C.priceSheet.length ? `<section class="section" id="pricing">
  <div class="wrap pricing">
    <div>
      <h2 data-split>${t(pr.heading || 'Prices you can read before you call')}</h2>
      <p class="lede">${t(pr.lede || 'Most jobs are quoted as a fixed price in writing before we start.')}</p>
      <ul class="sheet">${sheet}</ul>
      ${pr.note ? `<p style="margin-top:18px;color:var(--ink-soft);font-size:.95rem">${t(pr.note)}${S.get('/prices') ? ' See the full <a href="/prices">price list</a>.' : ''}</p>` : ''}
    </div>
    ${promise ? `<aside class="promise spot">
      <h3>${t(promise.title)}</h3>
      <p>${t(promise.body || '')}</p>
      <ul class="ticks">${(promise.bullets || []).map((x) => `<li>${t(x)}</li>`).join('')}</ul>
      <a class="btn btn--call" href="#quote" data-track="quote" data-src="pricing">${t(promise.cta || 'Get a quote')}</a>
    </aside>` : ''}
  </div>
</section>` : ''}

${C.images.expand ? `<section class="expand" aria-label="${esc(T(ex.heading || B.name))}">
  <div class="expand__frame" data-expand><img src="${img(C.images.expand)}" alt="${esc(C.images.expandAlt || '')}" loading="lazy">
    <div class="expand__copy"><h2>${t(ex.heading || 'Done properly, guaranteed')}</h2><p>${t(ex.body || '')}</p>${callBtn('expand')}</div></div>
</section>` : ''}

<section class="section section--paper" id="about">
  <div class="wrap about">
    <div class="about__photo"><img src="${img(C.images.about || C.images.hero)}" alt="${esc(C.images.aboutAlt || B.name)}" loading="lazy" width="600" height="600"></div>
    <div>
      <h2 data-split>${t(ab.heading || 'Locally owned and easy to deal with')}</h2>
      ${aboutParas}
      ${chips ? `<ul class="licences">${chips}</ul>` : ''}
    </div>
  </div>
</section>

${allReviews().length ? `<section class="section" id="reviews">
  <div class="wrap">
    <div class="reviews__head">
      <div><h2 data-split>${t(rv.heading || (B.rating && B.reviewCount ? '{{rating}} from {{reviewCount}} Google reviews' : 'What customers say'))}</h2><p class="lede" style="margin:0">${t(rv.lede || 'Written by local customers.')}</p></div>
      ${B.social && B.social.google ? `<a class="btn btn--line" href="${esc(B.social.google)}" rel="noopener" data-track="reviews" data-src="reviews">Read all reviews on Google</a>` : ''}
    </div>
    ${testimonialCols()}
  </div>
</section>` : ''}

${C.gallery.length ? `<section class="section section--paper" id="work">
  <div class="wrap">
    <h2 data-split>${t(wk.heading || 'Recent work')}</h2>
    <p class="lede">${C.images.generatedGallery ? 'Illustrative examples of the kind of work we do.' : t(wk.lede || 'Real jobs from our own crew.')}</p>
    <div class="work">${work}</div>
    <dialog class="lightbox" aria-label="Photo"><img alt=""><button type="button" aria-label="Close">&times;</button></dialog>
  </div>
</section>` : ''}

${C.suburbs.length ? `<section class="section" id="areas">
  <div class="wrap">
    <h2 data-split>${t(ar.heading || 'Where we work')}</h2>
    <p class="lede">${t(ar.lede || 'Find your suburb below.')}${C.regionPages.length ? ' See also ' + C.regionPages.map((r) => `<a href="${C.paths.region(r.slug)}">${esc(r.name)}</a>`).join(' and ') + '.' : ''}</p>
    <div class="areas__tools"><div class="field"><label for="area-search">Search your suburb</label><input id="area-search" type="search" autocomplete="off" placeholder="Start typing a suburb"></div></div>
    ${areasHtml()}
    <p class="areas__none">No match yet. Call ${esc(B.phone)} and we will tell you if we can reach you.</p>
  </div>
</section>` : ''}

${C.faqs.length ? `<section class="section section--paper" id="faq">
  <div class="wrap">
    <h2 data-split>${t(fq.heading || 'Questions we get asked')}</h2>
    ${faqHtml(C.faqs)}
  </div>
</section>` : ''}
${item ? proseSection(item, { solo: false, heading: T(sec('longform').heading || 'The full guide') }) : ''}`;

  return head({ title: meta.title, description: meta.description, path: '/', jsonld: [localBusinessLd()].concat(C.faqs.length ? [faqLd(C.faqs)] : []) }) + `
<body>
${header()}
<main id="main">${body}
${quoteSection()}
</main>
${footer()}`;
}

/* ---------- Service pages ---------- */
function servicePage(slug) {
  const all = C.services.concat(C.extraServices);
  const s = all.find((x) => x.slug === slug);
  if (!s) return null;
  const item = S.get('/' + slug);
  const others = C.services.filter((x) => x.slug !== slug).slice(0, 6);
  const priceBlock = s.price ? `<div class="spec__price"><strong>${esc(s.price)}</strong><span>${esc(s.priceNote || '')}</span></div>` : '';
  const meta = metaFor(item, `${s.h1} | ${B.name}`, `${T(s.metaDescription || s.intro.slice(0, 140).replace(/\s+\S*$/, ''))}. Call ${B.phone}.`);
  const body = `<section class="section"><div class="wrap two-col">
    <div><h2>What is included</h2>${priceBlock}<ul class="ticks">${(s.points || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <p>${esc(rateLine())}</p></div>
    <div><h2>Other services</h2><ul class="link-list">${others.map((o) => `<li><a href="/${o.slug}">${esc(o.name)}</a></li>`).join('')}</ul></div>
  </div></section>
  ${item ? proseSection(item, { solo: true, heading: 'The full details' }) : ''}
  ${C.suburbs.length ? `<section class="section"><div class="wrap"><h2>Suburbs we cover</h2>${areasHtml()}</div></section>` : ''}`;
  return shell(meta, `/${slug}`, [localBusinessLd(), { '@context': 'https://schema.org', '@type': 'Service', name: s.name, provider: { '@id': L.SITE() + '/#business' }, areaServed: T('{{area}}') }],
    innerHero({ crumbs: crumbsTo([{ text: 'Home', href: '/' }, { text: s.name }]), h1: s.h1, intro: s.intro, image: img(s.image || C.images.hero), alt: s.name }), body);
}

/* ---------- Suburb pages ---------- */
function suburbPage(slug) {
  const sub = C.suburbs.find((x) => x.slug === slug);
  if (!sub) return null;
  const path = C.paths.suburb(slug);
  const item = S.get(path);
  const region = C.regions[sub.region] || { suburbs: [] };
  const neighbours = region.suburbs.filter((x) => x !== slug).map((x) => C.suburbs.find((y) => y.slug === x)).filter(Boolean);
  const sc = sec('suburb');
  const extra = { suburb: sub.name };
  const intro = sub.intro || T(region.outside ? (sc.introOutside || 'We service {{suburb}} for larger jobs and scheduled work. Call {{phone}} to check availability and book.') : (sc.intro || 'Licensed local {{nounPlural}} for {{suburb}}. Fast, upfront pricing and work done properly.'), extra);
  const meta = metaFor(item, T(sc.title || '{{Noun}} {{suburb}} | {{name}}', extra), T(sc.description || '{{Noun}} in {{suburb}}. {{name}}. Call {{phone}}.', extra));
  const ticks = credentials.map((c) => `<li>${esc(c.title)}</li>`).join('') + (B.standardRate ? `<li>$${B.standardRate} per hour, no callout fee</li>` : '') + '<li>Fixed-price written quotes for most jobs</li>';
  const body = `<section class="section"><div class="wrap two-col">
    <div><h2>${esc(cap(trade.noun))} services in ${esc(sub.name)}</h2><ul class="link-list">${C.services.map((x) => `<li><a href="/${x.slug}">${esc(x.name)}</a></li>`).join('')}</ul></div>
    <div><h2>Why ${esc(sub.name)} customers call ${esc(B.name)}</h2><ul class="ticks">${ticks}</ul>${B.firstJobDiscount ? `<p>$${B.firstJobDiscount} off your first job.</p>` : ''}</div>
  </div></section>
  ${item ? proseSection(item, { solo: true, heading: `The full details for ${sub.name}` }) : ''}
  ${neighbours.length ? `<section class="section"><div class="wrap"><h2>Nearby suburbs we also cover</h2>
    <ul class="link-list" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));column-gap:24px">${neighbours.map((n) => `<li><a href="${C.paths.suburb(n.slug)}">${esc(cap(trade.noun))} ${esc(n.name)}</a></li>`).join('')}</ul></div></section>` : ''}`;
  return shell(meta, path, [localBusinessLd({ areaServed: { '@type': 'City', name: sub.name } })],
    innerHero({ crumbs: crumbsTo([{ text: 'Home', href: '/' }, { text: 'Areas', href: '/#areas' }, { text: sub.name }]), h1: `${cap(trade.noun)} in ${sub.name}`, intro, image: img(sub.image || C.images.hero), alt: `${B.name} servicing ${sub.name}` }), body, sub.name);
}

function regionPage(slug) {
  const rp = C.regionPages.find((x) => x.slug === slug);
  if (!rp) return null;
  const path = C.paths.region(slug);
  const item = S.get(path);
  const meta = metaFor(item, T('{{Noun}} {{region}} | {{name}}', { region: rp.name }), T('{{name}}: {{nounPlural}} covering {{region}}. Call {{phone}}.', { region: rp.name }));
  const body = `<section class="section"><div class="wrap"><h2>Suburbs we cover</h2>${areasHtml()}</div></section>
  <section class="section section--paper"><div class="wrap two-col">
    <div><h2>Services</h2><ul class="link-list">${C.services.map((x) => `<li><a href="/${x.slug}">${esc(x.name)}</a></li>`).join('')}</ul></div>
    ${C.priceSheet.length ? `<div><h2>Simple pricing</h2><ul class="sheet" style="margin-top:0">${C.priceSheet.slice(0, 4).map((p) => `<li><span><b>${esc(p.item)}</b></span><strong>${esc(p.price)}</strong></li>`).join('')}</ul></div>` : ''}
  </div></section>
  ${item ? proseSection(item, { solo: false, heading: `The full details for ${rp.name}` }) : ''}`;
  return shell(meta, path, [localBusinessLd()],
    innerHero({ crumbs: crumbsTo([{ text: 'Home', href: '/' }, { text: rp.name }]), h1: `${cap(trade.noun)} in ${rp.name}`, intro: T(rp.intro || 'One local team for homes and businesses across {{region}}.', { region: rp.name }), image: img(rp.image || C.images.hero), alt: B.name }), body);
}

const cap = C.cap;

/* ---------- Generic article page (blog posts, Q&A pages, cost pages, contact, about...) ---------- */
function articlePage(item) {
  const h1b = item.blocks.find((b) => b.type === 'h1');
  const h1 = h1b ? h1b.text : item.title;
  const parts = item.path.split('/').filter(Boolean);
  const crumbs = [{ text: 'Home', href: '/' }];
  if (item.kind === 'post') crumbs.push({ text: 'Guides', href: '/blog' });
  else if (parts.length > 1) { const parent = S.get('/' + parts[0]); if (parent) crumbs.push({ text: parent.title, href: parent.path }); }
  crumbs.push({ text: item.title });
  const meta = metaFor(item, `${item.title} | ${B.name}`, item.excerpt || `${item.title}. ${B.name}. Call ${B.phone}.`);
  const ld = [localBusinessLd()];
  if (item.kind === 'post') ld.push({ '@context': 'https://schema.org', '@type': 'Article', headline: item.title, datePublished: item.date, dateModified: item.modified, author: { '@type': 'Organization', name: B.name }, publisher: { '@id': L.SITE() + '/#business' }, mainEntityOfPage: L.SITE() + item.path });
  const hero = innerHero({
    crumbs: crumbsTo(crumbs), h1, image: img(heroPhotoFor(item)), alt: '',
    extra: item.kind === 'post' ? `<p class="lede">Published ${esc(item.date)}. Written by the ${esc(B.name)} team.</p>` : ''
  });
  return shell(meta, item.path, ld, hero, proseSection(item, { solo: false }));
}

function blogIndex() {
  const item = S.get('/blog');
  const meta = metaFor(item, `Guides and Advice | ${B.name}`, `Practical advice from the ${B.name} team.`);
  const list = S.posts.map((p) => `<li><a href="${p.path}"><b>${esc(p.title)}</b><span>${esc(p.date)}</span></a></li>`).join('');
  const h1 = ((item && item.blocks.find((x) => x.type === 'h1')) || {}).text || 'Guides and advice';
  const body = `${item && item.blocks.length ? proseSection(item, { solo: false }) : ''}
  <section class="section"><div class="wrap"><h2>All guides (${S.posts.length})</h2>
    <div class="areas__tools"><div class="field"><label for="post-search">Search guides</label><input id="post-search" type="search" data-filter=".postlist li" placeholder="Search"></div></div>
    <ul class="postlist">${list}</ul></div></section>`;
  return shell(meta, '/blog', [localBusinessLd()],
    innerHero({ crumbs: crumbsTo([{ text: 'Home', href: '/' }, { text: 'Guides' }]), h1, intro: T(sec('blog').intro || 'Straight answers from local {{nounPlural}}.'), image: img(C.gallery.length ? C.gallery[0].src : C.images.hero), alt: '' }), body);
}

function notFound() {
  return head({ title: 'Page not found | ' + B.name, description: 'Page not found', path: '/404' }) + `
<body>${header()}<main id="main" class="section"><div class="wrap"><h1>We can't find that page</h1>
<p class="lede">It may have moved. Try the home page, or call ${esc(B.phone)} and we'll help directly.</p>
<div class="hero__cta"><a class="btn btn--call" href="/">Go to the home page</a>${callBtn('404', 'Call ' + esc(B.phone), 'btn--line')}</div></div></main>${footer()}`;
}

/* ---------- Build every page ---------- */
function buildAll() {
  const map = new Map();
  map.set('/', home());
  C.services.concat(C.extraServices).forEach((s) => { const h = servicePage(s.slug); if (h) map.set('/' + s.slug, h); });
  C.suburbs.forEach((s) => { const h = suburbPage(s.slug); if (h) map.set(C.paths.suburb(s.slug), h); });
  C.regionPages.forEach((r) => { const h = regionPage(r.slug); if (h) map.set(C.paths.region(r.slug), h); });
  if (S.posts.length || S.get('/blog')) map.set('/blog', blogIndex());
  S.all().forEach((it) => { if (!map.has(it.path)) map.set(it.path, articlePage(it)); });
  return map;
}

module.exports = { buildAll, notFound, home };
