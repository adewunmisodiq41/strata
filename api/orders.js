// Admin only.
// GET   /api/orders          → all orders (newest first)
// GET   /api/orders?id=…     → one order
// POST  /api/orders          → record a sale made in person / by phone ("New sale")
// PATCH /api/orders          → { id, status?, tracking?, notes?, restock?, markPaid?, recordPayment? }
import {
  json, isAuthed, hasStorage, listOrders, readOrder, saveOrder, addHistory, adjustInventory, markPaid,
  readContent, readInventory, readCosts, newOrderId, newToken, paidSoFar,
} from "./_lib.js";

const CHANNELS = ["in-store", "phone", "whatsapp", "instagram", "online", "other"];
const METHODS = ["cash", "transfer", "card", "pos", "other"];
const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const round2 = (n) => Math.round(Number(n) * 100) / 100;

export async function POST(request) {
  if (!isAuthed(request)) return json({ error: "Your session has expired. Please sign in again." }, 401);
  if (!hasStorage()) return json({ error: "Connect storage first." }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const { content } = await readContent();
  const inventory = await readInventory(content);
  const costs = await readCosts();
  const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  if (!items.length) return json({ error: "Add at least one item." }, 422);
  const lines = [];
  for (const it of items) {
    const p = (content.products || []).find((x) => x.slug === it.slug);
    const qty = Math.min(999, Math.max(1, parseInt(it.qty, 10) || 1));
    if (!p) return json({ error: "One of the products no longer exists." }, 422);
    if (!(p.colors || []).some((x) => x.name === it.color) || !(p.sizes || []).includes(it.size)) return json({ error: `Choose a colour and size for ${p.name}.` }, 422);
    const left = parseInt((inventory[p.slug] || {})[`${it.color}|${it.size}`], 10) || 0;
    if (left < qty && !b.allowOversell) return json({ error: `Only ${left} in stock for ${p.name} (${it.color} / ${it.size}).`, stock: true }, 409);
    const price = it.price === "" || it.price == null ? Number(p.salePrice || p.price) : round2(it.price);
    if (!(price >= 0)) return json({ error: `Check the price for ${p.name}.` }, 422);
    lines.push({ slug: p.slug, name: p.name, color: it.color, size: it.size, qty, price, cost: costs[p.slug] ?? null, image: (p.images || [])[0] || "" });
  }

  const S = content.settings || {};
  const rate = (S.shippingRates || []).find((r) => r.id === b.shipping);
  const shipping = rate ? { id: rate.id, label: rate.label, eta: rate.eta, price: round2(b.shippingPrice ?? rate.price) } : { id: "pickup", label: "Collected / handed over", eta: "", price: 0 };
  const subtotal = round2(lines.reduce((a, l) => a + l.price * l.qty, 0));
  const discount = Math.min(subtotal, Math.max(0, round2(b.discount || 0)));
  const total = round2(subtotal - discount + shipping.price);
  const paidNow = Math.min(total, Math.max(0, round2(b.amountPaid ?? total)));
  const method = METHODS.includes(b.method) ? b.method : "cash";
  const at = new Date().toISOString();

  const c = b.customer || {};
  const name = str(c.name, 120).split(/\s+/);
  const order = {
    id: newOrderId(), token: newToken(), createdAt: b.date ? new Date(b.date).toISOString() : at,
    channel: CHANNELS.includes(b.channel) ? b.channel : "in-store",
    status: b.handedOver ? "delivered" : paidNow >= total ? "paid" : "new",
    customer: { email: str(c.email, 160).toLowerCase(), first: name[0] || "Walk-in", last: name.slice(1).join(" "), phone: str(c.phone, 40), marketing: false },
    shippingAddress: { line1: str(b.address?.line1), city: str(b.address?.city, 100), zip: str(b.address?.zip, 30), country: str(b.address?.country, 80) },
    shipping, lines, subtotal, discount, total, currency: (S.currency || "USD").toUpperCase(),
    payment: { provider: "manual", status: paidNow >= total ? "paid" : "unpaid", reference: str(b.reference, 120), ...(paidNow >= total ? { paidAt: at } : {}) },
    amountPaid: paidNow,
    payments: paidNow > 0 ? [{ amount: paidNow, method, reference: str(b.reference, 120), at }] : [],
    stockDeducted: false, tracking: {}, notes: str(b.notes, 4000),
  };
  addHistory(order, order.status, `Sale recorded in admin (${order.channel})`, "admin");
  await adjustInventory(lines, -1);
  order.stockDeducted = true;
  await saveOrder(order);
  return json({ order });
}

const STATUSES = ["awaiting_payment", "new", "paid", "processing", "shipped", "delivered", "cancelled"];

export async function GET(request) {
  if (!isAuthed(request)) return json({ error: "Not signed in" }, 401);
  if (!hasStorage()) return json({ orders: [] });
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const order = await readOrder(id);
    return order ? json({ order }) : json({ error: "Order not found" }, 404);
  }
  return json({ orders: await listOrders() });
}

export async function PATCH(request) {
  if (!isAuthed(request)) return json({ error: "Your session has expired. Please sign in again." }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  let order = await readOrder(body.id);
  if (!order) return json({ error: "Order not found" }, 404);

  // Payments taken outside the site (bank transfer, cash) can be recorded by hand.
  if (body.markPaid && order.payment?.status !== "paid") {
    order = await markPaid(order.id, { provider: "manual", reference: String(body.reference || "").slice(0, 120) || "Recorded in admin" });
  }

  // Part payments: add money received towards the balance.
  if (body.recordPayment && order.status !== "cancelled") {
    const amount = round2(body.recordPayment.amount);
    const balance = round2(order.total - paidSoFar(order));
    if (!(amount > 0)) return json({ error: "Enter the amount received." }, 422);
    if (amount > balance + 0.001) return json({ error: `That's more than the balance of ${balance}.` }, 422);
    const method = METHODS.includes(body.recordPayment.method) ? body.recordPayment.method : "other";
    const reference = str(body.recordPayment.reference, 120);
    if (round2(paidSoFar(order) + amount) >= order.total) {
      order = await markPaid(order.id, { provider: order.payment?.provider === "manual" || !order.payment?.provider || order.payment.provider === "none" ? "manual" : order.payment.provider, reference: reference || method });
      order.payments[order.payments.length - 1].method = method;
    } else {
      order.amountPaid = round2(paidSoFar(order) + amount);
      order.payments = [...(order.payments || []), { amount, method, reference, at: new Date().toISOString() }];
      addHistory(order, order.status, `Part payment of ${amount} received (${method})`, "admin");
    }
  }

  const notes = [];
  if (body.tracking && typeof body.tracking === "object") {
    order.tracking = { carrier: String(body.tracking.carrier || "").slice(0, 80), number: String(body.tracking.number || "").slice(0, 120), url: String(body.tracking.url || "").slice(0, 400) };
  }
  if (typeof body.notes === "string") order.notes = body.notes.slice(0, 4000);

  if (body.status && body.status !== order.status) {
    if (!STATUSES.includes(body.status)) return json({ error: "Unknown status" }, 422);
    if (body.status === "cancelled" && body.restock && order.stockDeducted) {
      await adjustInventory(order.lines, +1);
      order.stockDeducted = false;
      notes.push("items returned to stock");
    }
    order.status = body.status;
    addHistory(order, body.status, notes.join(", "), "admin");
  }
  await saveOrder(order);
  return json({ order });
}
