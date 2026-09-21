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
5. **Deployment is part of the job.** Every finished site goes to a NEW PRIVATE GitHub repo, is uploaded to the user's Contabo server, and you return the live URL. Never make a client repo public. Demo sites are `noindex` so they do not compete with the client's real site.
6. **Never copy another business's copy.** Write original text.
7. **Real photos first; generated images are illustrative.** Use the client's own photos. Only when a needed image cannot be found, generate it (Phase 3). Generated images must never be presented as real jobs, a real team or real people: prompts exclude people, text and logos, the site labels a generated gallery as illustrative, and you list every generated file in your report.

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
- **If usable photos are missing** (site has too few, they are unusable, or the site was blocked), fill the gaps after Phase 6 with `node scripts/generate-images.mjs <project>`. It generates only the images the config references that do not exist yet. With `OPENAI_API_KEY` set it makes AI photographs (no people, text or logos); with no key it renders clean brand-coloured illustrations and a text logo. It records what it generated in `config.images.generatedFiles`, and the site then labels the gallery as illustrative. Replace generated images with real photos whenever they become available.

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

## Phase 9: Deploy (private repo, then the Contabo server)

One-time per machine, if `~/.redesign-contractor/server.json` does not exist: ask the user for the server IP, SSH user, SSH key path and the base domain their sites live under, then run

```bash
node scripts/setup-server.mjs --host <ip> --user root --key ~/.ssh/id_ed25519 --base-domain <domain> --github-owner <gh user>
```

It verifies SSH, Docker and Traefik. (Optional: `--cloudflare-token` lets deploys create the DNS record automatically.) `gh` must be logged in (`gh auth status`); if not, ask the user to run `! gh auth login`.

Then, for every site:

```bash
node scripts/deploy.mjs <project> --dry-run      # optional preview: checks the upload manifest and secret scan
node scripts/deploy.mjs <project>
```

It scans tracked files for secrets and refuses to push if any are found, creates a new **private** repo `<owner>/<slug>-site`, uploads the project (with its `.env`, over SSH, never via git) to `/opt/sites/<slug>`, builds the container behind Traefik, generates a fresh strong admin password, and verifies over HTTPS. Read its output: it lists which URLs are LIVE. There are two hostnames:

- `https://<slug>.<ip-dashes>.sslip.io` works immediately with no DNS.
- `https://<slug>.<base domain>` works once its DNS record exists (automatic with a Cloudflare token, otherwise the user adds an A record to the server IP; the script prints exactly which).

If nothing answers, diagnose (`docker logs <slug>` on the server, DNS) before reporting. Use `--index` only when the client's real domain points at the site.

## Phase 10: Deliver

Tell the user, briefly and honestly:

- **The live URL(s)**, the admin URL and password, and the private repo URL. Say that the DeepSeek key is on the server in `.env` (or that chat is on the scripted fallback).
- Which images were generated rather than taken from the client's site.
- What was carried over (pages, words, suburbs, services) and the verification results.
- A **CONFIRM list**: every price, rate, licence, offer or claim that came from an ambiguous source or that you could not verify (for example conflicting prices on the old site, placeholder upgrade offers, an unlicensed trade).
- What is not built: PayPal and Google Calendar sync (shown in Settings as "Not built yet"), and anything skipped.

When the client is ready to go live on their own domain, follow `docs/DEPLOY.md` (point the domain at the server, then redeploy with `--index`).

## What the engine provides (do not rebuild it)

Design: light branded theme from the client's colours, enterprise motion (Motion library), background paths hero, marquee, count-up stats, bento with spotlight cards, timeline, scroll-expanding media, testimonial columns, services selector, lightbox gallery, suburb search, FAQ.

Backend (Express, one container): lead form, admin dashboard (leads and bookings, calendar with blocked days, chats with transcripts, traffic, conversions by source, settings), Stripe deposit links and Resend emails when keys are set, page tracking, security headers, rate limits, sitemap and robots, SEO schema, 301-safe URLs.

Chat: DeepSeek with a `save_lead` tool that writes leads straight to the admin, call and text buttons, a configurable upgrade offer, conversion tracking on every call, text and quote click, and a scripted fallback.
