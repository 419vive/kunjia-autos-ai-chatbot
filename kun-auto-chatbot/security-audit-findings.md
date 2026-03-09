# 崑家汽車 AI 客服系統 — 資安審計發現

## PII（個人可識別資訊）接觸點清單

### 1. 資料庫中的 PII 欄位（明文儲存）
| 資料表 | 欄位 | PII 類型 | 風險等級 |
|--------|------|----------|----------|
| users | name | 姓名 | 高 |
| users | email | 電子郵件 | 高 |
| users | openId | 身份識別碼 | 高 |
| conversations | customerName | 客戶姓名 | 高 |
| conversations | customerContact | 電話號碼 | 極高 |
| conversations | sessionId | 含 LINE userId | 高 |
| messages | content | 對話內容（可能含電話、地址等） | 極高 |

### 2. 日誌中的 PII 洩漏（console.log）
| 檔案 | 行號 | 洩漏內容 |
|------|------|----------|
| lineWebhook.ts | 171 | LINE userId + 完整訊息內容 |
| lineWebhook.ts | 197 | 客戶姓名 |
| lineWebhook.ts | 232 | 電話號碼 |
| lineWebhook.ts | 737 | 電話號碼 + recipientId |
| routers.ts | 292 | 電話號碼 |

### 3. 缺失的安全防護
| 防護項目 | 狀態 | 風險 |
|----------|------|------|
| HTTP Security Headers (Helmet) | ❌ 未安裝 | XSS, Clickjacking, MIME sniffing |
| Rate Limiting | ❌ 未設定 | DDoS, Brute Force, API Abuse |
| Input Sanitization | ❌ 未做 | XSS, SQL Injection |
| CSRF Protection | ❌ 未做 | Cross-Site Request Forgery |
| PII Encryption at Rest | ❌ 未做 | 資料庫洩漏時個資外洩 |
| PII Masking in Logs | ❌ 未做 | 日誌洩漏個資 |
| LINE Webhook Signature 驗證 | ⚠️ 僅警告不拒絕 | 偽造 webhook 攻擊 |
| SQL Injection via search | ⚠️ 用 Drizzle ORM 但有 LIKE 注入風險 | SQL Injection |
| Body Size Limit | ⚠️ 50MB 過大 | DoS 攻擊 |
| Admin 端點保護 | ✅ 有 adminProcedure | 但需驗證是否足夠 |

### 4. API 安全問題
- chat.send 端點是 publicProcedure，無 rate limiting
- chat.history 端點可以用任意 sessionId 查詢他人對話
- vehicle.search 的 LIKE 查詢可能有注入風險
- LINE webhook 簽名驗證失敗只是 console.warn，不拒絕請求

### 5. 推播通知中的 PII
- 推播給 owner 的通知包含客戶姓名、電話、對話摘要（明文）
- LINE Push Message 中包含完整個資
