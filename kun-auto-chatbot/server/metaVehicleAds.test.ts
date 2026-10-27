import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildVehicleCreativeSpec, launchVehicleAd } from "./metaVehicleAds";
import type { MetaAdsConfig } from "./metaAds";

const cfg: MetaAdsConfig = {
  accessToken: "EAAtesttoken1234567890",
  adAccountId: "act_123456",
  pageId: "999",
  pixelId: "936259169015798",
  apiVersion: "v21.0",
};

describe("buildVehicleCreativeSpec", () => {
  const vehicle = {
    id: 28,
    brand: "Hyundai",
    model: "Mufasa 2.0 GLC旗艦版",
    modelYear: "2023",
    mileage: "1.2萬公里",
    price: "80.9",
    priceDisplay: "80.9萬",
  };

  it("builds the landing link from the vehicle id", () => {
    expect(buildVehicleCreativeSpec(vehicle, "https://kuncar.tw").link).toBe("https://kuncar.tw/vehicle/28");
  });

  it("does not double the slash when baseUrl has a trailing one", () => {
    expect(buildVehicleCreativeSpec(vehicle, "https://kuncar.tw/").link).toBe("https://kuncar.tw/vehicle/28");
  });

  it("puts year, brand and model in the headline", () => {
    const spec = buildVehicleCreativeSpec(vehicle, "https://kuncar.tw");
    expect(spec.headline).toContain("2023");
    expect(spec.headline).toContain("Hyundai");
    expect(spec.headline).toContain("Mufasa 2.0 GLC旗艦版");
  });

  // FACT_LOCK: ad copy is customer-facing, so the same shop-fact rules apply.
  it("uses the real shop city and phone, never invented ones", () => {
    const spec = buildVehicleCreativeSpec(vehicle, "https://kuncar.tw");
    expect(spec.message).toContain("高雄");
    expect(spec.message).toContain("0936-812-818");
    expect(spec.message).not.toMatch(/台北|台中|新車/);
  });

  it("never renders undefined/null/NaN as a price", () => {
    const spec = buildVehicleCreativeSpec(
      { ...vehicle, price: null, priceDisplay: null },
      "https://kuncar.tw",
    );
    expect(spec.headline).not.toMatch(/undefined|null|NaN/);
    expect(spec.message).not.toMatch(/undefined|null|NaN/);
  });

  it("omits the mileage separator when mileage is missing", () => {
    const spec = buildVehicleCreativeSpec({ ...vehicle, mileage: null }, "https://kuncar.tw");
    expect(spec.message).not.toContain("｜\n");
  });
});


describe("launchVehicleAd", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const ok = (body: unknown) =>
    ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as unknown as Response;

  const vehicle = {
    id: 28, brand: "Hyundai", model: "Mufasa 2.0 GLC旗艦版",
    modelYear: "2023", mileage: "1.2萬公里", price: "80.9", priceDisplay: "80.9萬",
  };

  const opts = {
    imageUrl: "https://kuncar.tw/car.jpg",
    baseUrl: "https://kuncar.tw",
    dailyBudgetMinor: 50_000,
    targeting: { regionKeys: ["3886"], ageMin: 35, ageMax: 65 },
    naming: { region: "高雄", audience: "中古車 家庭用車", flight: "9月檔" },
  };

  beforeEach(() => {
    fetchMock = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/campaigns")) return ok({ id: "camp1" });
      if (u.includes("/adsets")) return ok({ id: "set1" });
      if (u.includes("/adimages")) return { ok: true, status: 200, json: async () => ({ images: { f: { hash: "h1" } } }) } as unknown as Response;
      if (u.includes("/adcreatives")) return ok({ id: "cr1" });
      if (u.includes("/ads")) return ok({ id: "ad1" });
      // the creative-image download
      return { ok: true, status: 200, blob: async () => new Blob(["x"]) } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds the whole stack and reports it inactive", async () => {
    const res = await launchVehicleAd(cfg, vehicle, opts);
    expect(res).toMatchObject({
      campaignId: "camp1", adsetId: "set1", creativeId: "cr1", adId: "ad1", active: false,
    });
  });

  it("names the ad set with the tracker convention", async () => {
    const res = await launchVehicleAd(cfg, vehicle, opts);
    expect(res.adsetName).toBe("高雄｜35-65+｜中古車 家庭用車｜9月檔");
  });

  // The safety contract end-to-end: no object in the stack may be created live.
  it("creates every object PAUSED", async () => {
    await launchVehicleAd(cfg, vehicle, opts);

    const statuses = fetchMock.mock.calls
      .filter(([, init]: any) => init?.body instanceof URLSearchParams || typeof init?.body === "object")
      .map(([, init]: any) => new URLSearchParams(String(init.body)).get("status"))
      .filter((s): s is string => s !== null);

    expect(statuses.length).toBeGreaterThanOrEqual(3);
    expect(statuses.every((s) => s === "PAUSED")).toBe(true);
    expect(statuses).not.toContain("ACTIVE");
  });
});
