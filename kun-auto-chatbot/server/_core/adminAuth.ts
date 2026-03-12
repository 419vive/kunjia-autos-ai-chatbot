import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

const ADMIN_OPEN_ID = "local-admin";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Seed the local admin user in the database on startup.
 * Only runs when ADMIN_PASSWORD is configured.
 */
export async function seedAdminUser() {
  if (!ENV.adminPassword) {
    console.warn("[Auth] ADMIN_PASSWORD not set — admin login disabled");
    return;
  }

  try {
    await db.upsertUser({
      openId: ADMIN_OPEN_ID,
      name: ENV.adminUsername,
      role: "admin",
      loginMethod: "local",
      lastSignedIn: new Date(),
    });
    console.log(`[Auth] Admin user seeded (username: ${ENV.adminUsername})`);
  } catch (err) {
    console.error("[Auth] Failed to seed admin user:", err);
  }
}

/**
 * Register POST /api/auth/login for local admin login.
 */
export function registerAdminAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};

    if (!ENV.adminPassword) {
      res.status(403).json({ error: "Admin login is not configured. Set ADMIN_PASSWORD environment variable." });
      return;
    }

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !safeCompare(username, ENV.adminUsername) ||
      !safeCompare(password, ENV.adminPassword)
    ) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    try {
      const sessionToken = await sdk.createSessionToken(ADMIN_OPEN_ID, {
        name: ENV.adminUsername,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true });
    } catch (err) {
      console.error("[Auth] Login failed:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });
}
