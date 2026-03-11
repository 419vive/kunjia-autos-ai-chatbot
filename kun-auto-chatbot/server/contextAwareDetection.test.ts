import { describe, it, expect } from "vitest";
import {
  detectVehicleFromMessage,
  extractVehicleFromHistory,
  buildTargetVehiclePrompt,
  buildSmartVehicleKB,
} from "./vehicleDetectionService";

// ============ MOCK VEHICLES ============
const mockVehicles = [
  {
    id: 1,
    brand: "Honda",
    model: "CR-V",
    modelYear: 2020,
    price: 103.8,
    priceDisplay: "103.8萬",
    displacement: "1.5L",
    transmission: "CVT",
    mileage: "3.2萬公里",
    color: "白色",
    fuelType: "汽油",
    bodyType: "SUV",
    features: "Honda Sensing, CarPlay, 倒車影像",
    description: "一手車，原廠保養",
  },
  {
    id: 2,
    brand: "BMW",
    model: "X1",
    modelYear: 2019,
    price: 37.8,
    priceDisplay: "37.8萬",
    displacement: "2.0L",
    transmission: "8速手自排",
    mileage: "5.6萬公里",
    color: "黑色",
    fuelType: "汽油",
    bodyType: "SUV",
    features: "ACC, 電動尾門, 倒車雷達",
    description: "總代理，車況優",
  },
  {
    id: 3,
    brand: "Toyota",
    model: "Corolla Cross",
    modelYear: 2021,
    price: 85,
    priceDisplay: "85萬",
    displacement: "1.8L",
    transmission: "CVT",
    mileage: "2.1萬公里",
    color: "銀色",
    fuelType: "油電",
    bodyType: "SUV",
    features: "TSS, 車道維持, 自動跟車",
    description: "油電省油",
  },
];

// ============ HELPER: Build conversation history ============
function buildHistory(messages: Array<[string, string]>): Array<{ role: string; content: string }> {
  return messages.map(([role, content]) => ({ role, content }));
}

// ============ EXTRACT VEHICLE FROM HISTORY ============
describe("extractVehicleFromHistory", () => {
  it("should find Honda CR-V from user message in history", () => {
    const history = buildHistory([
      ["user", "我想看 Honda CR-V"],
      ["assistant", "Honda CR-V 是一台很棒的車！"],
    ]);
    const result = extractVehicleFromHistory(history, mockVehicles);
    expect(result).not.toBeNull();
    expect(result!.brand).toBe("Honda");
    expect(result!.model).toBe("CR-V");
  });

  it("should find the MOST RECENT vehicle mentioned", () => {
    const history = buildHistory([
      ["user", "我想看 Honda CR-V"],
      ["assistant", "Honda CR-V 很棒！"],
      ["user", "那 BMW X1 呢"],
      ["assistant", "BMW X1 也不錯！"],
    ]);
    const result = extractVehicleFromHistory(history, mockVehicles);
    expect(result).not.toBeNull();
    expect(result!.brand).toBe("BMW");
    expect(result!.model).toBe("X1");
  });

  it("should find vehicle from assistant's response", () => {
    const history = buildHistory([
      ["user", "有沒有便宜的車"],
      ["assistant", "我推薦 BMW X1，只要 37.8 萬！"],
    ]);
    const result = extractVehicleFromHistory(history, mockVehicles);
    expect(result).not.toBeNull();
    expect(result!.brand).toBe("BMW");
  });

  it("should find vehicle from inquiry button format", () => {
    const history = buildHistory([
      ["user", "我想詢問這台車：Honda CR-V 2020年\n售價：103.8萬"],
      ["assistant", "這台 CR-V 眼光很好！"],
    ]);
    const result = extractVehicleFromHistory(history, mockVehicles);
    expect(result).not.toBeNull();
    expect(result!.model).toBe("CR-V");
  });

  it("should return null for empty history", () => {
    const result = extractVehicleFromHistory([], mockVehicles);
    expect(result).toBeNull();
  });

  it("should return null when no vehicle mentioned in history", () => {
    const history = buildHistory([
      ["user", "你好"],
      ["assistant", "你好！歡迎來到崑家汽車！"],
    ]);
    const result = extractVehicleFromHistory(history, mockVehicles);
    expect(result).toBeNull();
  });

  it("should find vehicle from Chinese brand alias in history", () => {
    const history = buildHistory([
      ["user", "你們有寶馬的車嗎"],
      ["assistant", "有的！我們有 BMW X1！"],
    ]);
    const result = extractVehicleFromHistory(history, mockVehicles);
    expect(result).not.toBeNull();
    expect(result!.brand).toBe("BMW");
  });
});

