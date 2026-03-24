/**
 * Rule-Based Reply Engine
 *
 * When FORCE_RULE_BASED_REPLY=1, the chatbot responds using pattern matching
 * instead of calling the LLM API. This saves API costs while still providing
 * useful responses to common customer inquiries.
 *
 * Uses existing vehicle detection and intent detection from vehicleDetectionService.
 */

import type { QuestionType } from "./vehicleDetectionService";

const STORE_PHONE = "0936-812-818";
const STORE_ADDRESS = "高雄市三民區大順二路269號（肯德基斜對面）";
const STORE_MAP = "https://maps.google.com/?q=高雄市三民區大順二路269號";
const STORE_HOURS = "週一至週六 9:00-20:00";
const LINE_ID = "@825oftez";

export function isRuleBasedMode(): boolean {
  return process.env.FORCE_RULE_BASED_REPLY === "1";
}

type RuleContext = {
  userMessage: string;
  greeting: string; // 大哥/小姐/人客
  detection: {
    type: string;
    vehicle: any | null;
    questionType: QuestionType;
    directAnswer: string;
    termExplanation?: string;
  };
  intents: string[];
  customerContact: string | null;
  leadScore?: number;
};

/**
 * Generate a rule-based reply without calling the LLM.
 * Returns the reply text.
 */
export function generateRuleBasedReply(ctx: RuleContext): string {
  const { userMessage, greeting, detection, intents, customerContact } = ctx;
  const lower = userMessage.toLowerCase();

  // === Priority 1: Inquiry button (structured "我想詢問這台車" or "我想了解這台") ===
  if (detection.type === "inquiry_button" && detection.vehicle) {
    return buildVehicleInquiryReply(detection.vehicle, greeting, customerContact);
  }

  // === Priority 2: Specific vehicle + specific question ===
  if (detection.vehicle && detection.questionType !== "general") {
    return buildVehicleAnswerReply(detection, greeting);
  }

  // === Priority 3: Specific vehicle, general inquiry ===
  if (detection.vehicle) {
    return buildVehicleGeneralReply(detection.vehicle, greeting, customerContact);
  }

  // === Priority 3.5: Follow-up question but no vehicle found in context ===
  if (detection.type === 'context_missing') {
    return `${greeting}，你問的是哪一台車呢？你可以點下方選單的「看車庫存」瀏覽我們目前在售的車款，或直接告訴我你想了解哪台車！🚗`;
  }

  // === Priority 4: Intent-based replies (no specific vehicle) ===

  // Greeting
  if (/你好|哈囉|嗨|hi|hello|安安/i.test(lower)) {
    return `${greeting}你好！👋 歡迎來到崑家汽車！\n\n我是高雄阿家，在高雄車界40年了。請問${greeting}今天想看什麼車款呢？還是有什麼我可以幫忙的？🚗`;
  }

  // Viewing/appointment intent
  if (intents.includes("visit") || /看車|試駕|預約|賞車|過去看|去你們那/.test(lower)) {
    return buildAppointmentReply(greeting, customerContact);
  }

  // Address/location
  if (/地址|在哪|怎麼走|怎麼去|位置|地點/.test(lower)) {
    return `📍 崑家汽車\n地址：${STORE_ADDRESS}\nGoogle 地圖：${STORE_MAP}\n營業時間：${STORE_HOURS}\n\n${greeting}直接來就好，有任何問題可以先打電話 ${STORE_PHONE} 問賴先生！👍`;
  }

  // Business hours
  if (/營業時間|幾點開|幾點關|開到幾點|週末有開/.test(lower)) {
    return `🕐 崑家汽車營業時間：${STORE_HOURS}\n\n${greeting}想哪個時間來看車呢？直接打 ${STORE_PHONE} 賴先生預約最快！`;
  }

  // Contact request
  if (/電話|手機|聯絡|怎麼聯繫/.test(lower)) {
    return `📞 崑家汽車 — 賴先生\n電話：${STORE_PHONE}\nLINE：${LINE_ID}\n地址：${STORE_ADDRESS}\n\n${greeting}直接打電話或加LINE都可以喔！👍`;
  }

  // Price/budget related (no specific vehicle)
  if (intents.includes("budget") || /預算|多少錢|價格|幾萬/.test(lower)) {
    return `${greeting}，請問你的預算大概在多少呢？這樣我比較好幫你推薦適合的車款 🚗\n\n或者你可以告訴我：\n1️⃣ 想找什麼品牌？\n2️⃣ 用途是上班通勤還是家庭用車？\n\n這樣我能更精準推薦！`;
  }

  // "想看車" generic
  if (/想看車|想買車|有什麼車|推薦/.test(lower)) {
    return `${greeting}，歡迎！請問你有偏好的品牌或車型嗎？🚗\n\n或者告訴我：\n1️⃣ 預算範圍？\n2️⃣ 主要用途（通勤/家庭/載貨）？\n\n我幫你推薦最適合的！也可以直接來店裡看實車，地址：${STORE_ADDRESS}`;
  }

  // Fragmented signals (year / budget number / cc)
  if (/^\d{4}$/.test(userMessage.trim())) {
    return `${greeting}，你說的 ${userMessage.trim()} 是指年份嗎？請問是想找 ${userMessage.trim()} 年的車呢？還是其他意思？`;
  }
  if (/^\d{2,3}(\.?\d)?萬?$/.test(userMessage.trim())) {
    return `${greeting}，預算 ${userMessage.trim()}${userMessage.includes("萬") ? "" : "萬"} 左右是嗎？好的，我幫你看看有什麼適合的車！請問有偏好的品牌嗎？`;
  }
  if (/^\d{3,4}\s*(cc)?$/i.test(userMessage.trim())) {
    return `${greeting}，你想找 ${userMessage.trim().replace(/cc/i, "")}cc 左右的車嗎？請問有偏好的品牌或車型嗎？`;
  }

  // Thank you
  if (/謝謝|感謝|多謝|thanks|thank you/i.test(lower)) {
    return `不客氣！${greeting}有任何問題隨時問我 😊 歡迎來店裡看車，地址：${STORE_ADDRESS}，賴先生 ${STORE_PHONE} 隨時為你服務！`;
  }

  // Default fallback
  return `${greeting}你好！感謝你的訊息 😊\n\n如果想了解車輛或預約看車，歡迎直接告訴我，或撥打 ${STORE_PHONE} 聯繫賴先生。\n\n📍 地址：${STORE_ADDRESS}\n🕐 營業時間：${STORE_HOURS}`;
}

