// POST /api/upload?name=file.jpg&type=image/jpeg  (raw image body) → { url }
// GET  /api/upload                                  → uploaded image library
// Admin only. Images are resized in the browser before upload.
import { put, list } from "@vercel/blob";
import { json, isAuthed, hasStorage } from "./_lib.js";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const MAX_BYTES = 4.4 * 1024 * 1024; // Vercel function request limit is 4.5 MB

export async function GET(request) {
  if (!isAuthed(request)) return json({ error: "Not signed in" }, 401);
  if (!hasStorage()) return json({ images: [] });
  const { blobs } = await list({ prefix: "uploads/", limit: 1000 });
  const images = blobs
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .map((b) => ({ url: b.url, uploadedAt: b.uploadedAt, size: b.size }));
  return json({ images });
}

export async function POST(request) {
  if (!isAuthed(request)) return json({ error: "Your session has expired. Please sign in again." }, 401);
  if (!hasStorage()) return json({ error: "Storage isn't connected yet. In Vercel, open Storage → Create → Blob and connect it to this project." }, 503);

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  if (!TYPES.includes(type)) return json({ error: "Please upload a JPG, PNG, WebP, AVIF or GIF image." }, 415);

  const buf = Buffer.from(await request.arrayBuffer());
  if (!buf.length) return json({ error: "Empty file" }, 400);
  if (buf.length > MAX_BYTES) return json({ error: "Image is too large (max 4 MB after resizing)." }, 413);

  const base = (url.searchParams.get("name") || "image").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9-]+/g, "-").slice(0, 60) || "image";
  const ext = type.split("/")[1].replace("jpeg", "jpg");
  const blob = await put(`uploads/${base}.${ext}`, buf, { access: "public", contentType: type, addRandomSuffix: true });
  return json({ url: blob.url });
}
