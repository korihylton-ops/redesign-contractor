# Themes: picking the look for each client

Every site uses the same engine, sections, SEO pages, chat and admin. A theme changes only the look: colours (light or dark), fonts, the hero treatment and the styling of cards and buttons. Set it with `brand.theme` in `content/config.json`. If `brand.fonts` is left out, the theme's own font pairing is used.

Themes are deliberately normal business websites. Do not invent concept layouts (themed pages, gimmick heroes); the owner has rejected those. Variety comes from the six themes below.

| `brand.theme` | Look | Fonts (default) | Needs |
|---|---|---|---|
| `classic` | Light and rounded. Brand primary on buttons, headline beside a tall photo with an animated background. | Archivo + Hanken Grotesk | One good portrait or square photo |
| `floodlit` | Dark navy. Full-screen real photo behind a tall condensed headline, the brand accent on every call button. | Big Shoulders Display + Public Sans | A sharp, wide real job photo; a bright accent colour |
| `harbour` | Crisp white. Headline beside a large rounded photo with a floating rating badge, accent-coloured main button. | Manrope | One good photo |
| `amber` (Amber Bold) | The brand's bright accent fills the whole hero as a colour band. Pill buttons, big rounded photos, accent-tinted sections. | Outfit | A light, bright accent (yellow, orange, lime). Falls back to Harbour automatically if the accent is too dark for text |
| `slate` (Slate Pro) | Fully dark slate. Headline centred over a darkened wide photo, steel-blue buttons, square corners. | Barlow | A wide photo (it is darkened, so average quality is fine) |
| `studio` | Soft grey and white. Wide photo band with a white panel over it, refined serif headline. | DM Serif Display + Figtree | A strong wide photo |

The wide hero photo for `floodlit`, `slate` and `studio` comes from `images.heroWide`, else `images.expand`, else `images.hero`. When you pick one of those themes, also pick a landscape job photo at least 1600px wide as `heroWide` (the `pick` map accepts `"<id>": "hero-wide"`).

## How to choose (aim for the best outcome, not a coin flip)

The goal is the site most likely to win the client and convert their visitors. Decide from evidence you already gathered in Phases 1 to 3: `original-home.png`, `brand.json`, the contact sheets and the trade.

Score each theme from 0 to 3 on these four questions, then add them up:

1. **Brand fit.** Would the client recognise their colours in it?
   - A bright accent (yellow, orange, amber, red) with a dark brand colour favours `floodlit` and `amber`.
   - A navy, blue or green primary with a warm accent favours `harbour` and `classic`.
   - A dark, black or charcoal brand favours `slate` and `floodlit`.
   - Muted, earthy or luxury palettes (cream, forest, bronze, black and gold) favour `studio`.
2. **Photo strength.** Does the theme show off what the client actually has?
   - Several sharp, wide, real job photos: `floodlit` and `studio` score highest.
   - A single decent photo: `harbour`, `amber` and `classic`.
   - Weak or generated photos: never `floodlit` or `studio`. Use `classic`, `harbour` or `amber`.
3. **Trade and buyer.** What will this client's customer respond to?
   - Automotive, electrical, concrete, earthmoving, roofing, industrial and commercial trades: `floodlit` or `slate`.
   - Everyday home services (plumbing, cleaning, pest, pool, handyman, removals): `harbour`, `amber` or `classic`.
   - High-ticket or premium work (builders, renovations, landscape design, kitchens, bathrooms, European car specialists, jewellery): `studio` or `harbour`.
   - Emergency and 24/7 trades: `classic` or `harbour` (bright, fast, calls first).
4. **Upgrade from the old site.** A big visible jump sells the redesign.
   - Prefer a theme that looks clearly different from, and better than, `original-home.png`, while keeping the brand colours.
   - If the old site is already dark, a strong light theme can be the bigger upgrade, and the other way round.

Pick the highest total. On a tie, pick the theme used least recently. `~/.redesign-contractor/themes-used.log` lists past builds (one line per site: date, slug, theme). Append this build to it, so consecutive clients do not all look the same.

## Record the choice

In `content/config.json` set `brand.theme`, and add `brand.themeReason` with one sentence on why (it is ignored by the engine and shown to nobody). Report the theme and the reason to the user in Phase 10, and mention that any other theme is a one-line change (`brand.theme`) plus a redeploy.

## Checking a theme

After scaffolding, run the site and look at the home page, a service page, a suburb page and a guide in that theme (desktop and mobile). Dark themes (`floodlit`, `slate`) re-light every text colour that uses the ink colour; if a client-specific section ever shows dark-on-dark text, fix it in `public/assets/themes/<theme>.css` for every client, not in the project.
