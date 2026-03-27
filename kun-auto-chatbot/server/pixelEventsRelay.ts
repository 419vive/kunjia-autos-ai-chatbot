import { Router, Request, Response, NextFunction } from "express";

/**
 * Pixel Agents Event Relay
 *
 * POST /api/pixel-events → store event (from Claude Code hooks)
 * GET  /api/pixel-events/stream → SSE stream (for standalone viewer on Mac)
 *
 * Security: requires X-Pixel-Key header matching PIXEL_EVENTS_KEY env var.
 * If PIXEL_EVENTS_KEY is not set, all endpoints return 503.
 */

const router = Router();
const MAX_EVENTS = 200;
const events: any[] = [];
const sseClients = new Set<any>();

// Auth middleware: require X-Pixel-Key header
function requirePixelKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.PIXEL_EVENTS_KEY;
  if (!configuredKey) {
    res.status(503).json({ error: "pixel events endpoint is disabled" });
    return;
  }
  const providedKey = req.headers["x-pixel-key"];
  if (!providedKey || providedKey !== configuredKey) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

// Receive events from Claude Code hooks
router.post("/api/pixel-events", requirePixelKey, (req, res) => {
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
router.get("/api/pixel-events/stream", requirePixelKey, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Send recent events as initial state
  for (const event of events.slice(-20)) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

export { router as pixelEventsRouter };
