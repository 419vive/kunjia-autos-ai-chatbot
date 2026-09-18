import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeAdAccountId,
  loadMetaAdsConfig,
  redactToken,
  parseMetaError,
  MetaApiError,
  toMinorUnits,
  assertBudgetSane,
  DAILY_BUDGET_CEILING_MINOR,
  createCampaign,
  createAdSet,
  createAd,
  metaGraph,
  type MetaAdsConfig,
} from "./metaAds";

const cfg: MetaAdsConfig = {
  accessToken: "EAAtesttoken1234567890",
  adAccountId: "act_123456",
  pageId: "999",
  pixelId: "936259169015798",
  apiVersion: "v21.0",
};

describe("normalizeAdAccountId", () => {
  it("adds the act_ prefix when missing", () => {
    expect(normalizeAdAccountId("123456")).toBe("act_123456");
  });
  it("leaves an already-prefixed id alone", () => {
    expect(normalizeAdAccountId("act_123456")).toBe("act_123456");
  });
  it("trims whitespace pasted from Ads Manager", () => {
    expect(normalizeAdAccountId("  act_123456 ")).toBe("act_123456");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeAdAccountId("")).toBe("");
  });
});

describe("loadMetaAdsConfig", () => {
  const full = {
    META_ACCESS_TOKEN: "tok",
    META_AD_ACCOUNT_ID: "123",
    META_PAGE_ID: "456",
    META_PIXEL_ID: "789",
  } as NodeJS.ProcessEnv;

  it("returns a normalized config when everything is present", () => {
    const out = loadMetaAdsConfig(full);
    expect(out).not.toBeNull();
    expect(out!.adAccountId).toBe("act_123");
    expect(out!.apiVersion).toBe("v21.0");
  });

  it("honours META_API_VERSION override", () => {
    expect(loadMetaAdsConfig({ ...full, META_API_VERSION: "v23.0" })!.apiVersion).toBe("v23.0");
  });

  // The server must boot fine on a machine that has no Meta credentials.
  it.each(["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID", "META_PIXEL_ID"])(
    "returns null when %s is missing",
    (key) => {
      const partial = { ...full };
      delete partial[key];
      expect(loadMetaAdsConfig(partial)).toBeNull();
    },
  );

  it("treats a whitespace-only token as missing", () => {
    expect(loadMetaAdsConfig({ ...full, META_ACCESS_TOKEN: "   " })).toBeNull();
  });
});

describe("redactToken", () => {
  it("keeps only the head and tail", () => {
    expect(redactToken("EAAtesttoken1234567890")).toBe("EAAt...7890");
  });
  it("fully masks short strings", () => {
    expect(redactToken("abc")).toBe("***");
  });
  it("never contains the full token", () => {
    const tok = "EAAsupersecretvalue999";
    expect(redactToken(tok)).not.toContain("supersecret");
  });
});

describe("parseMetaError", () => {
  it("prefers the user-facing message when Meta supplies one", () => {
    const err = parseMetaError(
      { error: { message: "internal", error_user_msg: "廣告帳號已停用", code: 100, error_subcode: 33, type: "OAuthException", fbtrace_id: "AbC" } },
      400,
    );
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err.message).toBe("廣告帳號已停用");
    expect(err.code).toBe(100);
    expect(err.subcode).toBe(33);
    expect(err.fbtraceId).toBe("AbC");
    expect(err.httpStatus).toBe(400);
  });

  it("falls back to error.message", () => {
    expect(parseMetaError({ error: { message: "Invalid parameter" } }, 400).message).toBe("Invalid parameter");
  });

  it("handles a body with no error envelope", () => {
    expect(parseMetaError(null, 500).message).toBe("Meta API HTTP 500");
  });
});

