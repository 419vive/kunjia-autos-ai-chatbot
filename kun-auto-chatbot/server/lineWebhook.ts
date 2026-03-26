import { Router, Request, Response } from "express";
import crypto from "crypto";
import { logger } from "./logger";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { detectRichMenuTrigger, buildRichMenuResponseMessages, detectPhotoTrigger, buildPhotoCarousel, buildFollowWelcomeMessages, buildFaqCarousel, detectFaqTrigger, buildFaqAnswerMessages, buildContextualQuickReply, buildVehicleCarouselMessages, type ConversationContext } from "./lineFlexTemplates";
import { formatTimeSlotsForPrompt } from "./timeSlotHelper";
import { detectVehicleFromMessage, buildSmartVehicleKB, buildTargetVehiclePrompt, detectCustomerIntents, buildIntentInstructions, buildVehicleIndex } from "./vehicleDetectionService";
import { buildLLMMessages, type PromptContext } from "./dynamicPromptBuilder";
import { isRuleBasedMode, generateRuleBasedReply } from "./ruleBasedReply";
import { sanitizeChatMessage } from "./security";

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
      logger.error("LINE Image", `Download failed: ${res.status}`);
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err) {
    logger.error("LINE Image", "Download error:", err);
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
      logger.error("LINE Image", `Gemini Vision error: ${res.status} ${errorBody.substring(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    logger.info("LINE Image", `Gemini Vision raw response: ${content.substring(0, 500)}`);

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
    logger.error("LINE Image", "Vision identification error:", err);
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

// ============ FRUSTRATION / EMOTION DETECTION ============

// Track recent questions per user for repeat detection
const recentQuestions = new Map<string, string[]>();

export function detectFrustration(message: string, userId?: string): { frustrated: boolean; confidence: number } {
  let confidence = 0;

  // Direct frustration keywords (Chinese + Taiwanese slang)
  const frustrationPatterns = [
    { pattern: /不滿|生氣|爛|很差|太差|廢物|騙人|騙子|浪費時間|沒有用|不想理|垃圾|白痴|笨/, weight: 0.4 },
    { pattern: /三小|啥小|靠北|靠邀|靠腰|幹|操|他媽|媽的|什麼鬼|搞屁|屁話|你有病|腦殘|智障|機掰|雞掰/, weight: 0.6 },
    { pattern: /轉真人|找真人|找人|不想跟機器人說|要真人|真人客服|人工客服/, weight: 0.5 },
    { pattern: /[？]{3,}|[！]{3,}|[?]{3,}|[!]{3,}/, weight: 0.3 },
    { pattern: /到底|究竟|為什麼|怎麼回事|搞什麼|是在哈囉/, weight: 0.2 },
  ];

  for (const { pattern, weight } of frustrationPatterns) {
    if (pattern.test(message)) {
      confidence += weight;
    }
  }

  // Repeated question detection: if user asked same thing 3+ times
  if (userId) {
    const questions = recentQuestions.get(userId) || [];
    questions.push(message);
    // Keep only last 10 messages
    if (questions.length > 10) questions.shift();
    recentQuestions.set(userId, questions);

    // Count how many times the last message appears (fuzzy: same first 10 chars)
    const msgPrefix = message.slice(0, 10);
    const repeatCount = questions.filter(q => q.slice(0, 10) === msgPrefix).length;
    if (repeatCount >= 3) {
      confidence += 0.4;
    }
  }

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);

  return { frustrated: confidence > 0.6, confidence };
}

const lineRouter = Router();

// LINE Webhook verification & message handling
// Route matches the Webhook URL set in LINE Developers Console: /api/line/webhook
lineRouter.post("/api/line/webhook", async (req: Request, res: Response) => {
  logger.info("LINE Webhook", "Received request");
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const ownerUserId = process.env.LINE_OWNER_USER_ID;

    if (!channelSecret || !channelAccessToken) {
      logger.warn("LINE", "Missing LINE credentials, skipping webhook");
      res.status(200).json({ status: "ok", message: "LINE not configured" });
      return;
    }

    // Verify signature using raw body string (SECURITY: reject invalid signatures)
    const signature = req.headers["x-line-signature"] as string;
    if (!signature) {
      logger.warn("LINE", "Missing x-line-signature header, rejecting request");
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
      logger.warn("LINE", "Invalid webhook signature, rejecting request");
      res.status(200).json({ status: "ok" }); // Return 200 to avoid LINE retries
      return;
    }

    const events = req.body?.events || [];
    logger.info("LINE Webhook", `Processing ${events.length} events`);

    // Respond immediately to LINE (LINE requires 200 within 1 second)
    res.status(200).json({ status: "ok" });

    // Process events asynchronously after responding
    for (const event of events) {
      try {
        await processLineEvent(event, channelAccessToken, ownerUserId);
      } catch (err) {
        logger.error("LINE", "Error processing event:", err);
      }
    }
  } catch (err) {
    logger.error("LINE Webhook", "Error:", err);
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
    logger.info("LINE", `Unfollower: ${userId ? userId.slice(0, 8) + '...' : 'unknown'}`);
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
    logger.info("LINE", `New follower: ${userId ? userId.slice(0, 8) + '...' : 'unknown'}`);
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

        // Check if this is a RETURNING user (re-follow)
        const sessionId = `line-${userId}`;
        let conversation = await db.getConversationBySessionId(sessionId);
        const isReturning = !!conversation;

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

        // Build appropriate welcome based on returning vs new user
        let welcomeMessages: any[];

        if (isReturning && conversation) {
          // RETURNING USER: personalized welcome back with context
          const greeting = getNameGreeting(customerName, detectGenderFromName(customerName));
          const messages = await db.getMessagesByConversation(conversation.id, 20);
          // Find last vehicle they asked about
          const vehicleRegex = /(?:詢問|看|了解|這台)\s*([\u4e00-\u9fff\w]+\s+[\u4e00-\u9fff\w]+)/;
          const inquiryRegex = /我想詢問這台車[：:]\s*\n?\s*([A-Za-z][\w\s-]+?)\s+\d{4}年/;
          let lastVehicle: string | null = null;
          for (const msg of messages.reverse()) {
            const match = msg.content.match(vehicleRegex) || msg.content.match(inquiryRegex);
            if (match) { lastVehicle = match[1]; break; }
          }

          const welcomeText = lastVehicle
            ? `${greeting}你好！歡迎回來 🎉\n\n上次你問的 ${lastVehicle} 還在喔！要不要再看看？\n\n有什麼新的需求也儘管說，阿家隨時在！`
            : `${greeting}你好！歡迎回來 🎉\n\n有段時間沒聊了，最近有想找什麼車嗎？\n阿家隨時在，有什麼需要儘管問！`;

          welcomeMessages = [
            { type: "text", text: welcomeText, quickReply: {
              items: [
                { type: "action", action: { type: "message", label: "🔍 看最新車輛", text: "我想看車，有什麼車可以推薦？" } },
                { type: "action", action: { type: "message", label: "💰 50萬以下", text: "50萬以下有什麼好車？" } },
                { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車，什麼時候方便？" } },
                ...(lastVehicle ? [{ type: "action" as const, action: { type: "message" as const, label: `🚗 再看${lastVehicle.slice(0, 13)}`, text: `我想了解 ${lastVehicle}` } }] : []),
                { type: "action", action: { type: "message", label: "💬 隨便問問", text: "你好，我想了解崑家汽車" } },
              ],
            }},
          ];
          logger.info("LINE", `Returning user welcome sent (last vehicle: ${lastVehicle || "none"})`);
        } else {
          // NEW USER: standard welcome
          welcomeMessages = buildFollowWelcomeMessages();
        }
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
        logger.info("LINE", `Follow welcome push response: ${pushRes.status} ${pushBody}`);
      } catch (err) {
        logger.error("LINE", "Follow event handling failed:", err);
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

    // C6: Check if conversation is in human_handoff mode — skip AI image processing
    const imageSessionId = `line-${userId}`;
    const imageConv = await db.getConversationBySessionId(imageSessionId);
    if (imageConv && imageConv.status === 'human_handoff') {
      // Check timeout same as text messages
      const handoffAge = Date.now() - new Date(imageConv.updatedAt).getTime();
      const HANDOFF_TIMEOUT_MS = 30 * 60 * 1000;
      if (handoffAge <= HANDOFF_TIMEOUT_MS) {
        logger.info("LINE Image", `Conversation ${imageConv.id} is in human_handoff mode, skipping image processing`);
        return;
      }
      // Expired — reactivate and continue processing
      logger.info("LINE Image", `Conversation ${imageConv.id} handoff expired, reactivating AI`);
      await db.updateConversation(imageConv.id, { status: 'active' });
    }

    logger.info("LINE Image", `Received image message from ${userId.slice(0, 8)}...`);
    showTypingIndicator(userId, channelAccessToken);

    try {
      // 1. Download image from LINE
      const imageBuffer = await downloadLineImage(imageMessageId, channelAccessToken);
      if (!imageBuffer) {
        logger.warn("LINE Image", "Could not download image, skipping");
        return;
      }

      const imageBase64 = imageBuffer.toString("base64");
      logger.info("LINE Image", `Downloaded image, size: ${imageBuffer.length} bytes`);

      // 2. Use Gemini Vision to identify the vehicle
      const identified = await identifyVehicleFromImage(imageBase64);
      if (!identified) {
        logger.info("LINE Image", "Could not identify vehicle from image");
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

      logger.info("LINE Image", `Identified vehicle: ${identified.brand} ${identified.model}`);

      // 3. Match against inventory
      const allVehicles = await db.getAllVehicles();
      const matches = findMatchingVehicles(identified, allVehicles);
      logger.info("LINE Image", `Found ${matches.length} matching vehicles in inventory`);

      if (matches.length > 0) {
        // 4. Reply with matching vehicle Flex cards
        const flexMessages = buildVehicleCarouselMessages(
          matches,
          `🔍 ${identified.brand} ${identified.model}`,
          "根據你傳的照片，幫你找到這些車"
        );

        // Prepend a text message
        // Build rich description from enhanced recognition
        const extraInfo = [];
        if ((identified as any).year) extraInfo.push(`約${(identified as any).year}`);
        if ((identified as any).color) extraInfo.push(`${(identified as any).color}`);
        const extraStr = extraInfo.length > 0 ? `（${extraInfo.join("・")}）` : "";
        const priceNote = (identified as any).price
          ? `\n你看到的那台售價 ${(identified as any).price}，馬上幫你查詳細資訊 👇`
          : "";

        const textMsg = {
          type: "text" as const,
          text: `我看到你傳了一張 ${identified.brand} ${identified.model}${extraStr} 的照片！🚗\n我們剛好有 ${matches.length} 台${identified.brand} ${identified.model} 可以看，幫你列出來 👇${priceNote}`,
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
      logger.error("LINE Image", "Processing error:", err);
    }
    return;
  }

  // ============ POSTBACK EVENT ============
  if (event.type === "postback") {
    const postbackData = event.postback?.data || "";
    logger.info("LINE", `Postback received: ${postbackData} from user ${event.source?.userId}`);
    // Parse postback data and handle known actions
    const params = new URLSearchParams(postbackData);
    const action = params.get("action");
    if (action) {
      logger.info("LINE", `Postback action: ${action}`);
    }
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") {
    const msgType = event.message?.type;
    logger.info("LINE", `Non-text message: ${event.type}, type: ${msgType}`);
    // Respond to non-text messages (sticker, location, video, audio) instead of silently discarding
    // But respect human_handoff — don't reply if human is handling the conversation
    if (event.type === "message" && msgType && ["sticker", "location", "video", "audio", "file"].includes(msgType)) {
      const nonTextUserId = event.source?.userId;
      if (nonTextUserId) {
        const nonTextConv = await db.getConversationBySessionId(`line-${nonTextUserId}`);
        if (nonTextConv?.status === 'human_handoff') {
          logger.info("LINE", `Non-text message from ${nonTextUserId.slice(0,8)}... — in human_handoff mode, skipping`);
          return;
        }
      }
      const replyToken = event.replyToken;
      const typeResponses: Record<string, string> = {
        sticker: "收到你的貼圖了！有什麼車的問題想問的嗎？阿家隨時在 😊",
        location: "收到你的位置了！我們崑家汽車在高雄市，地址是高雄市鳳山區建國路三段47號，歡迎來店賞車！",
        video: "收到你的影片了！如果是想問某台車的資訊，可以直接告訴阿家車款名稱喔！",
        audio: "收到你的語音了！目前阿家還沒辦法聽語音，麻煩用文字告訴我你想了解什麼車 🙏",
        file: "收到你的檔案了！如果有什麼車的問題，歡迎直接用文字問阿家喔！",
      };
      const responseText = typeResponses[msgType] || "收到！有什麼車的問題歡迎直接問阿家 😊";
      if (replyToken) {
        try {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
            body: JSON.stringify({ replyToken, messages: [{ type: "text", text: responseText }] }),
          });
        } catch (err) {
          logger.error("LINE", "Non-text reply failed:", err);
        }
      }
    }
    return;
  }

  const userId = event.source?.userId;
  const userMessage = sanitizeChatMessage(event.message.text);
  const replyToken = event.replyToken;
  const messageId = event.message?.id;

  logger.info("LINE", `Message from ${userId ? userId.slice(0,8) + '...' : 'unknown'}: [message length: ${userMessage?.length || 0}]`);

  if (!userId || !userMessage || !replyToken) {
    logger.warn("LINE", "Missing userId, message, or replyToken");
    return;
  }

  // Deduplication: skip if we already processed this message (LINE retry)
  if (messageId && isDuplicate(messageId)) {
    logger.info("LINE", `Duplicate message ${messageId}, skipping`);
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
        logger.info("LINE", "Got profile: [name retrieved]");
      }
    } catch (err) {
      logger.warn("LINE", "Failed to get profile:", err);
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

  // ============ HUMAN HANDOFF MODE: AI should not respond ============
  // Exception: Rich Menu triggers (看車庫存, 預約賞車 etc.) and new vehicle inquiries
  // should reactivate AI — customer is starting a new interaction
  if (conversation && conversation.status === 'human_handoff') {
    const isRichMenuAction = !!detectRichMenuTrigger(userMessage);
    const isNewInquiry = /我想詢問這台車|我想了解/.test(userMessage);

    // C5: Auto-reactivate if handoff has been active for more than 30 minutes
    const handoffAge = Date.now() - new Date(conversation.updatedAt).getTime();
    const HANDOFF_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const isHandoffExpired = handoffAge > HANDOFF_TIMEOUT_MS;

    if (isRichMenuAction || isNewInquiry || isHandoffExpired) {
      if (isHandoffExpired) {
        logger.info("LINE", `Conversation ${convId} handoff expired after 30min, reactivating AI`);
      } else {
        logger.info("LINE", `Conversation ${convId} was in human_handoff but user started new interaction, reactivating AI`);
      }
      await db.updateConversation(convId, { status: 'active' });
    } else {
      logger.info("LINE", `Conversation ${convId} is in human_handoff mode, AI skipping`);
      await db.addMessage({ conversationId: convId, role: "user", content: userMessage });
      return;
    }
  }

  // ============ HUMAN HANDOFF TRIGGER: User requests real human ============
  const humanHandoffPattern = /想跟真人|想和真人|找真人|要真人|真人客服|人工客服|轉真人|不想跟機器人|找人處理|我想跟真人業務聊聊這台車/;
  if (humanHandoffPattern.test(userMessage)) {
    logger.info("LINE", `User requested human handoff: ${userId.slice(0, 8)}...`);
    // Save user message
    await db.addMessage({ conversationId: convId, role: "user", content: userMessage });
    // Extract vehicle context from recent messages before notifying staff
    const recentMessages = await db.getMessagesByConversation(convId, 10);
    const vehicleContext = recentMessages.reverse().find(m =>
      m.content.match(/我想詢問這台車|BMW|Toyota|Honda|Volkswagen|Mitsubishi|Mazda|Nissan|Kia|Hyundai|Ford|Suzuki/)
    );
    const handoffUserMessage = vehicleContext
      ? `${userMessage}\n（近期詢問車輛：${vehicleContext.content.slice(0, 60)}）`
      : userMessage;
    // C7: Notify staff first, then adjust reply based on whether notification was sent
    const notificationSent = await sendHumanHandoffNotification(conversation!, handoffUserMessage, "", channelAccessToken, ownerUserId);
    const handoffReply = notificationSent
      ? "好的沒問題！我已經通知業務了，賴先生會盡快跟你聯繫！"
      : "目前業務不在線上，你可以直接撥打 0936-812-818 找賴先生";
    await db.addMessage({ conversationId: convId, role: "assistant", content: handoffReply });
    try {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: [{ type: "text", text: handoffReply }],
        }),
      });
    } catch (err) {
      logger.error("LINE", "Human handoff reply failed:", err);
    }
    // Update conversation status
    await db.updateConversation(convId, { status: 'human_handoff' });
    return;
  }

  // Save user message FIRST
  const savedMsg = await db.addMessage({
    conversationId: convId,
    role: "user",
    content: userMessage,
  });
  logger.info("LINE", `Saved user message: id=${savedMsg.id}, convId=${convId}`);

  // Track conversation for short-term recovery nudges
  updateConversationTracker(userId, userMessage);

  // ============ FRUSTRATION DETECTION ============
  const frustration = detectFrustration(userMessage, userId);
  if (frustration.frustrated) {
    logger.info("LINE", `Frustration detected (confidence: ${frustration.confidence.toFixed(2)}) from ${userId.slice(0, 8)}...`);
    db.addAnalyticsEvent({
      conversationId: convId,
      userId,
      eventCategory: "emotion",
      eventAction: "frustration_detected",
      eventLabel: `confidence=${frustration.confidence.toFixed(2)}`,
      channel: "line",
    });
  }

  // ============ AUTO-DETECT PHONE NUMBER ============
  const detectedPhone = detectPhoneNumber(userMessage);
  if (detectedPhone && !conversation!.customerContact) {
    await db.updateConversation(convId, { customerContact: detectedPhone });
    conversation = { ...conversation!, customerContact: detectedPhone };
    logger.info("LINE", "Phone number detected and saved: [REDACTED]");
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
    logger.info("LINE", `Lead score updated: +${scoreDelta} = ${newScore} (${newStatus})`);
  }

  // ============ CHECK IF THIS IS A PHOTO TRIGGER ============
  const photoExternalId = detectPhotoTrigger(userMessage);

  if (photoExternalId) {
    logger.info("LINE", `Photo trigger detected for externalId: ${photoExternalId}`);
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
        logger.info("LINE", `Sending ${photoMessages.length} photo messages...`);
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
        logger.info("LINE", `Photo reply response: ${replyRes.status} ${replyBody}`);
      } catch (err) {
        logger.error("LINE", "Photo reply failed:", err);
      }

      const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
      await checkAndNotifyOwner(conversation!, userMessage, channelAccessToken, ownerUserId, phoneJustFound);
      return;
    } else {
      // Vehicle not found — reply with a helpful message instead of falling through
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({
          replyToken,
          messages: [{ type: "text", text: "不好意思，這台車的照片目前無法顯示，可能已經下架囉！你可以點下方「看車庫存」看看其他好車" }],
        }),
      });
      return;
    }
  }

  // ============ CHECK IF THIS IS A FAQ PROGRESSIVE TRIGGER ============
  const faqItem = detectFaqTrigger(userMessage);

  if (faqItem) {
    logger.info("LINE", `FAQ trigger detected: #${faqItem.id} ${faqItem.title}`);
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
    logger.info("LINE", `FAQ lead score: +${faqScore} = ${newScore}`);

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
      logger.info("LINE", `FAQ answer reply: ${replyRes.status} ${replyBody}`);
    } catch (err) {
      logger.error("LINE", "FAQ reply failed:", err);
    }

    const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
    await checkAndNotifyOwner(conversation!, userMessage, channelAccessToken, ownerUserId, phoneJustFound);
    return;
  }

  // ============ CHECK IF THIS IS A RICH MENU TRIGGER ============
  const trigger = detectRichMenuTrigger(userMessage);

  if (trigger) {
    logger.info("LINE", `Rich Menu trigger detected: ${trigger.type} (${trigger.label})`);
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
        logger.info("LINE", `Sending ${flexMessages.length} Flex Message(s) reply...`);
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
        logger.info("LINE", `Flex reply response: ${replyRes.status} ${replyBody}`);
      } catch (err) {
        logger.error("LINE", "Flex reply failed:", err);
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
  logger.info("LINE", `History: total=${allHistory.length}, using last ${history.length} messages`);

  const allVehicles = await db.getAllVehicles();
  const vIndex = buildVehicleIndex(allVehicles);

  // ============ VEHICLE DETECTION v5: Context-aware detection ============
  // Pass conversation history so follow-up questions can resolve to previously discussed vehicles
  const historyForDetection = history.map(m => ({ role: m.role, content: m.content }));
  const detection = detectVehicleFromMessage(userMessage, allVehicles, historyForDetection, vIndex);
  logger.info("VehicleDetection", `type=${detection.type}, vehicle=${detection.vehicle?.brand || 'none'} ${detection.vehicle?.model || ''}, question=${detection.questionType}, answer=${detection.directAnswer}`);

  // ============ INTENT DETECTION v7: Detect customer intents and inject focused instructions ============
  const customerIntents = detectCustomerIntents(userMessage);
  logger.info("IntentDetection", `intents=${customerIntents.join(', ') || 'none'}`);

  const greeting = getNameGreeting(customerName, customerGender);

  let replyText: string;
  let isHumanHandoff = false;

  // ============ FLEXIBLE TIME → SILENT HANDOFF (AI 完全不回覆) ============
  // Customer says "時間彈性" or "幫我安排" → AI 靜默，真人業務直接接手
  if (/時間彈性|你們幫我安排|幫我安排就好|幫我安排時間|都可以.*安排|你安排/.test(userMessage)) {
    logger.info("LINE", "Flexible time detected — silent handoff, AI does NOT reply");
    await db.addMessage({ conversationId: convId, role: "user", content: userMessage });
    await sendHumanHandoffNotification(conversation!, userMessage, '（AI 未回覆，靜默轉交真人）', channelAccessToken, ownerUserId);
    await db.updateConversation(convId, { status: 'human_handoff' });
    return;
  }

  // ============ RULE-BASED MODE vs LLM MODE ============
  if (isRuleBasedMode()) {
    logger.info("LINE", "Rule-based mode active (FORCE_RULE_BASED_REPLY=1)");
    replyText = generateRuleBasedReply({
      userMessage,
      greeting,
      detection,
      intents: customerIntents,
      customerContact: conversation!.customerContact,
      leadScore: conversation!.leadScore ?? undefined,
    });
    logger.info("LINE", `Rule-based response: ${replyText.substring(0, 100)}`);
  } else {
    logger.info("LINE", "LLM mode, calling Claude API...");

    // Build smart vehicle KB: if target vehicle detected, show it prominently and abbreviate others
    const vehicleKB = buildSmartVehicleKB(allVehicles, detection.vehicle);

    // Build target vehicle prompt (will be placed at the END of system prompt for recency bias)
    const targetVehiclePrompt = buildTargetVehiclePrompt(detection, userMessage, conversation!.customerContact);
    const intentInstructions = buildIntentInstructions(customerIntents, userMessage, greeting, conversation!.customerContact, detection.vehicle);

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
      isFirstMessage: history.length <= 1,
    };

    const llmMessages = buildLLMMessages(promptContext, history.map(m => ({ role: m.role, content: m.content })));
    logger.info("LINE", `Dynamic prompt: ${llmMessages.length} messages, intents=${customerIntents.join(',') || 'none'}, vehicle=${detection.vehicle?.brand || 'none'}`);

    try {
      const response = await invokeLLM({ messages: llmMessages });
      replyText =
        typeof response.choices[0]?.message?.content === "string"
          ? response.choices[0].message.content
          : "";
      if (!replyText) {
        logger.warn("LINE", "LLM returned empty content, falling back to rule-based reply");
        replyText = generateRuleBasedReply({
          userMessage,
          greeting,
          detection,
          intents: customerIntents,
          customerContact: conversation!.customerContact,
          leadScore: conversation!.leadScore ?? undefined,
        });
      }
      logger.info("LINE", `LLM response: ${replyText.substring(0, 100)}`);
    } catch (err) {
      logger.error("LINE", "LLM error, falling back to rule-based reply:", err);
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

  // ============ POST-PROCESSING: Clean up LLM output ============
  // Remove system message leaks (LLM sometimes mimics [系統...] format)
  replyText = replyText.replace(/\[系統[^\]]*\][^\n]*/g, '').trim();
  // Remove markdown formatting (LINE doesn't render it)
  replyText = replyText.replace(/\*\*/g, '');
  replyText = replyText.replace(/^\s*[-*]\s+/gm, '');
  replyText = replyText.replace(/^---+$/gm, '');
  replyText = replyText.replace(/^#+\s+/gm, '');            // Remove ## heading markdown
  // Remove periods (unnatural in LINE chat)
  replyText = replyText.replace(/。/g, '');
  // For appointment and loan intents: preserve line breaks (structured format with 姓名/電話 fields)
  // For other intents: collapse newlines into spaces for single-line output (不分段 rule)
  const isSpecQuery = /詳細規格|規格|細節|配備|詳細|了解.*規格/.test(userMessage);
  const needsStructuredFormat = customerIntents.includes('appointment') || customerIntents.includes('loan') || isSpecQuery;
  if (needsStructuredFormat) {
    // Keep line breaks but clean up excessive blank lines (max 1 blank line between sections)
    replyText = replyText.replace(/\n{3,}/g, '\n\n').trim();
  } else {
    replyText = replyText.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  // ============ HUMAN HANDOFF DETECTION ============
  // Check if AI flagged [HUMAN_HANDOFF] in its response
  if (replyText.includes('[HUMAN_HANDOFF]')) {
    isHumanHandoff = true;
    // Remove the marker from the customer-facing message
    replyText = replyText.replace(/\s*\[HUMAN_HANDOFF\]\s*/g, '').trim();
    logger.info("LINE", "HUMAN HANDOFF triggered! AI cannot answer this question.");
  }
  
  // Also detect if AI said "I'll check for you" type phrases (secondary detection)
  // This catches cases where AI didn't use the marker but still couldn't answer
  const uncertaintyPatterns = /我幫你確認一下|我幫你問問|我幫你查|我不太確定|這個我要確認|我幫您確認|我幫您查/;
  if (!isHumanHandoff && uncertaintyPatterns.test(replyText)) {
    isHumanHandoff = true;
    // Append human handoff message to the reply
    replyText += '\n\n🙋‍♂️ 我已經通知專人了，真人客服馬上就到！';
    logger.info("LINE", "HUMAN HANDOFF triggered (uncertainty detected in AI response).");
  }

  // ============ FRUSTRATION-TRIGGERED EMPATHETIC RESPONSE ============
  if (frustration.frustrated && !isHumanHandoff) {
    isHumanHandoff = true;
    replyText = '不好意思讓你不方便了！我馬上幫你轉給阿家本人處理 🙏\n\n真人客服馬上就到，請稍等一下！';
    logger.info("LINE", `FRUSTRATION HANDOFF triggered (confidence: ${frustration.confidence.toFixed(2)})`);
  }

  // Save assistant response
  await db.addMessage({
    conversationId: convId,
    role: "assistant",
    content: replyText,
  });

  // Build contextual quick reply based on conversation state (personalized)
  // Extract previously discussed vehicles from conversation history
  const allMessages = await db.getMessagesByConversation(convId, 30);
  const prevVehicles: string[] = [];
  for (const msg of allMessages) {
    const vMatch = msg.content.match(/(?:詢問|了解|看|這台)\s*([\u4e00-\u9fff\w]+\s+[\u4e00-\u9fff\w]+)/);
    if (vMatch && !prevVehicles.includes(vMatch[1])) prevVehicles.push(vMatch[1]);
  }

  const quickReplyCtx: ConversationContext = {
    hasVehicle: detection.type !== 'none' && !!detection.vehicle,
    hasAppointment: customerIntents.includes('appointment'),
    hasContact: !!conversation!.customerContact,
    vehicleName: detection.vehicle ? `${detection.vehicle.brand} ${detection.vehicle.model}` : undefined,
    vehicleExternalId: detection.vehicle?.externalId ? String(detection.vehicle.externalId) : undefined,
    previousVehicles: prevVehicles.slice(0, 3),
    messageCount: allMessages.length,
    leadScore: conversation!.leadScore || 0,
  };
  const quickReply = buildContextualQuickReply(quickReplyCtx);

  // Reply via LINE API with contextual quick replies
  try {
    logger.info("LINE", "Sending reply via LINE API...");
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
    logger.info("LINE", `Reply API response: ${replyRes.status} ${replyBody}`);
  } catch (err) {
    logger.error("LINE", "Reply failed:", err);
  }

  // ============ HUMAN HANDOFF: Push notification to owner + staff ============
  if (isHumanHandoff) {
    const notificationSent = await sendHumanHandoffNotification(
      conversation!,
      userMessage,
      replyText,
      channelAccessToken,
      ownerUserId
    );
    // C7: If no recipients were configured, send fallback message with phone number
    if (!notificationSent) {
      const fallbackText = "目前業務不在線上，你可以直接撥打 0936-812-818 找賴先生";
      await db.addMessage({ conversationId: convId, role: "assistant", content: fallbackText });
      try {
        await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            to: userId,
            messages: [{ type: "text", text: fallbackText }],
          }),
        });
      } catch (err) {
        logger.error("LINE", "Handoff fallback push failed:", err);
      }
    }
    // Mark conversation so AI stops responding until staff resolves it
    await db.updateConversation(convId, { status: 'human_handoff' });
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
  // Skip notifications during human handoff — staff is already handling this customer
  if (conversation.status === 'human_handoff') {
    logger.info("LINE", `Skipping owner notification — conversation ${conversation.id} is in human_handoff mode`);
    return;
  }

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
    // Update DB BEFORE sending notification to prevent duplicates on crash
    const newLevel = Math.max(currentNotifiedLevel, newMilestoneLevel);
    await db.updateConversation(conversation.id, { notifiedOwner: newLevel });

    await notifyOwner({ title, content });

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
          logger.info("LINE", `Sent Flex notification to [REDACTED] (milestone: ${newLevel}, score: ${score}). Phone: [REDACTED]. Response: ${pushRes.status}`);
        } catch (pushErr) {
          logger.error("LINE", "Failed to push notification to [REDACTED]:", pushErr);
        }
      }
    }
  } catch (err) {
    logger.error("LINE", "Owner notification failed:", err);
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
): Promise<boolean> {
  const customerName = conversation.customerName || "未知客戶";
  
  logger.info("LINE", `Sending HUMAN HANDOFF notification for customer: ${customerName}`);
  
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
          logger.info("LINE", `Human handoff notification sent to [REDACTED]. Response: ${pushRes.status}`);
        } catch (pushErr) {
          logger.error("LINE", "Failed to send human handoff notification:", pushErr);
        }
      }
      return true;
    } else {
      logger.warn("LINE", "No recipients configured for human handoff notification!");
      return false;
    }
  } catch (err) {
    logger.error("LINE", "Human handoff notification failed:", err);
    return false;
  }
}

