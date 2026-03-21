# Codebase Concerns — kun-auto-chatbot

Generated: 2026-03-18
Codebase root: `/home/user/Claude-Code-Remote/kun-auto-chatbot`

---

## CRITICAL

### C-1: PII Encryption Implemented But Never Called
**File:** `server/security.ts` (lines 40–87), `server/db.ts`, `server/routers.ts`

`encryptPII()` and `decryptPII()` are fully implemented with AES-256-GCM but are **never called anywhere in production code**. Customer phone numbers (`customerContact`), names (`customerName`), and full PII from loan inquiries and appointments are stored in plaintext in MySQL. The `security.test.ts` tests the encryption functions in isolation, creating a false sense of security. Under Taiwan's PDPA, storing unencrypted PII of identifiable individuals is a compliance violation.

**Evidence:** `grep encryptPII server/` — only appears in `security.ts` (definition) and `security.test.ts` (test). No call sites in `db.ts` or `routers.ts`.

---

### C-2: Admin Login Endpoint Has No Rate Limiting (Brute-Force Exposure)
**File:** `server/_core/index.ts` (lines 231–266), `server/_core/adminAuth.ts`

The admin login route `POST /api/auth/login` is registered at line 266, **after** rate limiters are wired at line 231. The general limiter covers `/api/` but there is **no login-specific rate limiter** — `RATE_LIMIT_CONFIG` defines an `admin` config in `server/security.ts` but it is never instantiated or applied. An attacker can brute-force the password at 100 req/15 min per IP (trivially bypassed with IP rotation). The endpoint correctly uses `timingSafeEqual` for the comparison, but that only prevents timing attacks, not brute force.

---

### C-3: `drizzle-kit push` in Production Build Can Cause Data Loss
**File:** `package.json` (line 8, `build` script)

```
"build": "vite build && esbuild ... && drizzle-kit push"
```

`drizzle-kit push` is a destructive development-only tool that diffs the current schema against the live database and applies changes **without generating a migration file**. Running this on every Railway deploy risks silent column drops or renames. There is no migration history and no rollback path. Two competing migration strategies also coexist (`drizzle-kit push` in `build` and `drizzle-kit generate && drizzle-kit migrate` in `db:push`).

---

## HIGH

### H-1: `getBaseUrl()` Has Operator Precedence Bug — Wrong Domain in All SEO Output
**File:** `server/seo.ts` (lines 20–24)

```ts
function getBaseUrl(): string {
  return process.env.BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://kuncar.tw";
}
```

JavaScript operator precedence parses this as `(A || B) ? C : D`. When `BASE_URL` is set, the truthy branch fires and uses `RAILWAY_PUBLIC_DOMAIN` (possibly unset or different from `BASE_URL`). This corrupts canonical URLs, Open Graph URLs, sitemap entries, and all JSON-LD `@id` references — directly harming SEO ranking. The TODO comment on line 23 confirms this was known but unresolved.

---

### H-2: Session Tokens Last One Year With No Revocation Mechanism
**Files:** `server/_core/adminAuth.ts` (line 65), `shared/const.ts` (line 2)

`ONE_YEAR_MS` is used for all session tokens including admin sessions. There is no token revocation list, no refresh token pattern, and no server-side session store — only the JWT signature is verified. If an admin cookie is stolen, access persists for up to a year. The only way to invalidate all sessions is to rotate `JWT_SECRET`, which also logs out all legitimate users simultaneously.

---

### H-3: No Database Foreign Keys — Orphaned Records Accumulate Silently
**Files:** `drizzle/schema.ts`, `server/_core/index.ts` (migration SQL, lines 47–134)

`messages.conversationId`, `leadEvents.conversationId`, `analyticsEvents.conversationId`, `loanInquiries.vehicleId`, and `appointments.vehicleId` are plain `int` columns with no `REFERENCES` constraint and no `ON DELETE` rule. The hand-written migration SQL also has no foreign key declarations. Deleting a conversation leaves permanently orphaned messages and lead events, causing incorrect analytics counts and silent data corruption.

---

