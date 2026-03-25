import { COOKIE_NAME } from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/** Synthetic admin user injected when DANGEROUSLY_SKIP_PERMISSIONS is enabled */
const BYPASS_ADMIN_USER: User = {
  id: 0,
  openId: "dev-bypass",
  name: "Dev Bypass Admin",
  email: null,
  loginMethod: "bypass",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  if (ENV.dangerouslySkipPermissions) {
    return { req: opts.req, res: opts.res, user: BYPASS_ADMIN_USER };
  }

  let user: User | null = null;

  try {
    const cookieHeader = opts.req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const sessionCookie = cookies[COOKIE_NAME];
      if (sessionCookie) {
        const session = await sdk.verifySession(sessionCookie);
        if (session) {
          const dbUser = await db.getUserByOpenId(session.openId);
          user = dbUser ?? null;
        }
      }
    }
  } catch (err) {
    // Session verification failed — continue as unauthenticated
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
