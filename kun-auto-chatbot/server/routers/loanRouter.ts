import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { notifyOwner } from "../_core/notification";
import { createLogger } from "../_core/logger";

const loanLog = createLogger("LoanNotify");

export const loanRouter = router({
  submit: publicProcedure
    .input(z.object({
      vehicleId: z.number().optional(),
      vehicleName: z.string().optional(),
      customerName: z.string().min(1),
      phone: z.string().min(1),
      gender: z.string().optional(),
      age: z.string().optional(),
      hasLicense: z.string().optional(),
      employmentType: z.string().optional(),
      employmentDuration: z.string().optional(),
      hasInsurance: z.string().optional(),
      previousLoans: z.string().optional(),
      purchaseMethod: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createLoanInquiry(input);

      // Notify owner via LINE + system notification
      const vehicleInfo = input.vehicleName || "未指定車輛";
      const title = `💰 貸款諮詢申請！${input.customerName} · ${vehicleInfo}`;
      const content = [
        `姓名：${input.customerName}`,
        `電話：${input.phone}`,
        `性別：${input.gender || "未填"}`,
        `年紀：${input.age || "未填"}`,
        `駕照：${input.hasLicense || "未填"}`,
        `工作類型：${input.employmentType || "未填"}`,
        `工作年資：${input.employmentDuration || "未填"}`,
        `勞健保：${input.hasInsurance || "未填"}`,
        `貸款紀錄：${input.previousLoans || "未填"}`,
        `購買方式：${input.purchaseMethod || "未填"}`,
        `詢問車輛：${vehicleInfo}`,
        input.notes ? `備註：${input.notes}` : "",
        `---`,
        `⚠️ 請盡快撥打 ${input.phone} 聯繫此客戶！`,
      ].filter(Boolean).join("\n");

      try {
        await notifyOwner({ title, content });

        // Also push to LINE owner
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
        loanLog.debug("LINE push config", { channelAccessToken: channelAccessToken ? "SET" : "MISSING", recipientCount: recipientIds.length });
        if (channelAccessToken && recipientIds.length > 0) {
          for (const recipientId of recipientIds) {
            try {
              const res = await fetch("https://api.line.me/v2/bot/message/push", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${channelAccessToken}` },
                body: JSON.stringify({ to: recipientId, messages: [{ type: "text", text: `${title}\n\n${content}` }] }),
              });
              const resBody = await res.text();
              loanLog.debug("LINE push result", { recipientId, status: res.status, body: resBody });
            } catch (pushErr) {
              loanLog.error("LINE push failed", { recipientId, error: String(pushErr) });
            }
          }
        }
      } catch (err) {
        loanLog.error("Inquiry notification failed", { error: String(err) });
      }

      return { success: true, id };
    }),

  list: adminProcedure.query(async () => {
    return db.getLoanInquiries();
  }),

  updateStatus: adminProcedure
    .input(z.object({ id: z.number(), status: z.enum(["new", "contacted", "approved", "rejected"]) }))
    .mutation(async ({ input }) => {
      await db.updateLoanInquiryStatus(input.id, input.status);
      return { success: true };
    }),
});
