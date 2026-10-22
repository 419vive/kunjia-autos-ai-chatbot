import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  pickAction,
  safeDiv,
  toDailyRow,
  toMonthlyRow,
  formatDailyCsv,
  formatMonthlyCsv,
  fmtPercent,
  fmtNumber,
  DAILY_CSV_HEADER,
  MONTHLY_CSV_HEADER,
  getDailyRows,
  getMonthlyRow,
  type RawInsight,
} from "./metaReporting";
import type { MetaAdsConfig } from "./metaAds";

const cfg: MetaAdsConfig = {
  accessToken: "EAAtesttoken1234567890",
  adAccountId: "act_123456",
  pageId: "999",
  pixelId: "936259169015798",
  apiVersion: "v21.0",
};

const insight = (o: Partial<RawInsight>): RawInsight => ({
  date_start: "2026-08-07",
  spend: "0",
  impressions: "0",
  inline_link_clicks: "0",
  actions: [],
  ...o,
});

const lead = (n: number) => ({ action_type: "offsite_conversion.fb_pixel_lead", value: String(n) });

describe("pickAction", () => {
  it("returns 0 when there are no actions", () => {
    expect(pickAction(undefined, ["lead"])).toBe(0);
    expect(pickAction([], ["lead"])).toBe(0);
  });

  // Meta reports one conversion under several action_types; summing double-counts.
  it("takes the first matching alias rather than summing duplicates", () => {
    const actions = [
      { action_type: "lead", value: "3" },
      { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
    ];
    expect(pickAction(actions, ["offsite_conversion.fb_pixel_lead", "lead"])).toBe(3);
  });

  it("falls through to a later alias when the first is absent", () => {
    expect(pickAction([{ action_type: "lead", value: "5" }], ["offsite_conversion.fb_pixel_lead", "lead"])).toBe(5);
  });

  it("treats a non-numeric value as 0", () => {
    expect(pickAction([{ action_type: "lead", value: "abc" }], ["lead"])).toBe(0);
  });
});

describe("safeDiv", () => {
  it("divides normally", () => {
    expect(safeDiv(10, 4)).toBe(2.5);
  });
  it("returns null instead of Infinity or NaN", () => {
    expect(safeDiv(10, 0)).toBeNull();
    expect(safeDiv(0, 0)).toBeNull();
    expect(safeDiv(Number.NaN, 5)).toBeNull();
  });
});

// ============================================================
// The load-bearing tests: real rows from the agency 大表.
// If these drift, every number pasted back into the sheet is wrong.
// ============================================================
describe("toDailyRow — verified against real 大表 rows", () => {
  const cases = [
    {
      date: "2026-08-07",
      spend: 5159, impressions: 2894, linkClicks: 57, leads: 3,
      expect: { ctr: "1.97%", conv: "5.26%", cpm: "1783", cpc: "90.5", cpl: "1719.7" },
    },
    {
      date: "2026-08-05",
      spend: 5264, impressions: 2382, linkClicks: 49, leads: 1,
      expect: { ctr: "2.06%", conv: "2.04%", cpm: "2210", cpc: "107.4", cpl: "5264.0" },
    },
    {
      date: "2026-08-02",
      spend: 10558, impressions: 5587, linkClicks: 131, leads: 7,
      expect: { ctr: "2.34%", conv: "5.34%", cpm: "1890", cpc: "80.6", cpl: "1508.3" },
    },
    {
      date: "2026-08-01",
      spend: 9319, impressions: 5416, linkClicks: 94, leads: 8,
      expect: { ctr: "1.74%", conv: "8.51%", cpm: "1721", cpc: "99.1", cpl: "1164.9" },
    },
  ];

  it.each(cases)("$date reproduces the sheet to the digit", (c) => {
    const row = toDailyRow(
      insight({
        date_start: c.date,
        spend: String(c.spend),
        impressions: String(c.impressions),
        inline_link_clicks: String(c.linkClicks),
        actions: [lead(c.leads)],
      }),
    );

    expect(fmtPercent(row.linkCtr)).toBe(c.expect.ctr);
    expect(fmtPercent(row.conversionRate)).toBe(c.expect.conv);
    expect(fmtNumber(row.cpm, 0)).toBe(c.expect.cpm);
    expect(fmtNumber(row.cpc, 1)).toBe(c.expect.cpc);
    expect(fmtNumber(row.cpl, 1)).toBe(c.expect.cpl);
  });

  // 2026/7/26 — 6 link clicks, zero leads. The sheet shows #DIV/0!; we emit blank.
  it("returns null for 單次填單成本 on a day with no leads", () => {
    const row = toDailyRow(
      insight({ date_start: "2026-07-26", spend: "419", impressions: "464", inline_link_clicks: "6" }),
    );
    expect(fmtPercent(row.linkCtr)).toBe("1.29%");
    expect(fmtNumber(row.cpm, 0)).toBe("903");
    expect(fmtNumber(row.cpc, 1)).toBe("69.8");
    expect(row.cpl).toBeNull();
    expect(row.conversionRate).toBe(0);
  });

  // Meta's own ctr/cpc count ALL clicks; the 大表 counts link clicks only.
  it("ignores Meta's ctr/cpc fields and derives from link clicks", () => {
    const row = toDailyRow(
      insight({
        spend: "5159", impressions: "2894", inline_link_clicks: "57", clicks: "280",
        ctr: "9.67", cpc: "18.4", actions: [lead(3)],
      } as Partial<RawInsight>),
    );
    expect(fmtNumber(row.cpc, 1)).toBe("90.5");
    expect(fmtPercent(row.linkCtr)).toBe("1.97%");
  });

  it("falls back to total clicks only when inline_link_clicks is absent entirely", () => {
    const raw = insight({ spend: "100", impressions: "1000", clicks: "50" });
    delete raw.inline_link_clicks;
    expect(toDailyRow(raw).linkClicks).toBe(50);
  });

  it("keeps a present-but-zero inline_link_clicks instead of falling back", () => {
    expect(toDailyRow(insight({ inline_link_clicks: "0", clicks: "50" })).linkClicks).toBe(0);
  });

  it("carries 私訊次數 and 廣告互動次數 through", () => {
    const row = toDailyRow(
      insight({
        actions: [
          lead(2),
          { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "4" },
          { action_type: "post_engagement", value: "88" },
        ],
      }),
    );
    expect(row.leads).toBe(2);
    expect(row.messages).toBe(4);
    expect(row.engagements).toBe(88);
  });

  it("names the row by the most specific level available", () => {
    expect(toDailyRow(insight({ ad_name: "素材2", adset_name: "北北中", campaign_name: "C" })).name).toBe("素材2");
    expect(toDailyRow(insight({ adset_name: "北北中｜35-65+｜房地產投資" })).name).toBe("北北中｜35-65+｜房地產投資");
  });

  it("survives a completely empty insight without NaN", () => {
    const row = toDailyRow({});
    expect(row.spend).toBe(0);
    expect(row.linkCtr).toBeNull();
    expect(row.cpl).toBeNull();
  });
});

describe("toMonthlyRow — verified against 好珈貿易 2023-06", () => {
  const row = toMonthlyRow(
    {
      spend: "40508",
      impressions: "518477",
      inline_link_clicks: "10413",
      actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "75" }],
      action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "93609" }],
    },
    "好珈貿易",
    "2023-06-01 - 2023-06-30",
  );

  it("reproduces every sheet figure", () => {
    expect(fmtNumber(row.roas, 2)).toBe("2.31");
    expect(fmtNumber(row.cpa, 0)).toBe("540");
    expect(fmtPercent(row.linkCtr)).toBe("2.01%");
    expect(fmtPercent(row.conversionRate)).toBe("0.72%");
    expect(fmtNumber(row.averageOrderValue, 0)).toBe("1248");
    expect(fmtNumber(row.cpm, 0)).toBe("78");
    expect(fmtNumber(row.cpc, 0)).toBe("4");
    expect(row.purchases).toBe(75);
    expect(row.conversionValue).toBe(93609);
  });

  it("returns null ROAS rather than dividing by zero spend", () => {
    expect(toMonthlyRow({ spend: "0" }, "x", "y").roas).toBeNull();
  });
});

