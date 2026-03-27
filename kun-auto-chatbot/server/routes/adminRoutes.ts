import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as db from "../db";
import { sync8891, getSyncStatus } from "../sync8891";
import { deployRichMenu, getRichMenuStatus, cancelDefaultRichMenu } from "../lineRichMenu";
import { logSecurityEvent, getSecurityEvents } from "../security";

export const adminRouter = router({
  dashboard: adminProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(async ({ input }) => {
      const stats = await db.getDashboardStats(input?.startDate, input?.endDate);
      const allVehicles = await db.getAllVehicles();
      return { stats, vehicleCount: allVehicles.length };
    }),

  conversations: adminProcedure
    .input(z.object({
      channel: z.string().optional(),
      status: z.string().optional(),
      leadStatus: z.string().optional(),
      minScore: z.number().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listConversations(input || {});
    }),

  conversationDetail: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db2 = await db.getDb();
      if (!db2) return null;
      const { conversations: convTable, messages: msgTable, leadEvents: evtTable } = await import("../../drizzle/schema");
      const [convs] = await Promise.all([
        db2.select().from(convTable).where(eq(convTable.id, input.id)).limit(1),
      ]);
      if (!convs[0]) return null;
      const [msgs, events] = await Promise.all([
        db.getMessagesByConversation(input.id),
        db.getLeadEvents(input.id),
      ]);
      return { conversation: convs[0], messages: msgs, leadEvents: events };
    }),

  updateConversation: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["active", "closed", "follow_up"]).optional(),
      leadStatus: z.enum(["new", "qualified", "hot", "converted", "lost"]).optional(),
      tags: z.string().optional(),
      customerName: z.string().optional(),
      customerContact: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateConversation(id, data);
      return { success: true };
    }),

  vehicles: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20).optional(),
      offset: z.number().min(0).default(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      const allVehicles = await db.getAllVehicles();
      if (!input || (input.limit === undefined && input.offset === undefined)) {
        return { items: allVehicles, total: allVehicles.length };
      }
      const limit = input.limit ?? 20;
      const offset = input.offset ?? 0;
      return { items: allVehicles.slice(offset, offset + limit), total: allVehicles.length };
    }),

  updateVehicleStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["available", "sold", "reserved"]),
    }))
    .mutation(async ({ input }) => {
      const db2 = await db.getDb();
      if (!db2) throw new Error("Database not available");
      const { vehicles: vTable } = await import("../../drizzle/schema");
      await db2.update(vTable).set({ status: input.status }).where(eq(vTable.id, input.id));
      return { success: true };
    }),

  updateVehicleMedia: adminProcedure
    .input(z.object({
      id: z.number(),
      videoUrl: z.string().nullable().optional(),
      photos360Urls: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db2 = await db.getDb();
      if (!db2) throw new Error("Database not available");
      const { vehicles: vTable } = await import("../../drizzle/schema");
      const updates: Record<string, any> = {};
      if (input.videoUrl !== undefined) updates.videoUrl = input.videoUrl;
      if (input.photos360Urls !== undefined) updates.photos360Urls = input.photos360Urls;
      if (Object.keys(updates).length > 0) {
        await db2.update(vTable).set(updates).where(eq(vTable.id, input.id));
      }
      return { success: true };
    }),

  // 8891 Sync endpoints
  syncStatus: adminProcedure.query(async () => {
    return getSyncStatus();
  }),

  triggerSync: adminProcedure.mutation(async () => {
    const result = await sync8891();
    return result;
  }),

  // LINE Rich Menu endpoints
  richMenuStatus: adminProcedure.query(async () => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return { hasDefault: false, defaultMenuId: null, totalMenus: 0, menus: [], configured: false };
    const status = await getRichMenuStatus(token);
    return { ...status, configured: true };
  }),

  deployRichMenu: adminProcedure.mutation(async () => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");
    return deployRichMenu(token);
  }),

  removeRichMenu: adminProcedure.mutation(async () => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");
    const success = await cancelDefaultRichMenu(token);
    return { success };
  }),

  // ============ SECURITY AUDIT ENDPOINTS ============
  securityEvents: adminProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      logSecurityEvent({
        eventType: "pii_access",
        severity: "low",
        source: "admin_dashboard",
        details: "Admin accessed security audit log",
      });
      return getSecurityEvents(input?.limit || 50);
    }),

  // ============ ANALYTICS & REPORTS ============

  /** Daily conversation trends (time-series) */
  dailyConversations: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getDailyConversationStats(start, end);
    }),

  /** Daily message volume */
  dailyMessages: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getDailyMessageStats(start, end);
    }),

  /** Lead conversion funnel */
  leadFunnel: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getLeadConversionFunnel(start, end);
    }),

  /** Popular vehicles by customer interest */
  popularVehicles: adminProcedure.query(async () => {
    return db.getPopularVehicles(10);
  }),

  /** Lead score distribution */
  leadScoreDistribution: adminProcedure.query(async () => {
    return db.getLeadScoreDistribution();
  }),

  /** Lead event type breakdown */
  leadEventBreakdown: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getLeadEventBreakdown(start, end);
    }),

  /** LINE behavioral analytics */
  lineAnalytics: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getAnalyticsEventBreakdown(start, end);
    }),

  // ============ WEB ANALYTICS (like Umami) ============

  /** Web analytics summary (page views, visitors, duration) */
  webSummary: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getWebAnalyticsSummary(start, end);
    }),

  /** Daily visitor time-series */
  dailyVisitors: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getDailyVisitorStats(start, end);
    }),

  /** Top pages */
  topPages: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getTopPages(start, end);
    }),

  /** Top referrers */
  topReferrers: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getTopReferrers(start, end);
    }),

  /** Browser stats */
  browserStats: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getBrowserStats(start, end);
    }),

  /** OS stats */
  osStats: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getOsStats(start, end);
    }),

  /** Device stats */
  deviceStats: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getDeviceStats(start, end);
    }),

  /** Country stats */
  countryStats: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      return db.getCountryStats(start, end);
    }),

  // ============ CSV EXPORT ============

  /** Export conversations as CSV */
  exportConversations: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      const rows = await db.getAllConversationsForExport(start, end);
      const header = "ID,SessionID,CustomerName,Channel,Status,LeadScore,LeadStatus,CreatedAt,UpdatedAt";
      const csvRows = rows.map(r =>
        `${r.id},"${r.sessionId}","${(r.customerName || '').replace(/"/g, '""')}",${r.channel},${r.status},${r.leadScore},${r.leadStatus},"${r.createdAt}","${r.updatedAt}"`
      );
      return { csv: [header, ...csvRows].join("\n"), filename: `conversations_${new Date().toISOString().split('T')[0]}.csv` };
    }),

  /** Export lead events as CSV */
  exportLeadEvents: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const start = input?.startDate ? new Date(input.startDate) : undefined;
      const end = input?.endDate ? new Date(input.endDate) : undefined;
      const rows = await db.getAllLeadEventsForExport(start, end);
      const header = "ID,ConversationID,EventType,ScoreChange,Reason,CreatedAt";
      const csvRows = rows.map(r =>
        `${r.id},${r.conversationId},"${r.eventType}",${r.scoreChange},"${(r.reason || '').replace(/"/g, '""')}","${r.createdAt}"`
      );
      return { csv: [header, ...csvRows].join("\n"), filename: `lead_events_${new Date().toISOString().split('T')[0]}.csv` };
    }),

  /** Export vehicles as CSV */
  exportVehicles: adminProcedure.query(async () => {
    const rows = await db.getAllVehicles();
    const header = "ID,ExternalID,Brand,Model,Year,Price,Mileage,Color,Transmission,FuelType,Status";
    const csvRows = rows.map(r =>
      `${r.id},"${r.externalId}","${r.brand}","${r.model}","${r.modelYear || ''}","${r.priceDisplay || r.price || ''}","${r.mileage || ''}","${r.color || ''}","${r.transmission || ''}","${r.fuelType || ''}",${r.status}`
    );
    return { csv: [header, ...csvRows].join("\n"), filename: `vehicles_${new Date().toISOString().split('T')[0]}.csv` };
  }),
});
