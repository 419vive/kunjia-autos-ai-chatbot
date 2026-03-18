# Structure

```
Claude-Code-Remote/
├── client/                       # React SPA frontend
│   ├── public/                   # Static assets (rich-menu-guide.png)
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   │   ├── ui/               # shadcn/Radix primitives (30+ components)
│   │   │   ├── SeoFooter.tsx     # SEO footer with internal links
│   │   │   └── VehicleCard.tsx   # Vehicle display card
│   │   ├── hooks/                # Custom React hooks (use-mobile, use-toast)
│   │   ├── lib/                  # Utilities (trpc client, utils, tracker)
│   │   ├── pages/                # Route pages
│   │   │   ├── Home.tsx          # Public homepage
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── ConversationView.tsx
│   │   │   ├── VehicleManagement.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   ├── BrandPage.tsx     # SEO brand landing
│   │   │   ├── PricePage.tsx     # SEO price landing
│   │   │   ├── BlogIndex.tsx     # Blog listing
│   │   │   ├── BlogPost.tsx      # Blog post view
│   │   │   └── FaqPage.tsx       # FAQ page
│   │   ├── data/
│   │   │   └── blogPosts.ts      # Blog content (5 Chinese articles)
│   │   ├── App.tsx               # Root routing
│   │   └── main.tsx              # React entry point
│   └── index.html                # SPA shell with meta tags
├── server/                       # Express + tRPC backend
│   ├── _core/                    # Core infrastructure
│   │   ├── sdk.ts                # JWT auth, session management
│   │   ├── llm.ts                # LLM invocation (Gemini)
│   │   ├── adminAuth.ts          # Admin login/seed
│   │   ├── oauth.ts              # OAuth flow (dormant)
│   │   ├── imageGeneration.ts    # Image gen stub
│   │   ├── voiceTranscription.ts # Voice transcription stub
│   │   └── map.ts                # Google Maps stub
│   ├── db.ts                     # All database queries, caching
│   ├── routers.ts                # tRPC router (50+ procedures)
│   ├── lineWebhook.ts            # LINE webhook handler
│   ├── lineFlexTemplates.ts      # LINE Flex Message builders
│   ├── lineRichMenu.ts           # Rich menu management
│   ├── dynamicPromptBuilder.ts   # AI prompt construction
│   ├── sync8891.ts               # Vehicle sync from 8891.com.tw
│   ├── seo.ts                    # SEO meta injection, sitemap, robots
│   ├── security.ts               # Encryption, sanitization, rate limiting
│   ├── trackingApi.ts            # Page view analytics
│   ├── vite.ts                   # Vite dev server integration
│   ├── storage.ts                # S3 storage stub
│   └── index.ts                  # Server entry point
├── drizzle/                      # Database
│   └── schema.ts                 # 9-table MySQL schema
├── shared/                       # Shared types/constants
│   └── consts.ts                 # Cookie name, shared constants
├── drizzle.config.ts             # Drizzle Kit configuration
├── tsconfig.json                 # TypeScript config
└── vite.config.ts                # Vite build config
```

## Naming Conventions
- **Files**: camelCase (`lineWebhook.ts`, `dynamicPromptBuilder.ts`)
- **Components**: PascalCase (`VehicleCard.tsx`, `SeoFooter.tsx`)
- **Pages**: PascalCase (`AdminDashboard.tsx`, `BrandPage.tsx`)
- **UI components**: kebab-case folders, PascalCase exports
- **Database tables**: camelCase in Drizzle, snake_case in MySQL
- **Routes**: lowercase with hyphens (`/brand/:brand`, `/price/:range`)
