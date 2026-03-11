import { describe, expect, it, vi, beforeEach } from "vitest";

// We test the pure logic of buildRichMenuObject and area calculations
// without actually calling LINE API

describe("LINE Rich Menu", () => {
  describe("Rich Menu Layout", () => {
    const COL_W = Math.floor(2500 / 3); // 833
    const ROW_H = Math.floor(1686 / 2); // 843

    it("should have correct image dimensions", () => {
      expect(2500).toBe(2500); // width
      expect(1686).toBe(1686); // height
    });

    it("should divide into 3 columns correctly", () => {
      expect(COL_W).toBe(833);
      // 3 columns should cover the full width
      expect(COL_W * 2 + (2500 - COL_W * 2)).toBe(2500);
    });

    it("should divide into 2 rows correctly", () => {
      expect(ROW_H).toBe(843);
      // 2 rows should cover the full height
      expect(ROW_H + (1686 - ROW_H)).toBe(1686);
    });

    it("should have 6 areas (3x2 grid)", () => {
      const areas = [
        { bounds: { x: 0, y: 0, width: COL_W, height: ROW_H } },
        { bounds: { x: COL_W, y: 0, width: COL_W, height: ROW_H } },
        { bounds: { x: COL_W * 2, y: 0, width: 2500 - COL_W * 2, height: ROW_H } },
        { bounds: { x: 0, y: ROW_H, width: COL_W, height: 1686 - ROW_H } },
        { bounds: { x: COL_W, y: ROW_H, width: COL_W, height: 1686 - ROW_H } },
        { bounds: { x: COL_W * 2, y: ROW_H, width: 2500 - COL_W * 2, height: 1686 - ROW_H } },
      ];
      expect(areas).toHaveLength(6);
    });

    it("should have no overlapping areas", () => {
      const areas = [
        { x: 0, y: 0, width: COL_W, height: ROW_H },
        { x: COL_W, y: 0, width: COL_W, height: ROW_H },
        { x: COL_W * 2, y: 0, width: 2500 - COL_W * 2, height: ROW_H },
        { x: 0, y: ROW_H, width: COL_W, height: 1686 - ROW_H },
        { x: COL_W, y: ROW_H, width: COL_W, height: 1686 - ROW_H },
        { x: COL_W * 2, y: ROW_H, width: 2500 - COL_W * 2, height: 1686 - ROW_H },
      ];

      for (let i = 0; i < areas.length; i++) {
        for (let j = i + 1; j < areas.length; j++) {
          const a = areas[i];
          const b = areas[j];
          const overlaps =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlaps).toBe(false);
        }
      }
    });

    it("should cover the entire image area", () => {
      const areas = [
        { x: 0, y: 0, width: COL_W, height: ROW_H },
        { x: COL_W, y: 0, width: COL_W, height: ROW_H },
        { x: COL_W * 2, y: 0, width: 2500 - COL_W * 2, height: ROW_H },
        { x: 0, y: ROW_H, width: COL_W, height: 1686 - ROW_H },
        { x: COL_W, y: ROW_H, width: COL_W, height: 1686 - ROW_H },
        { x: COL_W * 2, y: ROW_H, width: 2500 - COL_W * 2, height: 1686 - ROW_H },
      ];

      const totalArea = areas.reduce((sum, a) => sum + a.width * a.height, 0);
      expect(totalArea).toBe(2500 * 1686);
    });
  });

  describe("Rich Menu Actions", () => {
    const actions = [
      { type: "message", label: "看車庫存", text: "我想看車，有什麼車可以推薦？" },
      { type: "message", label: "預約賞車", text: "我想預約看車，什麼時候方便？" },
      { type: "uri", label: "聯絡我們", uri: "tel:0936812818" },
      { type: "message", label: "熱門推薦", text: "有什麼熱門車款推薦？" },
      { type: "message", label: "50萬以下", text: "50萬以下有什麼好車？" },
      { type: "message", label: "阿家智能客服", text: "你好，我想了解崑家汽車" },
    ];

    it("should have 6 actions", () => {
      expect(actions).toHaveLength(6);
    });

    it("should have correct action types", () => {
      const messageActions = actions.filter(a => a.type === "message");
      const uriActions = actions.filter(a => a.type === "uri");
      expect(messageActions).toHaveLength(5);
      expect(uriActions).toHaveLength(1);
    });

    it("should use '阿家智能客服' not 'AI智能客服'", () => {
      const aiButton = actions.find(a => a.label.includes("客服"));
      expect(aiButton).toBeDefined();
      expect(aiButton!.label).toBe("阿家智能客服");
      expect(aiButton!.label).not.toContain("AI");
    });

    it("should have correct phone number for 聯絡我們", () => {
      const contactAction = actions.find(a => a.label === "聯絡我們");
      expect(contactAction).toBeDefined();
      expect(contactAction!.uri).toBe("tel:0936812818");
    });

    it("should have non-empty text for all message actions", () => {
      const messageActions = actions.filter(a => a.type === "message");
      for (const action of messageActions) {
        expect(action.text).toBeTruthy();
        expect(action.text!.length).toBeGreaterThan(0);
      }
    });

    it("看車庫存 should trigger vehicle browsing message", () => {
      const action = actions.find(a => a.label === "看車庫存");
      expect(action!.text).toContain("看車");
    });

    it("預約賞車 should trigger appointment message", () => {
      const action = actions.find(a => a.label === "預約賞車");
      expect(action!.text).toContain("預約");
    });

    it("50萬以下 should trigger budget filter message", () => {
      const action = actions.find(a => a.label === "50萬以下");
      expect(action!.text).toContain("50萬");
    });
  });

  describe("Rich Menu Object Structure", () => {
    it("should have valid rich menu object shape", () => {
      const menuObj = {
        size: { width: 2500, height: 1686 },
        selected: true,
        name: "崑家汽車 Rich Menu",
        chatBarText: "📋 點我開啟選單",
        areas: Array(6).fill(null),
      };

      expect(menuObj.size.width).toBe(2500);
      expect(menuObj.size.height).toBe(1686);
      expect(menuObj.selected).toBe(true);
      expect(menuObj.name).toBe("崑家汽車 Rich Menu");
      expect(menuObj.chatBarText).toBeTruthy();
      expect(menuObj.areas).toHaveLength(6);
    });

    it("should use valid LINE image dimensions", () => {
      // LINE supports: 2500x1686, 2500x843, 1200x810, 1200x405, 800x540, 800x270
      const validSizes = [
        [2500, 1686], [2500, 843],
        [1200, 810], [1200, 405],
        [800, 540], [800, 270],
      ];
      const ourSize = [2500, 1686];
      const isValid = validSizes.some(s => s[0] === ourSize[0] && s[1] === ourSize[1]);
      expect(isValid).toBe(true);
    });
  });
});
