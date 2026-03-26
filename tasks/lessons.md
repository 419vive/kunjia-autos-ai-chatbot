# Lessons Learned

## Format: [date] | what went wrong | rule to prevent it

- [2026-03-16] | TypeScript TS2802 error using `for...of` on Map — tsconfig had no `target` set (defaults to ES3) | Always check tsconfig `target` before using ES6+ iteration; use `.forEach()` as safe fallback
- [2026-03-16] | Initial approach tried too many changes at once | Break optimizations into independent commits when possible for easier rollback
- [2026-03-23] | Plugin skills (e.g. /claude-hud:setup) aren't available in the same session they're installed | After installing a Claude Code plugin, restart Claude Code before using its skills/commands
- [2026-03-23] | drizzle-orm/mysql2 expects mysql2 (non-promise) pool, not mysql2/promise pool — type mismatch | When using Drizzle with mysql2 connection pools, import from `mysql2` not `mysql2/promise`
- [2026-03-25] | 正則 `([\d.]+)萬` 不匹配 `37.8 萬`（有空格），導致 inquiry_button 偵測失敗、配對到錯車 | 任何匹配使用者可見文字的正則，都要用 `\s*` 容許空格；priceDisplay 是外部資料（8891），格式不可控
- [2026-03-25] | ruleBasedReply 回覆風格（emoji、\n\n、多段）與 LLM prompt 規則（一段話、不分段、不用markdown）不一致 | ruleBasedReply 的格式必須與 LLM prompt 規則對齊，避免兩套風格
- [2026-03-25] | 重複的 brand/model 匹配邏輯散落在 Layer 1 和 Layer 1b | 共用匹配邏輯應抽成 helper function（如 matchVehicleByName），避免改一處漏另一處
- [2026-03-25] | extractVehicleFromHistory 搜尋所有 role（含 bot）→ 舊 bot 回覆污染新查詢 | 歷史搜尋優先搜 user 訊息，bot 訊息只作 fallback
- [2026-03-25] | 預約意圖指令太 generic 不帶車輛名 → LLM 從歷史抓錯車 | 當 intent 和 vehicle 同時偵測到，intent 指令必須包含車輛上下文
- [2026-03-25] | LINE in-app browser 中 CSP scriptSrc:'self' 阻擋 Vite 動態 chunk → 頁面空白 | production CSP 需加 'unsafe-inline' 或 nonce 支援 Vite module preload
- [2026-03-26] | LINE Flex Message 的 URI 按鈕在 LINE in-app browser 開內部 SPA 頁面全部白屏 | LINE 聊天中的按鈕一律用 message 類型（在聊天室內回覆），不要用 URI 開內部頁面；URI 只用於 tel: 和外部連結
- [2026-03-26] | 說「已修復」但沒實際跑測試驗證 → 用戶不信任 | 修改後必須實際啟動 server + 瀏覽器驗證，不能只看 code 就說修好了
- [2026-03-26] | 用戶說「不需要再對話」= AI 完全不回覆（靜默），不是回一段客氣話 | 「不需要對話」指令要精確理解：可能是零回覆+靜默 handoff，不要自作主張加回覆
- [2026-03-26] | 網站整個白頁面，花大量時間查 CSP/URI 按鈕，結果是 ADMIN_PASSWORD env var 沒設 → server crash | 白頁面第一步：先確認 server 有沒有在跑（curl 回 200？），再查其他原因
