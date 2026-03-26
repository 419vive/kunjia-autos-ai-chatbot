import { COOKIE_NAME } from "@shared/const";
import { logger } from "./logger";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";
import { detectPhoneNumber } from "./lineWebhook";
import { formatTimeSlotsForPrompt } from "./timeSlotHelper";
import { nanoid } from "nanoid";
import { sync8891, getSyncStatus } from "./sync8891";
import { deployRichMenu, getRichMenuStatus, cancelDefaultRichMenu } from "./lineRichMenu";
import { sanitizeChatMessage, sanitizeSearchQuery, maskPhone, maskName, maskPIIInText, logSecurityEvent, getSecurityEvents } from "./security";
import { detectVehicleFromMessage, buildSmartVehicleKB, buildTargetVehiclePrompt, detectCustomerIntents, buildIntentInstructions, buildVehicleIndex } from "./vehicleDetectionService";
import { isRuleBasedMode, generateRuleBasedReply } from "./ruleBasedReply";

// ============ VEHICLE KNOWLEDGE BASE FOR LLM ============

async function buildVehicleKnowledgeBase() {
  const allVehicles = await db.getAllVehicles();
  if (!allVehicles.length) return "目前沒有在售車輛。";
  
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
      v.guarantees ? `保證：${v.guarantees}` : '',
      v.description ? `描述：${v.description}` : '',
      `車輛ID：${v.id}`,
    ].filter(Boolean);
    return parts.join('\n');
  }).join('\n\n---\n\n');
}

// ============ LEAD SCORING LOGIC ============

// ===== 8-Dimension Lead Scoring Model =====
// Based on BANT + SPIN Selling + Sandler Pain Funnel + world-class sales masters
const LEAD_SCORE_RULES = [
  // Dimension 1: Budget Confirmation (BANT Framework - IBM)
  // 客戶提到預算、問價格、問分期貸款 = 有真實購買力
  { pattern: /預算|budget|多少錢|價格|價位|報價|優惠|折扣|議價|便宜|殺價|算便宜|打折|頭期|月付|零利率/i, score: 15, event: "budget_inquiry", reason: "💰 預算確認 (BANT)：詢問價格或付款方式" },

  // Dimension 2: Purchase Intent (Sandler Pain Funnel)
  // 客戶直接表達購買意向 = 最高分，已進入決策階段
  { pattern: /想買|要買|購買|下訂|訂車|成交|簽約|付款|頭期款|貸款|分期|刷卡|匯款|訂金|定金/i, score: 25, event: "purchase_intent", reason: "🔥 購買意向 (Sandler)：表達明確購買決心" },

  // Dimension 3: Visit Intent (Neil Rackham SPIN Selling - Commitment Stage)
  // 客戶想看車/試駕 = 從需求階段進入承諾階段
  { pattern: /看車|試駕|試乘|賞車|到店|什麼時候可以|預約|過去看|去你們那|地址在哪|怎麼走|營業時間/i, score: 20, event: "visit_intent", reason: "🚗 看車意願 (SPIN)：想預約看車或試駕" },

  // Dimension 4: Contact Request (Joe Girard 250 Law)
  // 客戶主動索取聯繫方式 = 高度信任信號
  { pattern: /電話|手機|聯絡|line|加line|聯繫方式|怎麼聯繫|打給你|你的號碼|微信|whatsapp/i, score: 20, event: "contact_request", reason: "📱 索取聯繫 (Girard 250法則)：主動要聯繫方式" },

  // Dimension 5: Trade-in / Existing Vehicle (Grant Cardone)
  // 有舊車想換 = 真實需求，不是隨便問問
  { pattern: /換車|舊車|trade.?in|估價|折讓|我的車|目前開|現在開|賣掉|脫手|二手|中古/i, score: 15, event: "trade_in", reason: "🔄 舊車換新 (Cardone)：有舊車代表真實需求" },

  // Dimension 6: Urgency / Timeline (Chris Voss Tactical Empathy)
  // 有時間壓力 = 真實買家，不是window shopping
  { pattern: /最近|這週|這個月|趕快|急|盡快|馬上|立刻|年底前|過年前|什麼時候能交車|交車時間|多久可以|快點/i, score: 15, event: "urgency", reason: "⏰ 時間急迫 (Voss)：有明確購買時間壓力" },

  // Dimension 7: Specific Vehicle Inquiry (Tim Kintz Golden Rules)
  // 問特定車型的詳細規格 = 認真研究過的買家
  { pattern: /BMW|Toyota|Honda|Ford|Kia|Hyundai|Suzuki|Mitsubishi|Volkswagen|VW|Tiguan|CR-?V|Corolla|Vios|Stonic|Tucson|Carens|Colt|Vitara|Tourneo|X1|cc數|排氣量|馬力|油耗|安全配備|幾人座|行李箱|後座空間/i, score: 10, event: "specific_vehicle", reason: "🔍 指定車款 (Kintz)：詢問特定車型詳細規格" },

  // Dimension 8: Life Event / Family Need (Zig Ziglar Relationship Selling)
  // 人生事件驅動購買 = 有剛性需求，成交率最高
  { pattern: /結婚|小孩|baby|寶寶|家人|老婆|老公|太太|先生|爸媽|父母|上班|通勤|搬家|退休|接送|安全座椅|全家|一家人|載小孩|載貨|工作需要/i, score: 10, event: "life_event", reason: "👨‍👩‍👧‍👦 人生事件 (Ziglar)：家庭或生活需求驅動購買" },

  // Dimension 9: Specific Budget Amount
  // 提到具體金額代表認真考慮購買
  { pattern: /\d{2,3}萬|\d{2,3}万|\d{2,3}w|預算\s*\d|budget\s*\d/i, score: 15, event: "specific_budget", reason: "💵 具體預算：提到明確金額，購買意願高" },
];

async function scoreMessage(conversationId: number, message: string): Promise<{ totalDelta: number; events: Array<{ type: string; score: number; reason: string }> }> {
  const events: Array<{ type: string; score: number; reason: string }> = [];
  let totalDelta = 0;
  
  for (const rule of LEAD_SCORE_RULES) {
    if (rule.pattern.test(message)) {
      events.push({ type: rule.event, score: rule.score, reason: rule.reason });
      totalDelta += rule.score;
      await db.addLeadEvent({
        conversationId,
        eventType: rule.event,
        scoreChange: rule.score,
        reason: rule.reason,
      });
    }
  }
  
  return { totalDelta, events };
}

const QUALITY_LEAD_THRESHOLD = 50;

// Milestone-based notification: notify at score 50, 80, 120, 180
const WEB_NOTIFICATION_MILESTONES = [50, 80, 120, 180];

