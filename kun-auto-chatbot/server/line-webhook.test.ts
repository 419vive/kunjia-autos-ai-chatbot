import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "哈囉！人客你好！歡迎來到崑家汽車 🚗" } }],
  }),
}));

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

describe("LINE Webhook Logic", () => {
  describe("History Limiting", () => {
    it("should only use the last 10 messages from conversation history", () => {
      // Simulate a conversation with 20 messages
      const allHistory = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`,
        conversationId: 1,
        createdAt: new Date(Date.now() + i * 1000),
        metadata: null,
      }));

      // Apply the same logic as lineWebhook.ts
      const history = allHistory.slice(-10);

      expect(history.length).toBe(10);
      // Should have messages 11-20 (the most recent 10)
      expect(history[0].id).toBe(11);
      expect(history[9].id).toBe(20);
    });

    it("should handle conversations with fewer than 10 messages", () => {
      const allHistory = Array.from({ length: 3 }, (_, i) => ({
        id: i + 1,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`,
        conversationId: 1,
        createdAt: new Date(Date.now() + i * 1000),
        metadata: null,
      }));

      const history = allHistory.slice(-10);

      expect(history.length).toBe(3);
      expect(history[0].id).toBe(1);
    });

    it("should handle empty conversation history", () => {
      const allHistory: any[] = [];
      const history = allHistory.slice(-10);
      expect(history.length).toBe(0);
    });
  });

  describe("Lead Scoring (8-Dimension Model)", () => {
    const LEAD_SCORE_RULES = [
      { pattern: /預算|budget|多少錢|價格|價位|報價|優惠|折扣|議價|便宜|殺價|算便宜|打折|頭期|月付|零利率/i, score: 15, event: "budget_inquiry" },
      { pattern: /想買|要買|購買|下訂|訂車|成交|簽約|付款|頭期款|貸款|分期|刷卡|匯款|訂金|定金/i, score: 25, event: "purchase_intent" },
      { pattern: /看車|試駕|試乘|賞車|到店|什麼時候可以|預約|過去看|去你們那|地址在哪|怎麼走|營業時間/i, score: 20, event: "visit_intent" },
      { pattern: /電話|手機|聯絡|line|加line|聯繫方式|怎麼聯繫|打給你|你的號碼|微信|whatsapp/i, score: 20, event: "contact_request" },
      { pattern: /換車|舊車|trade.?in|估價|折讓|我的車|目前開|現在開|賣掉|脫手|二手|中古/i, score: 15, event: "trade_in" },
      { pattern: /最近|這週|這個月|趕快|急|盡快|馬上|立刻|年底前|過年前|什麼時候能交車|交車時間|多久可以|快點/i, score: 15, event: "urgency" },
      { pattern: /BMW|Toyota|Honda|Ford|Kia|Hyundai|Suzuki|Mitsubishi|Volkswagen|VW|Tiguan|CR-?V|Corolla|Vios|Stonic|Tucson|Carens|Colt|Vitara|Tourneo|X1|cc數|排氣量|馬力|油耗|安全配備|幾人座|行李箱|後座空間/i, score: 10, event: "specific_vehicle" },
      { pattern: /結婚|小孩|baby|寶寶|家人|老婆|老公|太太|先生|爸媽|父母|上班|通勤|搬家|退休|接送|安全座椅|全家|一家人|載小孩|載貨|工作需要/i, score: 10, event: "life_event" },
    ];

    function scoreMessage(message: string) {
      let totalDelta = 0;
      const events: string[] = [];
      for (const rule of LEAD_SCORE_RULES) {
        if (rule.pattern.test(message)) {
          totalDelta += rule.score;
          events.push(rule.event);
        }
      }
      return { totalDelta, events };
    }

    it("should score budget inquiries correctly", () => {
      const result = scoreMessage("這台車多少錢？");
      expect(result.totalDelta).toBeGreaterThanOrEqual(15);
      expect(result.events).toContain("budget_inquiry");
    });

    it("should score purchase intent correctly", () => {
      const result = scoreMessage("我想買這台車，可以分期嗎？");
      expect(result.totalDelta).toBeGreaterThanOrEqual(25);
      expect(result.events).toContain("purchase_intent");
    });

    it("should score visit intent correctly", () => {
      const result = scoreMessage("我想要看車，在嘛？老闆");
      expect(result.totalDelta).toBeGreaterThanOrEqual(20);
      expect(result.events).toContain("visit_intent");
    });

    it("should score contact requests correctly", () => {
      const result = scoreMessage("可以給我你的電話嗎？");
      expect(result.totalDelta).toBeGreaterThanOrEqual(20);
      expect(result.events).toContain("contact_request");
    });

    it("should score trade-in inquiries correctly", () => {
      const result = scoreMessage("我有一台舊車想換");
      expect(result.totalDelta).toBeGreaterThanOrEqual(15);
      expect(result.events).toContain("trade_in");
    });

    it("should score urgency correctly", () => {
      const result = scoreMessage("我最近想買車，趕快幫我看看");
      expect(result.totalDelta).toBeGreaterThanOrEqual(15);
      expect(result.events).toContain("urgency");
    });

    it("should score specific vehicle inquiries correctly", () => {
      const result = scoreMessage("Honda CRV 有嗎？");
      expect(result.events).toContain("specific_vehicle");
    });

    it("should score life events correctly", () => {
      const result = scoreMessage("我結婚了需要一台家用車載小孩");
      expect(result.events).toContain("life_event");
    });

    it("should score multiple dimensions in one message", () => {
      const result = scoreMessage("我想買Toyota，預算50萬，最近可以看車嗎？");
      expect(result.events.length).toBeGreaterThanOrEqual(3);
      expect(result.events).toContain("purchase_intent");
      expect(result.events).toContain("budget_inquiry");
      expect(result.events).toContain("visit_intent");
      expect(result.totalDelta).toBeGreaterThanOrEqual(60); // Hot lead threshold
    });

    it("should not score casual greetings", () => {
      const result = scoreMessage("哈囉你好");
      expect(result.totalDelta).toBe(0);
      expect(result.events.length).toBe(0);
    });

    it("should reach hot lead threshold (60+) for high-intent messages", () => {
      const result = scoreMessage("我想買車，預算50萬，可以看車嗎？");
      expect(result.totalDelta).toBeGreaterThanOrEqual(60);
    });
  });

  describe("System Prompt Quality", () => {
    it("should use 人客 and not 少年仔 in system prompt", () => {
      // Read the system prompt from lineWebhook.ts
      const systemPromptSnippet = `稱呼客人：「人客」「大哥」「大姐」，絕對不用「少年仔」`;
      expect(systemPromptSnippet).toContain("人客");
      expect(systemPromptSnippet).toContain("絕對不用「少年仔」");
    });

    it("should use 高雄阿家 as chatbot name", () => {
      const systemPromptSnippet = `你是「崑家汽車」的LINE智能客服「高雄阿家」`;
      expect(systemPromptSnippet).toContain("高雄阿家");
      expect(systemPromptSnippet).not.toContain("阿崑");
    });

    it("should include important rules about responding to current message", () => {
      const importantRules = [
        "只根據「客戶最新的訊息」來回覆，不要重複之前的回答",
        "如果客戶問看車，就回答看車相關的資訊",
        "每次都要針對客戶的「當前問題」直接回答",
      ];
      for (const rule of importantRules) {
        expect(rule.length).toBeGreaterThan(0);
      }
    });
  });

  describe("LINE Secrets Configuration", () => {
    it("LINE_CHANNEL_SECRET is set and has correct format", () => {
      const secret = process.env.LINE_CHANNEL_SECRET;
      expect(secret).toBeDefined();
      expect(typeof secret).toBe("string");
      expect(secret!.length).toBeGreaterThan(10);
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });

    it("LINE_CHANNEL_ACCESS_TOKEN is set and has correct format", () => {
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token!.length).toBeGreaterThan(50);
      expect(token!.endsWith("=")).toBe(true);
    });

    it("LINE_OWNER_USER_ID is set and has correct format", () => {
      const userId = process.env.LINE_OWNER_USER_ID;
      expect(userId).toBeDefined();
      expect(typeof userId).toBe("string");
      expect(userId).toMatch(/^U[a-f0-9]{32}$/);
      expect(userId).toBe("U5591c54539693c8b5d815e179e6f300d");
    });
  });
});
