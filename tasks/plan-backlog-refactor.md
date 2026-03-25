# Implementation Plan: 6 Backlog Items Refactor

## Phase 0: Documentation & Architecture Findings

### tRPC Setup
- **Router factory**: `router()` from `server/_core/trpc.ts`
- **Procedures**: `publicProcedure`, `protectedProcedure`, `adminProcedure`
- **Mount**: Express middleware at `/api/trpc` in `server/_core/index.ts:329`
- **Client**: `createTRPCReact<AppRouter>()` with httpBatchLink (no subscriptions)
- **Version**: tRPC v11.6.0, Drizzle 0.44.5, Express 4.21.2

### lineWebhook.ts Structure (2,070 lines)
| Section | Lines | Size |
|---------|-------|------|
| Phone/Gender Detection | 14-127 | 114 |
| Image Recognition | 129-249 | 121 |
| Dedup + Frustration | 250-371 | 122 |
| lineRouter + processLineEvent | 312-1258 | 947 |
| Owner Notification (flex + logic) | 1260-1565 | 306 |
| Human Handoff (flex + sender) | 1567-1812 | 246 |
| Nudge System (5-8min) | 1814-1965 | 152 |
| Follow-up System (18-48h) | 1967-2070 | 104 |

### routers.ts Structure (1,310 lines)
| Namespace | Lines (approx) | Auth |
|-----------|---------------|------|
| auth | 231-244 | public |
| vehicle | 245-370 | public/admin |
| loan | 370-450 | public |
| chat | 450-950 | public |
| appointment | 950-955 | public |
| admin | 955-1310 | admin |

### Web Chat
- Request-response via `chat.send` tRPC mutation
- No SSE/WebSocket/polling — client gets response in mutation return
- Chat component: `client/src/pages/Chat.tsx` + `client/src/components/AIChatBox.tsx`

### KaTeX
- Transitive dep via `streamdown` → `rehype-katex` → `katex`
- Bundled into `vendor-markdown.js` chunk (vite.config.ts:41-44)
- Used by `<Streamdown>` component in AIChatBox.tsx
- KaTeX fonts bundled — NO exclusion configured
- Car dealership chatbot doesn't need math rendering

### Console Statements
- 192 statements across 17 server files
- Pattern: `[ComponentName] message` with emoji indicators
- No existing logger utility

---

## Phase 1: Structured Logger + Console Replacement
**Priority: Do first — all other phases benefit from it**

### 1a. Create `server/_core/logger.ts`
```typescript
// Simple structured logger utility
// Levels: debug, info, warn, error
// In production (NODE_ENV=production): JSON format
// In development: human-readable with colors
// API: logger.info("[Chat] message", { extra })
```

**Pattern to follow:**
- Keep existing `[ComponentName]` prefix convention
- Export a singleton `logger` with `.debug()`, `.info()`, `.warn()`, `.error()`
- No external dependencies — use `console.*` under the hood with formatting
- In prod: `JSON.stringify({ level, timestamp, message, ...meta })`
- In dev: colorized human-readable output