### H-4: LINE Notification Logic Duplicated Four Times
**File:** `server/routers.ts` (lines 185–223, 325–354, 400–432, 830–868)

The pattern of reading `process.env.LINE_CHANNEL_ACCESS_TOKEN`, building recipient lists, and calling `fetch("https://api.line.me/v2/bot/message/push", ...)` is copy-pasted four times (lead score milestone, loan inquiry, appointment, human handoff). These all bypass the `ENV` module's validation. If the token is missing the code silently no-ops. Any bug fix must be applied in four separate places. This should be a shared `pushLineNotification(recipients, message)` utility.

---

### H-5: Loan and Appointment Phone Numbers Not Validated
**File:** `server/routers.ts` (lines 284–300, 375–390)

Both `loan.submit` and `appointment.submit` accept `phone: z.string().min(1)`. There is no regex validation, no length limit, and no normalization. Arbitrary strings pass as phone numbers, are sent verbatim in LINE push notifications to the owner, and stored in the database. Combined with absent PII encryption (C-1), unvalidated strings accumulate unmasked.

---

### H-6: Prompt Injection Detected But Never Blocked
**File:** `server/security.ts` (lines 218–233)

`sanitizeChatMessage()` detects prompt injection patterns (`ignore all previous instructions`, `[INST]`, `<<SYS>>`, etc.) but only logs a warning and explicitly does not block. The comment says "The system prompt should be robust enough." This means all detected injection attempts pass through to Gemini unchanged. The detection code provides audit trail but no actual defense.

---

### H-7: Critical In-Memory State Lost on Every Server Restart
**Files:** `server/routers.ts` (line 121), `server/security.ts` (line 278), `server/sync8891.ts` (lines 25–30)

Three in-memory stores reset on every deploy:
- `notifyCooldownMap` — lead notification dedup (owners re-notified on restart)
- `securityEvents[]` — security audit log buffer (all audit history disappears)
- `syncInProgress`, `lastSyncTime`, `lastSyncStatus`, `lastCoVReport` — 8891 sync state (sync re-runs immediately on every restart regardless of 6-hour schedule)

On Railway, deployments are frequent. None of these are persisted to the database.

---

### H-8: No Automated Tests for Critical Server Code
**Files:** `server/routers.ts`, `server/db.ts`, `server/_core/`

Test files exist for `security.ts`, `lineWebhook.ts`, vehicle detection, and sync logic, but zero tests cover the tRPC router procedures (chat, loan, appointment, admin endpoints), database CRUD functions in `db.ts`, or the authentication flow in `adminAuth.ts`. The `routers.ts` file at 1100+ lines is entirely untested.

---

## MEDIUM

### M-1: Database Connections Not Pooled
**File:** `server/db.ts` (lines 17–27)

`drizzle(process.env.DATABASE_URL)` with a string URL creates a new TCP connection per query rather than reusing connections from a pool. Under concurrent load (multiple simultaneous chat sessions), this exhausts MySQL's `max_connections`. Should use `mysql2.createPool(...)` and pass the pool to `drizzle()`.

---

### M-2: `getPopularVehicles` Loads All Conversations Into Memory
**File:** `server/db.ts` (lines 314–347)

Fetches all conversations into Node.js memory, parses comma-separated `interestedVehicleIds` in JavaScript, then fires a second DB query for vehicle details. At scale this loads the entire `conversations` table into memory. Should be done with a single SQL query using a join or aggregation.

---

### M-3: `interestedVehicleIds` Stored as Comma-Separated Text
**File:** `drizzle/schema.ts` (line 70), `server/db.ts` (lines 325–328), `server/routers.ts` (line 888)

`conversations.interestedVehicleIds` is `text` holding `"12,34,56"`. Parsing uses `.split(',').map(parseInt)`. This makes DB-level querying, indexing, and joining impossible. Should be a `vehicleInterests` junction table.

---

### M-4: Missing Indexes on Frequently Queried Columns
**File:** `drizzle/schema.ts`, `server/_core/index.ts`

