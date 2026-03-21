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
- [Agent Reach — AI Agent Internet Access](#agent-reach--ai-agent-internet-access)
- [Security Audit — Agent Reach](#security-audit--agent-reach)
- [Conversion & UX Optimization](#conversion--ux-optimization)
  - [Website UX](#website-ux)
  - [LINE Chatbot Intelligence](#line-chatbot-intelligence)
  - [Video & 360° Gallery](#video--360-gallery)
- [Security Hardening](#security-hardening)
- [GEO Audit & Fixes](#geo-audit--fixes)
- [Recall-Stack Memory System](#recall-stack-memory-system)
- [AI Agent Development Strategy](#ai-agent-development-strategy)
  - [The `/simplify` Plan Gate](#the-simplify-plan-gate--catching-over-engineering-before-it-ships)

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
  │  POST /api/auth/    │────▶│  Bcrypt compare (12   │
  │  login (5/15min)    │     │  rounds) + rate limit │
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
  │   24h admin expiry)  │
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

## Agent Reach — AI Agent Internet Access

[Agent Reach](https://github.com/Panniantong/Agent-Reach) is integrated as a CLI tool that gives the AI agent internet access across 15+ platforms — enabling research, content monitoring, and competitive intelligence without API fees.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                  AGENT REACH INTEGRATION                             │
└─────────────────────────────────────────────────────────────────────┘

  AI Agent (Claude Code)
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  agent-reach CLI (Python)                                       │
  │  - install / doctor / configure / watch                         │
  │  - Health monitoring for all channels                           │
  │  - Credential management (~/.agent-reach/config.yaml, 0o600)    │
  └──────────────────────┬──────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │  Tier 0      │ │  Tier 1      │ │  Tier 2      │
  │  Zero Config │ │  Free Key    │ │  Setup Req'd │
  │              │ │              │ │              │
  │  • Web/Jina  │ │  • Twitter/X │ │  • 小紅書    │
  │  • RSS       │ │  • Reddit    │ │  • 抖音      │
  │  • YouTube   │ │  • Bilibili  │ │  • LinkedIn  │
  │  • GitHub    │ │  • 微博      │ │  • 微信公眾號│
  │  • V2EX      │ │  • Exa Search│ │  • 小宇宙    │
  └──────────────┘ └──────────────┘ └──────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
              Upstream Tools (direct calls)
              xreach · yt-dlp · mcporter · gh · curl
```

### Active Channels (Current Status)

| Channel | Tool | Status |
|---------|------|--------|
| Web (any URL) | Jina Reader | ✅ Active |
| RSS/Atom | feedparser | ✅ Active |
| YouTube | yt-dlp | ✅ Active |
| Twitter/X | xreach CLI | ✅ Active |
| Bilibili | yt-dlp | ✅ Active |
| Exa Search | mcporter | ✅ Active |
| GitHub | gh CLI | Needs install |
| Reddit | curl + proxy | Needs proxy |
| 微博 | mcp-server-weibo | Needs setup |
| 小紅書 | xiaohongshu-mcp | Needs Docker |
| 抖音 | douyin-mcp-server | Needs Docker |
| LinkedIn | linkedin-scraper-mcp | Needs setup |
| 微信公眾號 | camoufox | Needs setup |
| 小宇宙播客 | Groq Whisper | Needs ffmpeg + key |
| V2EX | V2EX API | Blocked (proxy) |

### Quick Reference

```bash
# Health check
agent-reach doctor

# Configure Twitter
agent-reach configure twitter-cookies "auth_token=xxx; ct0=yyy"

# Configure proxy (Reddit/Bilibili on servers)
agent-reach configure proxy http://user:pass@ip:port

# Check for updates
agent-reach check-update
```

---

## Security Audit — Agent Reach

**Audit date:** 2026-03-17
**Auditor:** AI Security Review (Claude Opus 4.6)
**Verdict:** ✅ SAFE WITH CAVEATS

A comprehensive code review was performed on all 30+ source files in the Agent Reach repository. The tool is open-source (MIT), has no obfuscated code, no hidden network calls, and no data exfiltration vectors.

### Security Positives

| Area | Finding |
|------|---------|
| **Credential Storage** | Config saved to `~/.agent-reach/config.yaml` with `0o600` permissions (owner-only read/write). Atomic file creation via `os.open()` avoids race conditions |
| **Sensitive Value Masking** | `Config.to_dict()` masks keys, tokens, passwords, and proxy URLs in output |
| **No Data Exfiltration** | No outbound network calls from agent-reach itself. All network traffic goes through upstream tools (yt-dlp, xreach, curl) that the user controls |
| **No Obfuscation** | 100% readable Python. No base64-encoded payloads, no `exec()`, no `eval()`, no dynamic code loading |
| **Safe YAML** | Uses `yaml.safe_load()` (not `yaml.load()`) — immune to YAML deserialization attacks |
| **Subprocess Safety** | All `subprocess.run()` calls use list arguments (not shell=True), preventing command injection |
| **Permission Checks** | Doctor reports if config.yaml has overly permissive file permissions |
| **Install Boundaries** | Install docs explicitly forbid `sudo`, system file modification, and workspace pollution |
| **Safe Mode** | `--safe` flag and `--dry-run` available for cautious installations |
| **MCP Server** | Read-only — only exposes `get_status` tool (doctor report), no write operations |

### Caveats & Recommendations

| # | Severity | Finding | Recommendation |
|---|----------|---------|----------------|
| 1 | **HIGH** | Default install (`--env=auto` without `--safe`) silently extracts browser cookies for Twitter, XiaoHongShu, Bilibili without per-platform consent | **Always use `--safe` or `--dry-run` first.** We installed with `--safe` mode |
| 2 | **HIGH** | Node.js auto-installer downloads and executes remote shell script from `deb.nodesource.com` — supply chain risk | Install Node.js through your package manager instead. Safe mode skips this |
| 3 | **HIGH** | Uses `--break-system-packages` pip flag, bypassing PEP 668 protections on managed Python envs | Only triggered for WeChat deps. Safe mode skips it. Use venv for isolation |
| 4 | **MEDIUM** | Cookie extraction (`cookie_extract.py`) reads browser cookies for Twitter, XiaoHongShu, Bilibili | Use `--from-browser` only on your own machine. Use dedicated/secondary accounts |
| 5 | **MEDIUM** | Cookies stored in plaintext YAML (`~/.agent-reach/config.yaml`) | File is 0o600 by default. Do not relax permissions. Consider encrypted credential store for production |
| 6 | **MEDIUM** | V2EX channel does not URL-encode `node_name`/`username` params — query string manipulation possible | Use `urllib.parse.quote()` for user input in URLs |
| 7 | **LOW** | `sync-upstream.sh` clones from GitHub over HTTPS | Script is developer-only (not run during install). Verify upstream changes before merging |
| 8 | **LOW** | Third-party Docker images for 小紅書/抖音 (`xpzouying/xiaohongshu-mcp`, `yzfly/douyin-mcp-server`) | Audit Docker images before running. Pin to specific versions |
| 9 | **LOW** | Proxy credentials passed via CLI argument — visible in shell history and `/proc` | Use env vars or edit config file directly |
| 10 | **LOW** | `Config.to_dict()` reveals first 8 chars of masked secrets | Short tokens could be partially reconstructed |
| 11 | **INFO** | No dependency pinning (uses `>=` ranges in pyproject.toml) | For production, pin exact versions with lock file |

### Files Reviewed

```
agent_reach/cli.py          — CLI entry point, argument parsing, install logic
agent_reach/core.py         — AgentReach class (thin wrapper)
agent_reach/config.py       — YAML config with 0o600 permissions
agent_reach/cookie_extract.py — Browser cookie extraction (optional)
agent_reach/doctor.py       — Health check with permission audit
agent_reach/channels/*.py   — 15 channel implementations (all read-only checks)
agent_reach/integrations/mcp_server.py — MCP server (read-only)
scripts/sync-upstream.sh    — Developer sync script
pyproject.toml              — Dependencies (all mainstream packages)
docs/install.md             — Install guide with security boundaries
```

### Summary

Agent Reach is a well-structured, transparent tool. It does not phone home, does not collect telemetry, and does not transmit credentials anywhere. All internet access happens through well-known upstream tools (yt-dlp, xreach, curl, mcporter) that the user can independently audit. **Critical: always use `--safe` mode** to prevent silent cookie extraction and remote script execution. We installed with safe mode enabled. Keep `~/.agent-reach/config.yaml` at `0o600` permissions and use dedicated accounts for cookie-based platforms.

---

## Conversion & UX Optimization

A comprehensive suite of conversion and engagement features added based on research from NNGroup, Baymard Institute, Omnichat, LINE CONVERGE 2025, and behavioral psychology (Cialdini, Kahneman, Fitt's Law).

### Website UX

```
┌─────────────────────────────────────────────────────────────────┐
│                  CONVERSION & ENGAGEMENT FEATURES                │
└─────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  TRUST & URGENCY SIGNALS                               │
  │                                                        │
  │  Homepage:                                             │
  │  ├── Trust strip: 2000+ customers, 4.8★, 40 years     │
  │  ├── Scarcity badges: 本週新到, 詢問熱烈              │
  │  ├── Social proof: "今日N人諮詢"                       │
  │  └── Scroll reveal animations (IntersectionObserver)   │
  │                                                        │
  │  Vehicle Detail:                                       │
  │  ├── Urgency line + third-party certification badge    │
  │  ├── Real-time "X人正在看" viewer count                │
  │  ├── Proactive chat nudge after 15s browsing           │
  │  └── Returning visitor banner ("歡迎回來！")           │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  INTERACTIVE FEATURES                                   │
  │                                                        │
  │  Wishlist (localStorage, max 20):                      │
  │  ├── Animated heart toggle on vehicle cards            │
  │  ├── WishlistDrawer: slide-out panel with LINE CTA    │
  │  └── Baymard: 17% abandonment from inability to save  │
  │                                                        │
  │  Fullscreen Photo Gallery:                             │
  │  ├── Zoom, swipe, keyboard navigation                 │
  │  └── Thumbnail strip for quick browsing               │
  │                                                        │
  │  Form Auto-Save (sessionStorage):                      │
  │  ├── BookVisit + LoanInquiry auto-save on input       │
  │  ├── Restore banner on return                         │
  │  └── useFormAutosave hook (debounced 500ms)            │
  │                                                        │
  │  Inline Form Validation:                               │
  │  ├── Real-time ✓/✗ feedback                           │
  │  └── Phone format hints for TW numbers                │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  STICKY CTA BAR (mobile + tablet)                      │
  │                                                        │
  │  ┌─────────────────────────────────────────────────┐  │
  │  │  📅 預約看車          📞 立即撥打              │  │
  │  │  (Book Visit)         (Call Now)                 │  │
  │  └─────────────────────────────────────────────────┘  │
  │  Fixed bottom bar on Home, Brand, Price pages          │
  │  44px min touch targets, visible through lg breakpoint │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  SOLD VEHICLE HANDLING                                  │
  │                                                        │
  │  /vehicle/:id (status = sold/reserved):                │
  │  ├── 已售出 overlay banner with dimmed photo           │
  │  ├── Same-brand recommendations (fallback: all)       │
  │  ├── CTA to browse all inventory                      │
  │  └── SEO: noindex,follow + 【已售出】title prefix     │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  RESPONSIVE DESIGN (tested on iPhone/Android/tablet)   │
  │                                                        │
  │  ├── Chat popup: full-width on mobile                 │
  │  ├── VehicleCompare: responsive modal, narrow columns │
  │  ├── BookVisit: py-3 inputs for 44px+ touch targets   │
  │  ├── BlogPost: sidebar at md breakpoint               │
  │  ├── Analytics: 2-col KPI grid on mobile              │
  │  └── DashboardLayout: drawer mode on mobile           │
  └───────────────────────────────────────────────────────┘
```

### LINE Chatbot Intelligence

```
┌─────────────────────────────────────────────────────────────────┐
│                  CHATBOT SMART FEATURES                          │
└─────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  RETURNING USER MEMORY                                 │
  │                                                        │
  │  Re-follow / return visit:                             │
  │  ├── Personalized welcome with last discussed vehicle  │
  │  └── Replaces generic welcome sequence                │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  CSAT SATISFACTION SURVEY                               │
  │                                                        │
  │  Trigger: 5min inactivity after 3+ messages            │
  │  ├── 5-star Flex Message rating                       │
  │  ├── 24-hour cooldown per user                        │
  │  ├── Score logged to analytics                        │
  │  └── Owner notified on low scores                     │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  FRUSTRATION DETECTION + AUTO-HANDOFF                   │
  │                                                        │
  │  Keywords: 不滿, 騙, 轉真人, 客訴, etc.               │
  │  ├── Empathetic message + immediate human handoff     │
  │  └── 27% satisfaction improvement (research)          │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  CONVERSATION RECOVERY                                  │
  │                                                        │
  │  5-8min silence mid-conversation:                      │
  │  ├── Contextual nudge (vehicle/loan/general topics)   │
  │  └── 60-second periodic check                         │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  FOLLOW-UP PUSH MESSAGING                               │
  │                                                        │
  │  18-48h after inquiry (inactive users):                │
  │  ├── "昨天看的那台車今天有人問喔"                      │
  │  └── Gentle scarcity nudge to re-engage               │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  CONVERSION-FOCUSED QUICK REPLIES                       │
  │                                                        │
  │  After vehicle inquiries:                              │
  │  ├── 📅 預約看車 (message action)                     │
  │  ├── 💰 問貸款 (message action)                       │
  │  └── 📞 直接撥打 (URI tel action)                     │
  │                                                        │
  │  Personalized based on:                                │
  │  ├── Conversation history + lead score                │
  │  └── Previously discussed vehicles                    │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  ENHANCED IMAGE RECOGNITION                             │
  │                                                        │
  │  Gemini Vision now extracts:                           │
  │  ├── Year, color, condition, license plate            │
  │  └── Matches against inventory for identification     │
  └───────────────────────────────────────────────────────┘
```

### Video & 360° Gallery

```
┌─────────────────────────────────────────────────────────────────┐
│                  VIDEO & 360° MEDIA SUPPORT                      │
└─────────────────────────────────────────────────────────────────┘

  Database: videoUrl + photos360Urls fields on vehicles table
  Migration: drizzle/0002_add_vehicle_media.sql

  ┌───────────────────────────────────────────────────────┐
  │  VEHICLE DETAIL PAGE — MEDIA TABS                       │
  │                                                        │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
  │  │ 📷 照片  │ │ 🎬 影片  │ │ 🔄 360°  │              │
  │  └──────────┘ └──────────┘ └──────────┘              │
  │                                                        │
  │  Photos: existing gallery with fullscreen zoom         │
  │  Video: YouTube embed (privacy-enhanced nocookie)      │
  │  360°: Vehicle360Viewer (drag-to-rotate, auto-spin)    │
  │                                                        │
  │  Tabs only appear when content exists.                 │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  ADMIN — VIDEO/360° MANAGEMENT                          │
  │                                                        │
  │  VehicleManagement.tsx:                                │
  │  ├── Video URL input field                            │
  │  └── 360° photo URLs input field                      │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  LINE CHATBOT — VIDEO INTEGRATION                       │
  │                                                        │
  │  Flex Message cards:                                   │
  │  └── "看影片" button when videoUrl exists              │
  └───────────────────────────────────────────────────────┘
```

---

## Security Hardening

Three critical security upgrades implemented (2026-03-18):

```
┌─────────────────────────────────────────────────────────────────┐
│                  SECURITY HARDENING                               │
└─────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  1. BCRYPT PASSWORD HASHING (adminAuth.ts)             │
  │                                                        │
  │  ├── Admin password hashed with bcrypt (12 rounds)    │
  │  ├── Login uses bcrypt.compare()                      │
  │  └── Timing-safe username check preserved             │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  2. LOGIN RATE LIMITER (index.ts)                       │
  │                                                        │
  │  ├── 5 failed attempts per 15 minutes                 │
  │  ├── Successful requests don't count                  │
  │  └── Security event logged on rate limit hit          │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  3. REDUCED TOKEN TTL (const.ts, adminAuth.ts)          │
  │                                                        │
  │  ├── Admin sessions: 24 hours (was 365 days)          │
  │  └── OAuth sessions: 7 days (was 365 days)            │
  └───────────────────────────────────────────────────────┘
```

---

## GEO Audit & Fixes

Based on a 5-agent parallel GEO audit (score: 66/100) with targeted fixes:

```
┌─────────────────────────────────────────────────────────────────┐
│                  GEO AUDIT FIXES (2026-03-18)                    │
└─────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  SCHEMA IMPROVEMENTS                                    │
  │                                                        │
  │  ├── AutoDealer: sameAs (Facebook, SUM, TWCar, ABCCar)│
  │  ├── Review: @id cross-reference (not inline address) │
  │  ├── Article: ImageObject + wordCount                 │
  │  ├── Person (author): sameAs + url for E-E-A-T       │
  │  ├── Removed deprecated HowTo (Google Sep 2023)       │
  │  └── Speakable extended to brand + price pages        │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  CRAWLER & INDEXING                                     │
  │                                                        │
  │  ├── robots.txt: disallow /chat, /loan-inquiry,       │
  │  │   /book-visit for all AI crawlers                  │
  │  ├── IndexNow: key endpoint + submitIndexNow()        │
  │  │   for Bing instant indexing                        │
  │  ├── Fixed duplicate brand entries in sitemap.xml     │
  │  └── Wikidata entity creation script for ChatGPT      │
  │      entity recognition                               │
  └───────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  CONTENT & ACCESSIBILITY                                │
  │                                                        │
  │  ├── External citations (mvdis.gov.tw, jcic.org.tw)   │
  │  ├── Fixed viewport: removed maximum-scale=1          │
  │  │   (was blocking pinch-zoom, failing WCAG 2.1)     │
  │  └── Added Permissions-Policy security header         │
  └───────────────────────────────────────────────────────┘
```

---

## Recall-Stack Memory System

A 5-layer persistent memory architecture based on [recall-stack](https://github.com/keshavsuki/recall-stack) that survives across sessions and terminal crashes:

```
┌─────────────────────────────────────────────────────────────────┐
│                  5-LAYER MEMORY ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────────┘

  Layer 1: CLAUDE.md ────────────── Permanent agent rules
       │
  Layer 2: primer.md ────────────── Auto-rewriting session state
       │                            (survives crashes)
       │
  Layer 3: SessionStart Hook ────── Injects git context
       │                            (branch, commits, diffs)
       │
  Layer 4: long-term-memory.md ──── Distilled knowledge & patterns
       │                            (techniques, research findings)
       │
  Layer 5: .claude-memory.md ────── Recent commit log (last 10)
                                    (auto-populated by post-commit hook)

  ┌───────────────────────────────────────────────────────┐
  │  KEY FILES                                              │
  │                                                        │
  │  ~/.claude/CLAUDE.md          Global agent rules       │
  │  ~/.claude/primer.md          Session state (Layer 2)  │
  │  ~/.claude/memory/                                     │
  │  ├── long-term-memory.md      Distilled knowledge      │
  │  ├── project-memory.md        Project state            │
  │  └── recent-memory.md         Recent observations      │
  │  tasks/lessons.md             Behavioral corrections   │
  │  .claude-memory.md            Commit log (auto)        │
  └───────────────────────────────────────────────────────┘
```

---

## AI Agent Development Strategy

This project uses Claude Code's sub-agent and agent team patterns strategically. Choosing the wrong one costs time, money, and clean context.

### Sub-agents = Contractors (90% of tasks)

A sub-agent gets **one focused task**. It spins up in its own isolated context window, does the work, and returns a result. It has no awareness of your main session, no shared state with other agents, and no ongoing relationship.

**This isolation is the feature.** Sub-agents keep the main session clean. Heavy work gets done in parallel without polluting the context you're actively thinking in.

```
# Spawn three independent sub-agents at the same time.
# Each runs in its own context. None blocks the others.
claude --worktree fix-auth-bug
claude --worktree update-test-suite
claude --worktree write-api-docs

# Your main session stays free the entire time.
```

**Use sub-agents when:**
- Tasks are independent and can run in parallel
- You need isolated file editing (worktree isolation)
- Research tasks that shouldn't pollute main context
- Bug fixes, test updates, docs — each gets its own agent
- Any task where one agent's output doesn't shape another's next action

**Examples from this project:**
- 5 parallel GEO audit agents (schema, technical, content, crawlers, platform)
- Separate agents for SEO meta injection, blog content, FAQ page
- Independent security audit agents for different repos
- Parallel responsive design fixes across components

### Agent Teams = Employees (10% of tasks)

Agent teams are **long-running**. They share context with each other and coordinate in real time. You have a lead agent directing working agents, with shared task state across the team.

The cost is coordination overhead and shared context consumption. They are the right tool **only when one agent's output must directly shape another agent's next action in real time**.

**Use agent teams when:**
- Step 1's output dynamically determines step 2's approach
- Real-time coordination is needed between agents
- The dependency between steps can't be pre-planned
- Sequential decision-making with shared state

**Examples:**
- Research agent finds API breaking change → implementation agent adapts approach mid-flight
- Code review agent identifies pattern → refactor agent applies fix across codebase using findings

### The Decision Rule

```
┌─────────────────────────────────────────────────────────┐
│  Can the tasks run independently?                        │
│                                                          │
│  YES ──▶ Sub-agents (isolated, parallel, 90% of work)   │
│                                                          │
│  NO  ──▶ Does step 1's output dynamically shape step 2? │
│           │                                              │
│           YES ──▶ Agent team (shared context, real-time) │
│           NO  ──▶ Sub-agents, run sequentially           │
│                                                          │
│  UNSURE ──▶ Sub-agents. Always default to sub-agents.    │
└─────────────────────────────────────────────────────────┘
```

> **Credit:** Strategy based on [@keshavsuki](https://github.com/keshavsuki)'s Sub-Agents vs Agent Teams guide.

### The `/simplify` Plan Gate — Catching Over-Engineering Before It Ships

Claude Code's Plan Mode has a known failure pattern: you give it a requirement, it produces a massive execution plan full of unfamiliar abstractions, unnecessary layers, and scope creep. The real danger is developer inertia — you skim the plan, think "looks thorough enough," hit approve, and let the AI turn a simple fix into an unmaintainable mess.

The symptoms:

- **Laziness:** The plan is clearly bloated, but breaking it down manually feels like work
- **Scope blindness:** The plan introduces packages or patterns you don't know, but you skip the review to move faster
- **Code smell you can't name:** Something feels off — "is this really necessary?" — but you can't pinpoint the problem
- **Permission fatigue:** You end up blindly approving every step just to see results

**The hack: use `/simplify` as a pre-execution plan reviewer.**

`/simplify` is officially a post-code cleanup tool — it spawns three parallel review agents to catch duplicate logic, improve code quality, and auto-fix issues. But there's nothing stopping you from running it *on the plan itself* before any code is written.

```
# Step 1: Claude generates a plan in Plan Mode
# Step 2: BEFORE approving, type:

use /simplify to check if the plan is sound

# Step 3: Three review agents audit the plan for:
#   - Over-engineering and unnecessary abstraction layers
#   - Scope creep beyond what was actually requested
#   - Code smells and complexity that could be simplified
#   - Unfamiliar dependencies that aren't truly needed
```

This forces the AI to review its own plan through fresh eyes. The review agents will:

1. **Cut over-engineered steps** — remove abstraction layers that don't earn their complexity
2. **Simplify exotic solutions** — replace unfamiliar patterns with straightforward approaches
3. **Name the code smells** — articulate what felt "off" in human-readable terms

**Recommended workflow:**

```
Plan Mode → /simplify (review plan) → Approve → Execute → /simplify (review code)
```

You run `/simplify` twice: once to gate the plan, once to clean the output. The first pass prevents bad architecture from ever being built. The second pass catches implementation-level issues.

> **The core insight:** Use AI to defend against AI. You don't need to understand every abstraction in the plan — let the review agents do that work for you. The cost is one extra step; the payoff is code that stays simple and maintainable.
>
> **Credit:** Technique from [FinLab 財經實驗室](https://www.facebook.com/finaboratory)'s Claude Code tips series.

---

## License

Private - All rights reserved.

---

<p align="center">
  <strong>崑家汽車</strong> — 高雄在地40年正派經營中古車行
  <br>
  Built with TypeScript, React, Gemini AI, and LINE Messaging API
</p>