describe("CSV export", () => {
  it("emits the 大表 daily header in exact column order", () => {
    expect(formatDailyCsv([]).split("\n")[0]).toBe(
      "日期,花費金額,點擊率,轉換率,千次曝光成本,單次點擊成本,單次填單成本,曝光次數,連結點擊次數,填單次數,私訊次數,廣告互動次數",
    );
    expect(DAILY_CSV_HEADER).toHaveLength(12);
  });

  it("emits the 大表 monthly header in exact column order", () => {
    expect(formatMonthlyCsv([]).split("\n")[0]).toBe(
      "廣告帳號,月份,花費金額,購買轉換值,ROAS,CPA,點擊率,轉換率,客單價,CPM,CPC,曝光次數,連結點擊次數,購買訂單數",
    );
    expect(MONTHLY_CSV_HEADER).toHaveLength(14);
  });

  it("writes the 8/7 row exactly as the sheet shows it", () => {
    const csv = formatDailyCsv([
      toDailyRow(
        insight({
          date_start: "2026-08-07", spend: "5159", impressions: "2894",
          inline_link_clicks: "57", actions: [lead(3)],
        }),
      ),
    ]);
    expect(csv.split("\n")[1]).toBe("2026-08-07,5159,1.97%,5.26%,1783,90.5,1719.7,2894,57,3,0,0");
  });

  // Thousands separators would make Sheets read the number as text.
  it("writes raw numbers with no thousands separators", () => {
    const csv = formatDailyCsv([toDailyRow(insight({ spend: "10558", impressions: "5587" }))]);
    expect(csv).not.toContain("10,558");
    expect(csv).toContain("10558");
  });

  it("leaves a divide-by-zero cell empty instead of writing NaN or #DIV/0!", () => {
    const csv = formatDailyCsv([toDailyRow(insight({ spend: "419", impressions: "464", inline_link_clicks: "6" }))]);
    expect(csv).not.toMatch(/NaN|Infinity|DIV\/0/);
    expect(csv.split("\n")[1]).toBe("2026-08-07,419,1.29%,0.00%,903,69.8,,464,6,0,0,0");
  });

  // Ad set names in this account contain "｜" but a comma would break the row.
  it("quotes a name containing a comma", () => {
    const csv = formatMonthlyCsv([toMonthlyRow({ spend: "1" }, "好珈貿易, 儲值", "2024-01")]);
    expect(csv.split("\n")[1]).toContain('"好珈貿易, 儲值"');
  });
});

