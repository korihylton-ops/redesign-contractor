# redesign-contractor

A skill that rebuilds any contractor's website (electrician, plumber, HVAC, roofer, builder, landscaper) from its existing URL. Type `/redesign-contractor https://their-site.com` and it produces a premium site with the client's own brand, text, photos, suburbs and services, in one of six themes (Classic, Floodlit, Harbour, Amber Bold, Slate Pro, Studio) chosen to fit each client. See `docs/THEMES.md`.

**What you get**
- A light, branded, animated marketing site: hero with animated background paths, suburb marquee, count-up stats, services selector, bento "why us", timeline, scroll-expanding media, testimonial columns, gallery, suburb search, FAQ.
- **100% of the original site's text** rebuilt at the same URLs (every page and blog post), plus a page for every suburb and every service.
- A backend in one container: quote form, admin dashboard (leads and bookings, calendar, chats, traffic, conversions, settings), Stripe deposit links, Resend emails.
- A **DeepSeek chatbot** that answers from the business's real facts, captures leads straight into the admin, offers call and text, presents an upgrade offer, and falls back to a scripted flow if the API is down.
- **Conversion tracking**: every call, text and quote click and every chat or form lead is recorded by source.
- **One-command deploy**: a new private GitHub repo per site, uploaded to your server behind Traefik with HTTPS, and the live URL returned. Demo sites are `noindex`.
- **Images**: uses the client's photos; anything missing is generated (AI photos with an image API key, otherwise clean illustrations) and labelled as illustrative.
- **Content floors** enforced by script: 30+ suburbs, 12+ services, 120+ pages, 60,000+ words, 10+ FAQs, 12+ photos, and 99.9% of the source text carried over.

## Install as a skill

Claude Code:
```bash
git clone https://github.com/korihylton-ops/redesign-contractor ~/.claude/skills/redesign-contractor
cd ~/.claude/skills/redesign-contractor/scripts && npm install && npx playwright install chromium
```
Restart Claude Code, then run `/redesign-contractor https://client-site.com`.

Other assistants (Codex, Cursor, Gemini CLI, etc.): clone the repo anywhere, then tell the assistant to "read SKILL.md in this folder and follow it for <url>" (see `AGENTS.md`). The workflow is plain instructions plus Node scripts, so any model that can read files and run commands can use it.

## API keys

Keys are **never stored in this repo**. The skill asks you for them and writes them to the generated project's `.env`, which is gitignored.

| key | used for | required |
|---|---|---|
| `DEEPSEEK_API_KEY` | chatbot replies and lead capture | recommended (scripted fallback works without it) |
| `STRIPE_SECRET_KEY` | deposit payment links | optional |
| `RESEND_API_KEY` | lead alerts and deposit emails | optional |
| `OPENAI_API_KEY` | AI-generated photos when a site has none | optional (illustrations are used without it) |
| `CLOUDFLARE_API_TOKEN` | creates the `<slug>.<your domain>` subdomain on every deploy | needed for the subdomain step (store it via `setup-server.mjs --cloudflare-token`) |

Server details (host, SSH key path, base domain) live in `~/.redesign-contractor/server.json` on your machine, created by `scripts/setup-server.mjs`. They are never part of this repo.

Set them in your shell before running the skill (`export DEEPSEEK_API_KEY=...`) or paste them into the project's `.env` afterwards. If you ever paste a key into a chat or commit it, rotate it.

## Layout

```
SKILL.md              the workflow the assistant follows
template/             the fixed engine: Express server, pages, admin, chat, assets
scripts/              scrape, extract, brand, photos, scaffold, validate, verify, qa
examples/starter/     a complete fictional example config (a Sydney plumber) + placeholder images
docs/                 CONFIG.md (every field), DEPLOY.md (Docker + Traefik)
```

## Try it without a client

```bash
cd scripts && npm install && npx playwright install chromium && cd ..
node scripts/new-project.mjs --out ../demo --config examples/starter/config.json --images examples/starter/images --install
cd ../demo && npm start        # http://localhost:3000 , admin at /admin.html (password printed above)
node ../redesign-contractor/scripts/qa.mjs ../demo
node ../redesign-contractor/scripts/click-audit.mjs --url http://localhost:3000
```
The starter deliberately fails the volume floors (`validate-config.mjs`): it has no scraped long-form text, which is exactly what the skill adds for a real client.

## Requirements
Node 20+, Git, and (for scraping and QA) Playwright's Chromium. Docker and a server are only needed to deploy.

## Licence
MIT. The example business is fictional.
