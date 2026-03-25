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

  // === Priority 1.5: Inquiry button clicked but vehicle not in DB (likely sold) ===
  // Style aligned with LLM prompt: 一段話、不分段、不用句點
  if (detection.type === "inquiry_button" && !detection.vehicle) {
    return `${greeting}不好意思這台車目前已經不在庫存了可能已經售出囉！不過我們還有很多好車可以看，你可以點下方「看車庫存」瀏覽目前在售的車輛，或告訴我你想找什麼條件的車我幫你推薦`;
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
    return `${greeting}你問的是哪一台車呢？你可以點下方選單的「看車庫存」瀏覽我們目前在售的車款，或直接告訴我你想了解哪台車！`;
  }

  // === Priority 4: Intent-based replies (no specific vehicle) ===

  // Greeting
  if (/你好|哈囉|嗨|hi|hello|安安/i.test(lower)) {
    return `${greeting}你好！歡迎來到崑家汽車！我是高雄阿家，在高雄車界40年了，請問${greeting}今天想看什麼車款呢？還是有什麼我可以幫忙的？`;
  }

  // Viewing/appointment intent
  if (intents.includes("visit") || /看車|試駕|預約|賞車|過去看|去你們那/.test(lower)) {
    return buildAppointmentReply(greeting, customerContact);
  }

  // Address/location
  if (/地址|在哪|怎麼走|怎麼去|位置|地點/.test(lower)) {
    return `${greeting}崑家汽車在${STORE_ADDRESS}，營業時間${STORE_HOURS}，直接來就好，有任何問題可以先打電話 ${STORE_PHONE} 問賴先生！`;
  }

  // Business hours
  if (/營業時間|幾點開|幾點關|開到幾點|週末有開/.test(lower)) {
    return `${greeting}崑家汽車營業時間是${STORE_HOURS}，想哪個時間來看車呢？直接打 ${STORE_PHONE} 賴先生預約最快！`;
  }

  // Contact request
  if (/電話|手機|聯絡|怎麼聯繫/.test(lower)) {
    return `${greeting}崑家汽車賴先生電話 ${STORE_PHONE}，LINE ${LINE_ID}，地址${STORE_ADDRESS}，直接打電話或加LINE都可以！`;
  }

  // Price/budget related (no specific vehicle)
  if (intents.includes("budget") || /預算|多少錢|價格|幾萬/.test(lower)) {
    return `${greeting}請問你的預算大概在多少呢？這樣我比較好幫你推薦適合的車款，或者告訴我想找什麼品牌、用途是通勤還是家庭用車，我能更精準推薦！`;
  }

  // "想看車" generic
  if (/想看車|想買車|有什麼車|推薦/.test(lower)) {
    return `${greeting}歡迎！請問你有偏好的品牌或車型嗎？告訴我預算範圍跟主要用途我幫你推薦最適合的！也可以直接來店裡看實車，地址${STORE_ADDRESS}`;
  }

  // Fragmented signals (year / budget number / cc)
  if (/^\d{4}$/.test(userMessage.trim())) {
    return `${greeting}你說的 ${userMessage.trim()} 是指年份嗎？請問是想找 ${userMessage.trim()} 年的車呢？還是其他意思？`;
  }
  if (/^\d{2,3}(\.?\d)?萬?$/.test(userMessage.trim())) {
    return `${greeting}預算 ${userMessage.trim()}${userMessage.includes("萬") ? "" : "萬"}左右是嗎？好的我幫你看看有什麼適合的車！請問有偏好的品牌嗎？`;
  }
  if (/^\d{3,4}\s*(cc)?$/i.test(userMessage.trim())) {
    return `${greeting}你想找 ${userMessage.trim().replace(/cc/i, "")}cc 左右的車嗎？請問有偏好的品牌或車型嗎？`;
  }

  // Thank you
  if (/謝謝|感謝|多謝|thanks|thank you/i.test(lower)) {
    return `不客氣！${greeting}有任何問題隨時問我，歡迎來店裡看車，地址${STORE_ADDRESS}，賴先生 ${STORE_PHONE} 隨時為你服務！`;
  }

  // Default fallback
  return `${greeting}你好！感謝你的訊息，如果想了解車輛或預約看車歡迎直接告訴我，或撥打 ${STORE_PHONE} 聯繫賴先生，地址${STORE_ADDRESS}，營業時間${STORE_HOURS}`;
}

// === Builder helpers ===

