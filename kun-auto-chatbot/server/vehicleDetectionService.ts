/**
 * 崑家汽車 — 車輛偵測服務模組
 * 
 * Chain of Verification v4: 解決 AI 忽略客人指定車款的問題
 * 
 * 根本原因：targetVehiclePrompt 被埋在巨大的 system prompt 中間，
 * LLM 因為 "lost in the middle" 效應而忽略了車輛指定指令。
 * 
 * 修正策略：
 * 1. 將 targetVehiclePrompt 移到 system prompt 的最末尾（利用 recency bias）
 * 2. 偵測到指定車款時，vehicleKB 只顯示該車的完整資料 + 其他車的簡短列表
 * 3. 加入 case-insensitive 匹配 + 中文品牌別名
 * 4. 加入明確的 Q&A 映射（客人問 cc 數 → 回答排氣量）
 */

// ============ BRAND ALIASES (Chinese → English) ============

export const BRAND_ALIASES: Record<string, string> = {
  // Japanese brands
  '豐田': 'Toyota',
  '本田': 'Honda',
  '日產': 'Nissan',
  '馬自達': 'Mazda',
  '三菱': 'Mitsubishi',
  '鈴木': 'Suzuki',
  '速霸陸': 'Subaru',
  // German brands
  '寶馬': 'BMW',
  '賓士': 'Mercedes-Benz',
  '奧迪': 'Audi',
  '福斯': 'Volkswagen',
  '保時捷': 'Porsche',
  // Korean brands
  '現代': 'Hyundai',
  '起亞': 'Kia',
  // American brands
  '福特': 'Ford',
  '雪佛蘭': 'Chevrolet',
  // Common abbreviations
  'VW': 'Volkswagen',
  'Benz': 'Mercedes-Benz',
};

// ============ QUESTION TYPE DETECTION ============

export type QuestionType = 
  | 'displacement' // cc數、排氣量
  | 'price' // 多少錢、價格
  | 'mileage' // 里程
  | 'transmission' // 變速箱
  | 'fuel' // 油耗、燃料
  | 'features' // 配備
  | 'color' // 顏色
  | 'year' // 年份
  | 'general' // 一般詢問
  | 'availability' // 還在嗎
  | 'photos' // 照片
  | 'explanation' // 什麼意思、是什麼、解釋
  ;

export function detectQuestionType(message: string): QuestionType {
  const lower = message.toLowerCase();
  
  // PRIORITY: Check for "explanation" type first — "什麼意思", "是什麼", "代表什麼"
  // This catches questions like "1.5L 什麼意思" or "cc 是什麼"
  if (/什麼意思|是什麼|代表什麼|代表啥|啥意思|解釋一下|解釋|是啥|什麼東西|什麼概念/.test(lower)) {
    // Determine WHAT they're asking about to provide the right explanation
    // IMPORTANT: Check features BEFORE displacement to avoid 'acc' matching 'cc' in displacement regex
    if (/tss|sensing|安全|氣囊|\babs\b|\besp\b|\bacc\b|adas|雷達|影像/.test(lower)) return 'features';
    if (/\d+\.?\d*\s*l|\bcc\b|cc數|cc 數|排氣|引擎|動力|馬力|渦輪|turbo|自然進氣|\bna\b/.test(lower)) return 'displacement';
    if (/手排|自排|cvt|dct|\bat\b|\bmt\b|變速|幾速/.test(lower)) return 'transmission';
    if (/油耗|省油|柴油|汽油|油電|hybrid|電動|\bev\b/.test(lower)) return 'fuel';
    if (/里程|公里/.test(lower)) return 'mileage';
    // Generic explanation — still mark as explanation type
    return 'explanation';
  }
  
  if (/cc數|cc 數|排氣量|排氣|幾cc|幾 cc|引擎|馬力|動力|\d+\.?\d*\s*l/.test(lower)) return 'displacement';
  if (/多少錢|價錢|價格|價位|售價|報價|幾萬|便宜/.test(lower)) return 'price';
  if (/里程|跑多少|公里數|幾公里|多少公里/.test(lower)) return 'mileage';
  if (/變速箱|手排|自排|手自排|幾速|CVT/.test(lower)) return 'transmission';
  if (/油耗|省油|耗油|燃料|汽油|柴油|油電|電動/.test(lower)) return 'fuel';
  if (/配備|安全|氣囊|倒車|雷達|影像|天窗|皮椅|導航|carplay|apple|android/.test(lower)) return 'features';
  if (/顏色|什麼色|白色|黑色|銀色|灰色|紅色|藍色/.test(lower)) return 'color';
  if (/年份|幾年|出廠/.test(lower)) return 'year';
  if (/還在嗎|還有嗎|賣掉了嗎|有沒有/.test(lower)) return 'availability';
  if (/照片|圖片|看看|外觀|內裝/.test(lower)) return 'photos';
  return 'general';
}

// ============ CAR TERM GLOSSARY (for explanation questions) ============

