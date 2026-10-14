# Custom design pass: every client gets their own look

The six themes in `THEMES.md` are a floor, not the finish line. A build that only swaps a stock theme and
fills it with generated illustrations was rejected by the owner as "generic and rubbish ... looks exactly like
all the other layouts". The approved bar is a site whose layout, fonts, shapes and hero come from the client's
own brand, filled with real photos.

Every build therefore does this pass after Phase 3 (brand and photos) and before scaffolding.

## The quality bar: why LAQ Electrical worked (2026-10-07)

The owner called the LAQ Electrical build "a lot better than what you've been doing recently". Copy the
**reasons** it worked, never its look. Every client is different: reassess their brand, trade, buyers and
old site from scratch, and decide what fits them. If a new site looks like LAQ in another colour, it failed.

What made it good, as principles to re-apply in a new way each time:

- **The design grew out of the client's own logo.** LAQ's ring and lightning bolt became the photo frame,
  the hero animation and the avatar rings; the diagonal of the "A" became the chamfered corners. Find the
  equivalent in each new client's brand.
- **A metaphor from the trade, not from web design.** Services drawn as an electrician's single-line
  diagram. Each trade has its own (a plumber's pipe run, a roofer's pitch, a landscaper's site plan); pick one
  only if it makes the content easier to scan, never as decoration.
- **Real people and real words.** Luke and Kelly's own photos, names, roles and bios; the client's own
  sentences and licence numbers up front. No invented claims, ratings or stats.
- **Every action within reach.** Call, text a photo of the job, and ask for a quote in the hero, again after
  the reviews and in every section that ends a thought.
- **One signature moment, then calm.** The ring charging and the bolt flashing once; everything else quiet.

## The wow bar: Bladz Electrical v2 (approved 2026-10-14)

The first Bladz build was rejected as "only slightly better than the old website ... generic and similar to
old design". The redo was approved as "much better". The difference, as principles (never copy its look):

- **The first screen carries the pitch.** Spend most of the design effort there. Dark or light, it must look
  nothing like the old site's hero: a different photo or a very different crop, a different composition.
- **Layered, not split.** Photo bleeding off one edge with a mask fade, a giant brand glyph behind a huge
  headline, floating cards over it. Never a plain headline-left / photo-right split.
- **A signature animation people notice**, tied to the trade and the logo, played once on load.
- **Live, useful detail in the hero:** real review quotes, licence, a live countdown or number, an
  interactive helper (what do you need tabs, does-you-come-to-my-suburb checker).
- **Interactive trade moments below the fold** (a checklist that fills a progress ring, a thermal lens),
  so the page keeps rewarding scrolling.

- **Real, not flat.** The owner rejected a pale, line-drawn "chart" look as a "generic 2D cartoon website" and
  asked for something that looks real. Lead with full-bleed real photography, then add depth: layered shadows,
  glass panels, light and glow on real objects, slow drift on the hero photo. Build interactive moments on real
  photos (for example, light up the lamps on a photo of the client's own product), not on line-art diagrams.
  Use the colours of the trade's world (marine work wants blue), with the brand colour as the accent.
  But a clear interactive diagram can still be the hero's wow moment (the owner preferred it over a photo
  hero). Never put the old site's own hero photo behind the new hero (it reads as "the same site"), and
  never stretch a photo full-bleed unless it is sharp at 1440px or wider (it looks fuzzy).

## Beat the old site, section by section

The finished site has to be better than the old one **in every section**, not just overall. LAQ was "90%
better", but its testimonials were plain text boxes, worse than the old site's photo-backed quote cards,
and the page ended in a wall of carried-over text. Both were rejected. So:

1. **Screenshot the old site's version of each section** (hero, services, about/team, testimonials or
   reviews, contact) and put it beside ours. If theirs has photos, quote marks, cards, stars, a background
   image or anything else ours lacks, ours is not done.
2. **Testimonials are never just words.** Give them structure and imagery that suits the brand, for example:
   a photo or textured backdrop, a large quote mark, the opening line pulled out big, the client's initials
   or photo, their role or suburb, and the jobs they mention linked to those service pages. Show stars only
   when the reviewer actually gave a rating (do not add 5 stars to a review that has none, and do not call it a
   Google review unless it is). With few reviews, make each one bigger; with many, use a scrolling row or
   grid that still looks designed.
3. **No wall of text anywhere, especially at the bottom.** Put the old site's text into the designed sections:
   its section titles become labels, team bios go on the team cards, licence lines go near the about or
   contact block. The engine only appends `proseSection` for home-page text that appears nowhere else on the
   page, so whatever is still left at the bottom is a to-do list: place it properly. After the build, the home
   page should have no `#details` block, or at most a short one. `verify-text.mjs` must still pass at 100%.
4. Look at the bottom third of the page as closely as the hero. That is where the last few builds got lazy.

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

Then read `~/.redesign-contractor/design-decisions.md`: the register of every concept weighed, chosen and
rejected, the owner's verdict on each, the hero directions already used and a list of unused ones. The
owner's rule: "change the design every time ... so nothing is ever the same".

## 1b. Decide between three concepts and record the decision

Sketch three different hero concepts for this client, each grown from their brand, trade and photos, and each
different from every used direction in the register on at least three axes. Score each 1 to 5 on wow on the
first screen, fit to the client, distance from the old site, distance from past builds, and use of real
photos. Take the highest total. Write the entry in `design-decisions.md` (concepts, scores, choice, why,
verdict "pending") before building, and move the chosen direction into its "Directions already used" table.

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
screenshot. Then do the side-by-side from "Beat the old site, section by section" above: every section,
testimonials and the bottom of the page included, must clearly beat the old site's version. Look for: unreadable buttons, text touching borders, photos that contradict the copy, empty
columns, anything that looks like a previous client's site. `qa.mjs` now fails any button whose text has
less than 3:1 contrast with its background; fix those in the theme CSS.

## 6. Record it

Append one line to `~/.redesign-contractor/designs.log` in the format above, and the usual
`<date> <slug> <theme>` line to `themes-used.log`. When the owner reacts, update the build's verdict in
`design-decisions.md` with their words (approved or rejected, and why), so the next build learns from it.
