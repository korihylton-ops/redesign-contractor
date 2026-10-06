# Shop: products alongside services

Many tradies also sell things: second-hand or surplus fittings, ex-display appliances, offcuts, parts. Their
problem is never "how do I get a shop" but "I can't keep it up to date". So the shop is built around the
owner's phone, not a catalogue:

- **List in about 30 seconds** (admin, **Shop** tab): photos straight from the camera roll (resized on the
  phone), a title, a price (or blank for "Ask for price"), condition, category. Category and condition are
  remembered from the last listing. **List another like this** copies an item, photos included.
- **One tap when it sells.** **Sold** shows a "Sold" badge for `soldVisibleDays` (default 14: proof that
  stock moves), then the item drops off the site by itself. **Reserved** and **Back in stock** work the same way.
- **Reserve, don't check out.** Second-hand items are usually inspected and collected, so each product page
  has a **Reserve this item** form (it lands in the leads dashboard as service "Shop item", with the item and
  price in the message), plus call and "Text about this item" buttons with the item pre-filled.
- **Install it for me.** Every item can carry a tick box asking the business to install it. This is the
  point of combining the two: a $45 pendant becomes a pendant plus an installation job.
- **SEO:** `/shop` and one page per item (`/shop/<slug>`), Product schema with price, condition and
  availability, and live items in the sitemap. Pages render on request, so a new listing is live instantly.
- **Home page:** an "In stock now" strip with the latest four items; hidden when nothing is listed.

Photos persist in `data/shop/` on the server volume (not in git, not in the image), like job photos.

## Turn it on

In `content/config.json`:

```json
"shop": {
  "enabled": true,
  "heading": "In stock now",
  "lede": "Quality second-hand and surplus items, checked before they are listed. Reserve one online and pick it up, or have it installed.",
  "homeLede": "Shorter line for the home page strip",
  "categories": ["Lighting", "Ceiling fans", "Appliances"],
  "conditions": ["As new", "Excellent", "Good", "Fair", "For parts"],
  "installOffer": true,
  "soldVisibleDays": 14,
  "testedLabel": "Tested by a licensed electrician"
}
```

The engine adds **Shop** to the header (or add `["/shop", "Shop"]` to a custom `nav`), the admin tab, the home
strip (stock homes automatically; a custom `lib/home-custom.js` calls `require('./shop').homeSection('<class>')`
where it wants the strip) and the routes. With `enabled: false` (the default) none of it exists.

## Selling it to the owner (demo listings)

Only the owner knows their real stock, so a demo needs examples. `scripts/seed-shop-demo.mjs` adds listings
from an `items.json`. Every one is flagged as an example: an "Example listing" badge on the card and page, a
note at the top of the shop, and **Remove example listings** in the admin clears them in one tap.

Rules:
- Never seed examples as if they were the client's stock, and never claim things about real items you have
  not seen (price, condition, testing).
- Pick photos that look like what the trade would plausibly sell, from the same stock-photo picks.
- Put on the CONFIRM list: what they actually sell, pickup location, whether items are tested or tagged, and
  any legal requirements for selling second-hand goods in their state (for electrical items, check the state
  rules on selling second-hand electrical equipment before the owner lists real stock).

## Not built

Online payment for shop items (Stripe is already in the engine for deposits; a "Pay now" option per item can
be added if the owner wants it), stock sync with eBay or Marketplace, and shipping.