### 1b. Replace all 192 console.* calls
- `console.log` → `logger.info` or `logger.debug`
- `console.warn` → `logger.warn`
- `console.error` → `logger.error`
- Files to update (17 total): all server/*.ts and server/_core/*.ts

### Verification
- `grep -rn "console\." server/ --include="*.ts" | grep -v test | grep -v logger.ts` → 0 results
- All tests pass
- Server starts and logs correctly

---

## Phase 2: Split lineWebhook.ts

### Target Module Structure
```
server/
  lineWebhook.ts          (core: lineRouter + processLineEvent) ~950 lines
  lineNotifications.ts    (owner notification + human handoff)  ~550 lines
  lineNudgeFollowUp.ts    (nudge 5-8min + follow-up 18-48h)   ~256 lines
  lineHelpers.ts          (phone/gender detection, image ID)    ~235 lines
```

### 2a. Extract `server/lineHelpers.ts`
Move from lineWebhook.ts:
- `detectPhoneNumber()` (lines 18-51) — **exported, used by routers.ts**
- `detectGenderFromName()` (lines 56-99) — exported
- `getGenderGreeting()` (lines 102-110) — exported
- `getNameGreeting()` (lines 112-127) — exported, used by follow-up
- `showTypingIndicator()` (lines 132-149)
- `downloadLineImage()` (lines 153-168)
- `identifyVehicleFromImage()` (lines 170-229)
- `findMatchingVehicles()` (lines 231-248)
- `isDuplicate()` (lines 256-265)

Update imports in: lineWebhook.ts, routers.ts (detectPhoneNumber)

### 2b. Extract `server/lineNotifications.ts`
Move from lineWebhook.ts:
- `getAssistantContentForTrigger()` (lines 1261-1278)
- `buildOwnerNotificationFlex()` (lines 1281-1445)
- `getMilestoneLevel()` (lines 1452-1459)
- `NOTIFICATION_MILESTONES` constant (line 1450)
- `lineNotifyCooldownMap` + `LINE_NOTIFY_COOLDOWN_MS` (lines 1462-1463)
- `checkAndNotifyOwner()` (lines 1465-1565)
- `buildHumanHandoffFlex()` (lines 1568-1744)
- `sendHumanHandoffNotification()` (lines 1747-1812)

Exports needed by lineWebhook.ts: `checkAndNotifyOwner`, `sendHumanHandoffNotification`

### 2c. Extract `server/lineNudgeFollowUp.ts`
Move from lineWebhook.ts:
- `ConversationTrack` interface (lines 1818-1824)
- `conversationTracker` Map (line 1830)
- `detectConversationTopic()` (lines 1832-1837)
- `detectVehicleNameFromMessage()` (lines 1839-1843)
- `updateConversationTracker()` (lines 1845-1857) — exported
- `checkConversationRecovery()` (lines 1859-1960)
- `followUpCooldown` Map (line 1971)
- `sendFollowUpMessages()` (lines 1973-2063) — exported
- Both `setInterval` schedulers (lines 1963-1965, 2066-2068)

### 2d. Update lineWebhook.ts
- Remove extracted code
- Add imports from new modules
- Keep: `detectFrustration()`, `lineRouter`, `processLineEvent()`
- Re-export anything that other files need (maintain backward compat)

### Verification
- All existing tests pass (line-webhook.test.ts, phone-detection.test.ts, gender-detection.test.ts, notify-recipients.test.ts)
- `import { detectPhoneNumber } from "./lineWebhook"` still works (via re-export or updated import in routers.ts)
- Server starts and LINE webhook works

---

## Phase 3: Split routers.ts

### Target Module Structure
```
server/routers/
  index.ts             (appRouter combining all sub-routers + AppRouter type)
  authRouter.ts        (auth namespace)
  vehicleRouter.ts     (vehicle namespace)
  loanRouter.ts        (loan namespace)
  chatRouter.ts        (chat namespace — largest, ~500 lines)
  appointmentRouter.ts (appointment namespace)
  adminRouter.ts       (admin namespace — ~350 lines)
```

### 3a. Create `server/routers/` directory
- Move shared imports to each sub-router file
- Each file exports a `const xxxRouter = router({ ... })`

### 3b. Create `server/routers/index.ts`
```typescript
import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./authRouter";
import { vehicleRouter } from "./vehicleRouter";
import { loanRouter } from "./loanRouter";
import { chatRouter } from "./chatRouter";
import { appointmentRouter } from "./appointmentRouter";
import { adminRouter } from "./adminRouter";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  vehicle: vehicleRouter,
  loan: loanRouter,
  chat: chatRouter,
  appointment: appointmentRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
```

### 3c. Update imports
- `server/_core/index.ts`: change `import { appRouter } from "../routers"` → `from "../routers/index"`
- `client/src/lib/trpc.ts`: change `import type { AppRouter } from "../../../server/routers"` → `from "../../../server/routers/index"`
- Delete old `server/routers.ts`

### Verification
- TypeScript compiles without errors
- Client tRPC types still work (AppRouter inference)
- All admin dashboard functions work
- Server starts correctly

---

## Phase 4: API Pagination for Admin Endpoints

### Endpoints to paginate
Admin endpoints that return lists:
- `admin.conversations` — already has pagination via db.listConversations! ✅
- `admin.vehicles` — needs pagination
- `admin.securityEvents` — needs pagination
- `admin.dailyConversations` — time-series, skip
- `admin.dailyMessages` — time-series, skip
- `admin.leadFunnel` — aggregate, skip
- `admin.popularVehicles` — aggregate, skip
- `admin.exportConversations` — export, keep full
- `admin.exportLeadEvents` — export, keep full

### 4a. Add pagination to list endpoints
Standard pagination input:
```typescript
const paginationInput = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});
```

Update DB queries to use `LIMIT` + `OFFSET` with count.

### 4b. Update admin dashboard client
- Add page controls to vehicle list, security events
- Use `keepPreviousData` for smooth transitions

### Verification
- Admin dashboard loads with paginated data
- Page navigation works
- Total counts are correct

---

## Phase 5: Remove KaTeX Font Bloat

### Strategy
KaTeX fonts are bundled because `streamdown` depends on `rehype-katex` which depends on `katex`. A car dealership chatbot doesn't need LaTeX math rendering.

### 5a. Exclude KaTeX fonts from Vite bundle
In `vite.config.ts`, add to the build config:
```typescript
build: {
  rollupOptions: {
    // Exclude KaTeX font files from the bundle
    external: (id) => id.includes('katex') && /\.(woff2?|ttf|eot)$/.test(id),
  }
}
```

Or better: use Vite's `optimizeDeps.exclude` or a custom plugin to strip font imports.

**Simplest approach**: Add a Rollup plugin to replace KaTeX CSS font-face declarations with empty strings, or configure `resolve.alias` to point KaTeX CSS to a minimal shim.

### 5b. Alternative: Replace streamdown's KaTeX integration
If streamdown allows disabling KaTeX:
- Check streamdown docs for a `katex: false` option
- If available, disable it and remove the katex chunk from vite config

### Verification
- Build the project: `npm run build`
- Check `dist/` for KaTeX font files — should be gone
- Chat rendering still works (markdown without math)
- Bundle size reduced

---

## Phase 6: Web Chat Nudge/Follow-up (L14)

### Architecture: Server-Sent Events (SSE)
SSE is simpler than WebSocket for one-way server→client push. Perfect for nudges.

### 6a. Create SSE endpoint
Add to chatRouter:
```typescript
// Express SSE endpoint (outside tRPC — tRPC doesn't support SSE well)
// GET /api/chat/events?sessionId=xxx
```

In `server/_core/index.ts`, add SSE route before tRPC mount.

### 6b. Create `server/webChatNudge.ts`
- Port nudge logic from LINE (lineNudgeFollowUp.ts) for web
- Track web chat sessions in-memory
- When user goes quiet 3-5 min → push nudge via SSE
- Use same contextual nudge messages (vehicle, loan, booking)

### 6c. Update client Chat component
- Connect to SSE endpoint on chat open
- Listen for nudge events
- Display nudge messages in chat UI
- Disconnect on chat close

### 6d. Follow-up for web chat
- Web chat is session-based (no persistent user ID like LINE)
- Follow-up only works within active session
- If user has provided contact info, could send follow-up via other channel

### Verification
- Open web chat, send a message, wait 3-5 min → nudge appears
- Nudge content is contextual (mentions vehicle if discussed)
- SSE connection handles reconnection
- No memory leak (cleanup on disconnect)

---

## Execution Order

1. **Phase 1** — Logger (foundation for all other work)
2. **Phase 2** — Split lineWebhook.ts (largest file, highest impact)
3. **Phase 3** — Split routers.ts (clean up second largest file)
4. **Phase 4** — Pagination (small, contained)
5. **Phase 5** — KaTeX (small, contained)
6. **Phase 6** — Web Chat SSE (new feature, depends on Phase 2 nudge extraction)

## Anti-Pattern Guards
- Do NOT invent tRPC subscription API — v11 httpBatchLink doesn't support it
- Do NOT add external logging libraries (winston, pino) — keep it simple
- Do NOT break the `AppRouter` type export — client depends on it
- Do NOT use WebSocket for nudges — SSE is simpler for one-way push
- Do NOT remove katex from package.json — it's a transitive dep of streamdown
