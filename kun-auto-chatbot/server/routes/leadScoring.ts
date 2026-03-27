import { logger } from "../logger";
import { notifyOwner } from "../_core/notification";
import * as db from "../db";
import { detectPhoneNumber } from "../lineUtils";

// ============ LEAD SCORING LOGIC ============

// ===== 8-Dimension Lead Scoring Model =====
// Based on BANT + SPIN Selling + Sandler Pain Funnel + world-class sales masters
export const LEAD_SCORE_RULES = [
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

export async function scoreMessage(conversationId: number, message: string): Promise<{ totalDelta: number; events: Array<{ type: string; score: number; reason: string }> }> {
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

export const QUALITY_LEAD_THRESHOLD = 50;

// Milestone-based notification: notify at score 50, 80, 120, 180
export const WEB_NOTIFICATION_MILESTONES = [50, 80, 120, 180];

export function getWebMilestoneLevel(score: number): number {
  let level = 0;
  for (const m of WEB_NOTIFICATION_MILESTONES) {
    if (score >= m) level++;
  }
  return level;
}

// Dedup: prevent duplicate notifications for the same conversation within 10 minutes
export const notifyCooldownMap = new Map<string, number>();
export const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

export async function checkAndNotifyOwner(conversationId: number, conversation: any, phoneJustDetected?: boolean) {
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
