# 崑家汽車 AI 智能客服系統 TODO

## Database & Backend
- [x] Design database schema (vehicles, conversations, messages, leads)
- [x] Import 12 vehicles data from 8891 scrape
- [x] Vehicle CRUD API endpoints
- [x] Vehicle search/filter API (brand, price, year, mileage)
- [x] Conversation management API
- [x] Lead scoring API

## AI Chatbot
- [x] LLM-powered chatbot with vehicle knowledge base
- [x] Natural language vehicle search (brand, price, equipment, availability)
- [x] Conversation context management
- [x] Auto lead scoring from conversation content

## Lead Management
- [x] Lead scoring algorithm (vehicle inquiry, budget, timeline indicators)
- [x] Quality lead threshold detection
- [x] Owner notification integration (notifyOwner for high-quality leads)
- [x] LINE push notification setup (via notifyOwner + LINE integration guide)

## Multi-Channel Integration
- [x] Unified message management backend
- [x] Channel source tracking (YouTube, Facebook, LINE, web)
- [x] Channel-specific conversation views with filters

## Frontend - Public
- [x] Home page with vehicle gallery, search, and filters
- [x] Chat interface for customers (AIChatBox integration)
- [x] Vehicle search through chatbot
- [x] Floating chat button on homepage

## Frontend - Admin Dashboard
- [x] Dashboard with key metrics (total inquiries, quality leads, popular vehicles)
- [x] Conversation history with search/filter/tags
- [x] Lead list with scoring details and status management
- [x] Vehicle inventory management view with status control
- [x] Conversation detail view with message history and lead events

## Testing
- [x] Backend API tests (14 tests passing)
- [x] Chat flow tests
- [x] Admin auth tests

## Bug Fixes
- [x] Fix vehicle photos not displaying on homepage

## Enhancement - AI客服升級
- [x] Research world-class used car negotiation masters' techniques
- [x] Upgrade AI chatbot persona to 高雄在地老江湖 style with 20-year experience
- [x] Incorporate professional negotiation tactics into system prompt
- [x] Improve lead qualification conversation flow with warmth and local flavor

## LINE Official Account Integration
- [x] Create LINE Official Account "崑家汽車-高雄阿家" (@825oftez)
- [x] Enable Messaging API
- [x] Obtain Channel ID, Channel Secret, Channel Access Token
- [x] Set LINE secrets in web app environment
- [x] Enable chat mode in LINE OA Manager
- [x] Set response mode to manual chat (disable built-in auto-reply)
- [x] LINE API key validation tests (16 tests passing)
- [ ] Set Webhook URL after publishing (requires published domain)
- [ ] Test LINE webhook end-to-end with real LINE messages
- [ ] Add father as LINE OA admin for manual takeover

## UI Changes
- [x] Change "AI 智能諮詢" button text to "高雄阿家24小時貼心諮詢"
- [x] Set Webhook URL to https://kunchatbot-yqvyvfb6.manus.space/api/line/webhook in LINE Developers Console
- [x] Enable Webhook in LINE Developers Console
- [x] Verify Webhook connection

## Bug Fixes - LINE
- [x] Fix LINE webhook receiving messages but not auto-replying (route path mismatch + rawBody for signature)
- [x] Debug: LINE still not auto-replying after route fix - fixed route path mismatch
- [x] Rename all 阿崑 to 高雄阿家 across entire codebase
- [x] Upgrade Lead scoring to 8 dimensions (BANT + SPIN + Sandler + Voss + Girard + Cardone + Kintz + Ziglar)
- [x] Clean database: replace all 阿崑 with 高雄阿家 in historical message records (11 messages updated)

## 8891 Auto-Sync Feature
- [x] Build server-side 8891 scraper that fetches latest vehicle listings (pure Node.js fetch)
- [x] Create sync logic: add new vehicles, update changed vehicles, mark removed vehicles as sold
- [x] Add scheduled recurring sync job (every 6 hours)
- [x] Add admin UI showing sync status, last sync time, and manual sync trigger button
- [x] Write tests for sync functionality (21 tests passing)
- [x] Test end-to-end sync with live 8891 data (12 vehicles successfully synced)
- [x] Rewrite sync to pure Node.js (no Python/Playwright dependency) for deployment compatibility
- [x] Verify full sync chain: 8891 崑家汽車 → DB → Website → AI chatbot
- [x] Use correct 8891 URL (m.8891.com.tw/shop?id=1726) for sync
- [x] Chain of verification: cross-reference 8891 source → DB → website → AI chatbot

