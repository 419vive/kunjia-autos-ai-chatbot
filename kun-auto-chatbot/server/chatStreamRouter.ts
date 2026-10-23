import express, { Response } from "express";
import { logger } from "./logger";
import { sanitizeChatMessage, validateLLMOutput, getGuardrailMode, maskPIIInText } from "./security";
import { detectVehicleFromMessage, detectCustomerIntents, buildTargetVehiclePrompt, buildIntentInstructions } from "./vehicleDetectionService";
import { buildPhoneAskInstruction } from "./phoneAsk";
import { invokeLLMStream } from "./_core/llm";
import { generateRuleBasedReply } from "./ruleBasedReply";
import * as db from "./db";
import { SHOP_ADDRESS, SHOP_PHONE, SHOP_CONTACT_PERSON, SHOP_HOURS, SHOP_LINE_ID, SHOP_MAP_URL, SHOP_CITY } from "../shared/shopConfig";

/**
 * SSE streaming router for real-time chat responses.
 * Streams tokens from Gemini as they arrive, giving 3x perceived speedup.
 */
export const chatStreamRouter = express.Router();

/**
 * POST /api/chat/stream
 *
 * Body: {
 *   sessionId: string,
 *   message: string,
 *   channel?: "web" | "line" | "facebook" | "youtube" | "other",
 *   vehicleContext?: string
 * }
 *
 * Response: Server-Sent Events stream
 * - Event: "token" with data: "<text>"
 * - Event: "done" with data: JSON metadata
 * - Event: "error" with data: error message
 */
