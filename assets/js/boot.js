/* ==========================================================================
   STRATA — BOOT
   1. Load the content document: the live version saved from /admin
      (/api/content), falling back to the bundled data/content.json.
   2. Apply the theme, then start the store and the app.
   ========================================================================== */

(async function boot() {
  async function getJSON(url) {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error(url + " " + r.status);
    return r.json();
  }

  let content;
  try { content = await getJSON("/api/content"); }
  catch { content = await getJSON("data/content.json"); }

  window.CONTENT = content;
  window.BRAND = content.settings;
  window.CMS = window.buildCMS(content);

  // Theme
  const t = content.theme || {};
  const root = document.documentElement.style;
  const set = (k, v) => v && root.setProperty(k, v);
  set("--c-accent", t.accent);
  set("--c-bg", t.bg);
  set("--c-ink", t.ink);
  set("--c-muted", t.muted);
  set("--c-dark", t.dark);
  if (t.bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.bg);
  window.IMG.grade = t.monochrome === false ? "" : "sat=-100&con=6";
  document.body.classList.toggle("is-mono", t.monochrome !== false);

  for (const src of ["assets/js/store.js", "assets/js/app.js"]) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.body.appendChild(s);
    });
  }
})().catch((err) => {
  console.error(err);
  document.getElementById("main").innerHTML =
    '<p style="padding:40px 24px">The store could not load. Please refresh the page.</p>';
});
