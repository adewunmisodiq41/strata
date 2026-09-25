/* ==========================================================================
   STRATA — IMAGE PIPELINE
   Brand settings, copy and catalogue now live in data/content.json and are
   edited from /admin. This file only knows how to turn an image reference
   into responsive URLs.

   An image reference is either:
   - an Unsplash photo id ("photo-123…"), served through Unsplash's CDN, or
   - a full URL (e.g. an upload in Vercel Blob), served through Vercel's
     image optimiser when the site runs on Vercel.
   ========================================================================== */

window.IMG = {
  grade: "sat=-100&con=6",               // set from theme.monochrome at boot
  vercelSizes: [256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],

  isExternal(id) { return /^(https?:)?\/\//.test(id) || id.startsWith("/"); },

  src(id, w, h, extra = "") {
    if (!id) return "";
    if (this.isExternal(id)) {
      const onVercel = !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) && /^https?:\/\//.test(id);
      if (!onVercel) return id;
      const size = this.vercelSizes.find((s) => s >= w) || 3840;
      return `/_vercel/image?url=${encodeURIComponent(id)}&w=${size}&q=75`;
    }
    const size = h ? `&w=${w}&h=${h}&fit=crop` : `&w=${w}`;
    const grade = this.grade ? `&${this.grade}` : "";
    return `https://images.unsplash.com/${id}?auto=format&q=72${size}${grade}${extra}`;
  },

  /** ratio = height / width */
  srcset(id, ratio, widths = [400, 700, 1000, 1400, 1900], extra = "") {
    if (!id) return "";
    return widths
      .map((w) => `${this.src(id, w, ratio ? Math.round(w * ratio) : 0, extra)} ${w}w`)
      .join(", ");
  },
};
