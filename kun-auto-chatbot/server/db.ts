import { eq, like, and, or, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  vehicles, Vehicle, InsertVehicle,
  conversations, Conversation, InsertConversation,
  messages, Message as DbMessage, InsertMessage,
  leadEvents, InsertLeadEvent,
  analyticsEvents, InsertAnalyticsEvent,
  pageViews, InsertPageView,
  loanInquiries, InsertLoanInquiry,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER QUERIES ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ VEHICLE QUERIES ============

export async function getAllVehicles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles).where(eq(vehicles.status, "available")).orderBy(asc(vehicles.brand), asc(vehicles.model));
}

export async function getVehicleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return result[0];
}

export async function searchVehicles(filters: {
  brand?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: string;
  maxYear?: string;
  fuelType?: string;
  bodyType?: string;
  query?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(vehicles.status, "available")];
  
  if (filters.brand) conditions.push(like(vehicles.brand, `%${filters.brand}%`));
  if (filters.model) conditions.push(like(vehicles.model, `%${filters.model}%`));
  if (filters.minPrice) conditions.push(gte(vehicles.price, filters.minPrice.toString()));
  if (filters.maxPrice) conditions.push(lte(vehicles.price, filters.maxPrice.toString()));
  if (filters.minYear) conditions.push(gte(vehicles.modelYear, filters.minYear));
  if (filters.maxYear) conditions.push(lte(vehicles.modelYear, filters.maxYear));
  if (filters.fuelType) conditions.push(eq(vehicles.fuelType, filters.fuelType));
  if (filters.bodyType) conditions.push(like(vehicles.bodyType, `%${filters.bodyType}%`));
  if (filters.query) {
    conditions.push(
      or(
        like(vehicles.brand, `%${filters.query}%`),
        like(vehicles.model, `%${filters.query}%`),
        like(vehicles.title, `%${filters.query}%`),
        like(vehicles.features, `%${filters.query}%`),
        like(vehicles.description, `%${filters.query}%`)
      )!
    );
  }
  
  return db.select().from(vehicles).where(and(...conditions)).orderBy(asc(vehicles.price));
}

export async function getVehicleBrands() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ brand: vehicles.brand }).from(vehicles)
    .where(eq(vehicles.status, "available"))
    .groupBy(vehicles.brand)
    .orderBy(asc(vehicles.brand));
  return result.map(r => r.brand);
}

// ============ CONVERSATION QUERIES ============

export async function createConversation(data: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(conversations).values(data);
  return { id: Number(result[0].insertId), ...data };
}

export async function getConversationBySessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(eq(conversations.sessionId, sessionId)).limit(1);
  return result[0];
}

export async function updateConversation(id: number, data: Partial<InsertConversation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set(data).where(eq(conversations.id, id));
}

export async function listConversations(filters?: {
  channel?: string;
  status?: string;
  leadStatus?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  
  const conditions: any[] = [];
  if (filters?.channel && filters.channel !== 'all') conditions.push(eq(conversations.channel, filters.channel as any));
  if (filters?.status && filters.status !== 'all') conditions.push(eq(conversations.status, filters.status as any));
  if (filters?.leadStatus && filters.leadStatus !== 'all') conditions.push(eq(conversations.leadStatus, filters.leadStatus as any));
  if (filters?.minScore) conditions.push(gte(conversations.leadScore, filters.minScore));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  
  const [items, countResult] = await Promise.all([
    db.select().from(conversations).where(where).orderBy(desc(conversations.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(conversations).where(where),
  ]);
  
  return { items, total: Number(countResult[0]?.count || 0) };
}

// ============ MESSAGE QUERIES ============

export async function addMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(data);
  return { id: Number(result[0].insertId), ...data };
}

export async function getMessagesByConversation(conversationId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

// ============ LEAD EVENTS ============

export async function addLeadEvent(data: InsertLeadEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(leadEvents).values(data);
}

export async function getLeadEvents(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leadEvents)
    .where(eq(leadEvents.conversationId, conversationId))
    .orderBy(desc(leadEvents.createdAt));
}

// ============ ANALYTICS EVENTS ============

export async function addAnalyticsEvent(data: InsertAnalyticsEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(analyticsEvents).values(data);
}

export async function getAnalyticsEvents(filters?: {
  eventCategory?: string;
  channel?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.eventCategory) conditions.push(eq(analyticsEvents.eventCategory, filters.eventCategory));
  if (filters?.channel) conditions.push(eq(analyticsEvents.channel, filters.channel as any));
  if (filters?.startDate) conditions.push(gte(analyticsEvents.createdAt, filters.startDate));
  if (filters?.endDate) conditions.push(lte(analyticsEvents.createdAt, filters.endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(analyticsEvents).where(where).orderBy(desc(analyticsEvents.createdAt)).limit(filters?.limit || 200);
}

// ============ REPORT QUERIES ============

/** Daily conversation counts for time-series chart */
export async function getDailyConversationStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(conversations.createdAt, startDate));
  if (endDate) conditions.push(lte(conversations.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    date: sql<string>`DATE(${conversations.createdAt})`.as('date'),
    count: sql<number>`count(*)`.as('count'),
    channel: conversations.channel,
  }).from(conversations).where(where)
    .groupBy(sql`DATE(${conversations.createdAt})`, conversations.channel)
    .orderBy(sql`DATE(${conversations.createdAt})`);
}

/** Daily message volume */
export async function getDailyMessageStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(messages.createdAt, startDate));
  if (endDate) conditions.push(lte(messages.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    date: sql<string>`DATE(${messages.createdAt})`.as('date'),
    count: sql<number>`count(*)`.as('count'),
    role: messages.role,
  }).from(messages).where(where)
    .groupBy(sql`DATE(${messages.createdAt})`, messages.role)
    .orderBy(sql`DATE(${messages.createdAt})`);
}

