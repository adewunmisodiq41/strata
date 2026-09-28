// GET  /api/checkout → which payment method checkout should show
// POST /api/checkout → create an order (prices and stock checked here, never
//                      trusted from the browser) and start payment
import {
  json, hasStorage, readContent, readInventory, readPayments, keyMode, readCosts,
  newOrderId, newToken, saveOrder, addHistory, adjustInventory,
} from "./_lib.js";
import { PROVIDERS, startPayment } from "./_payments.js";

async function activeProvider() {
  const s = await readPayments();
  const p = s.provider;
  const key = p === "paystack" ? s.paystack.secretKey : p === "stripe" ? s.stripe.secretKey : "";
  return { settings: s, provider: PROVIDERS[p] && key ? p : "none", mode: keyMode(key) };
}

export async function GET() {
  if (!hasStorage()) return json({ enabled: false });
  const { provider, mode } = await activeProvider();
  return json({ enabled: true, provider, providerName: PROVIDERS[provider]?.name || null, testMode: mode === "test" });
}

const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request) {
  if (!hasStorage()) return json({ error: "Checkout isn't available yet." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }

  // Customer details
  const c = body.customer || {}, a = body.address || {};
  const customer = { email: str(c.email, 160).toLowerCase(), first: str(c.first, 80), last: str(c.last, 80), phone: str(c.phone, 40), marketing: !!c.marketing };
  const address = { line1: str(a.line1), city: str(a.city, 100), zip: str(a.zip, 30), country: str(a.country, 80) };
  const missing = [];
  if (!EMAIL.test(customer.email)) missing.push("a valid email");
  if (!customer.first || !customer.last) missing.push("your name");
  if (!address.line1 || !address.city || !address.zip || !address.country) missing.push("a complete shipping address");
  if (missing.length) return json({ error: `Please provide ${missing.join(", ")}.` }, 422);

  // Items: price and stock come from the server's copy of the catalogue
  const { content } = await readContent();
  const inventory = await readInventory(content);
  const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  if (!items.length) return json({ error: "Your bag is empty." }, 422);
  const costs = await readCosts();
  const lines = [];
  for (const it of items) {
    const p = (content.products || []).find((x) => x.slug === it.slug && x.published !== false);
    const qty = Math.min(20, Math.max(1, parseInt(it.qty, 10) || 1));
    if (!p) return json({ error: "An item in your bag is no longer available." }, 409);
    if (!(p.colors || []).some((x) => x.name === it.color) || !(p.sizes || []).includes(it.size)) return json({ error: `${p.name} isn't available in that option any more.` }, 409);
    const left = parseInt((inventory[p.slug] || {})[`${it.color}|${it.size}`], 10) || 0;
    if (left < qty) return json({ error: left ? `Only ${left} left of ${p.name} (${it.color} / ${it.size}). Please update your bag.` : `${p.name} (${it.color} / ${it.size}) just sold out.` }, 409);
    lines.push({ slug: p.slug, name: p.name, color: it.color, size: it.size, qty, price: Number(p.salePrice || p.price), cost: costs[p.slug] ?? null, image: (p.images || [])[0] || "" });
  }

  const S = content.settings || {};
  const rates = S.shippingRates || [];
  const rate = rates.find((r) => r.id === body.shipping) || rates[0] || { id: "standard", label: "Standard", eta: "", price: 0 };
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const shippingPrice = rate.id === (rates[0] || {}).id && subtotal >= (S.freeShippingThreshold ?? Infinity) ? 0 : Number(rate.price) || 0;

  const { settings, provider } = await activeProvider();
  const currency = (S.currency || "USD").toUpperCase();
  if (provider === "paystack" && !PROVIDERS.paystack.currencies.includes(currency)) {
    return json({ error: `Paystack can't take payments in ${currency}. Change the store currency or payment provider in the admin.` }, 500);
  }

  const order = {
    id: newOrderId(), token: newToken(), createdAt: new Date().toISOString(),
    status: provider === "none" ? "new" : "awaiting_payment",
    customer, shippingAddress: address,
    shipping: { id: rate.id, label: rate.label, eta: rate.eta, price: shippingPrice },
    lines, subtotal, total: subtotal + shippingPrice, currency,
    payment: { provider, status: "unpaid" }, amountPaid: 0, payments: [], channel: "online",
    stockDeducted: false, tracking: {}, notes: "",
  };
  addHistory(order, order.status, provider === "none" ? "Order placed (no online payment)" : "Order created, waiting for payment");

  if (provider === "none") {
    await adjustInventory(lines, -1);
    order.stockDeducted = true;
    await saveOrder(order);
    return json({ id: order.id, token: order.token, status: order.status, total: order.total });
  }

  try {
    const origin = new URL(request.url).origin;
    const pay = await startPayment(provider, settings, order, origin);
    order.payment.reference = pay.reference;
    await saveOrder(order);
    return json({ id: order.id, token: order.token, status: order.status, total: order.total, redirect: pay.url });
  } catch (err) {
    console.error("startPayment", err);
    return json({ error: "We couldn't start the payment. Please try again in a moment." }, 502);
  }
}
