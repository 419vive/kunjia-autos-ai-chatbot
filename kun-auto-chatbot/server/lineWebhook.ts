import { Router, Request, Response } from "express";
import crypto from "crypto";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { detectRichMenuTrigger, buildRichMenuResponseMessages, buildAppointmentDatetimePicker, detectPhotoTrigger, buildPhotoCarousel, buildFollowWelcomeMessages, buildFaqCarousel, detectFaqTrigger, buildFaqAnswerMessages, buildContextualQuickReply, buildVehicleCarouselMessages, buildVideoShowcaseCard, type ConversationContext } from "./lineFlexTemplates";
import { formatTimeSlotsForPrompt } from "./timeSlotHelper";
import { detectVehicleFromMessage, buildSmartVehicleKB, buildTargetVehiclePrompt, detectCustomerIntents, buildIntentInstructions, buildVehicleIndex } from "./vehicleDetectionService";
import { buildLLMMessages, type PromptContext } from "./dynamicPromptBuilder";
import { isRuleBasedMode, generateRuleBasedReply, buildVehicleAnswerReply } from "./ruleBasedReply";
import { extractCustomerPreferences } from "./customerMemoryExtractor";
import { sanitizeChatMessage, validateLLMOutput, getGuardrailMode } from "./security";

import { detectPhoneNumber, detectGenderFromName, getGenderGreeting, getNameGreeting, isOperator, parseOperatorCommand, type OperatorCommand } from "./lineUtils";
import { getAssistantContentForTrigger, buildOwnerNotificationFlex, getMilestoneLevel, checkAndNotifyOwner, buildHumanHandoffFlex, sendHumanHandoffNotification, sendNewCustomerNotification } from "./lineNotification";
import { updateConversationTracker, sendFollowUpMessages } from "./lineRecovery";
import { detectCriticalHandoff } from "./handoffTriggers";
import { SHOP_ADDRESS, SHOP_PHONE, SHOP_CONTACT_PERSON } from "../shared/shopConfig";

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
      console.error(`[LINE Image] Gemini Vision error: ${res.status}`, errorBody.substring(0, 300));
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("[LINE Image] Gemini Vision raw response:", content.substring(0, 500));

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

// ============ TRADE-IN CONTEXT DETECTION ============
// Checks if a conversation is in a trade-in flow by scanning the last ~5
// assistant messages for the trade-in template. Used to distinguish between
// customer shopping for inventory (photo of car brand/model) vs.
// customer responding to a trade-in request (photo of their own car).
async function isTradeInContext(conversationId: number): Promise<boolean> {
  try {
    const allMessages = await db.getMessagesByConversation(conversationId, 10);
    if (!allMessages || allMessages.length === 0) return false;

    // Scan the last 5 messages in reverse (most recent first)
    const recentMessages = allMessages.slice(-5);

    // Look for the trade-in template marker in assistant messages
    // The template contains "估車仍會以實際看到車況為主" or "可以先提供以下資訊給我"
    const tradeInMarkers = [
      "估車仍會以實際看到車況為主",
      "可以先提供以下資訊給我",
      "品牌／年份／里程數",
      "車身外觀與內裝的詳細照片",
    ];

    for (const msg of recentMessages) {
      if (msg.role === "assistant") {
        for (const marker of tradeInMarkers) {
          if (msg.content.includes(marker)) {
            console.log(`[LINE Image] Trade-in context detected: message contains "${marker}"`);
            return true;
          }
        }
      }
    }

    return false;
  } catch (err) {
    console.error("[LINE Image] Error checking trade-in context:", err);
    return false;
  }
}

