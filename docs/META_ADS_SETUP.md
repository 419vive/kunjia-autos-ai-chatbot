# Meta Marketing API 設定步驟

程式碼在 `kun-auto-chatbot/server/metaAds.ts`。這份文件只講「拿到 token 之前」要點的東西。

## 誰做什麼

| # | 誰 | 動作 | 在哪 |
|---|---|---|---|
| 1 | 媽媽 | 建立商業檔案（用她自己的帳號、她自己的裝置） | business.facebook.com |
| 2 | 媽媽 | 把粉專、廣告帳號、Pixel `936259169015798` 加進商業檔案 | 商業管理工具 → 帳號 |
| 3 | 媽媽 | 廣告帳號綁**店裡的**付款方式（不是 Jerry 個人的卡） | 帳單設定 |
| 4 | 媽媽 | 把 Jerry 加為使用者 → 指派廣告帳號「廣告主」權限 | 設定 → 使用者 |
| 5 | Jerry | 建立應用程式，類型「企業」，擁有者設為上面的商業檔案 | developers.facebook.com |
| 6 | Jerry | 加入產品 Marketing API | App 後台 |
| 7 | 媽媽 | 商業驗證（上傳崑家汽車公司登記，2–5 個工作天） | 商業管理工具 → 安全中心 |
| 8 | Jerry | App Review 申請 `ads_management`、`ads_read`、`business_management`、`pages_show_list`、`pages_read_engagement` | App Review → 權限與功能 |
| 9 | 媽媽 | 建立 System User → 指派資產 → 產生權杖 → 把權杖給 Jerry | 設定 → 系統使用者 |
| 10 | Jerry | 權杖填進 Railway 環境變數（見 `.env.example`） | Railway |

第 7、8 步是唯一慢的部分。前 6 步一個下午能做完。

## 驗證串好了沒

```bash
curl -s "https://graph.facebook.com/v21.0/me/adaccounts?access_token=$META_ACCESS_TOKEN" | jq
```

回傳含 `act_...` 就通了。

## 第一次下廣告前，一定要先做這件事

Meta 的預算單位是「該幣別的最小單位」，不同幣別的 `currency_offset` 不一樣。**猜錯就是 100 倍超支。**

```ts
const info = await getAdAccountInfo(cfg);
console.log(info.currency, info.currencyOffset, info.minDailyBudget);
// 用實際回傳的 offset 換算，不要寫死
const budget = toMinorUnits(500, info.currencyOffset); // NT$500/天
```

`server/metaAds.ts` 有兩道防護：`toMinorUnits` 拒絕不合理的 offset，`assertBudgetSane` 擋掉超過 `DAILY_BUDGET_CEILING_MINOR` 的預算。要突破上限必須明確傳 `allowAbove=true`。

## 所有東西都是 PAUSED 建立的

`createCampaign` / `createAdSet` / `createAd` 一律寫死 `status: "PAUSED"`。

**唯一會開始花錢的函式是 `activateAd()`**，它被刻意獨立出來，方便 code review 直接 grep。流程是：程式建好 → 在廣告管理員後台肉眼確認 → 才呼叫 `activateAd`。

## 用法

```ts
import { loadMetaAdsConfig, getAdAccountInfo, toMinorUnits, launchVehicleAd } from "./metaAds";

const cfg = loadMetaAdsConfig();          // 沒設定環境變數時回傳 null
if (!cfg) throw new Error("Meta ads not configured");

const info = await getAdAccountInfo(cfg);

const result = await launchVehicleAd(cfg, vehicle, {
  imageUrl: "https://kuncar.tw/...jpg",
  baseUrl: "https://kuncar.tw",
  dailyBudgetMinor: toMinorUnits(500, info.currencyOffset),
  radius: { latitude: 22.6396, longitude: 120.3021, radiusKm: 30 }, // 高雄三民區
});
// result.active === false — 還沒上線
```

## 已知風險

Jerry 的個人廣告帳號有被停權紀錄。Meta 的停權判定是實體層級（會串個人檔案、付款方式、裝置、IP、擔任管理員的商業檔案），所以：

