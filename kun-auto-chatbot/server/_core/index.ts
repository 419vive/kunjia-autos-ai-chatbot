import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { lineRouter } from "../lineWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startSyncScheduler } from "../sync8891";
import { RATE_LIMIT_CONFIG, logSecurityEvent } from "../security";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";

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
    console.warn("[Database] DATABASE_URL not set, skipping migrations");
    return;
  }
  try {
    console.log("[Database] Running migrations...");
    const db = drizzle(process.env.DATABASE_URL);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[Database] Migrations completed successfully");
  } catch (error) {
    console.error("[Database] Migration failed:", error);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ============================================================
  // SECURITY LAYER 1: HTTP Security Headers (Helmet)
  // OWASP A05:2021 – Security Misconfiguration
  // ============================================================
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Vite HMR in dev
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
  }));

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

  // Apply rate limiters
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

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Run database migrations before starting
  await runMigrations();

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log("[Security] All security layers active: Helmet, Rate Limiting, PII Protection");
    // Start 8891 auto-sync scheduler (every 6 hours)
    startSyncScheduler(6);
  });
}

startServer().catch(console.error);
