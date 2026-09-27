// Admin only.
// GET  /api/payments            → current setup (keys are never sent back, only masked)
// PUT  /api/payments            → change provider / keys
// POST /api/payments?test=1     → check the chosen provider's key works
import { json, isAuthed, hasStorage, readPayments, writePayments, keyMode, mask } from "./_lib.js";
import { PROVIDERS, testKeys } from "./_payments.js";

function summary(s, origin) {
  return {
    provider: s.provider,
    unreadable: s.unreadable,
    paystack: { configured: !!s.paystack.secretKey, secretKey: mask(s.paystack.secretKey), publicKey: s.paystack.publicKey, mode: keyMode(s.paystack.secretKey) },
    stripe: { configured: !!s.stripe.secretKey, secretKey: mask(s.stripe.secretKey), webhookConfigured: !!s.stripe.webhookSecret, mode: keyMode(s.stripe.secretKey) },
    webhooks: { paystack: `${origin}/api/webhooks/paystack`, stripe: `${origin}/api/webhooks/stripe` },
    currencies: { paystack: PROVIDERS.paystack.currencies },
  };
}

export async function GET(request) {
  if (!isAuthed(request)) return json({ error: "Not signed in" }, 401);
  return json(summary(await readPayments(), new URL(request.url).origin));
}

const PATTERNS = {
  "paystack.secretKey": /^sk_(test|live)_[A-Za-z0-9]{10,}$/,
  "paystack.publicKey": /^pk_(test|live)_[A-Za-z0-9]{10,}$/,
  "stripe.secretKey": /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/,
  "stripe.webhookSecret": /^whsec_[A-Za-z0-9]{10,}$/,
};
const LABELS = { "paystack.secretKey": "Paystack secret key", "paystack.publicKey": "Paystack public key", "stripe.secretKey": "Stripe secret key", "stripe.webhookSecret": "Stripe webhook signing secret" };

export async function PUT(request) {
  if (!isAuthed(request)) return json({ error: "Your session has expired. Please sign in again." }, 401);
  if (!hasStorage()) return json({ error: "Connect storage first (Vercel → Storage → Blob)." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const cur = await readPayments();
  const next = { provider: cur.provider, paystack: { ...cur.paystack }, stripe: { ...cur.stripe } };
  if (cur.unreadable) { next.paystack = { secretKey: "", publicKey: "" }; next.stripe = { secretKey: "", webhookSecret: "" }; }
  if (body.provider !== undefined) {
    if (!["none", "paystack", "stripe"].includes(body.provider)) return json({ error: "Unknown provider" }, 422);
    next.provider = body.provider;
  }
  // A key is only changed when a new value is sent; null clears it.
  const errors = [];
  for (const path of Object.keys(PATTERNS)) {
    const [p, k] = path.split(".");
    const v = body[p]?.[k];
    if (v === undefined || v === "") continue;
    if (v === null) { next[p][k] = ""; continue; }
    const val = String(v).trim();
    if (!PATTERNS[path].test(val)) errors.push(`${LABELS[path]} doesn't look right — check you copied the whole key.`);
    else next[p][k] = val;
  }
  if (errors.length) return json({ error: errors.join(" ") }, 422);
  if (next.provider !== "none" && !next[next.provider].secretKey) return json({ error: `Add your ${PROVIDERS[next.provider].name} secret key before switching to it.` }, 422);

  await writePayments(next);
  return json({ ok: true, ...summary(next, new URL(request.url).origin) });
}

export async function POST(request) {
  if (!isAuthed(request)) return json({ error: "Not signed in" }, 401);
  const s = await readPayments();
  const provider = new URL(request.url).searchParams.get("provider") || s.provider;
  try { return json({ ok: true, message: await testKeys(provider, s) }); }
  catch (err) { return json({ error: err.message }, 400); }
}