describe("fetchers", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const ok = (body: unknown) =>
    ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as unknown as Response;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const lastQuery = () => new URL(String(fetchMock.mock.calls.at(-1)![0])).searchParams;

  // Without time_increment=1 Meta collapses the range into one aggregate row.
  it("requests one row per day for the daily report", async () => {
    fetchMock.mockResolvedValue(ok({ data: [] }));
    await getDailyRows(cfg, { since: "2026-08-01", until: "2026-08-07" });

    const q = lastQuery();
    expect(q.get("time_increment")).toBe("1");
    expect(JSON.parse(q.get("time_range")!)).toEqual({ since: "2026-08-01", until: "2026-08-07" });
    expect(q.get("fields")).toContain("inline_link_clicks");
    expect(q.get("fields")).toContain("action_values");
  });

  it("maps returned rows through toDailyRow", async () => {
    fetchMock.mockResolvedValue(
      ok({
        data: [
          { date_start: "2026-08-07", spend: "5159", impressions: "2894", inline_link_clicks: "57", actions: [lead(3)] },
        ],
      }),
    );
    const rows = await getDailyRows(cfg, { since: "2026-08-07", until: "2026-08-07" });
    expect(rows).toHaveLength(1);
    expect(fmtNumber(rows[0].cpl, 1)).toBe("1719.7");
  });

  it("queries the given object instead of the whole account when one is passed", async () => {
    fetchMock.mockResolvedValue(ok({ data: [] }));
    await getDailyRows(cfg, { since: "2026-08-01", until: "2026-08-07", objectId: "adset_1", level: "adset" });
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain("/adset_1/insights");
  });

  it("returns null when a month has no data", async () => {
    fetchMock.mockResolvedValue(ok({ data: [] }));
    await expect(
      getMonthlyRow(cfg, { since: "2026-08-01", until: "2026-08-31", account: "崑家汽車" }),
    ).resolves.toBeNull();
  });

  it("omits time_increment on the monthly aggregate", async () => {
    fetchMock.mockResolvedValue(ok({ data: [{ spend: "100" }] }));
    await getMonthlyRow(cfg, { since: "2026-08-01", until: "2026-08-31", account: "崑家汽車" });
    expect(lastQuery().get("time_increment")).toBeNull();
  });
});