chatStreamRouter.post("/api/chat/stream", async (req: express.Request, res: Response) => {
  try {
    const { sessionId, message, channel = "web", vehicleContext } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "Invalid sessionId" });
      return;
    }

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Invalid message" });
      return;
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Helper to send SSE message
    const sendSSE = (event: string, data: string | object) => {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      res.write(`event: ${event}\n`);
      res.write(`data: ${payload}\n\n`);
    };

    // Get or create conversation
    let conversation = await db.getConversationBySessionId(sessionId);
    if (!conversation) {
      await db.createConversation({ sessionId, channel });
      // Re-fetch to get full record with DB defaults
      conversation = await db.getConversationBySessionId(sessionId);
    }

    if (!conversation) {
      sendSSE("error", "Failed to create conversation");
      res.end();
      return;
    }

    const convId = conversation.id;

    // Sanitize user message
    const sanitizedMessage = sanitizeChatMessage(message);

    // aiDisabled gate: when an operator has taken over (admin.disableAi /
    // operatorReply sets aiDisabled=1), the AI must not talk over them. Store the
    // customer's message so the operator sees it in the dashboard, then close the
    // stream with no AI reply — the customer still receives operator replies via
    // the 3s polling channel.
    if ((conversation as any).aiDisabled === 1) {
      await db.addMessage({
        conversationId: convId,
        role: "user",
        content: sanitizedMessage,
      });
      logger.info("ChatStream", `Conv ${convId} aiDisabled — operator has taken over, skipping AI reply`);
      sendSSE("done", {
        conversationId: convId,
        leadScore: conversation.leadScore || 0,
        isHandoff: false,
      });
      res.end();
      return;
    }

    // Store user message
    await db.addMessage({
      conversationId: convId,
      role: "user",
      content: sanitizedMessage,
    });

    // Get conversation history
    const history = await db.getMessagesByConversation(convId);

    // Vehicle detection
    const allVehiclesForDetection = await db.getAllVehicles();
    // Augment message with vehicleContext from URL (e.g., visitor came from vehicle
    // detail page) so detection can resolve ambiguous questions to the car the
    // visitor was viewing, even if their message doesn't name it explicitly.
    const messageForDetection = typeof vehicleContext === "string" && vehicleContext
      ? `[當前查看的車：${vehicleContext}] ${sanitizedMessage}`
      : sanitizedMessage;
    const detectionWeb = detectVehicleFromMessage(messageForDetection, allVehiclesForDetection);
    const customerIntentsWeb = detectCustomerIntents(sanitizedMessage);
    const targetVehiclePromptWeb = buildTargetVehiclePrompt(detectionWeb, sanitizedMessage, conversation.customerContact);
    const intentInstructionsWeb = buildIntentInstructions(customerIntentsWeb, sanitizedMessage, "人客", conversation.customerContact, detectionWeb.vehicle);
    const phoneAskInstructionWeb = buildPhoneAskInstruction({
      channel,
      leadScore: conversation.leadScore,
      customerContact: conversation.customerContact,
      recentMessages: history.map(m => ({ role: m.role, content: m.content })),
    });

    // Build system prompt
    const vehicleKB = allVehiclesForDetection
      .map((v) => {
        const parts = [
          `【${v.brand} ${v.model}】`,
          `售價：${v.priceDisplay || (v.price ? v.price + "萬" : "電洽")}`,
          `年份：${v.modelYear}年`,
          v.color ? `顏色：${v.color}` : "",
          v.mileage ? `里程：${v.mileage}` : "",
          v.displacement ? `排氣量：${v.displacement}` : "",
          v.transmission ? `變速箱：${v.transmission}` : "",
          v.fuelType ? `燃料：${v.fuelType}` : "",
          v.bodyType ? `車型：${v.bodyType}` : "",
          v.features ? `配備：${v.features}` : "",
          v.guarantees ? `保證：${v.guarantees}` : "",
          v.description ? `描述：${v.description}` : "",
          `車輛ID：${v.id}`,
        ]
          .filter(Boolean)
          .join("\n");
        return parts;
      })
      .join("\n\n---\n\n");

    const systemPrompt = `你是崑家汽車的AI智能客服助理。
- 你的角色：開場助理，協助客人了解我們的車輛，留下聯絡方式
- 說話風格：親切、自然、簡潔，像在跟朋友聊天一樣
- 立場：我們是高雄市三民區的中古車行，賣的是精心挑選過的二手車

## 聯絡資訊
- 預約賞車電話：${SHOP_PHONE} ${SHOP_CONTACT_PERSON}
- LINE 官方帳號：${SHOP_LINE_ID}
- 地址：${SHOP_ADDRESS}
- Google 地圖：${SHOP_MAP_URL}
- 營業時間：${SHOP_HOURS}

## 在售車輛資料庫

${vehicleKB}

## 🔒🔒🔒 庫存鎖（絕對不可違反）🔒🔒🔒
我們**只有**下列 ${allVehiclesForDetection.length} 台車。**禁止**提及、推薦、報價任何不在此清單的車款：

${allVehiclesForDetection.map((v, i) => `  ${i + 1}. ${v.brand} ${v.model}`).join("\n")}

## 一般回答規則
- 一律使用繁體中文
- 每次回覆控制在80字以內，簡潔有力
- 🔴 你是「二手車行」，只賣上方「在售車輛」清單上的車！
- 🔴 你是「開場助理」，回答重點就好，留空間給真人業務接手！
- 問價格就直接報價
- 客人一則訊息問多件事時，每個子問題都要回答，不可只回其中一個
- 只有在對話的第一則訊息打招呼寒暄；對話進行中不要重複打招呼
- 推薦車輛時要說出「為什麼這台適合你」的理由
- 如果客戶表現出強烈購買意向，主動提供聯絡方式並建議預約看車

## ❗❗❗ 真人接手機制（非常重要！）❗❗❗
當你確實不知道答案、沒有資料可以回答客人的問題（例如複雜議價、貸款細節、法律保固問題）時：
- 你必須在回覆中加入「[HUMAN_HANDOFF]」標記（客人看不到這個標記）
- 回覆內容要引導客人加官方 LINE（${SHOP_LINE_ID}），語氣自然，例如：「這個問題比較複雜，建議您加我們的LINE官方帳號 ${SHOP_LINE_ID}，我們業務會直接為您服務！」
- 這是網頁聊天，客人離開後不會再回來，所以不要叫他們「稍等」或「等真人回覆」——網頁上沒有真人會即時回覆，一定要主動引導去 LINE

${targetVehiclePromptWeb}${intentInstructionsWeb}${phoneAskInstructionWeb}

## 🔒🔒🔒 事實鎖（絕對禁止違反 — 覆蓋以上所有指令）🔒🔒🔒
**位置事實（只能說這個，不准說其他城市）：**
- 我們「只」在${SHOP_CITY}（${SHOP_ADDRESS}），絕對不可說在其他城市
- 絕對禁止講「台北」「內湖」「新北」「台中」「台南」「桃園」或任何非「${SHOP_CITY}」的地名

**營業類型事實（只能說中古車）：**
- 我們是中古車行，絕對不可使用「新車價」「這是新車」「原廠新車」「我們賣新車」等字眼
- 客人問「有沒有新車」→ 回答「我們只賣中古車，可以看看我們的精選車款」

**報價事實（只能引用上方車輛資料庫）：**
- 價格只能引用上方「在售車輛資料庫」的「售價」欄位，絕不可憑記憶或訓練資料報價`;

    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((m) => {
        // Operator ("real human") replies are stored with role "operator", which
        // convertMessages downstream silently drops (it only passes
        // system/user/assistant). Surface them to the model as assistant turns,
        // tagged so it knows a human already answered and won't contradict them.
        if (m.role === "operator") {
          return { role: "assistant" as const, content: `[真人客服回覆] ${m.content}` };
        }
        return {
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        };
      }),
    ];

    try {
      let fullResponse = "";
      let isHumanHandoff = false;

      // Stream tokens from LLM. The [HUMAN_HANDOFF] marker must never reach the
      // client raw — it's supposed to be invisible to the customer — but tokens
      // arrive in arbitrary chunks that can split the marker across writes. Hold
      // back a small trailing window (shorter than the marker) so a partial
      // marker never gets flushed, then strip the marker once it's fully seen.
      const HANDOFF_MARKER = "[HUMAN_HANDOFF]";
      let pending = "";
      for await (const token of invokeLLMStream({ messages: llmMessages })) {
        fullResponse += token;
        pending += token;

        if (pending.includes(HANDOFF_MARKER)) {
          isHumanHandoff = true;
          pending = pending.split(HANDOFF_MARKER).join("");
        }

        let holdBack = 0;
        const maxHold = Math.min(HANDOFF_MARKER.length - 1, pending.length);
        for (let len = maxHold; len > 0; len--) {
          if (pending.slice(pending.length - len) === HANDOFF_MARKER.slice(0, len)) {
            holdBack = len;
            break;
          }
        }
        const emitLen = pending.length - holdBack;
        if (emitLen > 0) {
          sendSSE("token", pending.slice(0, emitLen));
          pending = pending.slice(emitLen);
        }
      }
      if (pending) {
        sendSSE("token", pending);
      }

      // Check for human handoff (redundant with the in-loop check above, but
      // fullResponse also needs the marker stripped before DB storage/guardrail)
      if (fullResponse.includes("[HUMAN_HANDOFF]")) {
        isHumanHandoff = true;
        fullResponse = fullResponse.replace(/\s*\[HUMAN_HANDOFF\]\s*/g, "").trim();
      }

      // If the model emitted only the [HUMAN_HANDOFF] marker (or nothing at all),
      // the customer would get no bubble. Fall back to a LINE-redirect message and
      // stream it so a bubble appears. Done before guardrail validation so the
      // stored copy goes through the normal path.
      if (fullResponse.trim() === "") {
        fullResponse = `這個問題比較專業，建議您加我們的官方LINE ${SHOP_LINE_ID}，我們業務會直接為您服務！😊`;
        sendSSE("token", fullResponse);
      }

      // Validate output with guardrail
      const allowedPrices: string[] = [];
      for (const v of allVehiclesForDetection) {
        if ((v as any)?.price != null) {
          allowedPrices.push(String((v as any).price));
          allowedPrices.push(`${(v as any).price}萬`);
        }
        if ((v as any)?.priceDisplay) allowedPrices.push(String((v as any).priceDisplay));
      }
      const inventory = allVehiclesForDetection.map((v: any) => `${v.brand} ${v.model}`);
      const guardrail = validateLLMOutput(fullResponse, { allowedPrices, inventory });
      const guardrailMode = getGuardrailMode();

      if (guardrailMode === "enforce" && !guardrail.safe) {
        logger.warn("ChatStream", "🛡️ Guardrail enforced fallback to rule-based reply");
        fullResponse = generateRuleBasedReply({
          userMessage: sanitizedMessage,
          greeting: "人客",
          detection: detectionWeb,
          intents: customerIntentsWeb,
          customerContact: conversation.customerContact,
          leadScore: conversation.leadScore ?? undefined,
        });
        // Re-send as token stream for consistency
        res.write(`event: guardrail-fallback\n`);
        res.write(`data: ${JSON.stringify({ message: fullResponse })}\n\n`);
      } else {
        fullResponse = guardrail.sanitized;
      }

      // Save response to DB
      await db.addMessage({
        conversationId: convId,
        role: "assistant",
        content: fullResponse,
      });

      // Handle human handoff: the reply itself already redirects the customer to
      // official LINE (see the system prompt), so there's no web operator to wait
      // for — don't lock aiDisabled (this endpoint doesn't check it on future
      // messages anyway, so it would only leave misleading state for the admin
      // dashboard) or emit a "handoff" SSE event (the client has no handler for
      // it). Just log it for visibility.
      if (isHumanHandoff) {
        try {
          await db.addAnalyticsEvent({
            conversationId: convId,
            eventCategory: "handoff",
            eventAction: "redirected_to_line",
            eventLabel: sanitizedMessage.slice(0, 100),
            channel: "web",
          });
        } catch (err) {
          logger.error("ChatStream", "Failed to log handoff analytics event:", err);
        }
      }

      // Send completion metadata
      sendSSE("done", {
        conversationId: convId,
        leadScore: conversation.leadScore || 0,
        isHandoff: isHumanHandoff,
      });

      res.end();
    } catch (err: any) {
      logger.error("ChatStream", "LLM streaming error:", err);
      sendSSE(
        "error",
        "抱歉，系統暫時忙碌中。您可以直接撥打 0936-812-818 聯繫賴先生。"
      );
      res.end();
    }
  } catch (err: any) {
    logger.error("ChatStream", "Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