// ============ CONTEXT-AWARE DETECTION ============
describe("Context-aware vehicle detection", () => {
  it("should resolve '那排氣量呢' to Honda CR-V from history", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 多少錢"],
      ["assistant", "Honda CR-V 售價 103.8 萬！"],
    ]);
    const result = detectVehicleFromMessage("那排氣量呢", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle).not.toBeNull();
    expect(result.vehicle!.model).toBe("CR-V");
    expect(result.questionType).toBe("displacement");
    expect(result.directAnswer).toContain("1.5L");
  });

  it("should resolve '多少錢' to BMW X1 from history", () => {
    const history = buildHistory([
      ["user", "BMW X1 的排氣量多少"],
      ["assistant", "BMW X1 排氣量是 2.0L！"],
    ]);
    const result = detectVehicleFromMessage("多少錢", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("X1");
    expect(result.questionType).toBe("price");
    expect(result.directAnswer).toContain("37.8萬");
  });

  it("should resolve '這台有什麼配備' to last mentioned vehicle", () => {
    const history = buildHistory([
      ["user", "Toyota Corolla Cross 好嗎"],
      ["assistant", "Corolla Cross 很受歡迎！"],
    ]);
    const result = detectVehicleFromMessage("這台有什麼配備", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("Corolla Cross");
    expect(result.questionType).toBe("features");
  });

  it("should resolve '那台多少公里' to last mentioned vehicle", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 好不好"],
      ["assistant", "CR-V 非常好！"],
    ]);
    const result = detectVehicleFromMessage("那台多少公里", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("CR-V");
    expect(result.questionType).toBe("mileage");
  });

  it("should resolve '它的變速箱是什麼' to last mentioned vehicle", () => {
    const history = buildHistory([
      ["user", "BMW X1 看起來不錯"],
      ["assistant", "X1 確實很棒！"],
    ]);
    const result = detectVehicleFromMessage("它的變速箱是什麼", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("X1");
  });

  it("should resolve '所以油耗怎麼樣' to last mentioned vehicle", () => {
    const history = buildHistory([
      ["user", "Toyota Corolla Cross 多少錢"],
      ["assistant", "Corolla Cross 售價 85 萬！"],
    ]);
    const result = detectVehicleFromMessage("所以油耗怎麼樣", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("Corolla Cross");
    expect(result.questionType).toBe("fuel");
  });

  it("should resolve short follow-up '幾年份' to last mentioned vehicle", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 好嗎"],
      ["assistant", "CR-V 很棒！"],
    ]);
    const result = detectVehicleFromMessage("幾年份", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("CR-V");
    expect(result.questionType).toBe("year");
  });

  it("should resolve '還在嗎' to last mentioned vehicle", () => {
    const history = buildHistory([
      ["user", "BMW X1 看起來不錯"],
      ["assistant", "X1 確實很棒！"],
    ]);
    const result = detectVehicleFromMessage("還在嗎", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("X1");
    expect(result.questionType).toBe("availability");
  });

  it("should NOT use context for explicit vehicle mention in current message", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 多少錢"],
      ["assistant", "CR-V 售價 103.8 萬！"],
    ]);
    // Current message explicitly mentions BMW X1 — should NOT fall back to CR-V
    const result = detectVehicleFromMessage("BMW X1 多少錢", mockVehicles, history);
    expect(result.type).toBe("mentioned");
    expect(result.vehicle!.model).toBe("X1");
  });

  it("should NOT use context for general greetings", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 多少錢"],
      ["assistant", "CR-V 售價 103.8 萬！"],
    ]);
    // "你好" is a general message — should NOT resolve to any vehicle
    const result = detectVehicleFromMessage("你好", mockVehicles, history);
    expect(result.type).toBe("none");
  });

  it("should NOT use context when no history provided", () => {
    const result = detectVehicleFromMessage("那排氣量呢", mockVehicles);
    expect(result.type).toBe("none");
  });

  it("should NOT use context when history has no vehicle", () => {
    const history = buildHistory([
      ["user", "你好"],
      ["assistant", "你好！歡迎來到崑家汽車！"],
    ]);
    const result = detectVehicleFromMessage("多少錢", mockVehicles, history);
    expect(result.type).toBe("none");
  });

  it("should use MOST RECENT vehicle in multi-turn conversation", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 多少錢"],
      ["assistant", "CR-V 售價 103.8 萬！"],
      ["user", "那 BMW X1 呢"],
      ["assistant", "BMW X1 售價 37.8 萬！"],
    ]);
    // Follow-up should resolve to BMW X1 (most recent), not Honda CR-V
    const result = detectVehicleFromMessage("排氣量多少", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("X1");
    expect(result.directAnswer).toContain("2.0L");
  });
});

