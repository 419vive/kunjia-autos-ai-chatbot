import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { notifyOwner } from "../_core/notification";
import { createLogger } from "../_core/logger";

const appointLog = createLogger("AppointmentNotify");

export const appointmentRouter = router({
  submit: publicProcedure
    .input(z.object({
      vehicleId: z.number().optional(),
      vehicleName: z.string().optional(),
      customerName: z.string().min(1),
      phone: z.string().min(1),
      preferredDate: z.string().optional(),
      preferredTime: z.string().optional(),
      timeFlexible: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createAppointment(input);

      const vehicleInfo = input.vehicleName || "未指定車輛";
      const timeInfo = input.timeFlexible === "yes"
        ? "暫不確定時間（彈性）"
        : `${input.preferredDate || "未選日期"} ${input.preferredTime || ""}`;
      const title = `📅 預約看車！${input.customerName} · ${vehicleInfo}`;
      const content = [
        `姓名：${input.customerName}`,
        `電話：${input.phone}`,
        `車輛：${vehicleInfo}`,
        `時間：${timeInfo}`,
        input.notes ? `備註：${input.notes}` : "",
        `---`,
        `⚠️ 請盡快撥打 ${input.phone} 確認預約！`,
      ].filter(Boolean).join("\n");

      try {
        await notifyOwner({ title, content });
        const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const ownerUserId = process.env.LINE_OWNER_USER_ID;
        const recipientIds: string[] = [];
        if (ownerUserId) recipientIds.push(ownerUserId);
        const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
        if (additionalIds) {
          additionalIds.split(",").map(id => id.trim()).filter(Boolean).forEach(id => {
            if (!recipientIds.includes(id)) recipientIds.push(id);
          });
        }
        appointLog.debug("LINE push config", { channelAccessToken: channelAccessToken ? "SET" : "MISSING", recipientCount: recipientIds.length });
        if (channelAccessToken && recipientIds.length > 0) {
          for (const recipientId of recipientIds) {
            try {
              const res = await fetch("https://api.line.me/v2/bot/message/push", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
                body: JSON.stringify({ to: recipientId, messages: [{ type: "text", text: `${title}\n\n${content}` }] }),
              });
              const resBody = await res.text();
              appointLog.debug("LINE push result", { recipientId, status: res.status, body: resBody });
            } catch (pushErr) {
              appointLog.error("LINE push failed", { recipientId, error: String(pushErr) });
            }
          }
        }
      } catch (err) {
        appointLog.error("Notification failed", { error: String(err) });
      }

      return { success: true, id };
    }),

  list: adminProcedure.query(async () => {
    return db.getAppointments();
  }),

  updateStatus: adminProcedure
    .input(z.object({ id: z.number(), status: z.enum(["new", "confirmed", "completed", "cancelled"]) }))
    .mutation(async ({ input }) => {
      await db.updateAppointmentStatus(input.id, input.status);
      return { success: true };
    }),
});