/** Lead conversion funnel */
export async function getLeadConversionFunnel(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(conversations.createdAt, startDate));
  if (endDate) conditions.push(lte(conversations.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    leadStatus: conversations.leadStatus,
    count: sql<number>`count(*)`.as('count'),
    avgScore: sql<number>`ROUND(AVG(${conversations.leadScore}), 1)`.as('avgScore'),
  }).from(conversations).where(where)
    .groupBy(conversations.leadStatus);
}

/** Popular vehicles by interest (mentioned in conversations) */
export async function getPopularVehicles(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  // Get vehicles that appear in interestedVehicleIds
  const convs = await db.select({
    interestedVehicleIds: conversations.interestedVehicleIds,
  }).from(conversations)
    .where(sql`${conversations.interestedVehicleIds} IS NOT NULL AND ${conversations.interestedVehicleIds} != ''`);

  // Count vehicle mentions
  const vehicleCounts = new Map<number, number>();
  for (const c of convs) {
    if (!c.interestedVehicleIds) continue;
    const ids = c.interestedVehicleIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    for (const id of ids) {
      vehicleCounts.set(id, (vehicleCounts.get(id) || 0) + 1);
    }
  }

  if (vehicleCounts.size === 0) return [];

  // Get top vehicles
  const topIds = Array.from(vehicleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const vehicleIds = topIds.map(([id]) => id);
  const vehicleList = await db.select().from(vehicles).where(inArray(vehicles.id, vehicleIds));

  return topIds.map(([id, count]) => {
    const v = vehicleList.find(v => v.id === id);
    return v ? { ...v, interestCount: count } : null;
  }).filter(Boolean);
}

/** Lead score distribution */
export async function getLeadScoreDistribution() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    range: sql<string>`CASE
      WHEN ${conversations.leadScore} = 0 THEN '0'
      WHEN ${conversations.leadScore} BETWEEN 1 AND 30 THEN '1-30'
      WHEN ${conversations.leadScore} BETWEEN 31 AND 60 THEN '31-60'
      WHEN ${conversations.leadScore} BETWEEN 61 AND 100 THEN '61-100'
      WHEN ${conversations.leadScore} BETWEEN 101 AND 150 THEN '101-150'
      ELSE '150+'
    END`.as('range'),
    count: sql<number>`count(*)`.as('count'),
  }).from(conversations)
    .groupBy(sql`CASE
      WHEN ${conversations.leadScore} = 0 THEN '0'
      WHEN ${conversations.leadScore} BETWEEN 1 AND 30 THEN '1-30'
      WHEN ${conversations.leadScore} BETWEEN 31 AND 60 THEN '31-60'
      WHEN ${conversations.leadScore} BETWEEN 61 AND 100 THEN '61-100'
      WHEN ${conversations.leadScore} BETWEEN 101 AND 150 THEN '101-150'
      ELSE '150+'
    END`);
}

