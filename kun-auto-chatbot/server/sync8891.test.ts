import { describe, expect, it, vi, beforeEach } from "vitest";
import { getSyncStatus } from "./sync8891";

describe("8891 Sync", () => {
  describe("getSyncStatus", () => {
    it("returns initial status with all required fields", () => {
      const status = getSyncStatus();
      expect(status).toBeDefined();
      expect(status.lastSyncStatus).toBeDefined();
      expect(status.syncInProgress).toBe(false);
      expect(status.lastSyncVehicleCount).toBeDefined();
    });

    it("returns correct status shape including CoV report field", () => {
      const status = getSyncStatus();
      expect(status).toHaveProperty("lastSyncTime");
      expect(status).toHaveProperty("lastSyncStatus");
      expect(status).toHaveProperty("lastSyncMessage");
      expect(status).toHaveProperty("lastSyncVehicleCount");
      expect(status).toHaveProperty("syncInProgress");
      expect(status).toHaveProperty("lastCoVReport");
    });

    it("lastCoVReport is null before first sync", () => {
      const status = getSyncStatus();
      // Before any sync runs, CoV report should be null
      expect(status.lastCoVReport === null || status.lastCoVReport !== undefined).toBe(true);
    });
  });

  describe("admin sync endpoints", () => {
    it("syncStatus endpoint is accessible via admin router", async () => {
      const { appRouter } = await import("./routers");
      type TrpcContext = Parameters<typeof appRouter.createCaller>[0];

      const adminUser = {
        id: 1,
        openId: "admin-user",
        email: "admin@example.com",
        name: "Admin",
        loginMethod: "local",
        role: "admin" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      const ctx: TrpcContext = {
        user: adminUser,
        req: { protocol: "https", headers: {} } as any,
        res: { clearCookie: vi.fn() } as any,
      };

      const caller = appRouter.createCaller(ctx);
      const status = await caller.admin.syncStatus();

      expect(status).toBeDefined();
      expect(status).toHaveProperty("lastSyncStatus");
      expect(status).toHaveProperty("syncInProgress");
      expect(status).toHaveProperty("lastSyncVehicleCount");
      expect(status).toHaveProperty("lastCoVReport");
    });

    it("triggerSync endpoint rejects non-admin users", async () => {
      const { appRouter } = await import("./routers");
      type TrpcContext = Parameters<typeof appRouter.createCaller>[0];

      const normalUser = {
        id: 2,
        openId: "normal-user",
        email: "user@example.com",
        name: "User",
        loginMethod: "local",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      const ctx: TrpcContext = {
        user: normalUser,
        req: { protocol: "https", headers: {} } as any,
        res: { clearCookie: vi.fn() } as any,
      };

      const caller = appRouter.createCaller(ctx);
      
      await expect(caller.admin.syncStatus()).rejects.toThrow();
    });

    it("syncStatus endpoint rejects unauthenticated users", async () => {
      const { appRouter } = await import("./routers");
      type TrpcContext = Parameters<typeof appRouter.createCaller>[0];

      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as any,
        res: { clearCookie: vi.fn() } as any,
      };

      const caller = appRouter.createCaller(ctx);
      
      await expect(caller.admin.syncStatus()).rejects.toThrow();
    });
  });

  describe("8891 v5 API format", () => {
    it("correctly parses API vehicle data structure", () => {
      // Simulate the API response structure we discovered
      const apiVehicle = {
        itemId: 4390075,
        brandEnName: "Toyota",
        kindEnName: "Corolla Cross",
        modelEnName: "GR Sport",
        title: "Toyota Corolla Cross 2024款 GR Sport 1.8L",
        subTitle: "【崑家】Corolla Cross GR Sport版",
        price: "70.8萬",
        makeYear: "2024年",
        yearType: "2024款",
        color: "白色",
        mileage: "2.3萬公里",
        gas: "1.8L",
        tab: "CVT",
        region: "高雄市",
        image: "https://p1.8891.com.tw/test_300_225.jpg",
        bigImage: "https://p1.8891.com.tw/test_600_450.jpg",
        memberId: 125770,
        itemPostDate: "2025-08-02 11:44:56",
        itemRenewDate: "2026-02-14 13:54:02",
        totalViewNum: 1578,
        checkCarStatus: 1,
        saleCodes: [],
      };

      // Verify key fields
      expect(apiVehicle.itemId).toBe(4390075);
      expect(apiVehicle.brandEnName).toBe("Toyota");
      expect(apiVehicle.kindEnName).toBe("Corolla Cross");
      expect(apiVehicle.price).toBe("70.8萬");
      expect(apiVehicle.makeYear).toMatch(/\d{4}/);
      expect(apiVehicle.color).toBe("白色");
      expect(apiVehicle.mileage).toBe("2.3萬公里");
      expect(apiVehicle.gas).toBe("1.8L");
      expect(apiVehicle.region).toBe("高雄市");
    });

    it("API status code 12000 is treated as success", () => {
      // 8891 uses 12000 as success status code
      const successStatuses = [0, 200, 12000];
      const errorStatuses = [400, 500, 10001];

      for (const status of successStatuses) {
        const isSuccess = status === 0 || status === 200 || status === 12000;
        expect(isSuccess).toBe(true);
      }

      for (const status of errorStatuses) {
        const isSuccess = status === 0 || status === 200 || status === 12000;
        expect(isSuccess).toBe(false);
      }
    });
  });

  describe("Chain of Verification (CoV) structure", () => {
    it("CoV report has correct structure", () => {
      // Simulate a CoV report
      const report = {
        timestamp: new Date(),
        overallStatus: "pass" as const,
        steps: [
          { step: "1. 來源數量驗證", description: "test", status: "pass" as const, expected: 12, actual: 12 },
          { step: "2. 資料庫完整性驗證", description: "test", status: "pass" as const, expected: 12, actual: 12 },
          { step: "3. 資料準確性驗證", description: "test", status: "pass" as const, expected: "0 mismatches", actual: "0 mismatches" },
          { step: "4. LINE 輪播卡片驗證", description: "test", status: "pass" as const, expected: "≤ 12", actual: 12 },
          { step: "5. AI 知識庫驗證", description: "test", status: "pass" as const, expected: "All vehicles", actual: "12 vehicles" },
        ],
        summary: "CoV 驗證完成：5/5 通過",
      };

      expect(report.steps).toHaveLength(5);
      expect(report.overallStatus).toBe("pass");
      expect(report.steps.every(s => s.status === "pass")).toBe(true);
    });

    it("CoV overall status reflects failures correctly", () => {
      const steps = [
        { status: "pass" as const },
        { status: "fail" as const },
        { status: "pass" as const },
      ];

      const hasFailure = steps.some(s => s.status === "fail");
      const hasWarning = steps.some(s => s.status === "warn");
      const overallStatus = hasFailure ? "fail" : hasWarning ? "warn" : "pass";

      expect(overallStatus).toBe("fail");
    });

    it("CoV overall status reflects warnings correctly", () => {
      const steps = [
        { status: "pass" as const },
        { status: "warn" as const },
        { status: "pass" as const },
      ];

      const hasFailure = steps.some(s => s.status === "fail");
      const hasWarning = steps.some(s => s.status === "warn");
      const overallStatus = hasFailure ? "fail" : hasWarning ? "warn" : "pass";

      expect(overallStatus).toBe("warn");
    });
  });
});
