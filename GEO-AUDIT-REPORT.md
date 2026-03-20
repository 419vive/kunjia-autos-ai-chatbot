# GEO Audit Report: 崑家汽車 (Kun Family Auto)

**Audit Date:** 2026-03-20
**URL:** https://claude-code-remote-production.up.railway.app
**Business Type:** Local Business (Used Car Dealer)
**Location:** 高雄市三民區 (Sanmin District, Kaohsiung, Taiwan)
**Pages Analyzed:** Source code audit (all routes, templates, schemas, and content)
**Audit Method:** 5 parallel specialist agents analyzing full codebase

---

## Executive Summary

**Overall GEO Score: 66/100 (Fair)**

崑家汽車 has a solid GEO foundation — excellent AI crawler access in robots.txt, comprehensive JSON-LD schema (12+ types), llms.txt endpoint, BLUF answer blocks, and server-side meta injection. However, three critical gaps prevent the site from being effectively cited by AI systems: **(1)** the site is a client-side SPA with no server-rendered body content, meaning AI crawlers see an empty `<div id="root"></div>`, **(2)** no Wikidata entity exists, severely limiting entity recognition across all AI platforms, and **(3)** the custom domain `kuncar.tw` is not deployed, causing all canonical URLs to point to a non-resolving domain.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability | 68/100 | 25% | 17.0 |
| Brand Authority | 52/100 | 20% | 10.4 |
| Content E-E-A-T | 72/100 | 20% | 14.4 |
| Technical GEO | 78/100 | 15% | 11.7 |
| Schema & Structured Data | 72/100 | 10% | 7.2 |
| Platform Optimization | 52/100 | 10% | 5.2 |
| **Overall GEO Score** | | | **65.9 ≈ 66/100** |

---

## Critical Issues (Fix Immediately)

### 1. No Server-Side Rendering for Body Content
**Severity:** CRITICAL | **Category:** Technical GEO
**Impact:** All AI crawlers (GPTBot, ClaudeBot, PerplexityBot) see only `<div id="root"></div>` in the HTML body.

The site uses React SPA with server-side *meta injection only* — JSON-LD, OG tags, and meta descriptions are injected into `<head>`, but the actual page content (vehicle listings, blog text, FAQ answers, headings, internal links) requires JavaScript execution to render.

**Why this matters:** GPTBot and PerplexityBot do limited JS execution. They can read the JSON-LD schemas (which is why schema scores are decent), but they cannot extract the actual page text, content hierarchy, or internal link structure.

**Fix options (choose one):**
- **Best:** Migrate to Next.js with SSR/SSG for all public pages
- **Good:** Add a lightweight SSR layer that pre-renders H1, first paragraph, and navigation into HTML
- **Quick win:** Create a `/llms-full.txt` endpoint serving all blog/FAQ content as Markdown — bypasses the SPA problem entirely for AI crawlers

**Location:** `server/vite.ts` (meta injection), `client/index.html` (empty body)

### 2. Custom Domain Not Deployed
**Severity:** CRITICAL | **Category:** Technical GEO, Brand Authority
**Impact:** All canonical URLs, hreflang tags, sameAs references, and sitemap entries point to `kuncar.tw` which does not resolve.

The code has `// TODO: Update with actual domain` at `server/seo.ts:47`. Google will not index pages whose canonical URL returns DNS errors. Every AI platform citation would use a broken URL.

**Fix:** Configure `kuncar.tw` DNS to point to Railway deployment, or update all canonical references to use the Railway subdomain until the custom domain is ready.

**Location:** `server/seo.ts:45-47` (`getBaseUrl()`)

### 3. No Wikidata Entity
**Severity:** CRITICAL | **Category:** Brand Authority, AI Citability
**Impact:** AI systems cannot verify 崑家汽車 as a known entity. ChatGPT scores 10/35 on entity recognition.

A `create-wikidata-entity.py` script exists in the repo but has never been executed — no `.wikidata-entity-id` file found. Without Wikidata, the business has no machine-readable knowledge base entry that AI models can reference.

