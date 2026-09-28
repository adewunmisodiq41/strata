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

## Dashboard, sales & expenses

**Admin → Dashboard** is the admin's home screen. For any period (today, 7 days, 30 days, this month, or custom dates) it shows:

- **Revenue:** total sales in the period
- **Gross profit:** revenue less product cost
- **Expenses**
- **Net profit:** gross profit less expenses
- **Outstanding:** customer balances still owed
- **Low stock:** products with a size or colour at 2 or fewer

Below the cards are a revenue and profit chart, the top-selling products, and the latest sales with balance and payment status.

- **Cost price:** set on each product. It's stored encrypted and removed from the public content file, so customers never see your margins. Gross profit uses the cost at the time of sale.
- **+ New sale:** records in-store, phone, WhatsApp or Instagram sales. You can override prices, add a discount and delivery, and take part payment. Stock is deducted straight away.
- **Record payment:** on any order with a balance, adds cash, transfer or POS payments until it's settled.
- **Admin → Expenses:** records costs by category, such as marketing, rent, packaging and shipping. Expenses are stored encrypted.

Revenue counts every order except cancelled ones and online orders that were never paid. The dashboard reads up to the 300 most recent orders.

## Orders & payments

**Admin → Payments** sets how customers pay:

- **No online payment:** orders come in unpaid. You arrange payment, then use **Mark as paid** on the order.
- **Paystack:** cards, bank transfer and USSD, in NGN, GHS, ZAR, KES or USD.
- **Stripe:** cards, Apple Pay and Google Pay, in any store currency.

Paste your keys, then **Test connection**. Copy the webhook URL shown into the provider's dashboard. Keys are encrypted before they're stored and are never shown again. Start with test keys (`sk_test_…`); checkout shows a "test mode" note until you switch to live keys.

**How checkout works**

1. The customer submits checkout.
2. `/api/checkout` re-prices the bag from the catalogue, checks stock, saves the order as "awaiting payment" and sends the customer to Paystack's or Stripe's payment page.
3. After paying, the customer returns through `/api/checkout-return`, which confirms the payment with the provider (amount and currency included) before marking the order paid.
4. The provider's webhook (`/api/webhooks/paystack` or `/api/webhooks/stripe`) confirms it again, in case the customer closed the tab. Both paths are safe to run twice.
5. Stock is deducted once, when the order is paid (or straight away when there's no online payment).

**Admin → Orders** lists every order with filters (to fulfil, awaiting payment, shipped…), search and CSV export. Open an order to see items, customer and address, then update its status, add a carrier and tracking number (the customer sees these on their order page), keep internal notes, or cancel it and put the items back in stock.

**Where data is kept:** orders and payment keys are stored in Vercel Blob, encrypted with AES-256-GCM. The encryption key comes from `ENCRYPTION_KEY` if you set one, otherwise from the storage token. Changing whichever key is used makes existing orders and saved keys unreadable, so if you want to rotate the storage token later, set your own `ENCRYPTION_KEY` first. Stock is kept in its own file (`inventory.json`), so orders and admin publishing don't overwrite each other.

**Optional environment variables:** `ENCRYPTION_KEY`, plus `PAYMENT_PROVIDER`, `PAYSTACK_SECRET_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` if you'd rather manage keys in Vercel than in the admin. Keys entered in the admin take priority.

**Not included yet:** order confirmation emails to customers and admin email alerts. These need an email service such as Resend or Postmark. Refunds are issued from the Paystack or Stripe dashboard.

## Structure

```
index.html              App shell: announcement, header, mobile menu, cart drawer, search overlay, SEO defaults
data/content.json       Default content (used until the first publish from /admin)
admin/                  The admin editor (index.html, admin.js, admin.css)
api/                    Vercel functions: auth, content (load / publish / backups), upload (photos),
                        checkout, checkout-return, order-status, orders (incl. manual sales), expenses, payments,
                        webhooks/paystack, webhooks/stripe
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
