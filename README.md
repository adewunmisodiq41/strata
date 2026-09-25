# STRATA — Storefront

A premium fashion storefront for STRATA, an original streetwear label. It's a static site with no build step and no dependencies, and it is structured so a real commerce backend (Shopify or any headless CMS) can be plugged in.

## Run it

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. Opening `index.html` directly also works.

## Admin (`/admin`)

A password-protected editor for everything on the site:

- **Products:** name, prices and sale prices, category, collection, badge, photos, description, details, sizes, colours, stock per colour and size, featured / new / best-seller flags, and live or draft status
- **Collections and categories**
- **Pages:** homepage and About page text and images, and the help and legal pages
- **FAQ, customer stories and the social gallery**
- **Settings:** brand details, the announcement bar, contact details, currency and shipping options
- **Colours:** accent, background, text, and whether photos show in black and white

Press **Save & publish** and the live site updates within about a minute. A copy of every published version is kept under **Backups**, where you can reload an older version or download everything as a file.

### One-time setup on Vercel

1. **Storage:** open the project → **Storage → Create → Blob**, then connect it to this project. This adds `BLOB_READ_WRITE_TOKEN` automatically.
2. **Password:** open **Settings → Environment Variables** and add `ADMIN_PASSWORD` with a strong password, for all environments.
3. **Redeploy:** go to **Deployments → ⋯ → Redeploy** so the new settings take effect.
4. Visit `https://your-site.vercel.app/admin` and sign in.

Changing `ADMIN_PASSWORD` signs out every open admin session.

## Structure

```
index.html              App shell: announcement, header, mobile menu, cart drawer, search overlay, SEO defaults
data/content.json       Default content (used until the first publish from /admin)
admin/                  The admin editor (index.html, admin.js, admin.css)
api/                    Vercel functions: auth.js (sign in), content.js (load / publish / backups), upload.js (photos)
assets/css/theme.css    Default colours, type, spacing and motion (colours can be overridden from /admin)
assets/css/styles.css   Components + responsive layouts
assets/js/boot.js       Loads live content (/api/content → data/content.json fallback), applies the theme
assets/js/cms.js        Turns content into products with variants and stock
assets/js/config.js     Image pipeline (Unsplash ids, uploaded images via Vercel's image optimiser)
assets/js/store.js      Cart / wishlist / orders (localStorage) with a Shopify-Cart-shaped API
assets/js/app.js        Hash router, views, interactions, motion, SEO
vercel.json             Function, image-optimisation and caching settings
```

## Running locally

- **Storefront only:** run `python3 -m http.server 5173`. The site reads `data/content.json`, and `/admin` opens in a "Local preview" mode where you can edit and download `content.json` but can't publish.
- **With the admin API:** run `npx vercel link`, then `npx vercel env pull`, then `npx vercel dev`.

## Pages / routes

| Route | Page |
|---|---|
| `#/` | Home: hero, statement, categories, The Drop, featured products, customer stories, FAQ, social gallery, contact, newsletter |
| `#/shop` | Shop, with filters in the URL: `?q=`, `dept=women,men`, `cat=`, `col=`, `size=`, `price=u100,100-200,200-350,o350`, `sort=featured|newest|price-asc|price-desc`, `new=1`, `sale=1` |
| `#/product/:slug` | Product page: gallery, colour/size variants with live stock, size guide, quantity, add to bag, wishlist, detail accordions, related products, Product JSON-LD |
| `#/collections`, `#/collections/:slug` | Collection index and editorial collection pages |
| `#/about`, `#/contact`, `#/faq` | Brand pages |
| `#/checkout` → `#/order/:id` | Checkout flow and order confirmation |
| `#/account`, `#/wishlist`, `#/info/:page` | Account, wishlist, shipping / returns / size guide / track order / legal |

## Content schema (`data/content.json`)

**Product:** `slug, sku, name, published, price, salePrice, category, collection, gender, description, images[], sizes[], colors[{name,hex}], stock{"Colour|Size": qty}, status (NEW | BEST SELLER | LIMITED), featured, newArrival, bestSeller, details[], materials, fit, care, createdAt`. Variants (`sku, color, size, quantityAvailable, availableForSale`) are derived from these fields at load time.

**Collection:** `slug, name, label, status, season, hero, cover, intro, description, notes[]`. A collection's products are the products whose `collection` field matches its slug.

**Category:** `slug, name, type (gender | category), image, description`

**Testimonial:** `name, username, profileImage, image, review, likes, comments, date, product`

**FAQ:** `order, question, answer`

## Connecting Shopify

1. **Catalogue:** in `boot.js`, replace the content document's `products` / `collections` with a Storefront API query (`products`, `collections`). Field mapping: `handle → slug`, `variants.edges[].node → variants[]`, `selectedOptions → color / size`, `quantityAvailable`, `availableForSale`, `compareAtPrice → price` with `price → salePrice`, and metafields for `details / materials / fit / care / status`.
2. **Cart:** `Store.add / setQty / remove` in `store.js` map to `cartLinesAdd / cartLinesUpdate / cartLinesRemove`. Keep the cart ID in localStorage.
3. **Checkout:** in the checkout view, redirect to `cart.checkoutUrl` instead of calling `Store.placeOrder`. Card details are never collected by this storefront.
4. **Accounts:** the sign-in form in `#/account` is where Shopify Customer Account API OAuth goes.
5. **Images:** point `IMG.src` at the Shopify CDN (`?width=` and `&height=`) so responsive `srcset` keeps working.

The same boundaries work for Sanity, Contentful or Medusa: only `boot.js`, `cms.js` and `store.js` change.

## Before launch

- Placeholder photography comes from Unsplash's CDN. Replace it with your own campaign and product shots, keeping each product's primary and secondary image consistent.
- Hash routing means search engines see a single URL. For production SEO, render these views with Next.js, Astro or Shopify Hydrogen. The view functions already return `{ title, description, image, ld, html }`, so they port directly. Also add `sitemap.xml` and `robots.txt`.
- Contact, newsletter and customer sign-in forms validate on the client but aren't wired to a backend. Connect them to Klaviyo, Shopify Forms or your email provider.
- Stock edited in the admin controls what shoppers can add to their bag, but orders don't reduce stock yet. That needs a real checkout (Shopify / Stripe) to report sales back.
