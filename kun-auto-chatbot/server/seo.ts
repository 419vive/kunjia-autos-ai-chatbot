/**
 * SEO Module — Server-side meta tag injection, JSON-LD structured data, sitemap generation
 *
 * This module handles all SEO concerns for the SPA by injecting proper meta tags,
 * Open Graph tags, and JSON-LD structured data into the HTML before sending to the client.
 * This ensures search engine crawlers see fully formed meta data without needing JS execution.
 */
import { Router } from "express";
import * as db from "./db";

// ============ CONSTANTS ============

const SITE_NAME = "崑家汽車";
const SITE_DESCRIPTION = "高雄在地40年二手車行，正派經營。全車第三方認證、超強貸款方案、最快3小時交車。精選各大品牌優質中古車。";
const BUSINESS_ADDRESS = "高雄市三民區大順二路269號";
const BUSINESS_PHONE = ""; // TODO: Add actual phone number
const BUSINESS_HOURS = "Mo-Sa 09:00-21:00";
const LINE_OA_URL = "https://page.line.me/825oftez";

function getBaseUrl(): string {
  return process.env.BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://kuncar.tw"; // TODO: Update with actual domain
}

// ============ HELPER: Escape HTML attributes ============

function escAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escJson(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// ============ HELPER: Parse photo URLs ============

function parseFirstPhoto(raw: string | null | undefined): string {
  if (!raw) return "";
  const str = raw as string;
  if (str.startsWith("[")) {
    try { return JSON.parse(str)[0] || ""; } catch { return ""; }
  }
  if (str.includes("|")) return str.split("|")[0] || "";
  if (str.startsWith("http")) return str;
  return "";
}

// ============ JSON-LD: AutoDealer (site-wide) ============

function autoDealer(): object {
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "name": SITE_NAME,
    "description": "高雄在地40年二手車行，正派經營。全車第三方認證。",
    "url": getBaseUrl(),
    "telephone": BUSINESS_PHONE || undefined,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "大順二路269號",
      "addressLocality": "三民區",
      "addressRegion": "高雄市",
      "postalCode": "807",
      "addressCountry": "TW",
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      "opens": "09:00",
      "closes": "21:00",
    },
    "sameAs": [LINE_OA_URL],
    "priceRange": "$$",
    "image": `${getBaseUrl()}/og-default.jpg`,
  };
}

// ============ JSON-LD: Car (vehicle page) ============

function carSchema(vehicle: any): object {
  const name = `${vehicle.brand} ${vehicle.model}`;
  const year = vehicle.modelYear || "";
  const price = vehicle.price ? Math.round(Number(vehicle.price) * 10000) : 0;
  const photo = parseFirstPhoto(vehicle.photoUrls);

  return {
    "@context": "https://schema.org",
    "@type": "Car",
    "name": `${name} ${year}`,
    "brand": { "@type": "Brand", "name": vehicle.brand },
    "model": vehicle.model,
    "vehicleModelDate": year,
    "color": vehicle.color || undefined,
    "vehicleTransmission": vehicle.transmission || undefined,
    "fuelType": vehicle.fuelType || undefined,
    "mileageFromOdometer": vehicle.mileage ? {
      "@type": "QuantitativeValue",
      "value": vehicle.mileage.replace(/[^\d.]/g, ""),
      "unitCode": "KMT",
    } : undefined,
    "vehicleEngine": vehicle.displacement ? {
      "@type": "EngineSpecification",
      "name": vehicle.displacement,
    } : undefined,
    "image": photo || undefined,
    "url": `${getBaseUrl()}/vehicle/${vehicle.id}`,
    "offers": {
      "@type": "Offer",
      "price": price || undefined,
      "priceCurrency": "TWD",
      "availability": vehicle.status === "available"
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      "seller": {
        "@type": "AutoDealer",
        "name": SITE_NAME,
        "address": BUSINESS_ADDRESS,
      },
    },
  };
}

// ============ JSON-LD: FAQ (common questions) ============

function faqSchema(faqs: Array<{ q: string; a: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(({ q, a }) => ({
      "@type": "Question",
      "name": q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": a,
      },
    })),
  };
}

