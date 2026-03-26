import { Router } from "express";

/**
 * Pixel Agents Event Relay
 *
 * POST /api/pixel-events → store event (from Claude Code hooks)
 * GET  /api/pixel-events/stream → SSE stream (for standalone viewer on Mac)
 */

const router = Router();
const MAX_EVENTS = 200;
const events: any[] = [];
const sseClients = new Set<any>();

// Receive events from Claude Code hooks
router.post("/api/pixel-events", (req, res) => {
  const event = req.body;
  if (!event || !event.type) {
    res.status(400).json({ error: "missing type" });
    return;
  }
  events.push(event);
  if (events.length > MAX_EVENTS) events.shift();

  // Push to all SSE clients
  const data = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(client => client.write(data));

  res.json({ ok: true });
});

// SSE stream for standalone viewer
router.get("/api/pixel-events/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send recent events as initial state
  for (const event of events.slice(-20)) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

export { router as pixelEventsRouter };
