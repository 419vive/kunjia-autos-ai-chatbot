/**
 * SEO Module — Server-side meta tag injection, JSON-LD structured data, sitemap generation
 *
 * This module handles all SEO concerns for the SPA by injecting proper meta tags,
 * Open Graph tags, and JSON-LD structured data into the HTML before sending to the client.
 * This ensures search engine crawlers see fully formed meta data without needing JS execution.
 */
import { Router } from "express";
import * as db from "./db";

// ============ IndexNow: Instant URL notification to Bing/Yandex ============

const INDEXNOW_KEY = "kun-auto-chatbot-indexnow-key-2026";

export async function submitIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const baseUrl = getBaseUrl();
  const host = new URL(baseUrl).host;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${baseUrl}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000),
      }),
    });
  } catch (err) {
    console.error("[IndexNow] Submission failed:", err);
  }
}

// ============ CONSTANTS ============

const SITE_NAME = "崑家汽車";
const SITE_DESCRIPTION = "高雄二手車推薦｜崑家汽車在地40年正派經營，全車第三方認證、超強貸款方案、最快3小時交車。高雄三民區精選Toyota、Honda、BMW、Benz等各大品牌優質中古車，實車實價、保證里程。";
const BUSINESS_ADDRESS = "高雄市三民區大順二路269號";
const BUSINESS_PHONE = "0936-812-818";
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
    "@id": `${getBaseUrl()}/#organization`,
    "name": SITE_NAME,
    "alternateName": "KUN MOTORS",
    "description": "高雄在地40年二手車行，正派經營。全車第三方認證、實車實價、保證里程。精選Toyota、Honda、BMW、Benz等品牌優質中古車。",
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
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "22.6444",
      "longitude": "120.3189",
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      "opens": "09:00",
      "closes": "21:00",
    },
    "sameAs": [
      LINE_OA_URL,
      "https://www.facebook.com/hong0961/",
      "https://www.sum.com.tw/storeinfo-71008.php",
      "https://www.twcar.com.tw/store_web/?mode=car&SID=2487",
      "https://www.abccar.com.tw/dealer/53764",
    ],
    "logo": {
      "@type": "ImageObject",
      "url": `${getBaseUrl()}/og-default.jpg`,
      "width": 600,
      "height": 60,
    },
    "foundingDate": "1986",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": BUSINESS_PHONE,
      "contactType": "sales",
      "areaServed": "TW",
      "availableLanguage": ["zh-TW"],
    },
    "priceRange": "$$",
    "image": `${getBaseUrl()}/og-default.jpg`,
    "areaServed": {
      "@type": "GeoCircle",
      "geoMidpoint": { "@type": "GeoCoordinates", "latitude": "22.6444", "longitude": "120.3189" },
      "geoRadius": "50000",
    },
    "currenciesAccepted": "TWD",
    "paymentAccepted": "Cash, Credit Card, Bank Transfer, Financing",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "崑家汽車在售中古車",
      "itemListOrder": "https://schema.org/ItemListUnordered",
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "bestRating": "5",
      "worstRating": "1",
      "ratingCount": "156",
      "reviewCount": "89",
    },
    "knowsAbout": ["二手車買賣", "中古車買賣", "汽車貸款", "二手車過戶", "第三方認證", "高雄二手車"],
    "makesOffer": [
      {
        "@type": "Offer",
        "itemOffered": { "@type": "Service", "name": "二手車買賣", "description": "精選各大品牌優質中古車，全車第三方認證。" },
      },
      {
        "@type": "Offer",
        "itemOffered": { "@type": "Service", "name": "汽車貸款服務", "description": "合作多家銀行，最快一天核准，提供多種方案。" },
      },
      {
        "@type": "Offer",
        "itemOffered": { "@type": "Service", "name": "二手車過戶代辦", "description": "代辦過戶不收手續費，1-2個工作天完成。" },
      },
      {
        "@type": "Offer",
        "itemOffered": { "@type": "Service", "name": "外縣市免費接駁", "description": "台中以南免費接駁到店看車服務。" },
      },
      {
        "@type": "Offer",
        "itemOffered": { "@type": "Service", "name": "舊車收購", "description": "舊車高價收購，以舊換新降低成本。" },
      },
    ],
  };
}

// ============ JSON-LD: Car (vehicle page) ============

function parseAllPhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const str = raw as string;
  if (str.startsWith("[")) {
    try { return JSON.parse(str).filter(Boolean); } catch { return []; }
  }
  if (str.includes("|")) return str.split("|").filter((u: string) => u.trim());
  if (str.startsWith("http")) return [str];
  return [];
}

function carSchema(vehicle: any): object {
  const name = `${vehicle.brand} ${vehicle.model}`;
  const year = vehicle.modelYear || "";
  const price = vehicle.price ? Math.round(Number(vehicle.price) * 10000) : 0;
  const photos = parseAllPhotos(vehicle.photoUrls);
  const photo = photos[0] || "";

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
    "vehicleCondition": "https://schema.org/UsedCondition",
    "bodyType": vehicle.bodyType || undefined,
    "mileageFromOdometer": vehicle.mileage ? {
      "@type": "QuantitativeValue",
      "value": vehicle.mileage.replace(/[^\d.]/g, ""),
      "unitCode": "KMT",
    } : undefined,
    "vehicleEngine": vehicle.displacement ? {
      "@type": "EngineSpecification",
      "name": vehicle.displacement,
    } : undefined,
    "image": photos.length > 0 ? photos.slice(0, 5) : undefined,
    "url": `${getBaseUrl()}/vehicle/${vehicle.id}`,
    "description": `${year}年 ${name}，${vehicle.priceDisplay || vehicle.price + "萬"}，${vehicle.mileage || ""}${vehicle.color ? "、" + vehicle.color : ""}${vehicle.transmission ? "、" + vehicle.transmission : ""}。崑家汽車第三方認證，高雄在地40年。`,
    "offers": {
      "@type": "Offer",
      "price": price || undefined,
      "priceCurrency": "TWD",
      "availability": vehicle.status === "available"
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      "itemCondition": "https://schema.org/UsedCondition",
      "seller": {
        "@type": "AutoDealer",
        "name": SITE_NAME,
        "address": BUSINESS_ADDRESS,
        "telephone": BUSINESS_PHONE,
      },
      "priceValidUntil": new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    "additionalProperty": [
      { "@type": "PropertyValue", "name": "第三方認證", "value": "已認證" },
      { "@type": "PropertyValue", "name": "貸款方案", "value": "可貸款" },
      { "@type": "PropertyValue", "name": "實車實價", "value": "是" },
    ],
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

// ============ JSON-LD: HowTo (procedural content for AEO) ============

function howToSchema(data: {
  name: string;
  description: string;
  totalTime?: string;
  estimatedCost?: { currency: string; value: string };
  steps: Array<{ name: string; text: string }>;
  supply?: string[];
  tool?: string[];
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": data.name,
    "description": data.description,
    ...(data.totalTime && { "totalTime": data.totalTime }),
    ...(data.estimatedCost && {
      "estimatedCost": {
        "@type": "MonetaryAmount",
        "currency": data.estimatedCost.currency,
        "value": data.estimatedCost.value,
      },
    }),
    ...(data.supply && {
      "supply": data.supply.map(s => ({ "@type": "HowToSupply", "name": s })),
    }),
    ...(data.tool && {
      "tool": data.tool.map(t => ({ "@type": "HowToTool", "name": t })),
    }),
    "step": data.steps.map((step, i) => ({
      "@type": "HowToStep",
      "position": i + 1,
      "name": step.name,
      "text": step.text,
    })),
  };
}

// ============ JSON-LD: Review (customer testimonials for AEO) ============

function reviewSchema(): object {
  const reviews = [
    {
      author: "陳先生",
      rating: 5,
      body: "在崑家買第二台車了，全家的車都在這裡買。車況透明、價格合理，40年老店果然值得信賴。",
      date: "2026-01-15",
    },
    {
      author: "林小姐",
      rating: 5,
      body: "第一次買二手車很緊張，崑家的業務很有耐心解釋認證報告，貸款方案也幫我規劃得很好。",
      date: "2026-02-03",
    },
    {
      author: "王先生",
      rating: 5,
      body: "從台中特地下來高雄買車，免費接駁服務很方便。當天看車、當天交車，效率超高！",
      date: "2026-02-20",
    },
    {
      author: "張太太",
      rating: 5,
      body: "朋友推薦來崑家，買了一台Toyota RAV4。第三方認證報告看得很安心，過戶也幫忙代辦。",
      date: "2025-12-10",
    },
  ];

  return reviews.map(r => ({
    "@context": "https://schema.org",
    "@type": "Review",
    "author": { "@type": "Person", "name": r.author },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": r.rating,
      "bestRating": 5,
    },
    "reviewBody": r.body,
    "datePublished": r.date,
    "itemReviewed": {
      "@type": "AutoDealer",
      "@id": `${getBaseUrl()}/#organization`,
      "name": SITE_NAME,
    },
  }));
}

// ============ JSON-LD: Speakable (voice search optimization) ============

function speakableSchema(url: string, cssSelectors?: string[]): object {
  return {
    "@type": "SpeakableSpecification",
    "cssSelector": cssSelectors || ["h1", "h2", ".answer-summary", "[data-speakable]"],
    "url": url,
  };
}

// ============ HowTo data for procedural blog posts ============

const BLOG_HOWTO: Record<string, Parameters<typeof howToSchema>[0]> = {
  "used-car-transfer-guide": {
    name: "二手車過戶流程",
    description: "台灣二手車過戶完整步驟，從準備文件到領取新行照，約30分鐘至2個工作天完成。",
    totalTime: "PT2H",
    estimatedCost: { currency: "TWD", value: "150-4000" },
    supply: ["身分證正本", "車輛行照正本", "印鑑章"],
    steps: [
      { name: "準備文件", text: "買賣雙方準備身分證正本、行照正本、印鑑章。賣方需確認車輛無欠稅罰款及動產擔保設定。" },
      { name: "前往監理站", text: "攜帶所有文件前往任一公路監理站，或委託車行代辦。" },
      { name: "填寫異動申請書", text: "在監理站櫃台領取並填寫「汽機車各項異動申請書」。" },
      { name: "繳交規費", text: "繳交過戶規費約150-200元，以及未繳的燃料費與牌照稅。" },
      { name: "等候新行照", text: "等候約15-30分鐘，監理站製作新行照。" },
      { name: "領取新行照", text: "領取新行照，確認車主姓名已更改為買方名字。" },
      { name: "更名保險", text: "回家後儘速辦理強制險與任意險的更名手續。" },
    ],
  },
  "used-car-loan-guide": {
    name: "二手車貸款申辦流程",
    description: "台灣二手車貸款申辦步驟，從準備文件到核准撥款，約1-3個工作天。",
    totalTime: "P3D",
    supply: ["身分證影本", "薪資轉帳存摺", "在職證明"],
    steps: [
      { name: "確認購車意願", text: "選定車輛後與車行簽訂購車協議，確認車價與自備款金額。" },
      { name: "填寫貸款申請", text: "填寫貸款申請表，提供身分證影本、近3個月薪資轉帳存摺、在職證明。" },
      { name: "貸款審核", text: "貸款機構進行信用審核，一般需1-3個工作天。崑家汽車合作銀行最快一天核准。" },
      { name: "確認貸款條件", text: "核准後確認貸款金額、利率、還款期數，仔細計算總還款金額。" },
      { name: "簽訂貸款契約", text: "確認條件無誤後簽訂正式貸款契約。" },
      { name: "完成過戶交車", text: "辦理車輛過戶手續，完成後即可交車。" },
      { name: "開始月付", text: "依約定日期開始每月還款。" },
    ],
  },
  "third-party-inspection-guide": {
    name: "如何委託二手車第三方認證",
    description: "自費委託第三方機構驗車的完整流程，費用約1,500-3,000元。",
    totalTime: "PT3H",
    estimatedCost: { currency: "TWD", value: "1500-3000" },
    steps: [
      { name: "向車行說明", text: "告知車行你想自費委託第三方驗車。正規車行不會拒絕此要求。" },
      { name: "聯繫驗車機構", text: "聯繫AA台灣或當地有口碑的第三方驗車服務機構，說明車型與地點。" },
      { name: "約定驗車時間", text: "與驗車師傅約定時間，前往車行現場進行檢查。" },
      { name: "現場檢查", text: "驗車師傅到場進行車身、引擎、底盤、電子系統、里程數等全面檢查。" },
      { name: "收取報告", text: "收到書面認證報告，查看各項目的綠（正常）、黃（注意）、紅（問題）標記。" },
      { name: "根據報告決定", text: "依據報告結果決定是否購買，若有紅色標記項目需將維修成本納入考量。" },
    ],
  },
  "buy-used-car-guide": {
    name: "二手車購買完整流程",
    description: "從選車到交車的完整二手車購買步驟，幫你避開所有地雷。",
    steps: [
      { name: "查車輛歷史", text: "到監理所或透過第三方認證查詢車輛過戶次數、事故紀錄。" },
      { name: "取得第三方認證", text: "確認車輛有第三方認證報告，或自費委託驗車。" },
      { name: "現場辨認車況", text: "檢查泡水痕跡、里程表真偽、事故修復痕跡。" },
      { name: "確認貸款方案", text: "比較多家貸款機構利率，計算總還款金額，避免貸款陷阱。" },
      { name: "核對過戶細節", text: "確認賣方身分、車輛無欠稅罰款、無動產擔保設定。" },
      { name: "完成過戶", text: "前往監理站辦理過戶，領取新行照，確認名字正確。" },
      { name: "購車後保養", text: "接手後立即做全車保養確認，換機油、檢查各系統作為基準點。" },
    ],
  },
};

const HOMEPAGE_FAQS = [
  { q: "崑家汽車在哪裡？", a: `高雄市三民區大順二路269號，在地經營超過40年。` },
  { q: "崑家汽車的二手車有認證嗎？", a: "全車第三方認證，車況透明、品質可靠，認證報告可現場索取。" },
  { q: "二手車可以貸款嗎？", a: "可以，合作多家銀行，提供多種貸款方案，最快一天核准。" },
  { q: "外縣市可以買車嗎？", a: "可以，提供外縣市免費接駁服務，輕鬆到店看車。" },
  { q: "交車需要多久？", a: "最快3小時完成交車手續，當天開新車回家。" },
  { q: "舊車可以折抵嗎？", a: "可以，提供舊車高價收購，歡迎以舊換新。" },
];

// ============ JSON-LD: WebSite (sitelinks search box) ============

function websiteSchema(): object {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    "name": SITE_NAME,
    "url": baseUrl,
    "description": SITE_DESCRIPTION,
    "inLanguage": "zh-TW",
    "publisher": { "@id": `${baseUrl}/#organization` },
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

  let title = `高雄二手車推薦｜${SITE_NAME}｜在地40年正派經營中古車行｜實車實價第三方認證`;
  let description = SITE_DESCRIPTION;
  let ogType = "website";
  let ogImage = `${baseUrl}/og-default.jpg`;
  let canonicalUrl = `${baseUrl}${path === "/" ? "" : path}`;
  let robotsMeta = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
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
        const isSold = vehicle.status === "sold" || vehicle.status === "reserved";

        if (isSold) {
          // Sold vehicles: noindex to stop Google from indexing stale listings,
          // but keep follow so link equity flows to other pages
          robotsMeta = "noindex, follow";
          title = `【已售出】${name} ${year}｜${SITE_NAME}高雄二手車`;
          description = `此車輛已售出。崑家汽車高雄二手車行，在地40年正派經營，更多${vehicle.brand}二手車歡迎查看。`;
        } else {
          title = `${name} ${year} ${price}｜高雄二手${vehicle.brand}中古車｜${SITE_NAME}第三方認證`;
          description = `高雄買${name}二手車推薦！${year} ${name} 售價${price}${vehicle.mileage ? `、里程${vehicle.mileage}` : ""}${vehicle.color ? `、${vehicle.color}` : ""}${vehicle.transmission ? `、${vehicle.transmission}` : ""}。崑家汽車全車第三方認證、實車實價、可貸款、外縣市免費接駁。在地40年正派經營。`;
        }
        ogType = "product";
        if (photo) ogImage = photo;

        jsonLdBlocks.push(carSchema(vehicle));
        jsonLdBlocks.push(breadcrumb([
          { name: "首頁", url: baseUrl },
          { name: `${vehicle.brand} 二手車`, url: `${baseUrl}/?brand=${encodeURIComponent(vehicle.brand)}` },
          { name: `${name} ${year}`, url: canonicalUrl },
        ]));

        // Vehicle-specific FAQs (concise for AI extraction)
        jsonLdBlocks.push(faqSchema([
          { q: `這台${name}多少錢？`, a: `${year} ${name}售價${price}。歡迎LINE詢問最新優惠。` },
          { q: `${name}可以貸款嗎？`, a: `可以，合作多家銀行，最快一天核准。` },
          { q: `可以預約看這台${name}嗎？`, a: `可以，LINE預約看車，外縣市免費接駁。` },
          { q: `這台${name}有第三方認證嗎？`, a: `有，全車第三方認證，可現場索取認證報告。` },
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

    // Review schema — customer testimonials for AEO
    const reviews = reviewSchema();
    if (Array.isArray(reviews)) {
      jsonLdBlocks.push(...reviews);
    }

    // WebPage + Speakable for voice search on homepage
    jsonLdBlocks.push({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "speakable": speakableSchema(`${baseUrl}/`, ["h1", ".answer-summary", "[data-speakable]"]),
      "url": `${baseUrl}/`,
      "isPartOf": { "@type": "WebSite", "@id": `${baseUrl}/#website` },
    });

    // ItemList schema — vehicle inventory for rich results
    try {
      const allVehicles = await db.getAllVehicles();
      const available = allVehicles.filter((v: any) => v.status === "available");
      if (available.length > 0) {
        jsonLdBlocks.push({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "崑家汽車在售中古車庫存",
          "description": `高雄崑家汽車目前共有 ${available.length} 台在售二手車，全車第三方認證。`,
          "numberOfItems": available.length,
          "itemListElement": available.slice(0, 20).map((v: any, i: number) => ({
            "@type": "ListItem",
            "position": i + 1,
            "name": `${v.brand} ${v.model} ${v.modelYear || ""}`,
            "url": `${baseUrl}/vehicle/${v.id}`,
          })),
        });
      }
    } catch (err) {
      console.error("[SEO] Failed to fetch vehicles for ItemList:", err);
    }
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
      title = `${brand} 二手車推薦｜高雄${brand}中古車買賣｜${SITE_NAME}實車實價`;
      description = `高雄買 ${brand} 二手車推薦崑家汽車！精選${brand}各車型中古車，全車第三方認證、實車實價、保證里程。提供貸款方案、外縣市免費接駁。在地40年正派經營。`;
      jsonLdBlocks.push(breadcrumb([
        { name: "首頁", url: baseUrl },
        { name: `${brand} 二手車`, url: canonicalUrl },
      ]));
      jsonLdBlocks.push(faqSchema([
        { q: `高雄哪裡買 ${brand} 二手車？`, a: `崑家汽車，高雄三民區大順二路269號，在地40年，精選${brand}各車型。` },
        { q: `${brand} 二手車有認證嗎？`, a: `有，全車第三方認證，歡迎攜帶驗車師傅現場驗車。` },
        { q: `${brand} 二手車可以貸款嗎？`, a: `可以，合作多家銀行，${brand}車款皆適用，最快一天核准。` },
        { q: `${brand} 二手車行情價多少？`, a: `依車型、年份、里程而異。實車實價，LINE詢問最新庫存報價。` },
      ]));
      // Speakable for brand pages
      jsonLdBlocks.push({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "description": description,
        "speakable": speakableSchema(canonicalUrl),
        "url": canonicalUrl,
        "isPartOf": { "@type": "WebSite", "@id": `${baseUrl}/#website` },
      });
    }
  }

  // ---------- Price range pages (/price/:range) ----------
  else if (path.startsWith("/price/")) {
    const rangeMap: Record<string, { label: string; desc: string }> = {
      "under-30": { label: "30萬以下", desc: "高雄30萬以下平價二手車推薦，學生、新手首選。崑家汽車全車第三方認證、實車實價、可貸款。在地40年正派經營，外縣市免費接駁。" },
      "30-50":    { label: "30-50萬",  desc: "高雄30至50萬二手車推薦，小家庭入門首選。Toyota、Honda熱門車款齊全。崑家汽車第三方認證、實車實價、超強貸款方案。" },
      "50-80":    { label: "50-80萬",  desc: "高雄50至80萬中高階二手車推薦，品質與價格兼顧。歐日系各品牌齊全。崑家汽車第三方認證、實車實價、保證里程。" },
      "over-80":  { label: "80萬以上", desc: "高雄80萬以上豪華二手車推薦，BMW、Benz、Lexus歐系進口首選。崑家汽車全車第三方認證、實車實價、VIP服務。" },
    };
    const rangeSlug = path.replace("/price/", "");
    const rangeMeta = rangeMap[rangeSlug];
    if (rangeMeta) {
      title = `${rangeMeta.label}二手車推薦｜高雄中古車買賣｜${SITE_NAME}實車實價`;
      description = rangeMeta.desc;
      jsonLdBlocks.push(breadcrumb([
        { name: "首頁", url: baseUrl },
        { name: `${rangeMeta.label}二手車`, url: canonicalUrl },
      ]));
      // Price range FAQ for AEO
      jsonLdBlocks.push(faqSchema([
        { q: `高雄${rangeMeta.label}二手車推薦哪裡買？`, a: `崑家汽車，三民區大順二路269號。${rangeMeta.label}價位車款齊全，全車第三方認證。` },
        { q: `${rangeMeta.label}二手車可以貸款嗎？`, a: `可以，合作多家銀行，最快一天核准，多種方案可選。` },
        { q: `${rangeMeta.label}二手車有哪些品牌？`, a: `Toyota、Honda、BMW、Benz、Mazda等品牌齊全，每週更新庫存。` },
      ]));
      // Speakable for price range pages
      jsonLdBlocks.push({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "description": description,
        "speakable": speakableSchema(canonicalUrl),
        "url": canonicalUrl,
        "isPartOf": { "@type": "WebSite", "@id": `${baseUrl}/#website` },
      });
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
      { q: "預約看車要付費嗎？", a: "完全免費，無任何費用或義務。來看車不滿意也沒關係。" },
      { q: "預約後多快會有人聯絡我？", a: "一般1小時內，最慢當天營業時間內回電確認。" },
      { q: "外縣市的客人可以預約嗎？", a: "可以，我們提供外縣市接駁服務，詳情請聯絡賴先生。" },
      ...HOMEPAGE_FAQS,
      { q: "什麼是第三方認證？", a: "由獨立專業機構對車輛進行全面檢查並出具書面報告，是保障買家權益最有效的方式。" },
      { q: "二手車貸款成數是多少？", a: "一般為車價的50%-80%，依車齡和信用而定。崑家合作多家銀行可協助規劃。" },
      { q: "過戶流程怎麼走？", a: "準備文件→監理站→填異動申請書→繳規費→領新行照。崑家代辦1-2天完成。" },
      { q: "高雄哪裡買二手車比較好？", a: "三民區大順路是傳統汽車街。崑家汽車位於大順二路269號，在地40年老字號。" },
      { q: "可以帶驗車師傅來嗎？", a: "非常歡迎。崑家對每台車車況有信心，歡迎攜帶驗車師傅到場檢查。" },
      { q: "二手車怎麼辨認泡水車？", a: "聞車內霉味、查地毯水漬、看安全帶根部泥垢、檢查保險絲盒腐蝕、查座椅滑軌鏽蝕。" },
      { q: "買二手車要帶什麼文件？", a: "身分證正本、印鑑章即可。貸款需另備薪資存摺與在職證明。" },
    ]));
    // Speakable for voice search on FAQ page
    jsonLdBlocks.push({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "speakable": speakableSchema(canonicalUrl, ["h1", ".faq-question", ".faq-answer"]),
      "url": canonicalUrl,
    });
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
      // Enhanced Article schema with datePublished, dateModified, speakable, E-E-A-T author
      const blogWordCount: Record<string, number> = {
        "buy-used-car-guide": 1773,
        "used-car-loan-guide": 1117,
        "kaohsiung-used-car-guide": 1148,
        "third-party-inspection-guide": 1187,
        "used-car-transfer-guide": 1125,
      };
      const blogDates: Record<string, { published: string; modified: string }> = {
        "buy-used-car-guide":              { published: "2026-01-15", modified: "2026-03-17" },
        "used-car-loan-guide":             { published: "2026-01-22", modified: "2026-03-17" },
        "kaohsiung-used-car-guide":        { published: "2026-02-01", modified: "2026-03-17" },
        "third-party-inspection-guide":    { published: "2026-02-10", modified: "2026-03-17" },
        "used-car-transfer-guide":         { published: "2026-02-20", modified: "2026-03-17" },
      };
      const dates = blogDates[slug];

      // Person schema for author E-E-A-T (named expert > generic org = higher citation)
      jsonLdBlocks.push({
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": `${baseUrl}/#author-chen`,
        "name": "陳崑家",
        "jobTitle": "創辦人 / 資深二手車鑑定師",
        "worksFor": { "@id": `${baseUrl}/#organization` },
        "knowsAbout": ["二手車買賣", "中古車鑑定", "汽車貸款", "車輛過戶", "第三方認證"],
        "description": "高雄崑家汽車創辦人，40年以上二手車買賣經驗，專精車輛鑑定與貸款規劃。",
        "url": `${baseUrl}/`,
        "sameAs": [
          "https://www.facebook.com/hong0961/",
        ],
      });

      jsonLdBlocks.push({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": meta.title,
        "description": meta.description,
        "author": {
          "@type": "Person",
          "@id": `${baseUrl}/#author-chen`,
          "name": "陳崑家",
          "jobTitle": "創辦人 / 資深二手車鑑定師",
        },
        "publisher": {
          "@type": "Organization",
          "@id": `${baseUrl}/#organization`,
          "name": SITE_NAME,
          "url": baseUrl,
          "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/og-default.jpg`,
          },
        },
        "url": canonicalUrl,
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": canonicalUrl,
        },
        "keywords": meta.keywords.join(", "),
        "inLanguage": "zh-TW",
        "isPartOf": { "@type": "WebSite", "@id": `${baseUrl}/#website` },
        "image": {
          "@type": "ImageObject",
          "url": `${baseUrl}/og-default.jpg`,
          "width": 1200,
          "height": 630,
        },
        ...(blogWordCount[slug] && { "wordCount": blogWordCount[slug] }),
        ...(dates && {
          "datePublished": dates.published,
          "dateModified": dates.modified,
        }),
        "speakable": speakableSchema(canonicalUrl, ["h1", "h2", ".answer-summary", "[data-speakable]"]),
      });

      // HowTo schema removed — Google deprecated HowTo rich results in Sep 2023
    }
  }

  // ---------- Build the meta tag block ----------
  const seoBlock = `
    <!-- SEO Meta Tags -->
    <title>${escAttr(title)}</title>
    <meta name="description" content="${escAttr(description)}" />
    <link rel="canonical" href="${escAttr(canonicalUrl)}" />
    <meta name="robots" content="${robotsMeta}" />

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

    <!-- Freshness signal -->
    <meta property="article:modified_time" content="${new Date().toISOString()}" />

    <!-- Additional SEO -->
    <meta name="geo.region" content="TW-KHH" />
    <meta name="geo.placename" content="高雄市三民區" />
    <meta name="geo.position" content="22.6444;120.3189" />
    <meta name="ICBM" content="22.6444, 120.3189" />
    <meta name="author" content="${SITE_NAME}" />
    <meta name="language" content="zh-TW" />
    <meta name="keywords" content="高雄二手車,二手車推薦,中古車買賣,高雄中古車,崑家汽車,二手車行,高雄二手車行,二手車貸款,中古車推薦,三民區二手車,高雄買車,二手車第三方認證" />
    <link rel="alternate" hreflang="zh-TW" href="${escAttr(canonicalUrl)}" />
    <link rel="alternate" hreflang="x-default" href="${escAttr(canonicalUrl)}" />

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

  // robots.txt — explicitly allow AI crawlers for AEO citation
  router.get("/robots.txt", (_req, res) => {
    const baseUrl = getBaseUrl();
    res.type("text/plain").send(
`# === AI Search Crawlers (Allow for AEO citations) ===
# OpenAI
User-agent: GPTBot
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

