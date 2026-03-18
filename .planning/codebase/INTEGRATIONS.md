# External Integrations — kun-auto-chatbot

All source lives under `/home/user/Claude-Code-Remote/kun-auto-chatbot/`.

---

## Summary Table

| Integration | Status | Credential(s) | Source |
|---|---|---|---|
| LINE Messaging API | Active | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` | `server/lineWebhook.ts`, `server/lineRichMenu.ts`, `server/routers.ts` |
| Google AI Gemini 2.5 Flash | Active | `GOOGLE_AI_API_KEY` | `server/_core/llm.ts` |
| 8891.com.tw API | Active | None (public API) | `server/sync8891.ts` |
| MySQL database | Active | `DATABASE_URL` | `server/db.ts`, `drizzle/schema.ts` |
| JWT session auth | Active | `JWT_SECRET`, `ADMIN_PASSWORD` | `server/_core/sdk.ts`, `server/_core/adminAuth.ts` |
| Self-hosted analytics | Active | `JWT_SECRET` (for session hash) | `server/trackingApi.ts`, `client/src/lib/tracker.ts` |
| SEO / AEO engine | Active | None | `server/seo.ts` |
| Manus OAuth | Optional/dormant | `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` | `server/_core/sdk.ts`, `server/_core/oauth.ts` |
| Manus Forge (Maps/Image/Voice) | Optional/dormant | `FORGE_API_URL`, `FORGE_API_KEY` | `server/_core/map.ts`, `server/_core/imageGeneration.ts`, `server/_core/voiceTranscription.ts` |
| Google Maps JS (frontend) | Optional/dormant | `VITE_FRONTEND_FORGE_API_KEY` | `client/src/components/Map.tsx` |
| AWS S3 | Declared, not active | None configured | `server/storage.ts` |

---

## 1. LINE Messaging API

**Purpose**: Core chatbot channel; rich menu management; push notifications to owner.

**Files**: `server/lineWebhook.ts`, `server/lineFlexTemplates.ts`, `server/lineRichMenu.ts`, `server/routers.ts`

### Webhook
- Endpoint: `POST /api/line/webhook` (mounted in `server/_core/index.ts`)
- Signature verification: HMAC-SHA256 of raw request body with `LINE_CHANNEL_SECRET`
  - Raw body preserved via Express `verify` callback before JSON parsing
- Supported event types: `message` (text, image), `follow`, `postback`

### API Calls Made (all via native `fetch`)

| Endpoint | Purpose |
|---|---|
| `POST https://api.line.me/v2/bot/message/reply` | Reply to incoming messages |
| `POST https://api.line.me/v2/bot/message/push` | Push messages to owner/users |
| `POST https://api.line.me/v2/bot/chat/loading` | Show typing indicator |
| `GET https://api.line.me/v2/bot/profile/{userId}` | Fetch user display name |
| `GET https://api-data.line.me/v2/bot/message/{messageId}/content` | Download image from LINE CDN |
| `POST https://api.line.me/v2/bot/richmenu` | Create rich menu |
| `POST https://api-data.line.me/v2/bot/richmenu/{id}/content` | Upload rich menu image |
| `POST https://api.line.me/v2/bot/user/all/richmenu/{id}` | Set default rich menu |
| `DELETE https://api.line.me/v2/bot/richmenu/{id}` | Delete rich menu |

### Rich Menu
- Defined in `server/lineRichMenu.ts`
- 6-button layout (3 cols × 2 rows, 2500×1686 px)
- Actions: 看車庫存 (message), 預約賞車 (message), 聯絡我們 (`tel:`), 熱門推薦 (message), 50萬以下 (message), 導航到店 (maps.google.com)
- Image hosted at Manus CDN: `https://files.manuscdn.com/...`

### Owner Notifications
- Push notifications sent to `LINE_OWNER_USER_ID` (and optionally `LINE_ADDITIONAL_NOTIFY_USER_IDS`)
- Triggered by: new loan inquiry, new appointment, hot lead milestone (scores 50/80/120/180), phone number detected

