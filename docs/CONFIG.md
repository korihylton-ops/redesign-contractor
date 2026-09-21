# content/config.json reference

The whole site is driven by this file. `examples/starter/config.json` is a complete, valid example. Copy is written with `{{tokens}}`; tokens are filled from `business` and `trade`.

Tokens: `{{name}} {{legalName}} {{phone}} {{email}} {{city}} {{state}} {{noun}} {{nounPlural}} {{Noun}} {{Nouns}} {{standardRate}} {{afterHoursRate}} {{discount}} {{rating}} {{reviewCount}} {{area}} {{years}} {{customers}}` everywhere, plus `{{suburb}}` in `copy.suburb` and `{{region}}` on region pages.

## site
| field | meaning |
|---|---|
| `siteUrl` | Public URL (used for canonical links, sitemap, schema). Overridden by env `SITE_URL`. |
| `locale` | e.g. `en-AU`. |
| `areaLabel` | How the service area reads in copy, e.g. `North Brisbane and Moreton Bay`. |
| `sourceUrl` | The client's original site. |

## trade
| field | meaning |
|---|---|
| `noun`, `nounPlural` | `electrician` / `electricians`. Used in headings and URLs. |
| `schemaType` | schema.org type: `Electrician`, `Plumber`, `HVACBusiness`, `RoofingContractor`, `HomeAndConstructionBusiness`, `GeneralContractor`, `HousePainter`, `Locksmith`... |
| `slugPrefix` | URL prefix for suburb and region pages, e.g. `electrician-` gives `/electrician-redcliffe`. Match the old site. May contain a slash: `service-areas/`. |
| `selector` | `breaker` (switchboard look, electricians only) or `panel` (plain). |
| `selectorHeading`, `selectorLede` | Heading and intro above the services selector. |

## business
`name, legalName, phone, phoneE164?, email, abn, abnLabel?, address{street,suburb,state,postcode,country}, licences[{label,number,short?,detail?}], insurance, rating, reviewCount, standardRate, afterHoursRate, firstJobDiscount, yearsExperience, customersServed, people{owner,lead}, hoursText, open247, social{facebook,instagram,x,pinterest,youtube,tiktok,linkedin,google}`, optional `credentials[{title,sub}]` (the four lines under the hero; derived from licences, insurance and rating if omitted), `noPrices: true` if the client never publishes prices.

## brand
`primary` (action colour), `ink` (dark), `surface` (page background), `hazard` (emergency accent), `fonts{displayFamily, displayCss, bodyFamily, bodyCss}` (Google Fonts family names and CSS2 specs). Everything else (accessible link colour, tints, text colour on buttons, borders) is derived and contrast-checked automatically. Override with `accentText`, `primaryTint`, `onPrimary`, `inkSoft`, `border` if needed.

## images (files in `public/images/`)
`logo, hero, heroAlt, about, aboutAlt, expand, expandAlt, og`. Names with an extension are used as is; bare names get `.jpg`.

## copy
Section objects; every field optional with a sensible default: `meta{homeTitle,homeDescription}`, `hero{lines[],lede,badge,floatB,quoteLabel}`, `services{heading,lede,help}`, `why`, `process`, `pricing{heading,lede,note}`, `expand{heading,body}`, `about{heading,paras[]}`, `reviews{heading,lede}`, `work`, `areas`, `faq`, `quote{heading,lede}`, `suburb{title,description,intro,introOutside}`, `longform{heading}`, `blog{intro}`, `aside{text}`.

## Lists
- `stats[{n,suffix?,decimals?,label}]` count-up numbers (at least 4).
- `bento[{t,d,wide?,accent?,hazard?}]` why-us tiles (at least 6). Use verbatim text from the client site where it exists.
- `steps[{t,d}]` a real sequence (4).
- `promise{title,body,bullets[],cta}` the guarantee box beside pricing.
- `priceSheet[{item,price,note}]` (at least 6, from the client's real published prices).
- `faqs[{q,a}]` (at least 10), `reviews[{name,text}]` (real only), `gallery[{src,alt}]` (at least 12).
- `services[]` featured in the selector, `extraServices[]` other service pages: `{slug, name, option, h1, intro, price?, priceNote?, points[], image, emergency?, metaDescription?, keywords?}`. `slug` is the URL path (no slash), matching the old site. `option` is the value in the quote form and admin.
- `regions{key:{label, outside?}}`, `suburbs[{slug,name,region,intro?,image?}]`, `regionPages[{slug,name,intro?,image?}]`. `outside: true` marks regions served only for larger jobs.
- `offers[{id,title,body,active}]` upgrade offers the chat presents after capturing a lead (editable later in the admin). No prices: the team confirms them.
- `chat{facts[], chips[], serviceKeywords[{pattern,service}], emergencyAdvice, emergencyPattern, dangerPattern}` optional tuning.
- `nav[[href,label]]` overrides the header links.

## Extra pages (content floors)
`content/site/pages.json` is text scraped from the old site. `content/site/generated.json` holds additional pages you write, same shape:

```json
[{ "kind": "post", "path": "/blog/how-much-does-x-cost", "title": "...", "seoTitle": "...", "seoDescription": "...", "excerpt": "...", "date": "2026-01-01",
   "blocks": [{ "type": "h2", "html": "Heading", "text": "Heading" }, { "type": "p", "html": "Paragraph with <a href=\"/some-page\">links</a>.", "text": "Paragraph with links." }] }]
```

Block types: `h2 h3 h4 p li quote table review`. `html` may contain only `a`, `strong`, `em`.
