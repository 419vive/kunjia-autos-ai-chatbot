import "dotenv/config";
import express from "express";
import { logger } from "../logger";
import { createServer } from "http";
import net from "net";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { lineRouter } from "../lineWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startSyncScheduler, sync8891 } from "../sync8891";
import { deployRichMenu } from "../lineRichMenu";
import { RATE_LIMIT_CONFIG, logSecurityEvent } from "../security";
import { trackingRouter } from "../trackingApi";
import { pixelEventsRouter } from "../pixelEventsRelay";
import { registerAdminAuthRoutes, seedAdminUser } from "./adminAuth";
import { createSeoRouter } from "../seo";
import mysql from "mysql2/promise";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    logger.warn("Database", "DATABASE_URL not set, skipping migrations");
    return;
  }
  let conn: mysql.Connection | null = null;
  try {
    logger.info("Database", "Running migrations...");
    conn = await mysql.createConnection(process.env.DATABASE_URL);

    // Create tables if they don't exist
    await conn.execute(`CREATE TABLE IF NOT EXISTS users (
      id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
      openId varchar(64) NOT NULL UNIQUE,
      name text,
      email varchar(320),
      loginMethod varchar(64),
      role enum('user','admin') NOT NULL DEFAULT 'user',
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignedIn timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS vehicles (
      id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
      externalId varchar(32) NOT NULL UNIQUE,
      sourceUrl text, title text, brand varchar(64) NOT NULL, model varchar(128) NOT NULL,
      modelYear varchar(8), manufactureYear varchar(8), color varchar(32),
      price decimal(10,1), priceDisplay varchar(32), mileage varchar(32),
      displacement varchar(32), transmission varchar(32), fuelType varchar(32),
      bodyType varchar(32), licenseDate varchar(16), location varchar(64),
      description text, features text, guarantees text, photoUrls text,
      photoCount int DEFAULT 0,
      status enum('available','sold','reserved') NOT NULL DEFAULT 'available',
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS conversations (
      id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
      sessionId varchar(64) NOT NULL UNIQUE,
      customerName varchar(128), customerContact varchar(256),
      channel enum('web','line','facebook','youtube','other') NOT NULL DEFAULT 'web',
      status enum('active','closed','follow_up') NOT NULL DEFAULT 'active',
      leadScore int DEFAULT 0,
      leadStatus enum('new','qualified','hot','converted','lost') NOT NULL DEFAULT 'new',
      tags text, summary text, interestedVehicleIds text, notifiedOwner int DEFAULT 0,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS messages (
      id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
      conversationId int NOT NULL,
      role enum('user','assistant','system') NOT NULL,
      content text NOT NULL, metadata text,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS leadEvents (
      id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
      conversationId int NOT NULL,
      eventType varchar(64) NOT NULL,
      scoreChange int NOT NULL, reason text,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS analyticsEvents (
      id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
      conversationId int,
      userId varchar(64),
      eventCategory varchar(32) NOT NULL,
      eventAction varchar(128) NOT NULL,
      eventLabel varchar(256),
      channel enum('web','line','facebook','youtube','other') NOT NULL DEFAULT 'line',
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS pageViews (
      id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
      sessionHash varchar(64) NOT NULL,
      path varchar(512) NOT NULL,
      referrer varchar(512),
      referrerDomain varchar(256),
      browser varchar(64),
      os varchar(64),
      device varchar(32),
      country varchar(64),
      region varchar(128),
      language varchar(16),
      screenWidth int,
      duration int DEFAULT 0,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pageviews_created (createdAt),
      INDEX idx_pageviews_session (sessionHash),
      INDEX idx_pageviews_path (path(191))
    )`);

    logger.info("Database", "Migrations completed successfully");
  } catch (error) {
    logger.error("Database", "Migration failed:", error);
  } finally {
    if (conn) await conn.end();
  }
}

