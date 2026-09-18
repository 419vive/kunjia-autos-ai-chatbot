/**
 * META TARGETING — the audience layer of the agency playbook.
 *
 * Mirrors how ad sets are actually built in the 大表 workflow: city-level geo
 * (北北竹中), interest stacks (房地產投資 / 高爾夫網球 / 企業主), lookalikes
 * (LL2%), converter exclusions (排除已填單), and the Advantage+ audience
 * toggle that gets deliberately switched off while a test is running.
 *
 * WHY NOTHING IS HARDCODED: Meta addresses regions, cities and interests by
 * opaque numeric keys that differ per market and change over time. Guessing
 * one silently targets the wrong place — an ad set that looks correct in the
 * dashboard while spending on the wrong city. So this module ships lookup
 * functions (`searchGeoLocations`, `searchInterests`, `listCustomAudiences`)
 * and takes the keys they return; it never embeds a key of its own.
 */

import { metaGraph, type MetaAdsConfig } from "./metaAds";

// ============================================================
// LOOKUPS
// ============================================================

export type GeoLocationType = "country" | "region" | "city" | "zip" | "geo_market";

export interface GeoLocationResult {
  key: string;
  name: string;
  type: GeoLocationType | string;
  countryCode?: string;
  region?: string;
  /** Human-readable "高雄市, 台灣" style string Meta returns for disambiguation. */
  supportsRegion?: string;
}

/**
 * Resolve a place name to the key Meta wants.
 * e.g. searchGeoLocations(cfg, "高雄", ["region", "city"]).
 */
export async function searchGeoLocations(
  cfg: MetaAdsConfig,
  query: string,
  types: GeoLocationType[] = ["region", "city"],
  countryCode = "TW",
): Promise<GeoLocationResult[]> {
  const res = await metaGraph<{ data: Array<Record<string, unknown>> }>(cfg, "search", {
    params: {
      type: "adgeolocation",
      location_types: types,
      q: query,
      country_code: countryCode,
      limit: 25,
    },
  });

  return (res.data ?? []).map((d) => ({
    key: String(d.key ?? ""),
    name: String(d.name ?? ""),
    type: String(d.type ?? ""),
    countryCode: d.country_code ? String(d.country_code) : undefined,
    region: d.region ? String(d.region) : undefined,
    supportsRegion: d.supports_region ? String(d.supports_region) : undefined,
  }));
}

export interface InterestResult {
  id: string;
  name: string;
  /** Estimated reach — the number used to judge whether a stack is too narrow. */
  audienceSize?: number;
  path?: string[];
}

/** Resolve an interest name (房地產投資, 高爾夫, 企業主…) to its targeting id. */
export async function searchInterests(cfg: MetaAdsConfig, query: string): Promise<InterestResult[]> {
  const res = await metaGraph<{ data: Array<Record<string, unknown>> }>(cfg, "search", {
    params: { type: "adinterest", q: query, limit: 25 },
  });

  return (res.data ?? []).map((d) => ({
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    audienceSize:
      d.audience_size_upper_bound !== undefined ? Number(d.audience_size_upper_bound) : undefined,
    path: Array.isArray(d.path) ? d.path.map(String) : undefined,
  }));
}

export interface CustomAudienceResult {
  id: string;
  name: string;
  subtype: string;
  approximateCount?: number;
}

/** List saved audiences — lookalikes (LL2%) and converter lists to exclude. */
export async function listCustomAudiences(cfg: MetaAdsConfig): Promise<CustomAudienceResult[]> {
  const res = await metaGraph<{ data: Array<Record<string, unknown>> }>(
    cfg,
    `${cfg.adAccountId}/customaudiences`,
    { params: { fields: "id,name,subtype,approximate_count_lower_bound", limit: 200 } },
  );

  return (res.data ?? []).map((d) => ({
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    subtype: String(d.subtype ?? ""),
    approximateCount:
      d.approximate_count_lower_bound !== undefined
        ? Number(d.approximate_count_lower_bound)
        : undefined,
  }));
}

// ============================================================
// TARGETING SPEC
// ============================================================

export type Gender = "all" | "male" | "female";

export interface CityTarget {
  /** Key from searchGeoLocations. */
  key: string;
  /** Optional ring around the city centre, 1–80 km. Omit for the city proper. */
  radiusKm?: number;
}

export interface TargetingSpec {
  /** Country codes, e.g. ["TW"]. Used alone for a whole-market campaign. */
  countries?: string[];
  /** Region keys (縣市層級) from searchGeoLocations. */
  regionKeys?: string[];
  /** City keys, optionally with a radius. */
  cities?: CityTarget[];
  /** Radius around a point — the shape a single-shop local campaign uses. */
  customLocation?: { latitude: number; longitude: number; radiusKm: number };
  /** Region/city keys to carve back out (e.g. drop外縣市 that performed badly). */
  excludedRegionKeys?: string[];

  ageMin?: number;
  ageMax?: number;
  gender?: Gender;