export const CAR_TERM_GLOSSARY: Record<string, string> = {
  // Displacement / Engine
  '1.0l': '1.0L 代表引擎排氣量是 1000cc，屬於小排量引擎，省油省稅金，市區代步很夠用',
  '1.2l': '1.2L 代表引擎排氣量是 1200cc，小排量但有些配渦輪增壓，動力不錯又省油',
  '1.4l': '1.4L 代表引擎排氣量是 1400cc，配渦輪增壓的話動力等於 2.0 自然進氣，很夠力',
  '1.5l': '1.5L 代表引擎排氣量是 1500cc，是台灣最常見的排氣量，動力跟油耗取得很好的平衡，市區跑高速都很順',
  '1.8l': '1.8L 代表引擎排氣量是 1800cc，動力比 1.5L 更充沛，超車爬坡更輕鬆',
  '2.0l': '2.0L 代表引擎排氣量是 2000cc，動力充沛，高速巡航很穩，適合常跑長途或需要載重的人',
  '2.5l': '2.5L 代表引擎排氣量是 2500cc，大排量動力很猛，適合大車或性能取向',
  '3.0l': '3.0L 代表引擎排氣量是 3000cc，大馬力引擎，加速感很強勁',
  // Transmission
  '自排': '自排就是自動排檔，不用踩離合器換檔，開起來很輕鬆，現在 95% 的車都是自排',
  '手排': '手排需要自己踩離合器換檔，比較有駕駛樂趣，但塞車會比較累',
  'cvt': 'CVT 是無段變速箱，換檔非常平順沒有頓挫感，而且很省油',
  // Fuel
  '柴油': '柴油引擎扭力大、省油，適合常跑高速或需要拖重的人，但保養費用稍高一點',
  '油電': '油電混合動力，有汽油引擎加電動馬達，市區超省油，等紅燈時引擎會自動關閉',
  'hybrid': '油電混合動力，有汽油引擎加電動馬達，市區超省油，等紅燈時引擎會自動關閉',
  // Safety
  'tss': 'TSS 是 Toyota Safety Sense，豐田的主動安全系統，包含車道偏離警示、前方碰撞預警、自動跟車等功能',
  'honda sensing': 'Honda Sensing 是本田的主動安全系統，包含碰撞緩解煞車、車道維持、自動跟車等功能',
  'acc': 'ACC 是主動式定速巡航，車子會自動跟前車保持距離，高速公路開起來超輕鬆',
  // Body type
  'suv': 'SUV 是運動休旅車，底盤比較高，空間大，適合家庭出遊或需要載東西的人',
  'mpv': 'MPV 是多功能休旅車，通常有 7 人座，空間超大，全家出遊最方便',
  'sedan': 'Sedan 是轎車，開起來比較穩比較舒適，行李箱獨立空間也比較安全',
};

/**
 * Get explanation for a car term mentioned in the message.
 * IMPORTANT: Only triggers when customer explicitly asks "什麼意思" / "是什麼" type questions.
 * Otherwise returns '' to avoid overriding the correct answer (e.g., price answer overridden by term glossary).
 */
export function getTermExplanation(message: string, vehicle: any): string {
  const lower = message.toLowerCase();

  // Guard: Only provide term explanations when customer is asking "what does X mean?"
  // Without this guard, glossary terms like "自排" could match inside unrelated messages
  const isAskingExplanation = /什麼意思|是什麼|代表什麼|代表啥|啥意思|解釋|是啥|什麼東西|什麼概念/.test(lower);
  if (!isAskingExplanation) return '';

  // Try to find specific displacement value like "1.5L", "2.0L"
  const displacementMatch = lower.match(/(\d+\.?\d*)\s*l/);
  if (displacementMatch) {
    const key = displacementMatch[1] + 'l';
    const explanation = CAR_TERM_GLOSSARY[key];
    if (explanation) return explanation;
  }

  // Check for other terms in the glossary
  for (const [term, explanation] of Object.entries(CAR_TERM_GLOSSARY)) {
    if (lower.includes(term.toLowerCase())) {
      return explanation;
    }
  }

  // If customer asks "什麼意思" but no specific term found, explain the vehicle's displacement
  if (vehicle?.displacement) {
    const vDisp = vehicle.displacement.toLowerCase().replace(/\s/g, '');
    if (CAR_TERM_GLOSSARY[vDisp]) {
      return CAR_TERM_GLOSSARY[vDisp];
    }
  }

  return '';
}

export function getQuestionAnswer(vehicle: any, questionType: QuestionType): string {
  switch (questionType) {
    case 'displacement':
      return vehicle.displacement 
        ? `排氣量是 ${vehicle.displacement}` 
        : '排氣量這個資訊目前沒有，歡迎來電詢問';
    case 'price':
      return `售價 ${vehicle.priceDisplay || vehicle.price + '萬'}`;
    case 'mileage':
      return vehicle.mileage 
        ? `里程 ${vehicle.mileage}` 
        : '里程數這個資訊目前沒有，歡迎來電詢問';
    case 'transmission':
      return vehicle.transmission 
        ? `變速箱是 ${vehicle.transmission}` 
        : '變速箱這個資訊目前沒有，歡迎來電詢問';
    case 'fuel':
      return vehicle.fuelType 
        ? `燃料類型是 ${vehicle.fuelType}` 
        : '燃料這個資訊目前沒有，歡迎來電詢問';
    case 'features':
      return vehicle.features 
        ? `配備包含：${vehicle.features}` 
        : '配備這個資訊目前沒有，歡迎來電詢問';
    case 'color':
      return vehicle.color 
        ? `顏色是 ${vehicle.color}` 
        : '顏色這個資訊目前沒有，歡迎來電詢問';
    case 'year':
      return vehicle.modelYear 
        ? `${vehicle.modelYear}年份` 
        : '年份這個資訊目前沒有，歡迎來電詢問';
    case 'availability':
      return '目前還在喔！';
    case 'photos':
      return '想看這台車的照片嗎？點下方「看所有照片」按鈕可以看完整照片，也歡迎直接來店裡看實車！';
    case 'explanation':
      return ''; // Explanation answers are handled by getTermExplanation
    default:
      return '';
  }
}

// ============ VEHICLE DETECTION ============

export interface DetectionResult {
  type: 'inquiry_button' | 'mentioned' | 'context' | 'context_missing' | 'fallback' | 'none';
  vehicle: any | null;
  questionType: QuestionType;
  directAnswer: string;
  termExplanation: string; // Explanation for car terms (e.g., "1.5L 代表...")
}

/**
 * Pre-built search index for fast vehicle lookups.
 * Avoids repeated O(N) scans with .find() during detection.
 */
export interface VehicleIndex {
  byBrandModel: Map<string, any>;     // "BRAND|MODEL" → vehicle
  byModel: Map<string, any>;          // "MODEL" → vehicle (first match)
  byBrand: Map<string, any[]>;        // "BRAND" → [vehicles]
  all: any[];
}