// === Builder helpers ===

function buildVehicleInquiryReply(vehicle: any, greeting: string, customerContact: string | null): string {
  const specs = buildSpecsText(vehicle);
  const phonePrompt = customerContact
    ? ""
    : `\n\n方便留個電話嗎？賴先生可以直接跟你聯繫，更快喔！📞`;

  return `${greeting}你好！👋 你問的這台 ${vehicle.brand} ${vehicle.model} 很不錯的選擇！\n\n${specs}\n\n${greeting}想了解什麼呢？可以問我任何問題，或者直接預約來店裡看實車！🚗${phonePrompt}`;
}

function buildVehicleAnswerReply(detection: RuleContext["detection"], greeting: string): string {
  const v = detection.vehicle;
  if (!v) return "";

  // Direct answer from vehicle data (PRIORITY — always answer the question first)
  if (detection.directAnswer) {
    // If there's also a term explanation (customer asked "什麼意思"), append it
    const extra = detection.termExplanation ? `\n\n${detection.termExplanation}` : '';
    return `${greeting}，${detection.directAnswer}${extra}\n\n還有其他問題嗎？歡迎隨時問！😊`;
  }

  // Term explanation only (customer asked "什麼意思" but no direct answer available)
  if (detection.termExplanation) {
    return `${greeting}，${detection.termExplanation}\n\n還有什麼想了解的嗎？😊`;
  }

  // Question type specific
  const q = detection.questionType;
  const name = `${v.brand} ${v.model}`;

  switch (q) {
    case "price":
      return `${greeting}，${name} 售價是 ${v.priceDisplay || v.price + "萬"}！👍\n\n想了解更多或預約看車，歡迎告訴我！`;
    case "displacement":
      return `${greeting}，${name} 的排氣量是 ${v.displacement || "請來電詢問"}。\n\n還想知道什麼嗎？`;
    case "mileage":
      return `${greeting}，${name} 的里程是 ${v.mileage || "請來電確認最新里程"}。`;
    case "year":
      return `${greeting}，${name} 是 ${v.modelYear} 年的車。`;
    case "color":
      return `${greeting}，${name} 的顏色是 ${v.color || "請來電確認"}。`;
    case "transmission":
      return `${greeting}，${name} 是 ${v.transmission || "請來電詢問"}。`;
    case "fuel":
      return `${greeting}，${name} 的燃料類型是 ${v.fuelType || "請來電詢問"}。`;
    case "features":
      return `${greeting}，${name} 的配備：${v.features || "詳細配備歡迎來店看車確認"}。\n\n要不要來店裡親自體驗？`;
    case "availability":
      return `${greeting}，${name} 目前還在喔！👍 要不要預約來看車呢？\n\n📞 賴先生 ${STORE_PHONE}`;
    case "photos":
      return `${greeting}，想看 ${name} 的照片嗎？歡迎到我們的網站看完整照片，或者直接來店裡看實車最準確！🚗\n\n📍 ${STORE_ADDRESS}`;
    default:
      return `${greeting}，${name} 的資訊如下：\n${buildSpecsText(v)}\n\n還有什麼想了解的嗎？`;
  }
}

function buildVehicleGeneralReply(vehicle: any, greeting: string, customerContact: string | null): string {
  const specs = buildSpecsText(vehicle);
  const phonePrompt = customerContact
    ? `\n\n要不要預約來看實車呢？`
    : `\n\n方便留個電話嗎？賴先生可以直接跟你詳細介紹！📞`;

  return `${greeting}，${vehicle.brand} ${vehicle.model} 是台好車！👍\n\n${specs}${phonePrompt}`;
}

function buildAppointmentReply(greeting: string, customerContact: string | null): string {
  const phonePart = customerContact
    ? `你的電話我們有了，賴先生會跟你聯繫確認細節！`
    : `方便留個電話嗎？賴先生直接打給你確認，比較快！📞`;

  return `${greeting}，想來看車太好了！👍\n\n請問哪個時段方便呢？\n① 上午 10:00-11:00\n② 下午 14:00-15:00\n③ 晚上 18:00-19:00\n\n回覆數字就好囉！\n\n${phonePart}\n\n📍 地址：${STORE_ADDRESS}`;
}

function buildSpecsText(v: any): string {
  const parts = [
    `🚗 ${v.brand} ${v.model}`,
    `💰 售價：${v.priceDisplay || v.price + "萬"}`,
    `📅 年份：${v.modelYear}年`,
    v.color ? `🎨 顏色：${v.color}` : "",
    v.mileage ? `📏 里程：${v.mileage}` : "",
    v.displacement ? `⚙️ 排氣量：${v.displacement}` : "",
    v.transmission ? `🔧 變速箱：${v.transmission}` : "",
    v.fuelType ? `⛽ 燃料：${v.fuelType}` : "",
    v.features ? `✨ 配備：${v.features}` : "",
    v.guarantees ? `🛡️ 保證：${v.guarantees}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}