No indexes defined on:
- `conversations.leadStatus` — filtered in `listConversations`, `getDashboardStats`
- `conversations.channel` — filtered in multiple analytics queries
- `conversations.leadScore` — range filtered in `getDashboardStats`
- `conversations.updatedAt` — `ORDER BY` in `listConversations`
- `messages.conversationId` — every conversation detail view
- `leadEvents.conversationId` — conversation detail
- `analyticsEvents.createdAt` — all analytics date-range queries

Only `pageViews` has explicit indexes (`idx_pageviews_created`, `idx_pageviews_session`, `idx_pageviews_path`).

---

### M-5: Full Vehicle Inventory Injected Into Every LLM Call
**File:** `server/routers.ts` (lines 509–523, 766–768)

Every chat message triggers `db.getAllVehicles()` twice (detection + KB building) and concatenates the full vehicle inventory into the Gemini system prompt. With 30 vehicles at ~500 chars each, this adds ~15,000 tokens per request. Token costs scale linearly with inventory size and approach context window limits.

---

### M-6: `conditions: any[]` Throughout `db.ts`
**File:** `server/db.ts` (18 occurrences)

Every query builder function uses `const conditions: any[]`. Drizzle ORM exposes proper typed SQL condition types. The `any[]` pattern defeats TypeScript's ability to catch type errors in query construction and makes safe refactoring impossible.

---

### M-7: Unsanitized Message Used for Vehicle Detection
**File:** `server/routers.ts` (lines 460, 516)

```ts
const sanitizedMessage = sanitizeChatMessage(input.message);  // line 460
const detectionWeb = detectVehicleFromMessage(input.message, ...  // line 516
```

Vehicle detection and the "mentioned vehicles" extraction (line 880) use the original `input.message`, not `sanitizedMessage`. The HTML-encoded form from `sanitizeChatMessage` would break Chinese text matching (encoding `<>` characters in brand names), so there is no clean fix — detection and sanitization are architecturally incompatible as currently implemented.

---

### M-8: 8891 Vehicle Detail Fetches Have No Timeout
**File:** `server/sync8891.ts` (lines 236–290)

`fetchVehicleDetailEnriched()` calls `fetch()` with no `AbortController` timeout. If 8891's mobile page hangs on one request in the 3-concurrent-batch, the entire sync hangs indefinitely. `syncInProgress = true` would block all subsequent sync calls until process restart.

---

### M-9: Admin Dashboard Returns Unmasked Phone Numbers Without Audit Log
**File:** `server/routers.ts` (lines 960–965, 981)

`admin.conversations` returns full `Conversation` objects with raw `customerContact` phone numbers. Only `chat.history` masks the phone for the customer-facing chat UI (line 935). There is no audit log entry when admin users view individual conversation details containing PII. Contrast with `chat.history` which both masks and returns masked data.

---

### M-10: No CSRF Protection on Admin Mutation Endpoints
**File:** `server/_core/index.ts`, `server/routers.ts`

tRPC mutations (loan status updates, conversation updates, vehicle status changes, rich menu deployment, 8891 sync trigger) rely solely on cookie-based session auth with no CSRF token validation. The `getSessionCookieOptions` in `server/_core/cookies.ts` should be checked to confirm `SameSite=Strict` is set, as that would provide partial mitigation.

---

### M-11: PII Leaks Into LLM System Prompt
**File:** `server/routers.ts` (lines 748–753)

When a customer has left a phone number, the full unmasked number is injected into the Gemini system prompt:
```ts
- 客戶已留電話：${conversation!.customerContact}，不需要再問電話
```

Customer PII (phone number) is sent to Google's AI API on every subsequent message. This may violate Taiwan PDPA and Google's data processing terms depending on the DPA in place.

---

### M-12: `conversation!` Non-Null Assertions — 15 Uses Risk Runtime Crashes
**File:** `server/routers.ts` (15 occurrences of `conversation!.`)

After `db.getConversationBySessionId()`, `conversation` is typed as `Conversation | undefined`. The code assigns a cast (`as any`) immediately after creation and then uses `conversation!.` assertions throughout. If the DB write fails silently (the `catch` in `createConversation` would throw, but `upsertUser` swallows errors), subsequent `conversation!.leadScore` accesses would crash the request.