async function startServer() {
  const app = express();
  // Trust Railway's reverse proxy for correct IP detection
  app.set("trust proxy", 1);
  const server = createServer(app);

  // Google Search Console verification — must be FIRST, before any middleware
  app.get("/googlef2e64034e5f53215.html", (_req, res) => {
    res.type("text/html").send("google-site-verification: googlef2e64034e5f53215.html");
  });

  // ============================================================
  // PERFORMANCE: Gzip/Brotli compression for all responses
  // Reduces bandwidth ~70% for HTML, JSON, CSS, JS
  // ============================================================
  app.use(compression({
    level: 6, // Balance between compression ratio and CPU usage
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, _res) => {
      // Don't compress LINE webhook responses (they're small and latency-sensitive)
      if (req.path === "/api/line/webhook") return false;
      return compression.filter(req, _res);
    },
  }));

  // ============================================================
  // PERFORMANCE: gzip/brotli compression for all responses
  // Reduces transfer size by 60-80% for text-based content
  // ============================================================
  app.use(compression());

  // ============================================================
  // SECURITY LAYER 1: HTTP Security Headers (Helmet)
  // OWASP A05:2021 – Security Misconfiguration
  // ============================================================
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: process.env.NODE_ENV === "production"
          ? ["'self'", "'unsafe-inline'"] // unsafe-inline needed for Vite's module preload in LINE in-app browser
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval only for Vite HMR in dev
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"], // Allow external vehicle images
        connectSrc: ["'self'", "https:", "wss:"], // Allow API calls and WebSocket
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow loading external images
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true, // nosniff
    xFrameOptions: { action: "deny" },
    xXssProtection: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  }));

  // Permissions-Policy header for additional security
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=()");
    next();
  });

  // ============================================================
  // SECURITY LAYER 2: Rate Limiting
  // OWASP A04:2021 – Insecure Design (DDoS Protection)
  // ============================================================

  // General API rate limit
  const generalLimiter = rateLimit({
    ...RATE_LIMIT_CONFIG.general,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logSecurityEvent({
        eventType: "rate_limit_hit",
        severity: "medium",
        source: "general_api",
        details: `Rate limit exceeded from IP: ${req.ip}`,
        ip: req.ip,
      });
      res.status(429).json(RATE_LIMIT_CONFIG.general.message);
    },
  });

  // Chat-specific rate limit (stricter)
  const chatLimiter = rateLimit({
    ...RATE_LIMIT_CONFIG.chat,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logSecurityEvent({
        eventType: "rate_limit_hit",
        severity: "medium",
        source: "chat_api",
        details: `Chat rate limit exceeded`,
        ip: req.ip,
      });
      res.status(429).json(RATE_LIMIT_CONFIG.chat.message);
    },
  });

  // LINE webhook rate limit (more generous)
  const lineWebhookLimiter = rateLimit({
    ...RATE_LIMIT_CONFIG.lineWebhook,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Login-specific rate limit (strict: 5 attempts per 15 minutes)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logSecurityEvent({
        eventType: "suspicious_activity",
        severity: "high",
        source: "admin_login",
        details: `Login rate limit exceeded from IP: ${req.ip}`,
        ip: req.ip,
      });
      res.status(429).json({ error: "登入嘗試過於頻繁，請15分鐘後再試。" });
    },
  });

  // Apply rate limiters
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/trpc/chat", chatLimiter);
  app.use("/api/line/webhook", lineWebhookLimiter);
  app.use("/api/", generalLimiter);

  // ============================================================
  // SECURITY LAYER 3: Request Size Limiting
  // Prevent DoS via oversized payloads
  // ============================================================

  // LINE webhook needs raw body for signature verification - must be before json parser
  app.use("/api/line/webhook", express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
    limit: "1mb" // LINE messages are small
  }));
  app.use(lineRouter);

  // Reduced body size limit (was 50mb, now 10mb - still enough for normal operations)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // ============================================================
  // SECURITY LAYER 4: Security Headers for API responses
  // ============================================================
  app.use("/api/", (_req, res, next) => {
    // Prevent caching of API responses containing PII
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  });

  // Admin local auth routes (login endpoint)
  registerAdminAuthRoutes(app);

  // SEO: robots.txt, sitemap.xml (must be before SPA catch-all)
  app.use(createSeoRouter());

  // Page view tracking API (lightweight, no auth required)
  app.use(trackingRouter);

  // Pixel Agents event relay (for remote session → local viewer)
  app.use(pixelEventsRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ============================================================
  // FAST REDIRECT: /line and /contact
  // Server-side device detection + instant redirect (no SPA load needed)
  // This is ~50ms vs ~2-3s for SPA-based redirect
  // ============================================================
  const LINE_OA_URL = "https://page.line.me/825oftez";

  app.get(["/line", "/contact"], (req, res) => {
    const ua = req.headers["user-agent"] || "";
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const redirectUrl = isMobile ? LINE_OA_URL : "/";

    // Return ultra-lightweight HTML that redirects immediately
    // No React, no JS bundle, no waiting — just pure instant redirect
    res.status(200).set({ "Content-Type": "text/html" }).end(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${redirectUrl}">
<title>崑家汽車 — 跳轉中</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1B3A5C;font-family:system-ui,-apple-system,sans-serif;color:#fff}
.c{text-align:center;padding:2rem}
.s{width:2rem;height:2rem;border:3px solid rgba(196,162,101,.3);border-top-color:#C4A265;border-radius:50%;animation:spin .6s linear infinite;margin:0 auto 1rem}
@keyframes spin{to{transform:rotate(360deg)}}
a{color:#C4A265;text-decoration:underline}
</style>
</head>
<body>
<div class="c">
<div class="s"></div>
<p style="font-size:1.1rem;font-weight:600;margin-bottom:.5rem">${isMobile ? "正在開啟 LINE..." : "正在前往崑家汽車官網..."}</p>
<p style="font-size:.8rem;opacity:.5">如未自動跳轉，<a href="${redirectUrl}">請點此</a></p>
</div>
<script>window.location.href="${redirectUrl}"</script>
</body>
</html>`);
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info("Server", `Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Run database migrations before starting
  await runMigrations();

  // Seed admin user if ADMIN_PASSWORD is configured
  await seedAdminUser();

  server.listen(port, () => {
    logger.info("Server", `Server running on http://localhost:${port}/`);
    logger.info("Security", "All security layers active: Helmet, Rate Limiting, PII Protection");
    // Run initial 8891 sync in background (non-blocking) — server handles requests immediately
    logger.info("Sync", "Running initial 8891 vehicle sync (background)...");
    sync8891()
      .then(result => logger.info("Sync", `Initial sync completed: ${result}`))
      .catch(err => logger.error("Sync", "Initial sync failed:", err));
    startSyncScheduler(6);
    // Auto-deploy Rich Menu on startup to keep it in sync with code
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (lineToken) {
      deployRichMenu(lineToken)
        .then(r => logger.info("RichMenu", `Auto-deployed on startup: ${r.richMenuId}`))
        .catch(err => logger.error("RichMenu", "Auto-deploy failed:", err));
    }
  });
}

startServer().catch(err => logger.error("Server", "Fatal startup error:", err));
