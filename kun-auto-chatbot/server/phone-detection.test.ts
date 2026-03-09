import { describe, it, expect } from "vitest";
import { detectPhoneNumber } from "./lineWebhook";

describe("detectPhoneNumber", () => {
  // ========== Taiwan Mobile Numbers ==========
  
  it("detects standard mobile number: 0912345678", () => {
    expect(detectPhoneNumber("我的電話是0912345678")).toBe("0912-345-678");
  });

  it("detects mobile with dashes: 0912-345-678", () => {
    expect(detectPhoneNumber("打0912-345-678找我")).toBe("0912-345-678");
  });

  it("detects mobile with spaces: 0912 345 678", () => {
    expect(detectPhoneNumber("電話 0912 345 678")).toBe("0912-345-678");
  });

  it("detects +886 format: +886912345678", () => {
    expect(detectPhoneNumber("call me +886912345678")).toBe("0912-345-678");
  });

  it("detects 886 format without plus: 886912345678", () => {
    expect(detectPhoneNumber("886912345678")).toBe("0912-345-678");
  });

  it("detects +886 with dashes: +886-912-345-678", () => {
    expect(detectPhoneNumber("+886-912-345-678")).toBe("0912-345-678");
  });

  it("detects phone in natural conversation", () => {
    expect(detectPhoneNumber("好啊，我電話0936812818，方便的話打給我")).toBe("0936-812-818");
  });

  it("detects phone with mixed separators", () => {
    expect(detectPhoneNumber("0955-123 456")).toBe("0955-123-456");
  });

  // ========== Landline Numbers ==========

  it("detects Kaohsiung landline: 07-1234567", () => {
    const result = detectPhoneNumber("公司電話 07-1234567");
    expect(result).not.toBeNull();
  });

  it("detects Taipei landline: 02-12345678", () => {
    const result = detectPhoneNumber("02-12345678");
    expect(result).not.toBeNull();
  });

  // ========== Should NOT detect ==========

  it("returns null for no phone number", () => {
    expect(detectPhoneNumber("我想看車")).toBeNull();
  });

  it("returns null for partial numbers", () => {
    expect(detectPhoneNumber("0912")).toBeNull();
  });

  it("returns null for random digits", () => {
    expect(detectPhoneNumber("車價50萬")).toBeNull();
  });

  it("returns null for year numbers", () => {
    expect(detectPhoneNumber("2024年的車")).toBeNull();
  });

  it("returns null for vehicle IDs", () => {
    expect(detectPhoneNumber("車輛編號12345")).toBeNull();
  });

  // ========== Edge Cases ==========

  it("detects first phone number when multiple present", () => {
    const result = detectPhoneNumber("我的電話0912345678，公司0922333444");
    expect(result).toBe("0912-345-678");
  });

  it("handles phone in parentheses", () => {
    expect(detectPhoneNumber("(0912345678)")).toBe("0912-345-678");
  });

  it("handles phone after colon", () => {
    expect(detectPhoneNumber("電話：0912-345-678")).toBe("0912-345-678");
  });
});

describe("buildOwnerNotificationFlex - structure", () => {
  // We test the exported detectPhoneNumber function here
  // The buildOwnerNotificationFlex is internal but we verify its logic through integration

  it("phone detection works with real customer messages", () => {
    // Typical customer messages with phone numbers
    const messages = [
      { text: "好，我電話0936-812-818", expected: "0936-812-818" },
      { text: "你可以打0912345678給我", expected: "0912-345-678" },
      { text: "我的手機號碼是 0955 123 456", expected: "0955-123-456" },
      { text: "留個電話好了 0988-777-666", expected: "0988-777-666" },
    ];

    for (const msg of messages) {
      expect(detectPhoneNumber(msg.text)).toBe(msg.expected);
    }
  });

  it("does not falsely detect phone in price discussions", () => {
    const messages = [
      "這台車50萬可以嗎",
      "預算大概30到40萬",
      "里程數12萬公里",
      "2019年的車",
      "排氣量1500cc",
    ];

    for (const msg of messages) {
      expect(detectPhoneNumber(msg)).toBeNull();
    }
  });
});
