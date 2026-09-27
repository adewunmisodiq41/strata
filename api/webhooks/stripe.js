// POST /api/webhooks/stripe — Stripe's server tells us a checkout was paid.
// Confirms the order even if the customer closed the tab before returning.
import { json, readOrder, readPayments, markPaid } from "../_lib.js";
import { confirmPayment, verifyStripeSignature } from "../_payments.js";

export async function POST(request) {
  const raw = await request.text();
  const settings = await readPayments();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), settings.stripe.webhookSecret)) {
    return json({ error: "Invalid signature" }, 400);
  }
  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data?.object || {};
    const order = await readOrder(session.metadata?.order_id);
    if (order && order.payment?.status !== "paid") {
      const paid = await confirmPayment("stripe", settings, order, { sessionId: session.id });
      if (paid) await markPaid(order.id, paid);
    }
  }
  return json({ received: true });
}