### Credentials
- `LINE_CHANNEL_SECRET` — webhook signature key
- `LINE_CHANNEL_ACCESS_TOKEN` — bearer token for all API calls
- `LINE_OWNER_USER_ID` — owner's LINE UID for push notifications
- `LINE_ADDITIONAL_NOTIFY_USER_IDS` — optional comma-separated additional UIDs
- LINE OA URL: `https://page.line.me/825oftez`

---

## 2. Google AI — Gemini 2.5 Flash

**Purpose**: LLM powering chatbot NLP, intent detection, and response generation.

**Files**: `server/_core/llm.ts`, `server/dynamicPromptBuilder.ts`, `server/vehicleDetectionService.ts`

- Model: `gemini-2.5-flash`
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
  - Uses Google AI's OpenAI-compatible endpoint
- Timeout: 30 seconds; retries: 2 (on 429 or 5xx with exponential backoff)
- Max tokens default: 4096
- Auth: `Authorization: Bearer {GOOGLE_AI_API_KEY}`
- Vehicle knowledge base injected into system prompt from DB
- Can be bypassed with `FORCE_RULE_BASED_REPLY=1` → `server/ruleBasedReply.ts`

**Credential**: `GOOGLE_AI_API_KEY`

---

## 3. MySQL Database

**Purpose**: All persistent data — users, vehicles, conversations, messages, leads, analytics.

**Files**: `server/db.ts`, `drizzle/schema.ts`, `drizzle.config.ts`

