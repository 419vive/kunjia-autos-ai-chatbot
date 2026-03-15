/**
 * 8891 Auto-Sync Service for 崑家汽車 (Shop ID: 1726)
 * 
 * Uses the official 8891 v5 items/search API to fetch ALL vehicles at once.
 * Includes Chain of Verification (CoV) for end-to-end data integrity.
 * 
 * Strategy:
 * 1. Fetch ALL vehicles via v5 API (returns complete list in one call)
 * 2. Cross-verify with shop page onSaleCount
 * 3. Compare with database: add new, update changed, mark removed as sold
 * 4. Run Chain of Verification to ensure data integrity across all layers
 * 5. Report results to owner
 */

import { eq } from "drizzle-orm";
import { vehicles } from "../drizzle/schema";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";

// 崑家汽車 identifier on 8891
const SHOP_ID = 1726;

// Sync status tracking
let lastSyncTime: Date | null = null;
let lastSyncStatus: "success" | "partial" | "failed" | "running" | "never" = "never";
let lastSyncMessage = "";
let lastSyncVehicleCount = 0;
let syncInProgress = false;
let lastCoVReport: CoVReport | null = null;
let lastCoVTime: Date | null = null;

// CoV runs twice per week (~3.5 days between checks)
const COV_INTERVAL_MS = 3.5 * 24 * 60 * 60 * 1000; // 3.5 days in ms

function shouldRunCoV(): boolean {
  if (!lastCoVTime) return true; // Never ran before, run it
  const elapsed = Date.now() - lastCoVTime.getTime();
  return elapsed >= COV_INTERVAL_MS;
}

export function getSyncStatus() {
  return {
    lastSyncTime,
    lastSyncStatus,
    lastSyncMessage,
    lastSyncVehicleCount,
    syncInProgress,
    lastCoVReport,
  };
}

// ============ DATA TYPES ============

interface ApiVehicle {
  itemId: number;
  brandEnName: string;
  kindEnName: string;
  modelEnName: string;
  title: string;
  subTitle: string;
  price: string;
  makeYear: string;
  yearType: string;
  color: string;
  mileage: string;
  gas: string;
  tab: string; // transmission info
  region: string;
  image: string;
  bigImage: string;
  memberId: number;
  itemPostDate: string;
  itemRenewDate: string;
  totalViewNum: number;
  checkCarStatus: number;
  saleCodes: string[];
}

interface ScrapedVehicle {
  externalId: string;
  sourceUrl: string;
  title: string;
  brand: string;
  model: string;
  modelYear: string;
  manufactureYear: string;
  color: string;
  price: string;
  priceDisplay: string;
  mileage: string;
  displacement: string;
  transmission: string;
  fuelType: string;
  bodyType: string;
  licenseDate: string;
  location: string;
  description: string;
  features: string;
  guarantees: string;
  photoUrls: string;
  photoCount: number;
}

// ============ CoV (Chain of Verification) TYPES ============

interface CoVStep {
  step: string;
  description: string;
  status: "pass" | "fail" | "warn";
  expected: string | number;
  actual: string | number;
  details?: string;
}

interface CoVReport {
  timestamp: Date;
  overallStatus: "pass" | "fail" | "warn";
  steps: CoVStep[];
  summary: string;
}

// ============ 8891 API FETCHING ============

/**
 * Fetch ALL vehicles from 8891 v5 items/search API.
 * This API returns the complete list in one call (up to limit).
 */
