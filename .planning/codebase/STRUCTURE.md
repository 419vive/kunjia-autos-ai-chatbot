# Directory Structure — kun-auto-chatbot

All production code lives inside `kun-auto-chatbot/`. The outer `Claude-Code-Remote/` directory is a git repo that wraps this project plus tooling sub-directories (`CLI-Anything/`, `.claude/`, `.agents/`).

---

## Top-level layout

```
Claude-Code-Remote/
├── kun-auto-chatbot/        <- the actual application (see below)
├── CLI-Anything/            <- unrelated CLI plugin collection
├── .claude/                 <- Claude Code skills, commands, hooks
├── .agents/                 <- agent skill definitions (mirrors .claude/skills/)
├── .planning/               <- planning documents (this file lives here)
│   └── codebase/
├── tasks/
│   ├── lessons.md           <- agent self-learning log
│   └── todo.md              <- current task tracking
├── CLAUDE.md                <- project rules for Claude agent
├── .claude-memory.md        <- auto-populated commit history
└── memory.sh                <- session bootstrap script
```

---

## kun-auto-chatbot/ (the app)

```
kun-auto-chatbot/
├── client/                  <- React SPA (Vite root)
│   ├── index.html           <- SPA shell; meta tags injected server-side at runtime
│   ├── public/              <- static assets (images, rich-menu-guide.png)
│   └── src/
│       ├── main.tsx         <- React entry point; mounts <App />
│       ├── App.tsx          <- Router definition (wouter); all route declarations
│       ├── index.css        <- Tailwind v4 base styles
│       ├── const.ts         <- client-side constants
│       ├── lib/
│       │   ├── trpc.ts      <- createTRPCReact<AppRouter>() — type-safe client
│       │   ├── tracker.ts   <- page-view beacon (fires on route change)
│       │   ├── recentlyViewed.ts  <- localStorage recently-viewed vehicles
│       │   └── utils.ts     <- cn() (clsx + tailwind-merge), misc helpers
│       ├── components/
│       │   ├── ui/          <- shadcn/ui primitives (Button, Dialog, etc.)
│       │   ├── DashboardLayout.tsx  <- admin sidebar + nav wrapper
│       │   ├── SeoFooter.tsx        <- 4-column SEO footer (internal links)
│       │   ├── VehicleCompare.tsx   <- side-by-side vehicle comparison panel
│       │   ├── AIChatBox.tsx        <- reusable chat widget
│       │   ├── Map.tsx              <- Google Maps embed
│       │   └── ProgressiveImage.tsx <- lazy-load with blur placeholder
│       ├── pages/
│       │   ├── Home.tsx             <- public landing: vehicle grid, CTAs
│       │   ├── Chat.tsx             <- web chatbot UI (calls trpc.chat)
│       │   ├── VehicleLanding.tsx   <- individual vehicle detail page (/vehicle/:id)
│       │   ├── LoanInquiry.tsx      <- loan application form (/loan-inquiry)
│       │   ├── BookVisit.tsx        <- appointment booking (/book-visit)
│       │   ├── BrandPage.tsx        <- SEO brand landing (/brand/:brand)
│       │   ├── PricePage.tsx        <- SEO price-range landing (/price/:range)
│       │   ├── BlogIndex.tsx        <- blog listing (/blog)
│       │   ├── BlogPost.tsx         <- blog article (/blog/:slug)
│       │   ├── FaqPage.tsx          <- FAQ accordion (/faq)
│       │   ├── SmartRedirect.tsx    <- /line and /contact SPA stub
│       │   ├── AdminLogin.tsx       <- /admin/login
│       │   ├── Dashboard.tsx        <- /admin — lead stats, KPI cards
│       │   ├── Conversations.tsx    <- /admin/conversations
│       │   ├── VehicleManagement.tsx <- /admin/vehicles
│       │   ├── LoanInquiries.tsx    <- /admin/loans
│       │   ├── Appointments.tsx     <- /admin/appointments
│       │   ├── LineSetup.tsx        <- /admin/line-setup (rich menu deploy)
│       │   └── Analytics.tsx        <- /admin/analytics (web + LINE stats)
│       ├── contexts/
│       │   └── ThemeContext.tsx     <- light/dark theme provider
│       ├── hooks/
│       │   ├── useComposition.ts   <- IME composition guard for Chinese input
│       │   ├── useMobile.tsx       <- responsive breakpoint hook
│       │   └── usePersistFn.ts     <- stable function reference hook
│       ├── data/
│       │   └── blogPosts.ts        <- 5 static blog articles (Chinese, ~2000 chars each)
│       └── _core/                  <- generated/framework files (do not edit manually)
│
├── server/
│   ├── _core/                      <- framework infrastructure (treat as library code)
│   │   ├── index.ts                <- SERVER ENTRY POINT — Express setup, all middleware
│   │   ├── trpc.ts                 <- tRPC init; publicProcedure / protectedProcedure / adminProcedure
│   │   ├── context.ts              <- createContext() — cookie -> JWT -> DB user lookup
│   │   ├── adminAuth.ts            <- POST /api/auth/login; seedAdminUser()
│   │   ├── cookies.ts              <- cookie options (httpOnly, sameSite, maxAge)
│   │   ├── env.ts                  <- typed ENV object (validates required vars)
│   │   ├── sdk.ts                  <- session JWT sign/verify (jose library)
│   │   ├── llm.ts                  <- invokeLLM() — OpenAI-compat HTTP call; message types
│   │   ├── notification.ts         <- notifyOwner() — LINE push to dealer LINE account
│   │   ├── vite.ts                 <- setupVite() / serveStatic() — dev vs prod serving
│   │   ├── systemRouter.ts         <- health-check and system tRPC procedures
│   │   ├── dataApi.ts              <- (scaffold) generic data API helpers
│   │   ├── imageGeneration.ts      <- (scaffold) image gen stub
│   │   ├── map.ts                  <- (scaffold) Google Maps helpers
│   │   ├── oauth.ts                <- (scaffold) OAuth flow helpers
│   │   └── voiceTranscription.ts   <- (scaffold) voice transcription stub
│   │
│   ├── routers.ts                  <- ALL tRPC procedures (the main API surface)
│   ├── db.ts                       <- ALL Drizzle queries; vehicle cache (2 min TTL)
│   ├── lineWebhook.ts              <- LINE event handler, phone/gender detection
│   ├── lineFlexTemplates.ts        <- LINE Flex Message builders (carousels, welcome)
│   ├── lineRichMenu.ts             <- Rich menu deploy/status via LINE Messaging API
│   ├── vehicleDetectionService.ts  <- NLP brand/model detection; intent classification
│   ├── dynamicPromptBuilder.ts     <- Sandwich-structure LLM prompt assembly
│   ├── ruleBasedReply.ts           <- Fast keyword-matched replies (bypass LLM)
│   ├── sync8891.ts                 <- 8891 API scraper + CoV + scheduler (every 6 h)
│   ├── seo.ts                      <- SEO router: meta injection, JSON-LD, sitemap, robots
│   ├── trackingApi.ts              <- Lightweight page-view tracking REST endpoints
│   ├── security.ts                 <- AES-256-GCM PII encrypt; XSS sanitize; rate-limit config
│   ├── timeSlotHelper.ts           <- Business hours / appointment slot formatting
│   └── storage.ts                  <- (scaffold) S3/file storage helpers
│
├── shared/
│   ├── const.ts                    <- Constants shared by client and server (COOKIE_NAME, error codes)
│   └── types.ts                    <- Shared TypeScript types
│
├── drizzle/
│   ├── schema.ts                   <- Drizzle table definitions (source of truth for DB schema)
│   ├── relations.ts                <- Drizzle relation definitions
│   ├── 0000_salty_red_ghost.sql    <- Initial migration
│   ├── 0001_cute_mordo.sql         <- Second migration
│   └── meta/                       <- Drizzle migration metadata
│
├── scripts/                        <- One-off exploration scripts (not production)
│   ├── explore8891*.mjs            <- 8891 API exploration scripts
│   └── find-megan.mjs
│
├── dist/                           <- Production build output (git-ignored)
│   ├── index.js                    <- Bundled server (esbuild)
│   └── public/                     <- Bundled client (Vite)
│
├── package.json                    <- Single package.json (pnpm); scripts: dev/build/start/test
├── vite.config.ts                  <- Vite config; aliases: @/ -> client/src, @shared -> shared
├── drizzle.config.ts               <- Drizzle Kit config (points to drizzle/schema.ts)
├── tsconfig.json                   <- TypeScript config (paths mirror vite aliases)
├── vitest.config.ts                <- Vitest config
└── .env.example                    <- Required env vars template
```

