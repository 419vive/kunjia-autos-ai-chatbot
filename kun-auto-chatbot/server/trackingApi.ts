import { Router, Request, Response } from "express";
import crypto from "crypto";
import { addPageView, updatePageViewDuration } from "./db";
import { createLogger } from "./_core/logger";

const log = createLogger("Tracking");

const trackingRouter = Router();

// ============ USER-AGENT PARSING ============

function parseBrowser(ua: string): string {
  if (/CriOS/i.test(ua)) return "crios";
  if (/EdgA?/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/FBAN|FBAV/i.test(ua)) return "facebook";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/Line\//i.test(ua)) return "LINE";
  if (/SamsungBrowser/i.test(ua)) return "Samsung";
  if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return "chrome";
  if (/Chromium/i.test(ua)) return "chromium-webview";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  if (/Firefox/i.test(ua)) return "Firefox";
  return "other";
}

function parseOS(ua: string): string {
  if (/iPad|iPhone|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android OS";
  if (/Windows NT 10/i.test(ua)) return "Windows 10";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "Mac OS";
  if (/Linux/i.test(ua)) return "Linux";
  if (/CrOS/i.test(ua)) return "Chrome OS";
  return "other";
}

function parseDevice(ua: string, screenWidth?: number): string {
  if (/iPad|Tablet|tab/i.test(ua)) return "tablet";
  if (/Mobile|iPhone|Android.*Mobile/i.test(ua)) return "mobile";
  if (screenWidth && screenWidth <= 768) return "mobile";
  if (screenWidth && screenWidth <= 1024) return "tablet";
  if (/Macintosh|Windows NT|Linux.*X11/i.test(ua)) return "desktop";
  return "desktop";
}

function extractDomain(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Generate a session hash from IP + User-Agent + date (privacy-friendly, no cookies)
function generateSessionHash(ip: string, ua: string): string {
  const date = new Date().toISOString().split("T")[0]; // daily rotation
  const salt = process.env.JWT_SECRET;
  if (!salt) throw new Error("Missing required environment variable: JWT_SECRET");
  return crypto.createHash("sha256").update(`${ip}|${ua}|${date}|${salt}`).digest("hex").slice(0, 16);
}

// ============ TRACKING ENDPOINT ============

// POST /api/track - Record a page view
trackingRouter.post("/api/track", async (req: Request, res: Response) => {
  try {
    const { path, referrer, language, screenWidth, duration, pageViewId } = req.body || {};

    // Update duration for existing page view
    if (pageViewId && duration) {
      await updatePageViewDuration(pageViewId, Math.min(duration, 3600)); // cap at 1 hour
      res.json({ ok: true });
      return;
    }

    if (!path || typeof path !== "string") {
      res.status(400).json({ error: "path required" });
      return;
    }

    const ua = req.headers["user-agent"] || "";
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const sessionHash = generateSessionHash(ip, ua);

    // Basic GeoIP from Accept-Language or CF/Railway headers
    const country = (req.headers["cf-ipcountry"] as string) ||
      (req.headers["x-vercel-ip-country"] as string) || "";
    const region = (req.headers["x-vercel-ip-country-region"] as string) || "";

    const browser = parseBrowser(ua);
    const os = parseOS(ua);
    const device = parseDevice(ua, screenWidth);
    const referrerDomain = extractDomain(referrer);

    // Filter out bot traffic
    if (/bot|crawler|spider|curl|wget|python|java|go-http|node-fetch/i.test(ua)) {
      res.json({ ok: true });
      return;
    }

    // Filter out internal/admin paths from analytics (optional)
    const sanitizedPath = path.slice(0, 512);

    await addPageView({
      sessionHash,
      path: sanitizedPath,
      referrer: referrer?.slice(0, 512) || null,
      referrerDomain: referrerDomain || null,
      browser,
      os,
      device,
      country: country || null,
      region: region || null,
      language: language?.slice(0, 16) || null,
      screenWidth: screenWidth || null,
    });

    res.json({ ok: true, sessionHash });
  } catch (err) {
    log.error("Error recording page view", { error: err });
    res.json({ ok: true }); // Don't fail the client
  }
});

export { trackingRouter };
