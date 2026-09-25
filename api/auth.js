// GET    /api/auth → { authenticated, configured, storage }
// POST   /api/auth → sign in with { password }
// DELETE /api/auth → sign out
import { json, isAuthed, hasPassword, hasStorage, passwordMatches, sessionCookie, clearCookie } from "./_lib.js";

export function GET(request) {
  return json({ authenticated: isAuthed(request), configured: hasPassword(), storage: hasStorage() });
}

export async function POST(request) {
  if (!hasPassword()) return json({ error: "No admin password is set. Add ADMIN_PASSWORD in Vercel → Settings → Environment Variables, then redeploy." }, 503);
  let body = {};
  try { body = await request.json(); } catch {}
  if (!passwordMatches(body.password)) {
    await new Promise((r) => setTimeout(r, 900)); // slow down guessing
    return json({ error: "Incorrect password" }, 401);
  }
  return json({ ok: true, storage: hasStorage() }, 200, { "set-cookie": sessionCookie() });
}

export function DELETE() {
  return json({ ok: true }, 200, { "set-cookie": clearCookie() });
}
