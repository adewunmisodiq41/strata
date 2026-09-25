/* ==========================================================================
   STRATA — APPLICATION
   Hash router + views + interactions. No build step, no dependencies.
   ========================================================================== */

(function () {
  const B = window.BRAND, C = window.CMS, S = window.Store, I = window.IMG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.NumberFormat(B.locale, { style: "currency", currency: B.currency, maximumFractionDigits: 0 });
  const money = (n) => fmt.format(n);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = matchMedia("(hover: none)").matches;

  const catName = (slug) => esc((C.categories.find((c) => c.slug === slug) || {}).name || slug);
  const colName = (slug) => esc((C.collections.find((c) => c.slug === slug) || {}).name || slug);
  const collectionBySlug = (slug) => C.collections.find((c) => c.slug === slug);

  const ICON = {
    arrow: '<svg class="i-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    arrowL: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 6l-6 6 6 6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3.2-6.4A8 8 0 0 1 20 12Zm0 0v8l-3.5-2"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3 11l7 3 3 7 8-17Z"/><path d="m10 14 4-4"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>',
    insta: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.4 5 4.6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m10.5 20 2-8.5M11.3 12.3c-.8-2.8 1-4.8 3-4.3 2.3.6 2 4-.2 5.2-1.3.7-2.3 0-2.6-1"/></svg>',
    yt: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="m10 9.5 4.5 2.5-4.5 2.5v-5Z"/></svg>',
    filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  };

  /* ---------------------------------------------------------------------- */
  /* Image helper — responsive <img> with srcset, lazy loading and decoding */
  /* ---------------------------------------------------------------------- */
  function pic(id, { ratio = 1.25, sizes = "100vw", alt = "", cls = "", eager = false, extra = "", widths } = {}) {
    if (!id) return "";
    const w = widths || [360, 540, 720, 960, 1280, 1600];
    const ext = I.isExternal(id);
    if (ext) cls += " ext";
    const fallback = ext ? ` data-raw="${esc(id)}" onerror="if(this.dataset.raw&&this.src!==this.dataset.raw){this.srcset='';this.src=this.dataset.raw}"` : "";
    return `<img${fallback} class="${cls}" src="${I.src(id, 720, Math.round(720 * ratio), extra)}" srcset="${I.srcset(id, ratio, w, extra)}" sizes="${sizes}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onload="this.classList.add('is-loaded')" />`;
  }

  /* ---------------------------------------------------------------------- */
  /* Components                                                              */
  /* ---------------------------------------------------------------------- */
  function priceHTML(p) {
    return p.salePrice
      ? `<span class="price price--sale"><s>${money(p.price)}</s> ${money(p.salePrice)}</span>`
      : `<span class="price">${money(p.price)}</span>`;
  }

  function sizeStock(p, color, size) {
    const v = S.variantOf(p, color, size);
    return v ? v.quantityAvailable : 0;
  }

  function productCard(p, { sizes = "(min-width: 1100px) 25vw, (min-width: 768px) 33vw, 50vw", eager = false } = {}) {
    const color = p.colors[0].name;
    const tag = p.salePrice ? "SALE" : p.status;
    return `
    <article class="card" data-reveal>
      <div class="card__media">
        <a href="#/product/${p.slug}" class="card__link" aria-label="${esc(p.name)}">
          ${pic(p.images[0], { ratio: 1.3333, sizes, alt: `${p.name} — ${catName(p.category)}`, cls: "card__img", eager })}
          ${p.images[1] ? pic(p.images[1], { ratio: 1.3333, sizes, alt: "", cls: "card__img card__img--alt" }) : ""}
        </a>
        ${tag ? `<span class="tag ${tag === "SALE" ? "tag--accent" : ""}">${tag}</span>` : ""}
        <button class="card__wish ${S.inWish(p.slug) ? "is-on" : ""}" data-wish="${p.slug}" aria-pressed="${S.inWish(p.slug)}" aria-label="Save ${esc(p.name)} to wishlist">${ICON.heart}</button>
        <div class="card__quick" data-quick>
          <button class="card__quick-toggle" data-quick-toggle aria-label="Quick add ${esc(p.name)}">${ICON.plus}</button>
          <div class="card__quick-panel">
            <div class="card__quick-head"><span>Quick add</span><a href="#/product/${p.slug}">View product</a></div>
            <div class="card__sizes">
              ${p.sizes.map((s) => { const q = sizeStock(p, color, s); return `<button data-quick-add="${p.slug}" data-color="${esc(color)}" data-size="${s}" ${q ? "" : "disabled"} aria-label="Add size ${s}">${s}</button>`; }).join("")}
            </div>
          </div>
        </div>
      </div>
      <div class="card__info">
        <div>
          <p class="card__cat">${catName(p.category)}</p>
          <h3 class="card__name"><a href="#/product/${p.slug}">${esc(p.name)}</a></h3>
        </div>
        <div class="card__right">
          ${priceHTML(p)}
          <span class="card__swatches" aria-label="${p.colors.length} colours">${p.colors.map((c) => `<i style="--sw:${c.hex}" title="${esc(c.name)}"></i>`).join("")}</span>
        </div>
      </div>
    </article>`;
  }

  const grid = (list, opts) => `<div class="grid">${list.map((p, i) => productCard(p, { ...opts, eager: i < 4 && opts?.eagerFirst })).join("")}</div>`;

  function sectionHead(kicker, title, link) {
    return `
    <div class="shead" data-reveal>
      <div>
        ${kicker ? `<p class="label shead__kicker">${kicker}</p>` : ""}
        <h2 class="h2">${title}</h2>
      </div>
      ${link ? `<a class="link-arrow" href="${link.href}">${link.text} ${ICON.arrow}</a>` : ""}
    </div>`;
  }

  function faqList(items, idPrefix = "faq") {
    return `<div class="faq">${items
      .sort((a, b) => a.order - b.order)
      .map((f, i) => `
        <div class="acc">
          <h3 class="acc__h">
            <button class="acc__btn" aria-expanded="false" aria-controls="${idPrefix}-${i}" id="${idPrefix}-b${i}">
              <span class="acc__num">${String(i + 1).padStart(2, "0")}</span>
              <span class="acc__q">${esc(f.question)}</span>
              <span class="acc__icon" aria-hidden="true"></span>
            </button>
          </h3>
          <div class="acc__panel" id="${idPrefix}-${i}" role="region" aria-labelledby="${idPrefix}-b${i}"><div class="acc__inner"><p>${esc(f.answer)}</p></div></div>
        </div>`).join("")}</div>`;
  }

  function detailAccordion(rows, idPrefix) {
    return `<div class="faq faq--compact">${rows.map(([title, body], i) => `
      <div class="acc">
        <h3 class="acc__h"><button class="acc__btn" aria-expanded="false" aria-controls="${idPrefix}-${i}" id="${idPrefix}-b${i}">
          <span class="acc__q">${title}</span><span class="acc__icon" aria-hidden="true"></span></button></h3>
        <div class="acc__panel" id="${idPrefix}-${i}" role="region" aria-labelledby="${idPrefix}-b${i}"><div class="acc__inner">${body}</div></div>
      </div>`).join("")}</div>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Home sections                                                           */
  /* ---------------------------------------------------------------------- */
  const H = () => (C.pages.home || {});
  const br = (t) => esc(t).replace(/\n/g, "<br/>");
  const heroLines = (t) => String(t || "").split("\n").filter(Boolean);

  function hero() {
    const h = H(), desk = h.heroImage, mob = h.heroImageMobile || h.heroImage;
    const ext = I.isExternal(desk) ? "ext" : "";
    return `
    <section class="hero" aria-label="${esc(h.heroKicker)} campaign">
      <div class="hero__media" data-hero-media>
        <picture>
          <source media="(max-width: 767px)" srcset="${I.srcset(mob, 1.6, [480, 720, 960, 1200])}" sizes="100vw" />
          <img class="${ext}" src="${I.src(desk, 1400)}" srcset="${I.srcset(desk, 0, [900, 1400, 1800, 2200, 2800])}" sizes="100vw" alt="${esc(h.heroAlt)}" fetchpriority="high" decoding="async" />
        </picture>
      </div>
      <div class="hero__grid">
        <div class="hero__top">
          <p class="label hero__kicker" data-in="1"><span>${esc(h.heroKicker)}</span>${h.heroKicker2 ? `<span class="hero__sep"></span><span>${esc(h.heroKicker2)}</span>` : ""}</p>
          <div class="hero__meta" data-in="2"><p class="label">${esc(h.heroMeta)}</p><p class="hero__sub">${esc(h.heroSub)}</p></div>
        </div>
        <div class="hero__bottom">
          <h1 class="display hero__title">
            ${heroLines(h.heroTitle).map((l, i) => `<span class="line"><span data-in="${Math.min(i + 2, 4)}">${esc(l)}</span></span>`).join("")}
          </h1>
          <div class="hero__aside" data-in="4">
            <p class="hero__sub hero__sub--m">${esc(h.heroSub)}</p>
            <div class="hero__ctas">
              ${h.ctaPrimary?.label ? `<a class="btn btn--dark" href="${esc(h.ctaPrimary.href)}">${esc(h.ctaPrimary.label)}</a>` : ""}
              ${h.ctaSecondary?.label ? `<a class="btn btn--ghost" href="${esc(h.ctaSecondary.href)}">${esc(h.ctaSecondary.label)}</a>` : ""}
            </div>
          </div>
        </div>
      </div>
      <div class="hero__scroll label" aria-hidden="true"><span></span>Scroll</div>
    </section>`;
  }

  function statement() {
    const h = H();
    return `
    <section class="statement wrap">
      <div class="statement__label label" data-reveal>${esc(h.statementLabel)}</div>
      <h2 class="display statement__title" data-reveal>
        ${br(h.statementTitle)} ${h.statementAccent ? `<em>${esc(h.statementAccent)}</em>` : ""}
      </h2>
      <div class="statement__row">
        <figure class="statement__img media" data-reveal="img" data-parallax="-0.06">
          ${pic(h.statementImage, { ratio: 1.25, sizes: "(min-width: 768px) 26vw, 60vw", alt: "" })}
        </figure>
        <div class="statement__copy" data-reveal>
          <p class="lead">${esc(h.statementLead)}</p>
          <p>${br(h.statementBody)}</p>
          <a class="link-arrow" href="#/about">Our story ${ICON.arrow}</a>
        </div>
        <dl class="statement__facts" data-reveal>
          ${(h.facts || []).map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}${f.unit ? `<small>${esc(f.unit)}</small>` : ""}</dd></div>`).join("")}
        </dl>
      </div>
    </section>`;
  }

  function categoriesSection() {
    const count = (slug) => C.products.filter((p) => (slug === "women" || slug === "men") ? (p.gender === slug || p.gender === "unisex") : p.category === slug).length;
    const href = (c) => c.type === "gender" ? `#/shop?dept=${c.slug}` : `#/shop?cat=${c.slug}`;
    const [women, men, ...rest] = C.categories;
    const big = (c, i) => `
      <a class="cat cat--big" href="${href(c)}" data-reveal="img">
        <div class="cat__media">${pic(c.image, { ratio: 1.2, sizes: "(min-width: 768px) 50vw, 100vw", alt: `${esc(c.name)} — ${c.description}` })}</div>
        <div class="cat__body">
          <span class="label">0${i + 1}</span>
          <h3 class="display cat__title">${esc(c.name)}</h3>
          <span class="cat__meta label">${count(c.slug)} Products <span class="cat__arrow">${ICON.arrow}</span></span>
        </div>
      </a>`;
    return `
    <section class="section cats">
      <div class="wrap">${sectionHead("( 02 ) — Categories", esc(H().categoriesTitle || "Shop by Category"), { href: "#/shop", text: "View all" })}</div>
      <div class="wrap cats__big">${big(women, 0)}${big(men, 1)}</div>
      <div class="rail" data-rail>
        <div class="rail__track" data-rail-track>
          ${rest.map((c, i) => `
          <a class="cat cat--small" href="${href(c)}" data-reveal="img">
            <div class="cat__media">${pic(c.image, { ratio: 1.3, sizes: "(min-width: 1100px) 24vw, (min-width: 768px) 40vw, 70vw", alt: c.description })}</div>
            <div class="cat__row">
              <div><h3 class="cat__name">${esc(c.name)}</h3><span class="label muted">${count(c.slug)} Products</span></div>
              <span class="cat__arrow">${ICON.arrow}</span>
            </div>
          </a>`).join("")}
        </div>
        <div class="rail__ctrl wrap">
          <div class="rail__bar"><span data-rail-progress></span></div>
          <div class="rail__btns">
            <button class="round-btn" data-rail-prev aria-label="Previous categories">${ICON.arrowL}</button>
            <button class="round-btn" data-rail-next aria-label="Next categories">${ICON.arrow}</button>
          </div>
        </div>
      </div>
    </section>`;
  }

  function dropSection() {
    const picks = (H().dropCollections || []).map(collectionBySlug).filter(Boolean);
    const [a, b] = picks.length >= 2 ? picks : C.collections.slice(0, 2);
    if (!a || !b) return "";
    return `
    <section class="drop">
      <div class="wrap">
        ${sectionHead("( 03 ) — Collections", esc(H().dropTitle || "The Drop"), { href: "#/collections", text: "View all collections" })}
        <div class="drop__grid">
          <a class="drop__panel drop__panel--a" href="#/collections/${a.slug}" data-reveal="img">
            <div class="drop__media" data-parallax="0.05">${pic(a.cover, { ratio: 1.2, sizes: "(min-width: 768px) 58vw, 100vw", alt: `${a.name} campaign — model in an oversized black coat`, extra: "&crop=faces" })}</div>
            <div class="drop__text">
              <p class="label">${esc(a.label)} <span class="dot"></span> ${esc(a.season)}</p>
              <h3 class="display drop__title">${esc(a.name).replace(" ", "<br/>")}</h3>
              <span class="btn-line">Shop Now ${ICON.arrow}</span>
            </div>
            <span class="drop__index label">01 / 02</span>
          </a>
          <div class="drop__side">
            <a class="drop__panel drop__panel--b" href="#/collections/${b.slug}" data-reveal="img">
              <div class="drop__media" data-parallax="0.08">${pic(b.cover, { ratio: 1.3, sizes: "(min-width: 768px) 38vw, 100vw", alt: `${b.name} campaign — model in unstructured white tailoring` })}</div>
              <div class="drop__text">
                <p class="label">${esc(b.label)}</p>
                <h3 class="display drop__title">${esc(b.name).replace(" ", "<br/>")}</h3>
                <span class="btn-line">Explore ${ICON.arrow}</span>
              </div>
              <span class="drop__index label">02 / 02</span>
            </a>
            <p class="drop__note" data-reveal>${esc(b.intro)} ${esc(b.description.split(".")[0])}.</p>
          </div>
        </div>
      </div>
    </section>`;
  }

  function featuredSection() {
    return `
    <section class="section wrap" id="featured">
      <div class="shead" data-reveal>
        <div><p class="label shead__kicker">( 04 ) — Shop</p><h2 class="h2">${esc(H().featuredTitle || "Featured Products")}</h2></div>
        <div class="tabs" role="tablist" aria-label="Filter featured products">
          <button role="tab" aria-selected="true" data-feat="featured">Featured</button>
          <button role="tab" aria-selected="false" data-feat="new">New</button>
          <button role="tab" aria-selected="false" data-feat="best">Best Sellers</button>
        </div>
      </div>
      <div data-feat-grid>${grid(featuredList("featured"))}</div>
      <div class="center-cta" data-reveal><a class="btn btn--outline" href="#/shop">View all ${C.products.length} products</a></div>
    </section>`;
  }
  function featuredList(kind) {
    const list = kind === "new" ? C.products.filter((p) => p.newArrival) : kind === "best" ? C.products.filter((p) => p.bestSeller) : C.products.filter((p) => p.featured);
    return list.slice(0, 8);
  }

  function storiesSection() {
    return `
    <section class="stories">
      <div class="wrap">${sectionHead("( 05 ) — Customer Stories", esc(H().storiesTitle || "What They're Saying"), { href: B.socialLinks.instagram, text: `Tag ${B.social}` })}</div>
      <div class="rail rail--dark" data-rail>
        <div class="rail__track" data-rail-track>
          ${C.testimonials.map((t) => {
            const p = S.product(t.product);
            return `
            <article class="post" data-reveal>
              <header class="post__head">
                <img class="post__avatar" src="${I.src(t.profileImage, 80, 80, "&crop=faces")}" alt="" loading="lazy" />
                <div><p class="post__user">@${esc(t.username)}</p><p class="post__sub">Wearing ${esc(p ? p.name : B.name)}</p></div>
                <span class="post__more" aria-hidden="true">•••</span>
              </header>
              <div class="post__media">${pic(t.image, { ratio: 1.25, sizes: "(min-width: 1100px) 24vw, (min-width: 768px) 40vw, 78vw", alt: `Customer photo shared by @${t.username}` })}</div>
              <div class="post__actions">
                <button class="post__like" data-like="${t.likes}" aria-pressed="false" aria-label="Like post">${ICON.heart}</button>
                <span>${ICON.comment}</span><span>${ICON.send}</span><span class="post__save">${ICON.save}</span>
              </div>
              <p class="post__likes"><span data-like-count>${t.likes.toLocaleString(B.locale)}</span> likes</p>
              <p class="post__text"><b>${esc(t.username)}</b> ${esc(t.review)}</p>
              <p class="post__comments">View all ${t.comments} comments</p>
              <p class="post__time label">${esc(t.date)}</p>
            </article>`;
          }).join("")}
        </div>
        <div class="rail__ctrl wrap">
          <div class="rail__bar"><span data-rail-progress></span></div>
          <div class="rail__btns">
            <button class="round-btn" data-rail-prev aria-label="Previous posts">${ICON.arrowL}</button>
            <button class="round-btn" data-rail-next aria-label="Next posts">${ICON.arrow}</button>
          </div>
        </div>
      </div>
    </section>`;
  }

  function faqSection() {
    return `
    <section class="section wrap faq-sec">
      <div class="faq-sec__head" data-reveal>
        <p class="label shead__kicker">( 06 ) — Help</p>
        <h2 class="h2">${br(H().faqTitle || "Frequently\nAsked Questions")}</h2>
        <p class="muted">Can't find what you need? <a class="u" href="#/contact">Contact the studio</a> — we reply within 24 hours.</p>
      </div>
      <div data-reveal>${faqList(C.faq)}</div>
    </section>`;
  }

  function socialSection() {
    return `
    <section class="section social">
      <div class="wrap">${sectionHead("( 07 ) — Social", `${B.social}`, { href: B.socialLinks.instagram, text: "Follow on Instagram" })}</div>
      <div class="social__grid wrap">
        ${C.social.map((s, i) => `
          <a class="social__item social__item--${i + 1}" href="${B.socialLinks.instagram}" target="_blank" rel="noopener" data-reveal="img" aria-label="View post: ${esc(s.caption)}">
            ${pic(s.image, { ratio: [2, 1, 1, 2, 1, 1, 0.5, 0.5][i], sizes: "(min-width: 768px) 25vw, 50vw", alt: s.caption })}
            <span class="social__over"><span class="social__icon">${ICON.insta}</span><span class="label">View Post</span></span>
          </a>`).join("")}
      </div>
    </section>`;
  }

  function contactSection(num = "( 08 ) — Contact") {
    return `
    <section class="section wrap contact" id="contact">
      <div class="contact__info" data-reveal>
        <p class="label shead__kicker">${num}</p>
        <h2 class="h2">${esc(H().contactTitle || "Get in Touch")}</h2>
        <dl class="contact__dl">
          <div><dt class="label accent">Location</dt><dd>${esc(B.location.line1)}<br/>${esc(B.location.line2)}<br/><span class="muted">${esc(B.location.est)}</span></dd></div>
          <div><dt class="label accent">Office Hours</dt><dd>${esc(B.hours.days)}<br/>${esc(B.hours.time)}</dd></div>
          <div><dt class="label accent">Email</dt><dd><a class="u" href="mailto:${B.email}">${B.email}</a></dd></div>
          <div><dt class="label accent">Social</dt><dd><a class="u" href="${B.socialLinks.instagram}" target="_blank" rel="noopener">${esc(B.social)}</a></dd></div>
        </dl>
      </div>
      <form class="form contact__form" data-form="contact" novalidate data-reveal>
        <p class="contact__intro">${esc(H().contactIntro)}</p>
        <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" autocomplete="name" required minlength="2" /><span class="field__err" aria-live="polite"></span></div>
        <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" autocomplete="email" required /><span class="field__err" aria-live="polite"></span></div>
        <div class="field"><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="5" required minlength="10"></textarea><span class="field__err" aria-live="polite"></span></div>
        <button class="btn btn--dark btn--full" type="submit">Send Message</button>
        <p class="form__ok" hidden>Thank you — your message is with the studio. We'll reply within 24 hours.</p>
      </form>
    </section>`;
  }

  function newsletterSection() {
    return `
    <section class="newsletter">
      <div class="wrap newsletter__inner" data-reveal>
        <p class="label">Newsletter</p>
        <h2 class="display newsletter__title">${esc(H().newsletterTitle || "Be first to know")}</h2>
        <p class="muted">${esc(H().newsletterText)}</p>
        <form class="inline-form" data-form="newsletter" novalidate>
          <label for="nl-email" class="sr-only">Your email address</label>
          <input id="nl-email" name="email" type="email" placeholder="Your email address" autocomplete="email" required />
          <button class="btn btn--dark" type="submit">Join</button>
          <span class="field__err" aria-live="polite"></span>
        </form>
        <p class="form__ok" hidden>You're on the list. Watch your inbox for the next drop.</p>
      </div>
    </section>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Views                                                                   */
  /* ---------------------------------------------------------------------- */
  const views = {};

  views.home = () => ({
    title: `${B.name} — Premium Streetwear & Modern Essentials`,
    description: B.description,
    image: I.src("photo-1559356157-f3315daa41c7", 1200, 630),
    html: hero() + statement() + categoriesSection() + dropSection() + featuredSection() + storiesSection() + faqSection() + socialSection() + contactSection() + newsletterSection(),
    ld: { "@context": "https://schema.org", "@type": "WebSite", name: B.name, url: B.url, potentialAction: { "@type": "SearchAction", target: `${B.url}/#/shop?q={query}`, "query-input": "required name=query" } },
    mount(root) {
      $$("[data-feat]", root).forEach((btn) => btn.addEventListener("click", () => {
        $$("[data-feat]", root).forEach((b) => b.setAttribute("aria-selected", b === btn));
        const g = $("[data-feat-grid]", root);
        g.classList.add("is-swapping");
        setTimeout(() => { g.innerHTML = grid(featuredList(btn.dataset.feat)); g.classList.remove("is-swapping"); observe(g); }, 200);
      }));
    },
  });

  /* ------------------------------ SHOP ---------------------------------- */
  const PRICE_RANGES = [
    { id: "u100", label: "Under $100", test: (n) => n < 100 },
    { id: "100-200", label: "$100 – $200", test: (n) => n >= 100 && n < 200 },
    { id: "200-350", label: "$200 – $350", test: (n) => n >= 200 && n < 350 },
    { id: "o350", label: "$350+", test: (n) => n >= 350 },
  ];
  const SORTS = [
    { id: "featured", label: "Featured" },
    { id: "newest", label: "Newest" },
    { id: "price-asc", label: "Price: Low to High" },
    { id: "price-desc", label: "Price: High to Low" },
  ];
  const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "39", "40", "41", "42", "43", "44", "45", "OS"];

  function matchesQuery(p, q) {
    if (!q) return true;
    const hay = [p.name, catName(p.category), colName(p.collection), p.gender, p.description, ...p.colors.map((c) => c.name), p.status].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t) || hay.includes(t.replace(/s$/, "")));
  }

  function applyFilters(f) {
    let list = C.products.filter((p) => {
      if (!matchesQuery(p, f.q)) return false;
      if (f.dept.length && !f.dept.some((d) => p.gender === d || p.gender === "unisex")) return false;
      if (f.cat.length && !f.cat.includes(p.category)) return false;
      if (f.col.length && !f.col.includes(p.collection)) return false;
      if (f.size.length && !p.variants.some((v) => f.size.includes(v.size) && v.availableForSale)) return false;
      if (f.price.length && !f.price.some((id) => PRICE_RANGES.find((r) => r.id === id).test(S.unitPrice(p)))) return false;
      if (f.new && !p.newArrival) return false;
      if (f.sale && !p.salePrice) return false;
      return true;
    });
    const by = {
      featured: (a, b) => (b.featured - a.featured) || (b.bestSeller - a.bestSeller),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      "price-asc": (a, b) => S.unitPrice(a) - S.unitPrice(b),
      "price-desc": (a, b) => S.unitPrice(b) - S.unitPrice(a),
    };
    return list.sort(by[f.sort] || by.featured);
  }

  function filtersFromQuery(q) {
    const arr = (k) => (q.get(k) ? q.get(k).split(",").filter(Boolean) : []);
    return { q: q.get("q") || "", dept: arr("dept"), cat: arr("cat"), col: arr("col"), size: arr("size"), price: arr("price"), sort: q.get("sort") || (q.get("new") ? "newest" : "featured"), new: !!q.get("new"), sale: !!q.get("sale") };
  }
  function filtersToQuery(f) {
    const q = new URLSearchParams();
    if (f.q) q.set("q", f.q);
    ["dept", "cat", "col", "size", "price"].forEach((k) => f[k].length && q.set(k, f[k].join(",")));
    if (f.sort !== "featured") q.set("sort", f.sort);
    if (f.new) q.set("new", "1");
    if (f.sale) q.set("sale", "1");
    const s = q.toString().replace(/%2C/g, ",");
    return s ? "?" + s : "";
  }

  function shopTitle(f) {
    if (f.new) return "New Arrivals";
    if (f.sale) return "Sale";
    if (f.dept.length === 1 && !f.cat.length) return catName(f.dept[0]);
    if (f.cat.length === 1 && !f.dept.length) return catName(f.cat[0]);
    if (f.col.length === 1) return colName(f.col[0]);
    return "All Products";
  }

  function filterPanel(f) {
    const group = (key, title, options) => `
      <fieldset class="fgroup">
        <legend class="label">${title}</legend>
        <div class="fgroup__opts ${key === "size" ? "fgroup__opts--sizes" : ""}">
          ${options.map((o) => `
            <label class="${key === "size" ? "chip" : "check"}">
              <input type="checkbox" data-filter="${key}" value="${o.id}" ${f[key].includes(o.id) ? "checked" : ""} />
              <span>${o.label}</span>${o.count != null ? `<em>${o.count}</em>` : ""}
            </label>`).join("")}
        </div>
      </fieldset>`;
    const cnt = (fn) => C.products.filter(fn).length;
    const usedSizes = ALL_SIZES.filter((s) => C.products.some((p) => p.sizes.includes(s)));
    return `
      ${group("dept", "Department", [{ id: "women", label: "Women", count: cnt((p) => p.gender !== "men") }, { id: "men", label: "Men", count: cnt((p) => p.gender !== "women") }])}
      ${group("cat", "Category", C.categories.filter((c) => c.type === "category").map((c) => ({ id: c.slug, label: c.name, count: cnt((p) => p.category === c.slug) })))}
      ${group("col", "Collection", C.collections.map((c) => ({ id: c.slug, label: c.name, count: cnt((p) => p.collection === c.slug) })))}
      ${group("size", "Size", usedSizes.map((s) => ({ id: s, label: s })))}
      ${group("price", "Price", PRICE_RANGES.map((r) => ({ id: r.id, label: r.label, count: cnt((p) => r.test(S.unitPrice(p))) })))}
      <label class="check check--toggle"><input type="checkbox" data-filter-flag="new" ${f.new ? "checked" : ""} /><span>New arrivals only</span></label>
      <label class="check check--toggle"><input type="checkbox" data-filter-flag="sale" ${f.sale ? "checked" : ""} /><span>On sale</span></label>`;
  }

  views.shop = (params, query) => {
    const f = filtersFromQuery(query);
    const title = shopTitle(f);
    return {
      title: `${title} — ${B.name}`,
      description: `Shop ${title.toLowerCase()} from ${B.name}: premium streetwear, heavyweight essentials and outerwear.`,
      html: `
      <section class="page-head wrap">
        <nav class="crumbs label" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span><span aria-current="page">Shop</span></nav>
        <div class="page-head__row">
          <h1 class="display page-title" data-shop-title>${title}</h1>
          <p class="label muted"><span data-shop-count></span> Items</p>
        </div>
      </section>
      <div class="shop wrap" data-shop>
        <div class="shop__bar">
          <div class="shop__search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
            <label for="shop-q" class="sr-only">Search products</label>
            <input id="shop-q" type="search" placeholder="Search products" value="${esc(f.q)}" data-shop-q />
          </div>
          <button class="btn-text shop__toggle" data-filters-toggle aria-expanded="true">${ICON.filter}<span data-toggle-label>Hide Filters</span></button>
          <button class="btn-text shop__mfilter" data-filters-open>${ICON.filter} Filters <span data-active-count></span></button>
          <label class="shop__sort">
            <span class="label muted">Sort by</span>
            <select data-shop-sort>${SORTS.map((s) => `<option value="${s.id}" ${s.id === f.sort ? "selected" : ""}>${s.label}</option>`).join("")}</select>
          </label>
        </div>
        <div class="shop__chips" data-chips></div>
        <div class="shop__body">
          <aside class="shop__filters" data-filters aria-label="Filters">
            <div class="shop__filters-head"><p class="label">Filters</p><button class="icon-btn" data-filters-close aria-label="Close filters">${ICON.close}</button></div>
            <div class="shop__filters-body" data-filter-panel>${filterPanel(f)}</div>
            <div class="shop__filters-foot">
              <button class="btn btn--outline" data-clear>Clear all</button>
              <button class="btn btn--dark" data-filters-close>Show <span data-shop-count></span> results</button>
            </div>
          </aside>
          <div class="shop__results" data-results></div>
        </div>
      </div>`,
      mount(root) {
        const state = f;
        const results = $("[data-results]", root);
        const shopEl = $("[data-shop]", root);
        const render = (animate = true) => {
          const list = applyFilters(state);
          $$("[data-shop-count]", root).forEach((el) => (el.textContent = list.length));
          $("[data-shop-title]", root).textContent = shopTitle(state);
          document.title = `${shopTitle(state)} — ${B.name}`;
          const active = activeChips(state);
          $("[data-active-count]", root).textContent = active.length ? `(${active.length})` : "";
          $("[data-chips]", root).innerHTML = active.length
            ? active.map((c) => `<button class="fchip" data-unchip="${c.key}:${c.value}">${esc(c.label)} ${ICON.close}</button>`).join("") + `<button class="btn-text u" data-clear>Clear all</button>`
            : "";
          const html = list.length
            ? grid(list, { sizes: "(min-width: 1100px) 25vw, (min-width: 768px) 33vw, 50vw" })
            : `<div class="empty"><p class="display empty__title">No matches</p><p class="muted">Nothing fits those filters right now. Try removing a filter or searching for something broader.</p><button class="btn btn--outline" data-clear>Clear all filters</button></div>`;
          if (animate) { results.classList.add("is-swapping"); setTimeout(() => { results.innerHTML = html; results.classList.remove("is-swapping"); observe(results); }, 160); }
          else { results.innerHTML = html; observe(results); }
          history.replaceState(null, "", "#/shop" + filtersToQuery(state));
        };
        root.addEventListener("change", (e) => {
          const t = e.target;
          if (t.matches("[data-filter]")) {
            const k = t.dataset.filter;
            state[k] = t.checked ? [...state[k], t.value] : state[k].filter((v) => v !== t.value);
            render();
          } else if (t.matches("[data-filter-flag]")) { state[t.dataset.filterFlag] = t.checked; render(); }
          else if (t.matches("[data-shop-sort]")) { state.sort = t.value; render(); }
        });
        let qTimer;
        $("[data-shop-q]", root).addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 220); });
        root.addEventListener("click", (e) => {
          const un = e.target.closest("[data-unchip]");
          if (un) {
            const [k, v] = un.dataset.unchip.split(":");
            if (k === "new" || k === "sale") state[k] = false; else if (k === "q") { state.q = ""; $("[data-shop-q]", root).value = ""; } else state[k] = state[k].filter((x) => x !== v);
            syncPanel(); render();
          }
          if (e.target.closest("[data-clear]")) {
            Object.assign(state, { q: "", dept: [], cat: [], col: [], size: [], price: [], new: false, sale: false });
            $("[data-shop-q]", root).value = ""; syncPanel(); render();
          }
          if (e.target.closest("[data-filters-toggle]")) {
            const hidden = shopEl.classList.toggle("filters-hidden");
            e.target.closest("[data-filters-toggle]").setAttribute("aria-expanded", !hidden);
            $("[data-toggle-label]", root).textContent = hidden ? "Show Filters" : "Hide Filters";
          }
          if (e.target.closest("[data-filters-open]")) { shopEl.classList.add("filters-open"); lockScroll(true); }
          if (e.target.closest("[data-filters-close]")) { shopEl.classList.remove("filters-open"); lockScroll(false); }
        });
        const syncPanel = () => { $("[data-filter-panel]", root).innerHTML = filterPanel(state); };
        render(false);
      },
      unmount() { lockScroll(false); },
    };
  };

  function activeChips(f) {
    const chips = [];
    if (f.q) chips.push({ key: "q", value: f.q, label: `“${f.q}”` });
    f.dept.forEach((v) => chips.push({ key: "dept", value: v, label: catName(v) }));
    f.cat.forEach((v) => chips.push({ key: "cat", value: v, label: catName(v) }));
    f.col.forEach((v) => chips.push({ key: "col", value: v, label: colName(v) }));
    f.size.forEach((v) => chips.push({ key: "size", value: v, label: `Size ${v}` }));
    f.price.forEach((v) => chips.push({ key: "price", value: v, label: PRICE_RANGES.find((r) => r.id === v).label }));
    if (f.new) chips.push({ key: "new", value: 1, label: "New arrivals" });
    if (f.sale) chips.push({ key: "sale", value: 1, label: "On sale" });
    return chips;
  }

  /* ----------------------------- PRODUCT -------------------------------- */
  views.product = ([slug]) => {
    const p = S.product(slug);
    if (!p) return views.notFound();
    const col = collectionBySlug(p.collection);
    const related = C.products.filter((x) => x.slug !== p.slug && (x.collection === p.collection || x.category === p.category)).slice(0, 4);
    const images = p.images.length >= 3 ? p.images : [...p.images, p.images[1] || p.images[0]].filter(Boolean);
    const gallery = images.map((id, i) => `
      <figure class="pgal__item ${i === 2 ? "pgal__item--detail" : ""}" data-zoom>
        ${pic(id, { ratio: 1.3333, sizes: "(min-width: 1100px) 30vw, (min-width: 768px) 55vw, 100vw", alt: i === 2 ? `${p.name} — fabric detail` : `${p.name}, view ${i + 1}`, eager: i === 0, extra: i === 2 ? "&crop=focalpoint&fp-x=.5&fp-y=.5&fp-z=2.4" : "" })}
      </figure>`).join("");
    const shipping = `<p>Orders placed before 2 PM GMT ship the same day from London. Free standard shipping on orders over ${money(B.freeShippingThreshold)}; express (1–3 days) from ${money(B.shippingRates[1].price)}. Duties included for the UK, EU, US, CA, AU and JP.</p>`;
    const returns = `<p>Free exchanges and easy returns within 30 days of delivery. Items must be unworn with tags attached. Refunds are issued to the original payment method within 5 business days of receipt.</p>`;
    const offers = p.variants.map((v) => ({ "@type": "Offer", sku: v.sku, price: S.unitPrice(p), priceCurrency: B.currency, availability: v.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${B.url}/#/product/${p.slug}` }));
    return {
      title: `${p.name} — ${catName(p.category)} | ${B.name}`,
      description: p.description,
      image: I.src(p.images[0], 1200, 1500),
      type: "product",
      ld: { "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, description: p.description, image: p.images.map((id) => I.src(id, 1200, 1600)), brand: { "@type": "Brand", name: B.name }, category: catName(p.category), color: p.colors.map((c) => c.name).join(", "), material: p.materials, offers },
      html: `
      <section class="pdp wrap">
        <div class="pgal" data-gallery>
          <div class="pgal__track" data-gallery-track>${gallery}</div>
          <div class="pgal__count label" aria-hidden="true"><span data-gallery-index>1</span> / ${images.length}</div>
        </div>
        <div class="pinfo">
          <div class="pinfo__sticky">
            <nav class="crumbs label" aria-label="Breadcrumb"><a href="#/shop">Shop</a><span>/</span><a href="#/shop?cat=${p.category}">${catName(p.category)}</a><span>/</span><a href="#/collections/${p.collection}">${colName(p.collection)}</a></nav>
            <div class="pinfo__head">
              ${p.status || p.salePrice ? `<span class="tag tag--static ${p.salePrice ? "tag--accent" : ""}">${p.salePrice ? "SALE" : p.status}</span>` : ""}
              <h1 class="pinfo__name">${esc(p.name)}</h1>
              <p class="pinfo__price">${priceHTML(p)}</p>
            </div>
            <p class="pinfo__desc">${esc(p.description)}</p>
            <form class="pform" data-pform novalidate>
              <fieldset class="opt">
                <legend class="opt__legend"><span class="label">Colour</span><span class="opt__val" data-color-label>${p.colors[0].name}</span></legend>
                <div class="swatches">
                  ${p.colors.map((c, i) => `<label class="swatch" title="${esc(c.name)}"><input type="radio" name="color" value="${esc(c.name)}" ${i === 0 ? "checked" : ""} /><i style="--sw:${c.hex}"></i><span class="sr-only">${esc(c.name)}</span></label>`).join("")}
                </div>
              </fieldset>
              <fieldset class="opt">
                <legend class="opt__legend"><span class="label">Size</span>${p.sizes[0] !== "OS" ? `<button type="button" class="btn-text u label" data-size-guide>Size guide</button>` : ""}</legend>
                <div class="sizes" data-sizes></div>
                <p class="opt__note label" data-stock-note aria-live="polite"></p>
              </fieldset>
              <div class="pform__row">
                <div class="qty" aria-label="Quantity">
                  <button type="button" data-qty="-1" aria-label="Decrease quantity">${ICON.minus}</button>
                  <input type="number" name="qty" value="1" min="1" max="10" aria-label="Quantity" inputmode="numeric" />
                  <button type="button" data-qty="1" aria-label="Increase quantity">${ICON.plus}</button>
                </div>
                <button type="submit" class="btn btn--dark btn--grow" data-add>Select a size</button>
                <button type="button" class="wish-btn ${S.inWish(p.slug) ? "is-on" : ""}" data-wish="${p.slug}" aria-pressed="${S.inWish(p.slug)}" aria-label="Save to wishlist">${ICON.heart}</button>
              </div>
              <ul class="pinfo__perks">
                <li><span class="label">Shipping</span> Free over ${money(B.freeShippingThreshold)} · Ships in 24h</li>
                <li><span class="label">Returns</span> Free exchanges · 30-day returns</li>
              </ul>
            </form>
            ${detailAccordion([
              ["Product Details", `<ul class="bullets">${p.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul><p class="muted label">SKU ${p.sku}</p>`],
              ["Materials", `<p>${esc(p.materials)}</p>`],
              ["Fit", `<p>${esc(p.fit)}</p>`],
              ["Care Instructions", `<p>${esc(p.care)}</p>`],
              ["Shipping", shipping],
              ["Returns", returns],
            ], "pd")}
          </div>
        </div>
      </section>
      ${col ? `
      <section class="pcol">
        <a class="pcol__link wrap" href="#/collections/${col.slug}" data-reveal>
          <span class="label muted">Part of the collection</span>
          <span class="display pcol__name">${col.name}</span>
          <span class="link-arrow">Explore the story ${ICON.arrow}</span>
        </a>
      </section>` : ""}
      <section class="section wrap">
        ${sectionHead("", "You May Also Like", { href: `#/shop?cat=${p.category}`, text: `More ${catName(p.category)}` })}
        ${grid(related)}
      </section>
      <dialog class="modal" data-size-modal aria-labelledby="sg-title">
        <div class="modal__head"><h2 id="sg-title" class="label">Size Guide — ${esc(p.name)}</h2><button class="icon-btn" data-modal-close aria-label="Close size guide">${ICON.close}</button></div>
        <div class="modal__body">${sizeGuideTable(p)}</div>
      </dialog>`,
      mount(root) {
        const form = $("[data-pform]", root);
        const sizesEl = $("[data-sizes]", root);
        const addBtn = $("[data-add]", root);
        const note = $("[data-stock-note]", root);
        let size = p.sizes.length === 1 ? p.sizes[0] : null;
        const color = () => form.color.value;
        const renderSizes = () => {
          sizesEl.innerHTML = p.sizes.map((s) => {
            const q = sizeStock(p, color(), s);
            return `<button type="button" class="size ${s === size ? "is-on" : ""} ${q ? "" : "is-out"}" data-size="${s}" ${q ? "" : 'aria-disabled="true"'} aria-pressed="${s === size}">${s}${q ? "" : '<span class="sr-only"> — sold out</span>'}</button>`;
          }).join("");
          updateCTA();
        };
        const updateCTA = () => {
          const q = size ? sizeStock(p, color(), size) : null;
          if (!size) { addBtn.textContent = "Select a size"; note.textContent = ""; addBtn.disabled = false; return; }
          if (!q) { addBtn.textContent = "Sold out — notify me"; addBtn.disabled = true; note.textContent = `${color()} / ${size} is sold out`; return; }
          addBtn.disabled = false;
          addBtn.innerHTML = `Add to Bag <span class="btn__sep"></span> ${money(S.unitPrice(p) * (+form.qty.value || 1))}`;
          note.textContent = q <= 3 ? `Only ${q} left in ${size}` : "In stock — ships within 24h";
          note.classList.toggle("accent", q <= 3);
          form.qty.max = Math.min(10, q);
        };
        form.addEventListener("change", (e) => {
          if (e.target.name === "color") { $("[data-color-label]", root).textContent = color(); renderSizes(); }
          if (e.target.name === "qty") { form.qty.value = Math.max(1, Math.min(+form.qty.max || 10, +form.qty.value || 1)); updateCTA(); }
        });
        sizesEl.addEventListener("click", (e) => {
          const b = e.target.closest("[data-size]");
          if (!b) return;
          size = b.dataset.size; renderSizes();
        });
        form.addEventListener("click", (e) => {
          const b = e.target.closest("[data-qty]");
          if (!b) return;
          form.qty.value = Math.max(1, Math.min(+form.qty.max || 10, (+form.qty.value || 1) + +b.dataset.qty));
          updateCTA();
        });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          if (!size) { sizesEl.classList.remove("shake"); void sizesEl.offsetWidth; sizesEl.classList.add("shake"); note.textContent = "Please choose a size"; note.classList.add("accent"); return; }
          const r = S.add(p.slug, color(), size, +form.qty.value || 1);
          if (r.ok) { openCart(); if (r.capped) toast("Added the last available units"); }
          else toast(r.reason);
        });
        const modal = $("[data-size-modal]", root);
        const sg = $("[data-size-guide]", root);
        if (sg) sg.addEventListener("click", () => modal.showModal());
        modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-modal-close]")) modal.close(); });
        // mobile gallery index
        const track = $("[data-gallery-track]", root);
        track.addEventListener("scroll", () => {
          const i = Math.round(track.scrollLeft / track.clientWidth);
          $("[data-gallery-index]", root).textContent = i + 1;
        }, { passive: true });
        renderSizes();
      },
    };
  };

  function sizeGuideTable(p) {
    if (p.category === "footwear") {
      const rows = [["39", "6", "25.0"], ["40", "7", "25.7"], ["41", "8", "26.3"], ["42", "8.5", "27.0"], ["43", "9.5", "27.7"], ["44", "10.5", "28.3"], ["45", "11", "29.0"]];
      return `<table class="table"><thead><tr><th>EU</th><th>US</th><th>Foot (cm)</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="muted">Measure your foot heel-to-toe standing. Between sizes, take the larger.</p>`;
    }
    const rows = [["XS", "84–88", "68–72", "76"], ["S", "88–94", "72–78", "78"], ["M", "94–100", "78–84", "80"], ["L", "100–106", "84–90", "82"], ["XL", "106–112", "90–96", "84"], ["XXL", "112–120", "96–104", "86"]].filter((r) => p.sizes.includes(r[0]));
    return `<table class="table"><thead><tr><th>Size</th><th>Chest (cm)</th><th>Waist (cm)</th><th>Length (cm)</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p class="muted"><b>Fit:</b> ${esc(p.fit)}</p>`;
  }

  /* --------------------------- COLLECTIONS ------------------------------ */
  views.collections = () => ({
    title: `Collections — ${B.name}`,
    description: `Explore ${B.name} collections: ${C.collections.map((c) => c.name).join(", ")}.`,
    html: `
      <section class="page-head wrap">
        <nav class="crumbs label" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span><span aria-current="page">Collections</span></nav>
        <div class="page-head__row"><h1 class="display page-title">Collections</h1><p class="label muted">${C.collections.length} Stories</p></div>
      </section>
      <section class="cindex wrap">
        ${C.collections.filter((c) => c.status === "live").map((c, i) => {
          const n = C.products.filter((p) => p.collection === c.slug).length;
          return `
          <a class="cindex__item ${i % 2 ? "is-rev" : ""}" href="#/collections/${c.slug}">
            <div class="cindex__media media" data-reveal="img">${pic(c.cover, { ratio: 1.15, sizes: "(min-width: 768px) 55vw, 100vw", alt: `${esc(c.name)} campaign image` })}</div>
            <div class="cindex__text" data-reveal>
              <p class="label muted">${String(i + 1).padStart(2, "0")} — ${esc(c.label)}</p>
              <h2 class="display cindex__title">${esc(c.name)}</h2>
              <p class="cindex__intro">${esc(c.intro)}</p>
              <p class="muted">${esc(c.description)}</p>
              <span class="link-arrow">View ${n} pieces ${ICON.arrow}</span>
            </div>
          </a>`;
        }).join("")}
      </section>`,
  });

  views.collection = ([slug]) => {
    const c = collectionBySlug(slug);
    if (!c) return views.notFound();
    const list = C.products.filter((p) => p.collection === c.slug);
    const idx = C.collections.indexOf(c);
    const next = C.collections[(idx + 1) % C.collections.length];
    return {
      title: `${esc(c.name)} — ${esc(c.season)} | ${B.name}`,
      description: c.description,
      image: I.src(c.hero, 1200, 630),
      ld: { "@context": "https://schema.org", "@type": "CollectionPage", name: c.name, description: c.description, hasPart: list.map((p) => ({ "@type": "Product", name: p.name, url: `${B.url}/#/product/${p.slug}` })) },
      html: `
      <section class="chero">
        <div class="chero__media" data-hero-media>${pic(c.hero, { ratio: 0.56, sizes: "100vw", alt: `${esc(c.name)} campaign`, eager: true, widths: [800, 1200, 1600, 2200] })}</div>
        <div class="chero__text wrap">
          <p class="label" data-in="1">${esc(c.label)} <span class="dot"></span> ${esc(c.season)}</p>
          <h1 class="display chero__title"><span class="line"><span data-in="2">${esc(c.name)}</span></span></h1>
        </div>
      </section>
      <nav class="cnav wrap" aria-label="Collections">
        ${C.collections.map((x) => `<a href="#/collections/${x.slug}" class="${x.slug === c.slug ? "is-on" : ""}" ${x.slug === c.slug ? 'aria-current="page"' : ""}>${esc(x.name)}</a>`).join("")}
      </nav>
      <section class="cintro wrap">
        <h2 class="cintro__lead" data-reveal>${esc(c.intro)}</h2>
        <div class="cintro__body" data-reveal>
          <p>${esc(c.description)}</p>
          <ul class="cintro__notes">${c.notes.map((n) => `<li class="label">${esc(n)}</li>`).join("")}</ul>
        </div>
      </section>
      <section class="section wrap">
        <div class="shead" data-reveal><div><p class="label shead__kicker">${list.length} Pieces</p><h2 class="h2">Shop ${esc(c.name)}</h2></div><a class="link-arrow" href="#/shop?col=${c.slug}">Filter in shop ${ICON.arrow}</a></div>
        ${grid(list)}
      </section>
      <a class="cnext" href="#/collections/${next.slug}">
        <div class="cnext__media" data-parallax="0.08">${pic(next.cover, { ratio: 0.5, sizes: "100vw", alt: "" })}</div>
        <div class="cnext__text wrap">
          <span class="label">Next collection</span>
          <span class="display cnext__title">${esc(next.name)}</span>
          <span class="cnext__arrow">${ICON.arrow}</span>
        </div>
      </a>`,
    };
  };

  /* ------------------------------ ABOUT --------------------------------- */
  views.about = () => {
    const A = C.pages.about || {};
    const gallery = (A.gallery || []).filter(Boolean);
    return {
    title: `About — ${B.name}`,
    description: A.storyLead || `The story behind ${B.name}.`,
    html: `
      <section class="about-hero wrap">
        <p class="label" data-in="1">${esc(A.kicker)}</p>
        <h1 class="display about-hero__title">
          ${heroLines(A.title).map((l, i) => `<span class="line"><span data-in="${Math.min(i + 2, 4)}">${esc(l)}</span></span>`).join("")}
        </h1>
      </section>
      <section class="about-split wrap">
        <figure class="about-split__a media" data-reveal="img" data-parallax="0.05">${pic(A.storyImage, { ratio: 1.3, sizes: "(min-width: 768px) 55vw, 100vw", alt: "" })}</figure>
        <div class="about-split__text" data-reveal>
          <p class="label muted">01 — The Story</p>
          <p class="lead">${esc(A.storyLead)}</p>
          <p>${br(A.storyBody)}</p>
        </div>
        ${A.storyDetailImage ? `<figure class="about-split__b media" data-reveal="img" data-parallax="-0.08">${pic(A.storyDetailImage, { ratio: 1.25, sizes: "(min-width: 768px) 25vw, 60vw", alt: "" })}</figure>` : ""}
      </section>
      <section class="about-full" data-reveal="img">
        <div class="about-full__media" data-parallax="0.1">${pic(A.quoteImage, { ratio: 0.5, sizes: "100vw", alt: "", widths: [800, 1200, 1600, 2200] })}</div>
        <p class="display about-full__quote wrap">${br(A.quote)}</p>
      </section>
      <section class="section wrap principles">
        <div class="principles__head" data-reveal><p class="label muted">02 — Philosophy & Approach</p><h2 class="h2">${esc(A.principlesTitle)}</h2></div>
        <ol class="principles__list">
          ${(A.principles || []).map((pr, i) => `<li data-reveal><span class="principles__n">${String(i + 1).padStart(2, "0")}</span><h3>${esc(pr.title)}</h3><p>${esc(pr.body)}</p></li>`).join("")}
        </ol>
      </section>
      <section class="about-quality">
        <div class="wrap about-quality__inner">
          <div data-reveal>
            <p class="label">03 — Quality Statement</p>
            <h2 class="display about-quality__title">${esc(A.qualityTitle)}</h2>
          </div>
          <div class="about-quality__side" data-reveal>
            <p>${br(A.qualityBody)}</p>
            <dl class="about-quality__stats">
              ${(A.stats || []).map((st) => `<div><dt class="label">${esc(st.label)}</dt><dd>${esc(st.value)}</dd></div>`).join("")}
            </dl>
          </div>
        </div>
      </section>
      ${gallery.length ? `
      <section class="section wrap">
        ${sectionHead("04 — Campaign", esc(A.galleryTitle), { href: "#/collections", text: "Explore collections" })}
        <div class="about-gallery">
          ${gallery.slice(0, 4).map((id, i) => `
            <figure class="about-gallery__item about-gallery__item--${i + 1} media" data-reveal="img">${pic(id, { ratio: [1.6, 1.25, 1.6, 1.25][i], sizes: "(min-width: 768px) 33vw, 50vw", alt: "Campaign photograph" })}</figure>`).join("")}
        </div>
      </section>` : ""}
      ${newsletterSection()}`,
    };
  };

  /* ---------------------------- CONTACT / FAQ --------------------------- */
  views.contact = () => ({
    title: `Contact — ${B.name}`,
    description: `Contact the ${B.name} studio in London. ${B.email}`,
    html: `<section class="page-head wrap"><nav class="crumbs label" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span><span aria-current="page">Contact</span></nav></section>${contactSection("Studio")}${faqSection()}`,
  });
  views.faq = () => ({
    title: `FAQs — ${B.name}`,
    description: `Shipping, returns, sizing and care — answers to common questions about ${B.name}.`,
    ld: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: C.faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
    html: `<section class="page-head wrap"><nav class="crumbs label" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span><span aria-current="page">FAQs</span></nav></section>${faqSection()}`,
  });

  /* ---------------------------- WISHLIST -------------------------------- */
  views.wishlist = () => ({
    title: `Wishlist — ${B.name}`,
    description: "Your saved pieces.",
    html: `
      <section class="page-head wrap"><div class="page-head__row"><h1 class="display page-title">Wishlist</h1><p class="label muted">${S.wishlist.length} Saved</p></div></section>
      <section class="wrap section section--tight" data-wish-list>
        ${S.wishlist.length ? grid(S.wishlist) : `<div class="empty"><p class="display empty__title">Nothing saved yet</p><p class="muted">Tap the heart on any product to keep it here.</p><a class="btn btn--dark" href="#/shop">Explore the collection</a></div>`}
      </section>`,
  });

  /* ---------------------------- ACCOUNT --------------------------------- */
  views.account = () => ({
    title: `Account — ${B.name}`,
    description: "Sign in to your account.",
    html: `
      <section class="page-head wrap"><div class="page-head__row"><h1 class="display page-title">Account</h1></div></section>
      <section class="wrap account">
        <form class="form" data-form="login" novalidate>
          <h2 class="label">Sign in</h2>
          <div class="field"><label for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" required /><span class="field__err" aria-live="polite"></span></div>
          <div class="field"><label for="a-pass">Password</label><input id="a-pass" name="password" type="password" autocomplete="current-password" required minlength="6" /><span class="field__err" aria-live="polite"></span></div>
          <button class="btn btn--dark btn--full" type="submit">Sign In</button>
          <p class="form__ok" hidden>Customer accounts connect to your commerce backend (e.g. Shopify Customer Accounts). This demo stores orders in your browser.</p>
          <p class="muted small">New here? An account is created automatically at checkout.</p>
        </form>
        <div class="account__side">
          <h2 class="label">Order history</h2>
          ${S.orders.length ? `<ul class="orders">${S.orders.map((o) => `<li><a href="#/order/${o.id}"><span>#${o.id}</span><span class="muted">${new Date(o.createdAt).toLocaleDateString(B.locale, { day: "numeric", month: "short", year: "numeric" })}</span><span>${money(o.total)}</span><span class="label">${o.status}</span></a></li>`).join("")}</ul>` : `<p class="muted">No orders yet.</p>`}
          <div class="account__links"><a class="link-arrow" href="#/wishlist">Wishlist (${S.wishlist.length}) ${ICON.arrow}</a><a class="link-arrow" href="#/info/track-order">Track an order ${ICON.arrow}</a></div>
        </div>
      </section>`,
  });

  /* ---------------------------- CHECKOUT -------------------------------- */
  views.checkout = () => {
    if (!S.count) return {
      title: `Checkout — ${B.name}`, description: "",
      html: `<section class="wrap section"><div class="empty"><p class="display empty__title">Your bag is empty</p><p class="muted">Add something to your bag to check out.</p><a class="btn btn--dark" href="#/shop">Explore our collection</a></div></section>`,
    };
    return {
      title: `Checkout — ${B.name}`, description: "Secure checkout.",
      html: `
      <section class="checkout wrap">
        <form class="form checkout__form" data-checkout novalidate>
          <h1 class="display page-title page-title--sm">Checkout</h1>
          <fieldset><legend class="label">01 — Contact</legend>
            <div class="field"><label for="k-email">Email</label><input id="k-email" name="email" type="email" autocomplete="email" required /><span class="field__err"></span></div>
            <label class="check"><input type="checkbox" name="news" checked /><span>Email me early access to new drops</span></label>
          </fieldset>
          <fieldset><legend class="label">02 — Shipping address</legend>
            <div class="form__2">
              <div class="field"><label for="k-fn">First name</label><input id="k-fn" name="first" autocomplete="given-name" required /><span class="field__err"></span></div>
              <div class="field"><label for="k-ln">Last name</label><input id="k-ln" name="last" autocomplete="family-name" required /><span class="field__err"></span></div>
            </div>
            <div class="field"><label for="k-a1">Address</label><input id="k-a1" name="address" autocomplete="address-line1" required /><span class="field__err"></span></div>
            <div class="form__3">
              <div class="field"><label for="k-city">City</label><input id="k-city" name="city" autocomplete="address-level2" required /><span class="field__err"></span></div>
              <div class="field"><label for="k-zip">Postcode</label><input id="k-zip" name="zip" autocomplete="postal-code" required /><span class="field__err"></span></div>
              <div class="field"><label for="k-country">Country</label>
                <select id="k-country" name="country" autocomplete="country-name" required>
                  ${["United Kingdom", "United States", "Canada", "France", "Germany", "Italy", "Netherlands", "Spain", "Japan", "Australia", "Nigeria", "South Africa", "United Arab Emirates"].map((c) => `<option>${c}</option>`).join("")}
                </select><span class="field__err"></span></div>
            </div>
          </fieldset>
          <fieldset><legend class="label">03 — Delivery</legend>
            <div class="ship-opts">
              ${B.shippingRates.map((r, i) => `<label class="ship-opt"><input type="radio" name="shipping" value="${r.id}" ${i === 0 ? "checked" : ""} /><span><b>${r.label}</b><em class="muted">${r.eta}</em></span><span data-ship-price="${r.id}"></span></label>`).join("")}
            </div>
          </fieldset>
          <fieldset><legend class="label">04 — Payment</legend>
            <div class="pay-note">
              <p>Payment is completed on the secure hosted checkout of your commerce provider (Shopify Checkout, Stripe, Adyen). Card details are never handled by this storefront.</p>
              <div class="pay-marks label muted"><span>Visa</span><span>Mastercard</span><span>Amex</span><span>Apple Pay</span><span>Google Pay</span><span>Klarna</span></div>
            </div>
          </fieldset>
          <button class="btn btn--dark btn--full" type="submit" data-place>Place order</button>
          <p class="muted small">By placing your order you agree to our <a class="u" href="#/info/terms">Terms</a> and <a class="u" href="#/info/privacy">Privacy Policy</a>.</p>
        </form>
        <aside class="summary" data-summary></aside>
      </section>`,
      mount(root) {
        const form = $("[data-checkout]", root);
        const renderSummary = () => {
          const ship = S.shippingFor(form.shipping.value);
          B.shippingRates.forEach((r) => { $(`[data-ship-price="${r.id}"]`, root).textContent = S.shippingFor(r.id) ? money(S.shippingFor(r.id)) : "Free"; });
          $("[data-summary]", root).innerHTML = `
            <p class="label">Order summary · ${S.count} ${S.count === 1 ? "item" : "items"}</p>
            <ul class="summary__lines">${S.lines.map((l) => `
              <li><div class="summary__img">${pic(l.product.images[0], { ratio: 1.3333, sizes: "80px", alt: "", widths: [120, 200] })}<span>${l.qty}</span></div>
              <div><p>${esc(l.product.name)}</p><p class="muted label">${esc(l.color)} / ${l.size}</p></div><p>${money(S.unitPrice(l.product) * l.qty)}</p></li>`).join("")}</ul>
            <dl class="summary__tot">
              <div><dt>Subtotal</dt><dd>${money(S.subtotal)}</dd></div>
              <div><dt>Shipping</dt><dd>${ship ? money(ship) : "Free"}</dd></div>
              <div><dt>Duties & taxes</dt><dd>Included</dd></div>
              <div class="summary__grand"><dt>Total</dt><dd>${money(S.subtotal + ship)}</dd></div>
            </dl>`;
        };
        form.addEventListener("change", renderSummary);
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          if (!validate(form)) return;
          const d = Object.fromEntries(new FormData(form));
          const order = S.placeOrder({ email: d.email, shipping: d.shipping, address: { first: d.first, last: d.last, line1: d.address, city: d.city, zip: d.zip, country: d.country } });
          go(`#/order/${order.id}`);
        });
        renderSummary();
      },
    };
  };

  views.order = ([id]) => {
    const o = S.orders.find((x) => x.id === id);
    if (!o) return views.notFound();
    return {
      title: `Order #${o.id} — ${B.name}`, description: "",
      html: `
      <section class="wrap section order">
        <p class="label accent">Order confirmed</p>
        <h1 class="display page-title">Thank you, ${esc(o.shippingAddress.first)}.</h1>
        <p class="lead">Order <b>#${o.id}</b> is confirmed. A receipt is on its way to ${esc(o.email)}, and you'll get a tracking link as soon as it leaves the studio.</p>
        <div class="order__grid">
          <div><p class="label muted">Shipping to</p><p>${esc(o.shippingAddress.first)} ${esc(o.shippingAddress.last)}<br/>${esc(o.shippingAddress.line1)}<br/>${esc(o.shippingAddress.city)} ${esc(o.shippingAddress.zip)}<br/>${esc(o.shippingAddress.country)}</p></div>
          <div><p class="label muted">Delivery</p><p>${esc((B.shippingRates.find((r) => r.id === o.shippingMethod) || {}).label)} — ${esc((B.shippingRates.find((r) => r.id === o.shippingMethod) || {}).eta)}</p></div>
          <div><p class="label muted">Items</p>${o.lines.map((l) => `<p>${l.qty} × ${esc(l.name)} <span class="muted">(${esc(l.color)} / ${l.size})</span></p>`).join("")}</div>
          <div><p class="label muted">Total</p><p class="h2">${money(o.total)}</p></div>
        </div>
        <a class="btn btn--dark" href="#/shop">Continue shopping</a>
      </section>`,
    };
  };

  /* ---------------------------- INFO PAGES ------------------------------ */
  const INFO = new Proxy({}, {
    get: (_, k) => { const pg = (C.pages.info || {})[k]; return pg && [pg.title, (pg.blocks || []).map((bl) => [bl.heading, bl.body])]; },
    ownKeys: () => Object.keys(C.pages.info || {}),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  views.info = ([slug]) => {
    const page = INFO[slug];
    if (!page) return views.notFound();
    return {
      title: `${esc(page[0])} — ${B.name}`, description: page[1][0]?.[1] || "",
      html: `
      <section class="page-head wrap"><nav class="crumbs label" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span><span aria-current="page">${esc(page[0])}</span></nav>
      <div class="page-head__row"><h1 class="display page-title">${esc(page[0])}</h1></div></section>
      <section class="wrap info">
        <nav class="info__nav label" aria-label="Customer care">${Object.entries(INFO).map(([k, v]) => `<a href="#/info/${k}" class="${k === slug ? "is-on" : ""}">${esc(v[0])}</a>`).join("")}<a href="#/faq">FAQs</a></nav>
        <div class="info__body">
          ${page[1].map(([h, p]) => `<div class="info__block" data-reveal><h2 class="label">${esc(h)}</h2><p>${esc(p)}</p></div>`).join("")}
          ${slug === "track-order" ? `
          <form class="form" data-form="track" novalidate>
            <div class="form__2">
              <div class="field"><label for="t-id">Order number</label><input id="t-id" name="order" required placeholder="ST1234567" /><span class="field__err"></span></div>
              <div class="field"><label for="t-email">Email</label><input id="t-email" name="email" type="email" required /><span class="field__err"></span></div>
            </div>
            <button class="btn btn--dark" type="submit">Track</button>
            <p class="form__ok" hidden></p>
          </form>` : ""}
        </div>
      </section>`,
    };
  };

  views.notFound = () => ({
    title: `Not found — ${B.name}`, description: "",
    html: `<section class="wrap section"><div class="empty"><p class="label muted">404</p><p class="display empty__title">This page moved on</p><p class="muted">The page you're after doesn't exist — the collection does.</p><a class="btn btn--dark" href="#/shop">Shop all products</a></div></section>`,
  });

  /* ---------------------------------------------------------------------- */
  /* Footer                                                                  */
  /* ---------------------------------------------------------------------- */
  function renderFooter() {
    const col = (title, links) => `<div class="footer__col"><p class="label">${title}</p><ul>${links.map(([t, h]) => `<li><a href="${h}">${t}</a></li>`).join("")}</ul></div>`;
    $("#footer").innerHTML = `
      <div class="wrap footer__top">
        <div class="footer__brand">
          <a class="logo logo--footer" href="#/">${B.name}</a>
          <p class="footer__tag">${esc(B.tagline)}</p>
          <p class="muted-d">${esc(B.description)}</p>
          <form class="inline-form inline-form--dark" data-form="newsletter" novalidate>
            <label for="f-email" class="sr-only">Email address</label>
            <input id="f-email" name="email" type="email" placeholder="Email address" autocomplete="email" required />
            <button class="btn btn--light" type="submit">Join</button>
            <span class="field__err" aria-live="polite"></span>
          </form>
          <p class="form__ok" hidden>You're on the list.</p>
          <div class="footer__social">
            <a href="${B.socialLinks.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${ICON.insta}</a>
            <a href="${B.socialLinks.tiktok}" target="_blank" rel="noopener" aria-label="TikTok">${ICON.tiktok}</a>
            <a href="${B.socialLinks.pinterest}" target="_blank" rel="noopener" aria-label="Pinterest">${ICON.pin}</a>
            <a href="${B.socialLinks.youtube}" target="_blank" rel="noopener" aria-label="YouTube">${ICON.yt}</a>
          </div>
        </div>
        <div class="footer__cols">
          ${col("Collections", [["Women", "#/shop?dept=women"], ["Men", "#/shop?dept=men"], ["Tops", "#/shop?cat=tops"], ["Outerwear", "#/shop?cat=outerwear"], ["Bottoms", "#/shop?cat=bottoms"], ["Footwear", "#/shop?cat=footwear"], ["Accessories", "#/shop?cat=accessories"]])}
          ${col("Explore", [["New Arrivals", "#/shop?new=1"], ["Collections", "#/collections"], ["Lookbook", "#/collections/obsidian-series"], ["About", "#/about"], ["Contact", "#/contact"]])}
          ${col("Customer", [["Shipping", "#/info/shipping"], ["Returns", "#/info/returns"], ["Size Guide", "#/info/size-guide"], ["FAQs", "#/faq"], ["Track Order", "#/info/track-order"]])}
          ${col("Legal", [["Privacy Policy", "#/info/privacy"], ["Terms", "#/info/terms"], ["Cookie Policy", "#/info/cookies"]])}
        </div>
      </div>
      <div class="footer__mark" aria-hidden="true">${B.name}</div>
      <div class="wrap footer__bottom">
        <p>© 2026 ${B.name}. All rights reserved.</p>
        <p>${esc(B.location.line2.split(" ")[0])} — Worldwide</p>
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Cart drawer                                                             */
  /* ---------------------------------------------------------------------- */
  const cartEl = $("#cart"), scrim = $("#scrim");
  let lastFocus = null;

  function renderCart() {
    const n = S.count;
    $$("[data-cart-count]").forEach((el) => { el.textContent = n; el.classList.toggle("is-empty", !n); });
    $("[data-cart-count-text]").textContent = n ? `(${n})` : "";
    const sub = S.subtotal, left = Math.max(0, B.freeShippingThreshold - sub);
    $("#cart-ship").innerHTML = n ? `
      <p class="label">${left ? `You're ${money(left)} away from free shipping` : "You've unlocked free worldwide shipping"}</p>
      <div class="meter"><span style="transform: scaleX(${Math.min(1, sub / B.freeShippingThreshold)})"></span></div>` : "";
    $("#cart-body").innerHTML = n
      ? `<ul class="lines">${S.lines.map((l) => `
        <li class="cline" data-sku="${l.sku}">
          <a class="cline__img" href="#/product/${l.slug}" data-close-cart>${pic(l.product.images[0], { ratio: 1.3333, sizes: "96px", alt: l.product.name, widths: [120, 200] })}</a>
          <div class="cline__info">
            <div class="cline__top">
              <a href="#/product/${l.slug}" data-close-cart class="cline__name">${esc(l.product.name)}</a>
              <span class="cline__price">${money(S.unitPrice(l.product) * l.qty)}</span>
            </div>
            <p class="label muted">${esc(l.color)} / Size ${l.size}</p>
            <div class="cline__row">
              <div class="qty qty--sm">
                <button data-line-qty="-1" aria-label="Decrease quantity">${ICON.minus}</button>
                <span aria-live="polite">${l.qty}</span>
                <button data-line-qty="1" aria-label="Increase quantity">${ICON.plus}</button>
              </div>
              <button class="btn-text u label" data-line-remove>Remove</button>
            </div>
          </div>
        </li>`).join("")}</ul>`
      : `<div class="cart-empty"><p class="display cart-empty__title">Your bag is empty</p><p class="muted">Start with the essentials.</p><a class="btn btn--dark" href="#/shop" data-close-cart>Explore our collection</a>
         <div class="cart-empty__sug">${C.products.filter((p) => p.bestSeller).slice(0, 2).map((p) => `<a href="#/product/${p.slug}" data-close-cart>${pic(p.images[0], { ratio: 1.3333, sizes: "180px", alt: p.name, widths: [240, 360] })}<span class="label">${esc(p.name)}</span></a>`).join("")}</div></div>`;
    $("#cart-foot").innerHTML = n ? `
      <div class="drawer__sub"><span class="label">Subtotal</span><span>${money(sub)}</span></div>
      <p class="muted small">Shipping, duties and taxes calculated at checkout.</p>
      <a class="btn btn--dark btn--full" href="#/checkout" data-close-cart>Checkout <span class="btn__sep"></span> ${money(sub)}</a>
      <button class="btn btn--outline btn--full" data-close-cart>Continue Shopping</button>` : "";
  }

  function openCart() {
    lastFocus = document.activeElement;
    scrim.hidden = false;
    requestAnimationFrame(() => { document.body.classList.add("cart-open"); });
    cartEl.setAttribute("aria-hidden", "false");
    lockScroll(true);
    setTimeout(() => $(".drawer__head .icon-btn", cartEl).focus(), 50);
  }
  function closeCart() {
    document.body.classList.remove("cart-open");
    cartEl.setAttribute("aria-hidden", "true");
    lockScroll(false);
    setTimeout(() => { if (!document.body.classList.contains("cart-open")) scrim.hidden = true; }, 450);
    if (lastFocus) lastFocus.focus?.();
  }

  cartEl.addEventListener("click", (e) => {
    const line = e.target.closest("[data-sku]");
    const q = e.target.closest("[data-line-qty]");
    if (q && line) {
      const cur = S.lines.find((l) => l.sku === line.dataset.sku);
      S.setQty(line.dataset.sku, cur.qty + +q.dataset.lineQty);
    }
    if (e.target.closest("[data-line-remove]") && line) {
      line.classList.add("is-removing");
      setTimeout(() => S.remove(line.dataset.sku), 220);
    }
  });

  /* ---------------------------------------------------------------------- */
  /* Search overlay                                                          */
  /* ---------------------------------------------------------------------- */
  const searchEl = $("#search"), sInput = $("#search-input"), sBody = $("#search-body");
  function renderSearch(q) {
    q = q.trim();
    if (!q) {
      sBody.innerHTML = `
        <div class="search__idle wrap">
          <div><p class="label muted">Popular searches</p><div class="search__chips">${["Coat", "Hoodie", "Heavyweight tee", "Trouser", "Black", "Leather"].map((t) => `<button class="fchip" data-sq="${t}">${t}</button>`).join("")}</div></div>
          <div><p class="label muted">Collections</p><ul class="search__cols">${C.collections.map((c) => `<li><a href="#/collections/${c.slug}" data-close-search>${esc(c.name)}</a></li>`).join("")}</ul></div>
          <div class="search__trend"><p class="label muted">Trending now</p><div class="search__results">${C.products.filter((p) => p.bestSeller).slice(0, 4).map(searchItem).join("")}</div></div>
        </div>`;
      return;
    }
    const hits = C.products.filter((p) => matchesQuery(p, q));
    const cols = C.collections.filter((c) => (c.name + " " + c.intro).toLowerCase().includes(q.toLowerCase()));
    sBody.innerHTML = hits.length || cols.length
      ? `<div class="wrap">
          <div class="search__meta"><p class="label muted">${hits.length} ${hits.length === 1 ? "product" : "products"} for “${esc(q)}”</p>${hits.length ? `<a class="link-arrow" href="#/shop?q=${encodeURIComponent(q)}" data-close-search>View all results ${ICON.arrow}</a>` : ""}</div>
          ${cols.length ? `<div class="search__chips">${cols.map((c) => `<a class="fchip" href="#/collections/${c.slug}" data-close-search>Collection — ${esc(c.name)}</a>`).join("")}</div>` : ""}
          <div class="search__results">${hits.slice(0, 8).map(searchItem).join("")}</div>
        </div>`
      : `<div class="wrap search__empty"><p class="display empty__title">No results for “${esc(q)}”</p><p class="muted">Check the spelling, or try a broader term like “coat”, “tee” or “black”.</p><div class="search__chips">${C.categories.map((c) => `<a class="fchip" href="#/shop?${c.type === "gender" ? "dept" : "cat"}=${c.slug}" data-close-search>${esc(c.name)}</a>`).join("")}</div></div>`;
  }
  const searchItem = (p) => `
    <a class="sitem" href="#/product/${p.slug}" data-close-search>
      <div class="sitem__img">${pic(p.images[0], { ratio: 1.3333, sizes: "(min-width: 768px) 20vw, 40vw", alt: p.name, widths: [240, 400, 600] })}</div>
      <p class="label muted">${catName(p.category)}</p>
      <p class="sitem__name">${esc(p.name)}</p>
      <p>${priceHTML(p)}</p>
    </a>`;
  function openSearch() {
    if (document.body.classList.contains("menu-open")) toggleMenu(false);
    lastFocus = document.activeElement;
    searchEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("search-open");
    lockScroll(true);
    renderSearch(sInput.value);
    setTimeout(() => sInput.focus(), 60);
  }
  function closeSearch() {
    searchEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("search-open");
    lockScroll(false);
  }
  let sTimer;
  sInput.addEventListener("input", () => { clearTimeout(sTimer); sTimer = setTimeout(() => renderSearch(sInput.value), 120); });
  sInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && sInput.value.trim()) { closeSearch(); go(`#/shop?q=${encodeURIComponent(sInput.value.trim())}`); } });
  searchEl.addEventListener("click", (e) => { const c = e.target.closest("[data-sq]"); if (c) { sInput.value = c.dataset.sq; renderSearch(c.dataset.sq); sInput.focus(); } });

  /* ---------------------------------------------------------------------- */
  /* Mobile nav                                                              */
  /* ---------------------------------------------------------------------- */
  const burger = $("#burger"), mnav = $("#mnav");
  function toggleMenu(force) {
    const open = force ?? !document.body.classList.contains("menu-open");
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mnav.setAttribute("aria-hidden", !open);
    lockScroll(open);
  }
  burger.addEventListener("click", () => toggleMenu());
  mnav.addEventListener("click", (e) => { if (e.target.closest("a")) toggleMenu(false); });

  /* ---------------------------------------------------------------------- */
  /* Global delegation                                                       */
  /* ---------------------------------------------------------------------- */
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-open-cart]")) { e.preventDefault(); openCart(); return; }
    if (t.closest("[data-close-cart]") || t === scrim) { closeCart(); }
    if (t.closest("[data-open-search]")) { e.preventDefault(); openSearch(); return; }
    if (t.closest("[data-close-search]")) closeSearch();

    const skip = t.closest(".skip");
    if (skip) { e.preventDefault(); $("#main").focus(); return; }

    const wish = t.closest("[data-wish]");
    if (wish) {
      e.preventDefault();
      const on = S.toggleWish(wish.dataset.wish);
      $$(`[data-wish="${wish.dataset.wish}"]`).forEach((b) => { b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); });
      toast(on ? "Saved to wishlist" : "Removed from wishlist", on ? { href: "#/wishlist", text: "View" } : null);
      return;
    }

    const qt = t.closest("[data-quick-toggle]");
    if (qt) {
      const q = qt.closest("[data-quick]");
      const open = !q.classList.contains("is-open");
      $$("[data-quick].is-open").forEach((x) => x.classList.remove("is-open"));
      q.classList.toggle("is-open", open);
      return;
    }
    const qa = t.closest("[data-quick-add]");
    if (qa) {
      const r = S.add(qa.dataset.quickAdd, qa.dataset.color, qa.dataset.size, 1);
      qa.closest("[data-quick]").classList.remove("is-open");
      if (r.ok) openCart(); else toast(r.reason);
      return;
    }
    if (!t.closest("[data-quick]")) $$("[data-quick].is-open").forEach((x) => x.classList.remove("is-open"));

    const acc = t.closest(".acc__btn");
    if (acc) toggleAcc(acc);

    const like = t.closest("[data-like]");
    if (like) {
      const on = like.getAttribute("aria-pressed") !== "true";
      like.setAttribute("aria-pressed", on);
      like.classList.toggle("is-on", on);
      like.closest(".post").querySelector("[data-like-count]").textContent = (+like.dataset.like + (on ? 1 : 0)).toLocaleString(B.locale);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.body.classList.contains("cart-open")) closeCart();
    if (document.body.classList.contains("search-open")) closeSearch();
    if (document.body.classList.contains("menu-open")) toggleMenu(false);
    const f = $(".shop.filters-open"); if (f) { f.classList.remove("filters-open"); lockScroll(false); }
  });

  // Keep focus inside open dialogs
  document.addEventListener("focusin", (e) => {
    const box = document.body.classList.contains("cart-open") ? cartEl : document.body.classList.contains("search-open") ? searchEl : null;
    if (box && !box.contains(e.target)) { const f = box.querySelector("button, a, input"); f && f.focus(); }
  });

  function toggleAcc(btn) {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    const open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", open);
    panel.style.height = panel.scrollHeight + "px";
    if (open) {
      panel.classList.add("is-open");
      panel.addEventListener("transitionend", function te() { if (btn.getAttribute("aria-expanded") === "true") panel.style.height = "auto"; panel.removeEventListener("transitionend", te); });
    } else {
      requestAnimationFrame(() => { panel.style.height = "0px"; panel.classList.remove("is-open"); });
    }
  }

  /* Forms — subtle inline validation */
  function validate(form) {
    let ok = true;
    $$("input, textarea, select", form).forEach((el) => {
      const err = el.closest(".field, .inline-form")?.querySelector(".field__err");
      if (!err || !el.willValidate) return;
      let msg = "";
      if (el.validity.valueMissing) msg = el.type === "email" ? "Please enter your email" : "This field is required";
      else if (el.validity.typeMismatch) msg = "Please enter a valid email address";
      else if (el.validity.tooShort) msg = `Please enter at least ${el.minLength} characters`;
      err.textContent = msg;
      el.classList.toggle("is-invalid", !!msg);
      el.setAttribute("aria-invalid", !!msg);
      if (msg && ok) { el.focus(); ok = false; }
    });
    return ok;
  }
  document.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    if (!validate(form)) return;
    const ok = form.parentElement.querySelector(".form__ok") || form.querySelector(".form__ok");
    if (form.dataset.form === "track") {
      const d = Object.fromEntries(new FormData(form));
      const o = S.orders.find((x) => x.id.toLowerCase() === d.order.trim().toLowerCase().replace("#", "") && x.email.toLowerCase() === d.email.trim().toLowerCase());
      ok.textContent = o ? `Order #${o.id} is ${o.status} — preparing for dispatch from London.` : "We couldn't find an order with those details. Check your confirmation email or contact us.";
      ok.hidden = false;
      return;
    }
    if (ok) { ok.hidden = false; }
    if (form.dataset.form !== "login") { form.reset(); if (form.dataset.form === "newsletter") form.hidden = true; }
    toast(form.dataset.form === "contact" ? "Message sent" : form.dataset.form === "newsletter" ? "You're on the list" : "Signed in (demo)");
  });
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.classList.contains("is-invalid") && el.checkValidity()) {
      el.classList.remove("is-invalid"); el.removeAttribute("aria-invalid");
      const err = el.closest(".field, .inline-form")?.querySelector(".field__err"); if (err) err.textContent = "";
    }
  });

  /* Toast */
  let toastTimer;
  function toast(msg, action) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<a href="${action.href}" class="u">${action.text}</a>` : ""}`;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 2600);
  }

  function lockScroll() {
    requestAnimationFrame(() => {
      const b = document.body.classList;
      document.documentElement.classList.toggle("is-locked", b.contains("cart-open") || b.contains("search-open") || b.contains("menu-open") || !!$(".shop.filters-open"));
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Motion: reveal, parallax, rails                                         */
  /* ---------------------------------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  function observe(root = document) {
    $$("[data-reveal]:not(.is-in)", root).forEach((el) => (reduceMotion ? el.classList.add("is-in") : io.observe(el)));
  }

  let parallaxEls = [], heroMedia = null, ticking = false;
  function collectParallax() {
    parallaxEls = reduceMotion ? [] : $$("[data-parallax]");
    heroMedia = reduceMotion ? null : $("[data-hero-media]");
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY, vh = innerHeight;
      document.body.classList.toggle("is-scrolled", y > 8);
      if (heroMedia) {
        const p = Math.min(1, y / vh);
        heroMedia.style.transform = `translate3d(0, ${y * 0.28}px, 0) scale(${1.04 + p * 0.08})`;
      }
      for (const el of parallaxEls) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        const k = parseFloat(el.dataset.parallax) || 0.08;
        const off = (r.top + r.height / 2 - vh / 2) * k;
        el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
      }
      ticking = false;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);

  function mountRails(root) {
    $$("[data-rail]", root).forEach((rail) => {
      const track = $("[data-rail-track]", rail), bar = $("[data-rail-progress]", rail);
      const step = () => (track.firstElementChild?.getBoundingClientRect().width || 300) + 16;
      const upd = () => {
        const max = track.scrollWidth - track.clientWidth;
        const p = max > 0 ? track.scrollLeft / max : 1;
        const vis = track.scrollWidth ? track.clientWidth / track.scrollWidth : 1;
        bar.style.width = `${Math.max(vis, 0.12) * 100}%`;
        bar.style.transform = `translateX(${p * (1 / Math.max(vis, 0.12) - 1) * 100}%)`;
      };
      $("[data-rail-prev]", rail).addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
      $("[data-rail-next]", rail).addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
      track.addEventListener("scroll", upd, { passive: true });
      // drag to scroll on desktop
      let down = false, sx = 0, sl = 0, moved = false;
      track.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; track.classList.add("is-drag"); });
      addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; track.scrollLeft = sl - dx; });
      addEventListener("pointerup", () => { down = false; track.classList.remove("is-drag"); });
      track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      track.addEventListener("dragstart", (e) => e.preventDefault());
      upd(); addEventListener("resize", upd);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* SEO                                                                     */
  /* ---------------------------------------------------------------------- */
  function setMeta(v) {
    document.title = v.title;
    const set = (sel, attr, val) => { let m = document.head.querySelector(sel); if (!m) { m = document.createElement("meta"); const [k, n] = sel.match(/\[(.+?)="(.+?)"\]/).slice(1); m.setAttribute(k, n); document.head.appendChild(m); } m.setAttribute(attr, val); };
    set('meta[name="description"]', "content", v.description || B.description);
    set('meta[property="og:title"]', "content", v.title);
    set('meta[property="og:description"]', "content", v.description || B.description);
    set('meta[property="og:type"]', "content", v.type || "website");
    set('meta[property="og:url"]', "content", B.url + "/" + location.hash);
    if (v.image) set('meta[property="og:image"]', "content", v.image);
    $('link[rel="canonical"]').href = B.url + "/" + location.hash.split("?")[0];
    $("#ld-page").textContent = v.ld ? JSON.stringify(v.ld) : "";
  }

  /* ---------------------------------------------------------------------- */
  /* Router                                                                  */
  /* ---------------------------------------------------------------------- */
  const routes = [
    [/^\/?$/, views.home, ""],
    [/^\/shop$/, views.shop, "shop"],
    [/^\/product\/([\w-]+)$/, views.product, "product"],
    [/^\/collections$/, views.collections, "collections"],
    [/^\/collections\/([\w-]+)$/, views.collection, "collections"],
    [/^\/about$/, views.about, "about"],
    [/^\/contact$/, views.contact, "contact"],
    [/^\/faq$/, views.faq, "faq"],
    [/^\/wishlist$/, views.wishlist, "wishlist"],
    [/^\/account$/, views.account, "account"],
    [/^\/checkout$/, views.checkout, "checkout"],
    [/^\/order\/(\w+)$/, views.order, "order"],
    [/^\/info\/([\w-]+)$/, views.info, "info"],
  ];

  const main = $("#main");
  let current = null, firstRender = true;

  function go(hash) { location.hash = hash; }

  function resolve() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    const query = new URLSearchParams(qs || "");
    for (const [re, view, key] of routes) {
      const m = path.match(re);
      if (m) return { view: view(m.slice(1), query), key, path, query };
    }
    return { view: views.notFound(), key: "404", path, query };
  }

  function activeNav(path, query) {
    $$("[data-nav]").forEach((a) => a.classList.remove("is-on"));
    const on = (k) => $(`[data-nav="${k}"]`)?.classList.add("is-on");
    if (path.startsWith("/collections")) on("collections");
    else if (path === "/shop") {
      if (query.get("new")) on("new");
      else if (query.get("dept") === "women") on("women");
      else if (query.get("dept") === "men") on("men");
      else if (query.get("cat") === "accessories") on("accessories");
    }
  }

  function render() {
    const { view, key, path, query } = resolve();
    const swap = () => {
      current?.unmount?.();
      main.innerHTML = view.html;
      main.dataset.route = key || "home";
      document.body.dataset.route = key || "home";
      setMeta(view);
      activeNav(path, query);
      if (!firstRender) scrollTo({ top: 0, behavior: "instant" });
      view.mount?.(main);
      mountRails(main);
      observe(main);
      collectParallax();
      onScroll();
      requestAnimationFrame(() => { main.classList.remove("is-leaving"); main.classList.add("is-entering"); requestAnimationFrame(() => main.classList.remove("is-entering")); });
      current = view;
      firstRender = false;
    };
    if (firstRender || reduceMotion) swap();
    else { main.classList.add("is-leaving"); setTimeout(swap, 220); }
  }

  addEventListener("hashchange", () => {
    if (document.body.classList.contains("cart-open")) closeCart();
    if (document.body.classList.contains("search-open")) closeSearch();
    render();
  });

  S.subscribe((evt) => {
    renderCart();
    if (evt.type === "cart:add") { const b = $(".bag-btn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
    if (evt.type === "wish" && main.dataset.route === "wishlist") render();
  });

  /* Init */
  $$("[data-brand]").forEach((el) => (el.textContent = B.name));
  const ann = $("[data-announce]");
  const annText = `${esc(B.announcement.text)} <span class="announce__dot"></span> <u>${esc(B.announcement.cta)}</u>`;
  ann.innerHTML = Array(6).fill(`<span>${annText}</span>`).join("");
  $("#announce").href = B.announcement.href;
  renderFooter();
  renderCart();
  render();
  requestAnimationFrame(() => document.body.classList.add("is-ready"));
})();
