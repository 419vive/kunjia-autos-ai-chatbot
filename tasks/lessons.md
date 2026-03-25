# Lessons Learned

## Format: [date] | what went wrong | rule to prevent it

- [2026-03-16] | TypeScript TS2802 error using `for...of` on Map — tsconfig had no `target` set (defaults to ES3) | Always check tsconfig `target` before using ES6+ iteration; use `.forEach()` as safe fallback
- [2026-03-16] | Initial approach tried too many changes at once | Break optimizations into independent commits when possible for easier rollback
- [2026-03-23] | Plugin skills (e.g. /claude-hud:setup) aren't available in the same session they're installed | After installing a Claude Code plugin, restart Claude Code before using its skills/commands
- [2026-03-23] | drizzle-orm/mysql2 expects mysql2 (non-promise) pool, not mysql2/promise pool — type mismatch | When using Drizzle with mysql2 connection pools, import from `mysql2` not `mysql2/promise`
- [2026-03-25] | 正則 `([\d.]+)萬` 不匹配 `37.8 萬`（有空格），導致 inquiry_button 偵測失敗、配對到錯車 | 任何匹配使用者可見文字的正則，都要用 `\s*` 容許空格；priceDisplay 是外部資料（8891），格式不可控
- [2026-03-25] | ruleBasedReply 回覆風格（emoji、\n\n、多段）與 LLM prompt 規則（一段話、不分段、不用markdown）不一致 | ruleBasedReply 的格式必須與 LLM prompt 規則對齊，避免兩套風格
- [2026-03-25] | 重複的 brand/model 匹配邏輯散落在 Layer 1 和 Layer 1b | 共用匹配邏輯應抽成 helper function（如 matchVehicleByName），避免改一處漏另一處
