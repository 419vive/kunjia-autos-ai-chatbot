# Concerns

## Critical

| Concern | File | Description |
|---------|------|-------------|
| No automated tests | — | Zero test coverage. Any change risks silent regression |

## High

| Concern | File | Description |
|---------|------|-------------|
| PII in logs | `server/lineWebhook.ts` | `console.log` may leak user messages to stdout |
| LLM prompt injection | `server/dynamicPromptBuilder.ts` | User messages inserted into prompts without sandboxing |
| Storage not functional | `server/storage.ts` | `storagePut`/`storageGet` throw — image gen broken |
| No database migrations | `drizzle/` | Schema push only, no migration files for rollbacks |

## Medium

| Concern | File | Description |
|---------|------|-------------|
| Hardcoded shop ID | `server/sync8891.ts` | 8891 shop ID `1726` hardcoded, not configurable |
| No error boundaries | `client/src/` | React error boundaries missing — errors crash SPA |
| Console.log in production | Multiple files | Debug logging throughout server code |
| Single admin user | `server/_core/adminAuth.ts` | One admin account, no RBAC |
| No CORS config | `server/index.ts` | CORS not explicitly configured |

## Low

| Concern | File | Description |
|---------|------|-------------|
| Unused OAuth flow | `server/_core/oauth.ts` | OAuth routes defined but never registered |
| Unused Forge services | `server/_core/` | Image gen, voice, maps stubs non-functional |
| Blog content hardcoded | `client/src/data/blogPosts.ts` | Blog posts in source, not CMS-managed |
| Rich menu image in repo | `client/public/` | Binary image committed to git |