export function buildVehicleIndex(vehicles: any[]): VehicleIndex {
  const byBrandModel = new Map<string, any>();
  const byModel = new Map<string, any>();
  const byBrand = new Map<string, any[]>();

  for (const v of vehicles) {
    const brandUpper = v.brand.toUpperCase();
    const modelUpper = v.model.toUpperCase();
    byBrandModel.set(`${brandUpper}|${modelUpper}`, v);
    if (modelUpper.length >= 2 && !byModel.has(modelUpper)) {
      byModel.set(modelUpper, v);
    }
    const arr = byBrand.get(brandUpper) || [];
    arr.push(v);
    byBrand.set(brandUpper, arr);
  }

  return { byBrandModel, byModel, byBrand, all: vehicles };
}

/**
 * Normalize message for matching: expand aliases, handle case-insensitivity
 */
function normalizeForMatching(message: string): string {
  let normalized = message;
  // Replace Chinese brand names with English equivalents
  for (const [alias, brand] of Object.entries(BRAND_ALIASES)) {
    normalized = normalized.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), brand);
  }
  return normalized;
}

/**
 * Fast indexed lookup: find vehicle by checking brand+model, model-only, or brand-only.
 */
function findVehicleFromNormalized(normalizedUpper: string, index: VehicleIndex, userMessage: string): any | null {
  // Layer 1: brand + model (exact pair in message)
  let found: any | null = null;
  index.byBrandModel.forEach((v, key) => {
    if (found) return;
    const [brand, model] = key.split("|");
    if (normalizedUpper.includes(brand) && normalizedUpper.includes(model)) found = v;
  });
  if (found) return found;

  // Layer 2: model only
  index.byModel.forEach((v, model) => {
    if (found) return;
    if (normalizedUpper.includes(model)) found = v;
  });
  if (found) return found;

  // Layer 3: brand + car keywords
  const carKeywords = /車|多少|價格|cc|排氣|配備|里程|油耗|還在|照片|看看|那台|這台|那個|這個|來看|去看|想看|要看|看車|預約|時間|方便|地址|在哪|店裡|店面|試駕|買|要買|想買|要|想要|嗜|感興趣|有興趣|下訂|訂車/;
  if (carKeywords.test(userMessage)) {
    index.byBrand.forEach((vehicles, brand) => {
      if (found) return;
      if (normalizedUpper.includes(brand) && vehicles.length > 0) found = vehicles[0];
    });
    if (found) return found;
  }

  // Layer 4: brand only if exactly one vehicle of that brand
  index.byBrand.forEach((vehicles, brand) => {
    if (found) return;
    if (normalizedUpper.includes(brand) && vehicles.length === 1) found = vehicles[0];
  });
  return found;
}

// ============ CONTEXT-AWARE DETECTION (Conversation History) ============

/**
 * Patterns that indicate the user is referring to a previously mentioned vehicle.
 * e.g., "那排氣量呢", "這台多少錢", "它的里程", "那個有什麼配備"
 */
const CONTEXT_REFERENCE_PATTERNS = /^(那|這台|那台|這個|那個|它的?|上面那台|剛剛那台|前面那台|同一台)/;
const FOLLOW_UP_PATTERNS = /^(那|所以|然後|還有|另外|對了|請問|想問|想知道|好奇|順便問)/;
const ACKNOWLEDGMENT_PATTERNS = /^(好|嗯|ok|OK|對|是|好的|好啊|好喔|沒問題|可以|行|嗯嗯|👍|🙏|了解|知道了|收到|okok)$/;

/**
 * Check if the current message is a follow-up question about a previously discussed vehicle.
 * Returns true if the message has a question type but no explicit vehicle mention.
 */
function isFollowUpQuestion(message: string, questionType: QuestionType): boolean {
  const lower = message.trim().toLowerCase();

  // Acknowledgments always carry context from previous message
  if (ACKNOWLEDGMENT_PATTERNS.test(lower)) return true;

  // General type without explicit context reference is NOT a follow-up
  if (questionType === 'general') {
    // Exception: explicit context references like "那台怎樣"
    if (CONTEXT_REFERENCE_PATTERNS.test(lower)) return true;
    return false;
  }

  // Explicit context references: "那台", "這台", "它的"
  if (CONTEXT_REFERENCE_PATTERNS.test(lower)) return true;

  // Follow-up starters + question type: "那排氣量呢", "所以多少錢"
  if (FOLLOW_UP_PATTERNS.test(lower)) return true;

  // Short messages with only a question (no vehicle name) are likely follow-ups
  // e.g., "排氣量呢", "多少錢", "有什麼配備"
  // But not TOO loose — require at least a question-like word
  if (message.length <= 10) return true;

  return false;
}

/**
 * Extract the most recently discussed vehicle from conversation history.
 * Scans messages from newest to oldest, looking for vehicle mentions.
 */
export function extractVehicleFromHistory(
  conversationHistory: Array<{ role: string; content: string }>,
  allVehicles: any[]
): any | null {
  if (!conversationHistory || conversationHistory.length === 0) return null;

  // Helper to find vehicle in a message
  const findInMessage = (content: string): any | null => {
    const normalized = normalizeForMatching(content);
    const normalizedUpper = normalized.toUpperCase();

    // Try brand + model
    const found = allVehicles.find(v => {
      const brandUpper = v.brand.toUpperCase();
      const modelUpper = v.model.toUpperCase();
      return normalizedUpper.includes(brandUpper) && normalizedUpper.includes(modelUpper);
    });
    if (found) return found;

    // Try model only (min 2 chars)
    const foundModel = allVehicles.find(v => {
      const modelUpper = v.model.toUpperCase();
      return modelUpper.length >= 2 && normalizedUpper.includes(modelUpper);
    });
    if (foundModel) return foundModel;

    // Try "我想詢問這台車" button format (same regex as main detection)
    const inquiryMatch = content.match(/我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年/);
    if (inquiryMatch) {
      const [, nameStr, yearStr] = inquiryMatch;
      return matchVehicleByName(nameStr, allVehicles, yearStr);
    }

    return null;
  };

  // Two-pass strategy to prevent context bleed:
  // Pass 1: Only search USER messages (most reliable — user explicitly mentioned a vehicle)
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (msg.role !== 'user') continue;
    const found = findInMessage(msg.content || '');
    if (found) {
      console.log(`[VehicleDetection] extractVehicleFromHistory: found ${found.brand} ${found.model} in user message at index ${i}`);
      return found;
    }
  }
  // Pass 2: If no user message has a vehicle, check assistant messages (fallback)
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (msg.role !== 'assistant') continue;
    const found = findInMessage(msg.content || '');
    if (found) {
      console.log(`[VehicleDetection] extractVehicleFromHistory: found ${found.brand} ${found.model} in assistant message at index ${i} (fallback)`);
      return found;
    }
  }

  return null;
}

