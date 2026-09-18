/**
 * VEHICLE AD BUILDER — turn one inventory row into a complete, PAUSED ad.
 *
 * Split out of metaAds.ts so that module stays the transport + core-object
 * layer. Everything shop-specific (ad copy, landing link, the audience the
 * dealership actually buys) lives here.
 *
 * FACT_LOCK applies: ad copy is customer-facing output, so shop facts come
 * from shared/shopConfig and prices from shared/priceFormat — never from a
 * literal in this file. See docs/PROJECT_JOURNAL.md 2026-04-23.
 */

import { logger } from "./logger";
import { SHOP_NAME, SHOP_CITY, SHOP_PHONE } from "../shared/shopConfig";
import { formatVehiclePriceSafe } from "../shared/priceFormat";
import type { Vehicle } from "../drizzle/schema";
import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  uploadAdImage,
  type MetaAdsConfig,
  type CreateCreativeInput,
  type AdObjective,
  type BidStrategy,
} from "./metaAds";
import { buildAdSetName, type TargetingSpec } from "./metaTargeting";

/** The subset of a vehicle row the ad copy needs. */
export type VehicleForAd = Pick<
  Vehicle,
  "id" | "brand" | "model" | "modelYear" | "mileage" | "price" | "priceDisplay"
>;

/** Ad copy for one car, in the shop's own voice. Pure — no network, easy to test. */
export function buildVehicleCreativeSpec(
  vehicle: VehicleForAd,
  baseUrl: string,
): Omit<CreateCreativeInput, "imageHash"> {
  const title = [vehicle.modelYear, vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const price = formatVehiclePriceSafe(vehicle);
  const mileageLine = vehicle.mileage ? `｜${vehicle.mileage}` : "";

  return {
    name: `${title} — 車輛廣告`,
    headline: `${title}　${price}`,
    description: `${SHOP_NAME}・${SHOP_CITY}｜40年老口碑`,
    message:
      `${title}${mileageLine}\n` +
      `${price}\n\n` +
      `${SHOP_NAME}在${SHOP_CITY}，實車實價、車況透明。\n` +
      `想看車或問貸款，直接私訊或電洽 ${SHOP_PHONE}。`,
    link: `${baseUrl.replace(/\/$/, "")}/vehicle/${vehicle.id}`,
    callToAction: "LEARN_MORE",
  };
}

export interface LaunchVehicleAdResult {
  campaignId: string;
  adsetId: string;
  creativeId: string;
  adId: string;
  /** The generated ad set name, so it can be pasted into the tracker sheet. */
  adsetName: string;
  /** Always false — nothing here activates. Call activateAd() to go live. */
  active: false;
}

export interface LaunchVehicleAdOptions {
  imageUrl: string;
  baseUrl: string;
  dailyBudgetMinor: number;
  /** Audience spec — cities, interests, lookalikes, exclusions. */
  targeting: TargetingSpec;
  /** Names the ad set 地區｜年齡｜受眾｜檔期, matching the tracker sheet. */
  naming: { region: string; audience: string; flight?: string };
  objective?: AdObjective;
  bidStrategy?: BidStrategy;
  bidAmountMinor?: number;
  allowBudgetAboveCeiling?: boolean;
}

/**
 * Build a complete, PAUSED ad for one vehicle: campaign, ad set, creative, ad.
 * Review it in Ads Manager, then call activateAd(adId) to go live — this
 * function never activates anything.
 */
export async function launchVehicleAd(
  cfg: MetaAdsConfig,
  vehicle: VehicleForAd,
  opts: LaunchVehicleAdOptions,
): Promise<LaunchVehicleAdResult> {
  const spec = buildVehicleCreativeSpec(vehicle, opts.baseUrl);

  const adsetName = buildAdSetName({
    region: opts.naming.region,
    ageMin: opts.targeting.ageMin ?? 25,
    ageMax: opts.targeting.ageMax ?? 65,
    audience: opts.naming.audience,
    flight: opts.naming.flight,
  });

  const campaignId = await createCampaign(cfg, {
    name: `${spec.name}｜${new Date().toISOString().slice(0, 10)}`,
    objective: opts.objective ?? "OUTCOME_LEADS",
  });

  const adsetId = await createAdSet(cfg, {
    campaignId,
    name: adsetName,
    dailyBudgetMinor: opts.dailyBudgetMinor,
    allowBudgetAboveCeiling: opts.allowBudgetAboveCeiling,
    targeting: opts.targeting,
    bidStrategy: opts.bidStrategy,
    bidAmountMinor: opts.bidAmountMinor,
  });

  const imageHash = await uploadAdImage(cfg, opts.imageUrl);
  const creativeId = await createAdCreative(cfg, { ...spec, imageHash });
  const adId = await createAd(cfg, { name: spec.name, adsetId, creativeId });

  logger.info("MetaAds", `vehicle ${vehicle.id} ad stack built (PAUSED) ad=${adId}`);
  return { campaignId, adsetId, creativeId, adId, adsetName, active: false };
}
