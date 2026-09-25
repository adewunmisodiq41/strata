// GET  /api/content            → live content (public, cached briefly at the edge)
// GET  /api/content?fresh=1    → uncached content, for the admin
// GET  /api/content?backups=1  → list of previous saves (admin only)
// PUT  /api/content            → save + publish (admin only)
import { put, list } from "@vercel/blob";
import { json, isAuthed, hasStorage, readContent, validateContent, CONTENT_PATH } from "./_lib.js";

const MAX_BYTES = 4 * 1024 * 1024;

export async function GET(request) {
  const url = new URL(request.url);

  if (url.searchParams.has("backups")) {
    if (!isAuthed(request)) return json({ error: "Not signed in" }, 401);
    if (!hasStorage()) return json({ backups: [] });
    const { blobs } = await list({ prefix: "backups/", limit: 1000 });
    const backups = blobs
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, 50)
      .map((b) => ({ url: b.url, uploadedAt: b.uploadedAt, size: b.size }));
    return json({ backups });
  }

  const { content, source } = await readContent();
  const fresh = url.searchParams.has("fresh");
  return json(content, 200, {
    "x-content-source": source,
    "cache-control": fresh ? "no-store" : "public, max-age=0, s-maxage=20, stale-while-revalidate=600",
  });
}

export async function PUT(request) {
  if (!isAuthed(request)) return json({ error: "Your session has expired. Please sign in again." }, 401);
  if (!hasStorage()) return json({ error: "Storage isn't connected yet. In Vercel, open Storage → Create → Blob and connect it to this project, then redeploy." }, 503);

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: "Content is too large to save (over 4 MB)." }, 413);

  let content;
  try { content = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }

  const errors = validateContent(content);
  if (errors.length) return json({ error: "Please fix these before publishing:", errors }, 422);

  content.updatedAt = new Date().toISOString();
  const body = JSON.stringify(content);
  const opts = { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true };

  await put(CONTENT_PATH, body, { ...opts, cacheControlMaxAge: 60 });
  await put(`backups/content-${Date.now()}.json`, body, { ...opts, allowOverwrite: false });

  return json({ ok: true, updatedAt: content.updatedAt });
}