/** Lead event type breakdown */
export async function getLeadEventBreakdown(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(leadEvents.createdAt, startDate));
  if (endDate) conditions.push(lte(leadEvents.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    eventType: leadEvents.eventType,
    count: sql<number>`count(*)`.as('count'),
    totalScore: sql<number>`SUM(${leadEvents.scoreChange})`.as('totalScore'),
  }).from(leadEvents).where(where)
    .groupBy(leadEvents.eventType)
    .orderBy(sql`count(*) DESC`);
}

/** Analytics event breakdown (for LINE behavioral tracking) */
export async function getAnalyticsEventBreakdown(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(analyticsEvents.createdAt, startDate));
  if (endDate) conditions.push(lte(analyticsEvents.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    eventCategory: analyticsEvents.eventCategory,
    eventAction: analyticsEvents.eventAction,
    count: sql<number>`count(*)`.as('count'),
  }).from(analyticsEvents).where(where)
    .groupBy(analyticsEvents.eventCategory, analyticsEvents.eventAction)
    .orderBy(sql`count(*) DESC`);
}

/** Get all conversations for CSV export */
export async function getAllConversationsForExport(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(conversations.createdAt, startDate));
  if (endDate) conditions.push(lte(conversations.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(conversations).where(where).orderBy(desc(conversations.createdAt));
}

/** Get all lead events for CSV export */
export async function getAllLeadEventsForExport(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(leadEvents.createdAt, startDate));
  if (endDate) conditions.push(lte(leadEvents.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(leadEvents).where(where).orderBy(desc(leadEvents.createdAt));
}

// ============ PAGE VIEW TRACKING ============

export async function addPageView(data: InsertPageView) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pageViews).values(data);
}

export async function updatePageViewDuration(id: number, duration: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(pageViews).set({ duration }).where(eq(pageViews.id, id));
}

/** Web analytics: page view summary stats */
export async function getWebAnalyticsSummary(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(pageViews.createdAt, startDate));
  if (endDate) conditions.push(lte(pageViews.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalViews, uniqueVisitors, avgDuration] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(pageViews).where(where),
    db.select({ count: sql<number>`count(DISTINCT ${pageViews.sessionHash})` }).from(pageViews).where(where),
    db.select({ avg: sql<number>`ROUND(AVG(CASE WHEN ${pageViews.duration} > 0 THEN ${pageViews.duration} END), 0)` }).from(pageViews).where(where),
  ]);

  return {
    pageViews: Number(totalViews[0]?.count || 0),
    uniqueVisitors: Number(uniqueVisitors[0]?.count || 0),
    avgDuration: Number(avgDuration[0]?.avg || 0),
  };
}

/** Daily visitor time-series */
export async function getDailyVisitorStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(pageViews.createdAt, startDate));
  if (endDate) conditions.push(lte(pageViews.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    date: sql<string>`DATE(${pageViews.createdAt})`.as('date'),
    pageViews: sql<number>`count(*)`.as('pageViews'),
    visitors: sql<number>`count(DISTINCT ${pageViews.sessionHash})`.as('visitors'),
  }).from(pageViews).where(where)
    .groupBy(sql`DATE(${pageViews.createdAt})`)
    .orderBy(sql`DATE(${pageViews.createdAt})`);
}

/** Most viewed pages */
export async function getTopPages(startDate?: Date, endDate?: Date, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(pageViews.createdAt, startDate));
  if (endDate) conditions.push(lte(pageViews.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    path: pageViews.path,
    visitors: sql<number>`count(DISTINCT ${pageViews.sessionHash})`.as('visitors'),
    views: sql<number>`count(*)`.as('views'),
  }).from(pageViews).where(where)
    .groupBy(pageViews.path)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);
}

/** Referrer breakdown */
export async function getTopReferrers(startDate?: Date, endDate?: Date, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(pageViews.createdAt, startDate));
  if (endDate) conditions.push(lte(pageViews.createdAt, endDate));
  // Only count non-null referrers
  conditions.push(sql`${pageViews.referrerDomain} IS NOT NULL AND ${pageViews.referrerDomain} != ''`);
  const where = and(...conditions);
  return db.select({
    referrerDomain: pageViews.referrerDomain,
    visitors: sql<number>`count(DISTINCT ${pageViews.sessionHash})`.as('visitors'),
  }).from(pageViews).where(where)
    .groupBy(pageViews.referrerDomain)
    .orderBy(sql`count(DISTINCT ${pageViews.sessionHash}) DESC`)
    .limit(limit);
}

