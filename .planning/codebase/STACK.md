# Technology Stack — kun-auto-chatbot

All source lives under `/home/user/Claude-Code-Remote/kun-auto-chatbot/`.

---

## Runtime & Language

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js (ESM modules) | `"type": "module"` |
| Language | TypeScript | 5.9.3 |
| Package manager | pnpm | 10.4.1 (lockfile), devDep ^10.15.1 |

---

## Backend

### Framework
- **Express** ^4.21.2 — HTTP server
- **tRPC** ^11.6.0 — type-safe API layer (`@trpc/server`, `@trpc/client`, `@trpc/react-query`)
  - Entry: `server/_core/trpc.ts`
  - Router: `server/routers.ts`
  - Context: `server/_core/context.ts`
  - Mounted at `/api/trpc` in `server/_core/index.ts`

### Server Entry Point
`server/_core/index.ts` — boots Express, wires all middleware and routers

### Dev vs Production serving
- **Development**: Vite dev server middleware via `server/_core/vite.ts`
- **Production**: Static files served from `dist/public/`
- Build command: `vite build && esbuild server/_core/index.ts ... && drizzle-kit push`
- Start command: `NODE_ENV=production node dist/index.js`
- Dev command: `NODE_ENV=development tsx watch server/_core/index.ts`

### Security Middleware (layered in `server/_core/index.ts`)
- **Helmet** ^8.1.0 — HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
- **express-rate-limit** ^8.2.1 — three limiters: general API, chat, LINE webhook
- Body size limits: 10 MB general, 1 MB LINE webhook (raw body preserved for signature verification)
- **xss-filters** ^1.2.7 — input sanitization (`server/security.ts`)

### Auth
- **JWT (jose)** 6.1.0 — HS256 session tokens stored in HTTP-only cookies
  - `server/_core/sdk.ts` — `SDKServer` class handles sign/verify/authenticate
- **Local admin auth** — `server/_core/adminAuth.ts`; `POST /api/auth/login` with timing-safe compare
- **OAuth flow** — `server/_core/oauth.ts`; `/api/oauth/callback` exchanges code via `OAUTH_SERVER_URL`
  - Supports: email, Google, Apple, Microsoft, GitHub (derived from platform field)
- Cookie name defined in `shared/const.ts`

---

## Database

