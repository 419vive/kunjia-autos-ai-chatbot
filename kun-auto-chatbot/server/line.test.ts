import { describe, expect, it } from "vitest";

describe("LINE Messaging API secrets", () => {
  it("LINE_CHANNEL_SECRET is set and has correct format", () => {
    const secret = process.env.LINE_CHANNEL_SECRET;
    expect(secret).toBeDefined();
    expect(typeof secret).toBe("string");
    expect(secret!.length).toBeGreaterThan(10);
    // Channel secret is a hex string
    expect(secret).toMatch(/^[a-f0-9]+$/);
  });

  it("LINE_CHANNEL_ACCESS_TOKEN is set and has correct format", () => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token!.length).toBeGreaterThan(50);
    // Token ends with =
    expect(token!.endsWith("=")).toBe(true);
  });

  it("LINE_OWNER_USER_ID is set and has correct format", () => {
    const userId = process.env.LINE_OWNER_USER_ID;
    expect(userId).toBeDefined();
    expect(typeof userId).toBe("string");
    // LINE User ID starts with U and is 33 chars
    expect(userId).toMatch(/^U[a-f0-9]{32}$/);
    expect(userId).toBe("U5591c54539693c8b5d815e179e6f300d");
  });
});