/** Browser breakdown */
export async function getBrowserStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(pageViews.createdAt, startDate));
  if (endDate) conditions.push(lte(pageViews.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    browser: pageViews.browser,
    visitors: sql<number>`count(DISTINCT ${pageViews.sessionHash})`.as('visitors'),
  }).from(pageViews).where(where)
    .groupBy(pageViews.browser)
    .orderBy(sql`count(DISTINCT ${pageViews.sessionHash}) DESC`);
}

/** OS breakdown */
export async function getOsStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(pageViews.createdAt, startDate));
  if (endDate) conditions.push(lte(pageViews.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    os: pageViews.os,
    visitors: sql<number>`count(DISTINCT ${pageViews.sessionHash})`.as('visitors'),
  }).from(pageViews).where(where)
    .groupBy(pageViews.os)
    .orderBy(sql`count(DISTINCT ${pageViews.sessionHash}) DESC`);
}

/** Device breakdown */
export async function getDeviceStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(pageViews.createdAt, startDate));
  if (endDate) conditions.push(lte(pageViews.createdAt, endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    device: pageViews.device,
    visitors: sql<number>`count(DISTINCT ${pageViews.sessionHash})`.as('visitors'),
  }).from(pageViews).where(where)
    .groupBy(pageViews.device)
    .orderBy(sql`count(DISTINCT ${pageViews.sessionHash}) DESC`);
}

/** Country/Region breakdown */
export async function getCountryStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(pageViews.createdAt, startDate));
  if (endDate) conditions.push(lte(pageViews.createdAt, endDate));
  conditions.push(sql`${pageViews.country} IS NOT NULL AND ${pageViews.country} != ''`);
  const where = and(...conditions);
  return db.select({
    country: pageViews.country,
    visitors: sql<number>`count(DISTINCT ${pageViews.sessionHash})`.as('visitors'),
  }).from(pageViews).where(where)
    .groupBy(pageViews.country)
    .orderBy(sql`count(DISTINCT ${pageViews.sessionHash}) DESC`);
}

// ============ DASHBOARD STATS ============

export async function getDashboardStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;
  
  const dateConditions: any[] = [];
  if (startDate) dateConditions.push(gte(conversations.createdAt, startDate));
  if (endDate) dateConditions.push(lte(conversations.createdAt, endDate));
  const dateWhere = dateConditions.length > 0 ? and(...dateConditions) : undefined;
  
  const [totalConvos, qualifiedLeads, hotLeads, channelStats, vehicleInterest] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(conversations).where(dateWhere),
    db.select({ count: sql<number>`count(*)` }).from(conversations)
      .where(and(gte(conversations.leadScore, 60), ...(dateConditions.length ? dateConditions : []))),
    db.select({ count: sql<number>`count(*)` }).from(conversations)
      .where(and(eq(conversations.leadStatus, "hot"), ...(dateConditions.length ? dateConditions : []))),
    db.select({
      channel: conversations.channel,
      count: sql<number>`count(*)`,
    }).from(conversations).where(dateWhere).groupBy(conversations.channel),
    db.select({
      count: sql<number>`count(*)`,
      avgScore: sql<number>`avg(leadScore)`,
    }).from(conversations).where(dateWhere),
  ]);
  
  return {
    totalConversations: Number(totalConvos[0]?.count || 0),
    qualifiedLeads: Number(qualifiedLeads[0]?.count || 0),
    hotLeads: Number(hotLeads[0]?.count || 0),
    channelBreakdown: channelStats,
    avgLeadScore: Number(vehicleInterest[0]?.avgScore || 0),
  };
}

// ============ LOAN INQUIRIES ============

export async function createLoanInquiry(data: InsertLoanInquiry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(loanInquiries).values(data);
  return result.insertId;
}

export async function getLoanInquiries(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(loanInquiries).orderBy(desc(loanInquiries.createdAt)).limit(limit);
}

export async function updateLoanInquiryStatus(id: number, status: "new" | "contacted" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return;
  await db.update(loanInquiries).set({ status }).where(eq(loanInquiries.id, id));
}