describe("toMinorUnits", () => {
  it("converts using the account's own offset", () => {
    expect(toMinorUnits(500, 2)).toBe(50_000);
    expect(toMinorUnits(500, 0)).toBe(500);
  });
  it("rounds rather than truncating", () => {
    expect(toMinorUnits(10.005, 2)).toBe(1001);
  });
  it("rejects non-positive amounts", () => {
    expect(() => toMinorUnits(0, 2)).toThrow(RangeError);
    expect(() => toMinorUnits(-5, 2)).toThrow(RangeError);
  });
  // A guessed offset is the 100x-overspend bug this guard exists to stop.
  it("rejects an implausible offset", () => {
    expect(() => toMinorUnits(500, 9)).toThrow(/implausible currency_offset/);
    expect(() => toMinorUnits(500, -1)).toThrow(RangeError);
  });
});

describe("assertBudgetSane", () => {
  it("accepts a normal daily budget", () => {
    expect(() => assertBudgetSane(50_000)).not.toThrow();
  });
  it("rejects zero, negative and non-integer budgets", () => {
    expect(() => assertBudgetSane(0)).toThrow(RangeError);
    expect(() => assertBudgetSane(-1)).toThrow(RangeError);
    expect(() => assertBudgetSane(1.5)).toThrow(RangeError);
  });
  it("blocks a budget above the safety ceiling", () => {
    expect(() => assertBudgetSane(DAILY_BUDGET_CEILING_MINOR + 1)).toThrow(/safety ceiling/);
  });
  it("allows an over-ceiling budget only with the explicit opt-in", () => {
    expect(() => assertBudgetSane(DAILY_BUDGET_CEILING_MINOR + 1, true)).not.toThrow();
  });
});

