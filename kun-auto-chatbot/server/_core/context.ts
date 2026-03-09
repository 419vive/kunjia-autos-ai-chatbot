import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Simple context without Manus OAuth.
  // For admin endpoints, a local auth mechanism can be added later.
  return {
    req: opts.req,
    res: opts.res,
    user: null,
  };
}