## Quality Leads LINE Push Notification
- [x] Set LINE_OWNER_USER_ID env for father (賴崑家: U5591c54539693c8b5d815e179e6f300d)
- [x] Verify LINE_OWNER_USER_ID test passes (22 tests all passing)
- [x] Replace all '少年仔' with '人客' in AI chatbot prompts and database records

## Advanced Sales Psychology Integration
- [x] Research Tony Robbins NLP techniques for sales
- [x] Research hypnotic sales language patterns (Milton Model, embedded commands)
- [x] Research Joe Vitale, Kevin Hogan, Marshall Sylver, Ross Jeffries, Paul McKenna techniques
- [x] Research negotiation psychology (Cialdini, Kahneman, Voss)
- [x] Research human sales psychology and behavioral economics
- [x] Synthesize all research into enhanced system prompt (casual Taiwanese Chinese)
- [x] Update both web and LINE chatbot prompts (22 tests passing)

## Bug Fix - AI 回覆牛頭不對馬嘴
- [x] Debug: customer says "我想要看車，在嘛？老闆" but AI replies about QR Code (irrelevant)
- [x] Chain of verification: check conversation history, message flow, and LLM context
- [x] Root cause: conversation history pollution - old QR Code responses polluting LLM context
- [x] Fix: limit history to last 10 messages, add "重要規則" to system prompt
- [x] Clean corrupted conversation history (conv 30005 - Jerry Lai)
- [x] Upgrade LINE webhook lead scoring to 8 dimensions (matching web chatbot)
- [x] Add 20 new tests for LINE webhook logic (42 tests total, all passing)

## LINE Rich Menu 圖文選單
- [x] Research LINE Rich Menu API (create, upload image, set default)
- [x] Design Rich Menu layout (6 buttons: 看車庫存, 預約賞車, 聯絡我們, 熱門推薦, 50萬以下, 阿家智能客服)
- [x] Generate professional Rich Menu image (2500x1686, AI-generated + resized)
- [x] Build server-side lineRichMenu.ts module (create, upload, deploy, status)
- [x] Add admin tRPC endpoints (richMenuStatus, deployRichMenu, removeRichMenu)
- [x] Update LineSetup.tsx with Rich Menu management UI and preview
- [x] Write 16 vitest tests for Rich Menu layout and actions
- [x] Change "AI智能客服" to "阿家智能客服" in Rich Menu
- [x] All 58 tests passing (6 test files)

## LINE Rich Menu Flex Message 互動內容
- [x] Research LINE Flex Message and Carousel format
- [x] Build Flex Message template: 看車庫存 → vehicle carousel cards with photos
- [x] Build Flex Message template: 預約賞車 → appointment booking card with time slots
- [x] Build Flex Message template: 熱門推薦 → popular vehicles carousel (sorted by price desc)
- [x] Build Flex Message template: 50萬以下 → budget filtered vehicle carousel (sorted by price asc)
- [x] Build Flex Message template: 阿家智能客服 → welcome card with quick actions
- [x] Update lineWebhook.ts to detect Rich Menu trigger messages (exact match)
- [x] Respond with Flex Messages instead of plain text for Rich Menu triggers
- [x] Write 25 tests for Flex Message generation
- [x] All 83 tests passing (7 test files)

## Chain of Verification - Flex Message Bug Fix
- [x] CoV Step 1: Trigger detection - all 5 buttons detected correctly, no false positives
- [x] CoV Step 2: Vehicle data - 12 vehicles loaded, 6 under 50萬
- [x] CoV Step 3: Found critical bug - photoUrls is pipe-separated not JSON, causing JSON.parse crash
- [x] Fix: Smart photoUrls parsing (pipe-separated | JSON array | single URL | fallback)
- [x] CoV Step 4: LINE API credentials verified (Bot: 崑家汽車-高雄阿家)
- [x] CoV Step 5: Published webhook endpoint reachable (HTTP 200)
- [x] CoV Step 6: LINE Webhook URL correctly configured and active
- [x] Re-run CoV: 38/39 passed, all Flex Messages generate correctly with real vehicle photos
- [x] All 83 tests passing (7 test files)

## Quality Lead 電話追蹤 + 推播升級
- [x] Use existing customerContact field (no schema change needed)
- [x] Auto-detect Taiwan phone numbers from chat messages (mobile 09xx + landline 0x)
- [x] Normalize phone to 09xx-xxx-xxx format and save to customerContact
- [x] Update AI system prompt: ask for phone when lead score >= 40
- [x] Upgrade LINE owner push notification to Flex Message card
- [x] Flex Message: show "📞 撥打 [phone]" call button if phone available
- [x] Flex Message: show "💬 到LINE聊天室回覆客戶" button if no phone
- [x] Also update web chatbot (routers.ts) with phone detection + improved notification
- [x] Write 20 phone detection tests (103 total tests, 8 test files, all passing)