function buildVehicleInquiryReply(vehicle: any, greeting: string, customerContact: string | null): string {
  // Style: 一段話、不分段不換行、不用句點、80字以內
  const v = vehicle;
  const specs = [
    v.modelYear ? `${v.modelYear}年` : '',
    v.displacement || '',
  ].filter(Boolean).join('');
  const price = v.priceDisplay || `${v.price}萬`;
  return `${greeting}你對這台${v.brand} ${v.model}有興趣眼光不錯喔！這台是${specs}售價${price}，想了解車況細節、預約看車試駕還是貸款方案呢`;
}

function buildVehicleAnswerReply(detection: RuleContext["detection"], greeting: string): string {
  const v = detection.vehicle;
  if (!v) return "";

  // Direct answer from vehicle data (PRIORITY — always answer the question first)
  if (detection.directAnswer) {
    // If there's also a term explanation (customer asked "什麼意思"), append it
    const extra = detection.termExplanation ? `，${detection.termExplanation}` : '';
    return `${greeting}${detection.directAnswer}${extra}，還有其他問題嗎？歡迎隨時問！`;
  }

  // Term explanation only (customer asked "什麼意思" but no direct answer available)
  if (detection.termExplanation) {
    return `${greeting}${detection.termExplanation}，還有什麼想了解的嗎？`;
  }

  // Question type specific
  const q = detection.questionType;
  const name = `${v.brand} ${v.model}`;

  switch (q) {
    case "price":
      return `${greeting}${name} 售價是 ${v.priceDisplay || v.price + "萬"}！想了解更多或預約看車歡迎告訴我！`;
    case "displacement":
      return `${greeting}${name} 的排氣量是 ${v.displacement || "請來電詢問"}，還想知道什麼嗎？`;
    case "mileage":
      return `${greeting}${name} 的里程是 ${v.mileage || "請來電確認最新里程"}，還有什麼想了解的嗎？`;
    case "year":
      return `${greeting}${name} 是 ${v.modelYear} 年的車，還有什麼想了解的嗎？`;
    case "color":
      return `${greeting}${name} 的顏色是 ${v.color || "請來電確認"}，還有什麼想了解的嗎？`;
    case "transmission":
      return `${greeting}${name} 是 ${v.transmission || "請來電詢問"}，還有什麼想了解的嗎？`;
    case "fuel":
      return `${greeting}${name} 的燃料類型是 ${v.fuelType || "請來電詢問"}，還有什麼想了解的嗎？`;
    case "features":
      return `${greeting}${name} 的配備是${v.features || "詳細配備歡迎來店看車確認"}，要不要來店裡親自體驗？`;
    case "availability":
      return `${greeting}${name} 目前還在喔！要不要預約來看車呢？賴先生 ${STORE_PHONE}`;
    case "photos":
      return `${greeting}想看 ${name} 的照片嗎？歡迎到我們的網站看完整照片，或者直接來店裡看實車最準確！地址${STORE_ADDRESS}`;
    default:
      return `${greeting}${name} ${buildSpecsText(v)}，還有什麼想了解的嗎？`;
  }
}

function buildVehicleGeneralReply(vehicle: any, greeting: string, customerContact: string | null): string {
  const v = vehicle;
  const specs = [v.modelYear ? `${v.modelYear}年` : '', v.displacement || '', v.mileage ? `里程${v.mileage}` : ''].filter(Boolean).join('、');
  const price = v.priceDisplay || `${v.price}萬`;
  const phonePrompt = customerContact ? '要不要預約來看實車呢？' : '方便留個電話嗎？賴先生可以直接跟你詳細介紹！';
  return `${greeting}${v.brand} ${v.model}（${specs}）售價${price}是台好車！${phonePrompt}`;
}

function buildAppointmentReply(greeting: string, customerContact: string | null): string {
  const phonePart = customerContact
    ? '你的電話我們有了，賴先生會跟你聯繫確認細節！'
    : '方便留個電話嗎？賴先生直接打給你確認比較快！';
  return `${greeting}想來看車太好了！請問哪個時段方便呢？上午10-11、下午14-15、還是晚上18-19？${phonePart}，地址${STORE_ADDRESS}`;
}

function buildSpecsText(v: any): string {
  const parts = [
    `${v.brand} ${v.model}`,
    `售價${v.priceDisplay || v.price + "萬"}`,
    `${v.modelYear}年`,
    v.color ? `${v.color}` : "",
    v.mileage ? `里程${v.mileage}` : "",
    v.displacement ? `排氣量${v.displacement}` : "",
    v.transmission ? `${v.transmission}` : "",
    v.fuelType ? `${v.fuelType}` : "",
  ].filter(Boolean);
  return parts.join("、");
}
