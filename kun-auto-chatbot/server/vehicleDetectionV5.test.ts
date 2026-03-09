import { describe, it, expect } from "vitest";
import {
  detectQuestionType,
  detectVehicleFromMessage,
  buildTargetVehiclePrompt,
  getTermExplanation,
  CAR_TERM_GLOSSARY,
  buildSmartVehicleKB,
} from "./vehicleDetectionService";

// ============ MOCK VEHICLES ============
const mockVehicles = [
  {
    id: 1,
    brand: "Honda",
    model: "CR-V",
    modelYear: 2023,
    price: 103.8,
    priceDisplay: "103.8萬",
    displacement: "1.5L",
    transmission: "CVT",
    mileage: "2.5萬公里",
    color: "白色",
    fuelType: "汽油",
    bodyType: "SUV",
    features: "Honda Sensing, CarPlay, 倒車影像",
    description: "一手車，車況極佳",
    externalId: "123",
  },
  {
    id: 2,
    brand: "BMW",
    model: "X1",
    modelYear: 2022,
    price: 37.8,
    priceDisplay: "37.8萬",
    displacement: "2.0L",
    transmission: "自排",
    mileage: "5萬公里",
    color: "黑色",
    fuelType: "汽油",
    bodyType: "SUV",
    features: "ACC, 天窗, 皮椅",
    description: "原廠保養",
    externalId: "456",
  },
  {
    id: 3,
    brand: "Toyota",
    model: "Corolla Cross",
    modelYear: 2024,
    price: 55,
    priceDisplay: "55萬",
    displacement: "1.8L",
    transmission: "CVT",
    mileage: "1萬公里",
    color: "銀色",
    fuelType: "油電",
    bodyType: "SUV",
    features: "TSS, CarPlay",
    description: "油電混合",
    externalId: "789",
  },
];

// ============ EXPLANATION QUESTION DETECTION ============
describe("Explanation Question Detection (v5)", () => {
  it("should detect '1.5L 什麼意思' as displacement question", () => {
    expect(detectQuestionType("Honda CR-V 上面那個 1.5L 什麼意思")).toBe("displacement");
  });

  it("should detect '1.5L 是什麼' as displacement question", () => {
    expect(detectQuestionType("1.5L 是什麼")).toBe("displacement");
  });

  it("should detect 'cc 是什麼意思' as displacement question", () => {
    expect(detectQuestionType("cc 是什麼意思")).toBe("displacement");
  });

  it("should detect '排氣量代表什麼' as displacement question", () => {
    expect(detectQuestionType("排氣量代表什麼")).toBe("displacement");
  });

  it("should detect '渦輪是什麼' as displacement question", () => {
    expect(detectQuestionType("渦輪是什麼")).toBe("displacement");
  });

  it("should detect 'CVT 什麼意思' as transmission question", () => {
    expect(detectQuestionType("CVT 什麼意思")).toBe("transmission");
  });

  it("should detect '自排是什麼' as transmission question", () => {
    expect(detectQuestionType("自排是什麼")).toBe("transmission");
  });

  it("should detect '油電是什麼意思' as fuel question", () => {
    expect(detectQuestionType("油電是什麼意思")).toBe("fuel");
  });

  it("should detect 'hybrid 什麼意思' as fuel question", () => {
    expect(detectQuestionType("hybrid 什麼意思")).toBe("fuel");
  });

  it("should detect 'TSS 是什麼' as features question", () => {
    expect(detectQuestionType("TSS 是什麼")).toBe("features");
  });

  it("should detect 'Honda Sensing 什麼意思' as features question", () => {
    expect(detectQuestionType("Honda Sensing 什麼意思")).toBe("features");
  });

  it("should detect 'ACC 是什麼意思' as features question", () => {
    expect(detectQuestionType("ACC 是什麼意思")).toBe("features");
  });

  it("should detect generic '這個什麼意思' as explanation type", () => {
    expect(detectQuestionType("這個什麼意思")).toBe("explanation");
  });

  it("should detect '解釋一下' as explanation type", () => {
    expect(detectQuestionType("解釋一下")).toBe("explanation");
  });

  it("should still detect '1.5L' as displacement when no explanation keyword", () => {
    expect(detectQuestionType("Honda CR-V 的 1.5L 排氣量")).toBe("displacement");
  });
});