## Bug Fix - 高品質客戶推播未觸發
- [x] Debug: 80萬預算客戶沒有觸發 quality lead 推播通知
- [x] Check lead score threshold - 降低門檻從 60 到 50，新增「具體預算金額」加分規則 (+15分)
- [x] Ensure AI actively asks for phone number for high-quality leads
- [x] Ensure 賴先生 + Megan 都收到 push notification for quality leads

## Bug Fix - 高品質客戶推播只觸發一次
- [x] Fix: notifiedOwner changed from boolean to milestone level (0/1/2/3/4)
- [x] Implement milestone-based re-notification (score 60/80/120/180)
- [x] Different urgency levels: 🔥高品質潛客(60) / ⚡高度意願(120) / 🚨超級熱客(180)
- [x] Notify immediately when phone number detected (score >= 40)
- [x] Pass phoneJustDetected to both Rich Menu and LLM paths
- [x] Reset 呂紅虹 notifiedOwner=0 for re-testing
- [x] All 103 tests passing (8 test files)

## Bug Fix - 8891 車輛同步未連動更新
- [ ] Diagnose: check current sync logic (insert only vs upsert)
- [ ] Fix: when 8891 vehicle data changes (price, photos, specs), update existing DB records
- [ ] Fix: mark vehicles as sold/removed when no longer on 8891
- [ ] Ensure LINE Flex Messages use latest vehicle data
- [ ] Run manual sync and verify all vehicles are up-to-date
- [ ] Write tests for update sync logic

## Bug Fix - LINE AI客服少顯示車輛
- [x] Bug: LINE AI客服只顯示10台車，少了福斯Tiguan和Toyota Vios（資料庫有12台）
- [x] 調查 AI 客服查詢車輛的邏輯，找出為何遺漏（原因：Flex carousel slice(0,10) 截掉最後2台）
- [x] 修復車輛查詢確保所有 available 車輛都被 AI 參考（改為 slice(0,12)）
- [x] Fix 8891 sync to discover ALL vehicles (upgraded to v5 API, returns all 12 vehicles)

## 每週自動同步 + Chain of Verification 驗證機制
- [x] 修復 8891 sync 抓取所有車輛（改用 v5 items/search API，一次返回全部車輛）
- [x] 發現 8891 v5 items/search API endpoint（比 HTML scraping 更可靠）
- [x] 建立 Chain of Verification (CoV) 驗證系統
- [x] CoV Step 1: 8891 來源驗證 - API 12 台 = onSaleCount 12 台 ✅
- [x] CoV Step 2: DB 完整性驗證 - 12 台全部在資料庫 ✅
- [x] CoV Step 3: LINE Flex Message 驗證 - 12 台全部可顯示 ✅
- [x] CoV Step 4: AI 知識庫驗證 - 12 台全部有完整品牌和價格 ✅
- [x] CoV Step 5: 資料一致性驗證 - 所有價格一致 ✅
- [x] 設置每週一早上 9 點定時排程執行同步 + CoV
- [x] 同步結果 + CoV 報告推播通知老闆
- [x] 寫測試驗證整個 pipeline（109 tests, 8 files, all passing）

## 智能導流頁面（桌機 vs 手機）
- [x] 建立 /line 和 /contact 智能導流頁面
- [x] 手機用戶：自動導向 LINE 官方帳號 (page.line.me/825oftez)
- [x] 桌機用戶：自動導向崑家汽車 AI 客服網站聊天頁面
- [x] 導流頁面要有品牌視覺（崑家汽車 logo + 載入動畫）
- [x] 如果自動導流失敗，顯示手動選擇按鈕（LINE / 網站客服）
- [x] 測試桌機和手機兩種情境

## Bug Fix - 桌機導流仍卡在 LINE QR Code 頁面
- [ ] 問題：桌機用戶點 page.line.me/825oftez 連結仍看到 LINE QR Code，沒有被導向網站客服
- [ ] 調查：確認 /line 頁面是否正常運作，還是用戶直接點的是 LINE 原始連結
- [ ] 修復：確保桌機用戶無論從哪個入口都能被導向網站 AI 客服

