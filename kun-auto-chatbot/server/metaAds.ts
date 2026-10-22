/**
 * META MARKETING API CLIENT — place Facebook/Instagram ads programmatically.
 *
 * Scope: create the four-object ad stack (Campaign → Ad Set → Ad Creative →
 * Ad) and read insights back, using a System User access token that belongs
 * to 崑家汽車's Business Portfolio.
 *
 * SAFETY CONTRACT (read before changing anything here):
 *
 *  1. EVERYTHING IS CREATED PAUSED. `createAd` and friends hardcode
 *     status "PAUSED". Going live is an explicit, separate `activateAd`
 *     call. A bug in this file must never be able to start spending money.
 *
 *  2. BUDGETS ARE IN THE ACCOUNT CURRENCY'S MINOR UNITS, not TWD. Meta
 *     multiplies by 10^currency_offset, and that offset differs per
 *     currency. Getting it wrong is a 100x overspend, so this module
 *     refuses to guess: call `getAdAccountInfo()` once, read the real
 *     `currency_offset`, and convert with `toMinorUnits()`.
 *
 *  3. THE ACCESS TOKEN IS NEVER LOGGED. All logging goes through
 *     `redactToken()`. Meta tokens in a log file are a live credential.
 *
 * Setup steps (Business Portfolio roles, App Review, System User token)
 * are documented in docs/META_ADS_SETUP.md.
 */

import { logger } from "./logger";
import { buildTargeting, type TargetingSpec } from "./metaTargeting";

// ============================================================
// CONFIG
// ============================================================

export interface MetaAdsConfig {
  accessToken: string;
  /** Always "act_<digits>" — normalized on load. */
  adAccountId: string;
  pageId: string;
  pixelId: string;
  apiVersion: string;
}

/** Graph API version. Override with META_API_VERSION when Meta deprecates it. */
const DEFAULT_API_VERSION = "v21.0";

/**
 * Meta accepts both "act_123" and bare "123" in different places; the Graph
 * path always wants the `act_` prefix. Normalizing once here means callers
 * can paste whatever Ads Manager showed them.
 */