// ============ SHORT-TERM CONVERSATION RECOVERY ============
// Sends a gentle nudge when a user goes quiet mid-conversation (5-8 min)
// Different from follow-up system which handles 18-48 hour gaps

interface ConversationTrack {
  lastMessageTime: number;
  messageCount: number;
  lastTopic: "vehicle_inquiry" | "loan" | "booking" | "general";
  lastVehicle?: string; // brand + model
  nudgeSent: boolean;
}

// NOTE: In-memory tracker — nudge state is lost on restart.
// This is acceptable for short-term nudges (5-8 min window) but means
// a restart mid-conversation may cause a missed nudge or duplicate.
// For production scale, consider persisting to DB or Redis.
const conversationTracker = new Map<string, ConversationTrack>();

function detectConversationTopic(message: string): ConversationTrack["lastTopic"] {
  if (/預約|看車|賞車|試駕|到店|什麼時候|幾點|營業/i.test(message)) return "booking";
  if (/貸款|分期|頭期|月付|利率|零利率|刷卡|匯款|付款方式/i.test(message)) return "loan";
  if (/BMW|Toyota|Honda|Ford|Kia|Hyundai|Suzuki|Mitsubishi|Volkswagen|VW|什麼車|推薦|這台|那台|庫存|有沒有|幾年|里程|cc|排氣/i.test(message)) return "vehicle_inquiry";
  return "general";
}