## Bug Fix - /line 路由在正式環境 404
- [ ] 問題：kunchatbot-yqvyvfb6.manus.space/line 顯示 404
- [ ] 調查：SPA 前端路由在正式環境可能需要 server-side fallback
- [ ] 修復：確保 server 端對所有前端路由返回 index.html
- [x] 修改 /line 導流頁面：桌機用戶導向網站首頁 (/) 而非 AI 客服 (/chat)
- [x] 聊天頁面快速問題按鈕顏色更豐富漂亮（藍/綠/橙/紫 4色漸層圓形按鈕）
- [x] 首頁右下角聊天按鈕旁加文字提示「人客二手車諮詢發問（點這個）」+ 動畫效果

## 多平台 AI 自動回覆系統
- [ ] 研究 Facebook Page API 自動回覆留言能力
- [ ] 研究 YouTube Data API 自動回覆留言能力
- [ ] 研究 TikTok API 自動回覆留言能力
- [ ] 研究 8891 平台留言回覆能力
- [ ] 設計多平台 AI 自動回覆架構
- [ ] 實作可行平台的自動回覆功能
- [ ] 建立多平台留言監控儀表板
- [ ] 測試各平台自動回覆功能

## AI 客服性別稱呼
- [x] LINE 客服：根據名字推測性別，男→大哥、女→小姐、不明→人客
- [x] 網站客服：預設用「人客」，對話中透露性別則動態調整
- [x] 更新 AI system prompt 加入性別稱呼指示（LINE + 網站兩邊都已更新）
- [x] 新增 detectGenderFromName 函數（中文名字性別推測）
- [x] 新增 9 個性別偵測測試（118 tests total, all passing）

## 車輛多照片瀏覽功能
- [ ] 調查 8891 車輛詳情頁的所有照片 URL 結構
- [ ] 更新 sync 系統抓取每台車的所有照片（不只第一張）
- [ ] 更新資料庫 schema 支援多張照片儲存
- [ ] 首頁車輛卡片加入照片輪播（左右滑動）
- [ ] 車輛詳情頁顯示完整照片 gallery
- [ ] 測試完整流程

## 推播通知新增收件人
- [x] 新增 @Immegg (Megan) 為高品質顧客推播通知的收件人 (LINE User ID: U1587445f622aeb76945e88bbb195ff39)
- [x] 設定 LINE_ADDITIONAL_NOTIFY_USER_IDS 環境變數
- [x] LINE 推播同時發送給 owner + 所有額外收件人
- [x] 網站客服推播也同步發送給所有收件人
- [x] 5 個新測試驗證收件人邏輯，123 tests all passing

## AI 客服回電時段確認機制
- [x] 拿到客戶電話後，AI 主動提供明天/後天/大後天三個時段讓客戶選擇回電時間
- [x] 更新 LINE AI 客服 system prompt 加入回電時段確認邏輯
- [x] 更新網站 AI 客服 system prompt 加入回電時段確認邏輯
- [x] 新增 timeSlotHelper.ts 工具函數，自動產生明天/後天/大後天三天時段（跳過週日）
- [x] 新增 8 個 timeSlot 測試，全部 131 tests passing (11 test files)

## 回電時段改為只提供隔天
- [x] 從三天改為只提供隔天一天的三個時段（上午/下午/晚上）
- [x] 用來篩選高成交意願客戶：願意明天接電話 = 高意願
- [x] 更新 timeSlotHelper、LINE prompt、網站 prompt
- [x] 更新 10 個測試，全部 133 tests passing (11 test files)

## 回電時段調整為精確一小時
- [x] ① 上午 10:30-11:30  ② 下午 2:00-3:00  ③ 晚上 6:00-7:00
- [x] 更新 timeSlotHelper、測試，133 tests passing

## 確認時段時必須使用最新時段
- [x] AI 確認客戶選擇的時段時，必須使用 system prompt 提供的最新時段，不要從對話歷史複製舊時段
- [x] 更新 LINE + 網站 AI 客服 prompt，明確列出①②③對應的確認回覆，133 tests passing

## 車輛多張照片 + 圖片輪播
- [x] 從 8891 同步時抓取每台車的所有照片（改用 big 高品質大圖，每台 15-20 張）
- [x] photoUrls 欄位已存入多張照片 URL（用 | 分隔）
- [x] 前端車輛卡片加入圖片輪播功能（左右箭頭 + 觸控滑動 + 圓點指示器 + 照片數量 badge）
- [x] 12 台車全部更新完成，133 tests passing

## 圖片輪播箭頭改善
- [x] 左右箭頭永遠顯示（不只 hover 時）
- [x] 加大箭頭按鈕 (h-9 w-9) 讓它更容易點擊

## 網站 Logo 更新
- [x] 使用 CSS mix-blend-mode: screen 讓黑色背景融入藍色 hero 區域
- [x] 上傳 logo 到 S3 CDN 並替換原本的 Car icon + 文字
- [x] Logo 尺寸 h-28 (mobile) / h-36 (desktop)，133 tests passing

