// Admin only.
// GET   /api/orders          → all orders (newest first)
// GET   /api/orders?id=…     → one order
// PATCH /api/orders          → { id, status?, tracking?, notes?, restock? }
import { json, isAuthed, hasStorage, listOrders, readOrder, saveOrder, addHistory, adjustInventory, markPaid } from "./_lib.js";

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
