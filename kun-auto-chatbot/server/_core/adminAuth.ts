import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcrypt";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { createLogger } from "./logger";

const log = createLogger("AdminAuth");

const ADMIN_OPEN_ID = "local-admin";
const BCRYPT_ROUNDS = 12;
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// In-memory store for admin password hash (computed once at startup)
let adminPasswordHash: string | null = null;

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Seed the local admin user in the database on startup.
 * Only runs when ADMIN_PASSWORD is configured.
 * Hashes the admin password with bcrypt for secure comparison.
 */
export async function seedAdminUser() {
  if (!ENV.adminPassword) {
    log.warn("ADMIN_PASSWORD not set — admin login disabled");
    return;
  }

  // Pre-hash the admin password at startup so login comparisons use bcrypt
  adminPasswordHash = await bcrypt.hash(ENV.adminPassword, BCRYPT_ROUNDS);

  try {
    await db.upsertUser({
      openId: ADMIN_OPEN_ID,
      name: ENV.adminUsername,
      role: "admin",
      loginMethod: "local",
      lastSignedIn: new Date(),
    });
    log.info(`Admin user seeded (username: ${ENV.adminUsername})`);
  } catch (err) {
    log.error("Failed to seed admin user", { error: err });
  }
}

/**
 * Register POST /api/auth/login for local admin login.
 */
export function registerAdminAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};

    if (!ENV.adminPassword || !adminPasswordHash) {
      res.status(403).json({ error: "Admin login is not configured. Set ADMIN_PASSWORD environment variable." });
      return;
    }

    if (typeof username !== "string" || typeof password !== "string") {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    // Timing-safe username check + bcrypt password verification
    const usernameValid = safeCompare(username, ENV.adminUsername);
    const passwordValid = await bcrypt.compare(password, adminPasswordHash);

    if (!usernameValid || !passwordValid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    try {
      const sessionToken = await sdk.createSessionToken(ADMIN_OPEN_ID, {
        name: ENV.adminUsername,
        expiresInMs: ADMIN_SESSION_TTL_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ADMIN_SESSION_TTL_MS });
      res.json({ success: true });
    } catch (err) {
      log.error("Login failed", { error: err });
      res.status(500).json({ error: "Login failed" });
    }
  });
}