## Logo 尺寸和排版調整
- [x] Logo 置中放大 (h-32/sm:h-44/md:h-52)，按鈕移到右上角，資訊在 logo 下方置中

## Logo 再次放大
- [x] Logo 最大化 (h-40/sm:h-56/md:h-64)，不壓到按鈕和下方文字

## Hero 背景改為純色
- [x] 移除斜線紋理，改為純色深藍灰色背景 #303d4e（從 IMG_2256.JPG 精確取樣）

## 資安防護系統 (Security & Privacy Protection)
- [x] Phase 1: 全面審計所有個資接觸點（PII Audit）
- [x] Phase 2: 研究世界級資安最佳實務（OWASP, NIST, ISO 27001, GDPR/台灣個資法）
- [x] Phase 3: 伺服器端安全強化（Rate Limiting, Input Sanitization, XSS/CSRF/Injection 防護）
- [x] Phase 4: 個資加密與資料遮罩（PII Encryption & Data Masking）
- [x] Phase 5: API 安全（認證、授權、密鑰管理）
- [x] Phase 6: 安全日誌與稽核軌跡（Security Logging & Audit Trail）
- [x] Phase 7: 資安測試（Security Tests）— 63 個測試全過
- [x] Phase 8: Chain of Verification 驗證所有防護機制— 38 個 CoV 測試全過
- [x] Phase 9: 產出資安稽核報告

## 內容修改
- [x] 將所有「20年」改為「40年老口碑」（LLM system prompt、LINE webhook prompt、前端文案）

## Hero 區域改為 LINE 導流
- [x] 將 Hero 的「📞 0936-812-818 賴先生」改為 LINE 官方帳號 @825oftez + LINE 圖示 + QR Code
- [x] 上傳 QR Code 到 S3
- [x] 鼓勵手機掃 QR 加賴直接問車
- [x] 重新設計 Hero LINE 區塊：QR Code 移到左邊，改為水平簡潔排版
- [x] Hero 改為左右並排：左邊 LINE QR+加賴資訊，右邊品牌 Logo+「台灣南部在地40年老口碑正派經營」
- [x] 專業美化 Hero 視覺設計：Logo 居中突出、LINE QR 精緻小巧、標語層次分明
- [x] 加入「歡迎攜帶驗車師傅隨同現場驗車」文案
- [x] Hero 改為扁長橫幅設計：大幅壓縮藍色區域高度，所有元素水平排列
- [x] 放大中間 Logo 讓人更清楚看到品牌標誌
- [x] Logo 再放大 20%
- [x] 移除右上角「高雄阿家24小時貼心諮詢」按鈕
- [x] 右下角聊天按鈕改為在首頁彈出聊天視窗（不跳轉到 /chat 頁面）
- [x] 修正 AI 客服 system prompt 加入正確農曆年份（2025年=蛇年、2026年=馬年、2027年=羊年）
- [x] 修正聊天彈出視窗：快速選項按鈕被截斷看不到，調整高度和排版
- [x] 聊天視窗標題改為「崑家汽車在線貼心諮詢」，移除「24小時線上為您服務」
- [x] 修正聊天彈出視窗無法往下滾動看完整 AI 回覆的問題
- [x] 修正聊天彈出視窗 AI 回覆後輸入框消失的問題，讓客人可以繼續一來一往對話
- [x] 聊了幾輪後自動顯示 LINE 官方帳號 CTA 引導加賴（更詳盡的專人諮詢為您服務）
- [x] 更新 AI 客服 system prompt 中的 LINE ID：從 lai0936812818 改為 @825oftez（官方帳號）
- [x] 聊天視窗快速選項加入第四個按鈕「加賴直接聊」，點擊直接跳轉 LINE 官方帳號 @825oftez
- [x] 修正第四個「加賴直接聊」按鈕被輸入框擋住的問題，確保 4 個按鈕都完整顯示
- [x] 瀏覽器分頁標題從「崑家汽車 AI 智能客服系統」改為「崑家汽車貼心在線諮詢」
- [x] 修正 AI 客服 system prompt 中的地址：改為「高雄市三民區大順二路269號（肯德基斜對面）」
- [x] AI 回答地址時附上 Google Maps 連結
- [x] 首頁 Hero 區域地址從「高雄市」改為完整地址「高雄市三民區大順二路269號」
- [x] 修正 AI 回電時段邏輯：客人選了特定時段（如平日下午）後，回電時段應在該時段內細分3個區間，而非固定的上午/下午/晚上
- [x] Hero 地址加上 Google Maps 連結，點擊直接開啟導航
- [x] LINE Rich Menu 加入「導航到店」按鈕，一鍵開 Google Maps 導航
- [x] 加強 AI prompt 時段邏輯：客人說「平日下午」時，回電時段必須全部在下午（如 13:00-14:00, 14:00-15:00, 15:00-16:00），不能出現上午或晚上
- [x] 更新 Rich Menu 圖片：右下角按鈕文字從「阿家智能客服」改為「導航到店」
- [x] Chain of Verification 全面稽查 AI 時段邏輯：檢查所有可能的預約場景，修正所有不符合邏輯的回覆
- [x] AI 給完時段選項後要順便請客人留電話號碼，方便業務進一步服務
- [x] 重新部署 Rich Menu 圖片（導航到店）到 LINE
- [x] 每台車卡片加「LINE 問這台車」按鈕，點擊直接開啟 LINE 帶入車輛資訊一鍵詢問

