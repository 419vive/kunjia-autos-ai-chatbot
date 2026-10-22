import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildTargeting,
  buildAdSetName,
  searchGeoLocations,
  searchInterests,
  listCustomAudiences,
} from "./metaTargeting";
import type { MetaAdsConfig } from "./metaAds";

const cfg: MetaAdsConfig = {
  accessToken: "EAAtesttoken1234567890",
  adAccountId: "act_123456",
  pageId: "999",
  pixelId: "936259169015798",
  apiVersion: "v21.0",
};

const KAOHSIUNG = { latitude: 22.6396, longitude: 120.3021, radiusKm: 30 };

describe("buildTargeting — geo", () => {
  it("builds a radius ring", () => {
    const t = buildTargeting({ customLocation: KAOHSIUNG });
    expect((t.geo_locations as any).custom_locations[0]).toEqual({
      latitude: 22.6396,
      longitude: 120.3021,
      radius: 30,
      distance_unit: "kilometer",
    });
  });

  it("builds region keys (縣市層級)", () => {
    const t = buildTargeting({ regionKeys: ["3886", "3887", "3888"] });
    expect((t.geo_locations as any).regions).toEqual([{ key: "3886" }, { key: "3887" }, { key: "3888" }]);
  });

  it("builds a bare city with no radius, and a city ring when a radius is given", () => {
    const t = buildTargeting({ cities: [{ key: "111" }, { key: "222", radiusKm: 25 }] });
    const cities = (t.geo_locations as any).cities;
    expect(cities[0]).toEqual({ key: "111" });
    expect(cities[1]).toEqual({ key: "222", radius: 25, distance_unit: "kilometer" });
  });

  // 「持續抓小範圍…之前範圍比較廣會稍微跑到外縣市，成效非常差」
  it("carves out excluded regions", () => {
    const t = buildTargeting({ regionKeys: ["3886"], excludedRegionKeys: ["9999"] });
    expect((t.excluded_geo_locations as any).regions).toEqual([{ key: "9999" }]);
  });

  it("refuses to build targeting with no geo at all", () => {
    expect(() => buildTargeting({})).toThrow(/at least one of countries/);
  });

  it("rejects an out-of-range radius on either geo shape", () => {
    expect(() => buildTargeting({ customLocation: { ...KAOHSIUNG, radiusKm: 500 } })).toThrow(/radiusKm/);
    expect(() => buildTargeting({ cities: [{ key: "1", radiusKm: 0 }] })).toThrow(/radiusKm/);
  });
});

describe("buildTargeting — demographics", () => {
  it("defaults to 25-65 when unspecified", () => {
    const t = buildTargeting({ customLocation: KAOHSIUNG });
    expect(t.age_min).toBe(25);
    expect(t.age_max).toBe(65);
  });

  it("maps gender to Meta's numeric codes and omits the field for all", () => {
    expect(buildTargeting({ customLocation: KAOHSIUNG, gender: "male" }).genders).toEqual([1]);
    expect(buildTargeting({ customLocation: KAOHSIUNG, gender: "female" }).genders).toEqual([2]);
    expect(buildTargeting({ customLocation: KAOHSIUNG, gender: "all" }).genders).toBeUndefined();
  });

  it("rejects an inverted age range", () => {
    expect(() => buildTargeting({ customLocation: KAOHSIUNG, ageMin: 60, ageMax: 35 })).toThrow(/ageMin/);
  });
});

