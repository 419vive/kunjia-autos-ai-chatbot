/**
 * META INSIGHTS → 大表 REPORTING
 *
 * Turns Meta's insights payload into the exact row shape used in the agency
 * 大表 (the daily/monthly媒體 tracker), so numbers can be pasted straight back
 * into the sheet instead of being retyped out of Ads Manager.
 *
 * THE METRIC DEFINITIONS ARE NOT MINE — they were reverse-engineered from
 * real rows in the sheet and verified to the digit. Meta's own `ctr` and
 * `cpc` fields count ALL clicks (reactions, profile taps, photo expands);
 * the 大表 counts LINK clicks only, which is why its CPC reads ~90 rather
 * than ~20. Using Meta's fields directly would silently change every number
 * in the sheet, so this module always derives from 連結點擊次數:
 *
 *   點擊率      = 連結點擊次數 / 曝光次數
 *   千次曝光成本 = 花費 / 曝光次數 × 1000
 *   單次點擊成本 = 花費 / 連結點擊次數
 *   轉換率      = 填單次數 / 連結點擊次數
 *   單次填單成本 = 花費 / 填單次數
 *
 * Verified against 2026/8/7 (花費 5,159・曝光 2,894・連結點擊 57・填單 3):
 *   1.97% / 1,783 / 90.5 / 5.26% / 1,719.7 — all five match the sheet.
 *
 * Division by zero returns null (rendered as an empty CSV cell) rather than
 * the sheet's #DIV/0!, so a day with no conversions doesn't poison downstream
 * averages.
 */

import { metaGraph, type MetaAdsConfig } from "./metaAds";

// ============================================================
// ACTION-TYPE RESOLUTION
// ============================================================

/**
 * Meta reports the same conversion under several action_types at once
 * (e.g. both `lead` and `offsite_conversion.fb_pixel_lead`). Summing them
 * double-counts, so we take the FIRST alias present, in priority order.
 */
export const LEAD_ACTION_TYPES = [
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
  "lead",
] as const;

export const MESSAGE_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "onsite_conversion.messaging_first_reply",
] as const;

export const ENGAGEMENT_ACTION_TYPES = ["post_engagement", "page_engagement"] as const;

export const PURCHASE_ACTION_TYPES = [
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "purchase",
] as const;

export interface MetaAction {
  action_type: string;
  value: string;
}