## Bug Fix - Rich Menu 消失
- [x] 診斷 Rich Menu 為何消失（原因：舊 menu 圖片遺失，未設為預設）
- [x] 重新部署 Rich Menu 到 LINE 官方帳號（richmenu-98b77dedbd60255a3c5e04d32df94990）
- [ ] 驗證 Rich Menu 在手機上正常顯示（請用戶確認）

## Rich Menu 圖片比例修正
- [x] 「導航到店」按鈕的圖示和字體放大，與其他5個按鈕比例一致
- [x] 重新上傳圖片並部署到 LINE

## LINE 車輛卡片顯示 8891 所有照片
- [x] 調查目前車輛資料結構，確認已有多張照片 URL（每台車約 20 張）
- [x] 8891 同步已會抓取所有照片 URL，無需更新
- [x] 更新 LINE Flex Message 模板，讓客人可以瀏覽所有照片
- [x] 測試驗證（256 個測試全通過）
- [x] 車輛卡片突破 12 台限制，用多則訊息顯示所有庫存（最多 20 台）
- [x] 每台車加「📸 看所有照片」按鈕，點擊後發送照片輪播
- [x] 新增照片輪播觸發偵測和回應邏輯

## LINE 車輛卡片按鈕調整
- [x] LINE 車輛卡片加入綠色「LINE 問這台車」按鈕，帶入車輛資訊
- [x] 照片輪播底部拿掉「在8891查看」按鈕

## 車輛「已售」標記與自動下架
- [x] 確認 8891 同步已自動將下架車輛標記為 sold（sync8891.ts L583-596）
- [x] LINE 庫存卡片只顯示 status=available（lineFlexTemplates.ts L648）
- [x] 網站已過濾只顯示 available（db.ts getAllVehicles）
- [x] 網站卡片已有狀態 Badge（在售/已預訂/已售出）

## AI 回應邏輯修正 — 精準回應指定車款
- [x] 研究二手車業務實戰銷售技巧
- [x] 分析目前 AI system prompt 和回應邏輯
- [x] 修正：客人問特定車款時，必須先回應該車的賣點和車況
- [x] 修正：不要亂推薦不相關的車款
- [x] 用專業二手車業務的方式重寫 system prompt（網站+LINE 兩個 prompt 都已更新）
- [x] 測試驗證（256 個測試全通過）

## AI 回應邏輯修正 v2 — 仍然忽略客人指定車款
- [x] 深入檢查 LINE webhook 的 prompt：vehicleKB 資料太簡略，規則放在最後被忽略
- [x] 加入車款偵測邏輯：在呼叫 LLM 前就找到對應車輛，把完整資料注入 prompt 開頭
- [x] 豐富 vehicleKB：加入排氣量、變速箱、配備、描述等完整資料
- [x] 「精準回應」規則移到 prompt 最前面（緊接在風格設定之後）
- [x] 同步更新網站端 (routers.ts) 的相同邏輯
- [x] 規格資料嚴格依照 8891 同步資料，不編造
- [x] 測試驗證（256 個測試全通過）

## AI 回應邏輯修正 v3 — Chain of Verification 徹底驗證
- [x] CoV Step 1: 確認正式環境尚未 Publish 最新版本（用戶看到的是舊版本）
- [x] CoV Step 2: 追蹤完整流程：訊息接收 → regex 偵測 → DB 查詢 → prompt 注入 → LLM 呼叫
- [x] CoV Step 3: regex 可以匹配實際訊息格式（\s* 吸收換行符）
- [x] CoV Step 4: 12 台車全部匹配成功（CoV 測試通過）
- [x] CoV Step 5: 加入三層防線 + 最高優先規則 + logging（278 個測試全通過）

