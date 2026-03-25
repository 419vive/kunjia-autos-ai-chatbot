# Lessons Learned

## Format: [date] | what went wrong | rule to prevent it

- [2026-03-16] | TypeScript TS2802 error using `for...of` on Map — tsconfig had no `target` set (defaults to ES3) | Always check tsconfig `target` before using ES6+ iteration; use `.forEach()` as safe fallback
- [2026-03-16] | Initial approach tried too many changes at once | Break optimizations into independent commits when possible for easier rollback
- [2026-03-23] | Plugin skills (e.g. /claude-hud:setup) aren't available in the same session they're installed | After installing a Claude Code plugin, restart Claude Code before using its skills/commands
- [2026-03-23] | drizzle-orm/mysql2 expects mysql2 (non-promise) pool, not mysql2/promise pool — type mismatch | When using Drizzle with mysql2 connection pools, import from `mysql2` not `mysql2/promise`