// ============ OPERATOR COMMAND HANDLER ============
// Executes /lock, /unlock, /list, /status, /help when an operator (whitelisted
// userId) texts the bot from their own LINE. Replies in-thread.
//
// Target resolution: operators only know the LAST 8 chars of the customer's
// LINE userId (visible in the analytics dashboard / handoff Flex card).
// We resolve by suffix-matching against `conversations.sessionId`
// (which is `line-<userId>` for LINE customers).
async function handleOperatorCommand(
  cmd: OperatorCommand,
  operatorUserId: string,
  replyToken: string,
  channelAccessToken: string
): Promise<void> {
  const reply = async (text: string) => {
    try {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
      });
    } catch (err) {
      console.error("[LINE Operator] reply failed:", err);
    }
  };

  if (!cmd) return;

  const HELP_TEXT = [
    "📋 操作員指令：",
    "/lock <last8>  → 鎖定 AI（用客人 userId 後8碼）",
    "/lock          → 鎖定最近一筆 LINE 對話",
    "/unlock <last8>→ 恢復 AI",
    "/list          → 列出最近 5 筆 LINE 對話",
    "/status <last8>→ 查單筆狀態",
    "/help          → 顯示這份說明",
    "",
    "💡 你也可以在我傳的「真人接手通知」或「高品質潛客」卡片底下，",
    "直接點「🔒 我來接手」一鍵鎖定 AI。",
  ].join("\n");

  if (cmd.kind === 'help') {
    await reply(HELP_TEXT);
    return;
  }

  // Helper: find LINE conversations matching a sessionId-suffix.
  // Limit raised to 200 so older convs still resolve when an operator types
  // last8 they remember from a notification card.
  const findBySuffix = async (suffix: string | null) => {
    const list = await db.listConversations({ channel: 'line', limit: 200 });
    const items = list?.items || [];
    if (!suffix) return items;
    const s = suffix.trim().toLowerCase();
    return items.filter(c => c.sessionId.toLowerCase().endsWith(s));
  };

  // Privacy: by default, mask customer names in /list output. Operator can
  // request `/list full` for unmasked. (LINE account compromise is the new
  // attack surface — limit blast radius.)
  const maskName = (name: string | null | undefined): string => {
    const n = (name || '').trim();
    if (!n) return '(無名)';
    if (n.length === 1) return n;
    if (n.length === 2) return n[0] + '*';
    return n[0] + '*'.repeat(Math.max(1, n.length - 2)) + n[n.length - 1];
  };

  if (cmd.kind === 'list') {
    const list = await db.listConversations({ channel: 'line', limit: 5 });
    const items = list?.items || [];
    if (items.length === 0) {
      await reply("目前沒有 LINE 對話");
      return;
    }
    const showFull = (cmd.target ?? '').toLowerCase() === 'full';
    const lines = [showFull ? "📋 最近 5 筆 LINE 對話 (full)：" : "📋 最近 5 筆 LINE 對話："];
    for (const c of items) {
      const last8 = c.sessionId.slice(-8);
      const lock = (c as any).aiDisabled === 1 ? "🔒" : (c.status === 'human_handoff' ? "🟡" : "🟢");
      const name = showFull ? (c.customerName || '(無名)') : maskName(c.customerName);
      const score = c.leadScore ?? 0;
      lines.push(`${lock} ${name} | ${last8} | ${score}分`);
    }
    lines.push("", "🔒=AI已鎖 🟡=暫時 handoff 🟢=AI正常", showFull ? "" : "（完整名字：/list full）");
    await reply(lines.join("\n"));
    return;
  }

  if (cmd.kind === 'status') {
    const matches = await findBySuffix(cmd.target);
    if (matches.length === 0) {
      await reply(`找不到對話「${cmd.target ?? ''}」`);
      return;
    }
    if (matches.length > 1) {
      await reply(`「${cmd.target}」對應到多筆，請給更完整的後綴`);
      return;
    }
    const c = matches[0];
    const lock = (c as any).aiDisabled === 1 ? "🔒 AI 已鎖定" : (c.status === 'human_handoff' ? "🟡 暫時 handoff" : "🟢 AI 正常");
    await reply(`${c.customerName || '(無名)'}\n狀態：${lock}\n分數：${c.leadScore ?? 0}\n電話：${c.customerContact || '未提供'}`);
    return;
  }

  if (cmd.kind === 'lock') {
    // SAFETY: refuse to lock the operator's own conversation. This was a real
    // gotcha — Jerry ran `/lock` (no target) while testing, it resolved to
    // "most recent active LINE conversation" which was HIS OWN session, and
    // locked himself out from all AI replies. Now we explicitly filter him out.
    const operatorSessionId = `line-${operatorUserId}`;

    let target;
    let resolvedFromMostRecent = false;
    if (cmd.target) {
      const matches = await findBySuffix(cmd.target);
      if (matches.length === 0) { await reply(`找不到對話「${cmd.target}」`); return; }
      if (matches.length > 1) { await reply(`「${cmd.target}」對應多筆，請給更完整的後綴`); return; }
      target = matches[0];
      if (target.sessionId === operatorSessionId) {
        await reply(`❌ 不能鎖自己的對話！\n你就是操作員 ${operatorUserId.slice(-8)}，鎖自己會害你自己收不到 AI 回覆。\n如果真要鎖某位客人，先用 /list 確認 last8。`);
        return;
      }
    } else {
      const items = (await db.listConversations({ channel: 'line', limit: 10 }))?.items || [];
      // Exclude the operator's own conversation from the candidate list.
      const firstUnlocked = items.find(c =>
        (c as any).aiDisabled !== 1 && c.sessionId !== operatorSessionId
      );
      if (!firstUnlocked) { await reply("找不到可以鎖定的對話（最近 10 筆都已鎖定或都是你自己）"); return; }
      target = firstUnlocked;
      resolvedFromMostRecent = true;
    }

    const last8 = target.sessionId.slice(-8);
    const displayName = target.customerName || `(無名)`;

    // Idempotency: if already locked, just confirm — don't double-write
    if ((target as any).aiDisabled === 1) {
      await reply(`ℹ️ 「${displayName}」(${last8}) 早就鎖定了 — 不用再鎖一次`);
      return;
    }

    await db.updateConversation(target.id, { status: 'human_handoff', aiDisabled: 1 });
    await db.addAnalyticsEvent({
      conversationId: target.id,
      userId: operatorUserId,
      eventCategory: 'operator_takeover',
      eventAction: 'ai_disabled_via_command',
      eventLabel: cmd.target ?? 'most_recent',
      channel: 'line',
    });

    // CRITICAL UX: when /lock has no target, we resolved against "most recent
    // active" — which can race with an inbound message from a different customer.
    // Always show last8 so Megan can `/unlock <last8>` instantly if wrong.
    const undoHint = `\n\n要解除：傳「/unlock ${last8}」`;
    const raceWarning = resolvedFromMostRecent
      ? `\n⚠️ 你沒指定客人，鎖到的是「最近一筆」。如果不是你想鎖的人，馬上用上面的指令解鎖。`
      : '';
    await reply(`✅ 已鎖定 AI：「${displayName}」(${last8})\n從現在起 AI 不會回覆。${raceWarning}${undoHint}`);
    console.log(`[LINE Operator] ${operatorUserId.slice(0,8)}... locked conversation ${target.id} via /lock`);
    return;
  }

  if (cmd.kind === 'unlock') {
    if (!cmd.target) { await reply("用法：/unlock <userId 後 8 碼>"); return; }
    const matches = await findBySuffix(cmd.target);
    if (matches.length === 0) { await reply(`找不到對話「${cmd.target}」`); return; }
    if (matches.length > 1) { await reply(`「${cmd.target}」對應多筆，請給更完整的後綴`); return; }
    const target = matches[0];
    await db.updateConversation(target.id, { status: 'active', aiDisabled: 0 });
    await db.addAnalyticsEvent({
      conversationId: target.id,
      userId: operatorUserId,
      eventCategory: 'operator_takeover',
      eventAction: 'ai_enabled_via_command',
      eventLabel: cmd.target,
      channel: 'line',
    });
    await reply(`🔓 已恢復 AI：「${target.customerName || target.sessionId.slice(-8)}」`);
    console.log(`[LINE Operator] ${operatorUserId.slice(0,8)}... unlocked conversation ${target.id} via /unlock`);
    return;
  }
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

        // Check if this is a RETURNING user (re-follow)
        const sessionId = `line-${userId}`;
        let conversation = await db.getConversationBySessionId(sessionId);
        const isReturning = !!conversation;

        // Operator-takeover lock applies to RETURNING users — if a previous
        // operator session locked this conversation, do NOT auto-greet on re-follow.
        // (New users have no conversation row yet, so the lock can't apply.)
        if (isReturning && conversation && (conversation as any).aiDisabled === 1) {
          console.log(`[LINE] Returning follower ${userId.slice(0, 8)}... is aiDisabled — skipping auto-welcome`);
          return;
        }

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
                { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車" } },
                ...(lastVehicle ? [{ type: "action" as const, action: { type: "message" as const, label: `🚗 再看${lastVehicle.slice(0, 13)}`, text: `我想了解 ${lastVehicle}` } }] : []),
                { type: "action", action: { type: "message", label: "💬 隨便問問", text: "你好，我想了解崑家汽車" } },
              ],
            }},
          ];
          console.log(`[LINE] 🔄 Returning user welcome sent (last vehicle: ${lastVehicle || "none"})`);
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

    // C6: Check if conversation is in human_handoff mode — skip AI image processing
    const imageSessionId = `line-${userId}`;
    const imageConv = await db.getConversationBySessionId(imageSessionId);
    // Operator takeover lock: AI never processes images for aiDisabled conversations
    if (imageConv && (imageConv as any).aiDisabled === 1) {
      console.log(`[LINE Image] Conversation ${imageConv.id} is aiDisabled (operator takeover), skipping`);
      return;
    }
    if (imageConv && imageConv.status === 'human_handoff') {
      // Check timeout same as text messages
      const handoffAge = Date.now() - new Date(imageConv.updatedAt).getTime();
      const HANDOFF_TIMEOUT_MS = 30 * 60 * 1000;
      if (handoffAge <= HANDOFF_TIMEOUT_MS) {
        console.log(`[LINE Image] Conversation ${imageConv.id} is in human_handoff mode, skipping image processing`);
        return;
      }
      // Expired — reactivate and continue processing
      console.log(`[LINE Image] Conversation ${imageConv.id} handoff expired, reactivating AI`);
      await db.updateConversation(imageConv.id, { status: 'active' });
    }

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
        // Build rich description from enhanced recognition
        const extraInfo = [];
        if ((identified as any).year) extraInfo.push(`約${(identified as any).year}`);
        if ((identified as any).color) extraInfo.push(`${(identified as any).color}`);
        const extraStr = extraInfo.length > 0 ? `（${extraInfo.join("・")}）` : "";
        const priceNote = (identified as any).price
          ? `\n你看到的那台售價 ${(identified as any).price}，馬上幫你查詳細資訊 👇`
          : "";

        // ============ IMAGE-PATH GUARDRAIL (Tool Use Safety) ============
        // Gemini Vision extracts text from customer-uploaded images. That text
        // is user-controlled, so we must treat it as untrusted data before
        // interpolating into the reply. Prevents prompt-injection-via-image
        // (e.g. uploaded image containing "保證最低價 100%過件").
        let imageReplyText = `我看到你傳了一張 ${identified.brand} ${identified.model}${extraStr} 的照片！🚗\n我們剛好有 ${matches.length} 台${identified.brand} ${identified.model} 可以看，幫你列出來 👇${priceNote}`;
        {
          // Push BOTH shapes per vehicle so the validator accepts "80.9" and "80.9萬"
          // even when priceDisplay is null (reviewer M1, 2026-04-23).
          const allowedPricesImg: string[] = [];
          for (const v of allVehicles) {
            if ((v as any)?.price != null) {
              allowedPricesImg.push(String((v as any).price));
              allowedPricesImg.push(`${(v as any).price}萬`);
            }
            if ((v as any)?.priceDisplay) allowedPricesImg.push(String((v as any).priceDisplay));
          }
          const imgGuardrail = validateLLMOutput(imageReplyText, { allowedPrices: allowedPricesImg });
          const imgMode = getGuardrailMode();
          if (imgGuardrail.violations.length > 0) {
            console.warn(
              `[LINE Image] 🛡️ Guardrail [${imgMode}] violations: ${imgGuardrail.violations.join(", ")}`
            );
          }
          if (imgMode === "enforce") {
            if (!imgGuardrail.safe) {
              // FALLBACK CONTRACT (image path) — DIFFERENT FROM TEXT PATHS.
              //
              // Text-path fallback (lineWebhook.ts:~1776, routers.ts:~895) calls
              // generateRuleBasedReply because those paths have a full detection
              // context (intent, vehicle, greeting). The image path does NOT —
              // the customer sent a photo, not a question. generateRuleBasedReply
              // would route to a generic greeting that ignores the image context.
              //
              // Instead we use a static safe template that (a) never quotes a
              // price / location / dealership claim (so it can't re-trigger any
              // of the new critical violations) and (b) preserves the "you sent
              // a photo, here are matching cars" framing. The Flex carousel
              // attached after this text shows the real DB-sourced matches via
              // formatPriceForCard (see lineFlexTemplates.ts), so the customer
              // still gets accurate pricing — just not in this header line.
              //
              // Reviewer B2 (2026-04-23): this divergence is intentional; do not
              // "unify" with generateRuleBasedReply without redesigning image intent.
              imageReplyText = `我看到你傳了 ${identified.brand} ${identified.model} 的照片！🚗\n我們剛好有 ${matches.length} 台可以看，幫你列出來 👇`;
            } else {
              imageReplyText = imgGuardrail.sanitized;
            }
          }
        }

        const textMsg = {
          type: "text" as const,
          text: imageReplyText,
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
        // No match in inventory — check if this is a trade-in photo vs. inventory shopping
        const sessionId = `line-${userId}`;
        let conversation = await db.getConversationBySessionId(sessionId);

        // Determine if customer was responding to a trade-in request
        const inTradeInContext = conversation ? await isTradeInContext(conversation.id) : false;

        if (inTradeInContext) {
          // Trade-in photo response: acknowledge receipt and notify operator
          console.log(`[LINE Image] Trade-in photo detected, acknowledging and notifying operator`);

          const tradeInAckText = `收到你的愛車照片了！📸\n\n已轉給${SHOP_CONTACT_PERSON}估價，會盡快回覆你！`;

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
                text: tradeInAckText,
              }],
            }),
          });

          // Notify operator about the trade-in photo
          if (conversation) {
            const ownerUserId = process.env.LINE_OWNER_USER_ID;
            const handoffMessage = `客戶上傳了愛車照片（${identified.brand} ${identified.model}）待估價`;
            await sendHumanHandoffNotification(
              conversation,
              handoffMessage,
              "（收到客戶愛車照片）",
              channelAccessToken,
              ownerUserId
            );
          }
        } else {
          // Inventory shopping: no match found, suggest browsing
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

  // ============ POSTBACK EVENT ============
  if (event.type === "postback") {
    const postbackData = event.postback?.data || "";
    const _userId = event.source?.userId;
    console.log(`[LINE] Postback received: ${postbackData} from user ${_userId ? _userId.slice(0, 8) + "..." : "unknown"}`);
    // Parse postback data and handle known actions
    const params = new URLSearchParams(postbackData);
    const action = params.get("action");
    if (action) {
      console.log(`[LINE] Postback action: ${action}`);
    }

    // ============ OPERATOR TAKEOVER POSTBACK ============
    // Megan/owner taps "🔒 我來接手" on the handoff/lead Flex card → permanently
    // lock AI for that conversation. Source userId must be in the operator
    // whitelist (env: LINE_OPERATOR_USER_IDS / LINE_OWNER_USER_ID / LINE_ADDITIONAL_NOTIFY_USER_IDS).
    if (action === "operator_takeover") {
      const replyToken = event.replyToken;
      const senderId = event.source?.userId;
      const targetConvId = parseInt(params.get("convId") || "0", 10);

      if (!isOperator(senderId)) {
        console.warn(`[LINE] operator_takeover postback rejected: ${senderId?.slice(0,8)}... not in operator whitelist`);
        if (replyToken) {
          try {
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
              body: JSON.stringify({ replyToken, messages: [{ type: "text", text: "❌ 此功能僅限授權業務使用" }] }),
            });
          } catch {}
        }
        return;
      }

      if (!targetConvId) {
        console.warn(`[LINE] operator_takeover postback missing convId`);
        return;
      }

      try {
        const db2 = await db.getDb();
        const { conversations: convTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [targetConv] = db2 ? await db2.select().from(convTable).where(eq(convTable.id, targetConvId)).limit(1) : [];
        if (!targetConv) {
          if (replyToken) {
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
              body: JSON.stringify({ replyToken, messages: [{ type: "text", text: `❌ 找不到對話 #${targetConvId}` }] }),
            });
          }
          return;
        }

        // Idempotency: re-tapping the button on the same flex card shouldn't
        // re-write the row + re-log analytics. Confirm and exit.
        if ((targetConv as any).aiDisabled === 1) {
          if (replyToken) {
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
              body: JSON.stringify({ replyToken, messages: [{ type: "text", text: `ℹ️ 「${targetConv.customerName || `對話 #${targetConvId}`}」早就鎖定了` }] }),
            });
          }
          return;
        }

        await db.updateConversation(targetConvId, { status: 'human_handoff', aiDisabled: 1 });
        await db.addAnalyticsEvent({
          conversationId: targetConvId,
          userId: senderId,
          eventCategory: 'operator_takeover',
          eventAction: 'ai_disabled_via_postback',
          eventLabel: `convId=${targetConvId}`,
          channel: 'line',
        });

        const customerLabel = targetConv.customerName || `對話 #${targetConvId}`;
        const confirmText = `✅ 已接手「${customerLabel}」\n從現在起 AI 不會回覆這位客人，請繼續用 LINE 官方帳號跟客人對話。\n\n要恢復 AI：傳「/unlock ${targetConv.sessionId.slice(-8)}」`;
        if (replyToken) {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
            body: JSON.stringify({ replyToken, messages: [{ type: "text", text: confirmText }] }),
          });
        }
        console.log(`[LINE] ✅ Operator ${senderId?.slice(0,8)}... took over conversation ${targetConvId}`);
      } catch (err) {
        console.error("[LINE] operator_takeover postback failed:", err);
      }
      return;
    }

    if (action === "appointment_datetime") {
      const replyToken = event.replyToken;
      const postbackUserId = event.source?.userId;
      const selectedDatetime: string | undefined = (event.postback as any)?.params?.datetime;

      if (replyToken && selectedDatetime) {
        const [datePart, timePart] = selectedDatetime.split("T");
        const [year, month, day] = datePart.split("-");
        const formattedDatetime = `${year}/${month}/${day} ${timePart}`;
        const vehicleName = params.get("vehicleName") || "";
        const vehicleId = params.get("vehicleId") || "";

        console.log(`[LINE] Appointment datetime selected: ${selectedDatetime} by ${postbackUserId?.slice(0, 8)}...`);

        // Save to conversation. NOTE: the appointment confirmation below is a
        // deterministic booking widget (chosen date/time + a link to the booking
        // form), NOT an AI-generated chat reply — so it is sent even when the
        // conversation is aiDisabled. This is intentional: appointment intent
        // now auto-stops the AI (Jerry 2026-06-29), but the customer must still
        // be able to finish booking. The early aiDisabled gate keeps all LLM
        // free-text replies stopped; only this deterministic step is exempt.
        if (postbackUserId) {
          const postbackSession = `line-${postbackUserId}`;
          const postbackConv = await db.getConversationBySessionId(postbackSession);
          if (postbackConv) {
            await db.addMessage({ conversationId: postbackConv.id, role: "user", content: `[客戶選擇預約時間：${formattedDatetime}]` });
            await db.addMessage({ conversationId: postbackConv.id, role: "assistant", content: `已選擇 ${formattedDatetime}，引導至預約表單` });
          }
        }

        // Build URL to book-visit page with pre-filled date/time
        const baseUrl = process.env.BASE_URL || "https://claude-code-remote-production.up.railway.app";
        const bookParams = new URLSearchParams();
        if (vehicleId) bookParams.set("vehicleId", vehicleId);
        if (vehicleName) bookParams.set("vehicle", vehicleName);
        bookParams.set("date", `${year}-${month}-${day}`);
        bookParams.set("time", timePart);
        const bookUrl = `${baseUrl}/book-visit?${bookParams.toString()}`;

        // Reply with Flex Message containing confirmation + form button
        const flexMsg = {
          type: "flex" as const,
          altText: `預約確認 ${formattedDatetime}`,
          contents: {
            type: "bubble",
            size: "kilo",
            header: {
              type: "box",
              layout: "vertical",
              contents: [{ type: "text", text: "✅ 預約時間已選擇", weight: "bold", size: "lg", color: "#FFFFFF" }],
              backgroundColor: "#27AE60",
              paddingAll: "15px",
            },
            body: {
              type: "box",
              layout: "vertical",
              spacing: "md",
              contents: [
                { type: "text", text: `📅 ${year}/${month}/${day}`, size: "md", weight: "bold" },
                { type: "text", text: `🕐 ${timePart}`, size: "md", weight: "bold" },
                ...(vehicleName ? [{ type: "text", text: `🚗 ${vehicleName}`, size: "sm", color: "#666666" }] : []),
                { type: "separator", margin: "lg" },
                { type: "text", text: "請填寫姓名與電話完成預約", size: "sm", color: "#888888", margin: "md" },
                {
                  type: "button",
                  action: { type: "uri", label: "📋 填寫預約資料", uri: bookUrl },
                  style: "primary",
                  color: "#C4A265",
                  height: "md",
                  margin: "lg",
                },
              ],
            },
            footer: {
              type: "box",
              layout: "vertical",
              contents: [{ type: "text", text: `📍 ${SHOP_ADDRESS}`, size: "xs", color: "#AAAAAA", wrap: true }],
              paddingAll: "10px",
            },
          },
        };

        try {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
            body: JSON.stringify({ replyToken, messages: [flexMsg] }),
          });
        } catch (err) {
          console.error("[LINE] Appointment datetime reply failed:", err);
        }
      }
      return;
    }

    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") {
    const msgType = event.message?.type;
    console.log(`[LINE] Non-text message: ${event.type}, type: ${msgType}`);
    // Respond to non-text messages (sticker, location, video, audio) instead of silently discarding
    // But respect human_handoff — don't reply if human is handling the conversation
    if (event.type === "message" && msgType && ["sticker", "location", "video", "audio", "file"].includes(msgType)) {
      const nonTextUserId = event.source?.userId;
      if (nonTextUserId) {
        const nonTextConv = await db.getConversationBySessionId(`line-${nonTextUserId}`);
        // Operator takeover lock: AI never replies to non-text messages when aiDisabled
        if (nonTextConv && (nonTextConv as any).aiDisabled === 1) {
          console.log(`[LINE] Non-text message from ${nonTextUserId.slice(0,8)}... — aiDisabled (operator takeover), skipping`);
          return;
        }
        if (nonTextConv?.status === 'human_handoff') {
          console.log(`[LINE] Non-text message from ${nonTextUserId.slice(0,8)}... — in human_handoff mode, skipping`);
          return;
        }
      }
      const replyToken = event.replyToken;
      const typeResponses: Record<string, string> = {
        sticker: "收到你的貼圖了！有什麼車的問題想問的嗎？阿家隨時在 😊",
        location: `收到你的位置了！我們崑家汽車在高雄市，地址是${SHOP_ADDRESS}，歡迎來店賞車！`,
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
          console.error("[LINE] Non-text reply failed:", err);
        }
      }
    }
    return;
  }

  const userId = event.source?.userId;
  const userMessage = sanitizeChatMessage(event.message.text);
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

  // ============ UNIVERSAL DIAGNOSTIC: /whoami ============
  // Any LINE user can text "/whoami" (or "!whoami", full-width, Chinese "/我是誰")
  // to see their own LINE userId + whether they're in the operator whitelist.
  // Not gated on isOperator — used specifically to debug "why isn't /help working
  // for me?" cases (owner's userId might not be in LINE_OWNER_USER_ID, etc.).
  // Not a security leak: a LINE user already knows their own userId via the app.
  if (/^[/!／！]\s*(whoami|me|我是誰)\s*$/i.test(userMessage.trim())) {
    const inWhitelist = isOperator(userId);
    const whitelistMsg = inWhitelist
      ? '✅ 你在操作員白名單裡——可以用 /help /lock /list 等指令'
      : '❌ 你不在操作員白名單。請到 Railway → Variables → 把下面這串加到 LINE_OPERATOR_USER_IDS（逗號分隔）';
    const diagText = `🔍 LINE userId 診斷\n\n你的 userId：\n${userId}\n\n狀態：${whitelistMsg}`;
    try {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text: diagText }] }),
      });
      console.log(`[LINE] /whoami replied to ${userId.slice(0,8)}... (operator=${inWhitelist})`);
    } catch (err) {
      console.error('[LINE] /whoami reply failed:', err);
    }
    return;
  }

  // ============ OPERATOR SLASH COMMANDS (sender's own LINE → bot) ============
  // Megan can text the bot from her own LINE: /lock, /unlock <last8>, /list, etc.
  // Recognized BEFORE any customer-flow handling so operator's control commands
  // never get treated as a sales-funnel message. Whitelist via env vars.
  if (isOperator(userId)) {
    const cmd = parseOperatorCommand(userMessage);
    if (cmd) {
      await handleOperatorCommand(cmd, userId, replyToken, channelAccessToken);
      return;
    }
  }

  // Get conversation FIRST so we can short-circuit on operator-takeover lock
  // before showing the typing indicator (a 20s loading animation that would
  // misleadingly suggest a reply is incoming) and before any auto-reply path
  // (8891 short-circuit, rich menu trigger, etc.).
  const sessionId = `line-${userId}`;
  let conversation = await db.getConversationBySessionId(sessionId);

  // ============ EARLY OPERATOR-TAKEOVER LOCK ============
  // If aiDisabled=1, the AI must not produce any free-text / LLM reply for this
  // conversation. BUT the persistent rich-menu browse buttons (看車庫存 / 熱門推薦
  // / 50萬以下 / 阿家客服 / 五大保證) and the 預約賞車 datetimepicker are NOT the
  // AI "answering" — they're deterministic UI widgets the customer taps. Silencing
  // them (the bug this fixes) makes the whole menu look dead the moment a
  // conversation gets locked — which now happens automatically on appointment /
  // critical-question handoffs (PR #102). So we still serve those menu taps while
  // keeping the AI locked (aiDisabled is never flipped back), matching the
  // appointment_datetime postback exemption further down. Only free-text chat is
  // suppressed. We always record the customer's message first for the dashboard.
  if (conversation && (conversation as any).aiDisabled === 1) {
    await db.addMessage({ conversationId: conversation.id, role: "user", content: userMessage });

    // 1) Rich-menu browse buttons → deterministic vehicle carousel / static card.
    const lockedMenuTrigger = detectRichMenuTrigger(userMessage);
    if (lockedMenuTrigger) {
      console.log(`[LINE] Conv ${conversation.id} aiDisabled — serving deterministic rich-menu (${lockedMenuTrigger.type}), AI stays locked`);
      const allVehicles = await db.getAllVehicles();
      const flexMessages = buildRichMenuResponseMessages(lockedMenuTrigger, allVehicles);
      if (flexMessages.length > 0) {
        // Record what the customer was shown so the operator sees it in the dashboard.
        await db.addMessage({ conversationId: conversation.id, role: "assistant", content: getAssistantContentForTrigger(lockedMenuTrigger) });
        try {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
            body: JSON.stringify({ replyToken, messages: flexMessages }),
          });
        } catch (err) { console.error("[LINE] aiDisabled rich-menu reply failed:", err); }
      }
      return;
    }

    // 2) 預約賞車 button (exact text) → re-send the datetimepicker so booking stays
    //    possible during a takeover. Exact-match (not the broad appointment intent
    //    regex) so the bot never injects a picker into an operator's live free-text
    //    conversation. No re-notify / re-lock — already locked.
    if (userMessage.trim() === "我想預約看車") {
      console.log(`[LINE] Conv ${conversation.id} aiDisabled — serving appointment datetimepicker, AI stays locked`);
      await db.addMessage({ conversationId: conversation.id, role: "assistant", content: "預約看車 — 已發送日期選擇器（AI 已鎖定，真人接手中）" });
      try {
        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
          body: JSON.stringify({ replyToken, messages: [buildAppointmentDatetimePicker()] }),
        });
      } catch (err) { console.error("[LINE] aiDisabled appointment reply failed:", err); }
      return;
    }

    // 3) FAQ chips → deterministic FAQ answer cards (same pattern as rich-menu)
    const faqItem = detectFaqTrigger(userMessage);
    if (faqItem) {
      console.log(`[LINE] Conv ${conversation.id} aiDisabled — serving deterministic FAQ answer, AI stays locked`);
      const faqMessages = buildFaqAnswerMessages(faqItem);
      if (faqMessages.length > 0) {
        await db.addMessage({ conversationId: conversation.id, role: "assistant", content: getAssistantContentForTrigger({ type: "faq_chip", label: "FAQ" }) });
        try {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
            body: JSON.stringify({ replyToken, messages: faqMessages }),
          });
        } catch (err) { console.error("[LINE] aiDisabled FAQ reply failed:", err); }
      }
      return;
    }

    // 4) Photo/image uploads → deterministic photo carousel (same pattern as rich-menu)
    const photoExternalId = detectPhotoTrigger(userMessage);
    if (photoExternalId) {
      console.log(`[LINE] Conv ${conversation.id} aiDisabled — serving deterministic photo carousel, AI stays locked`);
      const allVehicles = await db.getAllVehicles();
      const vehicle = allVehicles.find((v: any) => v.externalId === photoExternalId);
      if (vehicle) {
        const photoMessages = buildPhotoCarousel(vehicle);
        if (photoMessages.length > 0) {
          await db.addMessage({ conversationId: conversation.id, role: "assistant", content: getAssistantContentForTrigger({ type: "photo_browse", label: "照片瀏覽" }) });
          try {
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
              body: JSON.stringify({ replyToken, messages: photoMessages }),
            });
          } catch (err) { console.error("[LINE] aiDisabled photo reply failed:", err); }
        }
      }
      return;
    }

    // 5) Anything else (free-text) → stay silent; the operator handles it.
    console.log(`[LINE] Conversation ${conversation.id} is aiDisabled (operator takeover), skipping LLM handling`);
    return;
  }

  // Show typing indicator immediately while processing (only after lock check)
  showTypingIndicator(userId, channelAccessToken);

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

  // ============ 8891 SOURCE TRACKING ============
  // When customer sends "8891", tag them as coming from 8891 and reply with special offer
  if (/^8891$/.test(userMessage.trim())) {
    console.log(`[LINE] 🏷️ Customer from 8891 detected! Conv: ${convId}`);
    // Tag conversation with 8891 source
    const existingTags = (conversation as any)?.tags || '';
    if (!existingTags.includes('8891')) {
      const newTags = existingTags ? `${existingTags},source:8891` : 'source:8891';
      await db.updateConversation(convId, { tags: newTags });
    }
    // Record as analytics event
    db.addAnalyticsEvent({
      conversationId: convId,
      userId,
      eventCategory: "source_tracking",
      eventAction: "8891_referral",
      channel: "line",
    });
    // Record as lead event for scoring
    await db.addLeadEvent({
      conversationId: convId,
      eventType: "purchase_intent",
      scoreChange: 15,
      reason: "8891 referral — high intent customer",
    });
    // Save messages
    await db.addMessage({ conversationId: convId, role: "user", content: userMessage });
    const greeting = getNameGreeting(customerName, customerGender);
    const offerReply = `${greeting}你好！歡迎從8891過來 🎉 你說出通關密語了！到店賞車時跟賴先生說「8891來的」就有專屬優惠喔 💪 請問你對哪台車有興趣呢？還是想看看我們目前的庫存？`;
    await db.addMessage({ conversationId: convId, role: "assistant", content: offerReply });
    // Reply via LINE
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
      body: JSON.stringify({
        replyToken,
        messages: [{
          type: "text",
          text: offerReply,
          quickReply: {
            items: [
              { type: "action", action: { type: "message", label: "🚗 看車庫存", text: "我想看車，有什麼車可以推薦？" } },
              { type: "action", action: { type: "message", label: "💰 50萬以下", text: "50萬以下有什麼好車？" } },
              { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車" } },
            ],
          },
        }],
      }),
    });
    // Notify owner about 8891 referral
    if (ownerUserId) {
      try {
        await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
          body: JSON.stringify({
            to: ownerUserId,
            messages: [{ type: "text", text: `🏷️ 8891客人來了！\n客人：${customerName || '未知'}\n已標記 source:8891，已發送專屬優惠訊息` }],
          }),
        });
      } catch {}
    }
    return;
  }

  // (operator-takeover lock is checked earlier, before typing indicator — see above)

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
        console.log(`[LINE] Conversation ${convId} handoff expired after 30min, reactivating AI`);
      } else {
        console.log(`[LINE] Conversation ${convId} was in human_handoff but user started new interaction, reactivating AI`);
      }
      await db.updateConversation(convId, { status: 'active' });
    } else {
      console.log(`[LINE] Conversation ${convId} is in human_handoff mode, AI skipping`);
      await db.addMessage({ conversationId: convId, role: "user", content: userMessage });
      return;
    }
  }

  // ============ HUMAN HANDOFF TRIGGER: User requests real human ============
  const humanHandoffPattern = /想跟真人|想和真人|找真人|要真人|真人客服|人工客服|轉真人|不想跟機器人|找人處理|我想跟真人業務聊聊這台車/;
  if (humanHandoffPattern.test(userMessage)) {
    console.log(`[LINE] 🚨 User requested human handoff: ${userId.slice(0, 8)}...`);
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
      : `目前業務不在線上，你可以直接撥打 ${SHOP_PHONE} 找${SHOP_CONTACT_PERSON}`;
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
      console.error("[LINE] Human handoff reply failed:", err);
    }
    // Update conversation status + permanently lock out AI
    // (customer explicitly asked for a real human; AI must stop until admin unlocks)
    await db.updateConversation(convId, { status: 'human_handoff', aiDisabled: 1 });
    return;
  }

  // Save user message FIRST
  const savedMsg = await db.addMessage({
    conversationId: convId,
    role: "user",
    content: userMessage,
  });
  console.log(`[LINE] Saved user message: id=${savedMsg.id}, convId=${convId}`);

  // Track conversation for short-term recovery nudges
  updateConversationTracker(userId, userMessage);

  // ============ FRUSTRATION DETECTION ============
  const frustration = detectFrustration(userMessage, userId);
  if (frustration.frustrated) {
    console.log(`[LINE] Frustration detected (confidence: ${frustration.confidence.toFixed(2)}) from ${userId.slice(0, 8)}...`);
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

  // ============ EXTRACT AND STORE CUSTOMER PREFERENCES ============
  // Parse budget, brand, body type, visit time from this message
  // Only store if NOT already stored (don't overwrite earlier explicit mentions)
  const prefs = extractCustomerPreferences(userMessage);
  const prefsToUpdate: Record<string, any> = {};

  if (prefs.budget && !conversation!.budget) {
    prefsToUpdate.budget = prefs.budget;
    console.log(`[LINE] Budget extracted: ${prefs.budget / 100000}萬`);
  }
  if (prefs.budgetRange && !conversation!.budgetRange) {
    prefsToUpdate.budgetRange = prefs.budgetRange;
    console.log(`[LINE] Budget range extracted: ${prefs.budgetRange}萬`);
  }
  if (prefs.preferredBrand && !conversation!.preferredBrand) {
    prefsToUpdate.preferredBrand = prefs.preferredBrand;
    console.log(`[LINE] Preferred brands extracted: ${prefs.preferredBrand}`);
  }
  if (prefs.preferredBodyType && !conversation!.preferredBodyType) {
    prefsToUpdate.preferredBodyType = prefs.preferredBodyType;
    console.log(`[LINE] Preferred body type extracted: ${prefs.preferredBodyType}`);
  }
  if (prefs.preferredVisitTime && !conversation!.preferredVisitTime) {
    prefsToUpdate.preferredVisitTime = prefs.preferredVisitTime;
    console.log(`[LINE] Preferred visit time extracted: ${prefs.preferredVisitTime}`);
  }

  if (Object.keys(prefsToUpdate).length > 0) {
    await db.updateConversation(convId, prefsToUpdate);
    conversation = { ...conversation!, ...prefsToUpdate };
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

  // Fetch conversation history and vehicle inventory concurrently — both are independent DB reads
  const [allHistory, allVehicles] = await Promise.all([
    db.getMessagesByConversation(convId, 100),
    db.getAllVehicles(),
  ]);
  const history = allHistory.slice(-10);
  console.log(`[LINE] History: total=${allHistory.length}, using last ${history.length} messages`);

  // ============ NEW-CUSTOMER NOTIFICATION (operator can take over from message #1) ============
  // Push a notification card with the "🔒 我來接手 (停止 AI)" button to all operators
  // when a customer sends their FIRST message. Megan can decide to take over before
  // the AI even replies — without waiting for lead score milestones.
  // Fires once per conversation: gated on history.length === 1 (only the just-saved
  // user message exists; no assistant response yet).
  if (allHistory.length === 1) {
    sendNewCustomerNotification(conversation!, userMessage, channelAccessToken, ownerUserId)
      .catch(err => console.error('[LINE] new-customer notification failed:', err));
  }

  const vIndex = buildVehicleIndex(allVehicles);

  // ============ VEHICLE DETECTION v5: Context-aware detection ============
  // Pass conversation history so follow-up questions can resolve to previously discussed vehicles
  const historyForDetection = history.map(m => ({ role: m.role, content: m.content }));
  const detection = detectVehicleFromMessage(userMessage, allVehicles, historyForDetection, vIndex);
  console.log(`[VehicleDetection] type=${detection.type}, vehicle=${detection.vehicle?.brand || 'none'} ${detection.vehicle?.model || ''}, question=${detection.questionType}, answer=${detection.directAnswer}`);

  // ============ INTENT DETECTION v7: Detect customer intents and inject focused instructions ============
  const customerIntents = detectCustomerIntents(userMessage);
  console.log(`[IntentDetection] intents=${customerIntents.join(', ') || 'none'}`);

  const greeting = getNameGreeting(customerName, customerGender);

  let replyText: string;
  let isHumanHandoff = false;

  // ============ FLEXIBLE TIME → SILENT HANDOFF (AI 完全不回覆) ============
  // Customer says "時間彈性" or "幫我安排" → AI 靜默，真人業務直接接手
  if (/時間彈性|你們幫我安排|幫我安排就好|幫我安排時間|都可以.*安排|你安排/.test(userMessage)) {
    console.log('[LINE] 🚨 Flexible time detected — silent handoff, AI does NOT reply');
    await db.addMessage({ conversationId: convId, role: "user", content: userMessage });
    await sendHumanHandoffNotification(conversation!, userMessage, '（AI 未回覆，靜默轉交真人）', channelAccessToken, ownerUserId);
    // Permanently lock AI out — staff is taking over
    await db.updateConversation(convId, { status: 'human_handoff', aiDisabled: 1 });
    return;
  }

  // ============ VEHICLE SPEC QUERY → DIRECT RESPONSE (skip LLM) ============
  // When customer clicks "了解車子細節/規格", respond directly from DB — don't trust LLM to copy
  if (detection.vehicle && /詳細規格|規格|細節|配備|詳細|了解.*規格/.test(userMessage)) {
    const v = detection.vehicle as any;
    const specLines: string[] = [`${v.brand} ${v.model}`, '', `售價：${v.priceDisplay || v.price + '萬'}`];
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
    specLines.push('', '想進一步了解或預約看車，隨時跟我說！');

    replyText = specLines.join('\n');
    console.log(`[LINE] Vehicle spec direct response for ${v.brand} ${v.model}`);

    await db.addMessage({ conversationId: convId, role: "assistant", content: replyText });
    const quickReplyCtx: ConversationContext = {
      hasVehicle: true, hasAppointment: false, hasContact: !!conversation!.customerContact,
      vehicleName: `${v.brand} ${v.model}`, messageCount: 0, leadScore: conversation!.leadScore || 0,
    };
    const quickReply = buildContextualQuickReply(quickReplyCtx);
    try {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text: replyText, quickReply }] }),
      });
    } catch (err) { console.error("[LINE] Reply failed:", err); }
    return;
  }

  // ============ TRADE-IN / OLD-CAR ESTIMATION → DIRECT RESPONSE (skip LLM) ============
  // Triggered by the "🔄 舊車想換這台" quick-reply chip and any free-form trade-in
  // question. Template written by Jerry (2026-04-16) — estimation requires seeing
  // the actual car, but we request specific photos/info upfront to move the lead
  // forward. Uses ${greeting} so the customer's own LINE display name is used,
  // not any static placeholder.
  const tradeInPattern = /我有一台舊車|舊車想換|舊車.*換新|換車.*估|估價.*舊車|舊車.*估價|折讓|我的車.*換|目前開.*換|現在開.*換|想換車|以舊換新/;
  if (tradeInPattern.test(userMessage)) {
    console.log('[LINE] Trade-in estimation detected — sending standard template');
    const tradeInReply = `🤍 ${greeting} 您好，謝謝您的訊息！

我們這邊估車仍會以實際看到車況為主喔！如果您目前不方便前來，也可以先提供以下資訊給我：

品牌／年份／里程數
車身外觀與內裝的詳細照片
保養紀錄
以及最重要的，請告知是否曾發生事故，或是否有更換過鈑件、零件的情況

不好意思需要先了解得比較仔細，這也是為了保障雙方權益。我們一直都是以「誠信」為原則在做每一筆生意，也希望讓您更安心。`;

    await db.addMessage({ conversationId: convId, role: "assistant", content: tradeInReply });
    try {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({
          replyToken,
          messages: [{ type: "text", text: tradeInReply }],
        }),
      });
    } catch (err) { console.error("[LINE] Trade-in reply failed:", err); }
    return;
  }

  // ============ APPOINTMENT → DIRECT RESPONSE (skip LLM) ============
  if (customerIntents.includes('appointment')) {
    const vehicleName = detection.vehicle ? `${(detection.vehicle as any).brand} ${(detection.vehicle as any).model}` : '';
    const vehicleId = (detection.vehicle as any)?.id ? String((detection.vehicle as any).id) : '';
    const headerText = vehicleName ? `預約看車（${vehicleName}）` : '預約看車';

    const flexMessage = buildAppointmentDatetimePicker({ vehicleName, vehicleId });

    const appointmentLogText = `預約看車${vehicleName ? `（${vehicleName}）` : ''} — 已發送日期選擇器`;
    console.log(`[LINE] Appointment flex message response`);
    await db.addMessage({ conversationId: convId, role: "assistant", content: appointmentLogText });
    try {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({ replyToken, messages: [flexMessage] }),
      });
    } catch (err) { console.error("[LINE] Reply failed:", err); }

    // ============ APPOINTMENT → NOTIFY OPERATOR + STOP AI ============
    // Jerry (2026-06-29): when the booking form pops up, alert the operator and
    // hand the customer over so a real person discusses their needs. The
    // datetimepicker → confirmation → booking-form flow is deterministic (not the
    // LLM), so it still completes — the appointment_datetime postback handler is
    // exempt from the aiDisabled gate. Only the free-text AI chat is stopped.
    await sendHumanHandoffNotification(
      conversation!,
      `${headerText}（客人想預約看車，AI 已暫停等待真人介入）`,
      "（AI 已發送日期選擇器，改由真人接手需求討論）",
      channelAccessToken,
      ownerUserId,
    );
    await db.addAnalyticsEvent({
      conversationId: convId,
      userId,
      eventCategory: 'operator_takeover',
      eventAction: 'ai_auto_stopped_appointment',
      eventLabel: vehicleName || 'no-vehicle',
      channel: 'line',
    });
    await db.updateConversation(convId, { status: 'human_handoff', aiDisabled: 1 });
    return;
  }

  // ============ CRITICAL HIGH-INTENT QUESTION → STOP AI + NOTIFY OPERATOR ============
  // Jerry (2026-06-29): serious buyers skip the rich menu and ask the make-or-break
  // questions directly (價格 / 殺價 / 車況 / 還在不在). A wrong AI answer to one of these
  // loses the sale, so per his decision these specific questions auto-stop the AI and
  // hand off to a real person — with an immediate operator alert (red-dot card + 接手
  // button). Everything else (general chat, loan, specs) stays on the AI.
  // Placed AFTER the spec/trade-in/appointment direct-response blocks so those
  // accurate, deterministic flows are untouched.
  const criticalHandoff = detectCriticalHandoff({
    message: userMessage,
    intents: customerIntents,
    hasVehicle: !!detection.vehicle,
  });
  if (criticalHandoff.triggered) {
    console.log(`[LINE] 🛑 Critical high-intent question (${criticalHandoff.reason}) — stopping AI, notifying operator`);
    const notificationSent = await sendHumanHandoffNotification(
      conversation!,
      `${userMessage}\n（高意願訊號：${criticalHandoff.reason}，AI 已暫停等待真人）`,
      "（AI 未回覆，改由真人接手）",
      channelAccessToken,
      ownerUserId,
    );
    const ackReply = notificationSent
      ? "這部分我請我們專人幫您確認，馬上回覆您 🙏"
      : `這部分我幫您請專人確認，您也可以直接撥打 ${SHOP_PHONE} 找${SHOP_CONTACT_PERSON}，會更快喔！`;
    await db.addMessage({ conversationId: convId, role: "assistant", content: ackReply });
    try {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text: ackReply }] }),
      });
    } catch (err) { console.error("[LINE] Critical handoff reply failed:", err); }
    await db.addAnalyticsEvent({
      conversationId: convId,
      userId,
      eventCategory: 'operator_takeover',
      eventAction: 'ai_auto_stopped_critical_question',
      eventLabel: criticalHandoff.reason || 'unknown',
      channel: 'line',
    });
    await db.updateConversation(convId, { status: 'human_handoff', aiDisabled: 1 });
    return;
  }

  // ============ SIMPLE FACTUAL QUESTION SHORTCUT (ZERO GEMINI) ============
  // Questions like "里程多少", "什麼顏色", "幾年的", "變速箱" already have deterministic
  // answers from vehicleDetectionService.ts getQuestionAnswer(). Skip Gemini entirely.
  // Conditions: vehicle detected + direct answer available + single short question + no critical intents
  // Response time: <500ms (no LLM), zero hallucination risk.
  const isSingleShortQuestion =
    detection.vehicle &&
    detection.directAnswer &&
    !criticalHandoff.triggered &&
    customerIntents.length <= 1 &&
    userMessage.length < 15;

  if (isSingleShortQuestion) {
    console.log(`[LINE] Simple factual Q shortcut (${detection.questionType}): "${userMessage}"`);
    replyText = buildVehicleAnswerReply(detection, greeting);

    // Log the direct answer to transcript
    await db.addMessage({ conversationId: convId, role: "assistant", content: replyText });

    // Quick reply chips for next steps
    const quickReplyCtx: ConversationContext = {
      hasVehicle: true,
      hasAppointment: false,
      hasContact: !!conversation!.customerContact,
      vehicleName: `${(detection.vehicle as any).brand} ${(detection.vehicle as any).model}`,
      messageCount: history.length,
      leadScore: conversation!.leadScore || 0,
    };
    const quickReply = buildContextualQuickReply(quickReplyCtx);

    console.log(`[LINE] Fast reply sent (${replyText.length}B, <500ms)`);
    try {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text: replyText, quickReply }] }),
      });
    } catch (err) { console.error("[LINE] Fast reply failed:", err); }
    return;
  }

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
      customerBudget: (conversation as any).budget ?? undefined,
      customerBudgetRange: (conversation as any).budgetRange ?? undefined,
      customerPreferredBrand: (conversation as any).preferredBrand ?? undefined,
      customerPreferredBodyType: (conversation as any).preferredBodyType ?? undefined,
      customerPreferredVisitTime: (conversation as any).preferredVisitTime ?? undefined,
    });
    console.log("[LINE] Rule-based response:", replyText.substring(0, 100));
  } else {
    console.log("[LINE] LLM mode, calling Claude API...");

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
      // Hard inventory list: brand + model only, used by the "庫存鎖" prompt section
      // to prevent the LLM from inventing cars (RAV4, CR-V, Kicks etc. were leaking through).
      inventoryList: allVehicles.map(v => `${v.brand} ${v.model}`),
      // Customer preferences extracted from conversation history (prevent re-asking)
      customerBudget: (conversation as any).budget ?? undefined,
      customerBudgetRange: (conversation as any).budgetRange ?? undefined,
      customerPreferredBrand: (conversation as any).preferredBrand ?? undefined,
      customerPreferredBodyType: (conversation as any).preferredBodyType ?? undefined,
      customerPreferredVisitTime: (conversation as any).preferredVisitTime ?? undefined,
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
          customerBudget: (conversation as any).budget ?? undefined,
          customerBudgetRange: (conversation as any).budgetRange ?? undefined,
          customerPreferredBrand: (conversation as any).preferredBrand ?? undefined,
          customerPreferredBodyType: (conversation as any).preferredBodyType ?? undefined,
          customerPreferredVisitTime: (conversation as any).preferredVisitTime ?? undefined,
        });
      }

      // ============ LLM OUTPUT GUARDRAIL (OWASP LLM02) ============
      // Validate the LLM reply against legal/compliance rules before sending.
      // - Blocks 廣告法 unsafe promises (保證最低價, 100% 過件)
      // - Strips PDPA PII echoes (phones, emails, LINE IDs)
      // - Strips OWASP LLM02 prompt/system leakage
      // - Flags price quotes not matching real inventory (消保法)
      //
      // Rollout controlled by LLM_GUARDRAIL_MODE env var:
      //   enforce (default)  — rewrite unsafe text; fall back on critical violations
      //   log_only           — record violations only (debug/canary mode)
      // Fail-secure: unknown values are treated as "enforce".
      // Push BOTH shapes per vehicle so the validator accepts "80.9" and "80.9萬"
      // even when priceDisplay is null (reviewer M1, 2026-04-23).
      const allowedPrices: string[] = [];
      for (const v of allVehicles) {
        if (v?.price != null) {
          allowedPrices.push(String(v.price));
          allowedPrices.push(`${v.price}萬`);
        }
        if (v?.priceDisplay) allowedPrices.push(String(v.priceDisplay));
      }
      // Pass inventory so guardrail can BLOCK hallucinated vehicle names
      // (RAV4, CR-V, Kicks etc. that the LLM might invent under ambiguity).
      const inventory = allVehicles.map(v => `${v.brand} ${v.model}`);
      const guardrail = validateLLMOutput(replyText, { allowedPrices, inventory });
      const guardrailMode = getGuardrailMode();
      if (guardrail.violations.length > 0) {
        console.warn(
          `[LINE] 🛡️ Guardrail [${guardrailMode}] violations: ${guardrail.violations.join(", ")}`
        );
      }
      if (guardrailMode === "enforce") {
        if (!guardrail.safe) {
          // Critical violation (unsafe promise / system leak) — fall back
          console.warn("[LINE] 🛡️ Guardrail enforced fallback to rule-based reply");
          replyText = generateRuleBasedReply({
            userMessage,
            greeting,
            detection,
            intents: customerIntents,
            customerContact: conversation!.customerContact,
            leadScore: conversation!.leadScore ?? undefined,
            customerBudget: (conversation as any).budget ?? undefined,
            customerBudgetRange: (conversation as any).budgetRange ?? undefined,
            customerPreferredBrand: (conversation as any).preferredBrand ?? undefined,
            customerPreferredBodyType: (conversation as any).preferredBodyType ?? undefined,
            customerPreferredVisitTime: (conversation as any).preferredVisitTime ?? undefined,
          });
        } else {
          // Non-critical (PII echo, suspicious price) — use sanitized version
          replyText = guardrail.sanitized;
        }
      }
      // log_only mode: keep original replyText, only logged the violations above

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
        customerBudget: (conversation as any).budget ?? undefined,
        customerBudgetRange: (conversation as any).budgetRange ?? undefined,
        customerPreferredBrand: (conversation as any).preferredBrand ?? undefined,
        customerPreferredBodyType: (conversation as any).preferredBodyType ?? undefined,
        customerPreferredVisitTime: (conversation as any).preferredVisitTime ?? undefined,
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

  // ============ FRUSTRATION-TRIGGERED EMPATHETIC RESPONSE ============
  if (frustration.frustrated && !isHumanHandoff) {
    isHumanHandoff = true;
    replyText = '不好意思讓你不方便了！我馬上幫你轉給阿家本人處理 🙏\n\n真人客服馬上就到，請稍等一下！';
    console.log('[LINE] 😤 FRUSTRATION HANDOFF triggered (confidence: ' + frustration.confidence.toFixed(2) + ')');
  }

  // Save assistant response
  await db.addMessage({
    conversationId: convId,
    role: "assistant",
    content: replyText,
  });

  // Build contextual quick reply based on conversation state (personalized)
  // Extract previously discussed vehicles from conversation history
  // Reuse the already-fetched allHistory (avoids a redundant DB round-trip after the reply)
  const allMessages = allHistory.slice(-30);
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

  // ============ VIDEO SHOWCASE: Send after engaged inquiry ============
  // Trigger conditions: interested lead (25+) + specific vehicle detected + not already sent
  const currentLeadScore = conversation!.leadScore || 0;
  if (
    currentLeadScore >= 25 &&
    detection.vehicle &&
    detection.type !== "none"
  ) {
    // Check if we already sent a video card for this vehicle (avoid spam)
    const videoKey = `video_sent_${detection.vehicle.id}`;
    const allHistoryTexts = allHistory.map((m) => m.content).join(" ");
    const alreadySentVideo = allHistoryTexts.includes(`[🎬 已發送 ${detection.vehicle.brand} ${detection.vehicle.model} 精選影片]`);

    if (!alreadySentVideo) {
      console.log(`[LINE] 🎬 Sending video showcase for ${detection.vehicle.brand} ${detection.vehicle.model} (lead score: ${currentLeadScore})`);
      const videoCard = buildVideoShowcaseCard(detection.vehicle);

      // Save to conversation history
      await db.addMessage({
        conversationId: convId,
        role: "assistant",
        content: `[🎬 已發送 ${detection.vehicle.brand} ${detection.vehicle.model} 精選影片]`,
      });

      // Push (not reply — reply token already consumed)
      try {
        await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify({
            to: userId,
            messages: [videoCard],
          }),
        });
        console.log(`[LINE] 🎬 Video showcase pushed successfully.`);
        db.addAnalyticsEvent({ conversationId: convId, userId, eventCategory: "video_showcase", eventAction: `影片推送 ${detection.vehicle.brand} ${detection.vehicle.model}`, channel: "line" });
      } catch (err) {
        console.error("[LINE] Video showcase push failed:", err);
      }
    }
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
      const fallbackText = `目前業務不在線上，你可以直接撥打 ${SHOP_PHONE} 找${SHOP_CONTACT_PERSON}`;
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
        console.error("[LINE] Handoff fallback push failed:", err);
      }
    }
    // Mark conversation so AI stops responding until staff resolves it
    // aiDisabled=1 guarantees permanent lock — admin must explicitly re-enable
    await db.updateConversation(convId, { status: 'human_handoff', aiDisabled: 1 });
  }

  // Notify owner for hot leads
  const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
  await checkAndNotifyOwner(conversation!, userMessage, channelAccessToken, ownerUserId, phoneJustFound);
}

export { lineRouter };