## AI 回應邏輯修正 v4 — Chain of Verification 徹底追蹤
- [x] CoV Step 1: 確認偵測邏輯本身正確（18 個偵測測試全通過）
- [x] CoV Step 2: 逐行追蹤 LINE webhook + 網站 chatbot 完整程式碼路徑
- [x] CoV Step 3: 根本原因：prompt 太長（500+行），targetVehiclePrompt 放在開頭被「淹沒」（Lost in the Middle 問題）
- [x] CoV Step 4: 全面重構修正（4 大改善）
  - [x] 建立共用 vehicleDetectionService.ts 模組（LINE + 網站共用）
  - [x] 新增中文品牌別名（寶馬=BMW, 福斯=VW, 豐田=Toyota, 本田=Honda 等）
  - [x] 新增問題類型偵測 + 直接答案映射（cc數→排氣量, 多少錢→售價, 里程→里程等）
  - [x] Smart Vehicle KB：偵測到特定車時，該車完整資料置頂 + 其他車縮為一行
  - [x] targetVehiclePrompt 移到 system prompt 最末尾（利用 LLM recency bias）
  - [x] 加入「最後指令」+「覆蓋所有其他規則」強制語句
- [x] CoV Step 5: 43 個新測試 + 321 個總測試全通過（15 個測試檔案）

## AI 回應邏輯修正 v5 — 無法回答時真人接手機制 ✅
- [x] CoV: 追蹤為什麼 AI 無法回答「Honda CR-V 1.5L 什麼意思」（原因：缺少術語解釋知識庫）
- [x] 新增汽車術語解釋知識庫（CAR_TERM_GLOSSARY）— 20+ 個術語（排氣量/變速箱/燃料/安全/車型）
- [x] 新增「解釋型問題」偵測（什麼意思、是什麼、解釋一下）
- [x] 修正 ACC/cc 正則表達式衝突（'acc' 中的 'cc' 被誤判為排氣量）
- [x] 建立 [HUMAN_HANDOFF] 標記機制：AI 無法回答時自動加入標記
- [x] 偵測「我幫你確認」等不確定語句作為二次偵測
- [x] 觸發時自動回覆客人「真人客服馬上就到」
- [x] LINE 推播 Flex Message 給賴崑家 + 工作人員（紅色緊急卡片 + 一鍵撥打/開啟聊天室）
- [x] 同時透過系統通知 notifyOwner 發送
- [x] 網站 chatbot 也加入相同的真人接手機制
- [x] 寫測試驗證所有新功能（16 個測試檔案，361 個測試全通過）

## 對話上下文感知車輛偵測 ✅
- [x] 分析現有偵測流程，設計上下文感知邏輯
- [x] 從對話歷史中提取最近提到的車款（掃描最近 10 則訊息，從新到舊）
- [x] 當前訊息沒偵測到車款時，自動使用對話歷史中最近提到的車款
- [x] 支援代名詞/省略語（「那台」「這台」「它」「那排氣量呢」「多少錢」「所以」「然後」「順便問」等）
- [x] LINE webhook 傳入對話歷史給偵測函數
- [x] 網站 chatbot 傳入對話歷史給偵測函數
- [x] 28 個新測試 + 389 個總測試全通過（17 個測試檔案）
- [x] 新增「多少公里」到里程偵測模式（修正 mileage 偵測遺漏）

## AI 回應修正 v6 — 品牌偵測 + 多問題回答 ✅
- [x] CoV: 追蹤為什麼「ford 那台」沒有偵測到（原因：carKeywords 缺少「那台」「看」等關鍵字）
- [x] 修正品牌偵測：擴充 carKeywords + 品牌+指示代名詞直接匹配
- [x] 修正多問題回答：加入「客人同時問了 N 個問題，每個都要回答」規則
- [x] 確保 AI 不會在客人已指定車款時推薦其他車
- [x] 測試驗證通過

## AI 回應修正 v7 — 預約看車不給時段 + 答非所問 ✅
- [x] 診斷為什麼「可以明天約個看車時間嗎」AI 不給時段選項
- [x] 根本原因：system prompt 太長（500+行），關鍵規則在中間被淹沒（lost in the middle）
- [x] 建立意圖偵測系統（7 種意圖）+ 動態指令注入
- [x] 預約意圖 → 注入三個時段選項（智能匹配上午/下午/晚上）
- [x] 地址意圖 → 注入完整地址 + Google 地圖
- [x] 電話/營業時間/貸款意圖 → 各自注入對應指令
- [x] 多意圖提醒：「客人同時問了 N 個問題，每個都要回答」
- [x] LINE webhook + 網站 chatbot 都已整合
- [x] 453 個測試全通過（18 個測試檔案）

