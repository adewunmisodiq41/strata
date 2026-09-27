/* ==========================================================================
   STRATA — ADMIN
   Edits the site's content document (products, collections, pages, copy,
   settings, colours) and publishes it through /api/content. No build step.
   ========================================================================== */
(() => {
  const app = document.getElementById("app");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const state = {
    content: null, savedJSON: "", mode: "live", auth: {},
    section: localStorage.getItem("strata.admin.section") || "products",
    edit: null, search: "", open: new Set(), autoSlug: false, saving: false,
    origStock: {}, orders: null, orderFilter: "todo", orderSearch: "", order: null, payments: null,
  };
  const snapshotStock = () => { state.origStock = Object.fromEntries(state.content.products.map((p) => [p.slug, { ...(p.stock || {}) }])); };
  function stockChanges() {
    const out = [];
    for (const p of state.content.products) {
      const before = state.origStock[p.slug] || {};
      for (const [key, qty] of Object.entries(p.stock || {})) if (before[key] !== qty) out.push({ slug: p.slug, key, qty });
    }
    return out;
  }

  /* ---------------------------------------------------------------- API */
  async function api(url, opts = {}) {
    const r = await fetch(url, { credentials: "same-origin", ...opts });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error((data && data.error) || `Request failed (${r.status})`), { status: r.status, data });
    return data;
  }

  /* -------------------------------------------------------------- paths */
  const parse = (path) => path.split(".").map((k) => (/^\d+$/.test(k) ? +k : k));
  const get = (path) => parse(path).reduce((o, k) => (o == null ? undefined : o[k]), state.content);
  function set(path, val) {
    const ks = parse(path);
    let o = state.content;
    ks.slice(0, -1).forEach((k, i) => { if (o[k] == null) o[k] = typeof ks[i + 1] === "number" ? [] : {}; o = o[k]; });
    o[ks[ks.length - 1]] = val;
    updateDirty();
  }

  const isDirty = () => state.content && JSON.stringify(state.content) !== state.savedJSON;
  function updateDirty() {
    const d = isDirty();
    const pill = $("[data-dirty]");
    if (pill) { pill.hidden = !d; }
    const btn = $('[data-act="save"]');
    if (btn) btn.classList.toggle("is-hot", d);
  }
  addEventListener("beforeunload", (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });

  /* ------------------------------------------------------------ options */
  const opt = {
    categories: () => (state.content.categories || []).filter((c) => c.type !== "gender").map((c) => [c.slug, c.name]),
    collections: () => (state.content.collections || []).map((c) => [c.slug, c.name]),
    products: () => [["", "— None —"], ...(state.content.products || []).map((p) => [p.slug, p.name])],
    gender: [["unisex", "Unisex (shows in Women and Men)"], ["women", "Women"], ["men", "Men"]],
    status: [["", "No badge"], ["NEW", "New"], ["BEST SELLER", "Best seller"], ["LIMITED", "Limited"]],
    catType: [["category", "Product category"], ["gender", "Department (Women / Men)"]],
    colStatus: [["live", "Live"], ["hidden", "Hidden"]],
    currency: [["USD", "USD — US dollar"], ["GBP", "GBP — British pound"], ["EUR", "EUR — Euro"], ["NGN", "NGN — Nigerian naira"], ["CAD", "CAD — Canadian dollar"], ["AUD", "AUD — Australian dollar"]],
    locale: [["en-US", "English (US)"], ["en-GB", "English (UK)"], ["en-NG", "English (Nigeria)"], ["fr-FR", "French"], ["de-DE", "German"]],
  };

  /* ------------------------------------------------------------- fields */
  const F = (key, label, type = "text", extra = {}) => ({ key, label, type, ...extra });
  const half = (key, label, type = "text", extra = {}) => F(key, label, type, { w: "half", ...extra });
  const group = (label, fields, extra = {}) => ({ type: "group", label, fields, ...extra });

  let uid = 0;
  const repDefs = new Map();

  function field(def, base) {
    if (def.type === "group") {
      return `<fieldset class="grp"><legend>${esc(def.label)}</legend>${def.help ? `<p class="help">${esc(def.help)}</p>` : ""}<div class="grid">${def.fields.map((d) => field(d, base)).join("")}</div></fieldset>`;
    }
    const path = base ? `${base}.${def.key}` : def.key;
    const v = get(path);
    const id = "f" + ++uid;
    const rr = def.rerender ? " data-rerender" : "";
    const ph = def.placeholder ? ` placeholder="${esc(def.placeholder)}"` : "";
    let control = "";
    switch (def.type) {
      case "text": case "email": case "url": case "date":
        control = `<input id="${id}" type="${def.type === "url" ? "text" : def.type}" data-path="${path}" data-type="text" value="${esc(v)}"${ph}${rr} />`; break;
      case "number":
        control = `<input id="${id}" type="number" step="${def.step || "any"}" min="${def.min ?? ""}" data-path="${path}" data-type="number" value="${v ?? ""}"${ph}${rr} />`; break;
      case "textarea":
        control = `<textarea id="${id}" rows="${def.rows || 3}" data-path="${path}" data-type="text"${ph}${rr}>${esc(v)}</textarea>`; break;
      case "lines":
        control = `<textarea id="${id}" rows="${def.rows || 4}" data-path="${path}" data-type="lines"${ph}${rr}>${esc((v || []).join("\n"))}</textarea>`; break;
      case "tags":
        control = `<input id="${id}" type="text" data-path="${path}" data-type="tags" value="${esc((v || []).join(", "))}"${ph}${rr} />`; break;
      case "checkbox":
        return `<div class="fld fld--${def.w || "half"} fld--check"><label class="check"><input type="checkbox" data-path="${path}" data-type="bool" ${v ? "checked" : ""}${rr} /><span>${esc(def.label)}</span></label>${def.help ? `<small class="help">${esc(def.help)}</small>` : ""}</div>`;
      case "select": {
        const options = typeof def.options === "function" ? def.options() : def.options;
        const has = options.some(([k]) => String(k) === String(v ?? ""));
        control = `<select id="${id}" data-path="${path}" data-type="text"${rr}>${has || v == null ? "" : `<option value="${esc(v)}" selected>${esc(v)} (missing)</option>`}${options.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v ?? "") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
        break;
      }
      case "color":
        control = `<div class="color"><input type="color" data-path="${path}" data-type="text" value="${esc(v || "#000000")}" aria-label="${esc(def.label)} picker" /><input id="${id}" type="text" data-path="${path}" data-type="text" value="${esc(v)}" /></div>`; break;
      case "image":
        control = imageControl(path, v); break;
      case "images":
        control = imagesControl(path, v || [], def); break;
      case "repeater":
        return repeater(def, path);
      case "object":
        return `<div class="fld fld--${def.w || "full"}"><span class="lbl">${esc(def.label)}</span><div class="grid grid--inner">${def.fields.map((d) => field(d, path)).join("")}</div></div>`;
      default: control = "";
    }
    return `<div class="fld fld--${def.w || "full"}"><label class="lbl" for="${id}">${esc(def.label)}</label>${control}${def.help ? `<small class="help">${esc(def.help)}</small>` : ""}</div>`;
  }

  function thumbURL(v, w = 240, h = 300) { return v ? window.IMG.src(v, w, h) : ""; }

  function imageControl(path, v) {
    return `
      <div class="img" data-img="${path}">
        <div class="img__prev">${v ? `<img src="${esc(thumbURL(v))}" alt="" loading="lazy" />` : `<span>No image</span>`}</div>
        <div class="img__side">
          <input type="text" data-path="${path}" data-type="text" data-rerender value="${esc(v)}" placeholder="Upload, choose from library, or paste an image URL" />
          <div class="img__btns">
            <button type="button" class="btn btn--sm" data-act="upload" data-path="${path}">Upload</button>
            <button type="button" class="btn btn--sm btn--ghost" data-act="library" data-path="${path}">Library</button>
            ${v ? `<button type="button" class="btn btn--sm btn--ghost" data-act="clear-img" data-path="${path}">Remove</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  function imagesControl(path, list, def) {
    return `
      <div class="imgs">
        ${list.map((v, i) => `
          <div class="imgs__item">
            <div class="img__prev">${v ? `<img src="${esc(thumbURL(v))}" alt="" loading="lazy" />` : "<span>Empty</span>"}${i < 2 && def.roles ? `<em>${def.roles[i]}</em>` : ""}</div>
            <div class="imgs__btns">
              <button type="button" class="ic" data-act="img-move" data-path="${path}" data-i="${i}" data-d="-1" ${i === 0 ? "disabled" : ""} title="Move left">←</button>
              <button type="button" class="ic" data-act="library" data-path="${path}.${i}" title="Replace">⇄</button>
              <button type="button" class="ic" data-act="img-move" data-path="${path}" data-i="${i}" data-d="1" ${i === list.length - 1 ? "disabled" : ""} title="Move right">→</button>
              <button type="button" class="ic ic--del" data-act="img-remove" data-path="${path}" data-i="${i}" title="Remove">×</button>
            </div>
          </div>`).join("")}
        <div class="imgs__add">
          <button type="button" class="btn btn--sm" data-act="upload" data-path="${path}" data-append>Upload</button>
          <button type="button" class="btn btn--sm btn--ghost" data-act="library" data-path="${path}" data-append>Library</button>
        </div>
      </div>`;
  }

  function repeater(def, path) {
    const items = get(path) || [];
    repDefs.set(path, def);
    return `
      <div class="fld fld--full">
        ${def.label ? `<span class="lbl">${esc(def.label)}</span>` : ""}
        ${def.help ? `<small class="help">${esc(def.help)}</small>` : ""}
        <div class="rep">
          ${items.map((item, i) => {
            const key = `${path}.${i}`;
            const thumb = def.thumb ? item[def.thumb] : null;
            const open = state.open.has(key) || def.alwaysOpen;
            return `
            <details class="rep__item" data-key="${key}" ${open ? "open" : ""}>
              <summary>
                ${def.thumb ? `<span class="rep__thumb">${thumb ? `<img src="${esc(thumbURL(thumb, 80, 100))}" alt="" />` : ""}</span>` : `<span class="rep__n">${String(i + 1).padStart(2, "0")}</span>`}
                <span class="rep__title">${esc(def.title ? def.title(item, i) : `Item ${i + 1}`) || `<em class="muted">Untitled</em>`}</span>
                <span class="rep__acts">
                  <button type="button" class="ic" data-rep="up" data-path="${path}" data-i="${i}" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
                  <button type="button" class="ic" data-rep="down" data-path="${path}" data-i="${i}" ${i === items.length - 1 ? "disabled" : ""} title="Move down">↓</button>
                  ${def.noDuplicate ? "" : `<button type="button" class="ic" data-rep="dup" data-path="${path}" data-i="${i}" title="Duplicate">⧉</button>`}
                  <button type="button" class="ic ic--del" data-rep="del" data-path="${path}" data-i="${i}" title="Delete">×</button>
                </span>
              </summary>
              <div class="grid">${def.fields.map((d) => field(d, key)).join("")}</div>
            </details>`;
          }).join("")}
        </div>
        <button type="button" class="btn btn--sm btn--ghost rep__add" data-rep="add" data-path="${path}">+ Add ${esc(def.itemLabel || "item")}</button>
      </div>`;
  }

  /* ---------------------------------------------------------- sections */
  const SECTIONS = [
    ["Sales", [["orders", "Orders"]]],
    ["Catalogue", [["products", "Products"], ["collections", "Collections"], ["categories", "Categories"]]],
    ["Pages", [["home", "Homepage"], ["about", "About page"], ["info", "Help & legal pages"], ["faq", "FAQ"]]],
    ["Social", [["testimonials", "Customer stories"], ["social", "Social gallery"]]],
    ["Settings", [["settings", "Brand & store"], ["payments", "Payments"], ["theme", "Colours"], ["backups", "Backups"]]],
  ];
  const sectionLabel = (id) => SECTIONS.flatMap((g) => g[1]).find(([k]) => k === id)?.[1] || "";

  const DEFS = {
    collections: [F("collections", "", "repeater", {
      itemLabel: "collection", thumb: "cover", title: (c) => `${c.name || ""}${c.status === "hidden" ? " (hidden)" : ""}`,
      newItem: () => ({ slug: "new-collection-" + Date.now().toString(36).slice(-4), name: "New Collection", label: "New Collection", status: "hidden", season: "", hero: "", cover: "", intro: "", description: "", notes: [] }),
      fields: [half("name", "Name"), half("slug", "URL slug", "text", { help: "Used in the page address, e.g. /collections/obsidian-series" }), half("label", "Small label", "text", { placeholder: "New Collection" }), half("season", "Season", "text", { placeholder: "AW26" }), half("status", "Visibility", "select", { options: opt.colStatus }), half("intro", "Short intro"), F("cover", "Cover image (cards and homepage)", "image"), F("hero", "Wide banner image (collection page)", "image"), F("description", "Description", "textarea", { rows: 4 }), F("notes", "Highlights", "tags", { help: "Comma separated, e.g. 12 pieces, Small-batch run" })],
    })],
    categories: [F("categories", "", "repeater", {
      itemLabel: "category", thumb: "image", title: (c) => c.name,
      help: "“Department” categories (Women, Men) filter by who a product is for. The rest filter by product type.",
      newItem: () => ({ slug: "new-category", name: "New Category", type: "category", image: "", description: "" }),
      fields: [half("name", "Name"), half("slug", "URL slug"), half("type", "Type", "select", { options: opt.catType }), half("description", "Short description"), F("image", "Image", "image")],
    })],
    faq: [F("faq", "", "repeater", {
      itemLabel: "question", title: (q) => q.question, noDuplicate: true,
      newItem: () => ({ question: "New question", answer: "" }),
      fields: [F("question", "Question"), F("answer", "Answer", "textarea", { rows: 4 })],
    })],
    testimonials: [F("testimonials", "", "repeater", {
      itemLabel: "story", thumb: "image", title: (t) => "@" + (t.username || ""),
      newItem: () => ({ name: "", username: "username", profileImage: "", image: "", review: "", likes: 0, comments: 0, date: "Just now", product: "" }),
      fields: [half("name", "Customer name"), half("username", "Username (without @)"), F("review", "Review", "textarea"), F("image", "Post photo", "image"), F("profileImage", "Profile photo", "image"), half("likes", "Likes", "number", { min: 0, step: 1 }), half("comments", "Comments", "number", { min: 0, step: 1 }), half("date", "Posted", "text", { placeholder: "2 days ago" }), half("product", "Product worn", "select", { options: opt.products })],
    })],
    social: [F("social", "", "repeater", {
      itemLabel: "photo", thumb: "image", title: (s) => s.caption, help: "The first 8 photos appear in the homepage gallery.",
      newItem: () => ({ image: "", caption: "" }),
      fields: [F("image", "Photo", "image"), F("caption", "Caption")],
    })],
    home: [
      group("Hero", [half("heroKicker", "Small label (left)"), half("heroKicker2", "Small label 2"), F("heroMeta", "Small label (right)"), F("heroTitle", "Headline", "textarea", { rows: 3, help: "Each line becomes one line of the headline." }), F("heroSub", "Supporting text", "textarea", { rows: 2 }), F("heroImage", "Desktop image (landscape)", "image"), F("heroImageMobile", "Mobile image (portrait)", "image"), F("heroAlt", "Image description (for accessibility)"),
        F("ctaPrimary", "Main button", "object", { fields: [half("label", "Text"), half("href", "Link", "text", { placeholder: "#/shop?new=1" })] }),
        F("ctaSecondary", "Second button", "object", { fields: [half("label", "Text"), half("href", "Link")] })]),
      group("Brand statement", [F("statementLabel", "Small label"), F("statementTitle", "Headline", "textarea", { rows: 2 }), F("statementAccent", "Highlighted word(s)", "text", { help: "Shown in the accent colour at the end of the headline." }), F("statementLead", "Intro paragraph", "textarea"), F("statementBody", "Paragraph", "textarea", { rows: 4 }), F("statementImage", "Image", "image"),
        F("facts", "Numbers", "repeater", { itemLabel: "number", title: (f) => `${f.value || ""}${f.unit || ""} — ${f.label || ""}`, noDuplicate: true, newItem: () => ({ label: "", value: "", unit: "" }), fields: [F("label", "Label", "text", { w: "half" }), F("value", "Value", "text", { w: "half" }), F("unit", "Unit (optional)", "text", { w: "half" })] })]),
      group("Section titles", [half("categoriesTitle", "Categories"), half("dropTitle", "Collections showcase"), half("dropCollections.0", "Showcase collection 1", "select", { options: opt.collections }), half("dropCollections.1", "Showcase collection 2", "select", { options: opt.collections }), half("featuredTitle", "Featured products"), half("storiesTitle", "Customer stories"), F("faqTitle", "FAQ title", "textarea", { rows: 2 })]),
      group("Contact & newsletter", [half("contactTitle", "Contact title"), half("newsletterTitle", "Newsletter title"), F("contactIntro", "Contact form intro"), F("newsletterText", "Newsletter text")]),
    ],
    about: [
      group("Opening", [F("kicker", "Small label"), F("title", "Headline", "textarea", { rows: 2, help: "Each line becomes one line of the headline." })]),
      group("Story", [F("storyLead", "Intro paragraph", "textarea"), F("storyBody", "Paragraph", "textarea", { rows: 5 }), F("storyImage", "Main image", "image"), F("storyDetailImage", "Detail image", "image")]),
      group("Full-width quote", [F("quote", "Quote", "textarea", { rows: 2 }), F("quoteImage", "Background image", "image")]),
      group("Principles", [F("principlesTitle", "Title"), F("principles", "", "repeater", { itemLabel: "principle", title: (p) => p.title, noDuplicate: true, newItem: () => ({ title: "", body: "" }), fields: [F("title", "Title"), F("body", "Text", "textarea")] })]),
      group("Quality statement", [F("qualityTitle", "Headline", "textarea", { rows: 2 }), F("qualityBody", "Paragraph", "textarea", { rows: 4 }), F("stats", "Numbers", "repeater", { itemLabel: "number", title: (s) => `${s.value} — ${s.label}`, noDuplicate: true, newItem: () => ({ label: "", value: "" }), fields: [half("label", "Label"), half("value", "Value")] })]),
      group("Campaign gallery", [F("galleryTitle", "Title"), F("gallery", "Photos (up to 4)", "images")]),
    ],
    settings: [
      group("Brand", [half("name", "Brand name"), half("legalName", "Legal name"), F("tagline", "Tagline"), F("description", "Short description", "textarea", { help: "Used in the footer and for search engines." }), half("url", "Website address", "text", { placeholder: "https://…" }), half("email", "Contact email", "email")]),
      group("Announcement bar", [F("announcement", "", "object", { fields: [half("text", "Message"), half("cta", "Link text"), half("href", "Link", "text", { placeholder: "#/shop?new=1" })] })]),
      group("Studio & contact", [F("location", "", "object", { fields: [half("line1", "Address line 1"), half("line2", "Address line 2"), half("est", "Established")] }), F("hours", "", "object", { fields: [half("days", "Opening days"), half("time", "Opening hours")] })]),
      group("Social", [half("social", "Handle", "text", { placeholder: "@strata.studio" }), F("socialLinks", "", "object", { fields: [half("instagram", "Instagram link"), half("tiktok", "TikTok link"), half("pinterest", "Pinterest link"), half("youtube", "YouTube link")] })]),
      group("Store", [half("currency", "Currency", "select", { options: opt.currency }), half("locale", "Number & date format", "select", { options: opt.locale }), half("freeShippingThreshold", "Free shipping over", "number", { min: 0 }),
        F("shippingRates", "Shipping options", "repeater", { itemLabel: "shipping option", title: (r) => `${r.label} — ${r.price}`, noDuplicate: true, newItem: () => ({ id: "option-" + Date.now().toString(36).slice(-4), label: "", eta: "", price: 0 }), fields: [half("label", "Name"), half("eta", "Delivery time"), half("price", "Price", "number", { min: 0 }), half("id", "ID", "text", { help: "Internal, keep unique." })] })]),
    ],
    theme: [
      group("Colours", [half("accent", "Accent", "color", { help: "Highlights, sale prices, badges." }), half("bg", "Background", "color"), half("ink", "Text", "color"), half("muted", "Secondary text", "color"), half("dark", "Dark sections", "color")]),
      group("Photography", [F("monochrome", "Show all photos in black & white", "checkbox", { w: "full", help: "Gives every image the same campaign grade. Untick to show photos in full colour." })]),
    ],
  };
  const BASE = { home: "pages.home", about: "pages.about", settings: "settings", theme: "theme" };

  /* ---------------------------------------------------------- products */
  const PRESETS = { apparel: ["XS", "S", "M", "L", "XL", "XXL"], footwear: ["39", "40", "41", "42", "43", "44", "45"], one: ["OS"] };

  function newProduct() {
    return {
      slug: "", sku: "ST-" + Date.now().toString(36).toUpperCase().slice(-5), name: "", published: false,
      price: 0, salePrice: null, category: opt.categories()[0]?.[0] || "", collection: opt.collections()[0]?.[0] || "", gender: "unisex",
      status: "NEW", featured: false, newArrival: true, bestSeller: false, createdAt: new Date().toISOString().slice(0, 10),
      images: [], sizes: PRESETS.apparel.slice(), colors: [{ name: "Black", hex: "#141413" }], stock: {},
      description: "", details: [], materials: "", fit: "", care: "",
    };
  }

  const stockTotal = (p) => (p.colors || []).reduce((a, c) => a + (p.sizes || []).reduce((b, s) => b + (parseInt((p.stock || {})[`${c.name}|${s}`], 10) || 0), 0), 0);
  const money = (n) => { try { return new Intl.NumberFormat(state.content.settings.locale || "en-US", { style: "currency", currency: state.content.settings.currency || "USD", maximumFractionDigits: 0 }).format(n || 0); } catch { return n; } };

  function productsList() {
    const q = state.search.toLowerCase();
    const rows = state.content.products.map((p, i) => ({ p, i })).filter(({ p }) => !q || [p.name, p.slug, p.category, p.collection, p.sku].join(" ").toLowerCase().includes(q));
    return `
      <div class="toolbar">
        <input type="search" class="search" placeholder="Search products" value="${esc(state.search)}" data-search />
        <span class="muted">${state.content.products.length} products · ${state.content.products.filter((p) => p.published !== false).length} live</span>
        <button class="btn" data-act="new-product">+ New product</button>
      </div>
      <div class="table">
        <div class="tr th"><span></span><span>Product</span><span>Price</span><span>Stock</span><span>Badge</span><span>Live</span><span></span></div>
        ${rows.map(({ p, i }) => {
          const st = stockTotal(p);
          return `
          <div class="tr ${p.published === false ? "is-draft" : ""}">
            <span class="thumb">${p.images?.[0] ? `<img src="${esc(thumbURL(p.images[0], 80, 106))}" alt="" loading="lazy" />` : ""}</span>
            <span><button class="link" data-act="edit-product" data-i="${i}">${esc(p.name || "Untitled product")}</button><small class="muted">${esc(p.category)} · ${esc(p.collection)}</small></span>
            <span>${p.salePrice ? `<s class="muted">${money(p.price)}</s> <b class="accent">${money(p.salePrice)}</b>` : money(p.price)}</span>
            <span class="${st === 0 ? "accent" : st < 10 ? "warn" : ""}">${st === 0 ? "Sold out" : st}</span>
            <span>${p.status ? `<em class="badge">${esc(p.status)}</em>` : ""}</span>
            <span><label class="switch" title="Show on site"><input type="checkbox" data-path="products.${i}.published" data-type="bool" ${p.published !== false ? "checked" : ""} data-rerender /><i></i></label></span>
            <span class="row-acts">
              <button class="ic" data-act="move-product" data-i="${i}" data-d="-1" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
              <button class="ic" data-act="move-product" data-i="${i}" data-d="1" ${i === state.content.products.length - 1 ? "disabled" : ""} title="Move down">↓</button>
              <button class="ic" data-act="dup-product" data-i="${i}" title="Duplicate">⧉</button>
              <button class="ic ic--del" data-act="del-product" data-i="${i}" title="Delete">×</button>
            </span>
          </div>`;
        }).join("") || `<p class="empty">No products match “${esc(state.search)}”.</p>`}
      </div>
      <p class="help">Order here is the order products appear in the shop under “Featured”. Unticking “Live” hides a product without deleting it.</p>`;
  }

  function productEditor(i) {
    const p = state.content.products[i];
    const base = `products.${i}`;
    const sizes = p.sizes || [];
    const colors = p.colors || [];
    const stockGrid = `
      <div class="fld fld--full">
        <span class="lbl">Stock per colour and size</span>
        ${colors.length && sizes.length ? `
        <div class="stock">
          <table>
            <thead><tr><th></th>${sizes.map((s) => `<th>${esc(s)}</th>`).join("")}<th>Total</th></tr></thead>
            <tbody>${colors.map((c) => {
              const tot = sizes.reduce((a, s) => a + (parseInt((p.stock || {})[`${c.name}|${s}`], 10) || 0), 0);
              return `<tr><th><i class="dot" style="background:${esc(c.hex)}"></i>${esc(c.name)}</th>${sizes.map((s) => `<td><input type="number" min="0" step="1" data-stock="${i}" data-key="${esc(c.name)}|${esc(s)}" value="${parseInt((p.stock || {})[`${c.name}|${s}`], 10) || 0}" /></td>`).join("")}<td class="tot">${tot}</td></tr>`;
            }).join("")}</tbody>
          </table>
        </div>
        <div class="stock__bulk"><span class="muted">Set every size to</span><input type="number" min="0" step="1" value="10" data-bulk /><button type="button" class="btn btn--sm btn--ghost" data-act="bulk-stock" data-i="${i}">Apply</button></div>` : `<p class="help">Add at least one size and one colour.</p>`}
      </div>`;
    return `
      <div class="toolbar">
        <button class="btn btn--ghost btn--sm" data-act="back">← All products</button>
        <span class="muted">${p.published === false ? "Draft — not visible on the site" : "Live on the site"}</span>
        ${p.slug ? `<a class="btn btn--ghost btn--sm" href="/#/product/${esc(p.slug)}" target="_blank" rel="noopener">View on site ↗</a>` : ""}
      </div>
      <form class="form" onsubmit="return false">
        ${field(group("Basics", [
          half("name", "Product name"), half("slug", "URL slug", "text", { help: "Filled in from the name. Lowercase letters, numbers and dashes." }),
          half("price", "Price", "number", { min: 0 }), half("salePrice", "Sale price", "number", { min: 0, help: "Leave empty when not on sale." }),
          half("category", "Category", "select", { options: opt.categories }), half("collection", "Collection", "select", { options: opt.collections }),
          half("gender", "Department", "select", { options: opt.gender }), half("status", "Badge", "select", { options: opt.status }),
          half("sku", "SKU prefix"), half("createdAt", "Release date", "date", { help: "Used for “Newest” sorting." }),
          F("published", "Live on the site", "checkbox"), F("featured", "Show in “Featured” on the homepage", "checkbox"),
          F("newArrival", "Include in New Arrivals", "checkbox"), F("bestSeller", "Include in Best Sellers", "checkbox"),
        ]), base)}
        ${field(group("Photos", [F("images", "", "images", { roles: ["Main", "On hover"] })], { help: "The first photo is the main image; the second appears when shoppers hover. Portrait photos (3:4) work best." }), base)}
        ${field(group("Description", [
          F("description", "Description", "textarea", { rows: 3 }),
          F("details", "Product details", "lines", { help: "One detail per line." }),
          F("materials", "Materials", "textarea", { rows: 2 }), F("fit", "Fit", "textarea", { rows: 2 }), F("care", "Care instructions", "textarea", { rows: 2 }),
        ]), base)}
        <fieldset class="grp"><legend>Sizes, colours & stock</legend>
          <div class="grid">
            ${field(F("sizes", "Sizes", "tags", { rerender: true, help: "Comma separated, in the order they should appear." }), base)}
            <div class="fld fld--full presets"><span class="muted">Presets:</span>
              <button type="button" class="btn btn--sm btn--ghost" data-act="preset" data-i="${i}" data-p="apparel">XS – XXL</button>
              <button type="button" class="btn btn--sm btn--ghost" data-act="preset" data-i="${i}" data-p="footwear">EU 39 – 45</button>
              <button type="button" class="btn btn--sm btn--ghost" data-act="preset" data-i="${i}" data-p="one">One size</button>
            </div>
            ${field(F("colors", "Colours", "repeater", { itemLabel: "colour", alwaysOpen: true, noDuplicate: true, title: (c) => c.name, newItem: () => ({ name: "New colour", hex: "#888888" }), fields: [half("name", "Colour name", "text", { rerender: true }), half("hex", "Swatch", "color", { rerender: true })] }), base)}
            ${stockGrid}
          </div>
        </fieldset>
        <div class="danger"><button type="button" class="btn btn--ghost btn--danger btn--sm" data-act="del-product" data-i="${i}">Delete this product</button></div>
      </form>`;
  }

  /* --------------------------------------------------------- info pages */
  function infoEditor() {
    const pages = state.content.pages.info || {};
    return Object.keys(pages).map((k) => field(group(pages[k].title || k, [
      F("title", "Page title"),
      F("blocks", "Sections", "repeater", { itemLabel: "section", title: (b) => b.heading, noDuplicate: true, newItem: () => ({ heading: "", body: "" }), fields: [F("heading", "Heading"), F("body", "Text", "textarea", { rows: 3 })] }),
    ], { help: `Page address: /#/info/${k}` }), `pages.info.${k}`)).join("");
  }

  /* ------------------------------------------------------------ backups */
  function backupsView() {
    return `
      <fieldset class="grp"><legend>Export & import</legend>
        <p class="help">Download everything as one file for safekeeping, or load a file you downloaded earlier.</p>
        <div class="row">
          <button class="btn btn--ghost" data-act="export">Download backup (.json)</button>
          <label class="btn btn--ghost">Load from file<input type="file" accept="application/json,.json" data-import hidden /></label>
          <button class="btn btn--ghost" data-act="reset">Load original demo content</button>
        </div>
        <p class="help">Loading a file only changes this editor. Nothing goes live until you press “Save & publish”.</p>
      </fieldset>
      <fieldset class="grp"><legend>Previous versions</legend>
        <p class="help">A copy is kept every time you publish.</p>
        <div data-backups>${state.mode === "local" ? `<p class="muted">Available once the admin runs on Vercel.</p>` : `<p class="muted">Loading…</p>`}</div>
      </fieldset>`;
  }
  async function loadBackups() {
    const box = $("[data-backups]");
    if (!box || state.mode === "local") return;
    try {
      const { backups } = await api("/api/content?backups=1");
      box.innerHTML = backups.length
        ? `<ul class="backups">${backups.map((b) => `<li><span>${new Date(b.uploadedAt).toLocaleString()}</span><span class="muted">${Math.round(b.size / 1024)} KB</span><button class="btn btn--sm btn--ghost" data-act="restore" data-url="${esc(b.url)}">Load this version</button></li>`).join("")}</ul>`
        : `<p class="muted">No saved versions yet.</p>`;
    } catch (e) { box.innerHTML = `<p class="accent">${esc(e.message)}</p>`; }
  }

  /* ------------------------------------------------------------- orders */
  const STATUS = {
    awaiting_payment: ["Awaiting payment", "st--wait"], new: ["New — unpaid", "st--new"], paid: ["Paid — to pack", "st--todo"],
    processing: ["Processing", "st--todo"], shipped: ["Shipped", "st--ship"], delivered: ["Delivered", "st--done"], cancelled: ["Cancelled", "st--off"],
  };
  const FILTERS = [
    ["todo", "To fulfil", (o) => ["new", "paid", "processing"].includes(o.status)],
    ["awaiting_payment", "Awaiting payment", (o) => o.status === "awaiting_payment"],
    ["shipped", "Shipped", (o) => o.status === "shipped"],
    ["delivered", "Delivered", (o) => o.status === "delivered"],
    ["cancelled", "Cancelled", (o) => o.status === "cancelled"],
    ["all", "All", () => true],
  ];
  const oMoney = (n, cur) => { try { return new Intl.NumberFormat(state.content.settings.locale || "en-US", { style: "currency", currency: cur || state.content.settings.currency || "USD" }).format(n || 0); } catch { return `${cur} ${n}`; } };
  const when = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const badge = (st) => { const [l, c] = STATUS[st] || [st, ""]; return `<em class="st ${c}">${esc(l)}</em>`; };

  async function loadOrders() {
    try { state.orders = (await api("/api/orders")).orders; }
    catch (e) { state.orders = []; toast(e.message); if (e.status === 401) return showLogin(); }
    if (state.section === "orders") render();
  }

  function ordersView() {
    if (state.mode === "local") return `<p class="empty">Orders appear here once the site runs on Vercel with storage connected.</p>`;
    if (!state.orders) return `<p class="empty">Loading orders…</p>`;
    const all = state.orders;
    const since = Date.now() - 30 * 864e5;
    const paid30 = all.filter((o) => o.payment?.status === "paid" && new Date(o.createdAt) > since && o.status !== "cancelled");
    const cur = all[0]?.currency;
    const f = FILTERS.find(([k]) => k === state.orderFilter) || FILTERS[0];
    const q = state.orderSearch.toLowerCase();
    const rows = all.filter(f[2]).filter((o) => !q || [o.id, o.customer.email, o.customer.first, o.customer.last].join(" ").toLowerCase().includes(q));
    return `
      <div class="cards">
        <div class="card"><span class="lbl">To fulfil</span><b>${all.filter(FILTERS[0][2]).length}</b></div>
        <div class="card"><span class="lbl">Awaiting payment</span><b>${all.filter(FILTERS[1][2]).length}</b></div>
        <div class="card"><span class="lbl">Paid, last 30 days</span><b>${oMoney(paid30.reduce((a, o) => a + o.total, 0), cur)}</b></div>
        <div class="card"><span class="lbl">Orders, last 30 days</span><b>${paid30.length}</b></div>
      </div>
      <div class="toolbar">
        <div class="seg">${FILTERS.map(([k, l, fn]) => `<button class="${k === f[0] ? "is-on" : ""}" data-ofilter="${k}">${l} <small>${all.filter(fn).length}</small></button>`).join("")}</div>
        <input type="search" class="search" placeholder="Search order #, name or email" value="${esc(state.orderSearch)}" data-osearch />
        <button class="btn btn--ghost btn--sm" data-act="orders-refresh">Refresh</button>
        <button class="btn btn--ghost btn--sm" data-act="orders-csv">Export CSV</button>
      </div>
      <div class="table otable">
        <div class="tr th"><span>Order</span><span>Date</span><span>Customer</span><span>Items</span><span>Total</span><span>Status</span></div>
        ${rows.map((o) => `
          <button class="tr" data-act="open-order" data-id="${esc(o.id)}">
            <span><b>#${esc(o.id)}</b></span>
            <span class="muted">${when(o.createdAt)}</span>
            <span>${esc(o.customer.first)} ${esc(o.customer.last)}<small class="muted">${esc(o.customer.email)}</small></span>
            <span>${o.lines.reduce((a, l) => a + l.qty, 0)}</span>
            <span>${oMoney(o.total, o.currency)}${o.payment?.status === "paid" ? "" : `<small class="muted">unpaid</small>`}</span>
            <span>${badge(o.status)}</span>
          </button>`).join("") || `<p class="empty">${all.length ? "No orders here." : "No orders yet. They'll appear here as soon as customers check out."}</p>`}
      </div>`;
  }

  function orderDetail(o) {
    const can = { restock: o.stockDeducted };
    return `
      <div class="toolbar">
        <button class="btn btn--ghost btn--sm" data-act="orders-back">← All orders</button>
        ${badge(o.status)}
        <span class="muted">Placed ${when(o.createdAt)}</span>
      </div>
      <div class="odetail">
        <div>
          <fieldset class="grp"><legend>Items</legend>
            <ul class="olines">${o.lines.map((l) => `
              <li><span class="thumb">${l.image ? `<img src="${esc(thumbURL(l.image, 80, 106))}" alt="" />` : ""}</span>
                <span><b>${esc(l.name)}</b><small class="muted">${esc(l.color)} / ${esc(l.size)} · ${oMoney(l.price, o.currency)} × ${l.qty}</small></span>
                <span>${oMoney(l.price * l.qty, o.currency)}</span></li>`).join("")}</ul>
            <dl class="otot">
              <div><dt>Subtotal</dt><dd>${oMoney(o.subtotal, o.currency)}</dd></div>
              <div><dt>Shipping — ${esc(o.shipping.label)}</dt><dd>${o.shipping.price ? oMoney(o.shipping.price, o.currency) : "Free"}</dd></div>
              <div class="otot__g"><dt>Total</dt><dd>${oMoney(o.total, o.currency)}</dd></div>
            </dl>
          </fieldset>
          <fieldset class="grp"><legend>Payment</legend>
            ${o.payment?.status === "paid"
              ? `<p><b>Paid</b> via ${esc(o.payment.provider === "manual" ? "manual record" : o.payment.provider)} · ${when(o.payment.paidAt)}</p><p class="muted small">Reference: ${esc(o.payment.reference || "—")}${o.payment.channel ? ` · ${esc(o.payment.channel)}` : ""}</p>`
              : `<p><b>Not paid.</b> ${o.payment?.provider && o.payment.provider !== "none" ? `The customer was sent to ${esc(o.payment.provider)} but hasn't completed payment.` : "This order was placed without online payment."}</p>
                 <div class="row"><input type="text" placeholder="Payment reference (optional)" data-pay-ref /><button class="btn btn--sm" data-act="order-mark-paid">Mark as paid</button></div>
                 <p class="help">Use this if the customer paid another way, e.g. bank transfer. Stock is taken when an order is marked paid.</p>`}
          </fieldset>
          <fieldset class="grp"><legend>History</legend>
            <ul class="ohist">${(o.history || []).slice().reverse().map((h) => `<li><span>${badge(h.status)}</span><span>${esc(h.note || "")}</span><span class="muted">${when(h.at)} · ${esc(h.by)}</span></li>`).join("")}</ul>
          </fieldset>
        </div>
        <div>
          <fieldset class="grp"><legend>Customer</legend>
            <p><b>${esc(o.customer.first)} ${esc(o.customer.last)}</b></p>
            <p><a href="mailto:${esc(o.customer.email)}?subject=${encodeURIComponent(`Your order #${o.id}`)}">${esc(o.customer.email)}</a></p>
            ${o.customer.phone ? `<p><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></p>` : ""}
            ${o.customer.marketing ? `<p class="muted small">Opted in to marketing emails</p>` : ""}
            <p class="lbl" style="margin-top:14px">Ship to</p>
            <p>${esc(o.shippingAddress.line1)}<br/>${esc(o.shippingAddress.city)} ${esc(o.shippingAddress.zip)}<br/>${esc(o.shippingAddress.country)}</p>
            <p class="muted small">${esc(o.shipping.label)}${o.shipping.eta ? ` — ${esc(o.shipping.eta)}` : ""}</p>
          </fieldset>
          <fieldset class="grp" data-ofrm><legend>Update order</legend>
            <div class="grid">
              <div class="fld fld--full"><label class="lbl">Status</label>
                <select data-o="status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${l}</option>`).join("")}</select></div>
              ${can.restock ? `<div class="fld fld--full fld--check"><label class="check"><input type="checkbox" data-o="restock" checked /><span>If cancelling, put items back in stock</span></label></div>` : ""}
              <div class="fld fld--half"><label class="lbl">Carrier</label><input type="text" data-o="carrier" value="${esc(o.tracking?.carrier)}" placeholder="DHL, GIG, UPS…" /></div>
              <div class="fld fld--half"><label class="lbl">Tracking number</label><input type="text" data-o="number" value="${esc(o.tracking?.number)}" /></div>
              <div class="fld fld--full"><label class="lbl">Tracking link</label><input type="text" data-o="url" value="${esc(o.tracking?.url)}" placeholder="https://…" /></div>
              <div class="fld fld--full"><label class="lbl">Internal notes</label><textarea rows="3" data-o="notes">${esc(o.notes)}</textarea></div>
            </div>
            <button class="btn btn--full" data-act="order-save" style="margin-top:16px">Update order</button>
            <p class="help">The customer sees the status and tracking on their order page.</p>
          </fieldset>
        </div>
      </div>`;
  }

  async function patchOrder(body) {
    try {
      const { order } = await api("/api/orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: state.order.id, ...body }) });
      state.order = order;
      const i = state.orders?.findIndex((x) => x.id === order.id);
      if (i >= 0) state.orders[i] = order;
      toast("Order updated"); render();
    } catch (e) { if (e.status === 401) return showLogin(); alert(e.message); }
  }

  function ordersCSV() {
    const rows = [["Order", "Date", "Status", "Paid", "Name", "Email", "Phone", "Address", "City", "Postcode", "Country", "Items", "Subtotal", "Shipping", "Total", "Currency", "Carrier", "Tracking"]];
    for (const o of state.orders || []) rows.push([o.id, o.createdAt, o.status, o.payment?.status === "paid" ? "yes" : "no", `${o.customer.first} ${o.customer.last}`, o.customer.email, o.customer.phone, o.shippingAddress.line1, o.shippingAddress.city, o.shippingAddress.zip, o.shippingAddress.country, o.lines.map((l) => `${l.qty}x ${l.name} (${l.color}/${l.size})`).join("; "), o.subtotal, o.shipping.price, o.total, o.currency, o.tracking?.carrier, o.tracking?.number]);
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  /* ----------------------------------------------------------- payments */
  async function loadPayments() {
    try { state.payments = await api("/api/payments"); }
    catch (e) { state.payments = { error: e.message }; if (e.status === 401) return showLogin(); }
    if (state.section === "payments") render();
  }

  function paymentsView() {
    if (state.mode === "local") return `<p class="empty">Payment setup is available once the site runs on Vercel.</p>`;
    const P = state.payments;
    if (!P) return `<p class="empty">Loading…</p>`;
    if (P.error) return `<p class="empty accent">${esc(P.error)}</p>`;
    const cur = (state.content.settings.currency || "USD").toUpperCase();
    const modeTag = (m) => (m ? `<em class="st ${m === "live" ? "st--done" : "st--wait"}">${m === "live" ? "Live keys" : "Test keys"}</em>` : "");
    const copy = (url) => `<div class="copy"><input type="text" readonly value="${esc(url)}" /><button type="button" class="btn btn--sm btn--ghost" data-act="copy" data-v="${esc(url)}">Copy</button></div>`;
    const choice = (k, title, text) => `<label class="choice ${P.provider === k ? "is-on" : ""}"><input type="radio" name="provider" value="${k}" ${P.provider === k ? "checked" : ""} data-pprov /><span><b>${title}</b><small>${text}</small></span></label>`;
    return `
      ${P.unreadable ? `<div class="notice">Saved payment keys couldn't be read (the storage token or ENCRYPTION_KEY changed). Please enter your keys again.</div>` : ""}
      <fieldset class="grp"><legend>How customers pay</legend>
        <div class="choices">
          ${choice("none", "No online payment", "Orders come in unpaid. You arrange payment with the customer, then mark the order as paid.")}
          ${choice("paystack", "Paystack", "Cards, bank transfer and USSD. Best for Nigeria, Ghana, South Africa and Kenya.")}
          ${choice("stripe", "Stripe", "Cards, Apple Pay and Google Pay. Best for the US, UK, Europe and most other countries.")}
        </div>
      </fieldset>

      <fieldset class="grp"><legend>Paystack ${modeTag(P.paystack.mode)}</legend>
        ${!P.currencies.paystack.includes(cur) ? `<p class="notice notice--in">Your store currency is ${esc(cur)}. Paystack only takes ${P.currencies.paystack.join(", ")} — change the currency under Brand & store to use Paystack.</p>` : ""}
        <ol class="steps">
          <li>In your <a href="https://dashboard.paystack.com/#/settings/developers" target="_blank" rel="noopener">Paystack dashboard</a>, open <b>Settings → API Keys & Webhooks</b>.</li>
          <li>Copy your <b>Secret key</b> into the box below. Start with the <b>test</b> key (sk_test_…) and switch to the live key when you're ready.</li>
          <li>Paste this address into <b>Webhook URL</b> on the same page and save:</li>
        </ol>
        ${copy(P.webhooks.paystack)}
        <div class="grid" style="margin-top:16px">
          <div class="fld fld--full"><label class="lbl">Secret key</label><input type="password" autocomplete="off" data-pkey="paystack.secretKey" placeholder="${P.paystack.configured ? `Saved: ${esc(P.paystack.secretKey)} — paste a new key to replace it` : "sk_test_… or sk_live_…"}" /></div>
          <div class="fld fld--full"><label class="lbl">Public key (optional)</label><input type="text" autocomplete="off" data-pkey="paystack.publicKey" placeholder="${esc(P.paystack.publicKey || "pk_test_… or pk_live_…")}" /></div>
        </div>
        ${P.paystack.configured ? `<div class="row"><button class="btn btn--sm btn--ghost" data-act="pay-test" data-p="paystack">Test connection</button><button class="btn btn--sm btn--ghost btn--danger" data-act="pay-clear" data-p="paystack">Remove Paystack keys</button></div>` : ""}
      </fieldset>

      <fieldset class="grp"><legend>Stripe ${modeTag(P.stripe.mode)}</legend>
        <ol class="steps">
          <li>In your <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener">Stripe dashboard</a>, open <b>Developers → API keys</b> and copy the <b>Secret key</b> into the box below. Start in test mode (sk_test_…).</li>
          <li>Open <b>Developers → Webhooks → Add endpoint</b> and paste this address:</li>
        </ol>
        ${copy(P.webhooks.stripe)}
        <ol class="steps" start="3">
          <li>Choose the events <code>checkout.session.completed</code> and <code>checkout.session.async_payment_succeeded</code>, save, then copy the <b>Signing secret</b> (whsec_…) into the box below.</li>
        </ol>
        <div class="grid" style="margin-top:16px">
          <div class="fld fld--full"><label class="lbl">Secret key</label><input type="password" autocomplete="off" data-pkey="stripe.secretKey" placeholder="${P.stripe.configured ? `Saved: ${esc(P.stripe.secretKey)} — paste a new key to replace it` : "sk_test_… or sk_live_…"}" /></div>
          <div class="fld fld--full"><label class="lbl">Webhook signing secret</label><input type="password" autocomplete="off" data-pkey="stripe.webhookSecret" placeholder="${P.stripe.webhookConfigured ? "Saved — paste a new secret to replace it" : "whsec_…"}" /></div>
        </div>
        ${P.stripe.configured ? `<div class="row"><button class="btn btn--sm btn--ghost" data-act="pay-test" data-p="stripe">Test connection</button><button class="btn btn--sm btn--ghost btn--danger" data-act="pay-clear" data-p="stripe">Remove Stripe keys</button></div>` : ""}
      </fieldset>

      <div class="savebar"><button class="btn" data-act="pay-save">Save payment settings</button><span class="muted">Keys are encrypted and never shown again after saving.</span></div>`;
  }

  async function savePayments(extra = {}) {
    const body = { provider: $("[data-pprov]:checked")?.value, paystack: {}, stripe: {}, ...extra };
    $$("[data-pkey]").forEach((el) => { const [p, k] = el.dataset.pkey.split("."); if (el.value.trim()) body[p][k] = el.value.trim(); });
    try {
      state.payments = await api("/api/payments", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      toast("Payment settings saved"); render();
    } catch (e) { if (e.status === 401) return showLogin(); alert(e.message); }
  }

  /* ------------------------------------------------------------- render */
  function shell(inner) {
    const sec = state.section;
    const title = state.edit ? (state.content.products[state.edit.i]?.name || "New product") : state.order ? `Order #${state.order.id}` : sectionLabel(sec);
    const noPublish = (sec === "orders" || sec === "payments") && !isDirty();
    return `
      <div class="layout">
        <aside class="side">
          <a class="brand" href="/" target="_blank" rel="noopener">${esc(state.content.settings.name || "STRATA")}<small>Admin</small></a>
          <nav>${SECTIONS.map(([g, items]) => `<p class="side__g">${g}</p>${items.map(([k, l]) => `<button class="side__a ${k === sec ? "is-on" : ""}" data-nav="${k}">${l}</button>`).join("")}`).join("")}</nav>
          <div class="side__foot">
            <a href="/" target="_blank" rel="noopener">View site ↗</a>
            ${state.mode === "live" ? `<button data-act="logout">Sign out</button>` : ""}
          </div>
        </aside>
        <main class="main">
          <header class="top">
            <button class="ic menu" data-act="menu" aria-label="Menu">☰</button>
            <h1>${esc(title)}</h1>
            <span class="pill" data-dirty hidden>Unsaved changes</span>
            <div class="top__acts">
              ${state.mode === "local"
                ? `<span class="pill pill--warn" title="The admin API isn't available here">Local preview</span><button class="btn" data-act="export">Download content.json</button>`
                : noPublish ? "" : `<button class="btn" data-act="save">${state.saving ? "Publishing…" : "Save & publish"}</button>`}
            </div>
          </header>
          ${state.mode === "live" && state.auth.storage === false ? `<div class="notice">Storage isn't connected yet, so changes can't be published. In Vercel open <b>Storage → Create → Blob</b>, connect it to this project, then redeploy.</div>` : ""}
          ${state.mode === "local" ? `<div class="notice">You're viewing the admin without its server, so publishing is off. Edits can be downloaded as <code>content.json</code> — replace <code>data/content.json</code> with it. On Vercel, this becomes one-click publishing.</div>` : ""}
          <div class="content" data-content>${inner}</div>
        </main>
      </div>`;
  }

  function render() {
    uid = 0; repDefs.clear();
    const scroll = $("[data-content]")?.scrollTop || 0;
    const winScroll = scrollY;
    let inner = "";
    const s = state.section;
    if (s === "products") inner = state.edit ? productEditor(state.edit.i) : productsList();
    else if (s === "orders") inner = state.order ? orderDetail(state.order) : ordersView();
    else if (s === "payments") inner = paymentsView();
    else if (s === "info") inner = infoEditor();
    else if (s === "backups") inner = backupsView();
    else inner = `<form class="form" onsubmit="return false">${DEFS[s].map((d) => field(d, BASE[s] || "")).join("")}</form>`;
    if (s === "theme") inner += themePreview();
    app.className = "";
    app.innerHTML = shell(inner);
    const c = $("[data-content]"); if (c) c.scrollTop = scroll;
    scrollTo(0, winScroll);
    updateDirty();
    if (s === "backups") loadBackups();
    if (s === "orders" && !state.orders && state.mode === "live") loadOrders();
    if (s === "payments" && !state.payments && state.mode === "live") loadPayments();
  }

  function themePreview() {
    const t = state.content.theme || {};
    return `<fieldset class="grp"><legend>Preview</legend>
      <div class="tprev" style="background:${esc(t.bg)};color:${esc(t.ink)}">
        <div class="tprev__bar" style="background:${esc(t.dark)};color:${esc(t.bg)}">Free worldwide shipping</div>
        <p class="tprev__h">Designed for people who move <span style="color:${esc(t.accent)}">different.</span></p>
        <p style="color:${esc(t.muted)}">Secondary text looks like this.</p>
        <span class="tprev__btn" style="background:${esc(t.ink)};color:${esc(t.bg)}">Shop new arrivals</span>
        <span class="tprev__tag" style="background:${esc(t.accent)}">Sale</span>
      </div></fieldset>`;
  }

  /* --------------------------------------------------------- interactions */
  function readValue(el) {
    const t = el.dataset.type;
    if (t === "bool") return el.checked;
    if (t === "number") return el.value === "" ? null : Number(el.value);
    if (t === "lines") return el.value.split("\n").map((x) => x.trim()).filter(Boolean);
    if (t === "tags") return el.value.split(",").map((x) => x.trim()).filter(Boolean);
    return el.value;
  }

  app.addEventListener("input", (e) => {
    const el = e.target;
    if (el.matches("[data-search]")) {
      state.search = el.value;
      const pos = el.selectionStart;
      render();
      const s = $("[data-search]"); s.focus(); s.setSelectionRange(pos, pos);
      return;
    }
    if (el.matches("[data-osearch]")) {
      state.orderSearch = el.value;
      const pos = el.selectionStart;
      render();
      const s = $("[data-osearch]"); s.focus(); s.setSelectionRange(pos, pos);
      return;
    }
    if (el.matches("[data-stock]")) {
      const p = state.content.products[+el.dataset.stock];
      p.stock = p.stock || {};
      p.stock[el.dataset.key] = Math.max(0, parseInt(el.value, 10) || 0);
      updateDirty();
      return;
    }
    if (!el.dataset.path) return;
    const path = el.dataset.path;
    // Keep product colour names and stock keys in step
    const cm = path.match(/^products\.(\d+)\.colors\.(\d+)\.name$/);
    if (cm) {
      const p = state.content.products[+cm[1]];
      const oldName = p.colors[+cm[2]].name, newName = el.value;
      if (oldName !== newName && p.stock) {
        for (const k of Object.keys(p.stock)) if (k.startsWith(oldName + "|")) { p.stock[newName + k.slice(oldName.length)] = p.stock[k]; delete p.stock[k]; }
      }
    }
    set(path, readValue(el));
    // Mirror colour pickers into their text box and vice versa
    if (el.closest(".color")) $$(`[data-path="${CSS.escape(path)}"]`, el.closest(".color")).forEach((x) => { if (x !== el) x.value = el.value; });
    // Auto-slug new products from their name
    const pm = path.match(/^products\.(\d+)\.name$/);
    if (pm && state.autoSlug) {
      const slug = slugify(el.value);
      set(`products.${pm[1]}.slug`, slug);
      const sEl = $(`[data-path="products.${pm[1]}.slug"]`); if (sEl) sEl.value = slug;
    }
    if (path.match(/^products\.\d+\.slug$/)) state.autoSlug = false;
  });

  app.addEventListener("change", (e) => {
    const el = e.target;
    if (el.matches("[data-import]")) return importFile(el.files[0]);
    if (el.hasAttribute("data-rerender") || el.type === "color") render();
  });

  app.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches?.("details.rep__item")) return;
    d.open ? state.open.add(d.dataset.key) : state.open.delete(d.dataset.key);
  }, true);

  app.addEventListener("click", async (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      state.section = nav.dataset.nav; state.edit = null; state.search = ""; state.order = null;
      localStorage.setItem("strata.admin.section", state.section);
      document.body.classList.remove("nav-open");
      render(); scrollTo(0, 0); return;
    }

    const rep = e.target.closest("[data-rep]");
    if (rep) {
      e.preventDefault(); e.stopPropagation();
      const path = rep.dataset.path, i = +rep.dataset.i, list = get(path) || [];
      const def = repDefs.get(path);
      if (rep.dataset.rep === "add") { list.push(def.newItem()); set(path, list); state.open.add(`${path}.${list.length - 1}`); }
      if (rep.dataset.rep === "del") { if (!confirm("Delete this item?")) return; list.splice(i, 1); set(path, list); state.open.clear(); }
      if (rep.dataset.rep === "dup") { list.splice(i + 1, 0, clone(list[i])); set(path, list); }
      if (rep.dataset.rep === "up" && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; set(path, list); state.open.clear(); }
      if (rep.dataset.rep === "down" && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; set(path, list); state.open.clear(); }
      render(); return;
    }

    const of = e.target.closest("[data-ofilter]");
    if (of) { state.orderFilter = of.dataset.ofilter; render(); return; }
    if (e.target.closest("[data-pprov]")) { $$(".choice").forEach((c) => c.classList.toggle("is-on", !!$("input:checked", c))); return; }

    const a = e.target.closest("[data-act]");
    if (!a) return;
    const act = a.dataset.act, i = +a.dataset.i;
    const P = state.content.products;
    switch (act) {
      case "menu": document.body.classList.toggle("nav-open"); break;
      case "open-order": state.order = state.orders.find((o) => o.id === a.dataset.id); render(); scrollTo(0, 0); break;
      case "orders-back": state.order = null; render(); break;
      case "orders-refresh": state.orders = null; render(); break;
      case "orders-csv": ordersCSV(); break;
      case "order-mark-paid": if (confirm("Record this order as paid?")) await patchOrder({ markPaid: true, reference: $("[data-pay-ref]")?.value }); break;
      case "order-save": {
        const v = (k) => $(`[data-o="${k}"]`);
        const status = v("status").value;
        if (status === "cancelled" && state.order.status !== "cancelled" && !confirm("Cancel this order?")) return;
        await patchOrder({ status, restock: !!v("restock")?.checked, notes: v("notes").value, tracking: { carrier: v("carrier").value, number: v("number").value, url: v("url").value } });
        break;
      }
      case "copy": navigator.clipboard?.writeText(a.dataset.v); toast("Copied"); break;
      case "pay-save": return savePayments();
      case "pay-clear": if (confirm("Remove these keys?")) { const pr = a.dataset.p; await savePayments(pr === "paystack" ? { paystack: { secretKey: null, publicKey: null }, provider: state.payments.provider === "paystack" ? "none" : undefined } : { stripe: { secretKey: null, webhookSecret: null }, provider: state.payments.provider === "stripe" ? "none" : undefined }); } break;
      case "pay-test": try { const r = await api(`/api/payments?provider=${a.dataset.p}`, { method: "POST" }); toast(r.message); } catch (err) { alert(err.message); } break;
      case "save": return save();
      case "export": return exportJSON();
      case "logout": await api("/api/auth", { method: "DELETE" }).catch(() => {}); location.reload(); break;
      case "back": state.edit = null; render(); scrollTo(0, 0); break;
      case "new-product": P.unshift(newProduct()); state.autoSlug = true; state.edit = { i: 0 }; updateDirty(); render(); scrollTo(0, 0); break;
      case "edit-product": state.edit = { i }; state.autoSlug = false; render(); scrollTo(0, 0); break;
      case "dup-product": { const c = clone(P[i]); c.name += " (copy)"; c.slug = slugify(c.name); c.published = false; P.splice(i + 1, 0, c); updateDirty(); render(); break; }
      case "del-product": if (confirm(`Delete “${P[i].name || "this product"}”? You can undo by not publishing.`)) { P.splice(i, 1); state.edit = null; updateDirty(); render(); } break;
      case "move-product": { const j = i + +a.dataset.d; if (j >= 0 && j < P.length) { [P[i], P[j]] = [P[j], P[i]]; updateDirty(); render(); } break; }
      case "preset": P[i].sizes = PRESETS[a.dataset.p].slice(); updateDirty(); render(); break;
      case "bulk-stock": { const n = Math.max(0, parseInt($("[data-bulk]").value, 10) || 0); const p = P[i]; p.stock = {}; p.colors.forEach((c) => p.sizes.forEach((s) => (p.stock[`${c.name}|${s}`] = n))); updateDirty(); render(); break; }
      case "upload": return pickAndUpload(a.dataset.path, a.hasAttribute("data-append"));
      case "library": return openLibrary(a.dataset.path, a.hasAttribute("data-append"));
      case "clear-img": set(a.dataset.path, ""); render(); break;
      case "img-remove": { const l = get(a.dataset.path); l.splice(i, 1); set(a.dataset.path, l); render(); break; }
      case "img-move": { const l = get(a.dataset.path), j = i + +a.dataset.d; [l[i], l[j]] = [l[j], l[i]]; set(a.dataset.path, l); render(); break; }
      case "reset": if (confirm("Replace everything in the editor with the original demo content? (Nothing goes live until you publish.)")) { state.content = await (await fetch("/data/content.json", { cache: "no-store" })).json(); state.edit = null; render(); toast("Demo content loaded — publish to make it live"); } break;
      case "restore": if (confirm("Load this version into the editor? (Nothing goes live until you publish.)")) { state.content = await (await fetch(a.dataset.url)).json(); state.edit = null; render(); toast("Version loaded — publish to make it live"); } break;
    }
  });

  /* ------------------------------------------------------------- saving */
  function normalise(c) {
    c.faq.forEach((f, i) => (f.order = i + 1));
    c.products.forEach((p) => {
      p.price = Number(p.price) || 0;
      p.salePrice = p.salePrice ? Number(p.salePrice) : null;
      if (!p.slug) p.slug = slugify(p.name);
      if (!p.createdAt) p.createdAt = new Date().toISOString().slice(0, 10);
      p.images = (p.images || []).filter(Boolean);
    });
    return c;
  }
  function validate(c) {
    const errs = [], seen = new Set();
    c.products.forEach((p, i) => {
      if (!p.name) errs.push(`Product ${i + 1} needs a name`);
      if (!/^[a-z0-9-]+$/.test(p.slug || "")) errs.push(`“${p.name || "Product " + (i + 1)}” needs a valid URL slug`);
      else if (seen.has(p.slug)) errs.push(`Two products use the slug “${p.slug}”`);
      seen.add(p.slug);
      if (p.salePrice && p.salePrice >= p.price) errs.push(`“${p.name}”: sale price should be lower than the price`);
    });
    return errs;
  }

  async function save() {
    if (state.saving) return;
    normalise(state.content);
    const errs = validate(state.content);
    if (errs.length) return alert("Please fix these before publishing:\n\n• " + errs.join("\n• "));
    state.saving = true; render();
    try {
      const r = await api("/api/content", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: state.content, stockChanges: stockChanges() }) });
      state.content.updatedAt = r.updatedAt;
      for (const p of state.content.products) if (r.inventory?.[p.slug]) p.stock = r.inventory[p.slug];
      snapshotStock();
      state.savedJSON = JSON.stringify(state.content);
      toast("Published. Changes appear on the site within a minute.");
    } catch (e) {
      if (e.status === 401) { alert(e.message); return showLogin(); }
      alert(e.message + (e.data?.errors ? "\n\n• " + e.data.errors.join("\n• ") : ""));
    } finally { state.saving = false; render(); }
  }

  function exportJSON() {
    normalise(state.content);
    const blob = new Blob([JSON.stringify(state.content, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.mode === "local" ? "content.json" : `strata-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    if (state.mode === "local") state.savedJSON = JSON.stringify(state.content);
    updateDirty();
  }
  async function importFile(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.products) || !data.settings) throw new Error("This doesn't look like a STRATA content file.");
      if (!confirm("Replace everything in the editor with this file? (Nothing goes live until you publish.)")) return;
      state.content = data; state.edit = null; render(); toast("File loaded — publish to make it live");
    } catch (e) { alert(e.message); }
  }

  /* ------------------------------------------------------------- images */
  async function resize(file) {
    if (file.type === "image/gif") return { blob: file, type: file.type };
    const bmp = await createImageBitmap(file);
    const max = 2400, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
    return { blob, type: "image/jpeg" };
  }

  function pickAndUpload(path, append) {
    if (state.mode === "local") return alert("Uploading needs the admin to run on Vercel with storage connected. For now you can paste an image URL.");
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = append;
    input.onchange = async () => {
      const files = [...input.files];
      for (const [n, file] of files.entries()) {
        toast(`Uploading ${files.length > 1 ? `${n + 1} of ${files.length}` : file.name}…`, true);
        try {
          const { blob, type } = await resize(file);
          const { url } = await api(`/api/upload?name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(type)}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: blob });
          if (append) { const l = get(path) || []; l.push(url); set(path, l); } else set(path, url);
        } catch (e) { toast(""); return alert(`Upload failed: ${e.message}`); }
      }
      toast("Uploaded"); render();
    };
    input.click();
  }

  function collectImages() {
    const out = new Set();
    (function walk(o) {
      if (typeof o === "string") { if (/^photo-\d|blob\.vercel-storage\.com|^https?:\/\/.+\.(jpe?g|png|webp|avif|gif)/i.test(o)) out.add(o); }
      else if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === "object") Object.values(o).forEach(walk);
    })(state.content);
    return [...out];
  }

  async function openLibrary(path, append) {
    const dlg = document.createElement("dialog");
    dlg.className = "lib";
    dlg.innerHTML = `<div class="lib__head"><b>Choose an image</b><button class="ic" data-close>×</button></div><div class="lib__body"><p class="muted">Loading…</p></div>`;
    document.body.appendChild(dlg); dlg.showModal();
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) close(); });
    let uploads = [];
    if (state.mode === "live") { try { uploads = (await api("/api/upload")).images.map((x) => x.url); } catch {} }
    const inUse = collectImages().filter((x) => !uploads.includes(x));
    const tile = (u) => `<button class="lib__tile" data-pick="${esc(u)}"><img src="${esc(thumbURL(u, 200, 250))}" alt="" loading="lazy" /></button>`;
    $(".lib__body", dlg).innerHTML = `
      ${state.mode === "live" ? `<div class="lib__row"><b>Your uploads</b><button class="btn btn--sm" data-lib-upload>Upload new</button></div><div class="lib__grid">${uploads.map(tile).join("") || `<p class="muted">Nothing uploaded yet.</p>`}</div>` : ""}
      <div class="lib__row"><b>Used on the site</b></div><div class="lib__grid">${inUse.map(tile).join("")}</div>`;
    dlg.addEventListener("click", (e) => {
      const t = e.target.closest("[data-pick]");
      if (t) { if (append) { const l = get(path) || []; l.push(t.dataset.pick); set(path, l); } else set(path, t.dataset.pick); close(); render(); }
      if (e.target.closest("[data-lib-upload]")) { close(); pickAndUpload(path, append); }
    });
  }

  /* -------------------------------------------------------------- toast */
  let tTimer;
  function toast(msg, sticky) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.toggle("is-on", !!msg);
    clearTimeout(tTimer);
    if (!sticky && msg) tTimer = setTimeout(() => t.classList.remove("is-on"), 3200);
  }

  /* -------------------------------------------------------------- login */
  function showLogin(msg = "") {
    const a = state.auth;
    app.className = "login";
    app.innerHTML = `
      <form class="login__box" data-login>
        <p class="brand brand--big">STRATA<small>Admin</small></p>
        ${a.configured === false ? `
          <div class="notice">
            <b>Almost there.</b> Set an admin password to switch this on:<br/><br/>
            In Vercel, open your project → <b>Settings → Environment Variables</b>, add <code>ADMIN_PASSWORD</code> with a strong password, then redeploy.
          </div>` : `
          <label class="lbl" for="pw">Password</label>
          <input id="pw" type="password" autocomplete="current-password" required autofocus />
          <p class="login__err accent">${esc(msg)}</p>
          <button class="btn btn--full" type="submit">Sign in</button>`}
        <a class="muted small" href="/">← Back to the store</a>
      </form>`;
    const f = $("[data-login]");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button", f); btn.disabled = true; btn.textContent = "Signing in…";
      try {
        const r = await api("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: $("#pw").value }) });
        state.auth = { ...state.auth, authenticated: true, storage: r.storage };
        await loadContent();
      } catch (err) { showLogin(err.message); }
    });
  }

  async function loadContent() {
    let content;
    if (state.mode === "live") content = await api("/api/content?fresh=1");
    else content = await (await fetch("/data/content.json", { cache: "no-store" })).json();
    state.content = content;
    state.content.pages = state.content.pages || {};
    state.savedJSON = JSON.stringify(content);
    snapshotStock();
    if (!sectionLabel(state.section)) state.section = "orders";
    render();
  }

  /* --------------------------------------------------------------- start */
  (async function start() {
    try {
      const r = await fetch("/api/auth", { credentials: "same-origin" });
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error("no api");
      state.auth = await r.json();
      state.mode = "live";
      if (!state.auth.authenticated) return showLogin();
      await loadContent();
    } catch {
      state.mode = "local";
      await loadContent();
    }
  })();
})();
