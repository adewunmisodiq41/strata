// Shared helpers for the STRATA admin API (files starting with "_" are not
// deployed as endpoints).
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { head } from "@vercel/blob";

export const COOKIE = "strata_admin";
export const SESSION_HOURS = 12;
export const CONTENT_PATH = "content.json";

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
  const expected = Buffer.from(hmac(exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function passwordMatches(input) {
  const a = crypto.createHash("sha256").update(String(input || "")).digest();
  const b = crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD || "").digest();
  return hasPassword() && crypto.timingSafeEqual(a, b);
}

/* ---------- Content ---------- */
export async function readSeed() {
  return JSON.parse(await readFile(new URL("../data/content.json", import.meta.url), "utf8"));
}

/** The live content saved from /admin, or the bundled seed if nothing has been saved yet. */
export async function readContent() {
  if (hasStorage()) {
    try {
      const meta = await head(CONTENT_PATH);
      const r = await fetch(`${meta.url}?v=${new Date(meta.uploadedAt).getTime()}`, { cache: "no-store" });
      if (r.ok) return { content: await r.json(), source: "storage" };
    } catch (err) {
      if (!/not.?found/i.test(String(err && (err.name + err.message)))) console.error("readContent", err);
    }
  }
  return { content: await readSeed(), source: "seed" };
}

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
