# Custom design pass: every client gets their own look

The six themes in `THEMES.md` are a floor, not the finish line. A build that only swaps a stock theme and
fills it with generated illustrations was rejected by the owner as "generic and rubbish ... looks exactly like
all the other layouts". The approved bar is a site whose layout, fonts, shapes and hero come from the client's
own brand, filled with real photos.

Every build therefore does this pass after Phase 3 (brand and photos) and before scaffolding.

## Hard limits (unchanged)

- It is still a normal business website: header, hero, services, why us, reviews, recent jobs, process,
  about, areas, FAQ, quote, footer. Section order can change; the familiar sections stay.
- Never a concept layout. Rejected before: a page styled as a logbook, a price-menu hero, a suburb-finder
  hero, a split sticky-photo layout, a story-led hero, a booking-wizard hero.
- All engine features keep working: lead form (`#quote`, `form.js-lead`), chat (`data-open-chat`), the
  job feed (`#work .work`), lightbox, suburb search (`#area-search`, `.regions`), FAQ (`faqHtml`), the
  original text (`proseSection`), and `data-track` on every call, text and quote button.

## 1. Read the design log, so this client is not a repeat

`~/.redesign-contractor/designs.log` has one line per build:

```
2026-10-06 | example-electrical | inkline | Familjen Grotesk + Instrument Sans | light sky field, arch-masked photo, lights-on hero | ink 2px outlines, pill buttons, offset solid shadows
```

Read the last 5 lines. This build must differ from each of them on at least three of: display font, base
colour (light or dark, warm or cool), hero treatment, shape language (sharp, rounded, arch, organic),
section rhythm. Never reuse a font pairing from the last 5 builds.

## 2. Run the frontend-design skill and write the plan

Invoke `frontend-design:frontend-design` with the client's subject (trade, area, buyer, brand). Write the plan
before any code:

- **Subject:** what the client is and what the visitor needs to do (usually call, text or ask for a quote).
- **Colour:** 4 to 6 named hex values taken from the client's logo, vehicles, uniforms or old site.
- **Type:** two Google Fonts (or one) the client has not had before and that are not in the log.
- **Shape language:** borders, radius, shadows, frames, all derived from something in the brand (the
  logo's line weight, a sign's corners, a uniform stripe).
- **Hero:** an ASCII wireframe plus one sentence. Open with the most characteristic thing about this business.
- **One signature moment:** a single orchestrated animation tied to the trade (lights switching on for an
  electrician, water filling for a pool builder, a sunrise for a landscaper). No fade-in on every section.
  Respect `prefers-reduced-motion`.

Then critique the plan against the generic tells (cream background with terracotta, black with acid green,
identical rounded cards with grey shadows, all-caps eyebrow labels, single-word accents, "→" on buttons,
numbered markers on things that are not a sequence). Change anything that reads as a default and say what
you changed.

## 3. Build it in the project

1. Pick a theme name for this client (lowercase, e.g. `inkline`, `tidewater`, `rivet`). Set `brand.theme` to
   it, `brand.fonts` to the pairing, and `brand.themeReason` to one sentence.
2. Write `<project>/public/assets/themes/<name>.css`. It loads after `site.css` and `enterprise.css` and
   restyles every page: header, buttons, inner hero, prose, sidebar, areas, FAQ, quote, footer, chat button.
3. Write `<project>/lib/home-custom.js` exporting `body()`, which returns the home page sections (see
   `examples/custom-home/home-custom.js`). The engine uses it automatically and still appends the original
   text and the quote section.
4. Optional config keys the example reads: `copy.heroNote.text`, `copy.band.{heading,body}`,
   `copy.services.moreHeading`, `images.collage` (three image paths).

`examples/custom-home/` is an earlier electrician build. Treat it as a reference for how the hooks connect, never as
a template to restyle. If your result looks like it with different colours, start again.

## 4. Photos: lots of them, real ones

The client's own photos come first. When there are fewer than about 25 usable ones (the usual case), fill
the rest with free stock photos (Unsplash licence) using `scripts/stock-photos.mjs`. Generated
illustrations are the last resort only.

**Finding photos.** Unsplash's search API needs a key, but its search pages work in the browser. Open
`https://unsplash.com/s/photos/<topic>?license=free` in Chrome, then run this in the page (one call per batch
of topics, keep output short) and copy the lines into `ids.txt`:

```js
const grab = async (q) => { const h = await (await fetch('/s/photos/' + encodeURIComponent(q) + '?license=free')).text();
  return [...new Set(h.match(/photo-\d{10,13}-[0-9a-f]{12}/g) || [])].slice(0, 12).map((x) => x.slice(6)); };
const out = []; for (const q of ['electrician', 'house-at-night']) out.push(q + '=' + (await grab(q)).join(',')); out.join('\n')
```

Search 20 to 30 topics: the trade's work close up, finished rooms, exteriors at dusk, and the client's own
area (real local landmarks make a site feel local). Then run `stock-photos.mjs sheets`, look at every contact
sheet, and `pick` 40 to 70 photos.

Reject:
- people who could be mistaken for the owner or the team (keep people out of "about" and "why us" sections),
- hardware from the wrong country (US or European power points and switches on an Australian site),
- a landmark shown on the wrong suburb's page (only use a landmark photo on its own suburb or region page),
- anything with text, logos, watermarks or obvious stock poses.

Label stock photos honestly: the gallery lede says they are examples of the work until the owner posts real
jobs through **Post a job** in the admin (those appear first automatically).

## 5. Check it with your own eyes

Screenshot the home page and one service, suburb and guide page at 1440px and 390px, and read every
screenshot. Look for: unreadable buttons, text touching borders, photos that contradict the copy, empty
columns, anything that looks like a previous client's site. `qa.mjs` now fails any button whose text has
less than 3:1 contrast with its background; fix those in the theme CSS.

## 6. Record it

Append one line to `~/.redesign-contractor/designs.log` in the format above, and the usual
`<date> <slug> <theme>` line to `themes-used.log`.