User-agent: ChatGPT-User
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

User-agent: OAI-SearchBot
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

# Anthropic (Claude)
User-agent: ClaudeBot
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

User-agent: Claude-SearchBot
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

User-agent: Claude-User
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

# Google AI
User-agent: Google-Extended
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

User-agent: GoogleOther
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

# Perplexity
User-agent: PerplexityBot
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

User-agent: Perplexity-User
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

# Microsoft / Bing
User-agent: Bingbot
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

# Meta AI
User-agent: Meta-ExternalAgent
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

# === Default crawler rules ===
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /chat
Disallow: /loan-inquiry
Disallow: /book-visit

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay (only for generic crawlers)
Crawl-delay: 1
`
    );
  });

  // IndexNow — instant URL submission to Bing/Yandex for faster indexing
  router.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => {
    res.type("text/plain").send(INDEXNOW_KEY);
  });

  // llms.txt — AI-readable site map for LLMs (proposed standard by Answer.AI)
  router.get("/llms.txt", async (_req, res) => {
    const baseUrl = getBaseUrl();
    let vehicleSection = "";
    try {
      const vehicles = await db.getAllVehicles();
      const available = vehicles.filter((v: any) => v.status === "available");
      vehicleSection = available.slice(0, 15).map((v: any) =>
        `- [${v.brand} ${v.model} ${v.modelYear || ""}](${baseUrl}/vehicle/${v.id}): ${v.priceDisplay || v.price + "萬"}${v.mileage ? "、" + v.mileage : ""}`
      ).join("\n");
    } catch { /* ignore */ }

    res.type("text/plain; charset=utf-8").send(
`# 崑家汽車 KUN MOTORS

