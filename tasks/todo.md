# TODO

## Completed
- [x] Optimize LINE chatbot and website performance (6 optimizations)
- [x] Create CLAUDE.md with project rules
- [x] Add SESSION START workflow and task management to CLAUDE.md
- [x] Install Superpowers (obra/superpowers) - hooks, skills, commands, agents
- [x] Install Claude Mem (thedotmack/claude-mem) - persistent memory layer with worker service
- [x] Install UI UX Pro Max Skill (nextlevelbuilder/ui-ux-pro-max-skill) - design system skill
- [x] SEO Phase 3: Internal linking, SEO footer, FAQ page (/faq), cross-links on all pages
- [x] AEO Phase 1: HowTo schema, Speakable schema, Review schema, enhanced Article schema, concise FAQ answers
- [x] AEO Phase 2: AI crawler robots.txt, BLUF answer blocks, Service schema, entity graph @id, freshness signals, data-speakable frontend attrs
- [x] Agent Reach: Install, security audit, README update (6/15 channels active)
- [x] Install Stripe CLI v1.38.1 (GitHub binary)
- [x] Install GitHub CLI (gh) v2.88.1 (GitHub binary)
- [x] Install gws (Google Workspace CLI) v0.18.1 (Rust binary)
- [x] Install llmfit v0.8.4 (cargo install)
- [x] Install CLI-Anything (HKUDS/CLI-Anything) as project skill
- [x] Install MiroFish (666ghj/MiroFish) as git submodule + Python deps
- [x] Save tool knowledge to long-term memory
- [x] Update README with CLI tools section
- [x] World-class security audit (2026-03-23)
- [x] Install Go Viral Bitch (charlesdove977/goviralbitch) — 7 /viral:* commands, global symlinks
- [x] Install Everything Claude Code (affaan-m/everything-claude-code) — 48 agents, 64 skills, 68 commands, 13 rule sets
- [x] Install Supabase CLI v2.78.1 (deb package)

## Security Audit Findings (2026-03-23)
### Priority fixes:
- [ ] **CRITICAL:** Add CSRF protection (sameSite strict or double-submit cookie)
- [ ] **HIGH:** Update deps: @trpc/server >=11.8.0, pnpm >=10.27.0, @aws-sdk/client-s3
- [ ] **HIGH:** Separate PII encryption key from JWT_SECRET
- [ ] **HIGH:** Block prompt injection attempts, not just log them
- [ ] **MEDIUM:** Remove dev-only-secret JWT fallback
- [ ] **MEDIUM:** Persist security events to database

## Backlog (identified, not yet requested)
- [ ] Split lineWebhook.ts (1,476 lines) into smaller modules
- [ ] Split routers.ts (1,277 lines) into smaller modules
- [ ] Replace 170+ console statements with structured logging
- [ ] Configure database connection pooling
- [ ] Add API pagination for admin endpoints
- [ ] Remove unused KaTeX fonts from bundle