function getWebMilestoneLevel(score: number): number {
  let level = 0;
  for (const m of WEB_NOTIFICATION_MILESTONES) {
    if (score >= m) level++;
  }
  return level;
}

// Dedup: prevent duplicate notifications for the same conversation within 10 minutes
const notifyCooldownMap = new Map<string, number>();
const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

async function checkAndNotifyOwner(conversationId: number, conversation: any, phoneJustDetected?: boolean) {
  const score = conversation.leadScore || 0;
  const currentNotifiedLevel = conversation.notifiedOwner || 0;
  const newMilestoneLevel = getWebMilestoneLevel(score);

  // Determine if we should notify:
  // 1. New milestone reached (score crossed a threshold)
  // 2. Phone number just detected (always notify immediately)
  const shouldNotifyMilestone = newMilestoneLevel > currentNotifiedLevel && score >= QUALITY_LEAD_THRESHOLD;
  const shouldNotifyPhone = phoneJustDetected && score >= 40;

  if (!shouldNotifyMilestone && !shouldNotifyPhone) return;

  // Dedup: skip if same conversation+level was notified recently
  const dedupKey = `web:${conversationId}:${newMilestoneLevel}:${phoneJustDetected ? "phone" : "score"}`;
  const lastNotified = notifyCooldownMap.get(dedupKey);
  if (lastNotified && Date.now() - lastNotified < NOTIFY_COOLDOWN_MS) return;
  notifyCooldownMap.set(dedupKey, Date.now());
  // Periodic cleanup: remove expired entries
  if (notifyCooldownMap.size > 500) {
    const now = Date.now();
    Array.from(notifyCooldownMap.entries()).forEach(([k, t]) => {
      if (now - t > NOTIFY_COOLDOWN_MS) notifyCooldownMap.delete(k);
    });
  }
  
  const msgs = await db.getMessagesByConversation(conversationId, 20);
  const summary = msgs
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');
  
  let emoji = "🔥";
  let urgency = "高品質潛客";
  if (score >= 180) { emoji = "🚨"; urgency = "超級熱客！立刻聯繫"; }
  else if (score >= 120) { emoji = "⚡"; urgency = "高度意願客戶"; }
  else if (score >= 80) { emoji = "🔥"; urgency = "高品質潛客"; }
  else if (phoneJustDetected) { emoji = "📞"; urgency = "客戶留電話了！趕快聯繫"; }
  else if (score >= 50) { emoji = "💬"; urgency = "潛在客戶有興趣"; }

  const phone = conversation.customerContact;
  const title = `${emoji} 網站${urgency}！Score: ${score}${phone ? ' 📞' + phone : ''}`;
  const content = [
    `客戶名稱：${conversation.customerName || '未知'}`,
    `來源渠道：${conversation.channel}`,
    `電話：${phone || '未提供'}`,
    `Lead分數：${score}`,
    `感興趣車輛：${conversation.interestedVehicleIds || '未指定'}`,
    `---`,
    `對話摘要：`,
    summary.substring(0, 500),
    `---`,
    score >= 120 ? `⚠️ 此客戶購買意願極高，請立刻聯繫！` : (phone ? `請盡快撥打 ${phone} 聯繫此客戶！` : `請盡快聯繫此客戶！`),
  ].join('\n');
  
  try {
    await notifyOwner({ title, content });
    const newLevel = Math.max(currentNotifiedLevel, newMilestoneLevel);
    await db.updateConversation(conversationId, { notifiedOwner: newLevel });
    
    // Also send LINE push notification to owner + additional recipients
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const ownerUserId = process.env.LINE_OWNER_USER_ID;
    
    if (channelAccessToken) {
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
      
      // Send simple text notification via LINE push to all recipients
      for (const recipientId of recipientIds) {
        try {
          await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify({
              to: recipientId,
              messages: [{ type: "text", text: `${title}\n\n${content}` }],
            }),
          });
        } catch (pushErr) {
          logger.error("Web Lead Notify", `LINE push to ${recipientId} failed:`, pushErr);
        }
      }
    }
  } catch (err) {
    logger.error("Lead Notify", "Failed:", err);
  }
}