async function fetchAllVehiclesFromApi(): Promise<{ total: number; items: ApiVehicle[] }> {
  console.log("[8891 Sync] Fetching vehicles via v5 API...");

  try {
    const deviceId = `sync-${Date.now()}`;
    const url = `https://www.8891.com.tw/api/v5/items/search?api=6.21&page=1&limit=30&from=shop&shopId=${SHOP_ID}&device_id=${deviceId}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json",
        "Accept-Language": "zh-TW,zh;q=0.9",
        "Referer": `https://m.8891.com.tw/shop?id=${SHOP_ID}&navType=shopAutos`,
      },
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }

    const data = await res.json();

    // 8891 API uses 12000 as success status code
    if (data.status !== undefined && data.status !== 0 && data.status !== 200 && data.status !== 12000) {
      throw new Error(`API error status: ${data.status}`);
    }

    const items: ApiVehicle[] = data.data?.items || [];
    const total: number = data.data?.total || items.length;

    console.log(`[8891 Sync] API returned ${items.length} vehicles (total: ${total})`);
    return { total, items };
  } catch (err: any) {
    console.error("[8891 Sync] API fetch failed:", err.message);
    throw err;
  }
}

/**
 * Fetch shop page to get onSaleCount for cross-verification.
 */
async function fetchShopOnSaleCount(): Promise<number> {
  try {
    const res = await fetch(`https://m.8891.com.tw/shop?id=${SHOP_ID}&navType=index`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "text/html",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
    });

    if (!res.ok) return 0;

    const html = await res.text();
    const nextDataMatch = html.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch) return 0;

    const data = JSON.parse(nextDataMatch[1]);
    return data.props?.pageProps?.dataSource?.onSaleCount || 0;
  } catch {
    return 0;
  }
}

/**
 * Convert API vehicle to our ScrapedVehicle format.
 */
function apiVehicleToScraped(v: ApiVehicle): ScrapedVehicle {
  const brand = v.brandEnName || "";
  const model = [v.kindEnName, v.modelEnName].filter(Boolean).join(" ").trim();
  const yearMatch = v.makeYear?.match(/(\d{4})/);
  const modelYear = yearMatch ? yearMatch[1] : "";
  const priceNum = v.price?.replace(/[^\d.]/g, "") || "";

  // Get photo URL (use bigImage for better quality)
  const photoUrl = v.bigImage || v.image || "";

  return {
    externalId: String(v.itemId),
    sourceUrl: `https://auto.8891.com.tw/usedauto-infos-${v.itemId}.html`,
    title: v.title || `${brand} ${model}`,
    brand,
    model,
    modelYear,
    manufactureYear: modelYear,
    color: v.color || "",
    price: priceNum,
    priceDisplay: v.price || "",
    mileage: v.mileage || "",
    displacement: v.gas ? `${v.gas}` : "",
    transmission: v.tab || "",
    fuelType: "",
    bodyType: "",
    licenseDate: "",
    location: v.region || "高雄市",
    description: v.subTitle || "",
    features: "",
    guarantees: "",
    photoUrls: photoUrl,
    photoCount: photoUrl ? 1 : 0,
  };
}

/**
 * Fetch detailed vehicle info from mobile page for richer data.
 * Used to supplement API data with photos, features, guarantees etc.
 */
