/**
 * SHOP CONFIG — single source of truth for 崑家汽車 business facts.
 *
 * Every hardcoded shop address, phone, dealership-type claim across the
 * codebase MUST import from this file. Previously these were duplicated
 * across server/ruleBasedReply.ts, server/dynamicPromptBuilder.ts,
 * server/lineWebhook.ts, and server/seo.ts — which caused divergence
 * (one file had a wrong Kaohsiung district), which is the class of bug
 * this file exists to prevent.
 *
 * Bug reference (2026-04-23): AI quoted wrong address "台北內湖" and wrong
 * price "98.9萬" (newCarPrice leakage) in live conversation. See
 * docs/PROJECT_JOURNAL.md for full incident details.
 *
 * WHEN YOU CHANGE ANY VALUE HERE: run `npm test -- factLock` and make
 * sure Jerry confirms the change matches reality.
 */

/** Shop display name (never shorten or abbreviate in customer-facing text) */
export const SHOP_NAME = "崑家汽車";

/**
 * Founding year — single source of truth for shop age calculations.
 * All "在地 XX 年" claims MUST derive from this constant.
 * Jerry confirmed 2026-10-22: founded in 1986.
 */
export const FOUNDING_YEAR = 1986;

/** Calculate years in business dynamically */
export const yearsInBusiness = (): number => new Date().getFullYear() - FOUNDING_YEAR;

/** Shop city (used for location-sanity checks) */
export const SHOP_CITY = "高雄";

/** Shop district */
export const SHOP_DISTRICT = "三民區";

/** Full shop address — MUST match Google Maps + business registration */
export const SHOP_ADDRESS = "高雄市三民區大順二路269號（肯德基斜對面）";

/** Address without the landmark tail — for schema.org / machine-readable contexts */
export const SHOP_ADDRESS_PLAIN = "高雄市三民區大順二路269號";

/** Google Maps URL */
export const SHOP_MAP_URL = "https://maps.google.com/?q=高雄市三民區大順二路269號";

/** Primary contact number */
export const SHOP_PHONE = "0936-812-818";

/** Contact person for the phone number */
export const SHOP_CONTACT_PERSON = "賴先生";

/** Operating hours (human-readable, customer-facing in LINE replies) */
export const SHOP_HOURS = "週一至週日 9:30-20:00";

/**
 * Operating hours (schema.org format, for BusinessHours structured data
 * in seo.ts). Must describe the same schedule as SHOP_HOURS, just in the
 * machine-readable syntax Google expects.
 *
 * Format reference: https://schema.org/OpeningHoursSpecification
 *   Mo / Tu / We / Th / Fr / Sa / Su (no commas for ranges)
 */
export const SHOP_HOURS_SCHEMA = "Mo-Su 09:30-20:00";

/** LINE Official Account ID */
export const SHOP_LINE_ID = "@825oftez";

/**
 * Dealership type — used-car only.
 * If the AI ever says "新車" (new car) in self-description, it's a bug.
 */
export const SHOP_TYPE = "中古車商";

/**
 * Locations the AI must NEVER claim as ours. If the LLM output mentions
 * any of these as "我們在 X" or "our shop is in X", it's a hallucination
 * and must be rejected.
 *
 * Why these? Taipei/Neihu is where many luxury car showrooms cluster in
 * Taiwan — Gemini's training data skews toward those, and it has tried
 * to locate us in Neihu (2026-04-23 incident). Other Taiwan cities added
 * defensively in case the hallucination generalizes.
 */
export const FORBIDDEN_LOCATIONS: readonly string[] = [
  "台北",
  "臺北",
  "新北",
  "內湖",
  "信義區",
  "大安區",
  "士林",
  "桃園",
  "新竹",
  "台中",
  "臺中",
  "台南",
  "臺南",
  "屏東",
  "宜蘭",
  "花蓮",
  "台東",
  "基隆",
  "嘉義",
  "雲林",
  "彰化",
  "苗栗",
  "南投",
] as const;

/**
 * Phrases that imply we sell new cars. We are a used-car dealership ONLY.
 * Customer may ASK about new cars; we never CLAIM to sell them.
 *
 * Note: this list detects the AI claiming a vehicle IS a new car or has
 * new-car pricing. Customer utterances ("你們有沒有新車？") should be
 * handled at a different layer (intent detection, not output validation).
 */
export const FORBIDDEN_DEALERSHIP_TERMS: readonly string[] = [
  "新車價",
  "新車售價",
  "新車原價",
  "新車牌價",    // Chinese label for MSRP — seen in adversarial probe
  "新車市價",    // ditto
  "原廠新車",
  "新車價格",
  "市場行情",    // vague MSRP proxy; LLM uses this to hallucinate prices
  "是新車",
  "這是新車",
  "這台新車",
  "這款新車",
  "我們賣新車",
  "我們是新車",
] as const;

/**
 * DB field names that leak new-car MSRP into Gemini's context.
 * If any vehicle KB string contains these field names as raw labels,
 * it's a leak and must be stripped before prompt injection.
 */
export const LEAKY_FIELD_NAMES: readonly string[] = [
  "newCarPrice",
  "newCarMsrp",
] as const;
