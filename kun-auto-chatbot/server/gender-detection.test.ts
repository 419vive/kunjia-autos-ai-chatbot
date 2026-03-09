import { describe, it, expect } from "vitest";
import { detectGenderFromName, getGenderGreeting } from "./lineWebhook";

describe("detectGenderFromName", () => {
  it("detects female from title patterns", () => {
    expect(detectGenderFromName("王小姐")).toBe("female");
    expect(detectGenderFromName("陳太太")).toBe("female");
    expect(detectGenderFromName("林女士")).toBe("female");
    expect(detectGenderFromName("阿姨")).toBe("female");
    expect(detectGenderFromName("媽媽")).toBe("female");
  });

  it("detects male from title patterns", () => {
    expect(detectGenderFromName("王先生")).toBe("male");
    expect(detectGenderFromName("陳大哥")).toBe("male");
    expect(detectGenderFromName("老闆")).toBe("male");
    expect(detectGenderFromName("爸爸")).toBe("male");
    expect(detectGenderFromName("阿伯")).toBe("male");
  });

  it("detects female from common Chinese name characters", () => {
    expect(detectGenderFromName("林美玲")).toBe("female");
    expect(detectGenderFromName("陳淑芬")).toBe("female");
    expect(detectGenderFromName("王雅惠")).toBe("female");
    expect(detectGenderFromName("張玉華")).toBe("female");
    expect(detectGenderFromName("李靜")).toBe("female");
  });

  it("detects male from common Chinese name characters", () => {
    expect(detectGenderFromName("陳志明")).toBe("male");
    expect(detectGenderFromName("王建國")).toBe("male");
    expect(detectGenderFromName("林志豪")).toBe("male");
    expect(detectGenderFromName("張偉")).toBe("male");
    expect(detectGenderFromName("李勇")).toBe("male");
  });

  it("returns unknown for ambiguous or non-Chinese names", () => {
    expect(detectGenderFromName("Alex")).toBe("unknown");
    expect(detectGenderFromName("John")).toBe("unknown");
    expect(detectGenderFromName("小白")).toBe("unknown");
    expect(detectGenderFromName("🐱貓咪")).toBe("unknown");
  });

  it("returns unknown for null or empty", () => {
    expect(detectGenderFromName(null)).toBe("unknown");
    expect(detectGenderFromName("")).toBe("unknown");
    expect(detectGenderFromName("   ")).toBe("unknown");
  });
});

describe("getGenderGreeting", () => {
  it("returns 大哥 for male", () => {
    expect(getGenderGreeting("male")).toBe("大哥");
  });

  it("returns 小姐 for female", () => {
    expect(getGenderGreeting("female")).toBe("小姐");
  });

  it("returns 人客 for unknown", () => {
    expect(getGenderGreeting("unknown")).toBe("人客");
  });
});