| Item | Value |
|---|---|
| Engine | MySQL (dialect: `mysql`) |
| ORM | Drizzle ORM ^0.44.5 |
| Driver | mysql2 ^3.15.0 |
| Schema file | `drizzle/schema.ts` |
| Config file | `drizzle.config.ts` |
| Migration strategy | `drizzle-kit generate && drizzle-kit migrate`; also inline `runMigrations()` at server startup using raw `mysql2/promise` |
| Connection | `DATABASE_URL` env var (mysql:// connection string) |

### Tables (9 total, defined in `drizzle/schema.ts`)

| Table | Purpose |
|---|---|
| `users` | Auth users; `openId` as unique identifier, role enum (user/admin) |
| `vehicles` | Vehicle inventory synced from 8891.com.tw |
| `conversations` | Customer chat sessions; tracks channel, lead score, lead status |
| `messages` | Individual messages within conversations |
| `leadEvents` | Audit log of lead scoring events |
| `analyticsEvents` | LINE behavioral events (follow, rich menu clicks, quick replies) |
| `pageViews` | Website page view analytics (privacy-friendly, no cookies) |
| `loanInquiries` | Loan application form submissions |
| `appointments` | Vehicle viewing appointment bookings |

---

## Frontend

### Framework & Routing
- **React** ^19.2.1 (`react-dom` ^19.2.1)
- **Wouter** ^3.3.5 — client-side routing (patched: `patches/wouter@3.7.1.patch`)
- **Vite** ^7.1.7 — bundler; root at `client/`, output to `dist/public/`

### State Management & Data Fetching
- **TanStack Query** ^5.90.2 — server state management
- **tRPC React** ^11.6.0 — type-safe queries/mutations

### UI Library
- **Radix UI** — comprehensive headless component set (20+ packages, all ^1.x-^2.x)
- **shadcn/ui** pattern (components in `client/src/components/ui/`)
- **Tailwind CSS** ^4.1.14 via `@tailwindcss/vite` ^4.1.3
- **Lucide React** ^0.453.0 — icons
- **Framer Motion** ^12.23.22 — animations
- **next-themes** ^0.4.6 — dark/light mode
- **Recharts** ^2.15.2 — analytics charts (admin dashboard)
- **Embla Carousel** ^8.6.0
- **Sonner** ^2.0.7 — toast notifications
- **cmdk** ^1.1.1 — command palette
- **vaul** ^1.1.2 — drawer component
- **input-otp** ^1.4.2
- **react-day-picker** ^9.11.1
- **react-resizable-panels** ^3.0.6
- **streamdown** ^1.4.0 — markdown streaming renderer

### Forms & Validation
- **React Hook Form** ^7.64.0
- **@hookform/resolvers** ^5.2.2
- **Zod** ^4.1.12

### Utilities
- **date-fns** ^4.1.0
- **clsx** ^2.1.1 + **tailwind-merge** ^3.3.1 + **class-variance-authority** ^0.7.1
- **nanoid** ^5.1.5
- **superjson** ^2.x (via tRPC transformer)
- **axios** ^1.12.0 (server-side HTTP client)
- **cheerio** ^1.2.0 — HTML parsing (vehicle scraping fallback)

### Client Pages (in `client/src/pages/`)
Public: `Home`, `Chat`, `VehicleLanding`, `LoanInquiry`, `BookVisit`, `BrandPage`, `PricePage`, `BlogIndex`, `BlogPost`, `FaqPage`, `SmartRedirect`
Admin: `AdminLogin`, `Dashboard`, `Conversations`, `VehicleManagement`, `LineSetup`, `Analytics`, `LoanInquiries`, `Appointments`

---

## Build & Dev Tooling

| Tool | Version | Purpose |
|---|---|---|
| Vite | ^7.1.7 | Frontend bundler |
| esbuild | ^0.25.0 | Server bundle for production |
| tsx | ^4.19.1 | Dev server TypeScript execution |
| drizzle-kit | ^0.31.4 | DB migrations/push |
| Prettier | ^3.6.2 | Code formatting |
| Vitest | ^2.1.4 | Unit tests (`server/**/*.test.ts`) |
| TypeScript | 5.9.3 | Type checking (`tsc --noEmit`) |
| `@builder.io/vite-plugin-jsx-loc` | ^0.1.1 | JSX source location plugin |
| PostCSS + Autoprefixer | ^8.4.47 / ^10.4.20 | CSS processing |
| `@tailwindcss/typography` | ^0.5.15 | Prose styling for blog |

### Path Aliases (shared between Vite and tsconfig)
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

---

## Deployment Target

- **Railway** — inferred from `app.set("trust proxy", 1)` comment and `RAILWAY_PUBLIC_DOMAIN` env var read in `server/seo.ts`
- Port: reads `PORT` env var, defaults to 3000, auto-increments if busy
- Domain: `BASE_URL` or `RAILWAY_PUBLIC_DOMAIN`, falls back to `https://kuncar.tw`

---

## Environment Variables (from `kun-auto-chatbot/.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `GOOGLE_AI_API_KEY` | Yes | Gemini 2.5 Flash LLM |
| `LINE_CHANNEL_SECRET` | Yes | LINE webhook HMAC verification |
| `LINE_CHANNEL_ACCESS_TOKEN` | Yes | LINE Messaging API calls |
| `JWT_SECRET` | Yes (prod) | Session cookie signing |
| `ADMIN_PASSWORD` | Yes (prod) | Local admin login |
| `LINE_OWNER_USER_ID` | Optional | Owner LINE UID for push notifications |
| `LINE_ADDITIONAL_NOTIFY_USER_IDS` | Optional | Comma-separated additional notify UIDs |
| `FORCE_RULE_BASED_REPLY` | Optional | `1` skips LLM, uses pattern matching |
| `ADMIN_USERNAME` | Optional | Admin username (default: `admin`) |
| `OAUTH_SERVER_URL` | Optional | Manus OAuth server URL |
| `FORGE_API_URL` | Optional | Manus Forge API (image gen, voice, maps proxy) |
| `FORGE_API_KEY` | Optional | Manus Forge API key |
| `VITE_OAUTH_PORTAL_URL` | Optional | Frontend OAuth portal URL |
| `VITE_APP_ID` | Optional | App ID for OAuth flow |
| `VITE_FRONTEND_FORGE_API_KEY` | Optional | Frontend Google Maps proxy key |
| `VITE_FRONTEND_FORGE_API_URL` | Optional | Frontend Google Maps proxy URL |