**Fix:** Run the entity creation script with Wikidata bot credentials, then add the resulting URL to both Organization and Person sameAs arrays.

**Location:** `scripts/create-wikidata-entity.py`, `server/seo.ts:104-110` (sameAs array)

---

## High Priority Issues

### 4. Duplicate OG Meta Tags
**Severity:** HIGH | **Category:** Technical GEO
Base `index.html` (lines 23-27) has default OG tags that are NOT stripped by `injectSeoTags()`. The server only strips `<title>` before re-injecting. Crawlers see duplicate `og:title` and `og:description` — first occurrence (stale defaults) takes precedence.

**Fix:** Strip existing OG tags in `injectSeoTags()` before injecting new ones.
**Location:** `server/seo.ts` (injection function), `client/index.html:23-27`

### 5. Dynamic `article:modified_time` Bug
**Severity:** HIGH | **Category:** Technical GEO, Content Freshness
Line 850 of `seo.ts` uses `new Date().toISOString()` which generates a new timestamp on **every request**. This is manipulative freshness signaling — Google may penalize it.

**Fix:** Use actual content modification dates (blog posts already have `dateModified` in Article schema — use those same dates).
**Location:** `server/seo.ts:850`

### 6. CSP Blocks YouTube Embeds
**Severity:** HIGH | **Category:** Technical GEO
`frame-src: 'none'` in the Content Security Policy blocks the site's own YouTube video feature (Vehicle360Viewer, video tabs using `youtube-nocookie.com` iframes).

**Fix:** Update to `frame-src: 'self' https://www.youtube-nocookie.com`
**Location:** `server/index.ts` (CSP middleware)

### 7. Fabricated Review Schema Data
**Severity:** HIGH | **Category:** Content E-E-A-T, Trust
All 4 Review schemas are 5-star ratings with generic-sounding names. AggregateRating claims 4.8/5 with 156 ratings and 89 reviews — these appear self-reported, not sourced from Google Maps or any verifiable platform.

**Fix:** Either link reviews to actual Google Maps reviews, or add a mix of realistic ratings (4-5 stars, not all 5).
**Location:** `server/seo.ts:299-344` (Review schemas)

### 8. Facebook sameAs Points to Personal Profile
**Severity:** HIGH | **Category:** Brand Authority
The sameAs link `facebook.com/hong0961/` is a personal profile, not the business page. The actual business page appears to be at `facebook.com/202382216465201`.

**Fix:** Update to the business page URL, or include both.
**Location:** `server/seo.ts:106`

### 9. Blog Inline Q&As Missing FAQPage Schema
**Severity:** HIGH | **Category:** AI Citability
16 inline Q&A pairs exist within blog post content but have no FAQPage schema. These are high-quality, natural-language answers that AI models could extract — but they're invisible to structured data consumers.

**Fix:** Add FAQPage schema for blog post inline Q&As.
**Location:** `server/seo.ts`, blog post section starting at line 707

### 10. Missing Compression Middleware
**Severity:** HIGH | **Category:** Technical GEO, Core Web Vitals
No `compression` npm package detected in Express server. Railway's reverse proxy *may* handle gzip, but it's not guaranteed or under application control.

**Fix:** Install and configure `compression` middleware.
**Location:** `server/index.ts`

---

## Medium Priority Issues

### 11. WebSite Schema Missing SearchAction
**Severity:** MEDIUM | **Category:** Schema
WebSite schema exists but lacks `potentialAction/SearchAction` — disqualifies from Sitelinks Search Box.

**Fix:** Add SearchAction pointing to inventory filter.
**Location:** `server/seo.ts:430-442`

### 12. Car Schema Seller Uses Inline Object Instead of @id
**Severity:** MEDIUM | **Category:** Schema
Every vehicle page creates a full inline AutoDealer object instead of referencing `/#organization`. Bloats JSON-LD and breaks entity graph.