const HOMEPAGE_FAQS = [
  { q: "崑家汽車在哪裡？", a: `崑家汽車位於${BUSINESS_ADDRESS}，在地經營超過40年，是高雄知名的二手車行。` },
  { q: "崑家汽車的二手車有保固嗎？", a: "是的，崑家汽車所有車輛皆通過第三方認證，確保車況透明、品質可靠。" },
  { q: "二手車可以貸款嗎？", a: "可以，崑家汽車有專業貸款團隊，提供多種貸款方案，協助您輕鬆購車。" },
  { q: "外縣市可以買車嗎？", a: "可以，崑家汽車提供外縣市免費接駁服務，讓您輕鬆到店看車。" },
  { q: "交車需要多久？", a: "崑家汽車最快3小時即可完成交車手續，讓您當天就能開新車回家。" },
  { q: "舊車可以折抵嗎？", a: "可以，崑家汽車提供舊車高價收購服務，歡迎以舊換新。" },
];

// ============ JSON-LD: WebSite (sitelinks search box) ============

function websiteSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "url": getBaseUrl(),
    "description": SITE_DESCRIPTION,
    "inLanguage": "zh-TW",
  };
}

// ============ JSON-LD: BreadcrumbList ============

function breadcrumb(items: Array<{ name: string; url: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.name,
      "item": item.url,
    })),
  };
}

// ============ MAIN: Inject SEO tags into HTML ============

