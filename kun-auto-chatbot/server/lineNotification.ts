import * as db from "./db";
import { notifyOwner } from "./_core/notification";

// ============ HELPER: Get assistant content description for Rich Menu triggers ============
export function getAssistantContentForTrigger(trigger: { type: string; label: string }): string {
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
    case "faq_chip":
      return `[🏆 FAQ揭曉：${trigger.label}]`;
    case "photo_browse":
      return `[📸 已發送 ${trigger.label} 的所有照片]`;
    default:
      return "[已發送圖文卡片]";
  }
}

// ============ HELPER: Build Flex Message notification for owner ============
export function buildOwnerNotificationFlex(
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

  // One-tap takeover button — operator taps after replying via LINE OA Manager
  // to permanently silence the AI for this conversation.
  footerContents.push({
    type: "button",
    style: "secondary",
    height: "sm",
    action: {
      type: "postback",
      label: "🔒 我來接手 (停止 AI)",
      data: `action=operator_takeover&convId=${conversation.id}`,
      displayText: `🔒 接手 ${customerName}，停止 AI`,
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

export function getMilestoneLevel(score: number): number {
  // Returns how many milestones have been reached
  let level = 0;
  for (const m of NOTIFICATION_MILESTONES) {
    if (score >= m) level++;
  }
  return level;
}

// Dedup: prevent duplicate LINE notifications for the same conversation within 10 minutes
export const lineNotifyCooldownMap = new Map<string, number>();
const LINE_NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

export async function checkAndNotifyOwner(
  conversation: any,
  userMessage: string,
  channelAccessToken: string,
  ownerUserId?: string,
  phoneJustDetected?: boolean
) {
  // Skip notifications during human handoff — staff is already handling this customer
  if (conversation.status === 'human_handoff') {
    console.log(`[LINE] Skipping owner notification — conversation ${conversation.id} is in human_handoff mode`);
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

// ============ NEW-CUSTOMER ARRIVAL: Build Flex Message ============
// Pushed to operators on a customer's FIRST message — gives Megan a one-tap
// takeover button BEFORE the AI even replies. Per Jerry's request: every
// customer entering the chat should give Megan the option to take over,
// not just hot leads or AI-failure cases.
export function buildNewCustomerArrivalFlex(
  conversation: any,
  userMessage: string
): any {
  const customerName = conversation.customerName || "新客戶";

  return {
    type: "flex",
    altText: `🆕 新客人 ${customerName}：${userMessage.substring(0, 30)}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: "🆕 新客人剛開始對話", color: "#FFFFFF", size: "sm", weight: "bold" },
          { type: "text", text: "可選擇接手", color: "#FFFFFF", size: "sm", align: "end" },
        ],
        backgroundColor: "#0D6EFD",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: customerName, weight: "bold", size: "lg" },
          { type: "separator", margin: "md" },
          { type: "text", text: "客人第一句：", size: "xs", color: "#AAAAAA", margin: "lg" },
          {
            type: "text",
            text: userMessage.length > 120 ? userMessage.substring(0, 120) + "..." : userMessage,
            size: "sm", color: "#333333", wrap: true, margin: "sm",
          },
          { type: "separator", margin: "lg" },
          {
            type: "text",
            text: "AI 會自動回覆。如果你想自己回，按下方接手按鈕。",
            size: "xs", color: "#888888", wrap: true, margin: "sm",
          },
        ],
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#DC3545",
            action: {
              type: "postback",
              label: "🔒 我來接手 (停止 AI)",
              data: `action=operator_takeover&convId=${conversation.id}`,
              displayText: `🔒 接手 ${customerName}，停止 AI`,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: "💬 開啟LINE聊天室",
              uri: "https://chat.line.biz/",
            },
          },
        ],
        paddingAll: "12px",
      },
    },
  };
}

// Push the new-customer arrival card to all configured operators.
// Best-effort: errors are logged but never thrown (the actual customer reply must not block on this).
export async function sendNewCustomerNotification(
  conversation: any,
  userMessage: string,
  channelAccessToken: string,
  ownerUserId?: string
): Promise<void> {
  const recipientIds: string[] = [];
  if (ownerUserId) recipientIds.push(ownerUserId);
  // Reuse the existing notify-list env var; also merge in LINE_OPERATOR_USER_IDS
  // so explicit operators (Megan etc.) get the heads-up too.
  const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
  if (additionalIds) {
    for (const id of additionalIds.split(',').map(s => s.trim()).filter(Boolean)) {
      if (!recipientIds.includes(id)) recipientIds.push(id);
    }
  }
  const operatorIds = process.env.LINE_OPERATOR_USER_IDS;
  if (operatorIds) {
    for (const id of operatorIds.split(',').map(s => s.trim()).filter(Boolean)) {
      if (!recipientIds.includes(id)) recipientIds.push(id);
    }
  }
  if (recipientIds.length === 0) {
    console.warn('[LINE] No operators configured for new-customer notification');
    return;
  }

  const flexMsg = buildNewCustomerArrivalFlex(conversation, userMessage);

  for (const recipientId of recipientIds) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({ to: recipientId, messages: [flexMsg] }),
      });
      console.log(`[LINE] 🆕 New-customer notification sent to operator: ${res.status}`);
    } catch (err) {
      console.error('[LINE] new-customer push failed:', err);
    }
  }
}

// ============ HUMAN HANDOFF: Build Flex Message for staff notification ============
export function buildHumanHandoffFlex(
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

  // One-tap takeover: operator taps this AFTER they've replied via LINE OA.
  // Postback is verified against the operator whitelist in lineWebhook.ts.
  footerContents.push({
    type: "button",
    style: "secondary",
    height: "sm",
    action: {
      type: "postback",
      label: "🔒 我已接手 (停止 AI)",
      data: `action=operator_takeover&convId=${conversation.id}`,
      displayText: `🔒 接手 ${customerName}，停止 AI`,
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
export async function sendHumanHandoffNotification(
  conversation: any,
  userMessage: string,
  aiResponse: string,
  channelAccessToken: string,
  ownerUserId?: string
): Promise<boolean> {
  const customerName = conversation.customerName || "未知客戶";

  const maskedName = customerName.length > 1 ? customerName[0] + "*".repeat(customerName.length - 1) : "*";
  console.log(`[LINE] 🚨 Sending HUMAN HANDOFF notification for customer: ${maskedName}`);

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
      return true;
    } else {
      console.warn('[LINE] No recipients configured for human handoff notification!');
      return false;
    }
  } catch (err) {
    console.error("[LINE] Human handoff notification failed:", err);
    return false;
  }
}
