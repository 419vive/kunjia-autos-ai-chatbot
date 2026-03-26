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
  videoUrl: text("videoUrl"),
  photos360Urls: text("photos360Urls"),
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
  status: mysqlEnum("status", ["active", "closed", "follow_up", "human_handoff"]).default("active").notNull(),
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

/**
 * Analytics events for tracking LINE behavioral data
 * Tracks: follow/unfollow, rich menu clicks, quick reply taps, photo views, FAQ clicks, postbacks
 */
export const analyticsEvents = mysqlTable("analyticsEvents", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId"),
  userId: varchar("userId", { length: 64 }),
  eventCategory: varchar("eventCategory", { length: 32 }).notNull(), // line_follow, line_unfollow, rich_menu, quick_reply, photo_view, faq_click, message, postback
  eventAction: varchar("eventAction", { length: 128 }).notNull(), // specific action e.g. "看車庫存", "預約賞車"
  eventLabel: varchar("eventLabel", { length: 256 }), // additional context
  channel: mysqlEnum("channel", ["web", "line", "facebook", "youtube", "other"]).default("line").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

/**
 * Page views for website analytics (like Umami/Plausible)
 * Tracks every page visit with browser, OS, device, referrer, country
 */
export const pageViews = mysqlTable("pageViews", {
  id: int("id").autoincrement().primaryKey(),
  sessionHash: varchar("sessionHash", { length: 64 }).notNull(), // hashed visitor identifier
  path: varchar("path", { length: 512 }).notNull(),
  referrer: varchar("referrer", { length: 512 }),
  referrerDomain: varchar("referrerDomain", { length: 256 }),
  browser: varchar("browser", { length: 64 }),
  os: varchar("os", { length: 64 }),
  device: varchar("device", { length: 32 }), // mobile, desktop, tablet
  country: varchar("country", { length: 64 }),
  region: varchar("region", { length: 128 }),
  language: varchar("language", { length: 16 }),
  screenWidth: int("screenWidth"),
  duration: int("duration").default(0), // seconds spent on page
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;

/**
 * Loan inquiry submissions from potential customers
 */
export const loanInquiries = mysqlTable("loanInquiries", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: int("vehicleId"),
  vehicleName: varchar("vehicleName", { length: 256 }),
  customerName: varchar("customerName", { length: 128 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  gender: varchar("gender", { length: 16 }),
  age: varchar("age", { length: 16 }),
  hasLicense: varchar("hasLicense", { length: 16 }),
  employmentType: varchar("employmentType", { length: 64 }),
  employmentDuration: varchar("employmentDuration", { length: 64 }),
  hasInsurance: varchar("hasInsurance", { length: 64 }),
  previousLoans: varchar("previousLoans", { length: 128 }),
  purchaseMethod: varchar("purchaseMethod", { length: 64 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["new", "contacted", "approved", "rejected"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoanInquiry = typeof loanInquiries.$inferSelect;
export type InsertLoanInquiry = typeof loanInquiries.$inferInsert;

/**
 * Appointment bookings for vehicle visits
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: int("vehicleId"),
  vehicleName: varchar("vehicleName", { length: 256 }),
  customerName: varchar("customerName", { length: 128 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  preferredDate: varchar("preferredDate", { length: 32 }),
  preferredTime: varchar("preferredTime", { length: 64 }),
  timeFlexible: varchar("timeFlexible", { length: 16 }).default("no"),
  notes: text("notes"),
  status: mysqlEnum("status", ["new", "confirmed", "completed", "cancelled"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