function detectVehicleNameFromMessage(message: string): string | undefined {
  const match = message.match(/(Toyota|Honda|Ford|BMW|Kia|Hyundai|Suzuki|Mitsubishi|Volkswagen|VW|Mazda|Nissan|Lexus|Benz|Mercedes|Audi|Volvo|豐田|本田|福特|現代|鈴木|三菱|福斯|馬自達|日產|賓士|奧迪|富豪)\s*([\w\-\u4e00-\u9fff]+)/i);
  if (match) return `${match[1]} ${match[2]}`;
  return undefined;
}

export function updateConversationTracker(userId: string, message: string) {
  const existing = conversationTracker.get(userId);
  const topic = detectConversationTopic(message);
  const vehicle = detectVehicleNameFromMessage(message);

  conversationTracker.set(userId, {
    lastMessageTime: Date.now(),
    messageCount: (existing?.messageCount || 0) + 1,
    lastTopic: topic !== "general" ? topic : (existing?.lastTopic || "general"),
    lastVehicle: vehicle || existing?.lastVehicle,
    nudgeSent: false, // Reset on new message
  });
}

async function checkConversationRecovery() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) return;

  const now = Date.now();
  const FIVE_MIN = 5 * 60 * 1000;
  const EIGHT_MIN = 8 * 60 * 1000;
  const THIRTY_MIN = 30 * 60 * 1000;

  const entries = Array.from(conversationTracker.entries());
  for (const [userId, track] of entries) {
    const elapsed = now - track.lastMessageTime;

    // Clean up stale entries (30+ min after nudge with no reply)
    if (track.nudgeSent && elapsed > THIRTY_MIN) {
      conversationTracker.delete(userId);
      continue;
    }

    // Skip if already nudged, not enough messages, or outside the 5-8 min window
    if (track.nudgeSent) continue;
    if (track.messageCount < 2) continue;
    if (elapsed < FIVE_MIN || elapsed > EIGHT_MIN) continue;

    // Skip nudge if conversation is in human_handoff mode
    const conv = await db.getConversationBySessionId(`line-${userId}`);
    if (conv?.status === 'human_handoff') {
      logger.info("LINE", `Skipping nudge for ${userId.slice(0, 8)}... — in human_handoff mode`);
      continue;
    }

    // Build contextual nudge message
    let nudgeText: string;
    const quickReplyItems: any[] = [];

    if (track.lastTopic === "vehicle_inquiry" && track.lastVehicle) {
      nudgeText = `剛剛聊到的 ${track.lastVehicle}，還有什麼想了解的嗎？😊 或者我幫你安排看車？`;
      quickReplyItems.push(
        { type: "action", action: { type: "message", label: "📅 預約看車", text: `我想預約看 ${track.lastVehicle}` } },
        { type: "action", action: { type: "message", label: "💰 問價格", text: `${track.lastVehicle} 多少錢？` } },
        { type: "action", action: { type: "uri", label: "📞 直接打電話", uri: "tel:0936812818" } },
      );
    } else if (track.lastTopic === "loan") {
      nudgeText = "貸款的部分還有疑問嗎？需要的話我可以請專員幫你算方案 💰";
      quickReplyItems.push(
        { type: "action", action: { type: "message", label: "💰 填貸款評估", text: "我想了解貸款方案" } },
        { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車" } },
        { type: "action", action: { type: "uri", label: "📞 直接打電話", uri: "tel:0936812818" } },
      );
    } else if (track.lastTopic === "booking") {
      nudgeText = "看車的時間有想到嗎？不用完全確定，我們電話再聊也可以 😊";
      quickReplyItems.push(
        { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車，什麼時候方便？" } },
        { type: "action", action: { type: "message", label: "🕐 時間彈性", text: "我時間彈性，你們幫我安排" } },
        { type: "action", action: { type: "uri", label: "📞 直接打電話", uri: "tel:0936812818" } },
      );
    } else {
      nudgeText = "還有其他想了解的嗎？隨時都可以問喔！";
      quickReplyItems.push(
        { type: "action", action: { type: "message", label: "🚗 看車輛", text: "我想看車，有什麼車可以推薦？" } },
        { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車" } },
        { type: "action", action: { type: "uri", label: "📞 直接打電話", uri: "tel:0936812818" } },
      );
    }

    // Send the nudge via LINE push
    try {
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
          to: userId,
          messages: [{
            type: "text",
            text: nudgeText,
            quickReply: { items: quickReplyItems },
          }],
        }),
      });

      // Mark as nudged
      track.nudgeSent = true;
      logger.info("LINE Recovery", `Nudge sent to ${userId.slice(0, 8)}... (topic: ${track.lastTopic})`);

      // Save to conversation history
      const sessionId = `line-${userId}`;
      const conversation = await db.getConversationBySessionId(sessionId);
      if (conversation) {
        await db.addMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: `[系統短期跟進] ${nudgeText}`,
        });
      }
    } catch (err) {
      logger.error("LINE Recovery", `Nudge failed for ${userId.slice(0, 8)}...:`, err);
    }
  }
}