**Fix:** Replace inline seller with `{ "@type": "AutoDealer", "@id": ".../#organization" }`
**Location:** `server/seo.ts:225-231`

### 13. Person Schema Weak E-E-A-T Signals
**Severity:** MEDIUM | **Category:** Schema, Content E-E-A-T
Author (陳崑家) has only 1 sameAs (Facebook), no photo, URL points to homepage not a dedicated author page.

**Fix:** Add LinkedIn, author photo (`image` property), and create/link a dedicated author page.
**Location:** `server/seo.ts:764-777`

### 14. Organization Logo Uses OG Image
**Severity:** MEDIUM | **Category:** Schema
Logo property uses `og-default.jpg` (1200×630 OG image) instead of actual business logo.

**Fix:** Use actual logo with proper dimensions (min 112×112px).
**Location:** `server/seo.ts` (AutoDealer schema)

### 15. Missing Privacy Policy and Terms of Service
**Severity:** MEDIUM | **Category:** Content E-E-A-T, Trust
No privacy policy or terms pages exist. Required for trustworthiness signals and legal compliance.

**Fix:** Create `/privacy` and `/terms` pages.

### 16. No First-Person Experience in Blog Content
**Severity:** MEDIUM | **Category:** Content E-E-A-T
Blog articles read as generic guides without first-person anecdotes, real customer stories, or "I've seen this happen" narratives from the 40+ years of experience.

**Fix:** Add 2-3 sentences of first-person experience per article referencing real scenarios.
**Location:** `client/src/data/blogPosts.ts`

### 17. 8891 Missing from sameAs
**Severity:** MEDIUM | **Category:** Brand Authority
8891 is Taiwan's largest used car platform. A confirmed listing exists at `8891.com.tw/findBuz-info-1726.html` but is not in the sameAs array.

**Fix:** Add `"https://www.8891.com.tw/findBuz-info-1726.html"` to sameAs.
**Location:** `server/seo.ts:104-110`

### 18. /line and /contact Use Meta Refresh Instead of 301
**Severity:** MEDIUM | **Category:** Technical GEO
Uses HTTP 200 with `meta http-equiv="refresh"` rather than proper 301/302 redirects. Search engines may not follow consistently.

**Fix:** Use HTTP 301 redirects.
**Location:** `server/seo.ts:324`

### 19. No Bing Webmaster Tools Verification
**Severity:** MEDIUM | **Category:** Platform (Bing Copilot)
No `msvalidate.01` meta tag found. Cannot access Bing crawl diagnostics.

**Fix:** Set up Bing Webmaster Tools and add verification meta tag.

### 20. Dead HowTo Schema Code
**Severity:** MEDIUM | **Category:** Schema
`howToSchema()` function and `BLOG_HOWTO` data (~100 lines) are defined but never called. Google deprecated HowTo rich results Sep 2023.

**Fix:** Remove dead code.
**Location:** `server/seo.ts:258-295, 358-417`

---

## Low Priority Issues

### 21. Homepage Meta Description Too Short
87 characters (recommended 150-160).
**Location:** `server/seo.ts` (homepage meta)

### 22. Vehicle IDs Are Numeric, Not Descriptive
`/vehicle/123` instead of `/vehicle/2024-toyota-camry` — misses keyword opportunities.

### 23. No dns-prefetch for External Image CDNs
Vehicle photos load from external URLs without `<link rel="dns-prefetch">`.

### 24. Missing Preload for Critical Resources
No `<link rel="preload">` for hero images or critical CSS.

### 25. Google Fonts Render-Blocking
Two font families (Inter + Noto Sans TC) with 4 weights each loaded as render-blocking CSS. No `font-display: optional` for CJK font.

### 26. No YouTube Channel
Zero YouTube presence limits Google Gemini citation (scored 12/35 on Google Ecosystem).

### 27. Zero Community Mentions (PTT, Reddit, Forums)
Perplexity AI scored 3/30 on community validation. No organic discussions about the dealership.

---

## Category Deep Dives

### AI Citability (68/100)

