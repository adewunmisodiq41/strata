// GET /api/order-status?id=…&t=… → what a customer may see about their own order.
import { json, readOrder, safeEqual } from "./_lib.js";

export async function GET(request) {
  const url = new URL(request.url);
  const order = await readOrder(url.searchParams.get("id"));
  if (!order || !safeEqual(order.token, url.searchParams.get("t") || "")) return json({ error: "Order not found" }, 404);
  return json({
    id: order.id, status: order.status, paid: order.payment?.status === "paid", provider: order.payment?.provider,
    total: order.total, currency: order.currency, createdAt: order.createdAt,
    tracking: order.status === "shipped" || order.status === "delivered" ? order.tracking : {},
  });
}