/**
 * Find a vehicle from the message using multi-layer detection.
 * Now with context awareness: if no vehicle found in current message,
 * check conversation history for the most recently discussed vehicle.
 *
 * Pass an optional `vehicleIndex` (from `buildVehicleIndex`) to skip
 * repeated O(N) scans. Falls back to linear search if index not provided.
 */
/**
 * Shared helper: match a vehicle by name string with 3-tier fallback.
 * 1. Year + name (if yearStr provided)
 * 2. Brand AND model (strict)
 * 3. Brand OR model (loose)
 */
function matchVehicleByName(nameStr: string, allVehicles: any[], yearStr?: string): any | null {
  const nameUpper = nameStr.toUpperCase();

  // Tier 1: year + name
  if (yearStr) {
    const byYear = allVehicles.find(v => {
      const nameMatch = nameStr.includes(v.brand) || nameStr.includes(v.model) || `${v.brand} ${v.model}`.includes(nameStr);
      return nameMatch && String(v.modelYear) === yearStr;
    });
    if (byYear) return byYear;
  }

  // Tier 2: brand AND model
  const strict = allVehicles.find(v =>
    nameUpper.includes(v.brand.toUpperCase()) && nameUpper.includes(v.model.toUpperCase())
  );
  if (strict) return strict;

  // Tier 3: brand only (if exactly one vehicle of that brand — avoids false positives)
  for (const v of allVehicles) {
    if (nameUpper.includes(v.brand.toUpperCase())) {
      const sameBrand = allVehicles.filter(o => o.brand.toUpperCase() === v.brand.toUpperCase());
      if (sameBrand.length === 1) return sameBrand[0];
    }
  }
  return null;
}

export function detectVehicleFromMessage(
  userMessage: string,
  allVehicles: any[],
  conversationHistory?: Array<{ role: string; content: string }>,
  vehicleIndex?: VehicleIndex
): DetectionResult {
  const questionType = detectQuestionType(userMessage);
  const normalized = normalizeForMatching(userMessage);
  const normalizedUpper = normalized.toUpperCase();

  // ============ Layer 1: "我想詢問這台車" button format ============
  // NOTE: Button text contains specs like "1.7L" which would pollute questionType.
  // Force questionType to 'general' for inquiry buttons — the customer is inquiring, not asking a specific question.
  //
  // Two regex variants:
  // 1. Full format with price: "我想詢問這台車：BMW X1 2014年\n售價：37.8 萬"
  // 2. Short format without price: "我想詢問這台車：BMW X1 2014年" (from photo carousel tap)
  // 3. No-price format: price is "面議"/"電洽" (non-numeric)
  // Note: price group is non-capturing — we only need name + year for matching
  const inquiryFullMatch = userMessage.match(/我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年[\s\S]*?售價[：:]\s*[\d.\s]+萬/);
  const inquiryShortMatch = !inquiryFullMatch && userMessage.match(/我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年/);
  const inquiryMatch = inquiryFullMatch || inquiryShortMatch;
  if (inquiryMatch) {
    const [, nameStr, yearStr] = inquiryMatch;
    const matchedVehicle = matchVehicleByName(nameStr, allVehicles, yearStr);
    return { type: 'inquiry_button', vehicle: matchedVehicle, questionType: 'general', directAnswer: '', termExplanation: '' };
  }

  // ============ Layer 1b: "我想了解 {brand} {model}" button format ============
  // From photo carousel fallback, quick reply buttons, etc.
  const learnMatch = userMessage.match(/^我想了解\s+(.+)$/);
  if (learnMatch) {
    const nameStr = learnMatch[1].trim();
    const matchedVehicle = matchVehicleByName(nameStr, allVehicles);
    if (matchedVehicle) {
      return { type: 'inquiry_button', vehicle: matchedVehicle, questionType: 'general', directAnswer: '', termExplanation: '' };
    }
  }

  // ============ Layer 2: Brand + Model mention (indexed or linear) ============
  let mentionedVehicle: any | null = null;
  if (vehicleIndex) {
    mentionedVehicle = findVehicleFromNormalized(normalizedUpper, vehicleIndex, userMessage);
  } else {
    // Fallback: original linear scan (backward compat)
    mentionedVehicle = allVehicles.find(v => {
      const brandUpper = v.brand.toUpperCase();
      const modelUpper = v.model.toUpperCase();
      return normalizedUpper.includes(brandUpper) && normalizedUpper.includes(modelUpper);
    }) || null;
    if (!mentionedVehicle) {
      mentionedVehicle = allVehicles.find(v => {
        const modelUpper = v.model.toUpperCase();
        return modelUpper.length >= 2 && normalizedUpper.includes(modelUpper);
      }) || null;
    }
    if (!mentionedVehicle) {
      const carKeywords = /車|多少|價格|cc|排氣|配備|里程|油耗|還在|照片|看看|那台|這台|那個|這個|來看|去看|想看|要看|看車|預約|時間|方便|地址|在哪|店裡|店面|試駕|買|要買|想買|要|想要|嗜|感興趣|有興趣|下訂|訂車/;
      if (carKeywords.test(userMessage)) {
        mentionedVehicle = allVehicles.find(v => normalizedUpper.includes(v.brand.toUpperCase())) || null;
      }
    }
    if (!mentionedVehicle) {
      const brandMatch = allVehicles.filter(v => normalizedUpper.includes(v.brand.toUpperCase()));
      if (brandMatch.length === 1) mentionedVehicle = brandMatch[0];
    }
  }

  if (mentionedVehicle) {
    const directAnswer = getQuestionAnswer(mentionedVehicle, questionType);
    const termExplanation = getTermExplanation(userMessage, mentionedVehicle);
    return { type: 'mentioned', vehicle: mentionedVehicle, questionType, directAnswer, termExplanation };
  }

  // ============ Layer 3: Contains "我想詢問這台車" but no match ============
  if (userMessage.includes('我想詢問這台車')) {
    return { type: 'fallback', vehicle: null, questionType, directAnswer: '', termExplanation: '' };
  }

  // ============ Layer 4: Context-aware detection from conversation history ============
  if (conversationHistory && conversationHistory.length > 0) {
    if (isFollowUpQuestion(userMessage, questionType)) {
      const historyVehicle = extractVehicleFromHistory(conversationHistory, allVehicles);
      if (historyVehicle) {
        const directAnswer = getQuestionAnswer(historyVehicle, questionType);
        const termExplanation = getTermExplanation(userMessage, historyVehicle);
        console.log(`[VehicleDetection] Context-aware: resolved "${userMessage}" to ${historyVehicle.brand} ${historyVehicle.model} from conversation history`);
        return { type: 'context', vehicle: historyVehicle, questionType, directAnswer, termExplanation };
      }
      // Follow-up detected but no vehicle in history → special fallback
      // So LLM knows to ask "你問的是哪一台呢？" instead of giving a generic greeting
      console.log(`[VehicleDetection] Follow-up question detected but no vehicle in history: "${userMessage}"`);
      return { type: 'context_missing', vehicle: null, questionType, directAnswer: '', termExplanation: '' };
    }
  }

  return { type: 'none', vehicle: null, questionType, directAnswer: '', termExplanation: '' };
}