async function fetchVehicleDetailEnriched(carId: string): Promise<Partial<ScrapedVehicle> | null> {
  try {
    const res = await fetch(`https://m.8891.com.tw/auto?id=${carId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "text/html",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const nextDataMatch = html.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch) return null;

    const data = JSON.parse(nextDataMatch[1]);
    const ds = data.props?.pageProps?.dataSource;
    if (!ds) return null;

    // Verify this vehicle belongs to 崑家汽車
    if (ds.sellerInfo?.shopId !== SHOP_ID) return null;

    const images = ds.images || {};
    // Use 'big' for high quality, but ensure we get ALL photos.
    // Sometimes 8891 returns fewer 'big' URLs than 'thumbnail' URLs.
    // Strategy: use 'big' where available, fill remaining from 'thumbnail'.
    const bigImages: string[] = images.big || [];
    const thumbnails: string[] = images.thumbnail || [];
    let photoList: string[];
    if (bigImages.length >= thumbnails.length) {
      // big has all photos (or more) — use big
      photoList = bigImages;
    } else if (bigImages.length > 0) {
      // big has fewer — use big first, then fill with remaining thumbnails
      const bigSet = new Set(bigImages);
      const extras = thumbnails.filter(t => !bigSet.has(t));
      photoList = [...bigImages, ...extras.slice(0, thumbnails.length - bigImages.length)];
    } else {
      photoList = thumbnails;
    }
    const extended = ds.extended || {};

    return {
      photoUrls: photoList.join("|"),
      photoCount: photoList.length,
      transmission: extended.transmission || "",
      fuelType: extended.fuelType || "",
      bodyType: extended.bodyType || "",
      features: "",
      guarantees: "",
    };
  } catch {
    return null;
  }
}

// ============ CHAIN OF VERIFICATION (CoV) ============

/**
 * Run Chain of Verification after sync to ensure data integrity.
 * 
 * CoV Steps:
 * 1. Source Verification: API count matches shop page onSaleCount
 * 2. DB Completeness: All API vehicles exist in database
 * 3. DB Accuracy: Prices and key fields match between API and DB
 * 4. LINE Flex Verification: All DB vehicles would appear in carousel
 * 5. AI Knowledge Verification: All vehicles included in LLM prompt
 */
async function runChainOfVerification(
  apiItems: ApiVehicle[],
  onSaleCount: number,
): Promise<CoVReport> {
  const steps: CoVStep[] = [];
  const dbInstance = await getDb();

  // ── Step 1: Source Count Verification ──
  steps.push({
    step: "1. 來源數量驗證",
    description: "API 返回數量 vs 商家頁面 onSaleCount",
    status: apiItems.length === onSaleCount ? "pass" : onSaleCount === 0 ? "warn" : "fail",
    expected: onSaleCount || "unknown",
    actual: apiItems.length,
    details: onSaleCount === 0
      ? "無法取得商家頁面 onSaleCount（可能暫時無法連線）"
      : apiItems.length === onSaleCount
        ? "API 數量與商家頁面一致"
        : `差異 ${Math.abs(apiItems.length - onSaleCount)} 台`,
  });

  // ── Step 2: DB Completeness Verification ──
  if (dbInstance) {
    const dbVehicles = await dbInstance
      .select({ externalId: vehicles.externalId, status: vehicles.status })
      .from(vehicles)
      .where(eq(vehicles.status, "available"));

    const dbIds = new Set(dbVehicles.map((v) => v.externalId));
    const apiIds = new Set(apiItems.map((v) => String(v.itemId)));

    const missingInDb = Array.from(apiIds).filter((id) => !dbIds.has(id));
    const extraInDb = Array.from(dbIds).filter((id) => !apiIds.has(id));

    steps.push({
      step: "2. 資料庫完整性驗證",
      description: "所有 API 車輛都存在於資料庫中",
      status: missingInDb.length === 0 && extraInDb.length === 0 ? "pass" : "fail",
      expected: apiIds.size,
      actual: dbIds.size,
      details: missingInDb.length > 0
        ? `資料庫缺少: ${missingInDb.join(", ")}`
        : extraInDb.length > 0
          ? `資料庫多餘: ${extraInDb.join(", ")}`
          : "資料庫與 API 完全一致",
    });

    // ── Step 3: Data Accuracy Verification ──
    const allDbVehicles = await db.getAllVehicles();
    const dbMap = new Map(allDbVehicles.map((v) => [v.externalId, v]));
    const priceErrors: string[] = [];

    for (const apiV of apiItems) {
      const dbV = dbMap.get(String(apiV.itemId));
      if (dbV) {
        const apiPrice = apiV.price?.replace(/[^\d.]/g, "") || "";
        const dbPrice = dbV.price || "";
        if (apiPrice && dbPrice && apiPrice !== dbPrice) {
          priceErrors.push(`${apiV.brandEnName} ${apiV.kindEnName}: API=${apiV.price} vs DB=${dbV.priceDisplay}`);
        }
      }
    }

    steps.push({
      step: "3. 資料準確性驗證",
      description: "價格等關鍵欄位在 API 與資料庫間一致",
      status: priceErrors.length === 0 ? "pass" : "warn",
      expected: "0 price mismatches",
      actual: `${priceErrors.length} mismatches`,
      details: priceErrors.length > 0 ? priceErrors.join("; ") : "所有價格一致",
    });

    // ── Step 4: LINE Flex Message Verification ──
    const availableCount = allDbVehicles.filter((v) => v.status === "available").length;
    const flexLimit = 12; // LINE carousel max

    steps.push({
      step: "4. LINE 輪播卡片驗證",
      description: "所有可用車輛都能在 LINE Flex Message 中顯示",
      status: availableCount <= flexLimit ? "pass" : "warn",
      expected: `≤ ${flexLimit}`,
      actual: availableCount,
      details:
        availableCount <= flexLimit
          ? `${availableCount} 台車輛全部可在 LINE 輪播中顯示`
          : `超過 LINE 輪播上限 ${flexLimit} 台，將顯示前 ${flexLimit} 台`,
    });

    // ── Step 5: AI Knowledge Base Verification ──
    const allAvailable = allDbVehicles.filter((v) => v.status === "available");
    const missingBrand = allAvailable.filter((v) => !v.brand);
    const missingPrice = allAvailable.filter((v) => !v.price && !v.priceDisplay);

    steps.push({
      step: "5. AI 知識庫驗證",
      description: "所有車輛都有足夠資訊供 AI 客服回答問題",
      status: missingBrand.length === 0 && missingPrice.length === 0 ? "pass" : "warn",
      expected: "All vehicles have brand + price",
      actual: `${missingBrand.length} missing brand, ${missingPrice.length} missing price`,
      details:
        missingBrand.length === 0 && missingPrice.length === 0
          ? `${allAvailable.length} 台車輛全部有完整品牌和價格資訊`
          : `缺少品牌: ${missingBrand.map((v) => v.externalId).join(",")}; 缺少價格: ${missingPrice.map((v) => v.externalId).join(",")}`,
    });
  } else {
    steps.push({
      step: "2-5. 資料庫驗證",
      description: "資料庫不可用，跳過後續驗證",
      status: "fail",
      expected: "DB available",
      actual: "DB unavailable",
    });
  }

  // Calculate overall status
  const hasFailure = steps.some((s) => s.status === "fail");
  const hasWarning = steps.some((s) => s.status === "warn");
  const overallStatus = hasFailure ? "fail" : hasWarning ? "warn" : "pass";

  const passCount = steps.filter((s) => s.status === "pass").length;
  const summary = `CoV 驗證完成：${passCount}/${steps.length} 通過` +
    (hasFailure ? `，${steps.filter((s) => s.status === "fail").length} 項失敗` : "") +
    (hasWarning ? `，${steps.filter((s) => s.status === "warn").length} 項警告` : "");

  return {
    timestamp: new Date(),
    overallStatus,
    steps,
    summary,
  };
}

/**
 * Format CoV report for notification
 */
function formatCoVReport(report: CoVReport): string {
  const statusEmoji = { pass: "✅", fail: "❌", warn: "⚠️" };
  const lines = [
    `🔍 Chain of Verification 驗證報告`,
    `狀態：${statusEmoji[report.overallStatus]} ${report.summary}`,
    `時間：${report.timestamp.toLocaleString("zh-TW")}`,
    "",
    ...report.steps.map(
      (s) => `${statusEmoji[s.status]} ${s.step}\n   ${s.details || `預期: ${s.expected}, 實際: ${s.actual}`}`
    ),
  ];
  return lines.join("\n");
}

// ============ MAIN SYNC FUNCTION ============

/**
 * Main sync function: fetches 8891 API and updates the database.
 * Includes Chain of Verification for data integrity.
 */
export async function sync8891(): Promise<{
  success: boolean;
  message: string;
  added: number;
  updated: number;
  removed: number;
  total: number;
  covReport?: CoVReport;
}> {
  if (syncInProgress) {
    return { success: false, message: "同步正在進行中，請稍後再試", added: 0, updated: 0, removed: 0, total: 0 };
  }

  syncInProgress = true;
  lastSyncStatus = "running";
  console.log("[8891 Sync] Starting sync for 崑家汽車 (Shop ID: 1726)...");

  try {
    const dbConn = await getDb();
    if (!dbConn) {
      throw new Error("Database not available");
    }

    // Step 1: Fetch ALL vehicles from v5 API
    const { total: apiTotal, items: apiItems } = await fetchAllVehiclesFromApi();

    if (apiItems.length === 0) {
      throw new Error("API returned 0 vehicles - possible API issue");
    }

    // Step 2: Cross-verify with shop page
    const onSaleCount = await fetchShopOnSaleCount();
    if (onSaleCount > 0 && apiItems.length !== onSaleCount) {
      console.warn(`[8891 Sync] WARNING: API returned ${apiItems.length} but shop reports ${onSaleCount}`);
    }

    console.log(`[8891 Sync] Processing ${apiItems.length} vehicles from API...`);

    let added = 0;
    let updated = 0;
    let removed = 0;
    const processedIds: string[] = [];

    // Step 3a: Pre-fetch detail pages concurrently (3 at a time) for richer data.
    // This is ~3x faster than sequential fetching (was 1.5s * N, now ~1.5s * N/3).
    const CONCURRENCY = 3;
    const enrichedMap = new Map<string, Partial<ScrapedVehicle> | null>();

    for (let i = 0; i < apiItems.length; i += CONCURRENCY) {
      const batch = apiItems.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(apiV => fetchVehicleDetailEnriched(String(apiV.itemId)))
      );
      results.forEach((r, idx) => {
        const carId = String(batch[idx].itemId);
        enrichedMap.set(carId, r.status === "fulfilled" ? r.value : null);
      });
      // Polite delay between batches to avoid rate-limiting by 8891
      if (i + CONCURRENCY < apiItems.length) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Step 3b: Process DB operations sequentially (fast since no network I/O)
    for (const apiV of apiItems) {
      const carId = String(apiV.itemId);
      processedIds.push(carId);

      try {
        const scraped = apiVehicleToScraped(apiV);
        const enriched = enrichedMap.get(carId) || null;

        if (enriched) {
          if (enriched.photoUrls && enriched.photoCount && enriched.photoCount > 0) {
            scraped.photoUrls = enriched.photoUrls;
            scraped.photoCount = enriched.photoCount;
          }
          if (enriched.transmission) scraped.transmission = enriched.transmission;
          if (enriched.fuelType) scraped.fuelType = enriched.fuelType;
          if (enriched.bodyType) scraped.bodyType = enriched.bodyType;
        }

        const existing = await dbConn
          .select()
          .from(vehicles)
          .where(eq(vehicles.externalId, carId))
          .limit(1);

        if (existing.length === 0) {
          await dbConn.insert(vehicles).values({
            externalId: scraped.externalId,
            sourceUrl: scraped.sourceUrl,
            title: scraped.title,
            brand: scraped.brand,
            model: scraped.model,
            modelYear: scraped.modelYear,
            manufactureYear: scraped.manufactureYear,
            color: scraped.color,
            price: scraped.price,
            priceDisplay: scraped.priceDisplay,
            mileage: scraped.mileage,
            displacement: scraped.displacement,
            transmission: scraped.transmission,
            fuelType: scraped.fuelType,
            bodyType: scraped.bodyType,
            licenseDate: scraped.licenseDate,
            location: scraped.location,
            description: scraped.description,
            features: scraped.features,
            guarantees: scraped.guarantees,
            photoUrls: scraped.photoUrls,
            photoCount: scraped.photoCount,
            status: "available",
          });
          added++;
          console.log(`[8891 Sync] ✅ Added: ${scraped.brand} ${scraped.model} (${carId})`);
        } else {
          const current = existing[0];
          const updates: Record<string, any> = {};

          const currentPriceStr = current.price != null ? String(parseFloat(String(current.price))) : null;
          const scrapedPriceStr = scraped.price != null ? String(parseFloat(String(scraped.price))) : null;
          if (scrapedPriceStr && scrapedPriceStr !== currentPriceStr) {
            updates.price = scraped.price;
            updates.priceDisplay = scraped.priceDisplay;
          }
          if (scraped.photoUrls && scraped.photoUrls !== current.photoUrls) {
            updates.photoUrls = scraped.photoUrls;
            updates.photoCount = scraped.photoCount;
          }
          if (scraped.description && scraped.description !== current.description) updates.description = scraped.description;
          if (scraped.color && scraped.color !== current.color) updates.color = scraped.color;
          if (scraped.mileage && scraped.mileage !== current.mileage) updates.mileage = scraped.mileage;
          if (scraped.displacement && scraped.displacement !== current.displacement) updates.displacement = scraped.displacement;
          if (scraped.transmission && scraped.transmission !== current.transmission) updates.transmission = scraped.transmission;
          if (scraped.fuelType && scraped.fuelType !== current.fuelType) updates.fuelType = scraped.fuelType;
          if (scraped.bodyType && scraped.bodyType !== current.bodyType) updates.bodyType = scraped.bodyType;
          if (scraped.features && scraped.features !== current.features) updates.features = scraped.features;
          if (scraped.guarantees && scraped.guarantees !== current.guarantees) updates.guarantees = scraped.guarantees;
          if (scraped.title && scraped.title !== current.title) updates.title = scraped.title;
          if (scraped.sourceUrl && scraped.sourceUrl !== current.sourceUrl) updates.sourceUrl = scraped.sourceUrl;
          // Only reset "sold" back to "available" if the car reappears on 8891.
          // Do NOT override "reserved" (收訂金) — that's a manual status set by the admin.
          if (current.status === "sold") {
            updates.status = "available";
          }

          if (Object.keys(updates).length > 0) {
            await dbConn.update(vehicles).set(updates).where(eq(vehicles.id, current.id));
            updated++;
            console.log(`[8891 Sync] 🔄 Updated: ${current.brand} ${current.model} (${carId}) - ${Object.keys(updates).join(", ")}`);
          }
        }
      } catch (err: any) {
        console.error(`[8891 Sync] Error processing vehicle ${carId}:`, err.message);
      }
    }

    // Step 4: Mark vehicles NOT in API as sold (skip "reserved" — those are manually managed)
    const processedSet = new Set(processedIds);
    const allAvailable = await dbConn
      .select({ id: vehicles.id, externalId: vehicles.externalId, brand: vehicles.brand, model: vehicles.model })
      .from(vehicles)
      .where(eq(vehicles.status, "available"));

    for (const existing of allAvailable) {
      if (!processedSet.has(existing.externalId)) {
        await dbConn.update(vehicles).set({ status: "sold" }).where(eq(vehicles.id, existing.id));
        removed++;
        console.log(`[8891 Sync] 🚫 Marked sold: ${existing.brand} ${existing.model} (${existing.externalId})`);
      }
    }
    // Note: "reserved" vehicles are NOT auto-marked as sold even if they disappear from 8891.
    // The admin must manually change reserved → sold when the car is delivered.

    // Step 5: Run Chain of Verification (twice per week only)
    let covReport: CoVReport | null = null;
    if (shouldRunCoV()) {
      console.log("[8891 Sync] Running Chain of Verification (scheduled)...");
      covReport = await runChainOfVerification(apiItems, onSaleCount);
      lastCoVReport = covReport;
      lastCoVTime = new Date();
      console.log(`[8891 Sync] CoV: ${covReport.summary}`);
    } else {
      console.log("[8891 Sync] Skipping CoV (next check in " + Math.round((COV_INTERVAL_MS - (Date.now() - (lastCoVTime?.getTime() || 0))) / 3600000) + " hours)");
    }

    const total = processedIds.length;
    const message = `同步完成：新增 ${added} 台、更新 ${updated} 台、下架 ${removed} 台，共 ${total} 台在售`;

    // Notify owner with sync results (+ CoV report if it ran)
    const hasChanges = added > 0 || removed > 0;
    const covFailed = covReport && covReport.overallStatus !== "pass";
    if (hasChanges || covFailed) {
      const changes: string[] = [];
      if (added > 0) changes.push(`新增 ${added} 台`);
      if (updated > 0) changes.push(`更新 ${updated} 台`);
      if (removed > 0) changes.push(`下架 ${removed} 台`);

      const contentParts = [
        `崑家汽車 8891 同步完成：${changes.length > 0 ? changes.join("、") : "無變更"}。目前共 ${total} 台在售。`,
      ];

      if (covReport) {
        contentParts.push("", formatCoVReport(covReport));
      }

      contentParts.push("", "網站和 AI 客服已自動更新最新車輛資訊。");

      await notifyOwner({
        title: covReport ? "🔄 8891 車輛同步 + 驗證報告" : "🔄 8891 車輛同步報告",
        content: contentParts.join("\n"),
      });
    }

    // Invalidate cached vehicle list so chatbot picks up changes immediately
    db.invalidateVehicleCache();

    lastSyncTime = new Date();
    lastSyncStatus = (covReport && covReport.overallStatus === "fail") ? "partial" : "success";
    lastSyncMessage = message;
    lastSyncVehicleCount = total;
    syncInProgress = false;

    console.log(`[8891 Sync] ${message}`);
    return { success: true, message, added, updated, removed, total, covReport: covReport || undefined };
  } catch (err: any) {
    const message = `同步失敗：${err.message}`;
    lastSyncTime = new Date();
    lastSyncStatus = "failed";
    lastSyncMessage = message;
    syncInProgress = false;

    console.error(`[8891 Sync] ${message}`);

    // Notify owner of failure
    await notifyOwner({
      title: "❌ 8891 同步失敗",
      content: `崑家汽車 8891 同步失敗：${err.message}\n\n請檢查 8891 網站是否正常，或聯繫技術支援。`,
    });

    return { success: false, message, added: 0, updated: 0, removed: 0, total: 0 };
  }
}

/**
 * Run ONLY the Chain of Verification (without sync).
 * Useful for periodic health checks.
 */
export async function runCoVOnly(): Promise<CoVReport> {
  console.log("[8891 CoV] Running standalone verification...");

  try {
    const { items: apiItems } = await fetchAllVehiclesFromApi();
    const onSaleCount = await fetchShopOnSaleCount();
    const report = await runChainOfVerification(apiItems, onSaleCount);
    lastCoVReport = report;
    console.log(`[8891 CoV] ${report.summary}`);
    return report;
  } catch (err: any) {
    console.error("[8891 CoV] Verification failed:", err.message);
    return {
      timestamp: new Date(),
      overallStatus: "fail",
      steps: [{
        step: "0. 連線驗證",
        description: "無法連線 8891 API",
        status: "fail",
        expected: "API reachable",
        actual: err.message,
      }],
      summary: `CoV 驗證失敗：${err.message}`,
    };
  }
}

/**
 * Start the periodic sync scheduler.
 * Default: sync every 6 hours, CoV check twice per week (~every 3.5 days).
 */
export function startSyncScheduler(intervalHours = 6) {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`[8891 Sync] Scheduler started: syncing every ${intervalHours} hours`);

  // Run first sync after 60 seconds (give server time to start)
  setTimeout(async () => {
    console.log("[8891 Sync] Running initial sync...");
    await sync8891();
  }, 60000);

  // Schedule recurring syncs
  setInterval(async () => {
    console.log("[8891 Sync] Running scheduled sync...");
    await sync8891();
  }, intervalMs);

  // CoV-only checks now run twice per week (controlled by shouldRunCoV())
  // Check every 12 hours if it's time for a CoV run
  setInterval(async () => {
    if (!syncInProgress && shouldRunCoV()) {
      console.log("[8891 CoV] Running scheduled verification (twice per week)...");
      const report = await runCoVOnly();
      lastCoVTime = new Date();
    }
  }, 12 * 60 * 60 * 1000);
}
