import { Router, Request, Response } from "express";
import crypto from "crypto";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { detectRichMenuTrigger, buildRichMenuResponseMessages, detectPhotoTrigger, buildPhotoCarousel, buildFollowWelcomeMessages, buildFaqCarousel, detectFaqTrigger, buildFaqAnswerMessages, buildContextualQuickReply, buildVehicleCarouselMessages, type ConversationContext } from "./lineFlexTemplates";
import { formatTimeSlotsForPrompt } from "./timeSlotHelper";
import { detectVehicleFromMessage, buildSmartVehicleKB, buildTargetVehiclePrompt, detectCustomerIntents, buildIntentInstructions } from "./vehicleDetectionService";
import { buildLLMMessages, type PromptContext } from "./dynamicPromptBuilder";
import { isRuleBasedMode, generateRuleBasedReply } from "./ruleBasedReply";

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

// Get the appropriate greeting based on gender
export function getGenderGreeting(gender: 'male' | 'female' | 'unknown'): string {
  switch (gender) {
    case 'male': return '大哥';
    case 'female': return '小姐';
    case 'unknown': return '人客';
  }
}

// ============ TYPING INDICATOR ============
// Show "typing..." animation in LINE chat while bot is processing

async function showTypingIndicator(userId: string, channelAccessToken: string) {
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

async function downloadLineImage(messageId: string, channelAccessToken: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    });
    if (!res.ok) {
      console.error(`[LINE Image] Download failed: ${res.status}`);
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err) {
    console.error("[LINE Image] Download error:", err);
    return null;
  }
}

