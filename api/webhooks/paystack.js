// POST /api/webhooks/paystack — Paystack's server tells us a payment succeeded.
// Confirms the order even if the customer closed the tab before returning.
import { json, readOrder, readPayments, markPaid } from "../_lib.js";
import { confirmPayment, verifyPaystackSignature } from "../_payments.js";

export async function POST(request) {
  const raw = await request.text();
  const settings = await readPayments();
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), settings.paystack.secretKey)) {
    return json({ error: "Invalid signature" }, 401);
  }
  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (event.event === "charge.success") {
    const order = await readOrder(event.data?.reference);
    if (order && order.payment?.status !== "paid") {
      const paid = await confirmPayment("paystack", settings, order);
      if (paid) await markPaid(order.id, paid);
    }
  }
  return json({ received: true });
}