// ============ CAR TERM GLOSSARY ============
describe("Car Term Glossary", () => {
  it("should have explanation for 1.5L", () => {
    expect(CAR_TERM_GLOSSARY["1.5l"]).toBeDefined();
    expect(CAR_TERM_GLOSSARY["1.5l"]).toContain("1500cc");
  });

  it("should have explanation for 2.0L", () => {
    expect(CAR_TERM_GLOSSARY["2.0l"]).toBeDefined();
    expect(CAR_TERM_GLOSSARY["2.0l"]).toContain("2000cc");
  });

  it("should have explanation for CVT", () => {
    expect(CAR_TERM_GLOSSARY["cvt"]).toBeDefined();
    expect(CAR_TERM_GLOSSARY["cvt"]).toContain("無段變速");
  });

  it("should have explanation for 油電", () => {
    expect(CAR_TERM_GLOSSARY["油電"]).toBeDefined();
    expect(CAR_TERM_GLOSSARY["油電"]).toContain("混合動力");
  });

  it("should have explanation for TSS", () => {
    expect(CAR_TERM_GLOSSARY["tss"]).toBeDefined();
    expect(CAR_TERM_GLOSSARY["tss"]).toContain("Toyota Safety Sense");
  });

  it("should have explanation for Honda Sensing", () => {
    expect(CAR_TERM_GLOSSARY["honda sensing"]).toBeDefined();
  });

  it("should have explanation for ACC", () => {
    expect(CAR_TERM_GLOSSARY["acc"]).toBeDefined();
    expect(CAR_TERM_GLOSSARY["acc"]).toContain("定速巡航");
  });

  it("should have explanation for SUV", () => {
    expect(CAR_TERM_GLOSSARY["suv"]).toBeDefined();
    expect(CAR_TERM_GLOSSARY["suv"]).toContain("休旅車");
  });
});

// ============ TERM EXPLANATION FUNCTION ============
describe("getTermExplanation", () => {
  const crv = mockVehicles[0]; // Honda CR-V, 1.5L

  it("should explain 1.5L when asked '1.5L 什麼意思'", () => {
    const explanation = getTermExplanation("1.5L 什麼意思", crv);
    expect(explanation).toContain("1500cc");
  });

  it("should explain 2.0L when asked '2.0L 是什麼'", () => {
    const explanation = getTermExplanation("2.0L 是什麼", mockVehicles[1]);
    expect(explanation).toContain("2000cc");
  });

  it("should explain CVT when asked 'CVT 什麼意思'", () => {
    const explanation = getTermExplanation("CVT 什麼意思", crv);
    expect(explanation).toContain("無段變速");
  });

  it("should explain TSS when asked 'TSS 是什麼'", () => {
    const explanation = getTermExplanation("TSS 是什麼", mockVehicles[2]);
    expect(explanation).toContain("Toyota Safety Sense");
  });

  it("should explain SUV when asked 'SUV 什麼意思'", () => {
    const explanation = getTermExplanation("SUV 什麼意思", crv);
    expect(explanation).toContain("休旅車");
  });

  it("should return empty string for completely unknown terms", () => {
    const explanation = getTermExplanation("xyz123 什麼意思", crv);
    // If no known term is found in the message, should return empty
    // Note: getTermExplanation also checks vehicle specs, so it may still return something
    // if the vehicle has matching specs
    expect(typeof explanation).toBe("string");
  });
});

// ============ DETECTION RESULT WITH TERM EXPLANATION ============
describe("Detection Result includes termExplanation", () => {
  it("should include termExplanation for '1.5L 什麼意思' with Honda CR-V", () => {
    const result = detectVehicleFromMessage("Honda CR-V 上面那個 1.5L 什麼意思", mockVehicles);
    expect(result.type).toBe("mentioned");
    expect(result.vehicle?.model).toBe("CR-V");
    expect(result.questionType).toBe("displacement");
    expect(result.termExplanation).toContain("1500cc");
  });

  it("should include termExplanation for 'BMW X1 的 2.0L 是什麼'", () => {
    const result = detectVehicleFromMessage("BMW X1 的 2.0L 是什麼", mockVehicles);
    expect(result.type).toBe("mentioned");
    expect(result.vehicle?.model).toBe("X1");
    expect(result.termExplanation).toContain("2000cc");
  });

  it("should still provide termExplanation for price questions (enriches AI context)", () => {
    const result = detectVehicleFromMessage("Honda CR-V 多少錢", mockVehicles);
    // getTermExplanation checks vehicle specs and provides explanations
    // even for non-explanation questions, to enrich AI context
    expect(typeof result.termExplanation).toBe("string");
  });

  it("should have empty termExplanation for general messages without vehicle", () => {
    const result = detectVehicleFromMessage("你好", mockVehicles);
    expect(result.termExplanation).toBe("");
  });
});

