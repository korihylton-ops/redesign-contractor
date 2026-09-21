---
name: redesign-contractor
description: Rebuild a contractor's website (electrician, plumber, HVAC, roofer, builder, landscaper, any local trade) from its existing URL into a premium, motion-rich lead-generation site with a full backend (leads and bookings admin, calendar, traffic and conversion tracking), a DeepSeek chatbot that captures leads and offers call, text and an upgrade, and complete suburb and service coverage that carries over 100% of the original text. Use when the user types /redesign-contractor <url>, or asks to redesign, rebuild or modernise a tradie, contractor or local-service website.
---

# /redesign-contractor <url>

Turn an existing contractor website into the same premium site every time: light, branded, animated, with a working lead backend and AI chat, covering every suburb and service. The engine is fixed (`template/`). What changes per client is one file, `content/config.json`, plus the client's scraped text and photos.

**SKILL_DIR** is the folder containing this file. All script paths below are relative to it.

## Non-negotiable rules

1. **Never invent facts.** Business name, phone, licence numbers, insurance, prices, rates, years in business, review counts, team names, service areas and testimonials come only from the client's own site or sources the user gives you. If something is missing, leave it out (or set `business.noPrices`) and add it to the CONFIRM list in your final report. Never fabricate reviews or credentials.
2. **Keep 100% of the original text.** Every page and post on the old site is rebuilt at the same URL with all its text (`verify-text.mjs` must pass at 99.9% or better).
3. **Meet the content floors** in `scripts/floors.json` (suburbs, services, pages, words, FAQs, reviews, gallery). If the source site is thin, write real, grounded extra pages until `validate-config.mjs` passes. Do not lower the floors to make a build pass.
4. **Secrets never go in git, in the config, in logs or in chat replies.** API keys live only in the project's `.env` (gitignored). If a key is in your context, use it, do not echo it. Tell the user to rotate any key they pasted into a chat.
5. **Do not deploy or publish unless the user asks.** A demo on localhost is the default deliverable.
6. **Never copy another business's copy.** Write original text.

## Inputs

- Required: the client's website URL.
- Optional: business name, owner, target domain or subdomain, brand notes, deploy target.
- Secrets (from the user, into `.env` only): `DEEPSEEK_API_KEY` (chat), optionally `STRIPE_SECRET_KEY`, `RESEND_API_KEY`.

If the user has not provided a DeepSeek key, build with the scripted chat fallback and say so. Ask them to add `DEEPSEEK_API_KEY` to the project's `.env`.

## Set up the tools (once)

```bash
cd "$SKILL_DIR/scripts" && npm install && npx playwright install chromium
```

## Phase 1: Scrape

```bash
node scripts/scrape-site.mjs <url> --out <work>/_scrape
```

WordPress sites are pulled through the REST API (complete). Other sites use the sitemap plus a link crawl (add `--browser` for JavaScript-only sites). If every request is blocked (403), the site has bot protection: say so, and rebuild from Google Business, Facebook and directory listings instead.

## Phase 2: Extract all text

```bash
node scripts/extract-content.mjs --in <work>/_scrape --out <project>/content/site/pages.json
```

Check the printed counts (pages, words, block types). This is the "amount of content" baseline. Read the home, about, contact, prices and any service and suburb pages from `pages.json` to gather facts.

## Phase 3: Brand, logo and photos

```bash
node scripts/brand.mjs <url> --out <work>/_scrape          # brand.json, logo, original-home.png
node scripts/photos.mjs collect --in <work>/_scrape --out <work>/_scrape
```

