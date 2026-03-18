# Integrations

## 1. LINE Messaging API
**Purpose**: Core chatbot channel — receives webhooks, sends replies, manages rich menus.

**Files**: `server/lineWebhook.ts`, `server/lineFlexTemplates.ts`, `server/lineRichMenu.ts`

**Endpoints**:
- `https://api.line.me/v2/bot` — messaging, rich menu
- `https://api-data.line.me/v2/bot` — rich menu image upload

**Config**:
```
LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_OWNER_USER_ID
LINE_ADDITIONAL_NOTIFY_USER_IDS (optional)
```

## 2. Google AI (Gemini) — LLM
**Purpose**: Powers AI chatbot via `gemini-2.5-flash` (OpenAI-compatible endpoint). 30s timeout, 2 retries.

**Files**: `server/_core/llm.ts`, `server/dynamicPromptBuilder.ts`

**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`

**Config**: `GOOGLE_AI_API_KEY` (required), `FORCE_RULE_BASED_REPLY=1` (optional: skip LLM)

## 3. MySQL Database
**Purpose**: All persistent data — users, vehicles, conversations, messages, leads, analytics.

**Files**: `server/db.ts`, `drizzle/schema.ts`

**Tables** (9): `users`, `vehicles`, `conversations`, `messages`, `leadEvents`, `analyticsEvents`, `pageViews`, `loanInquiries`, `appointments`

**Config**: `DATABASE_URL=mysql://user:password@host:3306/dbname`

## 4. 8891.com.tw Vehicle Sync
**Purpose**: Fetches live inventory from 8891 used car marketplace. Runs on startup + every 6 hours. CoV verification twice per week.

**Files**: `server/sync8891.ts`

**External URLs**:
- `https://www.8891.com.tw/api/v5/items/search` — vehicle list
- `https://m.8891.com.tw/shop?id=1726` — shop page verification
- `https://m.8891.com.tw/auto?id={carId}` — vehicle detail pages

**No auth required** (public API with mobile User-Agent)

## 5. JWT Session Auth
**Purpose**: HTTP-only JWT cookies (HS256). Admin login via username/password with timing-safe comparison.

**Files**: `server/_core/sdk.ts`, `server/_core/adminAuth.ts`

**Config**: `JWT_SECRET`, `ADMIN_USERNAME` (default: "admin"), `ADMIN_PASSWORD`

## 6. Manus Platform SDK (Dormant)
**Purpose**: Inherited infrastructure — OAuth exchange, Forge API proxy (image gen, voice, maps). Not wired in production.

**Files**: `server/_core/sdk.ts`, `server/_core/oauth.ts`, `server/_core/imageGeneration.ts`, `server/_core/voiceTranscription.ts`, `server/_core/map.ts`

**Config** (all unused): `OAUTH_SERVER_URL`, `FORGE_API_URL`, `FORGE_API_KEY`

## 7. AWS S3 / Cloudflare R2 (Not Active)
**Purpose**: S3 SDK installed but `storagePut`/`storageGet` throw "Storage not configured."

**Files**: `server/storage.ts`

## 8. Page View Analytics (Custom)
**Purpose**: Privacy-first first-party analytics. Beacon on route change, captures session hash, path, referrer, browser, device.

**Files**: `server/trackingApi.ts`, `client/src/lib/tracker.ts`

## 9. SEO / AEO Engine
**Purpose**: Server-side meta injection. JSON-LD schemas (AutoDealer, Car, Article, FAQ, HowTo, Speakable, Review). Serves `/robots.txt`, `/sitemap.xml`, `/llms.txt`.

**Files**: `server/seo.ts`

## 10. Security Layer
**Purpose**: Helmet, rate limiting, AES-256-GCM PII encryption, XSS sanitization, LINE webhook HMAC-SHA256 verification.

**Files**: `server/security.ts`
