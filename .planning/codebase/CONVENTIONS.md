# Codebase Conventions

## Project Structure

The main application lives in `/home/user/Claude-Code-Remote/kun-auto-chatbot/` and follows a monorepo layout:

```
kun-auto-chatbot/
  client/src/          — React frontend (Vite + Tailwind)
    pages/             — One file per route
    components/        — Shared UI components
    lib/               — Client utilities (trpc.ts, utils.ts, tracker.ts)
    contexts/          — React context providers
    _core/hooks/       — Custom React hooks
  server/              — Express backend
    _core/             — Framework internals (trpc.ts, context.ts, index.ts, llm.ts, etc.)
    *.ts               — Feature modules (lineWebhook.ts, security.ts, sync8891.ts, etc.)
    *.test.ts          — Co-located tests
  shared/              — Code shared between client and server
    const.ts           — Shared constants
    types.ts           — Re-exports from drizzle/schema + shared errors
  drizzle/             — ORM schema and SQL migrations
    schema.ts          — Single source of truth for all DB types
    *.sql              — Migration files
```

## Language and Runtime

- TypeScript everywhere, strict mode enabled (`"strict": true` in `tsconfig.json`)
- ESM modules (`"type": "module"` in `package.json`)
- Node.js server with `tsx` for development, `esbuild` for production build
- React 19 on the frontend

## Formatting (Prettier)

Config lives at `/home/user/Claude-Code-Remote/kun-auto-chatbot/.prettierrc`.

Key rules:
- Double quotes (not single) for strings
- Semicolons required
- 2-space indentation, no tabs
- 80-character print width
- Trailing commas: `"es5"` style (objects and arrays, not function params)
- Arrow function parens: `"avoid"` (omit when single param)
- LF line endings
- No JSX single quotes

No ESLint config exists in the project root — Prettier is the only formatter enforced.

## Naming Conventions

### Files
- React pages and components: `PascalCase.tsx` (e.g., `VehicleManagement.tsx`, `AIChatBox.tsx`)
- Server modules: `camelCase.ts` (e.g., `lineWebhook.ts`, `vehicleDetectionService.ts`)
- Test files: co-located alongside source, same name + `.test.ts` suffix (e.g., `security.ts` / `security.test.ts`)
- Core infrastructure files live under `server/_core/` (e.g., `trpc.ts`, `context.ts`, `llm.ts`)

### Variables and Functions
- `camelCase` for variables, functions, and methods
- `PascalCase` for React components, TypeScript types, and interfaces
- `SCREAMING_SNAKE_CASE` for module-level constants (e.g., `VEHICLE_CACHE_TTL_MS`, `LEAD_SCORE_RULES`, `RATE_LIMIT_CONFIG`)
- Type aliases exported directly from schema using `$inferSelect` / `$inferInsert` pattern

### Section Headers in Code
Large files use comment banners to visually separate sections:
```ts
// ============ SECTION NAME ============
```

## TypeScript Patterns

### Drizzle ORM Schema (`drizzle/schema.ts`)
- All tables defined with `mysqlTable()`
- Types derived from schema using `$inferSelect` and `$inferInsert`:
  ```ts
  export type User = typeof users.$inferSelect;
  export type InsertUser = typeof users.$inferInsert;
  ```
- Enums use `mysqlEnum()` inline (not separate enum definitions)
- Nullable fields use `.default(null)` or are left without `.notNull()`

### Drizzle Query Patterns (`server/db.ts`)
- Lazy singleton DB connection: `getDb()` returns null when `DATABASE_URL` is unset (graceful degradation)
- All DB functions are `async` and check for null DB before operating:
  ```ts
  const db = await getDb();
  if (!db) return undefined;
  ```
- TTL cache for hot data (vehicle list cached for 2 minutes)
- Upsert pattern: `db.insert(...).values(...).onDuplicateKeyUpdate({ set: ... })`
- Query operators imported from `drizzle-orm`: `eq`, `like`, `and`, `or`, `desc`, `asc`, `gte`, `lte`, `sql`, `inArray`

### tRPC Setup (`server/_core/trpc.ts`)
- Three procedure tiers:
  - `publicProcedure` — no auth required
  - `protectedProcedure` — any logged-in user
  - `adminProcedure` — role must be `"admin"`
