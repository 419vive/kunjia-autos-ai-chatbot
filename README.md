# 崑家汽車 AI Chatbot & Admin Dashboard

**Production-grade LINE chatbot + admin dashboard for a Kaohsiung used car dealership**

A full-stack TypeScript application that powers an AI-driven LINE chatbot for customer engagement, automatic vehicle inventory sync from 8891.tw, a comprehensive admin dashboard with analytics, and SEO/AEO-optimized public pages — all in one monorepo.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Flow](#system-flow)
- [LINE Chatbot Flow](#line-chatbot-flow)
- [Admin Dashboard Flow](#admin-dashboard-flow)
- [Vehicle Sync Pipeline](#vehicle-sync-pipeline)
- [SEO & AEO Engine](#seo--aeo-engine)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                      │
│                                                                     │
│   ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐    │
│   │  LINE     │    │  Web Browser │    │  Search Engines /     │    │
│   │  Users    │    │  (Admin +    │    │  AI Crawlers          │    │
│   │          │    │   Public)    │    │  (Google, GPTBot,     │    │
│   │  📱       │    │  💻          │    │   ClaudeBot, etc.)    │    │
│   └────┬─────┘    └──────┬───────┘    └──────────┬────────────┘    │
│        │                 │                       │                  │
└────────┼─────────────────┼───────────────────────┼──────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS SERVER (Node.js)                         │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │  LINE        │  │  tRPC API    │  │  SEO Engine            │    │
│  │  Webhook     │  │  Router      │  │  (meta injection,      │    │
│  │  Handler     │  │  (50+ procs) │  │   JSON-LD, sitemap,    │    │
│  │              │  │              │  │   robots.txt, llms.txt) │    │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘    │
│         │                 │                                         │
│  ┌──────┴─────────────────┴──────────────────────────────────┐     │
│  │                   CORE SERVICES                            │     │
│  │                                                            │     │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │     │
│  │  │ Gemini LLM  │  │ Vehicle      │  │ Security Layer  │  │     │
│  │  │ (2.5 Flash) │  │ Detection    │  │ (Helmet, Rate   │  │     │
│  │  │ + Dynamic   │  │ Service      │  │  Limit, PII     │  │     │
│  │  │   Prompts   │  │ (NLP)        │  │  Masking)       │  │     │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │     │
│  │                                                            │     │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │     │
│  │  │ 8891 Sync   │  │ Rich Menu    │  │ Notification    │  │     │
│  │  │ (every 6h)  │  │ Manager      │  │ Service         │  │     │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │     │
│  └────────────────────────────┬───────────────────────────────┘     │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  MySQL Database       │
                    │  (Drizzle ORM)        │
                    │                       │
                    │  9 tables:            │
                    │  users, vehicles,     │
                    │  conversations,       │
                    │  messages, leadEvents,│
                    │  analyticsEvents,     │
                    │  pageViews, loans,    │
                    │  appointments         │
                    └───────────────────────┘
```

---

## System Flow

This is the complete request lifecycle from any client to the server and back:

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST LIFECYCLE                              │
└─────────────────────────────────────────────────────────────────┘

  HTTP Request
       │
       ▼
  ┌─────────────┐     ┌──────────────────────────────────────┐
  │  Helmet      │────▶│  Security Headers (CSP, HSTS, etc.) │
  │  Middleware  │     └──────────────────────────────────────┘
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     ┌──────────────────────────────────────┐
  │  Rate        │────▶│  100/min general, 15/min chat,      │
  │  Limiter     │     │  50/min LINE webhook                 │
  └──────┬──────┘     └──────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │          ROUTE MATCHING                  │
  │                                          │
  │  /api/line/webhook  ──▶  LINE Handler   │
  │  /api/trpc/*        ──▶  tRPC Router    │
  │  /line, /contact    ──▶  Smart Redirect │
  │  /robots.txt        ──▶  SEO Engine     │
  │  /sitemap.xml       ──▶  SEO Engine     │
  │  /llms.txt          ──▶  SEO Engine     │
  │  /*                 ──▶  Vite SPA       │
  │                          + SEO Inject   │
  └─────────────────────────────────────────┘
```

---

## LINE Chatbot Flow

The chatbot handles customer inquiries through LINE with AI-powered responses:

```
┌─────────────────────────────────────────────────────────────────┐
│                  LINE MESSAGE FLOW                                │
└─────────────────────────────────────────────────────────────────┘

  Customer sends message on LINE
       │
       ▼
  ┌─────────────────┐
  │ Signature        │──── Invalid ──▶ 403 Reject
  │ Verification     │
  │ (HMAC-SHA256)    │
  └───────┬─────────┘
          │ Valid
          ▼
  ┌─────────────────┐
  │ Event Type?      │
  └───────┬─────────┘
          │
          ├── FOLLOW ──────────────────────────────────────┐
          │                                                 │
          │   ┌─────────────────────────────────────────┐  │
          │   │  Welcome Sequence:                       │  │
          │   │  1. Greeting text                        │  │
          │   │  2. Rich menu guide image                │  │
          │   │  3. Branding hero card                   │  │
          │   │  4. Quick reply buttons                  │  │
          │   └─────────────────────────────────────────┘  │
          │                                                 │
          ├── MESSAGE (text) ──────────────────────────────┐
          │                                                 │
          │   ┌─────────────────────────────────────────┐  │
          │   │  1. Detect phone number (TW patterns)   │  │
          │   │  2. Detect gender from name             │  │
          │   │  3. Detect vehicle brand/model (NLP)    │  │
          │   │  4. Classify question type              │  │
          │   │  5. Check intent (budget, appointment)  │  │
          │   └──────────────────┬──────────────────────┘  │
          │                      │                          │
          │                      ▼                          │
          │   ┌──────────────────────────────────────┐     │
          │   │  FORCE_RULE_BASED_REPLY?             │     │
          │   │                                      │     │
          │   │  YES ──▶ Pattern match ──▶ Response  │     │
          │   │                                      │     │
          │   │  NO ──▶ Build dynamic prompt         │     │
          │   │     │   (vehicle KB + intent +       │     │
          │   │     │    conversation history)        │     │
          │   │     │                                 │     │
          │   │     ▼                                 │     │
          │   │   Gemini 2.5 Flash                   │     │
          │   │     │                                 │     │
          │   │     ▼                                 │     │
          │   │   Flex message response              │     │
          │   └──────────────────────────────────────┘     │
          │                                                 │
          ├── MESSAGE (image) ─────────────────────────────┐
          │                                                 │
          │   ┌─────────────────────────────────────────┐  │
          │   │  Gemini Vision: identify vehicle from   │  │
          │   │  photo, match to inventory              │  │
          │   └─────────────────────────────────────────┘  │
          │                                                 │
          └── POSTBACK (rich menu click) ──────────────────┐
                                                            │
              ┌─────────────────────────────────────────┐  │
              │  Route to action:                        │  │
              │  - Browse inventory → vehicle carousel   │  │
              │  - Check rates → loan calculator         │  │
              │  - Book visit → appointment form         │  │
              │  - Contact → phone/LINE redirect         │  │
              │  - Navigate → Google Maps link           │  │
              └─────────────────────────────────────────┘  │

  ┌─────────────────────────────────────────────────────────┐
  │  PARALLEL: Owner notification                           │
  │  Hot leads, phone numbers, appointments ──▶ LINE push   │
  └─────────────────────────────────────────────────────────┘
```

### Rich Menu Layout

```
  ┌─────────────────────────────────────────────┐
  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ │
  │  │  🚗       │ │  📋       │ │  📞       │ │
  │  │ 看車庫存  │ │ 預約賞車  │ │ 聯絡我們  │ │
  │  │ Browse    │ │ Book      │ │ Contact   │ │
  │  │ Inventory │ │ Visit     │ │ Us        │ │
  │  ├───────────┤ ├───────────┤ ├───────────┤ │
  │  │  🔥       │ │  💰       │ │  📍       │ │
  │  │ 熱門推薦  │ │ 50萬以下  │ │ 導航到店  │ │
  │  │ Popular   │ │ Under     │ │ Navigate  │ │
  │  │ Picks     │ │ 500K      │ │ to Store  │ │
  │  └───────────┘ └───────────┘ └───────────┘ │
  └─────────────────────────────────────────────┘
```

---

## Admin Dashboard Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  ADMIN DASHBOARD PAGES                            │
└─────────────────────────────────────────────────────────────────┘

  Admin Login (username + password)
       │
       ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  DASHBOARD (/)                                               │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  KPI Cards: Total Conversations │ Qualified Leads │  │    │
  │  │             Hot Leads │ Conversion Rate             │    │
  │  ├─────────────────────────────────────────────────────┤    │
  │  │  Hot Lead Alerts (browser notifications)            │    │
  │  │  Recent Activity Feed                               │    │
  │  └─────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────┘
       │
       ├──▶ /conversations ─────────────────────────────────────┐
       │    ┌───────────────────────────────────────────────┐   │
       │    │ Customer conversations with:                  │   │
       │    │ - Channel filter (LINE / Web)                 │   │
       │    │ - Lead status filter (new/qualified/hot/won)  │   │
       │    │ - Full message history view                   │   │
       │    │ - Lead score tracking + notes                 │   │
       │    └───────────────────────────────────────────────┘   │
       │                                                         │
       ├──▶ /analytics ─────────────────────────────────────────┐
       │    ┌───────────────────────────────────────────────┐   │
       │    │ 30+ charts:                                   │   │
       │    │ - Daily conversation & message volume         │   │
       │    │ - Lead funnel (new → qualified → hot → won)   │   │
       │    │ - Popular vehicles ranking                    │   │
       │    │ - LINE behavioral tracking                    │   │
       │    │ - Web analytics (referrer, browser, device)   │   │
       │    │ - Page views & session duration               │   │
       │    └───────────────────────────────────────────────┘   │
       │                                                         │
       ├──▶ /loan-inquiries ────────────────────────────────────┐
       │    ┌───────────────────────────────────────────────┐   │
       │    │ Finance applications:                         │   │
       │    │ - Customer info, vehicle, employment          │   │
       │    │ - Status: new → contacted → approved/rejected │   │
       │    │ - Approve / Reject actions                    │   │
       │    └───────────────────────────────────────────────┘   │
       │                                                         │
       ├──▶ /appointments ──────────────────────────────────────┐
       │    ┌───────────────────────────────────────────────┐   │
       │    │ Visit bookings:                               │   │
       │    │ - Preferred date & time slots                 │   │
       │    │ - Vehicle of interest                         │   │
       │    │ - Confirm / Cancel actions                    │   │
       │    └───────────────────────────────────────────────┘   │
       │                                                         │
       ├──▶ /vehicles ──────────────────────────────────────────┐
       │    ┌───────────────────────────────────────────────┐   │
       │    │ Inventory management:                         │   │
       │    │ - Status toggle: available / sold / reserved  │   │
       │    │ - Auto-synced from 8891.tw                    │   │
       │    └───────────────────────────────────────────────┘   │
       │                                                         │
       └──▶ /line-setup ────────────────────────────────────────┐
            ┌───────────────────────────────────────────────┐   │
            │ LINE configuration:                           │   │
            │ - Webhook URL display                         │   │
            │ - Rich menu deployment                        │   │
            │ - Test message sender                         │   │
            └───────────────────────────────────────────────┘   │
```

---

## Vehicle Sync Pipeline

Vehicles are automatically scraped from 8891.tw and kept in sync:

```
┌─────────────────────────────────────────────────────────────────┐
│                  8891.TW SYNC PIPELINE                           │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────┐
  │  App Startup  │         │  Cron: every │
  │              │         │  6 hours     │
  └──────┬───────┘         └──────┬───────┘
         │                        │
         └────────┬───────────────┘
                  │
                  ▼
  ┌───────────────────────────────────┐
  │  Fetch 8891.tw API               │
  │  (Shop ID: 1726 = 崑家汽車)      │
  │  GET all vehicle listings         │
  └──────────────┬────────────────────┘
                 │
                 ▼
  ┌───────────────────────────────────┐
  │  Chain of Verification (CoV)      │
  │  - Validate data integrity        │
  │  - Check required fields          │
  │  - Normalize brand names          │
  └──────────────┬────────────────────┘
                 │
                 ▼
  ┌───────────────────────────────────┐
  │  For each vehicle:                │
  │                                   │
  │  ┌─────────────────────────────┐  │
  │  │ Exists in DB?               │  │
  │  │                             │  │
  │  │ YES ──▶ Update 50+ fields  │  │
  │  │         (price, photos,     │  │
  │  │          mileage, status)   │  │
  │  │                             │  │
  │  │ NO  ──▶ Insert new vehicle │  │
  │  └─────────────────────────────┘  │
  └──────────────┬────────────────────┘
                 │
                 ▼
  ┌───────────────────────────────────┐
  │  Detect sold vehicles             │
  │  (in DB but not in 8891 response) │
  │  ──▶ Mark status = "sold"         │
  └──────────────┬────────────────────┘
                 │
                 ▼
  ┌───────────────────────────────────┐
  │  Refresh 2-minute vehicle cache   │
  └───────────────────────────────────┘
```

---

## SEO & AEO Engine

The server injects SEO metadata into every page before sending to the client:

```
┌─────────────────────────────────────────────────────────────────┐
│                  SEO / AEO ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────┘

  Browser/Crawler requests page
       │
       ▼
  ┌───────────────────────────────────────────────────────┐
  │  SERVER-SIDE META INJECTION                            │
  │                                                        │
  │  index.html template                                   │
  │       │                                                │
  │       ├── <title> ──▶ Geographic keywords              │
  │       │               "高雄二手車推薦｜崑家汽車"        │
  │       │                                                │
  │       ├── <meta description> ──▶ Long-tail + CTA       │
  │       │                                                │
  │       ├── <meta og:*> ──▶ Open Graph + Twitter Cards   │
  │       │                                                │
  │       ├── <link canonical> ──▶ Per-page canonical URL   │
  │       │                                                │
  │       └── <script type="application/ld+json">          │
  │               │                                        │
  │               ├── AutoDealer (site-wide)               │
  │               │   GeoCoordinates, AggregateRating,     │
  │               │   areaServed, openingHours              │
  │               │                                        │
  │               ├── Car (per vehicle)                     │
  │               │   brand, model, price, mileage,        │
  │               │   photos[], 第三方認證 badge            │
  │               │                                        │
  │               ├── Article (blog posts)                  │
  │               │   Person author (E-E-A-T),             │
  │               │   dateModified, mainEntityOfPage        │
  │               │                                        │
  │               ├── HowTo (procedural guides)            │
  │               │   step-by-step, estimatedCost           │
  │               │                                        │
  │               ├── FAQPage (21 Q&A items)               │
  │               │   concise answers (<40 words)           │
  │               │                                        │
  │               ├── Review (4 testimonials)               │
  │               │   star ratings, customer names          │
  │               │                                        │
  │               ├── Service (5 services)                  │
  │               │   sales, financing, transfer, etc.      │
  │               │                                        │
  │               ├── Speakable (voice search)              │
  │               │   blog + FAQ content                    │
  │               │                                        │
  │               └── WebSite + Organization entity graph   │
  │                   @id cross-references                  │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  AI CRAWLER ENDPOINTS                                  │
  │                                                        │
  │  /robots.txt ──▶ Allow: GPTBot, ClaudeBot,            │
  │                  PerplexityBot, GoogleOther,            │
  │                  Meta-ExternalAgent, Bingbot            │
  │                  Disallow: /admin, /api                 │
  │                                                        │
  │  /sitemap.xml ──▶ Dynamic: vehicles (with images),     │
  │                   blog posts, brand pages,              │
  │                   price range pages, FAQ                │
  │                                                        │
  │  /llms.txt ──▶ AI-readable site map (Answer.AI spec)   │
  │                Markdown: inventory, blog, FAQ, prices   │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  AEO (Answer Engine Optimization)                      │
  │                                                        │
  │  - BLUF blocks: direct answer in first 60 words        │
  │  - Comparison tables (LLMs parse tables best)          │
  │  - Entity graph with @id cross-references              │
  │  - Person schema with E-E-A-T credentials              │
  │  - Author bio sections on blog posts                   │
  │  - Freshness signals (dateModified updated)            │
  │  - data-speakable attributes for voice search          │
  └───────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js + TypeScript 5.9 |
| **Frontend** | React 19 + Vite 7 + Tailwind CSS 4 |
| **UI Components** | Radix UI + shadcn/ui (40+ components) |
| **Routing** | Wouter (SPA) |
| **State / Data** | TanStack React Query + tRPC |
| **Charts** | Recharts |
| **Forms** | React Hook Form + Zod 4 |
| **Animations** | Framer Motion |
| **Backend** | Express 4 + tRPC 11 |
| **Database** | MySQL + Drizzle ORM |
| **AI / LLM** | Google Gemini 2.5 Flash |
| **Messaging** | LINE Messaging API |
| **Scraping** | Axios + Cheerio (8891.tw) |
| **Auth** | JWT (jose) + secure cookies |
| **Security** | Helmet, rate limiting, PII masking, XSS filters |
| **Testing** | Vitest |
| **Deployment** | Railway |

---

## Project Structure

```
kun-auto-chatbot/
│
├── client/                         # Frontend (React SPA)
│   ├── public/                     # Static assets
│   │   └── rich-menu-guide.png     # LINE rich menu guide image
│   └── src/
│       ├── App.tsx                 # Router (18 routes, lazy-loaded)
│       ├── pages/
│       │   ├── Home.tsx            # Vehicle grid + featured cars
│       │   ├── Chat.tsx            # AI chatbot UI
│       │   ├── VehicleLanding.tsx  # Vehicle detail page
│       │   ├── LoanInquiry.tsx     # Loan calculator form
│       │   ├── BookVisit.tsx       # Appointment booking form
│       │   ├── BrandPage.tsx       # Brand-filtered listings
│       │   ├── PricePage.tsx       # Price-range listings
│       │   ├── BlogIndex.tsx       # Blog article listing
│       │   ├── BlogPost.tsx        # Individual articles
│       │   ├── FaqPage.tsx         # 21 Q&A across 5 categories
│       │   ├── Dashboard.tsx       # Admin: KPIs + alerts
│       │   ├── Conversations.tsx   # Admin: customer chats
│       │   ├── Analytics.tsx       # Admin: 30+ charts
│       │   ├── LoanInquiries.tsx   # Admin: loan tracking
│       │   ├── Appointments.tsx    # Admin: visit scheduling
│       │   ├── VehicleManagement.tsx # Admin: inventory
│       │   ├── LineSetup.tsx       # Admin: LINE configuration
│       │   └── AdminLogin.tsx      # Authentication
│       ├── components/
│       │   ├── DashboardLayout.tsx  # Admin sidebar + header
│       │   ├── AIChatBox.tsx        # Chat widget
│       │   ├── VehicleCard.tsx      # Photo carousel card
│       │   ├── VehicleCompare.tsx   # Side-by-side comparison
│       │   ├── SeoFooter.tsx        # 4-column internal link footer
│       │   └── ui/                  # 40+ shadcn components
│       ├── lib/
│       │   ├── trpc.ts             # tRPC client config
│       │   ├── tracker.ts          # Page view analytics
│       │   └── blogPosts.ts        # 5 SEO blog articles (Chinese)
│       └── contexts/
│           └── ThemeContext.tsx     # Dark mode
│
├── server/                          # Backend (Express + tRPC)
│   ├── _core/
│   │   ├── index.ts                # Express server + 4 security layers
│   │   ├── env.ts                  # Environment validation
│   │   ├── llm.ts                  # Gemini API wrapper
│   │   ├── adminAuth.ts            # Password auth + session management
│   │   ├── trpc.ts                 # tRPC middleware (public/protected/admin)
│   │   ├── notification.ts         # Owner LINE push notifications
│   │   ├── vite.ts                 # Vite dev/prod serving + SEO injection
│   │   └── ...                     # cookies, sdk, dataApi, map, etc.
│   ├── routers.ts                  # All tRPC endpoints (1278 lines)
│   ├── db.ts                       # Database layer + vehicle cache
│   ├── lineWebhook.ts              # LINE event handler
│   ├── lineFlexTemplates.ts        # Flex message builders
│   ├── lineRichMenu.ts             # Rich menu deployment
│   ├── sync8891.ts                 # Vehicle scraping + 6h scheduler
│   ├── seo.ts                      # SEO engine (meta, JSON-LD, sitemap)
│   ├── vehicleDetectionService.ts  # NLP: brand detection, intent classification
│   ├── ruleBasedReply.ts           # Cost-saving LLM fallback
│   ├── dynamicPromptBuilder.ts     # LLM prompt construction
│   ├── timeSlotHelper.ts           # Appointment scheduling
│   ├── trackingApi.ts              # Web analytics
│   ├── security.ts                 # Rate limiting + PII masking
│   └── *.test.ts                   # 12 test files
│
├── shared/                          # Shared types & constants
│   ├── types.ts                    # TypeScript interfaces
│   └── const.ts                    # Shared constants
│
├── drizzle.config.ts               # ORM configuration
├── vite.config.ts                  # Build configuration
├── package.json                    # Dependencies & scripts
└── tsconfig.json                   # TypeScript config
```

---

## Database Schema

```
┌──────────────────┐       ┌──────────────────┐
│     users         │       │    vehicles       │
├──────────────────┤       ├──────────────────┤
│ id               │       │ id               │
│ openId           │       │ externalId (8891)│
│ name             │       │ brand            │
│ email            │       │ model            │
│ role (user/admin)│       │ year             │
│ createdAt        │       │ price            │
└──────────────────┘       │ mileage          │
                            │ fuelType         │
┌──────────────────┐       │ transmission     │
│  conversations   │       │ bodyType         │
├──────────────────┤       │ color            │
│ id               │       │ photos[]         │
│ sessionId        │       │ status           │
│ lineUserId       │       │ (available/sold/ │
│ channel          │       │  reserved)       │
│ leadScore        │       │ ... 50+ fields   │
│ leadStatus       │       └──────────────────┘
│ customerName     │
│ customerPhone    │       ┌──────────────────┐
│ customerGender   │       │   leadEvents     │
│ createdAt        │       ├──────────────────┤
└────────┬─────────┘       │ id               │
         │                  │ conversationId   │
         │  1:N             │ eventType        │
         ▼                  │ scoreChange      │
┌──────────────────┐       │ reason           │
│    messages      │       └──────────────────┘
├──────────────────┤
│ id               │       ┌──────────────────┐
│ conversationId   │       │ analyticsEvents  │
│ role (user/bot)  │       ├──────────────────┤
│ content          │       │ id               │
│ createdAt        │       │ eventType        │
└──────────────────┘       │ lineUserId       │
                            │ metadata         │
┌──────────────────┐       │ createdAt        │
│  loanInquiries   │       └──────────────────┘
├──────────────────┤
│ id               │       ┌──────────────────┐
│ vehicleId        │       │   pageViews      │
│ customerName     │       ├──────────────────┤
│ phone            │       │ id               │
│ employment       │       │ path             │
│ insurance        │       │ referrer         │
│ status           │       │ browser          │
│ (new/contacted/  │       │ os               │
│  approved/       │       │ device           │
│  rejected)       │       │ country          │
└──────────────────┘       │ duration         │
                            └──────────────────┘
┌──────────────────┐
│  appointments    │
├──────────────────┤
│ id               │
│ vehicleId        │
│ customerName     │
│ phone            │
│ preferredDate    │
│ preferredTime    │
│ status           │
│ (pending/        │
│  confirmed/      │
│  cancelled)      │
└──────────────────┘
```

---

## API Endpoints

### tRPC Procedures

| Category | Procedure | Type | Description |
|----------|-----------|------|-------------|
| **Auth** | `auth.me` | Query | Get current user session |
| | `auth.logout` | Mutation | Clear session cookie |
| **Vehicles** | `vehicles.list` | Query | All vehicles (paginated, cached 2min) |
| | `vehicles.search` | Query | Filter by brand, price, year, fuel, body |
| | `vehicles.byId` | Query | Single vehicle with full details |
| | `vehicles.brands` | Query | Available brand list |
| **Chat** | `chat.send` | Mutation | Send message to AI chatbot |
| **Conversations** | `conversations.list` | Query | Customer conversations (filterable) |
| | `conversations.get` | Query | Full conversation + messages |
| | `conversations.update` | Mutation | Edit status, notes, lead score |
| **Analytics** | `analytics.*` | Query | 20+ analytics queries |
| **Reports** | `reports.*` | Query | Daily stats, lead funnel, popular vehicles |
| **Loans** | `loan.create` | Mutation | Submit loan application |
| | `loan.updateStatus` | Mutation | Approve/reject application |
| **Appointments** | `appointment.create` | Mutation | Book a visit |
| | `appointment.updateStatus` | Mutation | Confirm/cancel booking |
| **Admin** | `admin.triggerSync` | Mutation | Force 8891 re-sync |
| | `admin.deployRichMenu` | Mutation | Push rich menu to LINE |

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/line/webhook` | LINE event handler |
| GET | `/robots.txt` | SEO: crawler rules |
| GET | `/sitemap.xml` | SEO: dynamic sitemap |
| GET | `/llms.txt` | AEO: AI-readable site map |
| GET | `/line` | Smart redirect to LINE |
| GET | `/contact` | Smart redirect to contact |

---

## Authentication

```
┌───────────────────────────────────────────────────────┐
│                ADMIN AUTH FLOW                          │
└───────────────────────────────────────────────────────┘

  Admin visits /admin/login
       │
       ▼
  ┌─────────────────────┐
  │  Enter username +    │
  │  password            │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐     ┌───────────────────────┐
  │  POST /api/auth/    │────▶│  Timing-safe compare  │
  │  login              │     │  vs ADMIN_PASSWORD env │
  └──────────┬──────────┘     └───────────────────────┘
             │
             ├── FAIL ──▶ 401 Unauthorized
             │
             └── SUCCESS
                  │
                  ▼
  ┌─────────────────────┐
  │  Create JWT session  │
  │  Set HttpOnly cookie │
  │  (app_session_id,    │
  │   Secure, SameSite,  │
  │   1-year expiry)     │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  Redirect to         │
  │  /admin/dashboard    │
  └─────────────────────┘

  ┌───────────────────────────────────────────────┐
  │  ROUTE PROTECTION (tRPC middleware):           │
  │                                                │
  │  publicProcedure  ──▶ No auth required         │
  │  protectedProcedure ──▶ Valid session required  │
  │  adminProcedure ──▶ role === 'admin' required   │
  └───────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL 8+
- LINE Messaging API channel
- Google AI API key (Gemini)

### Installation

```bash
# Clone the repository
git clone https://github.com/419vive/kunjia-autos-ai-chatbot.git
cd kun-auto-chatbot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials (see below)

# Start development server (auto-migrates database)
npm run dev
```

### Build & Run

```bash
# Build for production
npm run build

# Start production server
npm start
```

The server auto-creates all 9 database tables on first startup and seeds the admin user.

---

## Environment Variables

```env
# ── Database ──────────────────────────────────
DATABASE_URL=mysql://user:password@host:3306/kun_auto_chatbot

# ── AI / LLM ─────────────────────────────────
GOOGLE_AI_API_KEY=AIzaSy...              # Gemini 2.5 Flash

# ── LINE Messaging API ───────────────────────
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_access_token

# ── Admin Authentication ─────────────────────
JWT_SECRET=your-random-secret-string
ADMIN_PASSWORD=your-secure-admin-password
ADMIN_USERNAME=admin                      # (optional, defaults to "admin")

# ── Notifications (optional) ─────────────────
LINE_OWNER_USER_ID=U...                  # Owner's LINE user ID
LINE_ADDITIONAL_NOTIFY_USER_IDS=U...,U.. # Extra notification recipients

# ── Cost Saving (optional) ───────────────────
FORCE_RULE_BASED_REPLY=1                 # Skip LLM, use pattern matching

# ── Deployment (optional) ────────────────────
NODE_ENV=production
PORT=3000
BASE_URL=https://kuncar.tw
```

---

## Deployment

The project is designed for **Railway** deployment:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  GitHub Repo │────▶│   Railway    │────▶│  Production  │
│  (push)      │     │  Build       │     │  Server      │
│              │     │  (npm build) │     │  (npm start) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                          ┌───────────────────────┤
                          │                       │
                          ▼                       ▼
                  ┌──────────────┐     ┌──────────────────┐
                  │  MySQL DB    │     │  LINE Webhook     │
                  │  (Railway    │     │  https://your-    │
                  │   or PlanetScale)│ │  app.railway.app  │
                  └──────────────┘     │  /api/line/webhook│
                                       └──────────────────┘
```

1. Connect your GitHub repo to Railway
2. Set all environment variables in Railway dashboard
3. Railway auto-detects Node.js, runs `npm run build` then `npm start`
4. Set your LINE webhook URL to `https://your-app.railway.app/api/line/webhook`
5. Database tables auto-migrate on first boot

---

## License

Private - All rights reserved.

---

<p align="center">
  <strong>崑家汽車</strong> — 高雄在地40年正派經營中古車行
  <br>
  Built with TypeScript, React, Gemini AI, and LINE Messaging API
</p>