- Look at `original-home.png` and `brand.json`. Choose `primary` (the client's real action colour), `ink` (a dark that suits it; avoid pure black), `surface` (near-white), and Google Fonts that fit the trade. The engine derives accessible text colours automatically.
- View every `contact-sheet-N.png` with the Read tool. Pick real job photos: a sharp hero over 100KB, an about/team photo, a wide feature photo, at least 12 gallery photos and one photo per featured service. **Reject** photos with baked-in text, marketing graphics, stock imagery, screenshots and blurry shots.
- Write a map of candidate id to name and run `node scripts/photos.mjs pick --from <work>/_scrape/candidates --map map.json --out <project>/public/images`. Copy the logo to `public/images/`.

## Phase 4: Service area

Find every suburb the client serves: suburb pages on the old site, "areas we service" text, and the address. If there are fewer than 30, research nearby suburbs within a realistic travel radius (web search) and only include places the client plausibly serves. Group into at least 3 regions and 2 region pages (for example the metro area and the wider region).

Match the old site's URL patterns so rankings survive: set `trade.slugPrefix` to the prefix the old suburb pages use (for example `electrician-` or `service-areas/`) and use the same slugs.

## Phase 5: Write `content/config.json`

Start from `examples/starter/config.json` and read `docs/CONFIG.md`. Fill every section with the client's real information:

- `trade`: noun, plural, schema.org type, `slugPrefix`, and `selector` (`"breaker"` only for electricians, otherwise `"panel"`).
- `business`: name, phone, email, address, ABN, `licences[]`, insurance, rating, reviewCount, rates, discount, years, customers, hours, social links.
- `brand`, `images`, `copy` (hero lines and lede, section headings, about paragraphs, meta title and description), `stats`, `bento`, `steps`, `promise`, `priceSheet`, `faqs`, `reviews`, `gallery`, `offers`.
- `services` (8 featured, shown in the selector) and `extraServices` (every other service page). Slugs must match the old URLs.
- `regions`, `suburbs`, `regionPages`.

Copy rules: plain sentence case, specific to this business, no clichés. Do not use ALL CAPS eyebrow labels, numbered markers on non-sequences, single-word accents in headlines, or "→" on buttons. Where the old site has good verbatim text (why-us tiles, promises), reuse it exactly. Use `{{tokens}}` (`{{name}} {{phone}} {{city}} {{noun}} {{nounPlural}} {{area}} {{standardRate}} {{discount}} {{rating}} {{suburb}}`) so copy stays consistent.

## Phase 6: Scaffold

```bash
DEEPSEEK_API_KEY=... node scripts/new-project.mjs --out <project> --config <config.json> \
  --images <project>/public/images --pages <project>/content/site/pages.json --install
```

(Run this before Phase 3's `pick` if you prefer; the script copies whatever exists.) It prints the admin password. Give it to the user; it is also saved in the project's gitignored `.admin-password.txt`.

## Phase 7: Enforce the content floors

```bash
node scripts/validate-config.mjs <project>
```

Fix every FAIL. When the source is thin, add pages to `<project>/content/site/generated.json` (same shape as `pages.json`: `{ kind, path, title, seoTitle, seoDescription, excerpt, date, blocks:[{type,html,text}] }`). Write guides, cost explainers, service-area and service pages grounded only in verified facts and the client's own services. Each suburb and service page must reach the minimum words in `floors.json`, and no two pages may share the same body text. Use parallel sub-agents for batches if your environment has them. Re-run until it passes.

## Phase 8: Verify the text and run QA

```bash
node scripts/verify-text.mjs <project>            # must pass at 99.9%
cd <project> && npm start                          # http://localhost:3000
node scripts/qa.mjs <project> --url http://localhost:3000
```

Open the screenshots in `<project>/qa-shots/` and check them yourself: hero, services selector, bento, reviews, a suburb page, an article, the chat, the admin. Fix anything broken before reporting. If something fails, diagnose the cause before changing code.

## Phase 9: Deliver

Tell the user, briefly and honestly:

- Where the site is running, the admin URL and password, and that the DeepSeek key is in `.env` (or that chat is on the scripted fallback).
- What was carried over (pages, words, suburbs, services) and the verification results.
- A **CONFIRM list**: every price, rate, licence, offer or claim that came from an ambiguous source or that you could not verify (for example conflicting prices on the old site, placeholder upgrade offers, an unlicensed trade).
- What is not built: PayPal and Google Calendar sync (shown in Settings as "Not built yet"), and anything skipped.

Only if the user asks to publish or deploy, follow `docs/DEPLOY.md` (Docker and Traefik on their server, DNS for the domain or subdomain first).

## What the engine provides (do not rebuild it)

Design: light branded theme from the client's colours, enterprise motion (Motion library), background paths hero, marquee, count-up stats, bento with spotlight cards, timeline, scroll-expanding media, testimonial columns, services selector, lightbox gallery, suburb search, FAQ.

Backend (Express, one container): lead form, admin dashboard (leads and bookings, calendar with blocked days, chats with transcripts, traffic, conversions by source, settings), Stripe deposit links and Resend emails when keys are set, page tracking, security headers, rate limits, sitemap and robots, SEO schema, 301-safe URLs.

Chat: DeepSeek with a `save_lead` tool that writes leads straight to the admin, call and text buttons, a configurable upgrade offer, conversion tracking on every call, text and quote click, and a scripted fallback.
