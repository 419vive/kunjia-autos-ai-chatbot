import { ENV } from "./_core/env";
import { createLogger } from "./_core/logger";

const log = createLogger("LINE");

// ============ PHONE NUMBER DETECTION ============

// Detect Taiwan mobile phone numbers from chat messages
// Supports: 0912345678, 0912-345-678, 09 1234 5678, +886912345678, etc.
export function detectPhoneNumber(text: string): string | null {
  // Taiwan mobile patterns
  const patterns = [
    /(?:\+886|886)[\s-]?0?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
    /09\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
    /09\d{2}[\s-]?\d{6}/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Normalize to 09xx-xxx-xxx format
      const raw = match[0].replace(/[\s-+]/g, '');
      let digits = raw;
      if (digits.startsWith('886')) {
        digits = '0' + digits.slice(3);
      }
      if (digits.length === 10 && digits.startsWith('09')) {
        return `${digits.slice(0,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
      }
    }
  }

  // Also detect landline numbers (07-xxx-xxxx, 02-xxxx-xxxx, etc.)
  const landlineMatch = text.match(/0[2-9][\s-]?\d{3,4}[\s-]?\d{4}/);
  if (landlineMatch) {
    const raw = landlineMatch[0].replace(/[\s-]/g, '');
    if (raw.length >= 9 && raw.length <= 10) {
      return raw;
    }
  }

  return null;
}

// ============ GENDER DETECTION FROM NAME ============

// Detect gender from customer display name using common Chinese name patterns
export function detectGenderFromName(name: string | null): 'male' | 'female' | 'unknown' {
  if (!name) return 'unknown';

  const cleanName = name.trim();
  if (!cleanName) return 'unknown';

  // Common female indicators in Chinese names
  const femalePatterns = [
    /女士/, /小姐/, /媽媽/, /阿姨/, /姐姐/, /妹妹/, /嫂/,
    /太太/, /夫人/, /姑姑/, /婆婆/, /阿嬤/, /奶奶/,
  ];

  // Common male indicators in Chinese names
  const malePatterns = [
    /先生/, /大哥/, /爸爸/, /叔叔/, /伯伯/, /哥哥/, /弟弟/,
    /阿伯/, /阿公/, /爺爺/, /老闆/,
  ];

  for (const p of femalePatterns) {
    if (p.test(cleanName)) return 'female';
  }
  for (const p of malePatterns) {
    if (p.test(cleanName)) return 'male';
  }

  // Check last character of name for common gender-specific characters
  // (only if name looks like a Chinese name, 2-4 characters)
  if (/^[\u4e00-\u9fff]{2,4}$/.test(cleanName)) {
    const lastChar = cleanName[cleanName.length - 1];
    const secondChar = cleanName.length >= 2 ? cleanName[cleanName.length - 2] : '';

    // Common female name characters
    const femaleChars = '美麗娟芳萍婷玲珍雅惠淑芬蘭英華玉秀芝蓉琴嬌嫻靜慧瑩瑤琳珊蕙薇蓮菊瑜彤妍姿婉嫣韻';
    // Common male name characters
    const maleChars = '雄偉強剛明志豪傑龍勇軍輝鵬飛武斌鑫磊峰彪昌棟柱亮宏達建國榮勝德福財旺';

    if (femaleChars.includes(lastChar)) return 'female';
    if (maleChars.includes(lastChar)) return 'male';
    if (femaleChars.includes(secondChar)) return 'female';
    if (maleChars.includes(secondChar)) return 'male';
  }

  return 'unknown';
}

// Get the appropriate greeting based on gender (fallback when no name)
export function getGenderGreeting(gender: 'male' | 'female' | 'unknown'): string {
  switch (gender) {
    case 'male': return '大哥';
    case 'female': return '小姐';
    case 'unknown': return '人客';
  }
}

// Get a friendly name-based greeting from customer's display name
// e.g., "王雅玲" → "雅玲", "小明" → "小明", "John" → "John"
export function getNameGreeting(name: string | null, gender: 'male' | 'female' | 'unknown'): string {
  if (!name || !name.trim()) return getGenderGreeting(gender);

  const clean = name.trim();

  // Pure Chinese name: extract given name
  if (/^[\u4e00-\u9fff]{2,4}$/.test(clean)) {
    if (clean.length === 2) return clean; // 2-char name: use full name (e.g., "雅玲")
    if (clean.length === 3) return clean.slice(1); // 3-char: use given name (e.g., "王雅玲" → "雅玲")
    if (clean.length === 4) return clean.slice(2); // 4-char: use last 2 (e.g., "司馬相如" → "相如")
  }

  // Mixed or non-Chinese name: use as-is if short, otherwise truncate
  if (clean.length <= 10) return clean;
  return getGenderGreeting(gender);
}

// ============ TYPING INDICATOR ============
// Show "typing..." animation in LINE chat while bot is processing

export async function showTypingIndicator(userId: string, channelAccessToken: string) {
  try {
    await fetch("https://api.line.me/v2/bot/chat/loading", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        chatId: userId,
        loadingSeconds: 20, // Show for up to 20 seconds (cancelled when reply is sent)
      }),
    });
  } catch {
    // Non-critical, silently ignore
  }
}

// ============ IMAGE VEHICLE RECOGNITION ============
// Download image from LINE and use Gemini Vision to identify the vehicle

export async function downloadLineImage(messageId: string, channelAccessToken: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    });
    if (!res.ok) {
      log.error("Image download failed", { status: res.status });
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err) {
    log.error("Image download error", err);
    return null;
  }
}

export async function identifyVehicleFromImage(imageBase64: string): Promise<{ brand: string; model: string } | null> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.googleAiApiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        max_completion_tokens: 1024,
        reasoning_effort: "none",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: '請分析這張圖片，找出任何車輛相關資訊。可能的情境包括：\n1. 直接的車輛照片 → 從外觀辨識品牌、車型\n2. 社群媒體貼文截圖（Facebook、IG等）→ 從貼文文字中擷取車輛資訊\n3. 車輛刊登/廣告截圖 → 從文字內容擷取品牌、車型、價格\n4. 車牌照片 → 辨識車牌號碼\n5. 行照 → 辨識行照上的資訊\n\n不管是哪種情境，只要能找到車輛品牌和車型，就回覆 JSON：\n{"brand":"品牌","model":"車型","year":"約2020","color":"白色","condition":"外觀良好","price":"69.8萬","plate":"ABC-1234"}\n\n重要：如果圖中的文字提到車輛品牌和車型（例如「Corolla Cross」、「Toyota RAV4」），即使圖片本身沒有車，也要從文字擷取並回覆。\n如果無法辨識某項就留空字串。如果完全找不到任何車輛資訊，回覆 {"brand":"","model":""}。不要回覆其他文字。',
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      log.error("Gemini Vision error", { status: res.status, body: errorBody.substring(0, 300) });
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    log.debug("Gemini Vision raw response", { content: content.substring(0, 500) });

    // Extract JSON from response (may have markdown code block wrapping)
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.brand && parsed.model) {
      const result: any = { brand: parsed.brand, model: parsed.model };
      if (parsed.year) result.year = parsed.year;
      if (parsed.color) result.color = parsed.color;
      if (parsed.condition) result.condition = parsed.condition;
      if (parsed.plate) result.plate = parsed.plate;
      if (parsed.price) result.price = parsed.price;
      return result;
    }
    return null;
  } catch (err) {
    log.error("Vision identification error", err);
    return null;
  }
}

export function findMatchingVehicles(
  identified: { brand: string; model: string },
  allVehicles: any[]
): any[] {
  const brandLower = identified.brand.toLowerCase();
  const modelLower = identified.model.toLowerCase();

  return allVehicles.filter((v) => {
    if (v.status !== "available") return false;
    const vBrand = (v.brand || "").toLowerCase();
    const vModel = (v.model || "").toLowerCase();
    // Match brand (fuzzy: contains or contained-by)
    const brandMatch = vBrand.includes(brandLower) || brandLower.includes(vBrand);
    // Match model (fuzzy: contains or contained-by)
    const modelMatch = vModel.includes(modelLower) || modelLower.includes(vModel);
    return brandMatch && modelMatch;
  });
}

// ============ MESSAGE DEDUPLICATION ============
// Prevent duplicate processing when LINE retries webhook delivery

const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 60_000; // 1 minute

export function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  // Clean old entries
  processedMessages.forEach((ts, id) => {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id);
  });
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}