// ============ BUILD TARGET VEHICLE PROMPT FOR CONTEXT TYPE ============
describe("buildTargetVehiclePrompt for context type", () => {
  it("should generate prompt for context-detected vehicle", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 多少錢"],
      ["assistant", "CR-V 售價 103.8 萬！"],
    ]);
    const detection = detectVehicleFromMessage("那排氣量呢", mockVehicles, history);
    const prompt = buildTargetVehiclePrompt(detection, "那排氣量呢");
    
    expect(prompt).toContain("最後指令");
    expect(prompt).toContain("Honda");
    expect(prompt).toContain("CR-V");
    expect(prompt).toContain("之前在問");
    expect(prompt).toContain("跟進");
    expect(prompt).toContain("1.5L");
  });

  it("should include direct answer in context prompt", () => {
    const history = buildHistory([
      ["user", "BMW X1 好嗎"],
      ["assistant", "X1 很棒！"],
    ]);
    const detection = detectVehicleFromMessage("多少錢", mockVehicles, history);
    const prompt = buildTargetVehiclePrompt(detection, "多少錢");
    
    expect(prompt).toContain("37.8萬");
    expect(prompt).toContain("BMW");
    expect(prompt).toContain("X1");
  });
});

// ============ SMART VEHICLE KB FOR CONTEXT TYPE ============
describe("buildSmartVehicleKB for context-detected vehicle", () => {
  it("should show context vehicle prominently", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 多少錢"],
      ["assistant", "CR-V 售價 103.8 萬！"],
    ]);
    const detection = detectVehicleFromMessage("那排氣量呢", mockVehicles, history);
    const kb = buildSmartVehicleKB(mockVehicles, detection.vehicle);
    
    // Target vehicle should be shown prominently
    expect(kb).toContain("★★★ 客人詢問的車 ★★★");
    expect(kb).toContain("Honda");
    expect(kb).toContain("CR-V");
    // Other vehicles should be abbreviated
    expect(kb).toContain("其他在售車輛（簡列）");
  });
});

// ============ EDGE CASES ============
describe("Context-aware edge cases", () => {
  it("should handle '請問有照片嗎' as follow-up", () => {
    const history = buildHistory([
      ["user", "Toyota Corolla Cross 多少錢"],
      ["assistant", "Corolla Cross 售價 85 萬！"],
    ]);
    const result = detectVehicleFromMessage("請問有照片嗎", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("Corolla Cross");
    expect(result.questionType).toBe("photos");
  });

  it("should handle '什麼顏色' as follow-up", () => {
    const history = buildHistory([
      ["user", "BMW X1 好嗎"],
      ["assistant", "X1 很棒！"],
    ]);
    const result = detectVehicleFromMessage("什麼顏色", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("X1");
    expect(result.questionType).toBe("color");
  });

  it("should handle '對了它是幾年份的' as follow-up", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 不錯"],
      ["assistant", "CR-V 確實很棒！"],
    ]);
    const result = detectVehicleFromMessage("對了它是幾年份的", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("CR-V");
    expect(result.questionType).toBe("year");
  });

  it("should handle '順便問一下油耗' as follow-up", () => {
    const history = buildHistory([
      ["user", "Toyota Corolla Cross 好嗎"],
      ["assistant", "Corolla Cross 很受歡迎！"],
    ]);
    const result = detectVehicleFromMessage("順便問一下油耗", mockVehicles, history);
    expect(result.type).toBe("context");
    expect(result.vehicle!.model).toBe("Corolla Cross");
    expect(result.questionType).toBe("fuel");
  });

  it("should handle long follow-up messages without context reference as 'none'", () => {
    const history = buildHistory([
      ["user", "Honda CR-V 好嗎"],
      ["assistant", "CR-V 確實很棒！"],
    ]);
    // Long message without vehicle name and without context reference patterns
    const result = detectVehicleFromMessage("我最近在考慮買一台新車，不知道你們有什麼推薦的，預算大概在五十萬左右", mockVehicles, history);
    // This is a general inquiry, not a follow-up about CR-V
    expect(result.type).toBe("none");
  });
});
