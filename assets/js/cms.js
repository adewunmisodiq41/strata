/* ==========================================================================
   STRATA — CONTENT MODEL
   Turns the raw content document (data/content.json, or the version saved
   from /admin) into the shapes the storefront uses. Field names mirror
   Shopify's Storefront API (handle → slug, variants[].sku /
   availableForSale / quantityAvailable) so a Shopify fetch can replace
   the content document later without touching the views.
   ========================================================================== */

window.buildCMS = function buildCMS(raw) {
  const skuPart = (s) => String(s).replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();

  const products = (raw.products || [])
    .filter((p) => p.published !== false)
    .map((p) => {
      const colors = (p.colors && p.colors.length ? p.colors : [{ name: "Default", hex: "#141413" }]);
      const sizes = p.sizes && p.sizes.length ? p.sizes : ["OS"];
      const stock = p.stock || {};
      const variants = [];
      colors.forEach((c) =>
        sizes.forEach((s) => {
          const qty = Math.max(0, parseInt(stock[`${c.name}|${s}`], 10) || 0);
          variants.push({ sku: `${p.sku || p.slug}-${skuPart(c.name)}-${s}`, color: c.name, size: s, quantityAvailable: qty, availableForSale: qty > 0 });
        })
      );
      return {
        salePrice: null, featured: false, newArrival: false, bestSeller: false, gender: "unisex", details: [],
        ...p,
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        price: Number(p.price) || 0,
        status: p.status || null,
        images: (p.images || []).filter(Boolean),
        colors, sizes, variants,
        stock: variants.reduce((a, v) => a + v.quantityAvailable, 0),
      };
    });

  return {
    products,
    collections: (raw.collections || []).filter((c) => c.status !== "hidden"),
    categories: raw.categories || [],
    testimonials: raw.testimonials || [],
    faq: raw.faq || [],
    social: raw.social || [],
    pages: raw.pages || {},
  };
};