**Strengths:**
- BLUF answer blocks (`<p class="answer-summary" data-speakable>`) on all 5 blog posts — under 60 words each
- FAQ page with 21+ Q&A items, concise answers under 40 words
- Comparison tables in blog content (7大注意事項, 三大貸款管道)
- Speakable schema covering homepage, FAQ, blog, brand, and price pages
- llms.txt endpoint following Answer.AI proposed standard

**Weaknesses:**
- Blog inline Q&As (16 pairs) have no FAQPage schema
- No `/llms-full.txt` with complete content (current llms.txt is a directory, not full text)
- Content locked behind JavaScript — crawlers without JS see nothing in body
- Statistical claims lack sources (e.g., "2,000+ 位車主" — from where?)

### Brand Authority (52/100)

**Platform Readiness:**
| Platform | Score | Key Gap |
|---|---|---|
| Google AI Overviews | 72/100 | Canonical URL points to non-resolving domain |
| Google Gemini | 55/100 | No YouTube channel, no Google ecosystem presence |
| Bing Copilot | 53/100 | No Bing Webmaster Tools, no LinkedIn company page |
| ChatGPT Web Search | 42/100 | No Wikidata entity — can't recognize brand |
| Perplexity AI | 38/100 | Zero community mentions (PTT, Reddit, forums) |

**sameAs Status:**
- 5 links present: LINE, Facebook (personal!), SUM, TWCar, ABCCar
- Missing critical: Wikidata, YouTube, Google Maps, LinkedIn, 8891

### Content E-E-A-T (72/100)

**Strengths:**
- 5 long-form blog posts (1,100-1,800 words each) in Traditional Chinese
- Named author with credentials (陳崑家, 創辦人/資深二手車鑑定師)
- External citations to government sources (mvdis.gov.tw, jcic.org.tw)
- Topical authority across used car domain (buying, loans, transfers, inspections, Kaohsiung market)
- Trust strip on homepage (2,000+ customers, 4.8 rating, certified, 40 years)

**Weaknesses:**
- No privacy policy or terms of service pages
- Fabricated review data (all 5-star, generic names)
- No first-person experience in blog content
- Author bio section lacks photo and has only 1 sameAs link

### Technical GEO (78/100)

**Strengths:**
- 12 AI crawlers explicitly allowed in robots.txt
- llms.txt endpoint with dynamic vehicle inventory
- IndexNow implementation for Bing instant indexing
- Comprehensive server-side meta/schema injection
- Proper canonical URLs, hreflang, geo tags
- Strong security headers (HSTS, CSP, X-Frame-Options)

**Weaknesses:**
- **No SSR** — body content invisible to non-JS crawlers
- Duplicate OG tags not stripped from base HTML
- `article:modified_time` changes on every request
- CSP blocks own YouTube embed feature
- No compression middleware
- Meta refresh redirects instead of 301s

### Schema & Structured Data (72/100)

**12+ schema types detected (all JSON-LD, server-rendered):**
AutoDealer, WebSite, Car, FAQPage, BreadcrumbList, Review (×4), Article, Person, WebPage+Speakable, ItemList, Service (×5)

**Strengths:**
- Excellent entity graph with @id cross-references
- Speakable schema on multiple page types
- Dynamic per-page schema generation
- All server-rendered (safe for non-JS crawlers)

**Weaknesses:**
- WebSite missing SearchAction
- Car seller uses inline object instead of @id
- sameAs missing Wikipedia, Wikidata, YouTube, Google Maps
- Organization logo uses OG image instead of actual logo
- Dead HowTo code (~100 lines)
- Person schema needs photo, better sameAs, dedicated URL

### Platform Optimization (52/100)

See Brand Authority section above for per-platform breakdown.

---

## Quick Wins (Implement This Week)

1. **Add 8891 to sameAs array** — 1 line change in `seo.ts:110`. Biggest used car platform in Taiwan, confirmed listing exists. (+2-3 points)