- 商業檔案由**媽媽**建立、**媽媽**當擁有者
- 付款方式用**店裡的**，不要用 Jerry 個人的卡
- Jerry 拿「廣告主」而非「管理員」，降低關聯權重
- 拿到 token 之後，**不要用自己的瀏覽器登入這個廣告帳號後台**，讀報表走 `getInsights()`

停權狀態查詢：`facebook.com/business-support-home`（`facebook.com/accountquality` 會轉址到這裡）→「查看我的帳號」。

---

# 受眾與報表（對齊大表 SOP）

## 模組分工

| 檔案 | 負責 |
|---|---|
| `server/metaAds.ts` | 傳輸層＋四層物件（Campaign/AdSet/Creative/Ad）、預算與 token 防護 |
| `server/metaTargeting.ts` | 受眾層：地區/興趣/類似受眾/排除、Advantage+ 開關、命名規則 |
| `server/metaVehicleAds.ts` | 一台車 → 一整組 PAUSED 廣告 |
| `server/metaReporting.ts` | insights → 大表日報/月報列 + CSV |

## 為什麼地區和興趣的 ID 不寫死

Meta 用不透明的數字 key 定位縣市和興趣，各市場不同、且會變。猜錯的後果是**廣告看起來設定正確、實際上打到別的地方**。所以先查再用：

```ts
const regions = await searchGeoLocations(cfg, "高雄");   // → [{ key, name, type }]
const interests = await searchInterests(cfg, "中古車");   // → [{ id, name, audienceSize }]
const audiences = await listCustomAudiences(cfg);        // → LL2%、已填單名單
```

## 一組完整的廣告

```ts
const info = await getAdAccountInfo(cfg);   // 先確認 currency offset

await launchVehicleAd(cfg, vehicle, {
  imageUrl: "https://kuncar.tw/...jpg",
  baseUrl: "https://kuncar.tw",
  dailyBudgetMinor: toMinorUnits(500, info.currencyOffset),
  targeting: {
    regionKeys: [kaohsiungKey],
    ageMin: 35,
    ageMax: 65,
    interestIds: [usedCarInterestId],
    excludedCustomAudienceIds: [alreadySubmittedId],  // 排除已填單
    advantageAudience: false,                          // AI 受眾關閉，測試才讀得出來
  },
  naming: { region: "高雄", audience: "中古車 家庭用車", flight: "9月檔" },
  bidStrategy: "COST_CAP",                             // CPA 控價
  bidAmountMinor: toMinorUnits(1500, info.currencyOffset),
});
// → adsetName「高雄｜35-65+｜中古車 家庭用車｜9月檔」，全部 PAUSED
```

`advantageAudience` 預設 **關閉**。Meta 開著時會自行擴大受眾，興趣測試就讀不出結果——這正是大表裡「這週AI全關閉觀察！」在做的事，所以做成明確開關而不是預設值。

`bidStrategy: "COST_CAP"` 沒帶 `bidAmountMinor` 會直接報錯，不會默默退回預設出價（那等於沒控價）。

## 報表回填大表

```ts
const rows = await getDailyRows(cfg, { since: "2026-09-01", until: "2026-09-30" });
console.log(formatDailyCsv(rows));   // 欄位順序與大表一致，可直接貼回
```

**指標定義**（從大表真實列反推，逐位驗算過）：

```
點擊率      = 連結點擊次數 / 曝光次數
千次曝光成本 = 花費 / 曝光次數 × 1000
單次點擊成本 = 花費 / 連結點擊次數
轉換率      = 填單次數 / 連結點擊次數
單次填單成本 = 花費 / 填單次數
```

⚠️ Meta 自己的 `ctr` / `cpc` 欄位算的是**所有點擊**（含表情、頭像點擊、看大圖），大表算的是**連結點擊**。直接用 Meta 的欄位會讓 CPC 從 90 變成 20，整張表的數字全變。所以模組一律自己從連結點擊推導，不使用 Meta 的 ctr/cpc。

回歸測試用 2026/8/1、8/2、8/5、8/7 四天的真實數字驗證，五個指標全部逐位吻合；月報用好珈貿易 2023-06 驗證 ROAS/CPA/客單價。

除以零回傳 null，CSV 輸出空白（不是 `#DIV/0!`），避免污染平均值。