async function identifyVehicleFromImage(imageBase64: string): Promise<{ brand: string; model: string } | null> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.googleAiApiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: '這張圖片裡有車嗎？如果有，請辨識車輛的品牌(brand)和車型(model)。只回覆 JSON 格式：{"brand":"品牌","model":"車型"}。如果無法辨識或圖中沒有車，回覆 {"brand":"","model":""}。不要回覆其他文字。',
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
      console.error(`[LINE Image] Gemini Vision error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("[LINE Image] Gemini Vision raw response:", content.substring(0, 200));

    // Extract JSON from response (may have markdown code block wrapping)
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.brand && parsed.model) {
      return { brand: parsed.brand, model: parsed.model };
    }
    return null;
  } catch (err) {
    console.error("[LINE Image] Vision identification error:", err);
    return null;
  }
}

function findMatchingVehicles(
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

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  // Clean old entries
  processedMessages.forEach((ts, id) => {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id);
  });
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}

const lineRouter = Router();

// LINE Webhook verification & message handling
// Route matches the Webhook URL set in LINE Developers Console: /api/line/webhook
lineRouter.post("/api/line/webhook", async (req: Request, res: Response) => {
  console.log("[LINE Webhook] Received request");
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const ownerUserId = process.env.LINE_OWNER_USER_ID;

    if (!channelSecret || !channelAccessToken) {
      console.warn("[LINE] Missing LINE credentials, skipping webhook");
      res.status(200).json({ status: "ok", message: "LINE not configured" });
      return;
    }

    // Verify signature using raw body string (SECURITY: reject invalid signatures)
    const signature = req.headers["x-line-signature"] as string;
    if (!signature) {
      console.warn("[LINE] Missing x-line-signature header, rejecting request");
      res.status(200).json({ status: "ok" }); // Return 200 to avoid LINE retries
      return;
    }
    const bodyStr = (req as any).rawBody || JSON.stringify(req.body);
    const hash = crypto
      .createHmac("SHA256", channelSecret)
      .update(bodyStr)
      .digest("base64");
    // Use timing-safe comparison to prevent timing attacks
    const sigValid = hash.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    if (!sigValid) {
      console.warn("[LINE] Invalid webhook signature, rejecting request");
      res.status(200).json({ status: "ok" }); // Return 200 to avoid LINE retries
      return;
    }

    const events = req.body?.events || [];
    console.log(`[LINE Webhook] Processing ${events.length} events`);

    // Respond immediately to LINE (LINE requires 200 within 1 second)
    res.status(200).json({ status: "ok" });

    // Process events asynchronously after responding
    for (const event of events) {
      try {
        await processLineEvent(event, channelAccessToken, ownerUserId);
      } catch (err) {
        console.error("[LINE] Error processing event:", err);
      }
    }
  } catch (err) {
    console.error("[LINE Webhook] Error:", err);
    if (!res.headersSent) {
      res.status(200).json({ status: "ok" });
    }
  }
});

async function processLineEvent(
  event: any,
  channelAccessToken: string,
  ownerUserId?: string
) {
  // ============ UNFOLLOW EVENT: Track unfollow ============
  if (event.type === "unfollow") {
    const userId = event.source?.userId;
    console.log(`[LINE] 👋 Unfollower: ${userId ? userId.slice(0, 8) + '...' : 'unknown'}`);
    const conv = userId ? await db.getConversationBySessionId(`line-${userId}`) : null;
    db.addAnalyticsEvent({
      conversationId: conv?.id ?? null,
      userId: userId ?? null,
      eventCategory: "line_unfollow",
      eventAction: "unfollow",
      channel: "line",
    });
    return;
  }

  // ============ FOLLOW EVENT: Send welcome + FAQ progressive carousel ============
  if (event.type === "follow") {
    const userId = event.source?.userId;
    console.log(`[LINE] 🎉 New follower: ${userId ? userId.slice(0, 8) + '...' : 'unknown'}`);
    // Track follow event
    db.addAnalyticsEvent({
      conversationId: null,
      userId: userId ?? null,
      eventCategory: "line_follow",
      eventAction: "follow",
      channel: "line",
    });
    if (userId) {
      try {
        // Get profile for name
        let customerName: string | null = null;
        try {
          const profileRes = await fetch(
            `https://api.line.me/v2/bot/profile/${userId}`,
            { headers: { Authorization: `Bearer ${channelAccessToken}` } }
          );
          if (profileRes.ok) {
            const profile = await profileRes.json();
            customerName = profile.displayName;
          }
        } catch {}

        // Create conversation for the new follower
        const sessionId = `line-${userId}`;
        let conversation = await db.getConversationBySessionId(sessionId);
        if (!conversation) {
          await db.createConversation({
            sessionId,
            customerName,
            channel: "line",
            status: "active",
            leadScore: 0,
            leadStatus: "new",
          });
        }

        // Send welcome + FAQ progressive messages via push API (follow events have no replyToken)
        const welcomeMessages = buildFollowWelcomeMessages();
        const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            to: userId,
            messages: welcomeMessages,
          }),
        });
        const pushBody = await pushRes.text();
        console.log(`[LINE] Follow welcome push response: ${pushRes.status} ${pushBody}`);
      } catch (err) {
        console.error("[LINE] Follow event handling failed:", err);
      }
    }
    return;
  }

  // ============ IMAGE MESSAGE HANDLING ============
  // When customer sends a car photo, identify the vehicle and reply with Flex card
  if (event.type === "message" && event.message?.type === "image") {
    const userId = event.source?.userId;
    const replyToken = event.replyToken;
    const imageMessageId = event.message?.id;

    if (!userId || !replyToken || !imageMessageId) return;

    console.log(`[LINE Image] Received image message from ${userId.slice(0, 8)}...`);
    showTypingIndicator(userId, channelAccessToken);

    try {
      // 1. Download image from LINE
      const imageBuffer = await downloadLineImage(imageMessageId, channelAccessToken);
      if (!imageBuffer) {
        console.warn("[LINE Image] Could not download image, skipping");
        return;
      }

      const imageBase64 = imageBuffer.toString("base64");
      console.log(`[LINE Image] Downloaded image, size: ${imageBuffer.length} bytes`);

      // 2. Use Gemini Vision to identify the vehicle
      const identified = await identifyVehicleFromImage(imageBase64);
      if (!identified) {
        console.log("[LINE Image] Could not identify vehicle from image");
        // Reply with a helpful message
        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: [{
              type: "text",
              text: "收到你的照片了！😊 不過我沒有辨識到車輛。\n\n你可以直接告訴我想找什麼車，或點選下面的按鈕瀏覽庫存 👇",
              quickReply: {
                items: [
                  { type: "action", action: { type: "message", label: "🚗 瀏覽所有車輛", text: "我想看車，有什麼車可以推薦？" } },
                  { type: "action", action: { type: "message", label: "💰 50萬以下", text: "50萬以下有什麼好車？" } },
                  { type: "action", action: { type: "message", label: "📞 直接聯繫", text: "可以給我你們的聯絡方式嗎？" } },
                ],
              },
            }],
          }),
        });
        return;
      }

      console.log(`[LINE Image] Identified vehicle: ${identified.brand} ${identified.model}`);

      // 3. Match against inventory
      const allVehicles = await db.getAllVehicles();
      const matches = findMatchingVehicles(identified, allVehicles);
      console.log(`[LINE Image] Found ${matches.length} matching vehicles in inventory`);

      if (matches.length > 0) {
        // 4. Reply with matching vehicle Flex cards
        const flexMessages = buildVehicleCarouselMessages(
          matches,
          `🔍 ${identified.brand} ${identified.model}`,
          "根據你傳的照片，幫你找到這些車"
        );

        // Prepend a text message
        const textMsg = {
          type: "text" as const,
          text: `我看到你傳了一張 ${identified.brand} ${identified.model} 的照片！🚗\n我們剛好有 ${matches.length} 台${identified.brand} ${identified.model} 可以看，幫你列出來 👇`,
        };

        // LINE reply max 5 messages
        const replyMessages = [textMsg, ...flexMessages].slice(0, 5);

        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({ replyToken, messages: replyMessages }),
        });
      } else {
        // No match in inventory — still acknowledge the identification
        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: [{
              type: "text",
              text: `我看到你傳了一張 ${identified.brand} ${identified.model} 的照片！🚗\n不過目前庫存裡沒有這台車。\n\n要不要看看我們其他的好車？👇`,
              quickReply: {
                items: [
                  { type: "action", action: { type: "message", label: "🚗 瀏覽所有車輛", text: "我想看車，有什麼車可以推薦？" } },
                  { type: "action", action: { type: "message", label: "💰 50萬以下", text: "50萬以下有什麼好車？" } },
                  { type: "action", action: { type: "message", label: "📞 直接聯繫", text: "可以給我你們的聯絡方式嗎？" } },
                ],
              },
            }],
          }),
        });
      }

      // Save to conversation history
      const sessionId = `line-${userId}`;
      let conversation = await db.getConversationBySessionId(sessionId);
      if (conversation) {
        await db.addMessage({ conversationId: conversation.id, role: "user", content: `[客戶傳了一張圖片，辨識為 ${identified.brand} ${identified.model}]` });
        await db.addMessage({ conversationId: conversation.id, role: "assistant", content: matches.length > 0
          ? `已回覆 ${identified.brand} ${identified.model} 的 ${matches.length} 台庫存車輛卡片`
          : `已辨識為 ${identified.brand} ${identified.model}，但目前無庫存` });
      }
    } catch (err) {
      console.error("[LINE Image] Processing error:", err);
    }
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") {
    console.log(`[LINE] Skipping event type: ${event.type}, message type: ${event.message?.type}`);
    return;
  }

  const userId = event.source?.userId;
  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  const messageId = event.message?.id;

  console.log(`[LINE] Message from ${userId ? userId.slice(0,8) + '...' : 'unknown'}: [message length: ${userMessage?.length || 0}]`);

  if (!userId || !userMessage || !replyToken) {
    console.warn("[LINE] Missing userId, message, or replyToken");
    return;
  }

  // Deduplication: skip if we already processed this message (LINE retry)
  if (messageId && isDuplicate(messageId)) {
    console.log(`[LINE] Duplicate message ${messageId}, skipping`);
    return;
  }

  // Show typing indicator immediately while processing
  showTypingIndicator(userId, channelAccessToken);

  // Get or create conversation
  const sessionId = `line-${userId}`;
  let conversation = await db.getConversationBySessionId(sessionId);

  // Always try to get LINE profile for name & gender detection
  let customerName = conversation?.customerName || null;
  let customerGender: 'male' | 'female' | 'unknown' = 'unknown';

  if (!conversation) {
    try {
      const profileRes = await fetch(
        `https://api.line.me/v2/bot/profile/${userId}`,
        {
          headers: { Authorization: `Bearer ${channelAccessToken}` },
        }
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        customerName = profile.displayName;
        console.log(`[LINE] Got profile: [name retrieved]`);
      }
    } catch (err) {
      console.warn("[LINE] Failed to get profile:", err);
    }

    const created = await db.createConversation({
      sessionId,
      customerName,
      channel: "line",
      status: "active",
      leadScore: 0,
      leadStatus: "new",
    });
    conversation = { ...created, leadScore: 0, notifiedOwner: 0 } as any;
  }

  // Detect gender from customer name
  customerGender = detectGenderFromName(customerName);

  const convId = conversation!.id;

  // Save user message FIRST
  const savedMsg = await db.addMessage({
    conversationId: convId,
    role: "user",
    content: userMessage,
  });
  console.log(`[LINE] Saved user message: id=${savedMsg.id}, convId=${convId}`);

  // ============ AUTO-DETECT PHONE NUMBER ============
  const detectedPhone = detectPhoneNumber(userMessage);
  if (detectedPhone && !conversation!.customerContact) {
    await db.updateConversation(convId, { customerContact: detectedPhone });
    conversation = { ...conversation!, customerContact: detectedPhone };
    console.log(`[LINE] Phone number detected and saved: [REDACTED]`);
  }

  // Score the message (8-dimension model)
  const LEAD_SCORE_RULES = [
    { pattern: /預算|budget|多少錢|價格|價位|報價|優惠|折扣|議價|便宜|殺價|算便宜|打折|頭期|月付|零利率/i, score: 15, event: "budget_inquiry", reason: "💰 預算確認：詢問價格或付款方式" },
    { pattern: /想買|要買|購買|下訂|訂車|成交|簽約|付款|頭期款|貸款|分期|刷卡|匯款|訂金|定金/i, score: 25, event: "purchase_intent", reason: "🔥 購買意向：表達明確購買決心" },
    { pattern: /看車|試駕|試乘|賞車|到店|什麼時候可以|預約|過去看|去你們那|地址在哪|怎麼走|營業時間/i, score: 20, event: "visit_intent", reason: "🚗 看車意願：想預約看車或試駕" },
    { pattern: /電話|手機|聯絡|line|加line|聯繫方式|怎麼聯繫|打給你|你的號碼|微信|whatsapp/i, score: 20, event: "contact_request", reason: "📱 索取聯繫：主動要聯繫方式" },
    { pattern: /換車|舊車|trade.?in|估價|折讓|我的車|目前開|現在開|賣掉|脫手|二手|中古/i, score: 15, event: "trade_in", reason: "🔄 舊車換新：有舊車代表真實需求" },
    { pattern: /最近|這週|這個月|趕快|急|盡快|馬上|立刻|年底前|過年前|什麼時候能交車|交車時間|多久可以|快點/i, score: 15, event: "urgency", reason: "⏰ 時間急迫：有明確購買時間壓力" },
    { pattern: /BMW|Toyota|Honda|Ford|Kia|Hyundai|Suzuki|Mitsubishi|Volkswagen|VW|Tiguan|CR-?V|Corolla|Vios|Stonic|Tucson|Carens|Colt|Vitara|Tourneo|X1|cc數|排氣量|馬力|油耗|安全配備|幾人座|行李箱|後座空間/i, score: 10, event: "specific_vehicle", reason: "🔍 指定車款：詢問特定車型詳細規格" },
    { pattern: /結婚|小孩|baby|寶寶|家人|老婆|老公|太太|先生|爸媽|父母|上班|通勤|搬家|退休|接送|安全座椅|全家|一家人|載小孩|載貨|工作需要/i, score: 10, event: "life_event", reason: "👨‍👩‍👧‍👦 人生事件：家庭或生活需求驅動購買" },
    // 具體預算金額加分：提到具體金額代表認真考慮購買
    { pattern: /\d{2,3}萬|\d{2,3}万|\d{2,3}w|預算\s*\d|budget\s*\d/i, score: 15, event: "specific_budget", reason: "💵 具體預算：提到明確金額，購買意願高" },
  ];

  let scoreDelta = 0;
  for (const rule of LEAD_SCORE_RULES) {
    if (rule.pattern.test(userMessage)) {
      scoreDelta += rule.score;
      await db.addLeadEvent({
        conversationId: convId,
        eventType: rule.event,
        scoreChange: rule.score,
        reason: rule.reason,
      });
    }
  }

  if (scoreDelta > 0) {
    const newScore = (conversation!.leadScore || 0) + scoreDelta;
    const newStatus = newScore >= 80 ? "hot" : newScore >= 50 ? "qualified" : "new";
    await db.updateConversation(convId, { leadScore: newScore, leadStatus: newStatus });
    conversation = { ...conversation!, leadScore: newScore };
    console.log(`[LINE] Lead score updated: +${scoreDelta} = ${newScore} (${newStatus})`);
  }

  // ============ CHECK IF THIS IS A PHOTO TRIGGER ============
  const photoExternalId = detectPhotoTrigger(userMessage);

  if (photoExternalId) {
    console.log(`[LINE] Photo trigger detected for externalId: ${photoExternalId}`);
    db.addAnalyticsEvent({ conversationId: convId, userId, eventCategory: "photo_view", eventAction: `看照片 ${photoExternalId}`, channel: "line" });

    const allVehicles = await db.getAllVehicles();
    const vehicle = allVehicles.find((v) => String(v.externalId) === photoExternalId);

    if (vehicle) {
      const photoMessages = buildPhotoCarousel(vehicle);

      await db.addMessage({
        conversationId: convId,
        role: "assistant",
        content: `[📸 已發送 ${vehicle.brand} ${vehicle.model} 的所有照片]`,
      });

      try {
        console.log(`[LINE] Sending ${photoMessages.length} photo messages...`);
        const replyRes = await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: photoMessages,
          }),
        });
        const replyBody = await replyRes.text();
        console.log(`[LINE] Photo reply response: ${replyRes.status} ${replyBody}`);
      } catch (err) {
        console.error("[LINE] Photo reply failed:", err);
      }

      const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
      await checkAndNotifyOwner(conversation!, userMessage, channelAccessToken, ownerUserId, phoneJustFound);
      return;
    }
  }

  // ============ CHECK IF THIS IS A FAQ PROGRESSIVE TRIGGER ============
  const faqItem = detectFaqTrigger(userMessage);

  if (faqItem) {
    console.log(`[LINE] FAQ trigger detected: #${faqItem.id} ${faqItem.title}`);
    db.addAnalyticsEvent({ conversationId: convId, userId, eventCategory: "faq_click", eventAction: faqItem.title, eventLabel: faqItem.shortQuestion, channel: "line" });

    // Lead score +10 for each FAQ interaction (shows engagement)
    const faqScore = 10;
    const newScore = (conversation!.leadScore || 0) + faqScore;
    const newStatus = newScore >= 80 ? "hot" : newScore >= 50 ? "qualified" : "new";
    await db.updateConversation(convId, { leadScore: newScore, leadStatus: newStatus });
    await db.addLeadEvent({
      conversationId: convId,
      eventType: "faq_interaction",
      scoreChange: faqScore,
      reason: `🏆 FAQ互動：點擊了「${faqItem.title}」問題`,
    });
    conversation = { ...conversation!, leadScore: newScore };
    console.log(`[LINE] FAQ lead score: +${faqScore} = ${newScore}`);

    // Build answer reveal + follow-up question menu
    const faqMessages = buildFaqAnswerMessages(faqItem);

    await db.addMessage({
      conversationId: convId,
      role: "assistant",
      content: `[🏆 FAQ揭曉：${faqItem.title} — ${faqItem.shortQuestion}]`,
    });

    try {
      const replyRes = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: faqMessages,
        }),
      });
      const replyBody = await replyRes.text();
      console.log(`[LINE] FAQ answer reply: ${replyRes.status} ${replyBody}`);
    } catch (err) {
      console.error("[LINE] FAQ reply failed:", err);
    }

    const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
    await checkAndNotifyOwner(conversation!, userMessage, channelAccessToken, ownerUserId, phoneJustFound);
    return;
  }

  // ============ CHECK IF THIS IS A RICH MENU TRIGGER ============
  const trigger = detectRichMenuTrigger(userMessage);

  if (trigger) {
    console.log(`[LINE] Rich Menu trigger detected: ${trigger.type} (${trigger.label})`);
    db.addAnalyticsEvent({ conversationId: convId, userId, eventCategory: "rich_menu", eventAction: trigger.label || trigger.type, channel: "line" });

    // Fetch vehicles for carousel-type triggers
    const allVehicles = await db.getAllVehicles();
    const flexMessages = buildRichMenuResponseMessages(trigger, allVehicles);

    if (flexMessages.length > 0) {
      // Save a descriptive assistant message for history
      const assistantContent = getAssistantContentForTrigger(trigger);
      await db.addMessage({
        conversationId: convId,
        role: "assistant",
        content: assistantContent,
      });

      // Reply with multiple Flex Messages (supports >12 vehicles)
      try {
        console.log(`[LINE] Sending ${flexMessages.length} Flex Message(s) reply...`);
        const replyRes = await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: flexMessages,
          }),
        });
        const replyBody = await replyRes.text();
        console.log(`[LINE] Flex reply response: ${replyRes.status} ${replyBody}`);
      } catch (err) {
        console.error("[LINE] Flex reply failed:", err);
      }

      // Still do owner notification check
      const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
      await checkAndNotifyOwner(conversation!, userMessage, channelAccessToken, ownerUserId, phoneJustFound);
      return; // Done - don't call LLM for Rich Menu triggers
    }
  }

  // ============ REGULAR MESSAGE → RESPONSE ============

  const allHistory = await db.getMessagesByConversation(convId, 100);
  const history = allHistory.slice(-10);
  console.log(`[LINE] History: total=${allHistory.length}, using last ${history.length} messages`);

  const allVehicles = await db.getAllVehicles();

  // ============ VEHICLE DETECTION v5: Context-aware detection ============
  // Pass conversation history so follow-up questions can resolve to previously discussed vehicles
  const historyForDetection = history.map(m => ({ role: m.role, content: m.content }));
  const detection = detectVehicleFromMessage(userMessage, allVehicles, historyForDetection);
  console.log(`[VehicleDetection] type=${detection.type}, vehicle=${detection.vehicle?.brand || 'none'} ${detection.vehicle?.model || ''}, question=${detection.questionType}, answer=${detection.directAnswer}`);

  // ============ INTENT DETECTION v7: Detect customer intents and inject focused instructions ============
  const customerIntents = detectCustomerIntents(userMessage);
  console.log(`[IntentDetection] intents=${customerIntents.join(', ') || 'none'}`);

  const greeting = getGenderGreeting(customerGender);

  let replyText: string;
  let isHumanHandoff = false;

  // ============ RULE-BASED MODE vs LLM MODE ============
  if (isRuleBasedMode()) {
    console.log("[LINE] Rule-based mode active (FORCE_RULE_BASED_REPLY=1)");
    replyText = generateRuleBasedReply({
      userMessage,
      greeting,
      detection,
      intents: customerIntents,
      customerContact: conversation!.customerContact,
      leadScore: conversation!.leadScore ?? undefined,
    });
    console.log("[LINE] Rule-based response:", replyText.substring(0, 100));
  } else {
    console.log("[LINE] LLM mode, calling Claude API...");

    // Build smart vehicle KB: if target vehicle detected, show it prominently and abbreviate others
    const vehicleKB = buildSmartVehicleKB(allVehicles, detection.vehicle);

    // Build target vehicle prompt (will be placed at the END of system prompt for recency bias)
    const targetVehiclePrompt = buildTargetVehiclePrompt(detection, userMessage, conversation!.customerContact);
    const intentInstructions = buildIntentInstructions(customerIntents, userMessage, greeting, conversation!.customerContact);

    const promptContext: PromptContext = {
      greeting,
      vehicleKB,
      targetVehiclePrompt,
      intentInstructions,
      intents: customerIntents,
      detection,
      customerContact: conversation!.customerContact,
      leadScore: conversation!.leadScore ?? undefined,
      userMessage,
    };

    const llmMessages = buildLLMMessages(promptContext, history.map(m => ({ role: m.role, content: m.content })));
    console.log(`[LINE] Dynamic prompt: ${llmMessages.length} messages, intents=${customerIntents.join(',') || 'none'}, vehicle=${detection.vehicle?.brand || 'none'}`);

    try {
      const response = await invokeLLM({ messages: llmMessages });
      replyText =
        typeof response.choices[0]?.message?.content === "string"
          ? response.choices[0].message.content
          : "";
      if (!replyText) {
        console.warn("[LINE] LLM returned empty content, falling back to rule-based reply");
        replyText = generateRuleBasedReply({
          userMessage,
          greeting,
          detection,
          intents: customerIntents,
          customerContact: conversation!.customerContact,
          leadScore: conversation!.leadScore ?? undefined,
        });
      }
      console.log("[LINE] LLM response:", replyText.substring(0, 100));
    } catch (err) {
      console.error("[LINE] LLM error, falling back to rule-based reply:", err);
      replyText = generateRuleBasedReply({
        userMessage,
        greeting,
        detection,
        intents: customerIntents,
        customerContact: conversation!.customerContact,
        leadScore: conversation!.leadScore ?? undefined,
      });
    }
  }

  // ============ HUMAN HANDOFF DETECTION ============
  // Check if AI flagged [HUMAN_HANDOFF] in its response
  if (replyText.includes('[HUMAN_HANDOFF]')) {
    isHumanHandoff = true;
    // Remove the marker from the customer-facing message
    replyText = replyText.replace(/\s*\[HUMAN_HANDOFF\]\s*/g, '').trim();
    console.log('[LINE] 🚨 HUMAN HANDOFF triggered! AI cannot answer this question.');
  }
  
  // Also detect if AI said "I'll check for you" type phrases (secondary detection)
  // This catches cases where AI didn't use the marker but still couldn't answer
  const uncertaintyPatterns = /我幫你確認一下|我幫你問問|我幫你查|我不太確定|這個我要確認|我幫您確認|我幫您查/;
  if (!isHumanHandoff && uncertaintyPatterns.test(replyText)) {
    isHumanHandoff = true;
    // Append human handoff message to the reply
    replyText += '\n\n🙋‍♂️ 我已經通知專人了，真人客服馬上就到！';
    console.log('[LINE] 🚨 HUMAN HANDOFF triggered (uncertainty detected in AI response).');
  }

  // Save assistant response
  await db.addMessage({
    conversationId: convId,
    role: "assistant",
    content: replyText,
  });

  // Build contextual quick reply based on conversation state
  const quickReplyCtx: ConversationContext = {
    hasVehicle: detection.type !== 'none' && !!detection.vehicle,
    hasAppointment: customerIntents.includes('appointment'),
    hasContact: !!conversation!.customerContact,
    vehicleName: detection.vehicle ? `${detection.vehicle.brand} ${detection.vehicle.model}` : undefined,
    vehicleExternalId: detection.vehicle?.externalId ? String(detection.vehicle.externalId) : undefined,
  };
  const quickReply = buildContextualQuickReply(quickReplyCtx);

  // Reply via LINE API with contextual quick replies
  try {
    console.log("[LINE] Sending reply via LINE API...");
    const replyRes = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text: replyText, quickReply }],
      }),
    });
    const replyBody = await replyRes.text();
    console.log(`[LINE] Reply API response: ${replyRes.status} ${replyBody}`);
  } catch (err) {
    console.error("[LINE] Reply failed:", err);
  }

  // ============ HUMAN HANDOFF: Push notification to owner + staff ============
  if (isHumanHandoff) {
    await sendHumanHandoffNotification(
      conversation!,
      userMessage,
      replyText,
      channelAccessToken,
      ownerUserId
    );
  }

  // Notify owner for hot leads
  const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
  await checkAndNotifyOwner(conversation!, userMessage, channelAccessToken, ownerUserId, phoneJustFound);
}

