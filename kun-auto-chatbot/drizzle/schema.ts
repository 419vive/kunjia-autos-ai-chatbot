import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Vehicle inventory from 8891
 */
export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 32 }).notNull().unique(),
  sourceUrl: text("sourceUrl"),
  title: text("title"),
  brand: varchar("brand", { length: 64 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  modelYear: varchar("modelYear", { length: 8 }),
  manufactureYear: varchar("manufactureYear", { length: 8 }),
  color: varchar("color", { length: 32 }),
  price: decimal("price", { precision: 10, scale: 1 }),
  priceDisplay: varchar("priceDisplay", { length: 32 }),
  mileage: varchar("mileage", { length: 32 }),
  displacement: varchar("displacement", { length: 32 }),
  transmission: varchar("transmission", { length: 32 }),
  fuelType: varchar("fuelType", { length: 32 }),
  bodyType: varchar("bodyType", { length: 32 }),
  licenseDate: varchar("licenseDate", { length: 16 }),
  location: varchar("location", { length: 64 }),
  description: text("description"),
  features: text("features"),
  guarantees: text("guarantees"),
  photoUrls: text("photoUrls"),
  photoCount: int("photoCount").default(0),
  status: mysqlEnum("status", ["available", "sold", "reserved"]).default("available").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

/**
 * Conversations with customers
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  customerName: varchar("customerName", { length: 128 }),
  customerContact: varchar("customerContact", { length: 256 }),
  channel: mysqlEnum("channel", ["web", "line", "facebook", "youtube", "other"]).default("web").notNull(),
  status: mysqlEnum("status", ["active", "closed", "follow_up"]).default("active").notNull(),
  leadScore: int("leadScore").default(0),
  leadStatus: mysqlEnum("leadStatus", ["new", "qualified", "hot", "converted", "lost"]).default("new").notNull(),
  tags: text("tags"),
  summary: text("summary"),
  interestedVehicleIds: text("interestedVehicleIds"),
  notifiedOwner: int("notifiedOwner").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Individual messages within conversations
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Lead scoring events log
 */
export const leadEvents = mysqlTable("leadEvents", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  scoreChange: int("scoreChange").notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadEvent = typeof leadEvents.$inferSelect;
export type InsertLeadEvent = typeof leadEvents.$inferInsert;