---

## LOW

### L-1: `"dev-only-secret"` Default JWT Secret
**File:** `server/_core/env.ts` (line 12)

If deployed with `NODE_ENV` not set to `"production"`, the JWT secret defaults to the public string `"dev-only-secret"`, allowing anyone to forge session tokens for any user.

---

### L-2: `escJson()` Does Not Escape `</script>`
**File:** `server/seo.ts` (lines 32–34)

The JSON-LD injection helper does not escape `</script>` sequences. A vehicle description containing `</script>` would break out of the JSON-LD script tag and could allow script injection in server-rendered HTML.

---

### L-3: Security Audit Log Not Persisted to Database
**File:** `server/security.ts` (line 278)

The in-memory `securityEvents[]` buffer (max 1000 events) is not persisted. Auth failures, rate limit hits, and webhook signature failures disappear on every deploy. The admin security audit dashboard will always show an empty log after restart.

---

### L-4: Blog Content Hardcoded in JS Bundle
**File:** `client/src/data/blogPosts.ts`

Five 2000+ character blog articles are statically bundled into the React app. Updating content requires a full redeploy. For an SEO-focused site, this should be database- or CMS-driven.

---

### L-5: Unused OAuth Flow Still Registered
**File:** `server/_core/oauth.ts`

The OAuth routes are defined and imported but whether they are actually registered on the Express app needs verification. If registered but unconfigured (`OAUTH_SERVER_URL` empty), they fail silently.

---

### L-6: No `manualChunks` Code Splitting in Vite Config
**File:** `kun-auto-chatbot/vite.config.ts`

No `build.rollupOptions.output.manualChunks` is configured. All vendor code (React, tRPC, shadcn, recharts, etc.) may bundle into oversized chunks. Manual chunk splitting for heavy libraries would reduce first-load JS size for the public-facing pages.

---

### L-7: Debug and One-Off Script Files Committed to Repository
**Files in `kun-auto-chatbot/`:**
- `debug-ford.ts`, `debug-intent.ts`, `debug_conv.mjs`
- `check-8891-data.ts`, `check_bmw_data.ts`, `compare-vehicles.ts`
- `test_scrape2.mjs`, `notes-chat-test.md`, `research-findings.md`

These add surface area, may contain real user/vehicle data, and add noise to code reviews. Should be gitignored or deleted.

---

### L-8: Hardcoded LINE OA URL in Multiple Files
**Files:** `server/_core/index.ts` (line 288), `server/seo.ts` (line 18), `server/lineFlexTemplates.ts`

The LINE OA URL `https://page.line.me/825oftez` is hardcoded in at least three files rather than centralized as an environment variable. A LINE channel change requires grep-and-replace across multiple files.

---

## INCOMPLETE FEATURES

### IF-1: Two Competing Migration Strategies Coexist
**Files:** `package.json` (`build` script), `server/_core/index.ts` (`runMigrations()`), `drizzle/`

Hand-written `CREATE TABLE IF NOT EXISTS` SQL in `runMigrations()` (lines 47–134) coexists with `drizzle-kit push` in the build script. Schema changes made in `drizzle/schema.ts` must be manually reflected in the hand-written SQL. These will diverge over time.

---

### IF-2: Appointment Overlap Not Checked
**File:** `server/routers.ts` (lines 372–435)

`appointment.submit` inserts without checking for existing confirmed appointments at the same date/time. Double-booking is silently allowed.

---

### IF-3: `VehicleCompare` Component Has No Backend or Route
**File:** `client/src/components/VehicleCompare.tsx`

The component exists as a UI prototype with no tRPC endpoint, no URL route in `App.tsx`, and no state management. It is dead code bundled into production.

---

### IF-4: `ComponentShowcase` Page Is Dead Code
**File:** `client/src/pages/ComponentShowcase.tsx`

The page is imported (or exists) in the codebase but has no route in `App.tsx`. It is bundled but unreachable.

---

