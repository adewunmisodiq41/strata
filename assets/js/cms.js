/* ==========================================================================
   STRATA — CONTENT (CMS)
   Every product, collection, category, testimonial and FAQ on the site is
   rendered from this file. Field names mirror Shopify's Storefront API
   (handle → slug, variants[].sku / availableForSale / quantityAvailable)
   so this module can be replaced by a fetch to Shopify, Sanity, Contentful
   or any headless CMS without touching the view code. See README.md.
   ========================================================================== */

(function () {
  const APPAREL = ["XS", "S", "M", "L", "XL", "XXL"];
  const FOOTWEAR = ["39", "40", "41", "42", "43", "44", "45"];
  const ONE = ["OS"];

  const COLORS = {
    black: { name: "Black", hex: "#141413" },
    charcoal: { name: "Charcoal", hex: "#3B3B39" },
    stone: { name: "Stone", hex: "#BDB6A8" },
    bone: { name: "Bone", hex: "#E8E3D8" },
    ash: { name: "Ash", hex: "#8E8C87" },
    indigo: { name: "Washed Indigo", hex: "#4A5566" },
    oxide: { name: "Oxide", hex: "#8A3A24" },
  };

  /* Deterministic stock so the demo inventory is stable between loads. */
  function stockFor(seed) {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const n = h % 17;
    return n < 2 ? 0 : n < 5 ? n - 1 : n + 2; // some sold-out, some low stock
  }

  function product(p) {
    const colors = p.colors.map((c) => COLORS[c]);
    const variants = [];
    colors.forEach((c) =>
      p.sizes.forEach((s) => {
        const sku = `${p.sku}-${c.name.slice(0, 3).toUpperCase()}-${s}`;
        const qty = stockFor(sku);
        variants.push({ sku, color: c.name, size: s, quantityAvailable: qty, availableForSale: qty > 0 });
      })
    );
    return Object.assign(
      { salePrice: null, featured: false, newArrival: false, bestSeller: false, status: null, gender: "unisex" },
      p,
      { colors, variants, stock: variants.reduce((a, v) => a + v.quantityAvailable, 0) }
    );
  }

  const products = [
    product({
      slug: "monolith-oversized-coat", sku: "ST-OC01", name: "Monolith Oversized Coat",
      price: 420, category: "outerwear", collection: "obsidian-series", gender: "men",
      status: "LIMITED", featured: true, createdAt: "2026-09-12",
      images: ["photo-1688245608269-4d598f0cce3e", "photo-1763583817010-034afe681445"],
      sizes: APPAREL, colors: ["black", "charcoal"],
      description: "A dropped-shoulder overcoat cut long and wide from a dense wool-melton. Built to sit over everything you own and still hang clean.",
      details: ["Dropped shoulder, oversized body", "Concealed four-button placket", "Internal media pocket", "Back vent, 112 cm length (size M)"],
      materials: "80% recycled wool, 20% polyamide. Lining: 100% cupro.",
      fit: "Oversized. Take your usual size for the intended fit, size down for a closer line. Model is 187 cm and wears M.",
      care: "Dry clean only. Brush after wear. Store on a wide-shouldered hanger.",
    }),
    product({
      slug: "vault-down-jacket", sku: "ST-DJ02", name: "Vault Down Jacket",
      price: 385, category: "outerwear", collection: "terrain", newArrival: true,
      status: "NEW", featured: true, createdAt: "2026-09-20",
      images: ["photo-1769689387681-42b8a41fa2de", "photo-1611692370244-aebb15c17941"],
      sizes: APPAREL, colors: ["black", "stone"],
      description: "Box-baffled down puffer in a matte-coated ripstop. Stand collar, storm flap and a cropped hem that stacks over wide trousers.",
      details: ["750 fill-power responsibly sourced down", "Two-way YKK Aquaguard zip", "Hand-warmer and internal zip pockets", "Packs into its own collar"],
      materials: "Shell: 100% recycled nylon ripstop, PFC-free DWR. Fill: 90/10 RDS down.",
      fit: "Relaxed, cropped at the hip. True to size.",
      care: "Machine wash cold on a gentle cycle with down wash. Tumble dry low with dryer balls.",
    }),
    product({
      slug: "axis-tailored-blazer", sku: "ST-BZ03", name: "Axis Tailored Blazer",
      price: 310, category: "outerwear", collection: "future-form", gender: "women", bestSeller: true,
      status: "BEST SELLER", featured: true, createdAt: "2026-06-02",
      images: ["photo-1747814965210-a97dc440f6b7", "photo-1747814896391-6105fd2f29c7"],
      sizes: APPAREL, colors: ["stone", "black"],
      description: "An unstructured, boyfriend-cut blazer with a softened shoulder and long line. Tailoring that moves like a jacket.",
      details: ["Single-breasted, one button", "Half-canvas front, no shoulder pad", "Flap pockets, functional cuffs", "Tonal horn buttons"],
      materials: "58% wool, 40% viscose, 2% elastane. Lining: 100% cupro.",
      fit: "Relaxed and elongated. Size down for a sharper fit.",
      care: "Dry clean only. Steam to refresh.",
    }),
    product({
      slug: "drift-wool-overcoat", sku: "ST-OC04", name: "Drift Wool Overcoat",
      price: 460, salePrice: 368, category: "outerwear", collection: "obsidian-series", gender: "women",
      featured: false, createdAt: "2026-03-18",
      images: ["photo-1613915617430-8ab0fd7c6baf", "photo-1645561305502-63a9ba09ab09"],
      sizes: APPAREL, colors: ["charcoal", "black"],
      description: "A double-faced wool coat with raw-cut edges and a notched lapel. No lining, no excess — just weight, drape and a precise shoulder.",
      details: ["Double-faced construction, unlined", "Hand-finished raw edges", "Welt pockets", "Self-tie belt included"],
      materials: "90% wool, 10% cashmere.",
      fit: "Relaxed through the body. True to size.",
      care: "Dry clean only.",
    }),
    product({
      slug: "base-heavyweight-tee", sku: "ST-TE05", name: "Base Heavyweight Tee",
      price: 85, category: "tops", collection: "core-program", gender: "men", bestSeller: true,
      status: "BEST SELLER", featured: true, createdAt: "2026-01-10",
      images: ["photo-1622383129198-dacbb32854b5", "photo-1615903040611-e599dfaa6752"],
      sizes: APPAREL, colors: ["black", "bone", "ash"],
      description: "The foundation. 300 gsm loopback jersey, boxy through the body with a dense 3 cm rib collar that holds its shape wash after wash.",
      details: ["300 gsm garment-dyed jersey", "Boxy body, dropped shoulder", "3 cm rib collar", "Pre-shrunk"],
      materials: "100% organic cotton, knitted in Portugal.",
      fit: "Boxy. Take your usual size.",
      care: "Machine wash cold inside out. Dry flat. Do not tumble dry.",
    }),
    product({
      slug: "form-heavyweight-hoodie", sku: "ST-HD06", name: "Form Heavyweight Hoodie",
      price: 185, category: "tops", collection: "core-program", bestSeller: true,
      status: "BEST SELLER", featured: true, createdAt: "2026-02-04",
      images: ["photo-1626408456883-d204eb57c763", "photo-1691689761290-2641cf0fc59a"],
      sizes: APPAREL, colors: ["black", "charcoal", "stone"],
      description: "A 520 gsm brushed-back fleece hoodie with a double-layer hood and no drawcords. Cropped body, long sleeve, heavy by design.",
      details: ["520 gsm brushed fleece", "Double-layer hood, no cords", "Kangaroo pocket with hidden zip", "Ribbed cuffs and hem"],
      materials: "100% organic cotton.",
      fit: "Oversized, slightly cropped. True to size.",
      care: "Machine wash cold. Dry flat.",
    }),
    product({
      slug: "contour-rib-knit", sku: "ST-KN07", name: "Contour Rib Knit",
      price: 165, category: "tops", collection: "future-form", gender: "women", newArrival: true,
      status: "NEW", featured: true, createdAt: "2026-09-16",
      images: ["photo-1515511624704-b8916dcc30ea", "photo-1595026525047-dfa997df8a4a"],
      sizes: ["XS", "S", "M", "L", "XL"], colors: ["bone", "black"],
      description: "A close-fitting high-neck knit in a sculpted 2×2 rib. Fully fashioned, so every seam is knitted in rather than sewn.",
      details: ["Fully fashioned 2×2 rib", "Mock neck", "Extra-long sleeve with thumb-rest cuff", "7-gauge"],
      materials: "70% merino wool, 30% recycled cashmere.",
      fit: "Slim, second-skin fit. Size up for a relaxed line.",
      care: "Hand wash cold or dry clean. Dry flat.",
    }),
    product({
      slug: "plinth-pleated-trouser", sku: "ST-TR08", name: "Plinth Pleated Trouser",
      price: 195, category: "bottoms", collection: "future-form", gender: "women", newArrival: true,
      status: "NEW", featured: true, createdAt: "2026-09-08",
      images: ["photo-1657815929003-b97cc426cb3d", "photo-1626098841206-db37c9ef9b57"],
      sizes: ["XS", "S", "M", "L", "XL"], colors: ["bone", "black"],
      description: "High-rise, double-pleated and full-length. A fluid wool-blend twill that pools slightly at the shoe.",
      details: ["Double front pleats", "High rise, extended waistband", "Side-adjusters, no belt loops", "Pressed centre crease"],
      materials: "64% polyester, 33% viscose, 3% elastane.",
      fit: "Wide leg, high rise. True to size, 82 cm inseam.",
      care: "Machine wash cold on delicate. Hang dry. Warm iron.",
    }),
    product({
      slug: "shadow-cargo-trouser", sku: "ST-TR09", name: "Shadow Cargo Trouser",
      price: 175, category: "bottoms", collection: "obsidian-series", gender: "men",
      status: "LIMITED", featured: true, createdAt: "2026-08-21",
      images: ["photo-1783545207150-61722654103f", "photo-1770918655041-5de83c95ccf9"],
      sizes: APPAREL, colors: ["black", "charcoal"],
      description: "A relaxed cargo in brushed cotton-nylon. Bellowed pockets sit flat until you need them. Drawcord hem to stack or taper.",
      details: ["Six-pocket construction", "Articulated knee", "Drawcord hem", "Matte gunmetal hardware"],
      materials: "65% cotton, 35% nylon.",
      fit: "Relaxed, straight leg. True to size.",
      care: "Machine wash cold. Tumble dry low.",
    }),
    product({
      slug: "grade-wide-denim", sku: "ST-DN10", name: "Grade Wide Denim",
      price: 160, category: "bottoms", collection: "core-program", gender: "women",
      createdAt: "2026-04-14",
      images: ["photo-1780566760434-5f42a317b0a9", "photo-1780566759999-4dbaa4218959"],
      sizes: ["XS", "S", "M", "L", "XL"], colors: ["indigo", "black"],
      description: "A low-slung wide leg in 13.5 oz Japanese selvedge. Stone-washed once, then left to break in with you.",
      details: ["13.5 oz Japanese selvedge", "Five-pocket, button fly", "Low rise, wide leg", "Chain-stitched hem"],
      materials: "100% cotton denim.",
      fit: "Loose, wide leg. Take your usual waist size.",
      care: "Wash as little as possible, cold and inside out. Hang dry.",
    }),
    product({
      slug: "section-overshirt", sku: "ST-OS11", name: "Section Overshirt",
      price: 215, category: "tops", collection: "terrain", gender: "men", newArrival: true,
      status: "NEW", featured: false, createdAt: "2026-09-02",
      images: ["photo-1783545207084-11176c695627", "photo-1653491951262-eaa7b1276aad"],
      sizes: APPAREL, colors: ["black", "stone"],
      description: "A panelled overshirt in waxed cotton canvas, with contrast top-stitching that maps the pattern. Wear open as a layer or closed as a shirt.",
      details: ["Waxed cotton canvas", "Contrast twin-needle stitching", "Snap placket and cuffs", "Two chest bellow pockets"],
      materials: "100% cotton with paraffin wax finish.",
      fit: "Boxy and slightly cropped. True to size.",
      care: "Spot clean only. Re-wax annually.",
    }),
    product({
      slug: "level-court-sneaker", sku: "ST-FW12", name: "Level Court Sneaker",
      price: 240, category: "footwear", collection: "core-program", newArrival: true,
      status: "NEW", featured: false, createdAt: "2026-09-18",
      images: ["photo-1585591359088-e144e8a61170", "photo-1590330297626-d7aff25a0431"],
      sizes: FOOTWEAR, colors: ["bone", "black"],
      description: "A low-profile court shoe in full-grain Italian leather on a stitched cupsole. No logos, nothing extra.",
      details: ["Full-grain leather upper", "Margom rubber cupsole, stitched", "Leather-lined, removable footbed", "Waxed cotton laces"],
      materials: "Upper and lining: calf leather. Sole: natural rubber.",
      fit: "True to size. Half sizes, take the next size up.",
      care: "Wipe clean with a damp cloth. Condition leather every few months.",
    }),
    product({
      slug: "ingot-leather-bag", sku: "ST-AC13", name: "Ingot Leather Bag",
      price: 290, category: "accessories", collection: "obsidian-series",
      status: "LIMITED", featured: true, createdAt: "2026-07-30",
      images: ["photo-1758542988969-39a10168b2ce", "photo-1746880223690-359948154c53"],
      sizes: ONE, colors: ["black"],
      description: "A soft, gathered shoulder bag in vegetable-tanned lambskin. Holds a day's essentials; folds nearly flat when empty.",
      details: ["Magnetic closure", "Interior zip pocket", "Adjustable 60–70 cm strap", "32 × 18 × 12 cm"],
      materials: "100% lambskin leather, cotton twill lining.",
      fit: "One size.",
      care: "Keep away from direct heat and water. Store in dust bag.",
    }),
    product({
      slug: "aperture-sunglasses", sku: "ST-AC14", name: "Aperture Sunglasses",
      price: 180, category: "accessories", collection: "future-form",
      createdAt: "2026-05-22",
      images: ["photo-1645997098653-ed4519760b10", "photo-1721957786618-5584515a50d3"],
      sizes: ONE, colors: ["black"],
      description: "A narrow rectangular frame hand-cut from Mazzucchelli acetate, fitted with category 3 polarised lenses.",
      details: ["Italian acetate frame", "Polarised CR-39 lenses, 100% UV", "Five-barrel hinges", "Includes case and cloth"],
      materials: "Acetate frame, CR-39 lens.",
      fit: "Medium fit. Lens 52 mm, bridge 20 mm, temple 145 mm.",
      care: "Clean with the provided cloth. Store in case.",
    }),
    product({
      slug: "ridge-rib-beanie", sku: "ST-AC15", name: "Ridge Rib Beanie",
      price: 55, category: "accessories", collection: "core-program", bestSeller: true,
      status: "BEST SELLER", featured: false, createdAt: "2025-11-01",
      images: ["photo-1764212466644-a4a02fc37261", "photo-1708533477284-7f214548873b"],
      sizes: ONE, colors: ["black", "charcoal", "bone"],
      description: "A deep-turn-up fisherman beanie in chunky merino rib. Woven tonal label, nothing louder.",
      details: ["Double-layer turn-up", "Chunky 5-gauge rib", "Woven tonal label"],
      materials: "100% extra-fine merino wool.",
      fit: "One size, stretches to fit.",
      care: "Hand wash cold. Dry flat.",
    }),
    product({
      slug: "signal-varsity-jacket", sku: "ST-VJ16", name: "Signal Varsity Jacket",
      price: 345, category: "outerwear", collection: "terrain", gender: "women",
      status: "LIMITED", featured: false, createdAt: "2026-08-10",
      images: ["photo-1778395469141-8d70d501bbd7", "photo-1778395528405-267415a962e7"],
      sizes: ["XS", "S", "M", "L", "XL"], colors: ["black"],
      description: "A cropped varsity in boiled wool with leather sleeves and a single chenille initial. Collegiate proportions, re-cut for now.",
      details: ["Boiled wool body, lambskin sleeves", "Snap front", "Striped rib collar, cuffs and hem", "Quilted satin lining"],
      materials: "Body: 80% wool, 20% polyamide. Sleeves: lamb leather.",
      fit: "Cropped and boxy. True to size.",
      care: "Specialist leather clean only.",
    }),
    product({
      slug: "signal-oversized-tee", sku: "ST-TE17", name: "Signal Oversized Tee",
      price: 95, category: "tops", collection: "core-program",
      createdAt: "2026-07-01",
      images: ["photo-1780566036282-e0845b9e4efe", "photo-1768696082704-c4e5593d9f27"],
      sizes: APPAREL, colors: ["black", "bone"],
      description: "An exaggerated tee with a longer body and elbow-length sleeve. Screen-printed back graphic in water-based ink.",
      details: ["260 gsm jersey", "Water-based back print", "Elbow-length sleeve", "Side splits"],
      materials: "100% organic cotton.",
      fit: "Very oversized. Size down for a regular oversized fit.",
      care: "Machine wash cold inside out. Do not iron print.",
    }),
    product({
      slug: "ridge-shearling-jacket", sku: "ST-SJ18", name: "Ridge Shearling Jacket",
      price: 495, category: "outerwear", collection: "terrain", gender: "men", bestSeller: true,
      status: "BEST SELLER", featured: false, createdAt: "2026-02-20",
      images: ["photo-1532332248682-206cc786359f", "photo-1674851993233-f9bbddca4204"],
      sizes: APPAREL, colors: ["black", "stone"],
      description: "A cropped bomber in suede with a curly shearling collar and full lining. Heavy, warm and built to last a decade.",
      details: ["Suede shell, shearling collar", "Two-way metal zip", "Snap-tab hem", "Full shearling body lining"],
      materials: "100% lamb suede with lamb shearling.",
      fit: "Relaxed, cropped. True to size.",
      care: "Specialist leather clean only.",
    }),
  ];

  const collections = [
    {
      slug: "obsidian-series", name: "Obsidian Series", label: "New Collection", status: "live", season: "AW26",
      hero: "photo-1603189343302-e603f7add05a", cover: "photo-1603189343302-e603f7add05a",
      intro: "Black, in every weight.",
      description: "Obsidian is a study in one colour. Dense wools, brushed cottons and soft leathers, all dyed to the same deep black, so the only thing left to read is the cut. Oversized coats, relaxed cargo and gathered leather — built to be worn together or not at all.",
      notes: ["12 pieces", "Dyed to one black", "Small-batch run"],
    },
    {
      slug: "future-form", name: "Future Form", label: "Exclusive Drop", status: "live", season: "SS26 — Capsule",
      hero: "photo-1654777673891-1f4a24179dac", cover: "photo-1659522761084-79196b64abe4",
      intro: "Tailoring, softened.",
      description: "Future Form takes the architecture of tailoring — the pleat, the lapel, the shoulder — and removes everything that restricts. Unstructured blazers, fluid trousers and fully-fashioned knits in bone and black.",
      notes: ["Limited capsule", "Unstructured tailoring", "Bone / Black"],
    },
    {
      slug: "terrain", name: "Terrain", label: "Outerwear Edit", status: "live", season: "AW26",
      hero: "photo-1555274850-0b443db9b62e", cover: "photo-1559356157-f3315daa41c7",
      intro: "Built for weather, cut for the city.",
      description: "Terrain is our outerwear programme. Waxed canvas, box-baffled down, suede and shearling — technical where it counts, restrained everywhere else.",
      notes: ["Technical outerwear", "Weather-rated", "Made to last"],
    },
    {
      slug: "core-program", name: "Core Program", label: "Always On", status: "live", season: "Permanent",
      hero: "photo-1559697242-a465f2578a95", cover: "photo-1559697242-a465f2578a95",
      intro: "The pieces we never stop making.",
      description: "Heavyweight tees, 520 gsm fleece, Japanese denim and a leather court shoe. The permanent collection — refined every season, never replaced.",
      notes: ["Permanent collection", "Heavyweight", "Restocked monthly"],
    },
  ];

  const categories = [
    { slug: "women", name: "Women", type: "gender", image: "photo-1645561305577-4cb5be67a40a", description: "Tailoring, knits and outerwear for women." },
    { slug: "men", name: "Men", type: "gender", image: "photo-1694516668099-8edaeef66b61", description: "Heavyweight essentials and outerwear for men." },
    { slug: "outerwear", name: "Outerwear", type: "category", image: "photo-1763583817010-034afe681445", description: "Coats, down and leather." },
    { slug: "tops", name: "Tops", type: "category", image: "photo-1622383129198-dacbb32854b5", description: "Tees, fleece, knits and overshirts." },
    { slug: "bottoms", name: "Bottoms", type: "category", image: "photo-1657815929003-b97cc426cb3d", description: "Trousers, cargo and denim." },
    { slug: "footwear", name: "Footwear", type: "category", image: "photo-1585591359088-e144e8a61170", description: "Leather court shoes." },
    { slug: "accessories", name: "Accessories", type: "category", image: "photo-1758542988969-39a10168b2ce", description: "Bags, eyewear and knitwear." },
  ];

  const testimonials = [
    { name: "Marcus O.", username: "marcus.oy", profileImage: "photo-1761706755002-0d89292232a7", image: "photo-1692297188668-c609126f8f36", review: "The Monolith coat is ridiculous. Weight, drape, all of it. Worn it every day since it landed.", likes: 3184, comments: 57, date: "2 days ago", product: "monolith-oversized-coat" },
    { name: "Ines R.", username: "ines.rvr", profileImage: "photo-1637499947898-7c6d10025a2d", image: "photo-1648249626189-d7a4d88a9416", review: "Finally a heavyweight tee that doesn't lose its collar after three washes. Ordered two more.", likes: 4271, comments: 83, date: "3 days ago", product: "base-heavyweight-tee" },
    { name: "Theo K.", username: "theo.kane", profileImage: "photo-1637852001110-b8825e3ebeae", image: "photo-1649565899064-51e024a0698f", review: "Perfect fit on the Shadow Cargo. Packaging, quality, delivery — feels like a proper label.", likes: 2096, comments: 41, date: "1 day ago", product: "shadow-cargo-trouser" },
    { name: "Amara D.", username: "amara.dn", profileImage: "photo-1637536701306-3214e9cec64a", image: "photo-1638412326372-bfc7fc55f2ed", review: "The Form hoodie is the heaviest thing I own and I mean that as a compliment.", likes: 5902, comments: 112, date: "4 days ago", product: "form-heavyweight-hoodie" },
    { name: "Jonah P.", username: "jonah.wav", profileImage: "photo-1618673827854-0065d21af001", image: "photo-1762289016867-b6cc09303e1c", review: "Third order. Every piece works with everything else, which is exactly the point.", likes: 1733, comments: 29, date: "1 week ago", product: "vault-down-jacket" },
    { name: "Selin A.", username: "selin.aksoy", profileImage: "photo-1732464517792-7385024242a6", image: "photo-1687626896914-61e59a0e5623", review: "Wore the full black look to a gallery opening. Three people asked where it was from.", likes: 2688, comments: 64, date: "5 days ago", product: "shadow-cargo-trouser" },
  ];

  const faq = [
    { order: 1, question: "What is your shipping policy?", answer: "Orders placed before 2 PM GMT on a business day ship the same day from our London studio. Standard shipping is free on orders over $150; below that, a flat $12 applies. Express delivery is available at checkout." },
    { order: 2, question: "What is your return policy?", answer: "You have 30 days from delivery to return unworn items with tags attached for a full refund or exchange. Start a return from your account or the link in your shipping email — returns are free for exchanges and $8 for refunds. Final-sale items are marked on the product page." },
    { order: 3, question: "How do I find my size?", answer: "Every product page includes a size guide with garment measurements, the fit (boxy, relaxed, oversized) and what size our model wears. As a rule, our tops are cut generously — take your usual size for the intended fit, or size down for a closer line. Still unsure? Email us your height and usual size and we'll advise within 24 hours." },
    { order: 4, question: "Do you offer international shipping?", answer: "Yes. We ship to over 60 countries with fully tracked, duties-paid delivery for the UK, EU, US, Canada, Australia and Japan — so the price you see at checkout is the price you pay. Other destinations may be subject to local import duties." },
    { order: 5, question: "How do I track my order?", answer: "As soon as your order leaves the studio you'll receive an email with a tracking link. You can also track any order from the Track Order page using your order number and email address." },
    { order: 6, question: "How should I care for my clothing?", answer: "Wash less, wash cold. Most of our jersey and fleece is pre-shrunk and garment-dyed, so wash inside out at 30°C and dry flat to preserve the weight and shape. Wool and tailoring should be brushed and steamed rather than washed. Specific care instructions are on every product page and garment label." },
  ];

  const social = [
    { image: "photo-1592833578500-1082e18665a3", caption: "Obsidian, studio day one." },
    { image: "photo-1589739401762-670be815e704", caption: "Terrain on location." },
    { image: "photo-1787044817434-b6d1f927ac21", caption: "Tailoring, unstructured." },
    { image: "photo-1688110619871-7ec8ed8d37f9", caption: "Monolith, in motion." },
    { image: "photo-1637499947898-7c6d10025a2d", caption: "Future Form — bone." },
    { image: "photo-1762354766704-cb386e60dfe9", caption: "520 gsm, up close." },
    { image: "photo-1732464517792-7385024242a6", caption: "Backstage, AW26." },
    { image: "photo-1566457990563-908fbcba9a08", caption: "Where the collection started." },
  ];

  window.CMS = { products, collections, categories, testimonials, faq, social, COLORS };
})();
