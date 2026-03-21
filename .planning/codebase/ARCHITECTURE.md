# Architecture — kun-auto-chatbot

## Pattern

**Monorepo with a single deployable app.** The project is a single Node.js process that serves both the Express REST/tRPC API and the React SPA. In development, Vite runs as middleware inside Express. In production, Express serves the pre-built static files from `dist/public/`.

The code lives in `kun-auto-chatbot/`. The outer `Claude-Code-Remote/` repository is a workspace that also contains unrelated sub-projects (`CLI-Anything/`).

---

## Layers

```
┌──────────────────────────────────────┐
│  LINE Messaging API  (external)      │
│  8891.com.tw API     (external)      │
└───────────┬──────────────────────────┘
            │ webhooks / HTTP scrape
┌───────────▼──────────────────────────┐
│  Express server  (single process)    │
│  ┌─────────────────────────────────┐ │
│  │  Security Layer                 │ │
│  │  Helmet · Rate Limit · CSP      │ │
│  ├─────────────────────────────────┤ │
│  │  LINE Webhook Router            │ │
│  │  server/lineWebhook.ts          │ │
│  ├─────────────────────────────────┤ │
│  │  tRPC Router                    │ │
│  │  server/routers.ts              │ │
│  ├─────────────────────────────────┤ │
│  │  SEO Router                     │ │
│  │  server/seo.ts                  │ │
│  ├─────────────────────────────────┤ │
│  │  Page-view Tracking Router      │ │
│  │  server/trackingApi.ts          │ │
│  ├─────────────────────────────────┤ │
│  │  Admin Auth (REST)              │ │
│  │  server/_core/adminAuth.ts      │ │
│  └─────────────────────────────────┘ │
│  Vite dev middleware / static files   │
└───────────┬──────────────────────────┘
            │ Drizzle ORM
┌───────────▼──────────────────────────┐
│  MySQL database                      │
│  drizzle/schema.ts (9 tables)        │
└──────────────────────────────────────┘
```

---

## Entry Points

| Entry | Path | Purpose |
|-------|------|---------|
| Server | `server/_core/index.ts` | Bootstraps Express, registers all middleware and routers, runs migrations, starts 8891 sync scheduler |
| Client | `client/src/main.tsx` | Mounts React app into `#root` |
| Build | `vite.config.ts` | Vite config for the client bundle (`root: client/`) |

---

## Client–Server Communication

### tRPC (primary API)
The client and server share types through a single import boundary.

- **Server definition**: `server/routers.ts` exports `appRouter` (type `AppRouter`)
- **Client binding**: `client/src/lib/trpc.ts` does `createTRPCReact<AppRouter>()` importing the server type directly
- **HTTP transport**: all tRPC calls go to `POST /api/trpc/:procedure`
- **Serialization**: superjson transformer on both ends (handles `Date`, `Map`, `Set`)
- **Procedures**:
  - `publicProcedure` — no auth required (chat, vehicle search, loan inquiry submit)
  - `protectedProcedure` — requires session cookie
  - `adminProcedure` — requires `user.role === 'admin'`

### Session auth
Login posts to `POST /api/auth/login` (plain Express, not tRPC). On success the server sets a signed JWT in a `Set-Cookie` header (`app_session_id`). Every subsequent request carries that cookie. `server/_core/context.ts` verifies the cookie and attaches `user` to every tRPC context.

### LINE Webhook (separate router)
`POST /api/line/webhook` is handled by `server/lineWebhook.ts`. LINE's platform signs each request; the server verifies the HMAC-SHA256 signature against `req.rawBody` before processing. This is mounted *before* the generic `express.json()` parser so the raw buffer is available.

### Page-view tracking (fire-and-forget REST)
`server/trackingApi.ts` exposes `POST /api/track/pageview` and `PUT /api/track/pageview/:id`. No auth; no tRPC overhead. Called from `client/src/lib/tracker.ts` on route changes.

---

## Data Flow

### Public website request
```
Browser → GET / → Express
  → SEO router: inject <meta> + JSON-LD into index.html
  → serve index.html (or Vite HMR in dev)
  → React hydrates, SPA router takes over
```

### Chat message (web)
```
User types → client Chat.tsx
  → trpc.chat.mutate({ message, sessionId })
  → POST /api/trpc/chat.mutate
  → server/routers.ts :: chat procedure
      → vehicleDetectionService.ts  (detect brand/model)
      → dynamicPromptBuilder.ts     (build LLM system prompt)
      → _core/llm.ts                (call external LLM via OpenAI-compat API)
      → db.addMessage(), db.updateConversation()
      → notifyOwner() if lead score threshold crossed
  → response streamed back to client
```