// ============ ROUTERS ============

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ VEHICLE ENDPOINTS ============
  vehicle: router({
    list: publicProcedure.query(async () => {
      return db.getAllVehicles();
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getVehicleById(input.id);
      }),
    
    search: publicProcedure
      .input(z.object({
        brand: z.string().optional(),
        model: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minYear: z.string().optional(),
        maxYear: z.string().optional(),
        fuelType: z.string().optional(),
        bodyType: z.string().optional(),
        query: z.string().optional(),
      }))
      .query(async ({ input }) => {
        // SECURITY: Sanitize search inputs to prevent SQL LIKE injection
        const sanitizedInput = {
          ...input,
          brand: input.brand ? sanitizeSearchQuery(input.brand) : undefined,
          model: input.model ? sanitizeSearchQuery(input.model) : undefined,
          bodyType: input.bodyType ? sanitizeSearchQuery(input.bodyType) : undefined,
          query: input.query ? sanitizeSearchQuery(input.query) : undefined,
        };
        return db.searchVehicles(sanitizedInput);
      }),
    
    brands: publicProcedure.query(async () => {
      return db.getVehicleBrands();
    }),
  }),

  // ============ LOAN INQUIRY ENDPOINTS ============
  loan: router({
    submit: publicProcedure
      .input(z.object({
        vehicleId: z.number().optional(),
        vehicleName: z.string().optional(),
        customerName: z.string().min(1),
        phone: z.string().min(1),
        gender: z.string().optional(),
        age: z.string().optional(),
        hasLicense: z.string().optional(),
        employmentType: z.string().optional(),
        employmentDuration: z.string().optional(),
        hasInsurance: z.string().optional(),
        previousLoans: z.string().optional(),
        purchaseMethod: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createLoanInquiry(input);

        // Notify owner via LINE + system notification
        const vehicleInfo = input.vehicleName || "未指定車輛";
        const title = `💰 貸款諮詢申請！${input.customerName} · ${vehicleInfo}`;
        const content = [
          `姓名：${input.customerName}`,
          `電話：${input.phone}`,
          `性別：${input.gender || "未填"}`,
          `年紀：${input.age || "未填"}`,
          `駕照：${input.hasLicense || "未填"}`,
          `工作類型：${input.employmentType || "未填"}`,
          `工作年資：${input.employmentDuration || "未填"}`,
          `勞健保：${input.hasInsurance || "未填"}`,
          `貸款紀錄：${input.previousLoans || "未填"}`,
          `購買方式：${input.purchaseMethod || "未填"}`,
          `詢問車輛：${vehicleInfo}`,
          input.notes ? `備註：${input.notes}` : "",
          `---`,
          `⚠️ 請盡快撥打 ${input.phone} 聯繫此客戶！`,
        ].filter(Boolean).join("\n");

        try {
          await notifyOwner({ title, content });

          // Also push to LINE owner
          const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
          const ownerUserId = process.env.LINE_OWNER_USER_ID;
          const recipientIds: string[] = [];
          if (ownerUserId) recipientIds.push(ownerUserId);
          const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
          if (additionalIds) {
            additionalIds.split(",").map(id => id.trim()).filter(Boolean).forEach(id => {
              if (!recipientIds.includes(id)) recipientIds.push(id);
            });
          }
          logger.info("Loan Notify", `channelAccessToken: ${channelAccessToken ? "SET" : "MISSING"}, recipientCount: ${recipientIds.length}`);
          if (channelAccessToken && recipientIds.length > 0) {
            for (const recipientId of recipientIds) {
              try {
                const res = await fetch("https://api.line.me/v2/bot/message/push", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
                  body: JSON.stringify({ to: recipientId, messages: [{ type: "text", text: `${title}\n\n${content}` }] }),
                });
                const resBody = await res.text();
                logger.info("Loan Notify", `LINE push to ${recipientId}: ${res.status} ${resBody}`);
              } catch (pushErr) {
                logger.error("Loan Notify", `LINE push failed for ${recipientId}:`, pushErr);
              }
            }
          }
        } catch (err) {
          logger.error("Loan Inquiry Notify", "Failed:", err);
        }

        return { success: true, id };
      }),

    list: adminProcedure.query(async () => {
      return db.getLoanInquiries();
    }),

    updateStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["new", "contacted", "approved", "rejected"]) }))
      .mutation(async ({ input }) => {
        await db.updateLoanInquiryStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // ============ APPOINTMENT ENDPOINTS ============
  appointment: router({
    submit: publicProcedure
      .input(z.object({
        vehicleId: z.number().optional(),
        vehicleName: z.string().optional(),
        customerName: z.string().min(1),
        phone: z.string().min(1),
        preferredDate: z.string().optional(),
        preferredTime: z.string().optional(),
        timeFlexible: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createAppointment(input);

        const vehicleInfo = input.vehicleName || "未指定車輛";
        const timeInfo = input.timeFlexible === "yes"
          ? "暫不確定時間（彈性）"
          : `${input.preferredDate || "未選日期"} ${input.preferredTime || ""}`;
        const title = `📅 預約看車！${input.customerName} · ${vehicleInfo}`;
        const content = [
          `姓名：${input.customerName}`,
          `電話：${input.phone}`,
          `車輛：${vehicleInfo}`,
          `時間：${timeInfo}`,
          input.notes ? `備註：${input.notes}` : "",
          `---`,
          `⚠️ 請盡快撥打 ${input.phone} 確認預約！`,
        ].filter(Boolean).join("\n");

        try {
          await notifyOwner({ title, content });
          const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
          const ownerUserId = process.env.LINE_OWNER_USER_ID;
          const recipientIds: string[] = [];
          if (ownerUserId) recipientIds.push(ownerUserId);
          const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
          if (additionalIds) {
            additionalIds.split(",").map(id => id.trim()).filter(Boolean).forEach(id => {
              if (!recipientIds.includes(id)) recipientIds.push(id);
            });
          }
          logger.info("Appointment Notify", `channelAccessToken: ${channelAccessToken ? "SET" : "MISSING"}, recipientCount: ${recipientIds.length}`);
          if (channelAccessToken && recipientIds.length > 0) {
            for (const recipientId of recipientIds) {
              try {
                const res = await fetch("https://api.line.me/v2/bot/message/push", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
                  body: JSON.stringify({ to: recipientId, messages: [{ type: "text", text: `${title}\n\n${content}` }] }),
                });
                const resBody = await res.text();
                logger.info("Appointment Notify", `LINE push to ${recipientId}: ${res.status} ${resBody}`);
              } catch (pushErr) {
                logger.error("Appointment Notify", `LINE push failed for ${recipientId}:`, pushErr);
              }
            }
          }
        } catch (err) {
          logger.error("Appointment Notify", "Failed:", err);
        }

        return { success: true, id };
      }),

    list: adminProcedure.query(async () => {
      return db.getAppointments();
    }),

    updateStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["new", "confirmed", "completed", "cancelled"]) }))
      .mutation(async ({ input }) => {
        await db.updateAppointmentStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // ============ CHAT ENDPOINTS ============
  chat: router({
    send: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        message: z.string().min(1),
        customerName: z.string().optional(),
        channel: z.enum(["web", "line", "facebook", "youtube", "other"]).default("web"),
      }))
      .mutation(async ({ input }) => {
        // SECURITY: Sanitize chat message input
        const sanitizedMessage = sanitizeChatMessage(input.message);
        
        // Get or create conversation
        let conversation = await db.getConversationBySessionId(input.sessionId);
        
        if (!conversation) {
          const created = await db.createConversation({
            sessionId: input.sessionId,
            customerName: input.customerName || null,
            channel: input.channel,
            status: "active",
            leadScore: 0,
            leadStatus: "new",
          });
          conversation = { ...created, id: created.id, leadScore: 0, notifiedOwner: 0 } as any;
        }
        
        const convId = conversation!.id;

        // If conversation is in human_handoff mode, save message but don't generate AI response
        if (conversation!.status === 'human_handoff') {
          await db.addMessage({ conversationId: convId, role: "user", content: sanitizedMessage });
          return { reply: "目前由真人業務為你服務中，請稍候！", isHumanHandoff: true };
        }

        // Save user message (sanitized)
        await db.addMessage({
          conversationId: convId,
          role: "user",
          content: sanitizedMessage,
        });

        // Auto-detect phone number from message
        const detectedPhone = detectPhoneNumber(sanitizedMessage);
        if (detectedPhone && !conversation!.customerContact) {
          await db.updateConversation(convId, { customerContact: detectedPhone });
          conversation = { ...conversation!, customerContact: detectedPhone };
          logger.info("Chat", "Phone number detected and saved: [REDACTED]");
        }
        
        // Score the message
        const scoring = await scoreMessage(convId, sanitizedMessage);
        
        // Update lead score
        if (scoring.totalDelta > 0) {
          const newScore = (conversation!.leadScore || 0) + scoring.totalDelta;
          const newStatus = newScore >= 80 ? "hot" : newScore >= 50 ? "qualified" : "new";
          await db.updateConversation(convId, {
            leadScore: newScore,
            leadStatus: newStatus,
          });
          conversation = { ...conversation!, leadScore: newScore, leadStatus: newStatus };
        }
        
        // Build context messages for LLM
        const history = await db.getMessagesByConversation(convId, 20);
        
        // ============ VEHICLE DETECTION v5: Context-aware detection ============
        const allVehiclesForDetection = await db.getAllVehicles();
        const vIndex = buildVehicleIndex(allVehiclesForDetection);
        // Pass conversation history so follow-up questions can resolve to previously discussed vehicles
        const historyForDetection = history.map((m: any) => ({ role: m.role, content: m.content }));
        const detectionWeb = detectVehicleFromMessage(input.message, allVehiclesForDetection, historyForDetection, vIndex);
        logger.info("WebChat VehicleDetection", `type=${detectionWeb.type}, vehicle=${detectionWeb.vehicle?.brand || 'none'} ${detectionWeb.vehicle?.model || ''}, question=${detectionWeb.questionType}, answer=${detectionWeb.directAnswer}`);
        
        // Build smart vehicle KB: if target vehicle detected, show it prominently and abbreviate others
        const vehicleKB = buildSmartVehicleKB(allVehiclesForDetection, detectionWeb.vehicle);
        
        // Build target vehicle prompt (will be placed at the END of system prompt for recency bias)
        const targetVehiclePromptWeb = buildTargetVehiclePrompt(detectionWeb, input.message, conversation!.customerContact);

        // ============ INTENT DETECTION v7: Detect customer intents and inject focused instructions ============
        const customerIntentsWeb = detectCustomerIntents(input.message);
        const intentInstructionsWeb = buildIntentInstructions(customerIntentsWeb, input.message, '人客', conversation!.customerContact, detectionWeb.vehicle);
        logger.info("WebChat IntentDetection", `intents=${customerIntentsWeb.join(', ') || 'none'}`);

        // ============ RULE-BASED MODE (skip LLM if enabled) ============
        if (isRuleBasedMode()) {
          logger.info("WebChat", "Rule-based mode active (FORCE_RULE_BASED_REPLY=1)");
          const ruleReply = generateRuleBasedReply({
            userMessage: sanitizedMessage,
            greeting: '人客',
            detection: detectionWeb,
            intents: customerIntentsWeb,
            customerContact: conversation!.customerContact,
            leadScore: conversation!.leadScore ?? undefined,
          });

          await db.addMessage({
            conversationId: convId,
            role: "assistant",
            content: ruleReply,
          });

          const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
          await checkAndNotifyOwner(convId, conversation, phoneJustFound);

          return {
            response: ruleReply,
            leadScore: conversation!.leadScore || 0,
            scoringEvents: scoring.events,
            conversationId: convId,
          };
        }
        // ============ END RULE-BASED MODE ============

        const systemPrompt = `你是「崑家汽車」的資深銷售顧問「高雄阿家」，一位在高雄車界打滾超過40年的老江湖。你不是冷冰冰的機器人，你是一個有溫度、有經驗、有故事的車界老手。你的每一句話都經過精心設計，自然地融合了世界頂尖銷售心理學大師的技巧，但聽起來就像鄰居大哥在跟你聊天。

## 當前時間資訊（非常重要！）
- 今天日期：${new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
- 現在是西元 ${new Date().getFullYear()} 年
- 農曆年份對照：2025年=乙巳蛇年、2026年=丙午馬年、2027年=丁未羊年
- 如果要說過年祝福語，請根據以上對照表使用正確的生肖年，絕對不要說錯！

## 你的人設背景
- 你叫「高雄阿家」，是崑家汽車的首席銷售顧問
- 在高雄車界40年，什麼車都看過、什麼客人都接過
- 你的口頭禪：「買車這件事，交給高雄阿家就對了」
- 你的原則：先交朋友，再談生意。每個客人都是你的「自己人」
- 你深信：「人們喜歡從他們喜歡的人那裡買東西」

## 稱呼規則（非常重要！）
- 在對話中一律用「人客」來稱呼客人（因為網站客服無法判斷性別）
- 但如果客人在對話中透露出性別線索（例如「我老婆」「我先生」「我是女生」），則改用適當稱呼：
  - 男性 → 「大哥」
  - 女性 → 「小姐」
  - 不確定 → 繼續用「人客」
- 絕對不要使用「少年仔」這個稱呼

## 你的說話風格
- 高雄在地口吻，親切直爽，偶爾穿插台語用詞增加親切感
- 說話有畫面感，善用故事和比喻，讓客人腦海中浮現開車的畫面
- 適度用emoji增加親和力，但不過度：🚗 👍 💪 ✨
- 語氣溫暖但自信，不卑不亢
- 用字簡單白話，國中生都看得懂的程度
- 🔴 不要用句點（。）！聊天不用句點！用「！」「～」或emoji結尾
- 🔴 不要用「您」，用「你」就好
- 🔴 禁止使用 markdown 格式！不要用 **粗體**、*斜體*、---分隔線、列表！

## 核心銷售心理學技巧（自然融入對話，不要生硬）

### 一、NLP 神經語言程式學（Tony Robbins）
- 「映射匹配」：模仿客戶的說話方式和用詞。客戶用短句你就用短句，客戶很熱情你也很熱情
- 「錨定」：把正面情緒跟車子連結在一起。「你想像一下，禮拜天早上帶全家去墾丁，開這台車走國三，那個舒適感...」
- 「框架重塑」：把客戶的擔心換個角度看。「貴？其實你想想，一天不到100塊就開一台這麼好的車」
- 「預設前提」：說話時預設客戶已經要買了。「你到時候牽車的時候...」「等你開回去你就知道了」

### 二、催眠式銷售語言（Joe Vitale / Milton Model）
- 「嵌入式指令」：在正常句子裡藏一個指令。「很多人來看了之後，就會【覺得這台很值得】」「你可以【先來店裡看看】，反正不用錢嘛」
- 「感官語言」：讓客戶用五感去體驗。「你坐進去那個皮椅的觸感、聽到引擎發動的聲音、看到那個儀表板亮起來...」
- 「好奇心缺口」：不要一次講完，留個懸念。「這台車有一個很特別的地方，你來看就知道了」
- 「因為框架」：加上理由，人就容易接受。「趁現在來看比較好，因為這台車問的人真的很多」
- 「假定式語言」：用「當你...」而不是「如果你...」。「當你開這台車上路的時候」而不是「如果你買的話」

### 三、影響力心理學（Robert Cialdini 七大原則）
- 「互惠」：先給客戶好處。「我先幫你查一下這台車的完整紀錄，免費的」「我幫你算一下最划算的貸款方案」
- 「稀缺性」：真實的稀缺感。「這個價位的Honda只剩這一台」「上禮拜有人問，我還沒回他」
- 「權威」：展現專業。「我做這行40年了，這種車況我一看就知道」
- 「社會認同」：別人也這樣做。「最近很多年輕爸爸都選這台」「上個月賣了3台同款的」
- 「一致性」：讓客戶做小承諾再擴大。「你是不是比較喜歡SUV？」（先讓他說是）→「那這台很適合你」
- 「喜好」：讓客戶喜歡你。聊共同話題、讚美、找連結。「大哥也住鳳山喔？我家就在附近！」
- 「認同感」：建立「咱們是同一國的」。「咱高雄人買車就是要找在地的，有問題隨時來找我」

### 四、談判心理學（Chris Voss FBI 談判術）
- 「戰術同理心」：先理解再回應。「聽起來你之前買車有不好的經驗齁？我懂，所以我們才特別注重車況透明」
- 「鏡像法」：重複客戶最後幾個字。客戶：「我覺得有點貴」→ 你：「有點貴？」（讓他自己解釋更多）
- 「標籤法」：說出客戶的感受。「聽起來你最在意的是安全性對吧？」「感覺你是想找一台省油又好開的」
- 「校準問題」：用「怎麼」「什麼」開頭的問題引導。「你覺得怎樣的車最適合你的需求？」「什麼條件對你來說最重要？」
- 「指控審計」：先把壞的講出來。「你可能覺得中古車不放心、怕被騙，我完全理解。所以我們每台車都有...」

### 五、行為經濟學（Daniel Kahneman）
- 「損失厭惡」：失去的痛苦是得到的2倍。「這台車如果被別人買走就沒了喔」「現在不看，等下次來可能就沒有了」
- 「錨定效應」：先說高的再說低的。「同款的在台北賣65萬，我們這邊只要52萬」
- 「稟賦效應」：讓客戶感覺已經擁有。「你先坐進去感受一下」「你想像這台車停在你家門口的樣子」
- 「框架效應」：同樣的事換個說法。「一天不到80塊」比「一個月2400」好聽

### 六、催眠式成交（Marshall Sylver / Kevin Hogan）
- 「權威引導」：不問客戶要不要，直接引導下一步。「我幫你安排禮拜六來看車好不好？」
- 「信念重塑」：改變客戶的限制性信念。「很多人以為中古車不好，但其實選對車商比選新車還重要」
- 「情感錨點」：把好的感覺跟你的車連在一起。「你上次開到一台很順的車是什麼感覺？這台就是那種感覺」
- 「繞過批判過濾器」：用故事而不是數據說服。「上禮拜有個大哥跟你一樣，本來也在猶豫，結果來看了之後當場就決定了」

### 七、SPIN 顧問式銷售
- 「情境問題」：了解現況。「大哥現在開什麼車？」「平常都怎麼用車？」
- 「問題探索」：找到痛點。「現在那台車有什麼讓你不滿意的地方？」
- 「暗示影響」：放大痛點。「油耗太高的話，一年下來也是一筆不小的開銷齁」
- 「需求回報」：讓客戶自己說出需要。「如果有一台省油又大空間的車，對你來說是不是就解決了？」

## 對話策略（四階段漏斗）

### 第一階段：破冰寒暄（建立信任 + 喜好原則）
- 先聊天，不急著賣車。用「互惠」先給好處
- 了解客戶的用車需求、家庭狀況、預算範圍
- 用SPIN的「情境問題」自然地收集資訊
- 「人客你好！今天想看什麼車款？還是先隨便聊聊？」

### 第二階段：需求探索（戰術同理心 + 標籤法）
- 用「標籤法」確認需求：「聽起來你是想找一台...對吧？」
- 用SPIN的「問題探索」找到痛點
- 用「鏡像法」讓客戶多說
- 提供2-3個選擇，讓客戶有比較的空間

### 第三階段：價值建立（錨定 + 稀缺 + 感官語言）
- 用「錨定效應」先建立高價值認知
- 用「感官語言」讓客戶想像擁有的感覺
- 用「社會認同」：「很多客人都選這台」
- 用「稀缺性」製造真實的緊迫感
- 用「稟賦效應」：讓客戶感覺已經是他的了

### 第四階段：促成行動（假定成交 + 權威引導）
- 用「假定式語言」：「你什麼時候方便來看？」而不是「你要不要來看？」
- 用「權威引導」直接安排下一步
- 用「損失厭惡」：「我先幫你留著，但不確定能留多久」
- 自然地引導預約看車或留下聯絡方式

## 處理常見情境

### 客戶殺價時（框架重塑 + 價值錨定）
- 先用「標籤法」：「大哥你很精打細算喔！」
- 用「錨定效應」：「同款的在別家賣更高，我們這個價格已經是高雄最實在的了」
- 用「框架重塑」：「你不是在花錢，你是在投資一台好車。車況好的車，後面省下的維修費比那幾萬塊多太多了」
- 用「損失厭惡」：「如果為了省幾萬買到車況不好的，後面花的錢更多喔」

### 客戶說要再考慮時（好奇心缺口 + 一致性）
- 先用「戰術同理心」：「沒問題，買車是大事，我完全理解」
- 用「好奇心缺口」：「不過這台車有個特別的地方，你來看了就知道」
- 用「一致性」：「你剛說想找省油又大空間的，這台完全符合你的需求耶」
- 用「稀缺性」：「我先幫你留著，但最近問的人不少」

### 客戶比價時（權威 + 社會認同 + 指控審計）
- 先用「指控審計」：「你可能覺得別家比較便宜，我懂」
- 用「權威」：「我做40年了，便宜的車我看太多了，很多都是車況有問題才便宜」
- 用「社會認同」：「我們的回頭客很多，就是因為車況實在」
- 用「框架重塑」：「買車不是比誰便宜，是比誰讓你買了不後悔」

### 客戶問到沒有的車時（互惠 + 留住線索）
- 誠實告知，用「互惠」建立關係：「這台目前沒有，但我幫你留意，有的話第一時間通知你」
- 推薦替代：「不過我手上有一台很類似的，說不定你會更喜歡」
- 用「好奇心缺口」：「而且那台有個優點是...你要不要先來看看？」

## ⚠️⚠️⚠️ 預約看車 + 索取電話 + 時段確認機制 ⚠️⚠️⚠️

### 核心原則：當客戶表達想看車的意願時，要「同時」做兩件事：
1. 根據客戶提到的時段，給出該時段內的三個細分選項
2. 如果還沒有客戶電話，順便請客戶留電話（方便業務進一步服務）

### 🔴 絕對規則：時段選項必須匹配客戶說的時段 🔴

**步驟一：回顧整段對話，找出客戶提過的任何時間偏好**
搜尋關鍵詞：「上午」「下午」「晚上」「早上」「中午」「傍晚」「下班後」「平日」「週末」「禮拜X」以及任何具體時間（如「2點」「14:00」）

**步驟二：根據找到的時間偏好，決定三個選項**

看車時段 = 回電時段 = 時段選項。三者是同一件事！
客戶說「下午看車」→ 三個選項全部在下午
客戶說「晚上去看」→ 三個選項全部在晚上
客戶說「禮拜六下午」→ 三個選項全部在下午

對照表（嚴格遵守，不可混用）：

| 客戶提到的關鍵詞 | 三個選項 |
|---|---|
| 上午、早上、morning | ① 9:00-10:00 ② 10:00-11:00 ③ 11:00-12:00 |
| 下午、afternoon | ① 13:00-14:00 ② 14:00-15:00 ③ 15:00-16:00 |
| 晚上、下班後、傍晚、evening | ① 17:00-18:00 ② 18:00-19:00 ③ 19:00-20:00 |
| 中午 | ① 11:00-12:00 ② 12:00-13:00 ③ 13:00-14:00 |
| 具體時間（如「2點」「14:00」） | 直接確認該時間，不需要給三個選項 |
| 完全沒提過任何時段偏好 | ① 上午 10:00-11:00 ② 下午 14:00-15:00 ③ 晚上 18:00-19:00 |

### 🚫 錯誤示範（絕對禁止）：
客戶：「我想禮拜六下午看車」
❌ 錯誤回覆：① 上午 10:30-11:30 ② 下午 2:00-3:00 ③ 晚上 6:00-7:00
（錯誤原因：客戶說「下午」，但你給了上午和晚上的選項）

### ✅ 正確示範（有電話的情況）：
客戶：「我想禮拜六下午看車」（已留電話）
✅ 正確回覆：「好的！禮拜六下午沒問題👍 賴先生會打給你確認細節，請問哪個時段最方便？
① 13:00-14:00
② 14:00-15:00
③ 15:00-16:00
人客回覆數字就好囉！🚗✨」

### ✅ 正確示範（沒有電話的情況 — 同時問時段+電話）：
客戶：「我想禮拜六下午看車」（還沒留電話）
✅ 正確回覆：「好的！禮拜六下午看車沒問題👍 這樣我請賴先生直接跟你聯繫安排，請問哪個下午時段最方便？
① 13:00-14:00
② 14:00-15:00
③ 15:00-16:00
另外人客方便留個電話嗎？這樣賴先生可以直接打給你確認，比較快啦！📞」

### ✅ 更多正確示範：
客戶：「晚上方便」→ ① 17:00-18:00 ② 18:00-19:00 ③ 19:00-20:00
客戶：「我只有早上有空」→ ① 9:00-10:00 ② 10:00-11:00 ③ 11:00-12:00
客戶：「下班後想去看」→ ① 17:00-18:00 ② 18:00-19:00 ③ 19:00-20:00
客戶：「2點可以嗎」→ 直接確認「好的，下午2點！」不需要給三個選項

### 索取電話的時機：
${conversation!.customerContact ? `- 客戶已留電話：${conversation!.customerContact}，不需要再問電話
- 專注在確認時段即可` : `- 客戶還沒留電話
- 當客戶表達想看車/預約的意願時，在給時段選項的同時，順便請客戶留電話
- 用親切自然的方式：「方便留個電話嗎？賴先生可以直接打給你確認，比較快啦！」
- 不要太強硬，如果客戶不想給就不要一直問
${(conversation!.leadScore || 0) >= 40 ? '- 客戶購買意願較高（Lead Score: ' + conversation!.leadScore + '），可以更積極一點詢問電話' : ''}`}

- 列出三個時段選項（①②③），讓客戶回覆數字就好
- 如果客戶已經選了時段（回覆①或②或③），確認時要用客戶選的實際時段回覆

## 聯絡資訊
- 預約賞車電話：0936-812-818 賴先生
- LINE 官方帳號：@825oftez（搜尋此 ID 或掃 QR Code 加好友）
- 地址：高雄市三民區大順二路269號（肯德基斜對面）
- Google 地圖：https://maps.google.com/?q=高雄市三民區大順二路269號
- 營業時間：週一至週六 9:00-20:00
- 重要：客人問地址時，一定要回答「高雄市三民區大順二路269號（肯德基斜對面）」並附上 Google 地圖連結

## 在售車輛資料庫

${vehicleKB}

## 一般回答規則
- 一律使用繁體中文
- 每次回覆控制在80字以內，簡潔有力，不要分段、不要換行
- 🔴 你是「二手車行」，只賣上方「在售車輛」清單上的車！不要介紹或報價清單以外的車！不要用你的知識編造任何車輛的價格、規格或年式資訊！
- 🔴 你是「開場助理」，回答重點就好，留空間給真人業務接手！不要自己把話講完講滿！
- 🔴 問價格就直接報價，不要說「官方還沒公布」之類的廢話！
- 第一次對話一定要先打招呼寒暄
- 推薦車輛時要說出「為什麼這台適合你」的理由
- 回答完重點後，一句話引導下一步就好
- 如果客戶表現出強烈購買意向，主動提供聯絡方式並建議預約看車
- 不編造車輛規格資訊，所有規格（排氣量、里程、配備等）必須依照上方車輛資料回答，沒有的資料不能亂掐
- 銷售技巧要自然融入對話，不要讓客戶感覺被操控
- 永遠真誠，不說假話。稀缺性和社會認同要基於事實，不要編造

## ❗❗❗ 多問題回答規則（非常重要！）❗❗❗
客人的一則訊息可能同時問多個問題，你必須「每個問題都回答」，不能只回答其中一個！
常見組合：
- 客人問「想看某台車 + 什麼時候方便 + 地址在哪」→ 你要回答：① 肯定客人的選擇並介紹該車 ② 給出預約時段選項 ③ 提供店地址
- 客人問「多少錢 + 可以貸款嗎」→ 你要回答：① 價格 ② 貸款資訊（或轉真人）
- 客人問「排氣量 + 油耗」→ 你要回答：① 排氣量 ② 油耗資訊
❗ 絕對禁止只回答其中一個問題而忽略其他問題！

## ❗❗❗ 真人接手機制（非常重要！）❗❗❗
當你確實不知道答案、沒有資料可以回答客人的問題時：
- 你必須在回覆中加入「[HUMAN_HANDOFF]」標記（客人看不到這個標記）
- 回覆內容要說：「這個問題我幫你轉給專人來回答，真人客服馬上就到！請稍等一下🙏」
- 觸發條件：
  1. 客人問的問題你完全沒有資料可以回答
  2. 客人明確要求要跟真人說話
  3. 客人對你的回答不滿意，連續追問同一個問題
  4. 涉及複雜的議價、貸款、保固、法律等專業問題
${targetVehiclePromptWeb}${intentInstructionsWeb}`;

        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...history.map(m => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          })),
        ];
        
        try {
          const response = await invokeLLM({ messages: llmMessages });
          let assistantContent = typeof response.choices[0]?.message?.content === 'string'
            ? response.choices[0].message.content
            : '抱歉，我暫時無法回應，請稍後再試。';
          
          // ============ HUMAN HANDOFF DETECTION (Web) ============
          let isHumanHandoff = false;
          if (assistantContent.includes('[HUMAN_HANDOFF]')) {
            isHumanHandoff = true;
            assistantContent = assistantContent.replace(/\s*\[HUMAN_HANDOFF\]\s*/g, '').trim();
            logger.info('Chat', 'HUMAN HANDOFF triggered (web chatbot)!');
          }
          // Secondary detection: AI said "I'll check for you" type phrases
          const uncertaintyPatterns = /我幫你確認一下|我幫你問問|我幫你查|我不太確定|這個我要確認|我幫您確認|我幫您查/;
          if (!isHumanHandoff && uncertaintyPatterns.test(assistantContent)) {
            isHumanHandoff = true;
            assistantContent += '\n\n\ud83d\ude4b\u200d\u2642\ufe0f 我已經通知專人了，真人客服馬上就到！';
            logger.info('Chat', 'HUMAN HANDOFF triggered (uncertainty detected in web chatbot).');
          }
          
          // If human handoff triggered, update DB status and send LINE push to owner + staff
          if (isHumanHandoff) {
            await db.updateConversation(conversation!.id, { status: 'human_handoff' });
            try {
              const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
              const ownerUserId = process.env.LINE_OWNER_USER_ID;
              if (channelAccessToken) {
                const recipientIds: string[] = [];
                if (ownerUserId) recipientIds.push(ownerUserId);
                const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
                if (additionalIds) {
                  const extras = additionalIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
                  for (const extraId of extras) {
                    if (!recipientIds.includes(extraId)) recipientIds.push(extraId);
                  }
                }
                if (recipientIds.length > 0) {
                  const customerName = conversation?.customerName || '網站訪客';
                  const textNotification = {
                    type: 'text',
                    text: `\ud83d\udea8 客人需要真人回覆！\n\n客戶：${customerName}\n渠道：網站聊天\n客人的問題：${sanitizedMessage.substring(0, 100)}\n\n請立即到 LINE 官方帳號回覆客人！`,
                  };
                  for (const recipientId of recipientIds) {
                    try {
                      await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${channelAccessToken}` },
                        body: JSON.stringify({ to: recipientId, messages: [textNotification] }),
                      });
                      logger.info('Chat', 'Human handoff notification sent to LINE recipient.');
                    } catch (e) { logger.error('Chat', 'Human handoff push failed:', e); }
                  }
                }
              }
              await notifyOwner({
                title: '\ud83d\udea8 網站客人需要真人回覆！',
                content: `客戶：${conversation?.customerName || '網站訪客'}\n問題：${sanitizedMessage}\n\nAI 無法回答此問題，請立即回覆！`,
              });
            } catch (notifyErr) {
              logger.error('Chat', 'Human handoff notification error:', notifyErr);
            }
          }
          
          // Save assistant response
          await db.addMessage({
            conversationId: convId,
            role: "assistant",
            content: assistantContent,
          });
          
          // Extract interested vehicles from conversation
          const allVehicles = await db.getAllVehicles();
          const mentionedVehicles = allVehicles.filter(v => 
            input.message.includes(v.brand) || 
            input.message.includes(v.model) ||
            assistantContent.includes(v.brand + ' ' + v.model)
          );
          
          if (mentionedVehicles.length > 0) {
            await db.updateConversation(convId, {
              interestedVehicleIds: mentionedVehicles.map(v => v.id).join(','),
            });
          }
          
          // Check if should notify owner
          const phoneJustFound = !!(detectedPhone && detectedPhone === conversation!.customerContact);
          await checkAndNotifyOwner(convId, conversation, phoneJustFound);
          
          return {
            response: assistantContent,
            leadScore: conversation!.leadScore || 0,
            scoringEvents: scoring.events,
            conversationId: convId,
          };
        } catch (err: any) {
          logger.error("Chat", "LLM error, falling back to rule-based reply:", err);
          const fallback = generateRuleBasedReply({
            userMessage: sanitizedMessage,
            greeting: '人客',
            detection: detectionWeb,
            intents: customerIntentsWeb,
            customerContact: conversation!.customerContact,
            leadScore: conversation!.leadScore ?? undefined,
          });
          await db.addMessage({ conversationId: convId, role: "assistant", content: fallback });
          return {
            response: fallback,
            leadScore: conversation!.leadScore || 0,
            scoringEvents: scoring.events,
            conversationId: convId,
          };
        }
      }),
    
    history: publicProcedure
      .input(z.object({ sessionId: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        // SECURITY: Validate sessionId format to prevent injection
        if (!/^[a-zA-Z0-9_-]+$/.test(input.sessionId)) {
          return { messages: [], conversation: null };
        }
        const conversation = await db.getConversationBySessionId(input.sessionId);
        if (!conversation) return { messages: [], conversation: null };
        const msgs = await db.getMessagesByConversation(conversation.id);
        // SECURITY: Mask PII in conversation data returned to client
        const maskedConversation = {
          ...conversation,
          customerContact: conversation.customerContact ? maskPhone(conversation.customerContact) : null,
        };
        return { messages: msgs, conversation: maskedConversation };
      }),
  }),

  // ============ ADMIN ENDPOINTS ============
  admin: router({
    dashboard: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        const stats = await db.getDashboardStats(input?.startDate, input?.endDate);
        const allVehicles = await db.getAllVehicles();
        return { stats, vehicleCount: allVehicles.length };
      }),
    
    conversations: adminProcedure
      .input(z.object({
        channel: z.string().optional(),
        status: z.string().optional(),
        leadStatus: z.string().optional(),
        minScore: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.listConversations(input || {});
      }),
    
    conversationDetail: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db2 = await db.getDb();
        if (!db2) return null;
        const { conversations: convTable, messages: msgTable, leadEvents: evtTable } = await import("../drizzle/schema");
        const [convs] = await Promise.all([
          db2.select().from(convTable).where(eq(convTable.id, input.id)).limit(1),
        ]);
        if (!convs[0]) return null;
        const [msgs, events] = await Promise.all([
          db.getMessagesByConversation(input.id),
          db.getLeadEvents(input.id),
        ]);
        return { conversation: convs[0], messages: msgs, leadEvents: events };
      }),
    
    updateConversation: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["active", "closed", "follow_up"]).optional(),
        leadStatus: z.enum(["new", "qualified", "hot", "converted", "lost"]).optional(),
        tags: z.string().optional(),
        customerName: z.string().optional(),
        customerContact: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateConversation(id, data);
        return { success: true };
      }),
    
    vehicles: adminProcedure.query(async () => {
      return db.getAllVehicles();
    }),
    
    updateVehicleStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["available", "sold", "reserved"]),
      }))
      .mutation(async ({ input }) => {
        const db2 = await db.getDb();
        if (!db2) throw new Error("Database not available");
        const { vehicles: vTable } = await import("../drizzle/schema");
        await db2.update(vTable).set({ status: input.status }).where(eq(vTable.id, input.id));
        return { success: true };
      }),

    updateVehicleMedia: adminProcedure
      .input(z.object({
        id: z.number(),
        videoUrl: z.string().nullable().optional(),
        photos360Urls: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db2 = await db.getDb();
        if (!db2) throw new Error("Database not available");
        const { vehicles: vTable } = await import("../drizzle/schema");
        const updates: Record<string, any> = {};
        if (input.videoUrl !== undefined) updates.videoUrl = input.videoUrl;
        if (input.photos360Urls !== undefined) updates.photos360Urls = input.photos360Urls;
        if (Object.keys(updates).length > 0) {
          await db2.update(vTable).set(updates).where(eq(vTable.id, input.id));
        }
        return { success: true };
      }),

    // 8891 Sync endpoints
    syncStatus: adminProcedure.query(async () => {
      return getSyncStatus();
    }),

    triggerSync: adminProcedure.mutation(async () => {
      const result = await sync8891();
      return result;
    }),

    // LINE Rich Menu endpoints
    richMenuStatus: adminProcedure.query(async () => {
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!token) return { hasDefault: false, defaultMenuId: null, totalMenus: 0, menus: [], configured: false };
      const status = await getRichMenuStatus(token);
      return { ...status, configured: true };
    }),

    deployRichMenu: adminProcedure.mutation(async () => {
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");
      return deployRichMenu(token);
    }),

    removeRichMenu: adminProcedure.mutation(async () => {
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");
      const success = await cancelDefaultRichMenu(token);
      return { success };
    }),

    // ============ SECURITY AUDIT ENDPOINTS ============
    securityEvents: adminProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        logSecurityEvent({
          eventType: "pii_access",
          severity: "low",
          source: "admin_dashboard",
          details: "Admin accessed security audit log",
        });
        return getSecurityEvents(input?.limit || 50);
      }),

    // ============ ANALYTICS & REPORTS ============

    /** Daily conversation trends (time-series) */
    dailyConversations: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getDailyConversationStats(start, end);
      }),

    /** Daily message volume */
    dailyMessages: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getDailyMessageStats(start, end);
      }),

    /** Lead conversion funnel */
    leadFunnel: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getLeadConversionFunnel(start, end);
      }),

    /** Popular vehicles by customer interest */
    popularVehicles: adminProcedure.query(async () => {
      return db.getPopularVehicles(10);
    }),

    /** Lead score distribution */
    leadScoreDistribution: adminProcedure.query(async () => {
      return db.getLeadScoreDistribution();
    }),

    /** Lead event type breakdown */
    leadEventBreakdown: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getLeadEventBreakdown(start, end);
      }),

    /** LINE behavioral analytics */
    lineAnalytics: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getAnalyticsEventBreakdown(start, end);
      }),

    // ============ WEB ANALYTICS (like Umami) ============

    /** Web analytics summary (page views, visitors, duration) */
    webSummary: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getWebAnalyticsSummary(start, end);
      }),

    /** Daily visitor time-series */
    dailyVisitors: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getDailyVisitorStats(start, end);
      }),

    /** Top pages */
    topPages: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getTopPages(start, end);
      }),

    /** Top referrers */
    topReferrers: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getTopReferrers(start, end);
      }),

    /** Browser stats */
    browserStats: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getBrowserStats(start, end);
      }),

    /** OS stats */
    osStats: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getOsStats(start, end);
      }),

    /** Device stats */
    deviceStats: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getDeviceStats(start, end);
      }),

    /** Country stats */
    countryStats: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getCountryStats(start, end);
      }),

    // ============ CSV EXPORT ============

    /** Export conversations as CSV */
    exportConversations: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        const rows = await db.getAllConversationsForExport(start, end);
        const header = "ID,SessionID,CustomerName,Channel,Status,LeadScore,LeadStatus,CreatedAt,UpdatedAt";
        const csvRows = rows.map(r =>
          `${r.id},"${r.sessionId}","${(r.customerName || '').replace(/"/g, '""')}",${r.channel},${r.status},${r.leadScore},${r.leadStatus},"${r.createdAt}","${r.updatedAt}"`
        );
        return { csv: [header, ...csvRows].join("\n"), filename: `conversations_${new Date().toISOString().split('T')[0]}.csv` };
      }),

    /** Export lead events as CSV */
    exportLeadEvents: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        const rows = await db.getAllLeadEventsForExport(start, end);
        const header = "ID,ConversationID,EventType,ScoreChange,Reason,CreatedAt";
        const csvRows = rows.map(r =>
          `${r.id},${r.conversationId},"${r.eventType}",${r.scoreChange},"${(r.reason || '').replace(/"/g, '""')}","${r.createdAt}"`
        );
        return { csv: [header, ...csvRows].join("\n"), filename: `lead_events_${new Date().toISOString().split('T')[0]}.csv` };
      }),

    /** Export vehicles as CSV */
    exportVehicles: adminProcedure.query(async () => {
      const rows = await db.getAllVehicles();
      const header = "ID,ExternalID,Brand,Model,Year,Price,Mileage,Color,Transmission,FuelType,Status";
      const csvRows = rows.map(r =>
        `${r.id},"${r.externalId}","${r.brand}","${r.model}","${r.modelYear || ''}","${r.priceDisplay || r.price || ''}","${r.mileage || ''}","${r.color || ''}","${r.transmission || ''}","${r.fuelType || ''}",${r.status}`
      );
      return { csv: [header, ...csvRows].join("\n"), filename: `vehicles_${new Date().toISOString().split('T')[0]}.csv` };
    }),
  }),
});

export type AppRouter = typeof appRouter;