export async function injectSeoTags(html: string, url: string): Promise<string> {
  const baseUrl = getBaseUrl();
  const path = url.split("?")[0];

  // Skip admin pages
  if (path.startsWith("/admin")) return html;

  let title = `二手車推薦｜${SITE_NAME}｜高雄在地40年老字號中古車行`;
  let description = SITE_DESCRIPTION;
  let ogType = "website";
  let ogImage = `${baseUrl}/og-default.jpg`;
  let canonicalUrl = `${baseUrl}${path === "/" ? "" : path}`;
  const jsonLdBlocks: object[] = [autoDealer(), websiteSchema()];

  // ---------- Vehicle detail page ----------
  const vehicleMatch = path.match(/^\/vehicle\/(\d+)$/);
  if (vehicleMatch) {
    try {
      const vehicleId = parseInt(vehicleMatch[1], 10);
      const vehicle = await db.getVehicleById(vehicleId);
      if (vehicle) {
        const name = `${vehicle.brand} ${vehicle.model}`;
        const year = vehicle.modelYear ? `${vehicle.modelYear}年` : "";
        const price = vehicle.priceDisplay || `${vehicle.price}萬`;
        const photo = parseFirstPhoto(vehicle.photoUrls);

        title = `${name} ${year} ${price}｜${SITE_NAME} 高雄二手車`;
        description = `${year} ${name} ${price}。${vehicle.mileage ? `里程${vehicle.mileage}` : ""}${vehicle.color ? `、${vehicle.color}` : ""}${vehicle.transmission ? `、${vehicle.transmission}` : ""}。第三方認證、可貸款、免費接駁試乘｜${SITE_NAME}`;
        ogType = "product";
        if (photo) ogImage = photo;

        jsonLdBlocks.push(carSchema(vehicle));
        jsonLdBlocks.push(breadcrumb([
          { name: "首頁", url: baseUrl },
          { name: `${vehicle.brand} 二手車`, url: `${baseUrl}/?brand=${encodeURIComponent(vehicle.brand)}` },
          { name: `${name} ${year}`, url: canonicalUrl },
        ]));

        // Vehicle-specific FAQs
        jsonLdBlocks.push(faqSchema([
          { q: `這台${name}多少錢？`, a: `這台${year} ${name}售價${price}，歡迎聯繫崑家汽車了解最新優惠。` },
          { q: `${name}可以貸款嗎？`, a: `可以，崑家汽車提供專業貸款服務，歡迎洽詢。` },
          { q: `可以預約看這台${name}嗎？`, a: `可以，您可以透過LINE官方帳號或網站預約看車，崑家汽車提供外縣市免費接駁。` },
        ]));
      }
    } catch (err) {
      console.error("[SEO] Failed to fetch vehicle for meta tags:", err);
    }
  }

  // ---------- Homepage ----------
  else if (path === "/") {
    jsonLdBlocks.push(faqSchema(HOMEPAGE_FAQS));
    jsonLdBlocks.push(breadcrumb([
      { name: "首頁", url: baseUrl },
    ]));
  }

  // ---------- Chat page ----------
  else if (path === "/chat") {
    title = `線上諮詢｜${SITE_NAME}｜AI智慧客服`;
    description = `崑家汽車AI智慧客服，24小時線上為您解答二手車相關問題。即時諮詢車況、價格、貸款方案。`;
    jsonLdBlocks.push(breadcrumb([
      { name: "首頁", url: baseUrl },
      { name: "線上諮詢", url: canonicalUrl },
    ]));
  }

  // ---------- Loan inquiry page ----------
  else if (path === "/loan-inquiry") {
    title = `二手車貸款諮詢｜${SITE_NAME}｜高雄中古車貸款`;
    description = `崑家汽車提供專業二手車貸款服務，多種方案、快速審核。填寫表單即可獲得貸款方案建議。`;
    jsonLdBlocks.push(breadcrumb([
      { name: "首頁", url: baseUrl },
      { name: "貸款諮詢", url: canonicalUrl },
    ]));
  }

  // ---------- Book visit page ----------
  else if (path === "/book-visit") {
    title = `預約看車｜${SITE_NAME}｜高雄二手車行`;
    description = `線上預約到崑家汽車看車，我們提供外縣市免費接駁服務。高雄在地40年，正派經營。`;
    jsonLdBlocks.push(breadcrumb([
      { name: "首頁", url: baseUrl },
      { name: "預約看車", url: canonicalUrl },
    ]));
  }

  // ---------- Brand category pages (/brand/:brand) ----------
  else if (path.startsWith("/brand/")) {
    const brand = decodeURIComponent(path.replace("/brand/", ""));
    if (brand) {
      title = `${brand} 二手車推薦｜${SITE_NAME}｜高雄在地老字號`;
      description = `崑家汽車精選 ${brand} 二手車，全車第三方認證，提供貸款服務。高雄在地40年，正派經營。`;
      jsonLdBlocks.push(breadcrumb([
        { name: "首頁", url: baseUrl },
        { name: `${brand} 二手車`, url: canonicalUrl },
      ]));
      jsonLdBlocks.push(faqSchema([
        { q: `${brand} 二手車怎麼買？`, a: `可至崑家汽車直接看${brand}在售車款，所有車輛均通過第三方認證，提供貸款服務。` },
        { q: `${brand} 二手車可以貸款嗎？`, a: `可以，崑家汽車提供多種貸款方案，${brand}車款皆適用。` },
      ]));
    }
  }

  // ---------- Price range pages (/price/:range) ----------
  else if (path.startsWith("/price/")) {
    const rangeMap: Record<string, { label: string; desc: string }> = {
      "under-30": { label: "30萬以下", desc: "30萬以下平價二手車推薦，CP值超高。全車第三方認證，崑家汽車高雄在地40年。" },
      "30-50":    { label: "30–50萬",  desc: "30至50萬二手車推薦，入門家用首選。全車第三方認證，崑家汽車高雄在地40年。" },
      "50-80":    { label: "50–80萬",  desc: "50至80萬中高階二手車推薦，品質兼顧。全車第三方認證，崑家汽車高雄在地40年。" },
      "over-80":  { label: "80萬以上", desc: "80萬以上高階豪華二手車推薦，歐系進口首選。全車第三方認證，崑家汽車高雄在地40年。" },
    };
    const rangeSlug = path.replace("/price/", "");
    const rangeMeta = rangeMap[rangeSlug];
    if (rangeMeta) {
      title = `${rangeMeta.label}二手車推薦｜${SITE_NAME}｜高雄中古車`;
      description = rangeMeta.desc;
      jsonLdBlocks.push(breadcrumb([
        { name: "首頁", url: baseUrl },
        { name: `${rangeMeta.label}二手車`, url: canonicalUrl },
      ]));
    }
  }

  // ---------- FAQ page ----------
  else if (path === "/faq") {
    title = `常見問題 FAQ｜${SITE_NAME}｜高雄二手車`;
    description = `買二手車常見問題一次解答：購車、貸款、認證、過戶、高雄二手車市場資訊。崑家汽車40年經驗為您解答。`;
    jsonLdBlocks.push(breadcrumb([
      { name: "首頁", url: baseUrl },
      { name: "常見問題", url: canonicalUrl },
    ]));
    jsonLdBlocks.push(faqSchema([
      ...HOMEPAGE_FAQS,
      { q: "什麼是第三方認證？", a: "第三方認證是由獨立於買賣雙方的專業機構，對車輛進行全面檢查並出具書面報告，是保障買家權益最有效的方式。" },
      { q: "二手車貸款成數是多少？", a: "一般二手車貸款成數為車價的50%-80%，依車齡和個人信用而定。崑家汽車合作多家銀行，可協助規劃貸款方案。" },
      { q: "過戶流程怎麼走？", a: "準備文件→前往監理站→填寫異動申請書→繳交規費→領取新行照。崑家汽車提供代辦服務，1-2個工作天即可完成。" },
      { q: "高雄哪裡買二手車比較好？", a: "高雄三民區大順路一帶是傳統汽車街，聚集數十家車行。崑家汽車位於三民區大順二路269號，在地40年老字號。" },
      { q: "可以帶驗車師傅來嗎？", a: "非常歡迎！崑家汽車歡迎買家自行攜帶驗車師傅到場驗車，我們對每台車的車況有十足信心。" },
    ]));
  }

  // ---------- Blog index ----------
  else if (path === "/blog") {
    title = `二手車攻略｜${SITE_NAME}購車指南`;
    description = `崑家汽車40年二手車知識，完整購車指南：買車注意事項、貸款攻略、過戶流程、高雄二手車市場資訊。`;
    jsonLdBlocks.push(breadcrumb([
      { name: "首頁", url: baseUrl },
      { name: "購車攻略", url: canonicalUrl },
    ]));
  }

  // ---------- Blog post pages (/blog/:slug) ----------
  else if (path.startsWith("/blog/")) {
    const slug = path.replace("/blog/", "");
    // Blog post meta is static data — import inline to avoid circular deps
    const blogMeta: Record<string, { title: string; description: string; keywords: string[] }> = {
      "buy-used-car-guide": {
        title: "買二手車必看！7大注意事項，避免踩雷完整指南",
        description: "買二手車前必看的7大注意事項，從車輛歷史查詢、第三方認證、泡水車辨認到貸款陷阱，完整教學幫你避開所有地雷。",
        keywords: ["買二手車", "二手車注意事項"],
      },
      "used-car-loan-guide": {
        title: "二手車貸款全攻略：利率、條件、申辦流程一次看懂（2026年最新）",
        description: "完整解析二手車貸款：貸款成數、利率比較、所需文件、申辦流程與注意事項。2026年最新資訊。",
        keywords: ["二手車貸款", "中古車貸款", "二手車利率"],
      },
      "kaohsiung-used-car-guide": {
        title: "高雄買二手車推薦：在地40年崑家汽車，正派經營完整評價",
        description: "想在高雄買二手車？本文介紹高雄二手車市場生態、挑選車行標準，以及崑家汽車完整評價與服務特色。",
        keywords: ["高雄二手車", "高雄二手車行", "高雄中古車推薦"],
      },
      "third-party-inspection-guide": {
        title: "二手車第三方認證是什麼？買中古車一定要看的完整指南",
        description: "詳解二手車第三方認證的意義、認證項目、如何閱讀認證報告，以及未認證車輛的潛在風險。",
        keywords: ["二手車第三方認證", "中古車認證", "驗車"],
      },
      "used-car-transfer-guide": {
        title: "二手車過戶流程與費用：2026年最新完整指南",
        description: "完整解析2026年二手車過戶流程、所需文件、費用明細與注意事項。讓你輕鬆完成二手車過戶。",
        keywords: ["二手車過戶", "中古車過戶流程", "過戶費用"],
      },
    };
    const meta = blogMeta[slug];
    if (meta) {
      title = `${meta.title}｜${SITE_NAME}`;
      description = meta.description;
      jsonLdBlocks.push(breadcrumb([
        { name: "首頁", url: baseUrl },
        { name: "購車攻略", url: `${baseUrl}/blog` },
        { name: meta.title, url: canonicalUrl },
      ]));
      // Article schema
      jsonLdBlocks.push({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": meta.title,
        "description": meta.description,
        "author": { "@type": "Organization", "name": SITE_NAME },
        "publisher": { "@type": "Organization", "name": SITE_NAME, "url": baseUrl },
        "url": canonicalUrl,
        "keywords": meta.keywords.join(", "),
        "inLanguage": "zh-TW",
      });
    }
  }

  // ---------- Build the meta tag block ----------
  const seoBlock = `
    <!-- SEO Meta Tags -->
    <title>${escAttr(title)}</title>
    <meta name="description" content="${escAttr(description)}" />
    <link rel="canonical" href="${escAttr(canonicalUrl)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

    <!-- Open Graph -->
    <meta property="og:title" content="${escAttr(title)}" />
    <meta property="og:description" content="${escAttr(description)}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${escAttr(canonicalUrl)}" />
    <meta property="og:image" content="${escAttr(ogImage)}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="zh_TW" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escAttr(title)}" />
    <meta name="twitter:description" content="${escAttr(description)}" />
    <meta name="twitter:image" content="${escAttr(ogImage)}" />

    <!-- Additional SEO -->
    <meta name="geo.region" content="TW-KHH" />
    <meta name="geo.placename" content="高雄市" />
    <meta name="author" content="${SITE_NAME}" />
    <meta name="language" content="zh-TW" />

    <!-- JSON-LD Structured Data -->
    ${jsonLdBlocks.map(block => `<script type="application/ld+json">${JSON.stringify(block)}</script>`).join("\n    ")}`;

  // Replace existing <title> tag and inject before </head>
  let result = html.replace(/<title>[^<]*<\/title>/, "");
  result = result.replace("</head>", `${seoBlock}\n</head>`);

  return result;
}