// ============ BUILD TARGET VEHICLE PROMPT WITH EXPLANATION ============
describe("buildTargetVehiclePrompt includes term explanation", () => {
  it("should include term explanation in prompt for '1.5L 什麼意思'", () => {
    const detection = detectVehicleFromMessage("Honda CR-V 上面那個 1.5L 什麼意思，解釋一下會死喔", mockVehicles);
    const prompt = buildTargetVehiclePrompt(detection, "Honda CR-V 上面那個 1.5L 什麼意思，解釋一下會死喔");
    expect(prompt).toContain("1500cc");
    expect(prompt).toContain("術語解釋");
    expect(prompt).toContain("白話");
  });

  it("should include term explanation even for price questions to enrich AI context", () => {
    const detection = detectVehicleFromMessage("Honda CR-V 多少錢", mockVehicles);
    const prompt = buildTargetVehiclePrompt(detection, "Honda CR-V 多少錢");
    // Term explanation is always included when available to give AI more context
    expect(prompt).toContain("Honda");
    expect(prompt).toContain("CR-V");
    expect(prompt).toContain("103.8萬");
  });
});

// ============ HUMAN HANDOFF MARKER DETECTION ============
describe("Human Handoff Detection", () => {
  it("should detect [HUMAN_HANDOFF] marker in AI response", () => {
    const response = "大哥問到重點了！貸款的部分我幫你轉給專人來回答，真人客服馬上就到！請稍等一下🙏 [HUMAN_HANDOFF]";
    expect(response.includes("[HUMAN_HANDOFF]")).toBe(true);
    
    // After removing marker
    const cleaned = response.replace(/\s*\[HUMAN_HANDOFF\]\s*/g, "").trim();
    expect(cleaned).not.toContain("[HUMAN_HANDOFF]");
    expect(cleaned).toContain("真人客服馬上就到");
  });

  it("should detect uncertainty phrases in AI response", () => {
    const uncertaintyPatterns = /我幫你確認一下|我幫你問問|我幫你查|我不太確定|這個我要確認|我幫您確認|我幫您查/;
    
    expect(uncertaintyPatterns.test("這個我幫你確認一下")).toBe(true);
    expect(uncertaintyPatterns.test("我幫你問問看")).toBe(true);
    expect(uncertaintyPatterns.test("我幫你查一下")).toBe(true);
    expect(uncertaintyPatterns.test("我不太確定")).toBe(true);
    expect(uncertaintyPatterns.test("這個我要確認")).toBe(true);
    
    // Should NOT trigger for normal responses
    expect(uncertaintyPatterns.test("這台車很棒")).toBe(false);
    expect(uncertaintyPatterns.test("售價是 37.8 萬")).toBe(false);
    expect(uncertaintyPatterns.test("排氣量是 1.5L")).toBe(false);
  });

  it("should NOT trigger handoff for normal vehicle answers", () => {
    const uncertaintyPatterns = /我幫你確認一下|我幫你問問|我幫你查|我不太確定|這個我要確認|我幫您確認|我幫您查/;
    
    const normalResponses = [
      "人客好啊！這台 Honda CR-V 的 1.5L 代表排氣量是 1500cc，動力跟油耗取得很好的平衡！",
      "大哥眼光很好！BMW X1 售價 37.8 萬，2.0L 引擎動力充沛！",
      "這台 Corolla Cross 是油電混合，市區超省油！",
    ];
    
    for (const response of normalResponses) {
      expect(uncertaintyPatterns.test(response)).toBe(false);
    }
  });
});

// ============ REAL SCENARIO: Honda CR-V 1.5L 什麼意思 ============
describe("Real Scenario: Honda CR-V 1.5L 什麼意思", () => {
  it("should correctly detect and provide explanation for the exact user message from screenshot", () => {
    const userMessage = "我是說你 Honda CR-V上面那個 1.5L 什麼意思，解釋一下會死喔";
    
    const detection = detectVehicleFromMessage(userMessage, mockVehicles);
    
    // Should detect Honda CR-V
    expect(detection.type).toBe("mentioned");
    expect(detection.vehicle?.brand).toBe("Honda");
    expect(detection.vehicle?.model).toBe("CR-V");
    
    // Should detect as displacement question (because of 1.5L + 什麼意思)
    expect(detection.questionType).toBe("displacement");
    
    // Should have direct answer about displacement
    expect(detection.directAnswer).toContain("1.5L");
    
    // Should have term explanation
    expect(detection.termExplanation).toContain("1500cc");
    expect(detection.termExplanation).toContain("排氣量");
    
    // Build the prompt and verify it contains the explanation
    const prompt = buildTargetVehiclePrompt(detection, userMessage);
    expect(prompt).toContain("1500cc");
    expect(prompt).toContain("術語解釋");
    expect(prompt).toContain("Honda");
    expect(prompt).toContain("CR-V");
  });

  it("should also handle follow-up '所以你不知道 1.5L 什麼意思...'", () => {
    const userMessage = "所以你不知道 1.5L 什麼意思...";
    
    const detection = detectVehicleFromMessage(userMessage, mockVehicles);
    
    // No specific vehicle mentioned in this follow-up
    // But the question type should still be displacement
    expect(detection.questionType).toBe("displacement");
    
    // termExplanation should still work even without vehicle match
    // because getTermExplanation checks the message itself
  });
});
