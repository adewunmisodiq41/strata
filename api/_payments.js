// Paystack and Stripe, called over their REST APIs (no SDKs needed).
import crypto from "node:crypto";
import { toMinor, safeEqual } from "./_lib.js";

export const PROVIDERS = {
  paystack: { name: "Paystack", currencies: ["NGN", "GHS", "ZAR", "KES", "USD"] },
  stripe: { name: "Stripe", currencies: null }, // Stripe accepts all store currencies
};

/* ------------------------------------------------------------ Paystack */
async function paystack(path, secretKey, init = {}) {
  const r = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.status === false) throw new Error(`Paystack: ${data.message || r.statusText}`);
  return data.data;
}

/* -------------------------------------------------------------- Stripe */
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v == null) continue;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(path, secretKey, body) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${secretKey}`, ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? form(body).toString() : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Stripe: ${data.error?.message || r.statusText}`);
  return data;
}

/* ---------------------------------------------------------------- API */

/** Start a payment. Returns the URL of the provider's hosted payment page. */
export async function startPayment(provider, settings, order, origin) {
  const returnURL = (extra = "") => `${origin}/api/checkout-return?provider=${provider}&order=${order.id}&t=${order.token}${extra}`;
  if (provider === "paystack") {
    const data = await paystack("/transaction/initialize", settings.paystack.secretKey, {
      method: "POST",
      body: JSON.stringify({
        email: order.customer.email,
        amount: toMinor(order.total),
        currency: order.currency,
        reference: order.id,
        callback_url: returnURL(),
        metadata: { order_id: order.id, cancel_action: `${origin}/#/checkout` },
      }),
    });
    return { url: data.authorization_url, reference: data.reference };
  }
  if (provider === "stripe") {
    const cur = order.currency.toLowerCase();
    const items = order.lines.map((l) => ({
      price_data: { currency: cur, unit_amount: toMinor(l.price), product_data: { name: l.name, description: `${l.color} / ${l.size}` } },
      quantity: l.qty,
    }));
    if (order.shipping.price > 0) items.push({ price_data: { currency: cur, unit_amount: toMinor(order.shipping.price), product_data: { name: `Shipping — ${order.shipping.label}` } }, quantity: 1 });
    const session = await stripe("/checkout/sessions", settings.stripe.secretKey, {
      mode: "payment",
      customer_email: order.customer.email,
      client_reference_id: order.id,
      metadata: { order_id: order.id },
      line_items: Object.fromEntries(items.map((it, i) => [i, it])),
      success_url: returnURL("&session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: `${origin}/#/order/${order.id}?t=${order.token}`,
    });
    return { url: session.url, reference: session.id };
  }
  throw new Error("Unknown payment provider");
}

/** Ask the provider whether an order has really been paid, and for the right amount. */
export async function confirmPayment(provider, settings, order, params = {}) {
  if (provider === "paystack") {
    const tx = await paystack(`/transaction/verify/${encodeURIComponent(order.id)}`, settings.paystack.secretKey);
    const ok = tx.status === "success" && tx.amount === toMinor(order.total) && tx.currency === order.currency;
    return ok ? { provider, reference: tx.reference, amount: tx.amount / 100, channel: tx.channel } : null;
  }
  if (provider === "stripe") {
    const sessionId = params.sessionId || order.payment?.reference;
    if (!sessionId) return null;
    const s = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}`, settings.stripe.secretKey);
    const ok = s.payment_status === "paid" && s.metadata?.order_id === order.id && s.amount_total === toMinor(order.total);
    return ok ? { provider, reference: s.payment_intent || s.id, amount: s.amount_total / 100 } : null;
  }
  return null;
}

/** Check that a key works, for the admin's "Test connection" button. */
export async function testKeys(provider, settings) {
  if (provider === "paystack") { await paystack("/balance", settings.paystack.secretKey); return "Connected to Paystack"; }
  if (provider === "stripe") { await stripe("/balance", settings.stripe.secretKey); return "Connected to Stripe"; }
  throw new Error("Choose Paystack or Stripe first");
}

/* ------------------------------------------------------------ Webhooks */
export function verifyPaystackSignature(raw, header, secretKey) {
  if (!header || !secretKey) return false;
  const expected = crypto.createHmac("sha512", secretKey).update(raw).digest("hex");
  return safeEqual(expected, header);
}

export function verifyStripeSignature(raw, header, webhookSecret, toleranceSec = 300) {
  if (!header || !webhookSecret) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")).filter((x) => x.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(`${t}.${raw}`).digest("hex");
  return sigs.some((s) => safeEqual(expected, s));
}