// Run conversation recovery check every 60 seconds
setInterval(() => {
  checkConversationRecovery().catch((err) => logger.error("LINE Recovery", "Check error:", err));
}, 60 * 1000);

// ============ FOLLOW-UP PUSH MESSAGING SYSTEM ============
// Sends a gentle follow-up to users who inquired but didn't book
// Runs periodically (call from a cron job or interval)

const followUpCooldown = new Map<number, number>(); // convId → last follow-up timestamp

export async function sendFollowUpMessages() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) return;

  try {
    // Find conversations with recent activity (last 24-48 hours) that haven't booked
    const result = await db.listConversations();
    const allConvs = result?.items || [];
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    for (const conv of allConvs) {
      if (!conv.sessionId?.startsWith("line-")) continue;
      if (conv.leadStatus === "converted" || conv.leadStatus === "lost") continue;
      if (conv.status === 'human_handoff') continue;
      if ((conv.leadScore || 0) < 30) continue; // Only follow up engaged users

      // Check cooldown (max once per 48h) — also check DB to survive restarts
      const lastFollowUp = followUpCooldown.get(conv.id) || 0;
      if (now - lastFollowUp < 2 * ONE_DAY) continue;

      // Check last message time
      const messages = await db.getMessagesByConversation(conv.id, 5);

      // DB-based cooldown: if last assistant message was within 48h, skip (survives restart)
      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistantMsg && Date.now() - new Date(lastAssistantMsg.createdAt).getTime() < 48 * 60 * 60 * 1000) {
        continue; // Already followed up recently
      }
      if (messages.length === 0) continue;
      const lastMsg = messages[messages.length - 1];
      const lastMsgTime = new Date(lastMsg.createdAt || 0).getTime();
      const hoursSinceLastMsg = (now - lastMsgTime) / (60 * 60 * 1000);

      // Follow up between 18-48 hours after last message
      if (hoursSinceLastMsg < 18 || hoursSinceLastMsg > 48) continue;

      const userId = conv.sessionId.replace("line-", "");
      const greeting = getNameGreeting(conv.customerName, detectGenderFromName(conv.customerName));

      // Find last vehicle they asked about
      let lastVehicle: string | null = null;
      for (const msg of [...messages].reverse()) {
        const match = msg.content.match(/(?:詢問|看|了解)\s*([\u4e00-\u9fff\w]+\s+[\u4e00-\u9fff\w]+)/);
        if (match) { lastVehicle = match[1]; break; }
      }

      const followUpText = lastVehicle
        ? `${greeting}你好～ 昨天看的 ${lastVehicle} 今天有其他人在問喔！😊\n\n要不要先卡個位？預約看車完全免費，不滿意也沒關係 👇`
        : `${greeting}你好～ 上次聊到一半不知道有沒有幫到你？😊\n\n如果還有任何疑問，隨時跟阿家說，或者直接預約來店看看 👇`;

      try {
        await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            to: userId,
            messages: [{
              type: "text",
              text: followUpText,
              quickReply: {
                items: [
                  { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車" } },
                  { type: "action", action: { type: "message", label: "💰 問貸款", text: "我想了解貸款方案" } },
                  { type: "action", action: { type: "uri", label: "📞 直接打電話", uri: "tel:0936812818" } },
                ],
              },
            }],
          }),
        });

        followUpCooldown.set(conv.id, now);
        logger.info("LINE", `Follow-up sent to conv ${conv.id} (${greeting})`);

        // Save follow-up to conversation
        await db.addMessage({
          conversationId: conv.id,
          role: "assistant",
          content: `[系統自動跟進] ${followUpText}`,
        });
      } catch (err) {
        logger.error("LINE", `Follow-up push failed for conv ${conv.id}:`, err);
      }
    }
  } catch (err) {
    logger.error("LINE", "Follow-up system error:", err);
  }
}

// Run follow-up check every 2 hours
setInterval(() => {
  sendFollowUpMessages().catch((err) => logger.error("LINE", "Follow-up interval error:", err));
}, 2 * 60 * 60 * 1000);

export { lineRouter };