  /** Interest ids from searchInterests. OR'd together within one stack. */
  interestIds?: string[];
  /** Interest ids to exclude. */
  excludedInterestIds?: string[];

  /** Custom/lookalike audience ids to include (e.g. LL2%). */
  customAudienceIds?: string[];
  /** Audiences to exclude — 排除已填單 lives here. */
  excludedCustomAudienceIds?: string[];

  /**
   * Advantage+ audience ("AI受眾"). Meta expands beyond the stated targeting
   * when on, which makes an interest test unreadable — hence the explicit
   * switch. Defaults to OFF so a test measures what it says it measures.
   */
  advantageAudience?: boolean;

  /** ["facebook"] / ["instagram"] / both. Omit to let Meta choose. */
  publisherPlatforms?: Array<"facebook" | "instagram" | "audience_network" | "messenger">;
}

const GENDER_CODES: Record<Exclude<Gender, "all">, number> = { male: 1, female: 2 };

/**
 * Build the `targeting` object Meta expects. Pure — no network, so the shape
 * can be asserted in tests without a token.
 */
export function buildTargeting(spec: TargetingSpec): Record<string, unknown> {
  const geo: Record<string, unknown> = {};

  if (spec.countries?.length) geo.countries = spec.countries;
  if (spec.regionKeys?.length) geo.regions = spec.regionKeys.map((key) => ({ key }));

  if (spec.cities?.length) {
    geo.cities = spec.cities.map((c) => {
      if (c.radiusKm === undefined) return { key: c.key };
      assertRadius(c.radiusKm);
      return { key: c.key, radius: c.radiusKm, distance_unit: "kilometer" };
    });
  }

  if (spec.customLocation) {
    assertRadius(spec.customLocation.radiusKm);
    geo.custom_locations = [
      {
        latitude: spec.customLocation.latitude,
        longitude: spec.customLocation.longitude,
        radius: spec.customLocation.radiusKm,
        distance_unit: "kilometer",
      },
    ];
  }

  if (!Object.keys(geo).length) {
    throw new RangeError("targeting needs at least one of countries / regionKeys / cities / customLocation");
  }

  const targeting: Record<string, unknown> = {
    geo_locations: geo,
    age_min: spec.ageMin ?? 25,
    age_max: spec.ageMax ?? 65,
    // Explicit rather than omitted: leaving this off lets Meta widen the
    // audience silently, which invalidates an interest test.
    targeting_automation: { advantage_audience: spec.advantageAudience ? 1 : 0 },
  };

  if (spec.ageMin !== undefined && spec.ageMax !== undefined && spec.ageMin > spec.ageMax) {
    throw new RangeError(`ageMin ${spec.ageMin} is greater than ageMax ${spec.ageMax}`);
  }

  if (spec.excludedRegionKeys?.length) {
    targeting.excluded_geo_locations = { regions: spec.excludedRegionKeys.map((key) => ({ key })) };
  }

  if (spec.gender && spec.gender !== "all") {
    targeting.genders = [GENDER_CODES[spec.gender]];
  }

  if (spec.interestIds?.length) {
    targeting.flexible_spec = [{ interests: spec.interestIds.map((id) => ({ id })) }];
  }

  if (spec.excludedInterestIds?.length) {
    targeting.exclusions = { interests: spec.excludedInterestIds.map((id) => ({ id })) };
  }

  if (spec.customAudienceIds?.length) {
    targeting.custom_audiences = spec.customAudienceIds.map((id) => ({ id }));
  }

  if (spec.excludedCustomAudienceIds?.length) {
    targeting.excluded_custom_audiences = spec.excludedCustomAudienceIds.map((id) => ({ id }));
  }

  if (spec.publisherPlatforms?.length) {
    targeting.publisher_platforms = spec.publisherPlatforms;
  }

  return targeting;
}

function assertRadius(radiusKm: number): void {
  if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 80) {
    throw new RangeError(`radiusKm must be between 1 and 80, got ${radiusKm}`);
  }
}

// ============================================================
// AD SET NAMING — 地區｜年齡｜受眾｜檔期
// ============================================================

export interface AdSetNameParts {
  /** 北北中 / 高雄 / 北北竹 */
  region: string;
  ageMin: number;
  ageMax: number;
  /** 房地產投資 / LL2% / 高爾夫網球 企業主企業家 */
  audience: string;
  /** 8/8.8/9場次 — omit for an always-on campaign. */
  flight?: string;
}

/**
 * Reproduce the naming convention already in the sheet, e.g.
 * 「北北中｜35-65+｜房地產投資｜8/8.8/9場次」. 65 is Meta's open-ended top
 * bucket, so it renders as "65+" exactly as the sheet writes it.
 */
export function buildAdSetName(parts: AdSetNameParts): string {
  const age = parts.ageMax >= 65 ? `${parts.ageMin}-65+` : `${parts.ageMin}-${parts.ageMax}`;
  return [parts.region, age, parts.audience, parts.flight].filter(Boolean).join("｜");
}
