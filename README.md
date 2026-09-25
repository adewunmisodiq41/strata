# STRATA — Storefront

A premium fashion storefront for STRATA, an original streetwear label. It's a static site with no build step and no dependencies, and it is structured so a real commerce backend (Shopify or any headless CMS) can be plugged in.

## Run it

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. Opening `index.html` directly also works.

## Structure

```
index.html              App shell: announcement, header, mobile menu, cart drawer, search overlay, SEO defaults
assets/css/theme.css    ← ONE place to change colours, type, spacing, motion
assets/css/styles.css   Components + responsive layouts (desktop / tablet ≤1099 / nav ≤899 / mobile ≤767)
assets/js/config.js     ← Brand name, contact details, announcement, shipping rates, image CDN
assets/js/cms.js        ← Products, collections, categories, testimonials, FAQ, social posts
assets/js/store.js      Cart / wishlist / orders (localStorage) with a Shopify-Cart-shaped API
assets/js/app.js        Hash router, views, interactions, motion, SEO
```

## Rebranding

- **Name, email, location, socials, announcement:** `assets/js/config.js`. The logo wordmark, footer, contact and SEO text all read from this file. Also update the static `<title>`/OG tags in `index.html`.
- **Colours and type:** `assets/css/theme.css`. The accent is `--c-accent`. Setting `--radius` above 0 gives a softer look.
- **Photography grade:** `IMG.grade` in `config.js` applies one monochrome grade to every image. Set it to `""` to show full colour.

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

## CMS schema (`assets/js/cms.js`)

**Product:** `slug, sku, name, price, salePrice, category, collection, gender, description, images[], sizes[], colors[{name,hex}], variants[{sku,color,size,quantityAvailable,availableForSale}], stock, status (NEW | BEST SELLER | LIMITED), featured, newArrival, bestSeller, details[], materials, fit, care, createdAt`

**Collection:** `slug, name, label, status, season, hero, cover, intro, description, notes[]`. A collection's products are the products whose `collection` field matches its slug.

**Category:** `slug, name, type (gender | category), image, description`

**Testimonial:** `name, username, profileImage, image, review, likes, comments, date, product`

**FAQ:** `order, question, answer`

## Connecting Shopify

1. **Catalogue:** replace the arrays in `cms.js` with a Storefront API query (`products`, `collections`). Field mapping: `handle → slug`, `variants.edges[].node → variants[]`, `selectedOptions → color / size`, `quantityAvailable`, `availableForSale`, `compareAtPrice → price` with `price → salePrice`, and metafields for `details / materials / fit / care / status`.
2. **Cart:** `Store.add / setQty / remove` in `store.js` map to `cartLinesAdd / cartLinesUpdate / cartLinesRemove`. Keep the cart ID in localStorage.
3. **Checkout:** in the checkout view, redirect to `cart.checkoutUrl` instead of calling `Store.placeOrder`. Card details are never collected by this storefront.
4. **Accounts:** the sign-in form in `#/account` is where Shopify Customer Account API OAuth goes.
5. **Images:** point `IMG.src` at the Shopify CDN (`?width=` and `&height=`) so responsive `srcset` keeps working.

The same boundaries work for Sanity, Contentful or Medusa: only `cms.js` and `store.js` change.

## Before launch

- Placeholder photography comes from Unsplash's CDN. Replace it with your own campaign and product shots, keeping each product's primary and secondary image consistent.
- Hash routing means search engines see a single URL. For production SEO, render these views with Next.js, Astro or Shopify Hydrogen. The view functions already return `{ title, description, image, ld, html }`, so they port directly. Also add `sitemap.xml` and `robots.txt`.
- Contact, newsletter and sign-in forms validate on the client but aren't wired to a backend. Connect them to Klaviyo, Shopify Forms or your email provider.