describe("buildTargeting — audiences", () => {
  it("stacks interests under flexible_spec", () => {
    const t = buildTargeting({ customLocation: KAOHSIUNG, interestIds: ["6003", "6004"] });
    expect(t.flexible_spec).toEqual([{ interests: [{ id: "6003" }, { id: "6004" }] }]);
  });

  it("includes lookalikes and excludes converter lists (排除已填單)", () => {
    const t = buildTargeting({
      customLocation: KAOHSIUNG,
      customAudienceIds: ["LL2pct"],
      excludedCustomAudienceIds: ["already_submitted"],
    });
    expect(t.custom_audiences).toEqual([{ id: "LL2pct" }]);
    expect(t.excluded_custom_audiences).toEqual([{ id: "already_submitted" }]);
  });

  it("excludes interests", () => {
    const t = buildTargeting({ customLocation: KAOHSIUNG, excludedInterestIds: ["6009"] });
    expect((t.exclusions as any).interests).toEqual([{ id: "6009" }]);
  });

  // Advantage+ silently widens the audience, which makes an interest test unreadable.
  it("switches Advantage+ audience OFF by default and ON only when asked", () => {
    expect(buildTargeting({ customLocation: KAOHSIUNG }).targeting_automation).toEqual({
      advantage_audience: 0,
    });
    expect(
      buildTargeting({ customLocation: KAOHSIUNG, advantageAudience: true }).targeting_automation,
    ).toEqual({ advantage_audience: 1 });
  });

  it("passes publisher platforms through when set", () => {
    expect(
      buildTargeting({ customLocation: KAOHSIUNG, publisherPlatforms: ["instagram"] }).publisher_platforms,
    ).toEqual(["instagram"]);
  });

  it("omits every optional block when nothing is specified", () => {
    const t = buildTargeting({ customLocation: KAOHSIUNG });
    for (const key of [
      "flexible_spec", "exclusions", "custom_audiences",
      "excluded_custom_audiences", "excluded_geo_locations", "publisher_platforms",
    ]) {
      expect(t[key]).toBeUndefined();
    }
  });
});

describe("buildAdSetName — 地區｜年齡｜受眾｜檔期", () => {
  it("reproduces a real name from the tracker sheet", () => {
    expect(
      buildAdSetName({ region: "北北中", ageMin: 35, ageMax: 65, audience: "房地產投資", flight: "8/8.8/9場次" }),
    ).toBe("北北中｜35-65+｜房地產投資｜8/8.8/9場次");
  });

  it("renders a closed age range without the plus", () => {
    expect(buildAdSetName({ region: "北北竹", ageMin: 45, ageMax: 64, audience: "房地產>>投資" })).toBe(
      "北北竹｜45-64｜房地產>>投資",
    );
  });

  it("drops the flight segment when there is no campaign window", () => {
    expect(buildAdSetName({ region: "高雄", ageMin: 30, ageMax: 55, audience: "中古車" })).toBe(
      "高雄｜30-55｜中古車",
    );
  });
});

describe("lookups", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const ok = (body: unknown) =>
    ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as unknown as Response;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const lastQuery = () => new URL(String(fetchMock.mock.calls.at(-1)![0])).searchParams;

  it("searches geo locations scoped to the country", async () => {
    fetchMock.mockResolvedValue(ok({ data: [{ key: "3886", name: "Kaohsiung", type: "region" }] }));
    const out = await searchGeoLocations(cfg, "高雄");

    expect(lastQuery().get("type")).toBe("adgeolocation");
    expect(lastQuery().get("country_code")).toBe("TW");
    expect(JSON.parse(lastQuery().get("location_types")!)).toEqual(["region", "city"]);
    expect(out[0]).toMatchObject({ key: "3886", name: "Kaohsiung", type: "region" });
  });

  it("searches interests and surfaces the reach estimate", async () => {
    fetchMock.mockResolvedValue(
      ok({ data: [{ id: "6003", name: "房地產投資", audience_size_upper_bound: 1200000 }] }),
    );
    const out = await searchInterests(cfg, "房地產");

    expect(lastQuery().get("type")).toBe("adinterest");
    expect(out[0]).toMatchObject({ id: "6003", name: "房地產投資", audienceSize: 1200000 });
  });

  it("lists custom audiences from the ad account", async () => {
    fetchMock.mockResolvedValue(ok({ data: [{ id: "1", name: "LL2%", subtype: "LOOKALIKE" }] }));
    const out = await listCustomAudiences(cfg);

    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain("/act_123456/customaudiences");
    expect(out[0]).toMatchObject({ id: "1", name: "LL2%", subtype: "LOOKALIKE" });
  });

  it("returns an empty array rather than throwing when Meta returns no data", async () => {
    fetchMock.mockResolvedValue(ok({}));
    await expect(searchInterests(cfg, "nothing")).resolves.toEqual([]);
  });
});
