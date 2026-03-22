# Lessons Learned

## Format: [date] | what went wrong | rule to prevent it

- [2026-03-16] | TypeScript TS2802 error using `for...of` on Map — tsconfig had no `target` set (defaults to ES3) | Always check tsconfig `target` before using ES6+ iteration; use `.forEach()` as safe fallback
- [2026-03-16] | Initial approach tried too many changes at once | Break optimizations into independent commits when possible for easier rollback
- [2026-03-22] | When saving new research to long-term-memory.md, didn't check for existing overlapping entries | Before appending to memory files, scan existing content first and skip anything already covered. No duplication.