describe("Graph transport + create calls", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const ok = (body: unknown) =>
    ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as unknown as Response;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const lastBody = () => new URLSearchParams(String(fetchMock.mock.calls.at(-1)![1].body));

  it("throws a MetaApiError carrying Meta's own message on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: "Unsupported post request", code: 100 } }),
    } as unknown as Response);

    await expect(metaGraph(cfg, "act_123456/campaigns", { method: "POST" })).rejects.toThrow(
      "Unsupported post request",
    );
  });

  it("sends the token in the body for POSTs, not the URL", async () => {
    fetchMock.mockResolvedValue(ok({ id: "c1" }));
    await createCampaign(cfg, { name: "test", objective: "OUTCOME_LEADS" });

    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(String(url)).not.toContain(cfg.accessToken);
    expect(String(init.body)).toContain(cfg.accessToken);
  });

  // The safety contract: nothing this module builds may start spending.
  it("creates campaigns PAUSED", async () => {
    fetchMock.mockResolvedValue(ok({ id: "c1" }));
    await expect(createCampaign(cfg, { name: "t", objective: "OUTCOME_LEADS" })).resolves.toBe("c1");
    expect(lastBody().get("status")).toBe("PAUSED");
  });

  it("creates ads PAUSED", async () => {
    fetchMock.mockResolvedValue(ok({ id: "a1" }));
    await createAd(cfg, { name: "t", adsetId: "s1", creativeId: "cr1" });
    expect(lastBody().get("status")).toBe("PAUSED");
  });

  it("creates ad sets PAUSED and attaches the pixel as promoted_object", async () => {
    fetchMock.mockResolvedValue(ok({ id: "s1" }));
    await createAdSet(cfg, {
      campaignId: "c1",
      name: "t",
      dailyBudgetMinor: 50_000,
      radius: { latitude: 22.63, longitude: 120.3, radiusKm: 30 },
    });

    const body = lastBody();
    expect(body.get("status")).toBe("PAUSED");
    expect(JSON.parse(body.get("promoted_object")!)).toEqual({
      pixel_id: cfg.pixelId,
      custom_event_type: "LEAD",
    });
  });

  it("JSON-encodes nested targeting", async () => {
    fetchMock.mockResolvedValue(ok({ id: "s1" }));
    await createAdSet(cfg, {
      campaignId: "c1",
      name: "t",
      dailyBudgetMinor: 50_000,
      radius: { latitude: 22.63, longitude: 120.3, radiusKm: 30 },
    });

    const targeting = JSON.parse(lastBody().get("targeting")!);
    expect(targeting.geo_locations.custom_locations[0]).toMatchObject({
      radius: 30,
      distance_unit: "kilometer",
    });
  });

  it("rejects an out-of-range radius before calling Meta", async () => {
    await expect(
      createAdSet(cfg, {
        campaignId: "c1",
        name: "t",
        dailyBudgetMinor: 50_000,
        radius: { latitude: 22.63, longitude: 120.3, radiusKm: 500 },
      }),
    ).rejects.toThrow(/radiusKm/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an over-ceiling budget before calling Meta", async () => {
    await expect(
      createAdSet(cfg, {
        campaignId: "c1",
        name: "t",
        dailyBudgetMinor: DAILY_BUDGET_CEILING_MINOR + 1,
        radius: { latitude: 22.63, longitude: 120.3, radiusKm: 30 },
      }),
    ).rejects.toThrow(/safety ceiling/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createAdSet — playbook controls", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const ok = (body: unknown) =>
    ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as unknown as Response;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(ok({ id: "s1" }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const lastBody = () => new URLSearchParams(String(fetchMock.mock.calls.at(-1)![1].body));
  const base = { campaignId: "c1", name: "t", dailyBudgetMinor: 50_000 };

  it("passes a full targeting spec straight through", async () => {
    await createAdSet(cfg, {
      ...base,
      targeting: {
        regionKeys: ["3886"],
        interestIds: ["6003"],
        customAudienceIds: ["LL2pct"],
        excludedCustomAudienceIds: ["already_submitted"],
        gender: "female",
      },
      ageMin: 35,
      ageMax: 65,
    });

    const t = JSON.parse(lastBody().get("targeting")!);
    expect(t.geo_locations.regions).toEqual([{ key: "3886" }]);
    expect(t.flexible_spec).toEqual([{ interests: [{ id: "6003" }] }]);
    expect(t.custom_audiences).toEqual([{ id: "LL2pct" }]);
    expect(t.excluded_custom_audiences).toEqual([{ id: "already_submitted" }]);
    expect(t.genders).toEqual([2]);
    expect(t.age_min).toBe(35);
    expect(t.age_max).toBe(65);
    expect(t.targeting_automation).toEqual({ advantage_audience: 0 });
  });

  it("still accepts the radius shorthand", async () => {
    await createAdSet(cfg, { ...base, radius: { latitude: 22.63, longitude: 120.3, radiusKm: 30 } });
    const t = JSON.parse(lastBody().get("targeting")!);
    expect(t.geo_locations.custom_locations[0].radius).toBe(30);
  });

  it("rejects passing both targeting and radius", async () => {
    await expect(
      createAdSet(cfg, {
        ...base,
        targeting: { regionKeys: ["3886"] },
        radius: { latitude: 22.63, longitude: 120.3, radiusKm: 30 },
      }),
    ).rejects.toThrow(/either targeting or radius/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects passing neither", async () => {
    await expect(createAdSet(cfg, base)).rejects.toThrow(/needs targeting or radius/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the CPA cost cap (控價) when one is set", async () => {
    await createAdSet(cfg, {
      ...base,
      targeting: { regionKeys: ["3886"] },
      bidStrategy: "COST_CAP",
      bidAmountMinor: 150_000,
    });
    expect(lastBody().get("bid_strategy")).toBe("COST_CAP");
    expect(lastBody().get("bid_amount")).toBe("150000");
  });

  // A cost cap with no amount degrades to default bidding — the opposite of 控價.
  it("refuses a cost cap with no amount", async () => {
    await expect(
      createAdSet(cfg, { ...base, targeting: { regionKeys: ["3886"] }, bidStrategy: "COST_CAP" }),
    ).rejects.toThrow(/requires bidAmountMinor/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies the same safety ceiling to the bid amount as to the budget", async () => {
    await expect(
      createAdSet(cfg, {
        ...base,
        targeting: { regionKeys: ["3886"] },
        bidStrategy: "COST_CAP",
        bidAmountMinor: DAILY_BUDGET_CEILING_MINOR + 1,
      }),
    ).rejects.toThrow(/safety ceiling/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omits bid fields entirely when no strategy is chosen", async () => {
    await createAdSet(cfg, { ...base, targeting: { regionKeys: ["3886"] } });
    expect(lastBody().get("bid_strategy")).toBeNull();
    expect(lastBody().get("bid_amount")).toBeNull();
  });
});