// ============ PROMPT BUILDING ============

/**
 * Build the vehicle knowledge base.
 * When a target vehicle is detected, show its FULL details prominently
 * and abbreviate other vehicles to reduce noise.
 */
export function buildSmartVehicleKB(
  allVehicles: any[],
  targetVehicle: any | null
): string {
  if (!allVehicles.length) return '目前沒有在售車輛。';
  
  if (!targetVehicle) {
    // No target vehicle — show all vehicles with full details
    return allVehicles.map(v => {
      const parts = [
        `【${v.brand} ${v.model}】`,
        `售價：${v.priceDisplay || v.price + '萬'}`,
        `年份：${v.modelYear}年`,
        v.color ? `顏色：${v.color}` : '',
        v.mileage ? `里程：${v.mileage}` : '',
        v.displacement ? `排氣量：${v.displacement}` : '',
        v.transmission ? `變速箱：${v.transmission}` : '',
        v.fuelType ? `燃料：${v.fuelType}` : '',
        v.bodyType ? `車型：${v.bodyType}` : '',
        v.features ? `配備：${v.features}` : '',
        v.description ? `描述：${v.description}` : '',
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n---\n\n');
  }
  
  // Target vehicle detected — show it prominently, abbreviate others
  const targetParts = [
    `★★★ 客人詢問的車 ★★★`,
    `【${targetVehicle.brand} ${targetVehicle.model}】`,
    `售價：${targetVehicle.priceDisplay || targetVehicle.price + '萬'}`,
    `年份：${targetVehicle.modelYear}年`,
    targetVehicle.color ? `顏色：${targetVehicle.color}` : '',
    targetVehicle.mileage ? `里程：${targetVehicle.mileage}` : '',
    targetVehicle.displacement ? `排氣量：${targetVehicle.displacement}` : '',
    targetVehicle.transmission ? `變速箱：${targetVehicle.transmission}` : '',
    targetVehicle.fuelType ? `燃料：${targetVehicle.fuelType}` : '',
    targetVehicle.bodyType ? `車型：${targetVehicle.bodyType}` : '',
    targetVehicle.features ? `配備：${targetVehicle.features}` : '',
    targetVehicle.guarantees ? `認證/保障：${targetVehicle.guarantees}` : '',
    targetVehicle.description ? `描述：${targetVehicle.description}` : '',
    targetVehicle.licenseDate ? `出廠日期：${targetVehicle.licenseDate}` : '',
    `★★★★★★★★★★★★★★★`,
  ].filter(Boolean).join('\n');
  
  // Other vehicles — brief one-liner each
  const otherVehicles = allVehicles
    .filter(v => v.id !== targetVehicle.id)
    .map(v => `${v.brand} ${v.model} ${v.modelYear}年 ${v.priceDisplay || v.price + '萬'}`)
    .join('\n');
  
  return `${targetParts}\n\n其他在售車輛（簡列）：\n${otherVehicles}`;
}

/**
 * Build the targetVehiclePrompt that goes at the END of the system prompt.
 * This is the most critical part — it must be the LAST thing the LLM reads
 * to leverage recency bias.
 * 
 * customerContact: pass the customer's phone if already on file, so the AI
 *   knows whether to ask for it or skip.
 */
export function buildTargetVehiclePrompt(
  detection: DetectionResult,
  userMessage: string,
  customerContact?: string | null
): string {
  if (detection.type === 'none') return '';
  
  const v = detection.vehicle;
  const questionType = detection.questionType;
  const directAnswer = detection.directAnswer;
  
  const termExplanation = detection.termExplanation;
  
  if (detection.type === 'inquiry_button' && v) {
    // === HIGH-INTENT INQUIRY ===
    // Customer clicked the inquiry button — intent is crystal clear.
    // Strategy: affirm + 1 highlight + 3 engaging questions for the customer to pick from
    const specs = [
      v.modelYear ? `${v.modelYear}年` : '',
      v.displacement || '',
      v.mileage ? `里程${v.mileage}` : '',
    ].filter(Boolean).join('、');

    const phoneNote = customerContact
      ? `（客人已留電話 ${customerContact}，不用再問）`
      : '';

    return `

## ❗❗❗ 最後指令（最高優先級）❗❗❗

客人點了「詢問這台車」按鈕：【${v.brand} ${v.model}】（${specs}，售價${v.priceDisplay || v.price + '萬'}）
${phoneNote}

你必須按照以下範本回覆（可以微調用詞但結構不變）：

範本：「[稱呼]這台${v.model}（${specs}）${v.priceDisplay || v.price + '萬'}眼光不錯！想了解[面向A]、[面向B]、還是[面向C]呢？🚗」

面向選擇（從以下挑3個最適合的）：
- 車況細節／保養紀錄
- 預約來店看車試駕
- 貸款分期方案
- 實車照片
- 配備亮點
- 跟同級車比較

規則：
- 一段話，不分段不換行，不用句點（。），不用markdown
- 絕對禁止推薦其他車款`;
  }

  if (detection.type === 'inquiry_button' && !v) {
    // Customer clicked inquiry button but the vehicle is not in our DB (e.g. already sold)
    // Extract car info directly from the user's message to acknowledge correctly
    return `

## ❗❗❗ 最後指令（最高優先級）❗❗❗

客人點了「詢問這台車」按鈕，但這台車目前不在我們的庫存中（可能已售出）
客人的原始訊息：「${userMessage}」

回覆規則：
1. 先告訴客人這台車目前已經不在庫存了（可能已售出）
2. 問客人有沒有想找類似的車款，或有什麼其他條件
3. 可以建議看看目前的在售車輛（「看車庫存」）
4. 一段話，不分段不換行，不用句點（。），不用markdown
5. 絕對不要回覆其他車的資訊，除非客人主動問`;
  }

  if (detection.type === 'mentioned' && v) {
    return `

## ❗❗❗ 最後指令（最高優先級）❗❗❗

客人正在問：【${v.brand} ${v.model}】
客人的原始訊息：「${userMessage}」
${directAnswer ? `客人的問題類型：${questionType}，直接答案：${directAnswer}` : ''}
${termExplanation ? `術語解釋（用白話告訴客人）：${termExplanation}` : ''}

車輛資料：售價${v.priceDisplay || v.price + '萬'}、${v.modelYear}年、${v.displacement || ''}、里程${v.mileage || '未標示'}、${v.color || ''}、${v.transmission || ''}

回覆規則：
1. 直接回答客人的問題${directAnswer ? `（${directAnswer}）` : ''}，然後提供3個不同面向讓客人選擇繼續聊
2. 只能用上面有的資料，不能編造
3. 一段話，不分段不換行，不用句點（。），不用markdown
4. 禁止推薦其他車款`;
  }

  if (detection.type === 'context' && v) {
    return `

## ❗❗❗ 最後指令（最高優先級）❗❗❗

客人之前在問【${v.brand} ${v.model}】，現在跟進問了一個問題
客人的原始訊息：「${userMessage}」
${directAnswer ? `客人的問題類型：${questionType}，直接答案：${directAnswer}` : ''}
${termExplanation ? `術語解釋（用白話告訴客人）：${termExplanation}` : ''}

車輛資料：售價${v.priceDisplay || v.price + '萬'}、${v.modelYear}年、${v.displacement || ''}、里程${v.mileage || '未標示'}、${v.color || ''}、${v.transmission || ''}

回覆規則：
1. 如果這個問題之前已經回答過（例如售價已經在車輛卡片或之前的訊息提過），用「誠如剛剛說的，${directAnswer || '...'}」帶過，然後進一步問客人還想了解這台車的什麼資訊
2. 如果是新問題，直接回答${directAnswer ? `（${directAnswer}）` : ''}，然後問客人還想進一步了解什麼
3. 只能用上面有的資料，不能編造
4. 一段話，不分段不換行，不用句點（。），不用markdown
5. 禁止推薦其他車款`;
  }

  if (detection.type === 'context_missing') {
    return `

## ❗❗❗ 最後指令（最高優先級）❗❗❗

客人似乎在問跟進問題，但我們不確定他問的是哪台車
客人的原始訊息：「${userMessage}」

回覆規則：
1. 自然地問客人「你問的是哪一台呢？」或「你想了解哪台車呢？」
2. 可以列出我們目前在售的車款讓客人選
3. 一段話，不分段不換行，不用句點（。），不用markdown
4. 語氣親切自然`;
  }

  if (detection.type === 'fallback') {
    return `

## ❗❗❗ 最後指令（最高優先級，覆蓋所有其他規則）❗❗❗

客人正在詢問特定車輛！
客人的原始訊息：「${userMessage}」

你的回覆規則：
1. 從上方「在售車輛」清單中找到客人詢問的車款
2. 只能用清單中有的資料來介紹，不能編造
3. 引導來店看車或留電話
4. 🚫🚫🚫 絕對禁止推薦其他車款！客人問的就是這台！🚫🚫🚫`;
  }
  
  return '';
}


// ============ INTENT DETECTION + INSTRUCTION INJECTION ============
// 
// Root cause of all "答非所問" issues:
// System prompt is 500+ lines. Rules in the MIDDLE get ignored by LLM ("lost in the middle").
// Solution: Detect customer INTENT from their message, then inject focused instructions
// at the END of the system prompt where LLM pays most attention (recency bias).
//

export type CustomerIntent = 
  | 'appointment'       // 預約看車、約時間
  | 'address'           // 問地址、怎麼去
  | 'phone'             // 問電話
  | 'hours'             // 問營業時間
  | 'greeting'          // 打招呼
  | 'price_negotiation' // 議價、殺價
  | 'loan'              // 貸款、分期
  | 'providing_contact' // 客人正在提供電話號碼
  | 'how_to_browse'     // 怎麼看車、怎麼瀏覽
  | 'vehicle_spec'      // 車輛規格（由 vehicleDetection 處理）
  | 'general_browse'    // 一般瀏覽、推薦
  | 'pricing'           // 問價格、多少錢
  ;

/**
 * Detect ALL intents from a customer message (can have multiple).
 * This is separate from vehicle detection — it detects WHAT the customer wants to DO.
 */
export function detectCustomerIntents(message: string): CustomerIntent[] {
  const intents: CustomerIntent[] = [];
  const lower = message.toLowerCase();
  
  // Appointment / visit intent
  if (/預約|約[個一]|看車|賞車|試駕|試乘|什麼時候.*方便|什麼時候.*過去|什麼時候.*去|什麼時候.*可以|幾點.*方便|幾點.*可以|明天.*去|明天.*看|後天.*去|後天.*看|禮拜.*去|禮拜.*看|週末.*去|週末.*看|平日.*去|平日.*看|上午.*去|上午.*看|下午.*去|下午.*看|晚上.*去|晚上.*看|想去.*看|想過去|想去你們|去你們那|去你們店|去店裡|到店|過去看|去看/.test(lower)) {
    intents.push('appointment');
  }
  
  // Address intent
  if (/地址|在哪|怎麼走|怎麼去|哪裡|位置|位在|店在|店面在|導航|路線/.test(lower)) {
    intents.push('address');
  }
  
  // Providing contact intent — customer is GIVING their phone number
  // Must check BEFORE phone intent to avoid conflict
  const hasPhoneNumber = /0\d{8,9}|09\d{8}|\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}/.test(lower);
  const isProvidingPhone = hasPhoneNumber && /我的|我|電話是|手機是|號碼是|給你|留|打這支|聯繫我|聯絡我|打給我/.test(lower);
  
  if (isProvidingPhone) {
    intents.push('providing_contact');
  }
  
  // Phone intent — customer is ASKING for the store's phone number
  // Only trigger if NOT providing their own number
  if (!isProvidingPhone && /電話|手機|號碼|打給|聯繫|聯絡方式|怎麼聯繫|怎麼聯絡/.test(lower)) {
    intents.push('phone');
  }
  
  // Business hours intent
  if (/營業時間|幾點開|幾點關|幾點到幾點|開到幾點|什麼時候開|什麼時候營業|休息|公休|有開嗎|有營業/.test(lower)) {
    intents.push('hours');
  }
  
  // Greeting intent
  if (/^(你好|哈囉|嗨|hi|hello|hey|早安|午安|晚安|安安|在嗎|請問|不好意思)[\s！!。？?]*$/i.test(lower.trim())) {
    intents.push('greeting');
  }
  
  // Price negotiation intent
  if (/殺價|議價|便宜一點|算便宜|打折|折扣|優惠|最低|底價|能不能.*便宜|可以.*便宜|再少|降價/.test(lower)) {
    intents.push('price_negotiation');
  }
  
  // Loan intent
  if (/貸款|分期|月付|頭期|零利率|利率|車貸|信貸|全額|付款方式/.test(lower)) {
    intents.push('loan');
  }
  
  // How to browse intent — customer asking how to view cars/photos/inventory
  if (/怎麼看|怎麼瀏覽|在哪看|在哪裡看|哪裡看|如何看|如何瀏覽|怎麼查|怎麼找|看不到|找不到|要怎麼|有什麼車|有哪些車|車子在哪|庫存在哪|哪裡可以看|可以看車|想看車|看一下車|看看車|看你們的車/.test(lower)) {
    intents.push('how_to_browse');
  }

  // Pricing intent — customer asking about price
  if (/多少錢|價格|價位|售價|報價|幾萬|多少萬|什麼價|賣多少/.test(lower)) {
    intents.push('pricing');
  }

  return intents;
}

/**
 * Build intent-based instruction injection.
 * This goes at the VERY END of the system prompt, after targetVehiclePrompt.
 * It tells the LLM exactly what to do based on detected intents.
 */
export function buildIntentInstructions(
  intents: CustomerIntent[],
  userMessage: string,
  greeting: string,
  customerContact?: string | null,
  detectedVehicle?: any | null
): string {
  if (intents.length === 0) {
    // No specific intent detected — provide a default instruction so LLM doesn't repeat greetings
    return `

## 回覆指引
客人的訊息：「${userMessage}」
沒有偵測到特定意圖，請根據訊息內容自然回應
🔴 不要重複打招呼！不要說「你好」「歡迎」！直接回應客人說的內容就好
🔴 如果不確定客人想問什麼，簡短回應並引導：「${greeting}想了解什麼車款呢？或者點下方選單看看我們的庫存🚗」`;
  }

  const instructions: string[] = [];

  // ============ VEHICLE SPEC DETAIL INTENT ============
  // When customer asks for detailed specs (e.g. clicks "了解車子細節/規格" button)
  if (detectedVehicle && /詳細規格|規格|細節|配備|詳細|了解.*規格/.test(userMessage)) {
    // Build the spec lines directly from vehicle data — don't rely on LLM to extract from KB
    const v = detectedVehicle;
    const specLines: string[] = [
      `${v.brand} ${v.model}`,
      '',
      `售價：${v.priceDisplay || v.price + '萬'}`,
    ];
    if (v.modelYear) specLines.push(`年份：${v.modelYear}年`);
    if (v.licenseDate) specLines.push(`出廠日期：${v.licenseDate}`);
    if (v.color) specLines.push(`顏色：${v.color}`);
    if (v.mileage) specLines.push(`里程：${v.mileage}`);
    if (v.displacement) specLines.push(`排氣量：${v.displacement}`);
    if (v.transmission) specLines.push(`變速箱：${v.transmission}`);
    if (v.fuelType) specLines.push(`燃料：${v.fuelType}`);
    if (v.bodyType) specLines.push(`車型：${v.bodyType}`);
    if (v.features) specLines.push(`配備：${v.features}`);
    if (v.guarantees) specLines.push(`認證/保障：${v.guarantees}`);
    if (v.description) specLines.push(`\n${v.description}`);
    specLines.push('');
    specLines.push('想進一步了解或預約看車，隨時跟我說！');

    const prebuiltResponse = specLines.join('\n');

    instructions.push(`🔴🔴🔴 車輛規格查詢指令（最高優先級！必須一字不差照抄！）🔴🔴🔴
客人要看車輛規格！你必須「完整照抄」以下內容，不能省略任何一行、不能改寫、不能加emoji、不能加開場白：

${prebuiltResponse}

🔴 以上就是你的完整回覆！一字不差照抄！不要加任何其他內容！`);
  }

  // ============ APPOINTMENT INTENT ============
  if (intents.includes('appointment')) {
    const vehicleCtx = detectedVehicle ? `\n【⭐ 客人要預約看的車：${detectedVehicle.brand} ${detectedVehicle.model}】只能談這台車！` : '';
    // Detect time period from message
    const lower = userMessage.toLowerCase();
    
    // Check if specific time is mentioned (e.g., "2點", "14:00")
    const specificTime = lower.match(/(\d{1,2})[點:：時]|(\d{1,2}:\d{2})/);
    
    if (specificTime) {
      // Customer mentioned a specific time
      const phonePart = customerContact
        ? `客人已留電話 ${customerContact}，告知我們業務會盡快聯繫。`
        : `🔴 客人還沒留電話！確認時間後直接要聯絡資料`;
      instructions.push(`🔴 預約指令：客人提到了具體時間，直接確認該時間。${vehicleCtx}
${phonePart}
🔴 必須用以下格式回覆（每段之間空一行）：

想來看車太好了！請問哪個時段方便呢？

上午10-11、
下午14-15、
晚上18-19

方便留個簡單資料嗎？

姓名：
電話：
看車以上3個時段選一：

地址高雄市三民區大順二路269號（肯德基斜對面）

🚫 不要推薦車款！客人要的是預約，不是推薦！`);
    } else {
      // No specific time — show time slots + ask for contact info
      instructions.push(`🔴 預約看車指令（最高優先級！）：
客人想預約看車！動機明確！${vehicleCtx}
🔴🔴🔴 必須嚴格按照以下格式回覆（每段之間空一行）：🔴🔴🔴

想來看車太好了！請問哪個時段方便呢？

上午10-11、
下午14-15、
晚上18-19

方便留個簡單資料嗎？

姓名：
電話：
看車以上3個時段選一：

地址高雄市三民區大順二路269號（肯德基斜對面）

🚫🚫🚫 絕對禁止推薦車款！客人要的是預約，不是推薦！🚫🚫🚫
🚫🚫🚫 絕對禁止自己編造不同的格式！必須照上面格式回覆！🚫🚫🚫`);
    }
  }
  
  // ============ ADDRESS INTENT ============
  if (intents.includes('address')) {
    instructions.push(`🔴 地址指令（必須遵守！）：
客人問地址！你必須回答：
地址：高雄市三民區大順二路269號（肯德基斜對面）📍
Google 地圖：https://maps.google.com/?q=高雄市三民區大順二路269號
🚫 絕對禁止不回答地址！`);
  }
  
  // ============ PHONE INTENT ============
  if (intents.includes('phone')) {
    instructions.push(`🔴 電話指令（必須遵守！）：
客人問電話！你必須回答：
預約賞車電話：0936-812-818 賴先生 📞
🚫 絕對禁止不回答電話！`);
  }
  
  // ============ HOURS INTENT ============
  if (intents.includes('hours')) {
    instructions.push(`🔴 營業時間指令（必須遵守！）：
客人問營業時間！你必須回答：
營業時間：週一至週六 9:00-20:00
🚫 絕對禁止不回答營業時間！`);
  }
  
  // ============ PROVIDING CONTACT INTENT ============
  if (intents.includes('providing_contact')) {
    // Extract the phone number from the message
    const phoneMatch = userMessage.match(/0\d{8,9}|09\d{8}|\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}/);
    const phoneNum = phoneMatch ? phoneMatch[0] : '(已留電話)';
    
    instructions.push(`🔴 客人留電話指令（必須遵守！）：
客人剛剛留了電話號碼 ${phoneNum}！你必須：
1. 感謝客人留電話（例如：「好的，我已經記下${greeting}的電話了！」）
2. 確認我們業務會盡快聯繫（例如：「我們業務會盡快打給你確認細節！」）
3. 如果客人之前有問過車款，可以簡短提一下「到時候可以一起看看那台車」

🚫 絕對禁止：不確認電話就推薦車款！客人留電話是超高意願的表現，你要先確認電話再說其他！`);
  }
  
  // ============ LOAN INTENT ============
  if (intents.includes('loan')) {
    const vehicleInfo = detectedVehicle ? `${detectedVehicle.brand} ${detectedVehicle.model}` : '';
    const vehicleLine = vehicleInfo ? `提到客人問的車：${vehicleInfo}，` : '';
    instructions.push(`🔴 貸款指令：
客人問貸款！你必須用以下格式回覆（${vehicleLine}加上「是台好車」鼓勵）：

${vehicleInfo || '（車款名稱）'}是台好車！
方便留個電話嗎？
賴先生可以直接跟你詳細介紹！

姓名：
電話：
方便通話時間：

🔴 必須包含「姓名：」「電話：」「方便通話時間：」三個欄位！
🔴 如果有偵測到車輛資訊（年份、排量、里程、售價），放在車款名稱後面的括號裡
🔴 格式範例：Hyundai Tucson（2016年、2.0L、里程10萬公里）售價29.8萬是台好車！`);
  }
  
  // ============ HOW TO BROWSE INTENT ============
  if (intents.includes('how_to_browse')) {
    instructions.push(`🔴 瀏覽引導指令（必須遵守！）：
客人在問怎麼看車/怎麼瀏覽！你必須引導客人使用下方選單：
「${greeting}點聊天室下方的『📋 點我開啟選單』，裡面有：
🚗 看車庫存 — 瀏覽所有在售車輛的照片和詳細資訊
📅 預約賞車 — 安排到店看車時間
📞 聯絡我們 — 直接撥打電話諮詢
⭐ 熱門推薦 — 精選人氣車款
💰 50萬以下 — 超值好車推薦
📍 導航到店 — 一鍵開啟 Google Maps

直接點就可以囉！很方便的👍」
🚫 絕對禁止不引導客人用選單！`);
  }
  
  if (instructions.length === 0) return '';
  
  // Multi-intent reminder
  const multiIntentReminder = instructions.length > 1 
    ? `\n\n⚠️⚠️⚠️ 客人同時問了 ${instructions.length} 個問題，你必須「每個都回答」！不能只回答其中一個！⚠️⚠️⚠️`
    : '';
  
  return `

## ❗❗❗ 客人意圖偵測結果 — 最後指令（最高優先級）❗❗❗

客人的原始訊息：「${userMessage}」
偵測到的意圖：${intents.join(', ')}

${instructions.join('\n\n')}${multiIntentReminder}

🚫🚫🚫 以上指令覆蓋所有其他規則！必須先回答客人的問題，才能做其他事！🚫🚫🚫`;
}