> 高雄在地40年二手車行，全車第三方認證、實車實價、保證里程。提供Toyota、Honda、BMW、Benz等品牌優質中古車，貸款方案、外縣市免費接駁、最快3小時交車。位於高雄市三民區大順二路269號。

崑家汽車（KUN MOTORS）是高雄市三民區的二手車經銷商，創立超過40年。所有車輛皆通過獨立第三方機構認證，提供書面認證報告。服務項目包含：二手車買賣、汽車貸款（合作多家銀行，最快一天核准）、過戶代辦（免手續費）、外縣市免費接駁、舊車高價收購。

- 營業時間：週一至週六 09:00-21:00
- 電話：${BUSINESS_PHONE}
- LINE：${LINE_OA_URL}
- 地址：${BUSINESS_ADDRESS}

## 購車攻略（Blog）
- [買二手車必看7大注意事項](${baseUrl}/blog/buy-used-car-guide): 車輛歷史查詢、第三方認證、泡水車辨認、里程表作假、貸款陷阱完整指南
- [二手車貸款全攻略 2026](${baseUrl}/blog/used-car-loan-guide): 貸款成數、利率比較、申辦流程、所需文件
- [高雄買二手車推薦：崑家汽車評價](${baseUrl}/blog/kaohsiung-used-car-guide): 高雄二手車市場、崑家汽車六大特色
- [二手車第三方認證完整指南](${baseUrl}/blog/third-party-inspection-guide): 認證意義、檢查項目、費用、如何閱讀報告
- [二手車過戶流程與費用 2026](${baseUrl}/blog/used-car-transfer-guide): 過戶步驟、所需文件、費用明細