## Chain of Verification 全面稽查 — 消滅所有「答非所問」 ✅
- [x] CoV-1: 完整映射所有訊息類型 → 程式碼路徑 → LLM 輸出
- [x] CoV-2: 用真實失敗訊息模擬每一層偵測
- [x] CoV-3: 根本原因：System prompt 太長（500+行），關鍵規則在中間被淹沒
- [x] CoV-4: 建立意圖偵測系統（7 種意圖：預約/地址/電話/營業時間/問候/議價/貸款）
- [x] CoV-5: 64 個新測試 + 453 個總測試全通過（18 個測試檔案）

## AI 回應修正 v8 — 客人留電話時 AI 答非所問 ✅
- [x] 追蹤「我的電話是0961014789」為什麼 AI 推薦車款而非確認電話（原因：缺少 providing_contact 意圖）
- [x] 新增 'providing_contact' 意圖偵測（區分「客人問電話」vs「客人給電話」）
- [x] 注入指令：感謝留電話 + 確認已記下 + 賴先生會盡快聯繫 + 自動提取電話號碼
- [x] 465 個測試全通過（18 個測試檔案）

## AI 回應修正 v9 — 引導客人用選單看車 + 地址未回答
- [ ] 修正：AI 推薦車時要鼓勵客人「點下方選單的『看車庫存』瀏覽所有車輛」
- [ ] 修正：客人問「怎麼看」時，引導點下方選單
- [ ] 修正：「想去看 ford 那台，你們地址在哪」地址意圖被忽略
- [ ] 新增 'how_to_browse' 意圖偵測（怎麼看、怎麼瀏覽、在哪看）
- [ ] 在 system prompt 加入 Rich Menu 引導規則
- [ ] 寫測試驗證

## AI 回應修正 v10 — 高意願詢問特定車 + 動態 Prompt 架構
- [x] 新增「高意願詢問特定車」意圖偵測（從卡片點進來的格式：「我想詢問這台車：XXX」）
- [x] 高意願時 AI 直接介紹該車亮點 + 要電話 + 告知業務會火速聯繫
- [x] 動態 Prompt Builder 技術突破：銷售技巧完整保留 + 三明治結構 + Multi-message 注入
- [x] 整合動態 Prompt Builder 到 LINE webhook（取代舊 system prompt）
- [x] 整合動態 Prompt Builder 到網站 chatbot
- [x] 寫測試驗證（465 個測試全通過，18 個測試檔案）

## AI 回應修正 v10.1 — 高意願客人直接要電話
- [x] 修改 inquiry_button 邏輯：客人點「LINE問這台車」按鈕時，動機明確，直接要電話
- [x] AI 回覆簡短肯定 + 1-2 個亮點 + 直接要電話 + 「業務賴先生會盡快火速與您聯繫」
- [x] 如果客人已留電話，則直接告知「賴先生會盡快聯繫」，不再問電話
- [x] 回覆控制在 80 字以內，不長篇大論介紹規格
- [x] 同步更新 dynamicPromptBuilder 的 buildUserMessagePrefill 加入高意願提醒
- [x] 同步更新 LINE webhook + 網站 chatbot 傳入 customerContact 參數

## AI 回應修正 v11 — 預約看車時直接要電話
- [x] 問題：客人說「我想週末去看車，可以預約嗎？」AI 回覆推薦車款，而非直接要電話
- [x] 修正：預約看車意圖時，AI 直接要電話 + 說「我們業務會盡快火速與您聯繫，幫您安排看車」
- [x] 不推薦車款，不給時段選項，直接要電話讓業務安排
- [x] 同步更新 LINE webhook + 網站 chatbot + dynamicPromptBuilder
- [x] 測試驗證（465 個測試全通過）

## AI 回應修正 v11.1 — 用詞修正「賴先生」→「我們業務」
- [x] 所有 AI prompt 指令中的「賴先生會盡快火速與您聯繫」改為「我們業務會盡快火速與您聯繫」
- [x] 涵蓋：inquiry_button、appointment、providing_contact 等所有意圖
- [x] 同步更新 vehicleDetectionService.ts + dynamicPromptBuilder.ts
- [x] 更新測試（465 個測試全通過）

## 8891 同步 — CoV 驗證頻率調整
- [x] 將 Chain of Verification (CoV) 驗證頻率從每次同步都驗證 + 每 3 小時獨立檢查，改為一週兩次（~每 3.5 天）
- [x] 同步本身照常每 6 小時跑，但只有到了 CoV 時間才會驗證
- [x] 測試驗證（465 個測試全通過）