2. **Fix `article:modified_time` bug** — Replace `new Date().toISOString()` with actual content dates at `seo.ts:850`. Prevents potential freshness manipulation penalty. (+2 points)

3. **Strip duplicate OG tags** — Add OG tag replacement in `injectSeoTags()` similar to existing title replacement. (+1-2 points)

4. **Fix CSP frame-src** — Change `'none'` to `'self' https://www.youtube-nocookie.com` in server/index.ts. Unblocks own video feature. (+1 point)

5. **Create `/llms-full.txt` endpoint** — Serve all blog/FAQ content as Markdown. Bypasses SPA rendering issue for AI crawlers immediately. (+5-8 points)

---

## 30-Day Action Plan

### Week 1: Critical Infrastructure
- [ ] Deploy custom domain `kuncar.tw` (or update canonicals to Railway URL)
- [ ] Create and submit Wikidata entity using existing script
- [ ] Add Wikidata URL to Organization + Person sameAs
- [ ] Create `/llms-full.txt` endpoint with full blog/FAQ content
- [ ] Fix duplicate OG tags, `article:modified_time` bug, CSP frame-src
- [ ] Add 8891 to sameAs, fix Facebook to business page URL

### Week 2: Content & Trust
- [ ] Add privacy policy and terms of service pages
- [ ] Add first-person experience paragraphs to all 5 blog posts
- [ ] Replace fabricated reviews with real customer testimonials (or remove)
- [ ] Add author photo to Person schema
- [ ] Create dedicated author/about page, update Person URL
- [ ] Add FAQPage schema for blog inline Q&As

### Week 3: Technical & Schema
- [ ] Install compression middleware
- [ ] Add SearchAction to WebSite schema
- [ ] Fix Car seller to use @id cross-reference
- [ ] Fix Organization logo (use actual logo, not OG image)
- [ ] Remove dead HowTo code
- [ ] Convert /line and /contact to 301 redirects
- [ ] Set up Bing Webmaster Tools, add msvalidate.01 tag

### Week 4: Platform Expansion
- [ ] Create YouTube channel with 3-5 vehicle walkthrough videos
- [ ] Create LinkedIn company page for KUN MOTORS
- [ ] Verify/create Google Business Profile, add URL to sameAs
- [ ] Set up Google Maps reviews collection process
- [ ] Begin SSR migration planning (Next.js or lightweight pre-rendering)
- [ ] Post informational content on PTT car forums for organic mentions

---

## Appendix: Key Files Audited

| File | Purpose | Issues Found |
|---|---|---|
| `server/seo.ts` (1133 lines) | All JSON-LD, meta tags, robots.txt, sitemap, llms.txt | 15 issues |
| `server/index.ts` | Express middleware, security headers, rate limiting | 3 issues |
| `client/index.html` | Base HTML template | 2 issues |
| `server/vite.ts` | Meta injection pipeline | 1 issue (no SSR) |
| `client/src/data/blogPosts.ts` | Blog content (5 articles) | 2 issues |
| `client/src/pages/FaqPage.tsx` | FAQ page (21+ Q&As) | 0 issues |
| `client/src/pages/BlogPost.tsx` | Blog rendering, author bio | 1 issue |
| `client/src/pages/Home.tsx` | Homepage, trust strip | 1 issue |
| `client/src/pages/VehicleLanding.tsx` | Vehicle detail pages | 0 issues |
| `client/src/pages/BrandPage.tsx` | Brand landing pages | 0 issues |
| `client/src/pages/PricePage.tsx` | Price range landing pages | 0 issues |
| `client/src/components/SeoFooter.tsx` | Footer with internal links | 0 issues |
| `scripts/create-wikidata-entity.py` | Wikidata entity creator | Not executed |

---

*Generated by 5-agent parallel GEO audit on 2026-03-20. Agents: Schema (geo-schema), Technical (geo-technical), Content E-E-A-T (geo-content), AI Citability/Visibility (geo-ai-visibility), Platform/Brand (geo-platform-analysis).*