- Auth enforced via middleware using `TRPCError` with codes `"UNAUTHORIZED"` or `"FORBIDDEN"`
- `superjson` transformer used for serialization (handles `Date`, `BigInt`, etc.)
- Context type: `TrpcContext` with `{ user: User | null, req, res }`

### tRPC Client (`client/src/lib/trpc.ts`)
- Single line: `createTRPCReact<AppRouter>()` typed against the server router
- Used in components as `trpc.vehicle.list.useQuery()`, `trpc.chat.send.useMutation()`, etc.

### Zod Validation
- Zod v4 (`"zod": "^4.1.12"`)
- Input validation on tRPC procedures via `.input(z.object({...}))`
- Schema defined inline within procedure handlers, not extracted to separate schema files

## React Component Patterns

### Component Definition
- Functional components exclusively, no class components
- Props typed inline as object literals in the function signature:
  ```tsx
  function VehicleCard({ vehicle, isComparing, onToggleCompare }: { vehicle: any; isComparing: boolean; onToggleCompare: () => void })
  ```
- Large presentational sub-components defined at the top of the same file as the page that uses them

### Hooks
- `useState`, `useMemo`, `useCallback`, `useEffect` from React
- `useLocation` from `wouter` for navigation
- Custom hooks in `client/src/_core/hooks/` and `client/src/lib/`
- `useCallback` used on event handlers passed to child components to avoid re-renders

### Data Fetching
- All server data via tRPC hooks wrapping TanStack Query
- Loading states handled with `<Skeleton>` components from `@/components/ui/skeleton`
- Errors surfaced via `sonner` toast notifications

### Routing
- `wouter` (not React Router) for client-side routing
- Route definitions in `client/src/App.tsx` using `<Switch>` and `<Route>`
- Admin routes wrapped in `<AdminLayout>` which renders `<DashboardLayout>`
- Code splitting: public routes eagerly imported, admin/secondary routes lazy-loaded with `React.lazy()`

### Styling
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- `cn()` utility from `client/src/lib/utils.ts` for conditional class merging (`clsx` + `tailwind-merge`)
- shadcn/ui component library with Radix UI primitives (`@/components/ui/*`)
- Lucide React for icons

## Error Handling Patterns

### Server
- DB errors are caught and re-thrown or logged with `console.error("[Database] ...")`
- Missing DB connection returns `undefined`/empty array (not thrown) in query functions
- Auth errors thrown as `TRPCError` with appropriate codes
- `try/catch` around session verification in `createContext()` — failure silently continues as unauthenticated
- Security events logged via `logSecurityEvent()` from `server/security.ts`

### Client
- `<ErrorBoundary>` component wraps the entire app in `App.tsx`
- Toast notifications via `sonner` for user-facing errors

## Security Patterns (`server/security.ts`)

- PII encrypted at rest using AES-256-GCM (`encryptPII` / `decryptPII`)
- PII masked in logs (`maskPhone`, `maskName`, `maskEmail`, `maskUserId`, `maskPIIInText`)
- Input sanitized via `sanitizeChatMessage()` and `sanitizeSearchQuery()` before DB writes or LLM calls
- LINE webhook signature verified via HMAC-SHA256 (`verifyLineWebhookSignature`)
- Rate limiting via `express-rate-limit` with per-endpoint configs in `RATE_LIMIT_CONFIG`
- Helmet for HTTP security headers
- Session IDs validated with regex to prevent injection (`isValidSessionId`)

## Import Aliases

Configured in both `tsconfig.json` and `vite.config.ts`:
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## Key Business Logic Locations

- **Intent detection**: `server/vehicleDetectionService.ts` (`detectCustomerIntents`, `buildIntentInstructions`)
- **Vehicle KB**: `server/vehicleDetectionService.ts` (`buildSmartVehicleKB`, `buildVehicleIndex`)
- **Lead scoring**: `server/routers.ts` (`LEAD_SCORE_RULES` — 8-dimension scoring model)
- **LLM invocation**: `server/_core/llm.ts` (`invokeLLM`)
- **LINE webhook handler**: `server/lineWebhook.ts` (`lineRouter`)
- **Flex message templates**: `server/lineFlexTemplates.ts`
- **8891 scraper/sync**: `server/sync8891.ts`
- **SEO injection**: `server/seo.ts` (server-side meta injection into `index.html`)