export function normalizeAdAccountId(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

/**
 * Build config from env. Returns null (rather than throwing) when the
 * integration simply isn't configured, so the server boots fine without it.
 */
export function loadMetaAdsConfig(env: NodeJS.ProcessEnv = process.env): MetaAdsConfig | null {
  const accessToken = env.META_ACCESS_TOKEN?.trim();
  const adAccountId = normalizeAdAccountId(env.META_AD_ACCOUNT_ID || "");
  const pageId = env.META_PAGE_ID?.trim();
  const pixelId = env.META_PIXEL_ID?.trim();

  if (!accessToken || !adAccountId || !pageId || !pixelId) return null;

  return {
    accessToken,
    adAccountId,
    pageId,
    pixelId,
    apiVersion: env.META_API_VERSION?.trim() || DEFAULT_API_VERSION,
  };
}

/** Redact a token for logs: keep enough to identify it, never enough to use it. */
export function redactToken(token: string): string {
  if (!token || token.length <= 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

// ============================================================
// ERRORS
// ============================================================

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
    readonly type?: string,
    readonly fbtraceId?: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

/** Turn Meta's `{error:{...}}` envelope into a MetaApiError. */
export function parseMetaError(body: unknown, httpStatus: number): MetaApiError {
  const err = (body as { error?: Record<string, unknown> } | null)?.error;
  if (!err) {
    return new MetaApiError(`Meta API HTTP ${httpStatus}`, undefined, undefined, undefined, undefined, httpStatus);
  }
  const userMsg = typeof err.error_user_msg === "string" ? err.error_user_msg : null;
  const msg = userMsg || (typeof err.message === "string" ? err.message : "unknown Meta API error");
  return new MetaApiError(
    msg,
    typeof err.code === "number" ? err.code : undefined,
    typeof err.error_subcode === "number" ? err.error_subcode : undefined,
    typeof err.type === "string" ? err.type : undefined,
    typeof err.fbtrace_id === "string" ? err.fbtrace_id : undefined,
    httpStatus,
  );
}

// ============================================================
// TRANSPORT
// ============================================================

interface GraphOptions {
  method?: "GET" | "POST" | "DELETE";
  params?: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * One call to the Graph API. Object/array params are JSON-stringified because
 * that is the encoding Meta expects for nested fields like `targeting`.
 */
export async function metaGraph<T = Record<string, unknown>>(
  cfg: MetaAdsConfig,
  path: string,
  opts: GraphOptions = {},
): Promise<T> {
  const method = opts.method || "GET";
  const url = new URL(`https://graph.facebook.com/${cfg.apiVersion}/${path.replace(/^\//, "")}`);

  const encoded = new URLSearchParams();
  for (const [key, value] of Object.entries(opts.params || {})) {
    if (value === undefined || value === null) continue;
    encoded.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  encoded.set("access_token", cfg.accessToken);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);

  try {
    const res =
      method === "GET"
        ? await fetch(`${url.toString()}?${encoded.toString()}`, { signal: controller.signal })
        : await fetch(url.toString(), {
            method,
            body: encoded,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            signal: controller.signal,
          });

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body — fall through to the HTTP-status error below */
    }

    if (!res.ok) throw parseMetaError(body, res.status);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// ACCOUNT + CURRENCY
// ============================================================

export interface AdAccountInfo {
  id: string;
  name: string;
  currency: string;
  /** Decimal places in the currency. TWD and USD differ — never assume. */
  currencyOffset: number;
  /** Minimum allowed daily budget, already in minor units. */
  minDailyBudget: number;
  timezoneName: string;
  /** 1 = ACTIVE. Anything else means the account cannot spend. */
  accountStatus: number;
}

export async function getAdAccountInfo(cfg: MetaAdsConfig): Promise<AdAccountInfo> {
  const raw = await metaGraph<Record<string, unknown>>(cfg, cfg.adAccountId, {
    params: {
      fields: "id,name,currency,currency_offset,min_daily_budget,timezone_name,account_status",
    },
  });

  return {
    id: String(raw.id ?? cfg.adAccountId),
    name: String(raw.name ?? ""),
    currency: String(raw.currency ?? ""),
    currencyOffset: Number(raw.currency_offset ?? 0),
    minDailyBudget: Number(raw.min_daily_budget ?? 0),
    timezoneName: String(raw.timezone_name ?? ""),
    accountStatus: Number(raw.account_status ?? 0),
  };
}

/**
 * Convert a human amount (e.g. NT$500) into the minor units Meta wants.
 * Pass the `currencyOffset` returned by getAdAccountInfo — do not hardcode it.
 */
export function toMinorUnits(amount: number, currencyOffset: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError(`budget must be a positive number, got ${amount}`);
  }
  if (!Number.isInteger(currencyOffset) || currencyOffset < 0 || currencyOffset > 4) {
    throw new RangeError(`implausible currency_offset ${currencyOffset} — read it from getAdAccountInfo()`);
  }
  return Math.round(amount * 10 ** currencyOffset);
}

/**
 * Hard ceiling so a unit-mix-up or a stray zero cannot drain the card.
 * Callers that genuinely want to spend more must pass `allowAbove` explicitly.
 */
export const DAILY_BUDGET_CEILING_MINOR = 500_000;

export function assertBudgetSane(dailyBudgetMinor: number, allowAbove = false): void {
  if (!Number.isInteger(dailyBudgetMinor) || dailyBudgetMinor <= 0) {
    throw new RangeError(`dailyBudgetMinor must be a positive integer, got ${dailyBudgetMinor}`);
  }
  if (!allowAbove && dailyBudgetMinor > DAILY_BUDGET_CEILING_MINOR) {
    throw new RangeError(
      `dailyBudgetMinor ${dailyBudgetMinor} exceeds the ${DAILY_BUDGET_CEILING_MINOR} safety ceiling. ` +
        `Confirm the currency offset with getAdAccountInfo(), then pass allowAbove=true if this is intended.`,
    );
  }
}

// ============================================================
// CAMPAIGN → AD SET → CREATIVE → AD
// ============================================================

export type AdObjective =
  | "OUTCOME_LEADS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_SALES"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT";

export interface CreateCampaignInput {
  name: string;
  objective: AdObjective;
  /** Taiwan auto retail needs none, but Meta requires the field to be present. */
  specialAdCategories?: string[];
}

export async function createCampaign(cfg: MetaAdsConfig, input: CreateCampaignInput): Promise<string> {
  const res = await metaGraph<{ id: string }>(cfg, `${cfg.adAccountId}/campaigns`, {
    method: "POST",
    params: {
      name: input.name,
      objective: input.objective,
      status: "PAUSED",
      special_ad_categories: input.specialAdCategories ?? [],
    },
  });
  logger.info("MetaAds", `campaign created id=${res.id} objective=${input.objective} (PAUSED)`);
  return res.id;
}

/** Geo targeting by radius around the shop — the simplest local-dealer shape. */
export interface RadiusTarget {
  latitude: number;
  longitude: number;
  /** 1–80 for km. Meta rejects anything outside that. */
  radiusKm: number;
}

/**
 * Bid strategy. "CPA控價" in the playbook is COST_CAP: Meta keeps the average
 * cost per result at or under `bidAmountMinor`. LOWEST_COST_WITHOUT_CAP is
 * Meta's default (spend the budget, take whatever the cost lands at).
 */
export type BidStrategy = "LOWEST_COST_WITHOUT_CAP" | "COST_CAP" | "LOWEST_COST_WITH_BID_CAP";

export interface CreateAdSetInput {
  campaignId: string;
  name: string;
  /** Minor units. Use toMinorUnits() with the real currency_offset. */
  dailyBudgetMinor: number;
  allowBudgetAboveCeiling?: boolean;
  optimizationGoal?: "OFFSITE_CONVERSIONS" | "LINK_CLICKS" | "LEAD_GENERATION" | "REACH";
  /** Pixel conversion event to optimize for, e.g. "LEAD" or "SCHEDULE". */
  customEventType?: string;

  /**
   * Full audience spec — cities, interests, lookalikes, exclusions, the
   * Advantage+ toggle. Provide this OR `radius`, not both.
   */
  targeting?: TargetingSpec;
  /** Shorthand for a single radius ring. Equivalent to targeting.customLocation. */
  radius?: RadiusTarget;
  ageMin?: number;
  ageMax?: number;

  /** Cost cap. Required when bidStrategy is COST_CAP or LOWEST_COST_WITH_BID_CAP. */
  bidStrategy?: BidStrategy;
  /** The cap itself, in minor units — same conversion as the budget. */
  bidAmountMinor?: number;
}

export async function createAdSet(cfg: MetaAdsConfig, input: CreateAdSetInput): Promise<string> {
  assertBudgetSane(input.dailyBudgetMinor, input.allowBudgetAboveCeiling);

  if (input.targeting && input.radius) {
    throw new RangeError("pass either targeting or radius, not both");
  }
  if (!input.targeting && !input.radius) {
    throw new RangeError("createAdSet needs targeting or radius");
  }

  // A cost cap with no amount silently degrades to Meta's default bidding,
  // which is the opposite of what "控價" is for — so fail loudly instead.
  const needsBidAmount =
    input.bidStrategy === "COST_CAP" || input.bidStrategy === "LOWEST_COST_WITH_BID_CAP";
  if (needsBidAmount && !input.bidAmountMinor) {
    throw new RangeError(`bidStrategy ${input.bidStrategy} requires bidAmountMinor`);
  }
  if (input.bidAmountMinor !== undefined) {
    assertBudgetSane(input.bidAmountMinor, input.allowBudgetAboveCeiling);
  }

  const spec: TargetingSpec = input.targeting ?? {
    customLocation: {
      latitude: input.radius!.latitude,
      longitude: input.radius!.longitude,
      radiusKm: input.radius!.radiusKm,
    },
  };

  const targeting = buildTargeting({
    ...spec,
    ageMin: input.ageMin ?? spec.ageMin ?? 25,
    ageMax: input.ageMax ?? spec.ageMax ?? 60,
  });

  const optimizationGoal = input.optimizationGoal ?? "OFFSITE_CONVERSIONS";

  const res = await metaGraph<{ id: string }>(cfg, `${cfg.adAccountId}/adsets`, {
    method: "POST",
    params: {
      name: input.name,
      campaign_id: input.campaignId,
      status: "PAUSED",
      daily_budget: input.dailyBudgetMinor,
      billing_event: "IMPRESSIONS",
      optimization_goal: optimizationGoal,
      bid_strategy: input.bidStrategy,
      bid_amount: input.bidAmountMinor,
      promoted_object:
        optimizationGoal === "OFFSITE_CONVERSIONS"
          ? { pixel_id: cfg.pixelId, custom_event_type: input.customEventType ?? "LEAD" }
          : undefined,
      targeting,
    },
  });

  logger.info("MetaAds", `adset created id=${res.id} budget=${input.dailyBudgetMinor} (PAUSED)`);
  return res.id;
}

/**
 * Upload an image to the ad account's image library and return its hash.
 * Creatives reference images by hash, not URL — a public URL is not enough.
 */
export async function uploadAdImage(cfg: MetaAdsConfig, imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new MetaApiError(`could not fetch creative image (HTTP ${imgRes.status}): ${imageUrl}`);

  const blob = await imgRes.blob();
  const form = new FormData();
  form.set("access_token", cfg.accessToken);
  form.set("filename", blob, "creative.jpg");

  const res = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.adAccountId}/adimages`, {
    method: "POST",
    body: form,
  });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) throw parseMetaError(body, res.status);

  // Response shape: { images: { "<filename>": { hash, url } } }
  const images = body?.images as Record<string, { hash?: string }> | undefined;
  const hash = images ? Object.values(images)[0]?.hash : undefined;
  if (!hash) throw new MetaApiError("adimages upload returned no hash");

  logger.info("MetaAds", `image uploaded hash=${hash}`);
  return hash;
}

export interface CreateCreativeInput {
  name: string;
  /** Primary text shown above the image. */
  message: string;
  /** Landing page — e.g. https://kuncar.tw/vehicle/28 */
  link: string;
  headline: string;
  description?: string;
  imageHash: string;
  callToAction?: "LEARN_MORE" | "CONTACT_US" | "GET_QUOTE" | "BOOK_TRAVEL" | "MESSAGE_PAGE";
}

export async function createAdCreative(cfg: MetaAdsConfig, input: CreateCreativeInput): Promise<string> {
  const res = await metaGraph<{ id: string }>(cfg, `${cfg.adAccountId}/adcreatives`, {
    method: "POST",
    params: {
      name: input.name,
      object_story_spec: {
        page_id: cfg.pageId,
        link_data: {
          link: input.link,
          message: input.message,
          name: input.headline,
          description: input.description,
          image_hash: input.imageHash,
          call_to_action: { type: input.callToAction ?? "LEARN_MORE" },
        },
      },
    },
  });
  logger.info("MetaAds", `creative created id=${res.id}`);
  return res.id;
}

export async function createAd(
  cfg: MetaAdsConfig,
  input: { name: string; adsetId: string; creativeId: string },
): Promise<string> {
  const res = await metaGraph<{ id: string }>(cfg, `${cfg.adAccountId}/ads`, {
    method: "POST",
    params: {
      name: input.name,
      adset_id: input.adsetId,
      creative: { creative_id: input.creativeId },
      status: "PAUSED",
    },
  });
  logger.info("MetaAds", `ad created id=${res.id} (PAUSED)`);
  return res.id;
}

/**
 * The ONLY function in this module that can start spending. Kept separate and
 * deliberately un-called by the build helpers so review can grep for it.
 */
export async function activateAd(cfg: MetaAdsConfig, adId: string): Promise<void> {
  await metaGraph(cfg, adId, { method: "POST", params: { status: "ACTIVE" } });
  logger.warn("MetaAds", `ad ${adId} ACTIVATED — this ad can now spend money`);
}