// ============ HELPER: Get assistant content description for Rich Menu triggers ============
function getAssistantContentForTrigger(trigger: { type: string; label: string }): string {
  switch (trigger.type) {
    case "vehicle_browse":
      return "[📋 已發送在售車輛圖文卡片]";
    case "popular":
      return "[⭐ 已發送熱門推薦車款圖文卡片]";
    case "budget":
      return "[💰 已發送50萬以下車款圖文卡片]";
    case "appointment":
      return "[📅 已發送預約賞車互動卡片]";
    case "welcome":
      return "[👋 已發送崑家汽車歡迎卡片]";
    case "faq":
      return "[🏆 已發送崑家汽車五大保證FAQ卡片]";
    default:
      return "[已發送圖文卡片]";
  }
}

// ============ HELPER: Build Flex Message notification for owner ============
function buildOwnerNotificationFlex(
  conversation: any,
  userMessage: string
): any {
  const customerName = conversation.customerName || "未知客戶";
  const phone = conversation.customerContact;
  const score = conversation.leadScore || 0;
  
  // Score color: red for hot, orange for qualified
  const scoreColor = score >= 80 ? "#FF0000" : score >= 60 ? "#FF6600" : "#FF9900";
  
  const bodyContents: any[] = [
    {
      type: "text",
      text: "🔥 高品質潛客通知",
      weight: "bold",
      size: "xl",
      color: "#FF0000",
    },
    {
      type: "separator",
      margin: "md",
    },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "客戶", size: "sm", color: "#555555", flex: 2 },
            { type: "text", text: customerName, size: "sm", color: "#111111", flex: 5, weight: "bold" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "分數", size: "sm", color: "#555555", flex: 2 },
            { type: "text", text: `${score} 分`, size: "sm", color: scoreColor, flex: 5, weight: "bold" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "電話", size: "sm", color: "#555555", flex: 2 },
            { type: "text", text: phone || "未提供", size: "sm", color: phone ? "#111111" : "#AAAAAA", flex: 5, weight: phone ? "bold" : "regular" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "渠道", size: "sm", color: "#555555", flex: 2 },
            { type: "text", text: "LINE", size: "sm", color: "#06C755", flex: 5, weight: "bold" },
          ],
        },
      ],
    },
    {
      type: "separator",
      margin: "lg",
    },
    {
      type: "text",
      text: "最新訊息：",
      size: "xs",
      color: "#AAAAAA",
      margin: "lg",
    },
    {
      type: "text",
      text: userMessage.length > 100 ? userMessage.substring(0, 100) + "..." : userMessage,
      size: "sm",
      color: "#333333",
      wrap: true,
      margin: "sm",
    },
  ];

  // Build action buttons
  const footerContents: any[] = [];

  if (phone) {
    // Has phone → show call button
    const telNumber = phone.replace(/[\s-]/g, '');
    footerContents.push({
      type: "button",
      style: "primary",
      color: "#06C755",
      action: {
        type: "uri",
        label: `📞 撥打 ${phone}`,
        uri: `tel:${telNumber}`,
      },
    });
  }

  // Always show LINE OA chat link
  footerContents.push({
    type: "button",
    style: phone ? "secondary" : "primary",
    color: phone ? undefined : "#06C755",
    action: {
      type: "uri",
      label: phone ? "💬 開啟LINE聊天室" : "💬 到LINE聊天室回覆客戶",
      uri: "https://chat.line.biz/",
    },
  });

  return {
    type: "flex",
    altText: `🔥 高品質潛客：${customerName}（${score}分）${phone ? ' 📞' + phone : ''}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "⚡ QUALITY LEAD",
                color: "#FFFFFF",
                size: "xs",
                weight: "bold",
              },
              {
                type: "text",
                text: `Score: ${score}`,
                color: "#FFFFFF",
                size: "xs",
                align: "end",
                weight: "bold",
              },
            ],
          },
        ],
        backgroundColor: score >= 80 ? "#CC0000" : score >= 50 ? "#FF6600" : "#FF9900",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents,
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: footerContents,
        paddingAll: "12px",
      },
    },
  };
}

// ============ HELPER: Owner notification for hot leads ============
// Milestone-based notification: notify at score 50, 80, 120, 180
// Also notify immediately when phone number is detected
const NOTIFICATION_MILESTONES = [50, 80, 120, 180];

function getMilestoneLevel(score: number): number {
  // Returns how many milestones have been reached
  let level = 0;
  for (const m of NOTIFICATION_MILESTONES) {
    if (score >= m) level++;
  }
  return level;
}

// Dedup: prevent duplicate LINE notifications for the same conversation within 10 minutes
const lineNotifyCooldownMap = new Map<string, number>();
const LINE_NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

async function checkAndNotifyOwner(
  conversation: any,
  userMessage: string,
  channelAccessToken: string,
  ownerUserId?: string,
  phoneJustDetected?: boolean
) {
  const score = conversation.leadScore || 0;
  const currentNotifiedLevel = conversation.notifiedOwner || 0;
  const newMilestoneLevel = getMilestoneLevel(score);

  // Determine if we should notify:
  // 1. New milestone reached (score crossed a threshold)
  // 2. Phone number just detected (always notify immediately)
  const shouldNotifyMilestone = newMilestoneLevel > currentNotifiedLevel && score >= 50;
  const shouldNotifyPhone = phoneJustDetected && score >= 40;

  if (!shouldNotifyMilestone && !shouldNotifyPhone) return;

  // Dedup: skip if same conversation+level was notified recently
  const dedupKey = `line:${conversation.id}:${newMilestoneLevel}:${phoneJustDetected ? "phone" : "score"}`;
  const lastNotified = lineNotifyCooldownMap.get(dedupKey);
  if (lastNotified && Date.now() - lastNotified < LINE_NOTIFY_COOLDOWN_MS) return;
  lineNotifyCooldownMap.set(dedupKey, Date.now());
  // Periodic cleanup
  if (lineNotifyCooldownMap.size > 500) {
    const now = Date.now();
    Array.from(lineNotifyCooldownMap.entries()).forEach(([k, t]) => {
      if (now - t > LINE_NOTIFY_COOLDOWN_MS) lineNotifyCooldownMap.delete(k);
    });
  }

  // Build notification content based on context
  let emoji = "🔥";
  let urgency = "高品質潛客";
  if (score >= 180) { emoji = "🚨"; urgency = "超級熱客！立刻聯繫"; }
  else if (score >= 120) { emoji = "⚡"; urgency = "高度意願客戶"; }
  else if (score >= 80) { emoji = "🔥"; urgency = "高品質潛客"; }
  else if (phoneJustDetected) { emoji = "📞"; urgency = "客戶留電話了！趕快聯繫"; }
  else if (score >= 50) { emoji = "💬"; urgency = "潛在客戶有興趣"; }

  const title = `${emoji} LINE${urgency}！Score: ${score}`;
  const content = `客戶：${conversation.customerName || "未知"}\n渠道：LINE\n電話：${conversation.customerContact || "未提供"}\n訊息：${userMessage}\n\n${score >= 120 ? "⚠️ 此客戶購買意願極高，請立刻聯繫！" : "請盡快聯繫！"}`;

  try {
    await notifyOwner({ title, content });
    
    // Update notifiedOwner to current milestone level
    const newLevel = Math.max(currentNotifiedLevel, newMilestoneLevel);
    await db.updateConversation(conversation.id, { notifiedOwner: newLevel });

    // Build recipient list: owner + additional notify users
    const recipientIds: string[] = [];
    if (ownerUserId) recipientIds.push(ownerUserId);
    
    // Add additional notification recipients (comma-separated LINE User IDs)
    const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
    if (additionalIds) {
      const extras = additionalIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      for (const extraId of extras) {
        if (!recipientIds.includes(extraId)) {
          recipientIds.push(extraId);
        }
      }
    }

    if (recipientIds.length > 0) {
      // Send Flex Message notification with call button
      const flexNotification = buildOwnerNotificationFlex(conversation, userMessage);
      
      // Send to all recipients
      for (const recipientId of recipientIds) {
        try {
          const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify({
              to: recipientId,
              messages: [flexNotification],
            }),
          });
          const pushBody = await pushRes.text();
          console.log(`[LINE] Sent Flex notification to [REDACTED] (milestone: ${newLevel}, score: ${score}). Phone: [REDACTED]. Response: ${pushRes.status}`);
        } catch (pushErr) {
          console.error(`[LINE] Failed to push notification to [REDACTED]:`, pushErr);
        }
      }
    }
  } catch (err) {
    console.error("[LINE] Owner notification failed:", err);
  }
}

// ============ HUMAN HANDOFF: Build Flex Message for staff notification ============
function buildHumanHandoffFlex(
  conversation: any,
  userMessage: string,
  aiResponse: string
): any {
  const customerName = conversation.customerName || "未知客戶";
  const phone = conversation.customerContact;
  
  const bodyContents: any[] = [
    {
      type: "text",
      text: "🚨 客人需要真人回覆！",
      weight: "bold",
      size: "xl",
      color: "#FF0000",
    },
    {
      type: "text",
      text: "請立即到 LINE 官方帳號回覆客人",
      size: "xs",
      color: "#FF6600",
      margin: "sm",
      weight: "bold",
    },
    {
      type: "separator",
      margin: "md",
    },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "客戶", size: "sm", color: "#555555", flex: 2 },
            { type: "text", text: customerName, size: "sm", color: "#111111", flex: 5, weight: "bold" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "電話", size: "sm", color: "#555555", flex: 2 },
            { type: "text", text: phone || "未提供", size: "sm", color: phone ? "#111111" : "#AAAAAA", flex: 5, weight: phone ? "bold" : "regular" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "渠道", size: "sm", color: "#555555", flex: 2 },
            { type: "text", text: "LINE", size: "sm", color: "#06C755", flex: 5, weight: "bold" },
          ],
        },
      ],
    },
    {
      type: "separator",
      margin: "lg",
    },
    {
      type: "text",
      text: "客人的問題：",
      size: "xs",
      color: "#AAAAAA",
      margin: "lg",
    },
    {
      type: "text",
      text: userMessage.length > 120 ? userMessage.substring(0, 120) + "..." : userMessage,
      size: "sm",
      color: "#333333",
      wrap: true,
      margin: "sm",
      weight: "bold",
    },
    {
      type: "text",
      text: "AI 的回覆：",
      size: "xs",
      color: "#AAAAAA",
      margin: "lg",
    },
    {
      type: "text",
      text: aiResponse.length > 100 ? aiResponse.substring(0, 100) + "..." : aiResponse,
      size: "xs",
      color: "#888888",
      wrap: true,
      margin: "sm",
    },
  ];

  // Build action buttons
  const footerContents: any[] = [];

  if (phone) {
    const telNumber = phone.replace(/[\s-]/g, '');
    footerContents.push({
      type: "button",
      style: "primary",
      color: "#06C755",
      action: {
        type: "uri",
        label: `📞 撥打 ${phone}`,
        uri: `tel:${telNumber}`,
      },
    });
  }

  // Always show LINE OA chat link
  footerContents.push({
    type: "button",
    style: phone ? "secondary" : "primary",
    color: phone ? undefined : "#FF0000",
    action: {
      type: "uri",
      label: "💬 立即到LINE回覆客人",
      uri: "https://chat.line.biz/",
    },
  });

  return {
    type: "flex",
    altText: `🚨 客人需要真人回覆！${customerName} 問：${userMessage.substring(0, 30)}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "🚨 真人接手請求",
                color: "#FFFFFF",
                size: "sm",
                weight: "bold",
              },
              {
                type: "text",
                text: "火速回覆！",
                color: "#FFFF00",
                size: "sm",
                align: "end",
                weight: "bold",
              },
            ],
          },
        ],
        backgroundColor: "#CC0000",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents,
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: footerContents,
        paddingAll: "12px",
      },
    },
  };
}