---

## Key File Locations (quick reference)

| Need | File |
|------|------|
| Add a tRPC procedure | `server/routers.ts` |
| Change DB schema | `drizzle/schema.ts` then `pnpm db:push` |
| Add a DB query | `server/db.ts` |
| Add a page route | `client/src/App.tsx` + new file in `client/src/pages/` |
| Modify LLM prompt | `server/dynamicPromptBuilder.ts` |
| Modify vehicle NLP | `server/vehicleDetectionService.ts` |
| Modify LINE replies | `server/lineFlexTemplates.ts` |
| Modify SEO/JSON-LD | `server/seo.ts` |
| Add a blog post | `client/src/data/blogPosts.ts` |
| Change rate limits | `server/security.ts` — `RATE_LIMIT_CONFIG` |
| Change security headers | `server/_core/index.ts` — Helmet config block |
| Env var validation | `server/_core/env.ts` |

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | camelCase | `vehicleDetectionService.ts` |
| React components | PascalCase files | `VehicleLanding.tsx` |
| DB functions | verbNoun camelCase | `getAllVehicles`, `addMessage` |
| tRPC procedures | camelCase | `chat`, `listVehicles`, `syncVehicles` |
| Test files | `*.test.ts` co-located with source | `lineWebhook.test.ts` |
| SQL migrations | drizzle-kit generated slugs | `0000_salty_red_ghost.sql` |
| PATH aliases | `@/` for client src, `@shared` for shared | `import { COOKIE_NAME } from "@shared/const"` |

---

## Test File Locations

Tests are co-located with their source files inside `server/`:

- `server/intentDetection.test.ts`
- `server/vehicleDetection.test.ts`
- `server/vehicleDetectionV5.test.ts`
- `server/lineFlexTemplates.test.ts`
- `server/lineRichMenu.test.ts`
- `server/line-webhook.test.ts`
- `server/security.test.ts`
- `server/sync8891.test.ts`
- `server/timeSlot.test.ts`
- `server/vehicles.test.ts`
- `server/auth.logout.test.ts`
- `server/contextAwareDetection.test.ts`
- `server/cov-vehicle-detection.test.ts`
- `server/gender-detection.test.ts`
- `server/phone-detection.test.ts`
- `server/notify-recipients.test.ts`
- `server/security-cov.test.ts`

Run all: `pnpm test` (vitest)
