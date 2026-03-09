import { describe, it, expect } from "vitest";
import { getTomorrowSlots, formatTimeSlotsForPrompt } from "./timeSlotHelper";

describe("timeSlotHelper", () => {
  describe("getTomorrowSlots", () => {
    it("returns exactly 1 day (tomorrow)", () => {
      const slot = getTomorrowSlots();
      expect(slot).toBeDefined();
      expect(slot.date).toBeTruthy();
    });

    it("has 3 time slots (上午/下午/晚上)", () => {
      const slot = getTomorrowSlots();
      expect(slot.slots).toHaveLength(3);
      expect(slot.slots[0]).toBe("上午 10:30-11:30");
      expect(slot.slots[1]).toBe("下午 2:00-3:00");
      expect(slot.slots[2]).toBe("晚上 6:00-7:00");
    });

    it("has date, fullDate, and dayOfWeek", () => {
      const slot = getTomorrowSlots();
      expect(slot.date).toBeTruthy();
      expect(slot.fullDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(slot.dayOfWeek).toBeTruthy();
    });

    it("skips Sundays", () => {
      const slot = getTomorrowSlots();
      expect(slot.dayOfWeek).not.toBe("日");
    });

    it("date is in the future", () => {
      const slot = getTomorrowSlots();
      const today = new Date().toISOString().split("T")[0];
      expect(slot.fullDate > today).toBe(true);
    });
  });

  describe("formatTimeSlotsForPrompt", () => {
    it("returns a formatted string with 明天", () => {
      const formatted = formatTimeSlotsForPrompt();
      expect(formatted).toContain("明天");
    });

    it("includes all 3 time slot options", () => {
      const formatted = formatTimeSlotsForPrompt();
      expect(formatted).toContain("上午 10:30-11:30");
      expect(formatted).toContain("下午 2:00-3:00");
      expect(formatted).toContain("晚上 6:00-7:00");
    });

    it("includes numbered options ①②③", () => {
      const formatted = formatTimeSlotsForPrompt();
      expect(formatted).toContain("①");
      expect(formatted).toContain("②");
      expect(formatted).toContain("③");
    });

    it("includes weekday name in parentheses", () => {
      const formatted = formatTimeSlotsForPrompt();
      expect(formatted).toMatch(/（[一二三四五六]）/);
    });

    it("does NOT contain multiple days", () => {
      const formatted = formatTimeSlotsForPrompt();
      // Should only have one date line, not multiple
      expect(formatted).not.toContain("2.");
      expect(formatted).not.toContain("3.");
    });
  });
});