// ============ SITEMAP ROUTER ============

export function createSeoRouter(): Router {
  const router = Router();

  // robots.txt
  router.get("/robots.txt", (_req, res) => {
    const baseUrl = getBaseUrl();
    res.type("text/plain").send(
`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay
Crawl-delay: 1
`
    );
  });

  // sitemap.xml
  router.get("/sitemap.xml", async (_req, res) => {
    try {
      const baseUrl = getBaseUrl();
      const now = new Date().toISOString().split("T")[0];

      // Static pages
      const staticPages = [
        { loc: "/",                              changefreq: "daily",   priority: "1.0" },
        { loc: "/faq",                           changefreq: "monthly", priority: "0.8" },
        { loc: "/blog",                          changefreq: "weekly",  priority: "0.8" },
        { loc: "/blog/buy-used-car-guide",       changefreq: "monthly", priority: "0.7" },
        { loc: "/blog/used-car-loan-guide",      changefreq: "monthly", priority: "0.7" },
        { loc: "/blog/kaohsiung-used-car-guide", changefreq: "monthly", priority: "0.7" },
        { loc: "/blog/third-party-inspection-guide", changefreq: "monthly", priority: "0.7" },
        { loc: "/blog/used-car-transfer-guide",  changefreq: "monthly", priority: "0.7" },
        { loc: "/price/under-30",                changefreq: "weekly",  priority: "0.6" },
        { loc: "/price/30-50",                   changefreq: "weekly",  priority: "0.6" },
        { loc: "/price/50-80",                   changefreq: "weekly",  priority: "0.6" },
        { loc: "/price/over-80",                 changefreq: "weekly",  priority: "0.6" },
      ];

      // Dynamic brand pages
      let brandEntries: string[] = [];
      try {
        const vehicles = await db.getAllVehicles();
        const brands = Array.from(new Set(vehicles.map((v: any) => v.brand).filter(Boolean)));
        brandEntries = brands.map((brand: string) =>
          `  <url>
    <loc>${baseUrl}/brand/${encodeURIComponent(brand)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
        );
      } catch (err) {
        console.error("[SEO] Failed to fetch brands for sitemap:", err);
      }

      // Dynamic vehicle pages + brand pages
      let vehicleEntries: string[] = [];
      try {
        const vehicles = await db.getAllVehicles();
        vehicleEntries = vehicles.map((v: any) =>
          `  <url>
    <loc>${baseUrl}/vehicle/${v.id}</loc>
    <lastmod>${v.updatedAt ? new Date(v.updatedAt).toISOString().split("T")[0] : now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
        );
        // Add unique brand pages
        const brands = Array.from(new Set(vehicles.map((v: any) => v.brand as string)));
        const brandEntries = brands.map(brand =>
          `  <url>
    <loc>${baseUrl}/brand/${encodeURIComponent(brand)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
        );
        vehicleEntries = [...vehicleEntries, ...brandEntries];
      } catch (err) {
        console.error("[SEO] Failed to fetch vehicles for sitemap:", err);
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticPages.map(p => `  <url>
    <loc>${baseUrl}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
${vehicleEntries.join("\n")}
</urlset>`;

      res.type("application/xml").send(xml);
    } catch (err) {
      console.error("[SEO] Sitemap generation failed:", err);
      res.status(500).type("text/plain").send("Sitemap generation failed");
    }
  });

  return router;
}
