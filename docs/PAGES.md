# Every header link is its own page

User rule, 2026-10-23. Applies to every build.

## Why

The owner should see a site with lots of pages, not everything crammed onto one long home page. Each item in the
header menu (Services, About, Reviews, Recent work, Areas, Guides/Articles, Contact, and anything else up there)
opens **its own designed page**. The front page is still a full, wow-factor front page. It *introduces* each topic
and sends people to the page that covers it properly. Separate pages also help Google: each one gets its own
title, description and URL.

## The rule

1. **No header link may point at the home page.** No `/#services`, `#reviews` or `/#areas` in the header or the
   mobile menu. Every nav `href` is a real path that returns its own page with its own `<h1>`. The one exception
   is the call button, and a "Get a quote" button may jump to the form on the current page. Those are buttons,
   not menu items.
2. **The home page stays rich.** Keep the hero, services, reviews, work, areas and the rest as teaser sections.
   Each one shows a taste (for example 3 reviews, 6 photos, the main services, the region list) and ends with a
   clear link to the full page ("See all 50 reviews", "All services", "Every suburb we cover").
3. **Each page is properly designed, not a text dump.** It uses the client's theme with an inner hero (H1, one-line
   intro, a real photo), breadcrumbs, the full content for that topic, a call to action and the quote form, and
   links to related pages. It must look like part of the same site as the custom home page. A plain stock prose
   page under a fancy home page fails this rule.
4. **The page goes deeper than the home section.** Home shows an excerpt; the page shows everything. Never paste the
   same block twice. Every fact still comes from the client's sources (non-negotiable rule 1).
5. **Keep the old site's URLs.** If the old site already had the page (`/about_us`, `/contact_us`,
   `/recent-installations`), the nav links to that URL and the page carries 100% of its text, now designed. Only
   create a new URL when the old site had no page for that topic.

## The pages to build

Build one page for each item that ends up in the nav. The usual set:

| Nav item | Path (unless the old site had one) | What the page holds | Home teaser links to it |
|---|---|---|---|
| Services | `/services` | Every service and extra service as cards with photo, summary and link to its own service page; what's included; how quoting works | Services grid, "All services" |
| Each service | `/<service-slug>` | Already built by the engine (`servicePage`) | Service cards |
| About | `/about` | The story, owner and team photo, licences and insurance, values, how a job runs, why choose them, a few reviews | About section |
| Reviews | `/reviews` | Rating summary, **every** review in the designed review style, link to Google | Reviews section |
| Recent work | `/recent-work` | Full gallery with lightbox, Post a job photos first, captions | Work gallery |
| Areas | `/areas` | Every suburb grouped by region with search, linking every suburb and region page | Areas section |
| Guides / Articles | `/blog` | Already built by the engine (`blogIndex`) | Guides teaser |
| Pricing (if the client publishes prices) | `/pricing` | The price sheet with notes | Pricing teaser |
| Shop (if enabled) | `/shop` | Already built (`docs/SHOP.md`) | Shop teaser |
| FAQ (if in nav) | `/faq` | All FAQs, grouped | FAQ section |
| Contact | `/contact` | Quote form, phone, email, address, hours, licence numbers, service area, short FAQ | Quote section |
| Signature interactive feature (for example Everteq's "Plan your coverage") | `/<feature-slug>` | The interactive at full size with explanation and a call to action | Smaller version on home |

Put no more than about 7 items in the header. If there are more topics, the rest go in the footer, which lists
**every** page. All of them still get their own page.

## How to build it in the engine

- **Nav:** the engine's default `navItems()` (`template/lib/layout.js`) still points Services, Reviews and Areas
  at home anchors. Always set `nav` in `content/config.json` to real paths, for example
  `[["/services","Services"],["/about","About"],["/reviews","Reviews"],["/recent-work","Recent work"],["/areas","Areas"],["/blog","Guides"],["/contact","Contact"]]`.
  Use the old site's URL instead wherever one exists.
- **Pages:** the engine builds home, services, suburbs, regions, the blog and carried-over pages (`buildAll()` in
  `lib/pages.js`). Add each missing hub page to `buildAll()` in the project's `lib/pages.js`, using the existing
  `shell()` and `innerHero()` helpers. Reuse the functions the home page uses for the content (reviews, gallery,
  suburb lists) so the page and the home teaser can never drift apart. Style them in the client's theme CSS.
- Add every new path to the sitemap and give each page its own SEO title and description.
- Mark the current page in the nav (`aria-current="page"`) so visitors can see where they are.
- If a hub page proves generic enough, move it into `template/` so future builds get it for free, then commit and
  push the skill.

## Check it before saying it's done

- Run this against the running site. It must print `header OK` with no anchor links and every page 200:
  ```js
  // node --input-type=module, with playwright from scripts/node_modules
  const hrefs = await page.$$eval('header nav a', (a) => a.map((x) => x.getAttribute('href')));
  const bad = hrefs.filter((h) => h.startsWith('#') || h.startsWith('/#'));
  for (const h of hrefs) if ((await ctx.request.get(base + h)).status() !== 200) bad.push(h + ' not 200');
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'header OK');
  ```
- Open every header page and screenshot it at 1440px and 390px. Each must have its own H1, look designed, and
  hold more than the home teaser. The mobile menu must show the same links.
- `click-audit.mjs` must still end with 0 FAILED.

## Tell the user

In the Phase 10 delivery, list the header pages with their links and give the total page count (for example
"123 pages: 12 services, 45 suburbs, 60 guides and 6 main pages"). The "lots of pages" point is part of the
pitch, so say it plainly.
