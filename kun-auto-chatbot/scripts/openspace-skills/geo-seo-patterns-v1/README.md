# GEO/SEO Patterns for 崑家汽車 — v1

**Solved:** 2026-03-31  
**Site:** kunjia-autos.com  
**Stack:** TypeScript / React / Express / Vite

## Problem
Used car dealership lacked E-E-A-T signals, AI citability, structured data for local SEO,
and geo-targeted content for 12 Taiwan cities outside Kaohsiung.

## Solutions Applied

### 1. Person Schema for Founder E-E-A-T
**File:** `server/seo.ts` — inside `autoDealer()` function

```typescript
"founder": {
  "@type": "Person",
  "@id": `${getBaseUrl()}/#founder`,
  "name": "賴崑家",
  "jobTitle": "創辦人",
  "worksFor": { "@id": `${getBaseUrl()}/#organization` },
  "knowsAbout": ["二手車買賣", "汽車貸款", "中古車認證", "高雄汽車市場"],
}
```

**Why it works:** Google's E-E-A-T guidelines reward pages with identifiable expertise.
Naming the founder with a Person schema creates a knowledge graph node.

---

### 2. ServiceChannel for Physical Pickup Point
**File:** `server/seo.ts` — area page handler, only for `city.type === "out-of-city"`

```typescript
{
  "@type": "ServiceChannel",
  "name": "左營高鐵站免費接送服務",
  "serviceLocation": {
    "@type": "Place",
    "name": "高鐵左營站",
    "geo": { "@type": "GeoCoordinates", "latitude": "22.7426", "longitude": "120.2976" }
  },
  "availableLanguage": { "@type": "Language", "name": "Chinese" },
  "servicePhone": { "@type": "ContactPoint", "telephone": "+886-936-812-818" }
}
```

**Why it works:** Signals physical presence for out-of-city visitors, reduces perceived friction.

---

### 3. AI Citability Block Pattern
**File:** `client/src/pages/ServiceAreaPage.tsx`

```tsx
<section data-ai-summary="true" itemScope itemType="https://schema.org/AutoDealer">
  <h2>崑家汽車快速資訊</h2>
  <dl>
    <div><dt>負責人</dt><dd itemProp="name">賴崑家</dd></div>
    <div><dt>成立年份</dt><dd itemProp="foundingDate">1986年</dd></div>
    <div><dt>地址</dt><dd itemProp="address">高雄市三民區大順二路269號</dd></div>
    <div><dt>電話</dt><dd><a href="tel:0936812818" itemProp="telephone">0936-812-818</a></dd></div>
    <div><dt>營業時間</dt><dd>週一至週日 9:30-20:00</dd></div>
    {!isLocal && <div><dt>外縣市接駁</dt><dd>免費 · 高鐵左營站接送</dd></div>}
  </dl>
</section>
```

**Why it works:** AI search engines (ChatGPT, Perplexity) extract `data-ai-summary` blocks
for citations. The `<dl>` structure with microdata doubles as JSON-LD fallback.

---

### 4. FAQ Expansion Strategy (4 → 8 per area page)
Target questions using PAA (People Also Ask) patterns:

| Category | Example Question |
|----------|-----------------|
| Founder identity | 崑家汽車是誰開的？老闆是誰？ |
| Brand comparison | 崑家汽車跟 HOT 大聯盟哪個好？ |
| Inventory | 崑家有賣 Toyota 嗎？ |
| Same-day service | 台南人可以當天看車買車嗎？ |
| Travel cost | 從[城市]去高雄看二手車划算嗎？ |

**Files:** `client/src/data/serviceAreas.ts` (client), `server/seo.ts` (server FAQPage schema)

---

### 5. GBP sameAs Link
```typescript
"sameAs": [
  "https://www.facebook.com/kunjia.auto",
  "https://www.instagram.com/kunjia_auto",
  "https://maps.app.goo.gl/[GBP_LINK]"  // Add your Google Business Profile link
]
```

---

## Area Links in Vehicle Pages
Added "附近服務地區" section to `VehicleLanding.tsx` with links to 9 area pages.
Creates internal link equity from high-traffic vehicle pages to area pages.

## Key Metrics to Track
- Schema Rich Results in Google Search Console
- AI citation appearances (query ChatGPT: "高雄二手車推薦")
- Organic impressions for out-of-city area pages
- "People Also Ask" click-through rates

## Next Steps
- Meta Pixel installation (pending Pixel ID from Business Manager)
- Google Search Console API integration for automated rank tracking
- Programmatic Brand×City landing pages (e.g., /vehicles/toyota/kaohsiung)