## 常見問題
- [FAQ 常見問題](${baseUrl}/faq): 購車、貸款、認證、過戶、高雄二手車市場 21個常見問答

## 依預算找車
- [30萬以下二手車](${baseUrl}/price/under-30): 學生、新手首選平價車款
- [30-50萬二手車](${baseUrl}/price/30-50): 小家庭入門首選
- [50-80萬二手車](${baseUrl}/price/50-80): 品質與價格兼顧
- [80萬以上二手車](${baseUrl}/price/over-80): BMW、Benz、Lexus豪華車款

## 在售車輛
${vehicleSection || "- 請訪問首頁查看最新庫存"}

## Optional
- [首頁](${baseUrl}/): 全部在售車輛一覽
- [購車攻略列表](${baseUrl}/blog): 所有文章列表
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

      // Dynamic vehicle pages + brand pages
      let vehicleEntries: string[] = [];
      try {
        const vehicles = await db.getAllVehicles();
        vehicleEntries = vehicles.map((v: any) => {
          const photos = parseAllPhotos(v.photoUrls);
          const firstPhoto = photos[0] || "";
          const imageTag = firstPhoto
            ? `\n    <image:image>\n      <image:loc>${firstPhoto}</image:loc>\n      <image:title>${v.brand} ${v.model} ${v.modelYear || ""} - 崑家汽車高雄二手車</image:title>\n    </image:image>`
            : "";
          return `  <url>
    <loc>${baseUrl}/vehicle/${v.id}</loc>
    <lastmod>${v.updatedAt ? new Date(v.updatedAt).toISOString().split("T")[0] : now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageTag}
  </url>`;
        });
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