### LINE message
```
LINE platform → POST /api/line/webhook
  → lineWebhook.ts
      → verify HMAC-SHA256 signature (security.ts)
      → for each event:
          - "follow"   → buildFollowWelcomeMessages() → LINE reply API
          - "message"  → detectRichMenuTrigger / detectFaqTrigger
                       → if matched: Flex Message carousel (lineFlexTemplates.ts)
                       → else: LLM pipeline (same as web chat)
          - "postback" → analytics event logged
      → db.addAnalyticsEvent()
```

### 8891 vehicle sync
```
Server startup (+ every 6 hours via scheduler)
  → sync8891.ts
      → fetch https://www.8891.com.tw/api/v5/items/search (shop ID 1726)
      → CoV: cross-verify count with shop page HTML
      → db upsert: new vehicles inserted, changed records updated, removed → status = 'sold'
      → invalidateVehicleCache()
      → notifyOwner() with sync report
```

---

## Key Abstractions

| Abstraction | File | What it encapsulates |
|-------------|------|----------------------|
| `appRouter` | `server/routers.ts` | All tRPC procedures (chat, vehicles, conversations, admin, loan, appointments, sync) |
| `db.*` | `server/db.ts` | All Drizzle queries; 2-minute in-memory vehicle cache |
| `createContext` | `server/_core/context.ts` | Per-request auth resolution (cookie → JWT → DB user) |
| `vehicleDetectionService` | `server/vehicleDetectionService.ts` | NLP to detect which vehicle a customer is asking about; brand alias map; intent classification |
| `dynamicPromptBuilder` | `server/dynamicPromptBuilder.ts` | Sandwich-structure LLM prompt assembly; solves "lost in the middle" for vehicle-specific answers |
| `lineFlexTemplates` | `server/lineFlexTemplates.ts` | All LINE Flex Message payloads (carousels, rich menu, FAQ, welcome sequence) |
| `security` | `server/security.ts` | AES-256-GCM PII encryption, PII masking in logs, XSS sanitization, security event audit log, rate-limit config |
| `seo` | `server/seo.ts` | Server-side `<meta>` injection, Open Graph, JSON-LD schemas (AutoDealer, Car, Article, FAQ, HowTo, Review, Service), sitemap.xml, robots.txt, llms.txt |
| `trpc` | `server/_core/trpc.ts` | tRPC router factory + three procedure tiers (public/protected/admin) |
| `schema` | `drizzle/schema.ts` | Drizzle table definitions for all 9 database tables |

---

## Database Schema (9 tables)

| Table | Key columns |
|-------|-------------|
| `users` | `openId` (unique), `role` (user/admin) |
| `vehicles` | `externalId` (8891 ID), `brand`, `model`, `price`, `status`, `photoUrls` |
| `conversations` | `sessionId`, `channel`, `leadScore`, `leadStatus`, `interestedVehicleIds` |
| `messages` | `conversationId`, `role` (user/assistant/system), `content` |
| `leadEvents` | `conversationId`, `eventType`, `scoreChange` |
| `analyticsEvents` | `userId`, `eventCategory`, `eventAction`, `channel` |
| `pageViews` | `sessionHash`, `path`, `browser`, `os`, `device`, `country`, `duration` |
| `loanInquiries` | `vehicleId`, `customerName`, `phone`, `employmentType`, `status` |
| `appointments` | `vehicleId`, `customerName`, `phone`, `preferredDate`, `status` |

---

## Security Architecture

Four explicit layers in `server/_core/index.ts`:
1. **Helmet** — HTTP security headers, strict CSP, HSTS, X-Frame-Options: deny
2. **Rate limiting** — three separate limiters: general API (100/15 min), chat (20/15 min), LINE webhook (300/15 min)
3. **Request size** — 10 MB cap on `express.json()`; LINE webhook uses raw body capture for signature verification
4. **Cache-Control** — all `/api/` responses set `no-store` to prevent PII caching by proxies

Additional: AES-256-GCM encryption of customer PII in DB (`security.ts`); LINE HMAC-SHA256 webhook signature enforcement; timing-safe admin password comparison.

---

## Build & Deploy

```
# Dev
pnpm dev
  → tsx watch server/_core/index.ts
  → Vite HMR runs as Express middleware

# Production build
pnpm build
  → vite build  (outputs to dist/public/)
  → esbuild server/_core/index.ts  (outputs to dist/index.js)
  → drizzle-kit push  (applies schema to DB)

# Run
pnpm start
  → node dist/index.js  (serves dist/public/ as static)
```

Deployed to **Railway** (inferred from `app.set("trust proxy", 1)` and `RAILWAY_PUBLIC_DOMAIN` env var usage in `seo.ts`).
