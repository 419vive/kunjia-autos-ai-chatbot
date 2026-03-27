import * as db from "./db";
import { buildContextualQuickReply, type ConversationContext } from "./lineFlexTemplates";
import { getNameGreeting, detectGenderFromName } from "./lineUtils";

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
      console.log(`[LINE] Skipping nudge for ${userId.slice(0, 8)}... — in human_handoff mode`);
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
        { type: "action", action: { type: "uri", label: "💰 填貸款評估", uri: `${process.env.BASE_URL || "https://claude-code-remote-production.up.railway.app"}/loan-inquiry` } },
        { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車" } },
        { type: "action", action: { type: "uri", label: "📞 直接打電話", uri: "tel:0936812818" } },
      );
    } else if (track.lastTopic === "booking") {
      nudgeText = "看車的時間有想到嗎？不用完全確定，我們電話再聊也可以 😊";
      quickReplyItems.push(
        { type: "action", action: { type: "message", label: "📅 預約看車", text: "我想預約看車" } },
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
      console.log(`[LINE Recovery] Nudge sent to ${userId.slice(0, 8)}... (topic: ${track.lastTopic})`);

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
      console.error(`[LINE Recovery] Nudge failed for ${userId.slice(0, 8)}...:`, err);
    }
  }
}

// Run conversation recovery check every 60 seconds
setInterval(() => {
  checkConversationRecovery().catch((err) => console.error("[LINE Recovery] Check error:", err));
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
                  { type: "action", action: { type: "uri", label: "💰 問貸款", uri: `${process.env.BASE_URL || "https://claude-code-remote-production.up.railway.app"}/loan-inquiry` } },
                  { type: "action", action: { type: "uri", label: "📞 直接打電話", uri: "tel:0936812818" } },
                ],
              },
            }],
          }),
        });

        followUpCooldown.set(conv.id, now);
        console.log(`[LINE] 📩 Follow-up sent to conv ${conv.id} (${greeting})`);

        // Save follow-up to conversation
        await db.addMessage({
          conversationId: conv.id,
          role: "assistant",
          content: `[系統自動跟進] ${followUpText}`,
        });
      } catch (err) {
        console.error(`[LINE] Follow-up push failed for conv ${conv.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[LINE] Follow-up system error:", err);
  }
}

// Run follow-up check every 2 hours
setInterval(() => {
  sendFollowUpMessages().catch((err) => console.error("[LINE] Follow-up interval error:", err));
}, 2 * 60 * 60 * 1000);