/** First matching alias wins; absent everywhere → 0. */
export function pickAction(actions: MetaAction[] | undefined, aliases: readonly string[]): number {
  if (!actions?.length) return 0;
  for (const alias of aliases) {
    const hit = actions.find((a) => a.action_type === alias);
    if (hit) {
      const n = Number(hit.value);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

/** Guarded division — null instead of Infinity/NaN when the denominator is 0. */
export function safeDiv(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator) || !Number.isFinite(numerator)) return null;
  return numerator / denominator;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ============================================================
// DAILY ROW (FB數據總覽/日)
// ============================================================

export interface RawInsight {
  date_start?: string;
  date_stop?: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  [key: string]: unknown;
}

/** One row of 「FB數據總覽/日」. Ratios are fractions (0.0197), not percents. */
export interface DailyRow {
  /** 日期 */
  date: string;
  /** 素材名稱 / 廣告群組名稱 — present when the query was broken down by level */
  name?: string;
  /** 花費金額 */
  spend: number;
  /** 點擊率 = 連結點擊 / 曝光 */
  linkCtr: number | null;
  /** 轉換率 = 填單 / 連結點擊 */
  conversionRate: number | null;
  /** 千次曝光成本 */
  cpm: number | null;
  /** 單次點擊成本 (連結點擊) */
  cpc: number | null;
  /** 單次填單成本 */
  cpl: number | null;
  /** 曝光次數 */
  impressions: number;
  /** 連結點擊次數 */
  linkClicks: number;
  /** 填單次數 */
  leads: number;
  /** 私訊次數 */
  messages: number;
  /** 廣告互動次數 */
  engagements: number;
}

export function toDailyRow(raw: RawInsight): DailyRow {
  const spend = num(raw.spend);
  const impressions = num(raw.impressions);
  // Fall back to total clicks only when Meta omitted the link-click field
  // entirely; a present-but-zero value is real and must not be overridden.
  const linkClicks =
    raw.inline_link_clicks !== undefined ? num(raw.inline_link_clicks) : num(raw.clicks);
  const leads = pickAction(raw.actions, LEAD_ACTION_TYPES);

  return {
    date: raw.date_start ?? "",
    name: raw.ad_name ?? raw.adset_name ?? raw.campaign_name,
    spend,
    linkCtr: safeDiv(linkClicks, impressions),
    conversionRate: safeDiv(leads, linkClicks),
    cpm: safeDiv(spend * 1000, impressions),
    cpc: safeDiv(spend, linkClicks),
    cpl: safeDiv(spend, leads),
    impressions,
    linkClicks,
    leads,
    messages: pickAction(raw.actions, MESSAGE_ACTION_TYPES),
    engagements: pickAction(raw.actions, ENGAGEMENT_ACTION_TYPES),
  };
}

// ============================================================
// MONTHLY ROW (FB數據總覽/月)
// ============================================================

/** One row of 「FB數據總覽/月」 — purchase-shaped rather than lead-shaped. */
export interface MonthlyRow {
  /** 廣告帳號 */
  account: string;
  /** 月份 */
  period: string;
  /** 花費金額 */
  spend: number;
  /** 購買轉換值 */
  conversionValue: number;
  /** ROAS */
  roas: number | null;
  /** CPA */
  cpa: number | null;
  /** 點擊率 */
  linkCtr: number | null;
  /** 轉換率 */
  conversionRate: number | null;
  /** 客單價 */
  averageOrderValue: number | null;
  /** CPM */
  cpm: number | null;
  /** CPC */
  cpc: number | null;
  /** 曝光次數 */
  impressions: number;
  /** 連結點擊次數 */
  linkClicks: number;
  /** 購買訂單數 */
  purchases: number;
}

export function toMonthlyRow(raw: RawInsight, account: string, period: string): MonthlyRow {
  const spend = num(raw.spend);
  const impressions = num(raw.impressions);
  const linkClicks =
    raw.inline_link_clicks !== undefined ? num(raw.inline_link_clicks) : num(raw.clicks);
  const purchases = pickAction(raw.actions, PURCHASE_ACTION_TYPES);
  const conversionValue = pickAction(raw.action_values, PURCHASE_ACTION_TYPES);

  return {
    account,
    period,
    spend,
    conversionValue,
    roas: safeDiv(conversionValue, spend),
    cpa: safeDiv(spend, purchases),
    linkCtr: safeDiv(linkClicks, impressions),
    conversionRate: safeDiv(purchases, linkClicks),
    averageOrderValue: safeDiv(conversionValue, purchases),
    cpm: safeDiv(spend * 1000, impressions),
    cpc: safeDiv(spend, linkClicks),
    impressions,
    linkClicks,
    purchases,
  };
}

// ============================================================
// CSV EXPORT — column order matches the 大表 exactly
// ============================================================

export const DAILY_CSV_HEADER = [
  "日期",
  "花費金額",
  "點擊率",
  "轉換率",
  "千次曝光成本",
  "單次點擊成本",
  "單次填單成本",
  "曝光次數",
  "連結點擊次數",
  "填單次數",
  "私訊次數",
  "廣告互動次數",
] as const;

export const MONTHLY_CSV_HEADER = [
  "廣告帳號",
  "月份",
  "花費金額",
  "購買轉換值",
  "ROAS",
  "CPA",
  "點擊率",
  "轉換率",
  "客單價",
  "CPM",
  "CPC",
  "曝光次數",
  "連結點擊次數",
  "購買訂單數",
] as const;

/** Percent with 2dp, e.g. 0.0197 → "1.97%". Null → empty cell. */
export function fmtPercent(v: number | null): string {
  return v === null ? "" : `${(v * 100).toFixed(2)}%`;
}

/** Fixed decimals; null → empty cell. No thousands separators — those break CSV paste. */
export function fmtNumber(v: number | null, decimals = 1): string {
  return v === null ? "" : v.toFixed(decimals);
}

/** Quote a field only when it contains a comma, quote or newline. */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvLine(cells: readonly string[]): string {
  return cells.map(csvCell).join(",");
}

export function formatDailyCsv(rows: DailyRow[]): string {
  const lines = [csvLine(DAILY_CSV_HEADER)];
  for (const r of rows) {
    lines.push(
      csvLine([
        r.date,
        fmtNumber(r.spend, 0),
        fmtPercent(r.linkCtr),
        fmtPercent(r.conversionRate),
        fmtNumber(r.cpm, 0),
        fmtNumber(r.cpc, 1),
        fmtNumber(r.cpl, 1),
        String(r.impressions),
        String(r.linkClicks),
        String(r.leads),
        String(r.messages),
        String(r.engagements),
      ]),
    );
  }
  return lines.join("\n");
}

export function formatMonthlyCsv(rows: MonthlyRow[]): string {
  const lines = [csvLine(MONTHLY_CSV_HEADER)];
  for (const r of rows) {
    lines.push(
      csvLine([
        r.account,
        r.period,
        fmtNumber(r.spend, 0),
        fmtNumber(r.conversionValue, 0),
        fmtNumber(r.roas, 2),
        fmtNumber(r.cpa, 0),
        fmtPercent(r.linkCtr),
        fmtPercent(r.conversionRate),
        fmtNumber(r.averageOrderValue, 0),
        fmtNumber(r.cpm, 0),
        fmtNumber(r.cpc, 1),
        String(r.impressions),
        String(r.linkClicks),
        String(r.purchases),
      ]),
    );
  }
  return lines.join("\n");
}

// ============================================================
// FETCHERS
// ============================================================

/** Every field the two row shapes need — requested in one call. */
const INSIGHT_FIELDS =
  "date_start,date_stop,campaign_name,adset_name,ad_name," +
  "spend,impressions,clicks,inline_link_clicks,actions,action_values";

export type InsightLevel = "account" | "campaign" | "adset" | "ad";

/**
 * Daily rows for the 大表. `time_increment: 1` is what makes Meta return one
 * row per day rather than one aggregate row for the whole range.
 */
export async function getDailyRows(
  cfg: MetaAdsConfig,
  opts: { since: string; until: string; level?: InsightLevel; objectId?: string },
): Promise<DailyRow[]> {
  const target = opts.objectId || cfg.adAccountId;
  const res = await metaGraph<{ data: RawInsight[] }>(cfg, `${target}/insights`, {
    params: {
      level: opts.level ?? "account",
      time_increment: 1,
      time_range: { since: opts.since, until: opts.until },
      fields: INSIGHT_FIELDS,
      limit: 500,
    },
  });
  return (res.data ?? []).map(toDailyRow);
}

/** One aggregated row for a whole month, in 「FB數據總覽/月」 shape. */
export async function getMonthlyRow(
  cfg: MetaAdsConfig,
  opts: { since: string; until: string; account: string; objectId?: string },
): Promise<MonthlyRow | null> {
  const target = opts.objectId || cfg.adAccountId;
  const res = await metaGraph<{ data: RawInsight[] }>(cfg, `${target}/insights`, {
    params: {
      level: "account",
      time_range: { since: opts.since, until: opts.until },
      fields: INSIGHT_FIELDS,
    },
  });
  const first = res.data?.[0];
  return first ? toMonthlyRow(first, opts.account, `${opts.since} - ${opts.until}`) : null;
}
