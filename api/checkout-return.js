// GET /api/checkout-return?provider=…&order=…&t=…  (where Paystack / Stripe send
// the customer after paying). Confirms the payment with the provider, then
// sends the customer to their order page.
import { readOrder, readPayments, markPaid, safeEqual } from "./_lib.js";
import { confirmPayment } from "./_payments.js";

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("order") || "";
  const token = url.searchParams.get("t") || "";
  const provider = url.searchParams.get("provider") || "";
  const go = (hash) => new Response(null, { status: 303, headers: { location: `${url.origin}/${hash}`, "cache-control": "no-store" } });

  const order = await readOrder(id);
  if (!order || !safeEqual(order.token, token)) return go("#/");
  if (order.payment?.status !== "paid") {
    try {
      const settings = await readPayments();
      const paid = await confirmPayment(provider, settings, order, { sessionId: url.searchParams.get("session_id") });
      if (paid) await markPaid(order.id, paid);
    } catch (err) {
      console.error("checkout-return", err); // the webhook will still confirm it
    }
  }
  return go(`#/order/${order.id}?t=${encodeURIComponent(token)}`);
}
