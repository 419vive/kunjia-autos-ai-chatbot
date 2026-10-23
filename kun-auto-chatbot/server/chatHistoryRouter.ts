import express, { Response } from "express";
import { logger } from "./logger";
import * as db from "./db";
import { maskPhone } from "./security";

/**
 * HTTP router for polling chat message history.
 *
 * Supports incremental fetching via `since` parameter for efficient polling.
 * Operator replies are returned alongside AI responses.
 */
export const chatHistoryRouter = express.Router();

/**
 * GET /api/chat/history?sessionId=...&since=...
 *
 * Query params:
 *   sessionId (required): The chat session ID from localStorage
 *   since (optional): ISO timestamp string. If provided, returns only messages created after this time.
 *
 * Response:
 * {
 *   messages: [
 *     { role: "user"|"assistant"|"operator"|"system", content: "..." },
 *     ...
 *   ],
 *   conversation: { id, sessionId, customerName, channel, ... }
 * }
 *
 * Why polling (not WebSocket/SSE):
 * - Simpler: no connection management, reconnect logic
 * - More reliable: works through corporate proxies
 * - Appropriate latency: 3s is fine for customer service
 *
 * Operator replies flow:
 * 1. Operator sends message via tRPC mutation admin.operatorReply
 * 2. Backend stores as role="operator" in messages table
 * 3. Client polls every 3s, fetches new messages via `since` param
 * 4. UI renders operator message with headset icon
 */
chatHistoryRouter.get("/api/chat/history", async (req: express.Request, res: Response) => {
  try {
    const { sessionId, since } = req.query;

    // Validate sessionId
    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "Invalid sessionId" });
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      res.status(400).json({ error: "Invalid sessionId format" });
      return;
    }

    // Get conversation by sessionId
    const conversation = await db.getConversationBySessionId(sessionId);
    if (!conversation) {
      return res.json({ messages: [], conversation: null });
    }

    // Fetch messages
    let messages;
    if (since && typeof since === "string") {
      // Incremental fetch: only messages created after `since`
      try {
        messages = await db.getMessagesByConversationSince(
          conversation.id,
          new Date(since)
        );
      } catch (err) {
        logger.error("ChatHistory", `Invalid since param: ${since}`, err);
        // Fallback to full history if since is invalid
        messages = await db.getMessagesByConversation(conversation.id);
      }
    } else {
      // Full fetch: return all messages
      messages = await db.getMessagesByConversation(conversation.id);
    }

    // Mask PII before sending to client
    const maskedConversation = {
      ...conversation,
      customerContact: conversation.customerContact
        ? maskPhone(conversation.customerContact)
        : null,
    };

    res.json({
      messages: messages || [],
      conversation: maskedConversation,
    });
  } catch (error) {
    logger.error("ChatHistory", "Endpoint error", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
