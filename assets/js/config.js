/* ==========================================================================
   STRATA — BRAND CONFIGURATION
   Brand identity, contact details and commerce settings live here.
   Colours and type live in assets/css/theme.css.
   ========================================================================== */

window.BRAND = {
  name: "STRATA",
  legalName: "Strata Studio Ltd.",
  tagline: "Built in layers. Worn with intent.",
  description:
    "Premium streetwear and modern essentials, cut in heavyweight fabrics and made in small runs. Designed in London.",
  url: "https://strata.studio",
  email: "hello@strata.studio",
  social: "@strata.studio",
  socialLinks: {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/",
    pinterest: "https://pinterest.com/",
    youtube: "https://youtube.com/",
  },
  location: { line1: "Studio 04, 118 Kingsland Road", line2: "London E2 8DP", est: "Est. 2021" },
  hours: { days: "Monday – Friday", time: "10 AM – 6 PM" },
  announcement: {
    text: "Free worldwide shipping on orders over $150",
    cta: "Shop new arrivals",
    href: "#/shop?new=1",
  },
  currency: "USD",
  locale: "en-US",
  freeShippingThreshold: 150,
  shippingRates: [
    { id: "standard", label: "Standard", eta: "4–7 business days", price: 12 },
    { id: "express", label: "Express", eta: "1–3 business days", price: 28 },
  ],
};

/* --------------------------------------------------------------------------
   Image pipeline. All photography is served through an image CDN with
   responsive srcsets and one consistent monochrome grade, so the whole
   catalogue reads as a single campaign. Swap `IMG.src` to point at Shopify
   CDN / Cloudinary / your own bucket when real product photography lands.
   -------------------------------------------------------------------------- */
window.IMG = {
  grade: "sat=-100&con=6",
  src(id, w, h, extra = "") {
    const size = h ? `&w=${w}&h=${h}&fit=crop` : `&w=${w}`;
    return `https://images.unsplash.com/${id}?auto=format&q=72${size}&${this.grade}${extra}`;
  },
  /** ratio = height / width */
  srcset(id, ratio, widths = [400, 700, 1000, 1400, 1900], extra = "") {
    return widths
      .map((w) => `${this.src(id, w, ratio ? Math.round(w * ratio) : 0, extra)} ${w}w`)
      .join(", ");
  },
};
