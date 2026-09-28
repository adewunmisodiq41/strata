// Shared helpers for the STRATA API (files starting with "_" are not
// deployed as endpoints).
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { head, put, list } from "@vercel/blob";

export const COOKIE = "strata_admin";
export const SESSION_HOURS = 12;
export const CONTENT_PATH = "content.json";
const INVENTORY_PATH = "inventory.json";
const PAYMENTS_PATH = "secure/payments.enc";
const COSTS_PATH = "secure/costs.enc";
const EXPENSES_PATH = "secure/expenses.enc";

export const hasStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const hasPassword = () => Boolean(process.env.ADMIN_PASSWORD);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

/* ---------- Sessions: signed, expiring, HttpOnly cookie ---------- */
function sessionKey() {
  // Derived from the password, so changing ADMIN_PASSWORD signs everyone out.
  return crypto.createHash("sha256").update("strata-session:" + process.env.ADMIN_PASSWORD).digest();
}
const hmac = (value) => crypto.createHmac("sha256", sessionKey()).update(value).digest("base64url");

export function sessionCookie() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const token = `${exp}.${hmac(String(exp))}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function isAuthed(request) {
  if (!hasPassword()) return false;
  const raw = (request.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(hmac(exp), sig);
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function passwordMatches(input) {
  const a = crypto.createHash("sha256").update(String(input || "")).digest();
  const b = crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD || "").digest();
  return hasPassword() && crypto.timingSafeEqual(a, b);
}

/* ---------- Encryption for orders and payment keys ----------
   Blob files are publicly addressable, so anything private is sealed with
   AES-256-GCM. The key comes from ENCRYPTION_KEY if set, otherwise from the
   storage token (server-only). Changing whichever one is used makes
   existing orders and saved payment keys unreadable. */
function encKey() {
  const base = process.env.ENCRYPTION_KEY || process.env.BLOB_READ_WRITE_TOKEN || "";
  return crypto.createHash("sha256").update("strata-data:" + base).digest();
}
export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}
export function unseal(text) {
  const [v, iv, tag, data] = String(text).split(":");
  if (v !== "v1") throw new Error("Unknown sealed format");
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8"));
}

/* ---------- Blob helpers ---------- */
const isNotFound = (err) => /not.?found|does not exist/i.test(String(err && (err.name + " " + err.message)));

async function readBlobText(pathname) {
  try {
    const meta = await head(pathname);
    const r = await fetch(`${meta.url}?v=${new Date(meta.uploadedAt).getTime()}`, { cache: "no-store" });
    return r.ok ? await r.text() : null;
  } catch (err) {
    if (!isNotFound(err)) console.error("readBlob", pathname, err);
    return null;
  }
}
async function writeBlob(pathname, body, contentType = "application/json", cacheControlMaxAge = 60) {
  return put(pathname, body, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge });
}

/* ---------- Content ---------- */
export async function readSeed() {
  return JSON.parse(await readFile(new URL("../data/content.json", import.meta.url), "utf8"));
}

async function readRawContent() {
  if (hasStorage()) {
    const text = await readBlobText(CONTENT_PATH);
    if (text) return { content: JSON.parse(text), source: "storage" };
  }
  return { content: await readSeed(), source: "seed" };
}

/** Live content, with current stock levels applied to each product. */
export async function readContent() {
  const res = await readRawContent();
  const inv = await readInventory(res.content);
  for (const p of res.content.products || []) if (inv[p.slug]) p.stock = { ...(p.stock || {}), ...inv[p.slug] };
  return res;
}

export async function writeContent(content) {
  const body = JSON.stringify(content);
  await writeBlob(CONTENT_PATH, body);
  await put(`backups/content-${Date.now()}.json`, body, { access: "public", contentType: "application/json", addRandomSuffix: false });
}

/* ---------- Inventory ----------
   Stock lives in its own file so orders (which reduce stock) and the admin
   (which edits content) never overwrite each other's changes. */
export async function readInventory(content) {
  if (hasStorage()) {
    const text = await readBlobText(INVENTORY_PATH);
    if (text) return JSON.parse(text);
  }
  const c = content || (await readRawContent()).content;
  return Object.fromEntries((c.products || []).map((p) => [p.slug, { ...(p.stock || {}) }]));
}
async function writeInventory(inv) {
  await writeBlob(INVENTORY_PATH, JSON.stringify(inv));
}

/** After an admin publish: add new products/variants, drop deleted ones, apply edited cells. */
export async function syncInventory(content, changes = []) {
  const inv = await readInventory(content);
  const next = {};
  for (const p of content.products || []) {
    const cur = inv[p.slug] || {};
    const row = {};
    for (const c of p.colors || []) for (const s of p.sizes || []) {
      const k = `${c.name}|${s}`;
      row[k] = k in cur ? cur[k] : Math.max(0, parseInt((p.stock || {})[k], 10) || 0);
    }
    next[p.slug] = row;
  }
  for (const ch of changes) {
    if (next[ch.slug] && ch.key in next[ch.slug]) next[ch.slug][ch.key] = Math.max(0, parseInt(ch.qty, 10) || 0);
  }
  await writeInventory(next);
  return next;
}

/** sign = -1 to take stock for an order, +1 to put it back. */
export async function adjustInventory(lines, sign) {
  const inv = await readInventory();
  for (const l of lines) {
    const k = `${l.color}|${l.size}`;
    if (!inv[l.slug]) inv[l.slug] = {};
    inv[l.slug][k] = Math.max(0, (parseInt(inv[l.slug][k], 10) || 0) + sign * l.qty);
  }
  await writeInventory(inv);
}

/* ---------- Payment settings ---------- */
export async function readPayments() {
  let saved = {};
  if (hasStorage()) {
    const text = await readBlobText(PAYMENTS_PATH);
    if (text) { try { saved = unseal(text); } catch (e) { console.error("payments unseal", e.message); saved = { unreadable: true }; } }
  }
  const env = process.env;
  return {
    provider: saved.provider || env.PAYMENT_PROVIDER || "none",
    unreadable: !!saved.unreadable,
    paystack: { secretKey: saved.paystack?.secretKey || env.PAYSTACK_SECRET_KEY || "", publicKey: saved.paystack?.publicKey || env.PAYSTACK_PUBLIC_KEY || "" },
    stripe: { secretKey: saved.stripe?.secretKey || env.STRIPE_SECRET_KEY || "", webhookSecret: saved.stripe?.webhookSecret || env.STRIPE_WEBHOOK_SECRET || "" },
  };
}
export async function writePayments(settings) {
  await writeBlob(PAYMENTS_PATH, seal(settings), "text/plain", 60);
}
/* ---------- Private business data (cost prices, expenses) ---------- */
async function readSealed(path, fallback) {
  if (!hasStorage()) return fallback;
  const text = await readBlobText(path);
  if (!text) return fallback;
  try { return unseal(text); } catch (e) { console.error("unseal", path, e.message); return fallback; }
}
/** { [productSlug]: costPrice } — kept out of the public content file. */
export const readCosts = () => readSealed(COSTS_PATH, {});
export const writeCosts = (costs) => writeBlob(COSTS_PATH, seal(costs), "text/plain", 60);
export const readExpenses = () => readSealed(EXPENSES_PATH, []);
export const writeExpenses = (list) => writeBlob(EXPENSES_PATH, seal(list), "text/plain", 60);

export const keyMode = (k) => (!k ? null : /_test_/.test(k) ? "test" : "live");
export const mask = (k) => (k ? `${k.slice(0, 8)}…${k.slice(-4)}` : "");

/* ---------- Orders ---------- */
const orderPath = (id) => `orders/${id}.enc`;

export function newOrderId() {
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const r = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
  return `ST${t}${r}`;
}
export const newToken = () => crypto.randomBytes(18).toString("base64url");

export async function saveOrder(order) {
  order.updatedAt = new Date().toISOString();
  await writeBlob(orderPath(order.id), seal(order), "text/plain", 60);
  return order;
}
export async function readOrder(id) {
  if (!/^ST[A-Z0-9]{6,14}$/.test(id || "")) return null;
  const text = await readBlobText(orderPath(id));
  if (!text) return null;
  try { return unseal(text); } catch { return null; }
}
export async function listOrders(limit = 300) {
  const { blobs } = await list({ prefix: "orders/", limit: 1000 });
  const recent = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, limit);
  const out = await Promise.all(recent.map(async (b) => {
    try {
      const r = await fetch(`${b.url}?v=${new Date(b.uploadedAt).getTime()}`, { cache: "no-store" });
      return unseal(await r.text());
    } catch { return null; }
  }));
  return out.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addHistory(order, status, note, by = "system") {
  order.history = order.history || [];
  order.history.push({ at: new Date().toISOString(), status, note: note || "", by });
}

/** Idempotent: safe to call from both the return page and the webhook. */
export async function markPaid(id, payment) {
  const order = await readOrder(id);
  if (!order) return null;
  if (order.payment?.status === "paid") return order;
  order.payment = { ...order.payment, ...payment, status: "paid", paidAt: new Date().toISOString() };
  const already = paidSoFar(order);
  if (already < order.total) {
    order.payments = [...(order.payments || []), { amount: order.total - already, method: payment.provider, reference: payment.reference || "", at: new Date().toISOString() }];
  }
  order.amountPaid = order.total;
  if (order.status === "awaiting_payment" || order.status === "new") order.status = "paid";
  addHistory(order, "paid", `Payment confirmed by ${payment.provider}`);
  if (!order.stockDeducted) { await adjustInventory(order.lines, -1); order.stockDeducted = true; }
  return saveOrder(order);
}

/** How much of an order has been paid (supports part payments). */
export function paidSoFar(o) {
  if (typeof o.amountPaid === "number") return o.amountPaid;
  return o.payment?.status === "paid" ? o.total : 0;
}

/** Smallest currency unit (kobo, cents…). All supported currencies use 2 decimals. */
export const toMinor = (amount) => Math.round(Number(amount) * 100);

/* ---------- Content validation ---------- */
const REQUIRED_ARRAYS = ["products", "collections", "categories", "testimonials", "faq", "social"];

/** Light structural validation so a bad save can't take the storefront down. */
export function validateContent(c) {
  const errors = [];
  if (!c || typeof c !== "object" || Array.isArray(c)) return ["Content must be an object"];
  if (!c.settings || typeof c.settings !== "object") errors.push("settings is missing");
  if (!c.pages || typeof c.pages !== "object") errors.push("pages is missing");
  for (const k of REQUIRED_ARRAYS) if (!Array.isArray(c[k])) errors.push(`${k} must be a list`);
  if (Array.isArray(c.products)) {
    const seen = new Set();
    c.products.forEach((p, i) => {
      if (!p || !p.name) errors.push(`Product ${i + 1} needs a name`);
      if (!p || !/^[a-z0-9-]+$/.test(p.slug || "")) errors.push(`Product "${p?.name || i + 1}" needs a URL slug (lowercase letters, numbers, dashes)`);
      else if (seen.has(p.slug)) errors.push(`Two products use the slug "${p.slug}"`);
      else seen.add(p.slug);
      if (!(Number(p?.price) >= 0)) errors.push(`Product "${p?.name}" has an invalid price`);
    });
  }
  if (Array.isArray(c.collections)) {
    const seen = new Set();
    c.collections.forEach((col) => {
      if (!/^[a-z0-9-]+$/.test(col?.slug || "")) errors.push(`Collection "${col?.name}" needs a URL slug`);
      else if (seen.has(col.slug)) errors.push(`Two collections use the slug "${col.slug}"`);
      else seen.add(col.slug);
    });
  }
  return errors;
}
