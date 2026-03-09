import { eq, like, and, or, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  vehicles, Vehicle, InsertVehicle,
  conversations, Conversation, InsertConversation,
  messages, Message as DbMessage, InsertMessage,
  leadEvents, InsertLeadEvent,
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