### IF-5: `storage.ts` Functions Throw — Image Generation Broken
**File:** `server/storage.ts`

`storagePut`/`storageGet` and related Forge service functions throw errors when called (AWS S3 or Forge credentials not configured). `imageGeneration.ts`, `voiceTranscription.ts`, and `map.ts` in `server/_core/` are stubs. These features appear in `ENV` config (`forgeApiUrl`, `forgeApiKey`) but are non-functional.

---

## SUMMARY TABLE

| ID | Severity | Area | One-Line Description |
|---|---|---|---|
| C-1 | Critical | Security/PDPA | PII encryption built but never called — phone/name stored in plaintext |
| C-2 | Critical | Security | Admin login has no rate limiter — brute-forceable |
| C-3 | Critical | Ops | `drizzle-kit push` in production build can cause silent data loss |
| H-1 | High | SEO | `getBaseUrl()` operator precedence bug — wrong domain in all canonical/OG/sitemap URLs |
| H-2 | High | Security | 1-year session tokens with no revocation mechanism |
| H-3 | High | Data Integrity | No foreign key constraints — orphaned records accumulate |
| H-4 | High | Maintainability | LINE notification code duplicated 4x with raw `process.env` access |
| H-5 | High | Validation | Phone numbers in loan/appointment not validated |
| H-6 | High | Security | Prompt injection detected but never blocked |
| H-7 | High | Reliability | Critical in-memory state (audit log, sync status, dedup) lost on restart |
| H-8 | High | Testing | Zero tests for tRPC routers, db.ts CRUD, and auth flow |
| M-1 | Medium | Performance | MySQL connections not pooled — new TCP per query |
| M-2 | Medium | Performance | `getPopularVehicles` loads all conversations into memory |
| M-3 | Medium | Data Model | `interestedVehicleIds` is a comma-separated text string, not a relation |
| M-4 | Medium | Performance | Missing indexes on `leadStatus`, `channel`, `leadScore`, `conversationId`, `createdAt` |
| M-5 | Medium | Cost | Full vehicle inventory injected as tokens into every LLM call |
| M-6 | Medium | Type Safety | `conditions: any[]` in 18 places in `db.ts` |
| M-7 | Medium | Security | Vehicle detection uses raw (unsanitized) message, not sanitized version |
| M-8 | Medium | Reliability | 8891 per-vehicle fetch has no timeout — sync can hang indefinitely |
| M-9 | Medium | Privacy | Admin dashboard exposes unmasked phone numbers without audit logging |
| M-10 | Medium | Security | No CSRF protection on admin mutation endpoints |
| M-11 | Medium | Privacy/PDPA | Customer phone number sent to Google AI in every LLM system prompt |
| M-12 | Medium | Reliability | 15 `conversation!.` non-null assertions — runtime crash if DB write fails |
| L-1 | Low | Security | `"dev-only-secret"` default JWT if `NODE_ENV` not set to production |
| L-2 | Low | Security | `escJson()` does not escape `</script>` — potential JSON-LD injection |
| L-3 | Low | Observability | Security audit log not persisted to DB — cleared on every deploy |
| L-4 | Low | Performance | Blog content hardcoded in JS bundle — requires redeploy to update |
| L-5 | Low | Auth | OAuth routes may be registered but non-functional |
| L-6 | Low | Performance | No `manualChunks` Vite code splitting — oversized production bundle |
| L-7 | Low | Cleanliness | Debug/one-off scripts committed to repo (debug-ford.ts, check_bmw_data.ts, etc.) |
| L-8 | Low | Maintainability | LINE OA URL hardcoded in 3+ files instead of env var |
| IF-1 | — | Incomplete | Two competing DB migration strategies that will diverge |
| IF-2 | — | Incomplete | Appointment booking has no overlap/conflict detection |
| IF-3 | — | Incomplete | `VehicleCompare` component has no backend or route — dead code |
| IF-4 | — | Incomplete | `ComponentShowcase` page bundled but unreachable |
| IF-5 | — | Incomplete | Storage, image generation, voice, map services are non-functional stubs |
