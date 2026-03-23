# Lessons Learned

## Format: [date] | what went wrong | rule to prevent it

- [2026-03-16] | TypeScript TS2802 error using `for...of` on Map — tsconfig had no `target` set (defaults to ES3) | Always check tsconfig `target` before using ES6+ iteration; use `.forEach()` as safe fallback
- [2026-03-16] | Initial approach tried too many changes at once | Break optimizations into independent commits when possible for easier rollback
- [2026-03-23] | Ruflo npm package is `claude-flow`, NOT `@ruvnet/ruflo` as some guides state | Always verify npm package names with `npm view <pkg> version` before installing
- [2026-03-23] | `ruflo init --force` overwrites settings.json and CLAUDE.md entirely | Always backup/merge original project settings after running framework installers