- ORM: Drizzle ORM ^0.44.5; driver: mysql2 ^3.15.0
- Migrations: `drizzle-kit generate && drizzle-kit migrate`; also inline `runMigrations()` at server startup
- Connection: `DATABASE_URL` env var (mysql:// connection string)

**Tables** (9 total):

| Table | Purpose |
|---|---|
| `users` | Auth users; `openId` unique key; role enum (user/admin) |
| `vehicles` | Inventory synced from 8891.com.tw |
| `conversations` | Customer chat sessions; lead score, lead status, channel |
| `messages` | Individual messages within conversations |
| `leadEvents` | Audit log of lead scoring events |
| `analyticsEvents` | LINE behavioral events (follow, rich menu clicks, postbacks) |
| `pageViews` | Website page view analytics (privacy-friendly, no cookies) |
| `loanInquiries` | Loan application form submissions |
| `appointments` | Vehicle viewing appointment bookings |

**Credential**: `DATABASE_URL`

---

## 4. 8891.com.tw — Vehicle Inventory API

**Purpose**: Auto-sync vehicle listings from 崑家汽車's dealer page (shop ID: 1726).

**File**: `server/sync8891.ts`

- Sync schedule: on server startup + every 6 hours (`startSyncScheduler(6)`)
- CoV (Chain of Verification) runs every 3.5 days

**External URLs**:

| URL | Purpose |
|---|---|
| `https://www.8891.com.tw/api/v5/items/search?api=6.21&page=1&limit=30&from=shop&shopId=1726` | Fetch all vehicle listings (status 12000 = success) |
| `https://m.8891.com.tw/shop?id=1726&navType=index` | Scrape `onSaleCount` for CoV |
| `https://m.8891.com.tw/auto?id={carId}` | Scrape individual vehicle detail (extra photos) |

No authentication required — public API accessed with realistic browser headers to avoid bot detection.

---

## 5. JWT Session Auth

**Purpose**: Admin dashboard authentication.

**Files**: `server/_core/sdk.ts`, `server/_core/adminAuth.ts`

- JWT tokens (HS256) signed with `JWT_SECRET`; stored in HTTP-only cookies
- Session payload: `{ openId, appId, name }`
- Local admin: `POST /api/auth/login` with `crypto.timingSafeEqual` credential comparison
- Admin user seeded on startup when `ADMIN_PASSWORD` is set (openId: `local-admin`)
- tRPC procedures use `protectedProcedure` / `adminProcedure` guards

**Credentials**: `JWT_SECRET`, `ADMIN_USERNAME` (default: `admin`), `ADMIN_PASSWORD`

---

## 6. Self-Hosted Page View Analytics

**Purpose**: Privacy-first first-party analytics — no third-party scripts, no cookies.

**Files**: `server/trackingApi.ts`, `client/src/lib/tracker.ts`

- Client sends `POST /api/track` on each SPA route change, `PATCH /api/track` with time-on-page on leave
- Session ID: daily-rotating SHA-256 hash of `IP + User-Agent + date + JWT_SECRET`
- Captures: path, referrer domain, browser, OS, device type, language, screen width, duration
- Admin view: `/admin/analytics` (`client/src/pages/Analytics.tsx`)

---

## 7. SEO / AEO Engine

**Purpose**: Server-side meta injection for React SPA; structured data for search engines and AI crawlers.

**File**: `server/seo.ts`

**Endpoints**:

| Path | Content |
|---|---|
| `GET /robots.txt` | Allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot, Meta-ExternalAgent |
| `GET /sitemap.xml` | Dynamic sitemap with all vehicle pages, blog posts, brand/price pages; includes `image:image` entries |
| `GET /llms.txt` | AI-readable site map in Markdown (llmstxt.org spec); dynamic vehicle inventory listing |

**JSON-LD Schemas**: AutoDealer, Car, ItemList, Article (with Person author for E-E-A-T), FAQPage, HowTo, Service (5 services), Review, BreadcrumbList, WebSite, WebPage, Speakable

---

## 8. Manus OAuth Server (Optional / Dormant)

**Purpose**: External SSO for admin users (alternative to local admin login).

**Files**: `server/_core/sdk.ts`, `server/_core/oauth.ts`

- Endpoint: `OAUTH_SERVER_URL`; paths like `/webdev.v1.WebDevAuthPublicService/ExchangeToken`
- Supported platforms: email, Google, Apple, Microsoft, GitHub
- Callback route: `GET /api/oauth/callback`
- Falls back to local `/admin/login` when `VITE_OAUTH_PORTAL_URL` is not set

**Credentials**: `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`

---

## 9. Manus Forge API (Optional / Dormant)

**Purpose**: Proxied Google Maps, image generation, and voice transcription.

**Files**: `server/_core/map.ts`, `server/_core/imageGeneration.ts`, `server/_core/voiceTranscription.ts`, `client/src/components/Map.tsx`

### Sub-services

**Google Maps (server-side proxy)** — `server/_core/map.ts`
- Routes through `FORGE_API_URL/v1/maps/proxy{endpoint}`
- Supports: Geocoding, Directions, Distance Matrix, Places, Elevation, Timezone, Roads, Static Maps, Autocomplete

**Google Maps (client-side)** — `client/src/components/Map.tsx`
- Loads via `VITE_FRONTEND_FORGE_API_URL/v1/maps/proxy/maps/api/js`
- Libraries: marker, places, geocoding, geometry

**Image Generation** — `server/_core/imageGeneration.ts`
- Endpoint: `FORGE_API_URL/images.v1.ImageService/GenerateImage`
- Currently non-functional: calls `storagePut` which throws (storage not configured)

**Voice Transcription (Whisper)** — `server/_core/voiceTranscription.ts`
- Endpoint: `FORGE_API_URL/v1/audio/transcriptions`; model `whisper-1`; max 16 MB

**Credentials**: `FORGE_API_URL`, `FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY`

---

## 10. AWS S3 (Declared, Not Active)

**Purpose**: File storage for generated images / uploaded assets.

**File**: `server/storage.ts`

`@aws-sdk/client-s3` ^3.693.0 is in `package.json` but `storagePut`/`storageGet` throw `"Storage not configured"`. No S3 bucket or credentials are wired. Must be set up before image generation can function.

---

## 11. Security Layer

**Purpose**: Multi-layer request hardening.

**File**: `server/security.ts`, wired in `server/_core/index.ts`

- **Helmet** ^8.1.0 — CSP, HSTS (1 year + preload), X-Frame-Options deny, nosniff, referrer policy
- **Rate limiting** (express-rate-limit ^8.2.1): three separate limiters — general API, chat (stricter), LINE webhook
- **LINE webhook HMAC-SHA256** — signature verified against raw body before parsing
- **XSS sanitization** — `xss-filters` ^1.2.7 on chat inputs (`sanitizeChatMessage`, `sanitizeSearchQuery`)
- **PII masking** — phone/name masking functions (`maskPhone`, `maskName`, `maskPIIInText`)
- **Security event logging** — `logSecurityEvent`/`getSecurityEvents` for rate limit hits and auth failures
