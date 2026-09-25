/* ==========================================================================
   STRATA — COMMERCE STORE
   Cart, wishlist and orders. The public API (add / setQty / remove /
   checkout) matches the shape of Shopify's Cart API: swap the bodies of
   these functions for `cartLinesAdd`, `cartLinesUpdate` and a redirect to
   `cart.checkoutUrl` to go live.
   ========================================================================== */

(function () {
  const KEY = { cart: "strata.cart.v1", wish: "strata.wish.v1", orders: "strata.orders.v1" };
  const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const state = {
    cart: read(KEY.cart, []),        // [{ sku, slug, color, size, qty }]
    wish: read(KEY.wish, []),        // [slug]
    orders: read(KEY.orders, []),
  };
  const subs = new Set();
  const emit = (evt) => subs.forEach((fn) => fn(evt));

  const bySlug = (slug) => window.CMS.products.find((p) => p.slug === slug);
  const unitPrice = (p) => p.salePrice ?? p.price;
  const variantOf = (p, color, size) => p.variants.find((v) => v.color === color && v.size === size);

  const Store = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    product: bySlug,
    variantOf,
    unitPrice,

    /* ---------- Cart ---------- */
    get lines() {
      return state.cart
        .map((l) => ({ ...l, product: bySlug(l.slug) }))
        .filter((l) => l.product);
    },
    get count() { return state.cart.reduce((a, l) => a + l.qty, 0); },
    get subtotal() { return this.lines.reduce((a, l) => a + unitPrice(l.product) * l.qty, 0); },

    add(slug, color, size, qty = 1) {
      const p = bySlug(slug);
      const v = p && variantOf(p, color, size);
      if (!v || !v.availableForSale) return { ok: false, reason: "Sold out" };
      const line = state.cart.find((l) => l.sku === v.sku);
      const current = line ? line.qty : 0;
      const next = Math.min(current + qty, v.quantityAvailable);
      if (line) line.qty = next;
      else state.cart.push({ sku: v.sku, slug, color, size, qty: next });
      write(KEY.cart, state.cart);
      emit({ type: "cart:add", slug, sku: v.sku });
      return { ok: true, capped: next < current + qty };
    },
    setQty(sku, qty) {
      const line = state.cart.find((l) => l.sku === sku);
      if (!line) return;
      const p = bySlug(line.slug);
      const v = p.variants.find((x) => x.sku === sku);
      if (qty <= 0) return this.remove(sku);
      line.qty = Math.min(qty, v.quantityAvailable);
      write(KEY.cart, state.cart);
      emit({ type: "cart:update", sku });
    },
    remove(sku) {
      state.cart = state.cart.filter((l) => l.sku !== sku);
      write(KEY.cart, state.cart);
      emit({ type: "cart:remove", sku });
    },
    clear() { state.cart = []; write(KEY.cart, state.cart); emit({ type: "cart:clear" }); },

    shippingFor(methodId, subtotal = this.subtotal) {
      const m = window.BRAND.shippingRates.find((r) => r.id === methodId) || window.BRAND.shippingRates[0];
      if (m.id === "standard" && subtotal >= window.BRAND.freeShippingThreshold) return 0;
      return m.price;
    },

    /* ---------- Wishlist ---------- */
    get wishlist() { return state.wish.map(bySlug).filter(Boolean); },
    inWish(slug) { return state.wish.includes(slug); },
    toggleWish(slug) {
      state.wish = this.inWish(slug) ? state.wish.filter((s) => s !== slug) : [...state.wish, slug];
      write(KEY.wish, state.wish);
      emit({ type: "wish", slug });
      return this.inWish(slug);
    },

    /* ---------- Checkout / orders ---------- */
    placeOrder(details) {
      const lines = this.lines.map((l) => ({
        sku: l.sku, slug: l.slug, name: l.product.name, color: l.color, size: l.size, qty: l.qty, price: unitPrice(l.product),
      }));
      const subtotal = this.subtotal;
      const shipping = this.shippingFor(details.shipping, subtotal);
      const order = {
        id: "ST" + Date.now().toString().slice(-7),
        createdAt: new Date().toISOString(),
        email: details.email,
        shippingAddress: details.address,
        shippingMethod: details.shipping,
        lines, subtotal, shipping, total: subtotal + shipping,
        status: "confirmed",
      };
      state.orders.unshift(order);
      write(KEY.orders, state.orders);
      this.clear();
      emit({ type: "order", id: order.id });
      return order;
    },
    get orders() { return state.orders; },
  };

  window.Store = Store;
})();
