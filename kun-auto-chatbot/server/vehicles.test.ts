import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "這是一台很棒的車！歡迎預約看車。" } }],
  }),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock global fetch to prevent LINE API calls from timing out in tests
const originalFetch = globalThis.fetch;
vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, ...args: any[]) => {
  // Mock LINE API calls
  if (typeof url === 'string' && url.includes('api.line.me')) {
    return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
  }
  // Pass through other fetch calls
  return originalFetch(url, ...args);
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@test.com",
      name: "Admin",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("vehicle.list", () => {
  it("returns an array of vehicles", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const vehicles = await caller.vehicle.list();
    expect(Array.isArray(vehicles)).toBe(true);
    // We seeded 12 vehicles
    expect(vehicles.length).toBeGreaterThanOrEqual(1);
  });

  it("each vehicle has required fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const vehicles = await caller.vehicle.list();
    if (vehicles.length > 0) {
      const v = vehicles[0];
      expect(v).toHaveProperty("id");
      expect(v).toHaveProperty("brand");
      expect(v).toHaveProperty("model");
      expect(v).toHaveProperty("price");
      expect(v).toHaveProperty("status");
    }
  });
});

describe("vehicle.brands", () => {
  it("returns brand list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const brands = await caller.vehicle.brands();
    expect(Array.isArray(brands)).toBe(true);
    expect(brands.length).toBeGreaterThanOrEqual(1);
  });
});

describe("vehicle.search", () => {
  it("filters by brand", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const results = await caller.vehicle.search({ brand: "Toyota" });
    expect(Array.isArray(results)).toBe(true);
    for (const v of results) {
      expect(v.brand.toLowerCase()).toContain("toyota");
    }
  });

  it("filters by query text", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const results = await caller.vehicle.search({ query: "SUV" });
    expect(Array.isArray(results)).toBe(true);
  });
});

describe("vehicle.getById", () => {
  it("returns a vehicle by id", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const vehicles = await caller.vehicle.list();
    if (vehicles.length > 0) {
      const vehicle = await caller.vehicle.getById({ id: vehicles[0].id });
      expect(vehicle).toBeDefined();
      expect(vehicle?.id).toBe(vehicles[0].id);
    }
  });
});

describe("chat.send", () => {
  it("returns a response with lead scoring", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-${Date.now()}`;
    
    const result = await caller.chat.send({
      sessionId,
      message: "你好，我想看看有什麼車",
      channel: "web",
    });
    
    expect(result).toHaveProperty("response");
    expect(typeof result.response).toBe("string");
    expect(result.response.length).toBeGreaterThan(0);
    expect(result).toHaveProperty("leadScore");
    expect(result).toHaveProperty("conversationId");
  });

  it("scores purchase intent messages higher", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-intent-${Date.now()}`;
    
    const result = await caller.chat.send({
      sessionId,
      message: "我想買一台SUV，預算大概50萬，可以預約看車嗎？",
      channel: "web",
    });
    
    expect(result.leadScore).toBeGreaterThan(0);
    expect(result.scoringEvents.length).toBeGreaterThan(0);
  });
});

describe("chat.history", () => {
  it("returns empty for new session", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.chat.history({
      sessionId: `nonexistent-${Date.now()}`,
    });
    
    expect(result.messages).toEqual([]);
    expect(result.conversation).toBeNull();
  });
});

describe("admin.dashboard", () => {
  it("requires admin auth", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.admin.dashboard({})).rejects.toThrow();
  });

  it("returns stats for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.admin.dashboard({});
    expect(result).toHaveProperty("stats");
    expect(result).toHaveProperty("vehicleCount");
    expect(result.vehicleCount).toBeGreaterThanOrEqual(1);
  });
});

describe("admin.conversations", () => {
  it("requires admin auth", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.admin.conversations({})).rejects.toThrow();
  });

  it("returns conversation list for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.admin.conversations({});
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });
});