// ============ HUMAN HANDOFF: Send push notification to owner + staff ============
async function sendHumanHandoffNotification(
  conversation: any,
  userMessage: string,
  aiResponse: string,
  channelAccessToken: string,
  ownerUserId?: string
) {
  const customerName = conversation.customerName || "未知客戶";
  
  console.log(`[LINE] 🚨 Sending HUMAN HANDOFF notification for customer: ${customerName}`);
  
  try {
    // 1. Notify via system notification
    await notifyOwner({
      title: `🚨 客人需要真人回覆！`,
      content: `客戶：${customerName}\n電話：${conversation.customerContact || "未提供"}\n客人的問題：${userMessage}\n\nAI 無法回答此問題，請立即到 LINE 官方帳號回覆客人！`,
    });

    // 2. Build recipient list: owner + additional notify users
    const recipientIds: string[] = [];
    if (ownerUserId) recipientIds.push(ownerUserId);
    
    const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
    if (additionalIds) {
      const extras = additionalIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      for (const extraId of extras) {
        if (!recipientIds.includes(extraId)) {
          recipientIds.push(extraId);
        }
      }
    }

    if (recipientIds.length > 0) {
      // Build Flex Message for human handoff
      const flexNotification = buildHumanHandoffFlex(conversation, userMessage, aiResponse);
      
      // Send to all recipients
      for (const recipientId of recipientIds) {
        try {
          const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify({
              to: recipientId,
              messages: [flexNotification],
            }),
          });
          const pushBody = await pushRes.text();
          console.log(`[LINE] 🚨 Human handoff notification sent to [REDACTED]. Response: ${pushRes.status}`);
        } catch (pushErr) {
          console.error(`[LINE] Failed to send human handoff notification:`, pushErr);
        }
      }
    } else {
      console.warn('[LINE] No recipients configured for human handoff notification!');
    }
  } catch (err) {
    console.error("[LINE] Human handoff notification failed:", err);
  }
}

export { lineRouter };
