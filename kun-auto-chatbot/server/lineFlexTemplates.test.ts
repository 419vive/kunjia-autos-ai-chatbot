import { describe, expect, it } from "vitest";
import {
  detectRichMenuTrigger,
  buildRichMenuResponse,
  buildRichMenuResponseMessages,
  buildVehicleCarousel,
  buildVehicleCarouselMessages,
  buildPhotoCarousel,
  detectPhotoTrigger,
  buildAppointmentCard,
  buildWelcomeCard,
  buildSimpleCard,
} from "./lineFlexTemplates";
import type { Vehicle } from "../drizzle/schema";

// Mock vehicles for testing
const mockVehicles: Vehicle[] = [
  {
    id: 1, externalId: "v1", brand: "BMW", model: "X1", modelYear: "2015",
    price: "37.8" as any, priceDisplay: "37.8萬", status: "available",
    photoUrls: "https://example.com/bmw1.jpg|https://example.com/bmw2.jpg",
    sourceUrl: "https://8891.com.tw/1", color: "白色", mileage: "8.3萬公里",
    displacement: "1500cc", transmission: "自排", fuelType: "汽油",
    manufactureYear: null, bodyType: null, licenseDate: null, location: null,
    description: null, features: null, guarantees: null, photoCount: 1,
    title: "BMW X1", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 2, externalId: "v2", brand: "Honda", model: "CR-V", modelYear: "2025",
    price: "103.8" as any, priceDisplay: "103.8萬", status: "available",
    photoUrls: "https://example.com/crv.jpg",
    sourceUrl: "https://8891.com.tw/2", color: "黑色", mileage: "0.1萬公里",
    displacement: "1500cc", transmission: "自排", fuelType: "汽油",
    manufactureYear: null, bodyType: null, licenseDate: null, location: null,
    description: null, features: null, guarantees: null, photoCount: 1,
    title: "Honda CR-V", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 3, externalId: "v3", brand: "Kia", model: "Stonic", modelYear: "2020",
    price: "45.8" as any, priceDisplay: "45.8萬", status: "available",
    photoUrls: "https://example.com/stonic1.jpg|https://example.com/stonic2.jpg|https://example.com/stonic3.jpg",
    sourceUrl: "https://8891.com.tw/3", color: "紅色", mileage: "3.2萬公里",
    displacement: "1400cc", transmission: "自排", fuelType: "汽油",
    manufactureYear: null, bodyType: null, licenseDate: null, location: null,
    description: null, features: null, guarantees: null, photoCount: 1,
    title: "Kia Stonic", createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 4, externalId: "v4", brand: "Ford", model: "Tourneo", modelYear: "2022",
    price: "62.8" as any, priceDisplay: "62.8萬", status: "sold",
    photoUrls: null, sourceUrl: null, color: null, mileage: null,
    displacement: null, transmission: null, fuelType: null,
    manufactureYear: null, bodyType: null, licenseDate: null, location: null,
    description: null, features: null, guarantees: null, photoCount: 0,
    title: "Ford Tourneo", createdAt: new Date(), updatedAt: new Date(),
  },
];

// Helper to create many mock vehicles
function mockVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    ...mockVehicles[0],
    ...overrides,
  } as Vehicle;
}

describe("LINE Flex Message Templates", () => {
  describe("detectRichMenuTrigger", () => {
    it("should detect 看車庫存 trigger", () => {
      const trigger = detectRichMenuTrigger("我想看車，有什麼車可以推薦？");
      expect(trigger).not.toBeNull();
      expect(trigger!.type).toBe("vehicle_browse");
      expect(trigger!.label).toBe("看車庫存");
    });

    it("should detect 預約賞車 trigger", () => {
      const trigger = detectRichMenuTrigger("我想預約看車，什麼時候方便？");
      expect(trigger).not.toBeNull();
      expect(trigger!.type).toBe("appointment");
      expect(trigger!.label).toBe("預約賞車");
    });

    it("should detect 熱門推薦 trigger", () => {
      const trigger = detectRichMenuTrigger("有什麼熱門車款推薦？");
      expect(trigger).not.toBeNull();
      expect(trigger!.type).toBe("popular");
      expect(trigger!.label).toBe("熱門推薦");
    });

    it("should detect 50萬以下 trigger", () => {
      const trigger = detectRichMenuTrigger("50萬以下有什麼好車？");
      expect(trigger).not.toBeNull();
      expect(trigger!.type).toBe("budget");
      expect(trigger!.label).toBe("50萬以下");
    });

    it("should detect 阿家智能客服 trigger", () => {
      const trigger = detectRichMenuTrigger("你好，我想了解崑家汽車");
      expect(trigger).not.toBeNull();
      expect(trigger!.type).toBe("welcome");
      expect(trigger!.label).toBe("阿家智能客服");
    });

    it("should return null for regular messages", () => {
      expect(detectRichMenuTrigger("你好")).toBeNull();
      expect(detectRichMenuTrigger("我想買車")).toBeNull();
      expect(detectRichMenuTrigger("有沒有Toyota")).toBeNull();
      expect(detectRichMenuTrigger("")).toBeNull();
    });

    it("should require exact match (not partial)", () => {
      expect(detectRichMenuTrigger("我想看車")).toBeNull();
      expect(detectRichMenuTrigger("我想預約看車")).toBeNull();
      expect(detectRichMenuTrigger("50萬以下")).toBeNull();
    });
  });

  // ============ PHOTO TRIGGER DETECTION ============

  describe("detectPhotoTrigger", () => {
    it("should detect valid photo trigger", () => {
      expect(detectPhotoTrigger("看照片 4075406")).toBe("4075406");
    });

    it("should detect photo trigger with different ID", () => {
      expect(detectPhotoTrigger("看照片 1234567")).toBe("1234567");
    });

    it("should return null for non-photo messages", () => {
      expect(detectPhotoTrigger("我想看車")).toBeNull();
      expect(detectPhotoTrigger("看照片")).toBeNull();
      expect(detectPhotoTrigger("看照片 abc")).toBeNull();
      expect(detectPhotoTrigger("看照片 ")).toBeNull();
    });

    it("should not match partial triggers", () => {
      expect(detectPhotoTrigger("我要看照片 4075406")).toBeNull();
      expect(detectPhotoTrigger("看照片 4075406 好嗎")).toBeNull();
    });
  });

  // ============ VEHICLE CAROUSEL (backward compat single message) ============

  describe("buildVehicleCarousel", () => {
    it("should build a carousel with available vehicles", () => {
      const result = buildVehicleCarousel(mockVehicles.slice(0, 3), "測試", "測試");
      expect(result.type).toBe("flex");
      expect(result.contents.type).toBe("carousel");
      expect(result.contents.contents).toHaveLength(3);
    });

    it("should include vehicle details in each bubble", () => {
      const result = buildVehicleCarousel([mockVehicles[0]], "測試", "測試");
      const bubble = result.contents.contents[0];
      expect(bubble.type).toBe("bubble");
      expect(bubble.hero).toBeDefined();
      expect(bubble.hero.url).toBe("https://example.com/bmw1.jpg");
      expect(bubble.body).toBeDefined();
      expect(bubble.footer).toBeDefined();
    });

    it("should show fallback card when no vehicles", () => {
      const result = buildVehicleCarousel([], "測試", "測試");
      expect(result.type).toBe("flex");
      expect(result.contents.type).toBe("bubble"); // Simple card, not carousel
    });

    it("should limit to 12 vehicles max in single message (LINE carousel limit)", () => {
      const manyVehicles = Array(15).fill(null).map((_, i) => ({
        ...mockVehicles[0],
        id: i + 1,
        externalId: `v${i + 1}`,
      }));
      const result = buildVehicleCarousel(manyVehicles, "測試", "測試");
      expect(result.contents.contents).toHaveLength(12);
    });

    it("should include green LINE 問這台車 button with vehicle info", () => {
      const result = buildVehicleCarousel([mockVehicles[0]], "測試", "測試");
      const footer = result.contents.contents[0].footer;
      const askButton = footer.contents[0];
      expect(askButton.action.type).toBe("message");
      expect(askButton.action.label).toContain("LINE 問這台車");
      expect(askButton.action.text).toContain("BMW");
      expect(askButton.action.text).toContain("X1");
      expect(askButton.color).toBe("#06C755"); // LINE green
    });

    it("should include phone call button", () => {
      const result = buildVehicleCarousel([mockVehicles[0]], "測試", "測試");
      const footer = result.contents.contents[0].footer;
      const callButton = footer.contents.find((b: any) => b.action?.uri === "tel:0936812818");
      expect(callButton).toBeDefined();
      expect(callButton.action.type).toBe("uri");
    });

    it("should use placeholder image when no photos", () => {
      const noPhotoVehicle = { ...mockVehicles[0], photoUrls: null };
      const result = buildVehicleCarousel([noPhotoVehicle], "測試", "測試");
      const hero = result.contents.contents[0].hero;
      expect(hero.url).toContain("placeholder");
    });
  });

  // ============ MULTI-MESSAGE VEHICLE CAROUSEL ============

  describe("buildVehicleCarouselMessages", () => {
    it("should return empty state card when no vehicles", () => {
      const messages = buildVehicleCarouselMessages([], "test", "test");
      expect(messages).toHaveLength(1);
      expect(messages[0].altText).toContain("沒有符合");
    });

    it("should return single message for <=12 vehicles", () => {
      const vehicles = Array.from({ length: 10 }, (_, i) =>
        mockVehicle({ id: i + 1, externalId: String(1000 + i) })
      );
      const messages = buildVehicleCarouselMessages(vehicles, "測試", "測試");
      expect(messages).toHaveLength(1);
      expect(messages[0].contents.type).toBe("carousel");
      expect(messages[0].contents.contents).toHaveLength(10);
    });

    it("should return exactly 12 bubbles in first carousel", () => {
      const vehicles = Array.from({ length: 12 }, (_, i) =>
        mockVehicle({ id: i + 1, externalId: String(1000 + i) })
      );
      const messages = buildVehicleCarouselMessages(vehicles, "測試", "測試");
      expect(messages).toHaveLength(1);
      expect(messages[0].contents.contents).toHaveLength(12);
    });

    it("should split into 2 messages for 13-24 vehicles (e.g. 20 vehicles)", () => {
      const vehicles = Array.from({ length: 20 }, (_, i) =>
        mockVehicle({ id: i + 1, externalId: String(1000 + i) })
      );
      const messages = buildVehicleCarouselMessages(vehicles, "庫存", "全部");
      expect(messages).toHaveLength(2);
      expect(messages[0].contents.contents).toHaveLength(12);
      expect(messages[1].contents.contents).toHaveLength(8);
    });

    it("should include chunk indicator in altText when multiple messages", () => {
      const vehicles = Array.from({ length: 15 }, (_, i) =>
        mockVehicle({ id: i + 1, externalId: String(1000 + i) })
      );
      const messages = buildVehicleCarouselMessages(vehicles, "庫存", "全部");
      expect(messages[0].altText).toContain("(1/2)");
      expect(messages[1].altText).toContain("(2/2)");
    });

    it("should not exceed 5 messages (LINE reply API limit)", () => {
      const vehicles = Array.from({ length: 100 }, (_, i) =>
        mockVehicle({ id: i + 1, externalId: String(1000 + i) })
      );
      const messages = buildVehicleCarouselMessages(vehicles, "庫存", "全部");
      expect(messages.length).toBeLessThanOrEqual(5);
    });

    it("should include photo button when vehicle has multiple photos", () => {
      const v = mockVehicle({
        externalId: "4075406",
        photoUrls: "https://a.jpg|https://b.jpg|https://c.jpg",
      });
      const messages = buildVehicleCarouselMessages([v], "測試", "測試");
      const bubble = messages[0].contents.contents[0];
      const footerButtons = bubble.footer.contents;
      const photoButton = footerButtons.find((b: any) =>
        b.action?.label?.includes("看所有照片")
      );
      expect(photoButton).toBeDefined();
      expect(photoButton.action.text).toBe("看照片 4075406");
      expect(photoButton.action.label).toContain("3張");
    });

    it("should NOT include photo button when vehicle has only 1 photo", () => {
      const v = mockVehicle({ photoUrls: "https://a.jpg" });
      const messages = buildVehicleCarouselMessages([v], "測試", "測試");
      const bubble = messages[0].contents.contents[0];
      const footerButtons = bubble.footer.contents;
      const photoButton = footerButtons.find((b: any) =>
        b.action?.label?.includes("看所有照片")
      );
      expect(photoButton).toBeUndefined();
    });
  });

  // ============ PHOTO CAROUSEL ============

  describe("buildPhotoCarousel", () => {
    it("should return messages with header, photo carousel, and footer", () => {
      const v = mockVehicle({
        photoUrls: "https://a.jpg|https://b.jpg|https://c.jpg",
      });
      const messages = buildPhotoCarousel(v);
      // Should have: 1 text header + 1 photo carousel + 1 footer = 3
      expect(messages.length).toBeGreaterThanOrEqual(3);

      // First message is text header
      expect(messages[0].type).toBe("text");
      expect(messages[0].text).toContain("BMW X1");
      expect(messages[0].text).toContain("3 張照片");

      // Second message is photo carousel
      expect(messages[1].type).toBe("flex");
      expect(messages[1].contents.type).toBe("carousel");
      expect(messages[1].contents.contents).toHaveLength(3);

      // Each bubble shows photo number
      const firstBubble = messages[1].contents.contents[0];
      expect(firstBubble.body.contents[0].text).toBe("1 / 3");
    });

    it("should handle vehicle with no photos", () => {
      const v = mockVehicle({ photoUrls: "" });
      const messages = buildPhotoCarousel(v);
      expect(messages).toHaveLength(1);
      expect(messages[0].altText).toContain("暫無照片");
    });

    it("should split photos into multiple carousels if >12", () => {
      const photos = Array.from({ length: 20 }, (_, i) => `https://photo${i}.jpg`);
      const v = mockVehicle({ photoUrls: photos.join("|") });
      const messages = buildPhotoCarousel(v);

      // header + 2 photo carousels + footer = 4 messages
      expect(messages.length).toBe(4);

      // First carousel has 12 photos
      expect(messages[1].contents.contents).toHaveLength(12);
      // Second carousel has 8 photos
      expect(messages[2].contents.contents).toHaveLength(8);
    });

    it("should not exceed 5 messages (LINE reply API limit)", () => {
      const photos = Array.from({ length: 50 }, (_, i) => `https://photo${i}.jpg`);
      const v = mockVehicle({ photoUrls: photos.join("|") });
      const messages = buildPhotoCarousel(v);
      expect(messages.length).toBeLessThanOrEqual(5);
    });

    it("should include green LINE inquiry and call buttons in footer (no 8891 button)", () => {
      const v = mockVehicle({
        photoUrls: "https://a.jpg|https://b.jpg",
      });
      const messages = buildPhotoCarousel(v);
      const footer = messages[messages.length - 1];
      expect(footer.type).toBe("flex");
      const buttons = footer.contents.body.contents;
      const lineBtn = buttons.find((b: any) => b.action?.label?.includes("LINE 問這台車"));
      const callBtn = buttons.find((b: any) => b.action?.label?.includes("聯繫"));
      const linkBtn = buttons.find((b: any) => b.action?.label?.includes("8891"));
      expect(lineBtn).toBeDefined();
      expect(lineBtn.color).toBe("#06C755"); // LINE green
      expect(lineBtn.action.text).toContain("BMW X1");
      expect(callBtn).toBeDefined();
      expect(linkBtn).toBeUndefined(); // 8891 button removed
    });

    it("should trigger LINE inquiry when photo is tapped (no 8891 link)", () => {
      const v = mockVehicle({
        photoUrls: "https://a.jpg|https://b.jpg",
        sourceUrl: "https://auto.8891.com.tw/usedauto-infos-4075406.html",
      });
      const messages = buildPhotoCarousel(v);
      const carousel = messages[1];
      const firstBubble = carousel.contents.contents[0];
      expect(firstBubble.hero.action.type).toBe("message");
      expect(firstBubble.hero.action.text).toContain("BMW");
      expect(firstBubble.hero.action.uri).toBeUndefined(); // No 8891 link
    });
  });

  // ============ MULTI-MESSAGE RICH MENU RESPONSE ============

  describe("buildRichMenuResponseMessages", () => {
    it("should return array of messages for vehicle_browse with all vehicles", () => {
      const vehicles = Array.from({ length: 20 }, (_, i) =>
        mockVehicle({ id: i + 1, externalId: String(1000 + i), status: "available" })
      );
      const trigger = detectRichMenuTrigger("我想看車，有什麼車可以推薦？");
      expect(trigger).not.toBeNull();
      const messages = buildRichMenuResponseMessages(trigger!, vehicles);
      expect(messages.length).toBe(2); // 12 + 8
    });

    it("should return single message for appointment", () => {
      const trigger = detectRichMenuTrigger("我想預約看車，什麼時候方便？");
      const messages = buildRichMenuResponseMessages(trigger!, []);
      expect(messages).toHaveLength(1);
    });

    it("should return single message for welcome", () => {
      const trigger = detectRichMenuTrigger("你好，我想了解崑家汽車");
      const messages = buildRichMenuResponseMessages(trigger!, []);
      expect(messages).toHaveLength(1);
    });

    it("should filter to only available vehicles", () => {
      const trigger = detectRichMenuTrigger("我想看車，有什麼車可以推薦？");
      const messages = buildRichMenuResponseMessages(trigger!, mockVehicles);
      // Only 3 available vehicles (Ford Tourneo is sold)
      expect(messages).toHaveLength(1);
      expect(messages[0].contents.contents).toHaveLength(3);
    });
  });

  // ============ BACKWARD COMPAT: buildRichMenuResponse ============

  describe("buildRichMenuResponse", () => {
    it("should build vehicle carousel for vehicle_browse", () => {
      const result = buildRichMenuResponse(
        { type: "vehicle_browse", label: "看車庫存" },
        mockVehicles
      );
      expect(result.type).toBe("flex");
      // Should only include available vehicles (3 out of 4)
      expect(result.contents.contents).toHaveLength(3);
    });

    it("should build popular carousel sorted by price desc", () => {
      const result = buildRichMenuResponse(
        { type: "popular", label: "熱門推薦" },
        mockVehicles
      );
      expect(result.type).toBe("flex");
      const bubbles = result.contents.contents;
      // First should be highest price (Honda CR-V 103.8)
      const firstBody = bubbles[0].body.contents[0].text;
      expect(firstBody).toContain("Honda");
    });

    it("should build budget carousel filtered ≤50萬", () => {
      const result = buildRichMenuResponse(
        { type: "budget", label: "50萬以下" },
        mockVehicles
      );
      expect(result.type).toBe("flex");
      const bubbles = result.contents.contents;
      // BMW X1 (37.8) and Kia Stonic (45.8) are under 50
      expect(bubbles).toHaveLength(2);
      // Should be sorted ascending: BMW first
      expect(bubbles[0].body.contents[0].text).toContain("BMW");
    });

    it("should build appointment card", () => {
      const result = buildRichMenuResponse(
        { type: "appointment", label: "預約賞車" },
        mockVehicles
      );
      expect(result.type).toBe("flex");
      expect(result.altText).toContain("預約賞車");
    });

    it("should build welcome card", () => {
      const result = buildRichMenuResponse(
        { type: "welcome", label: "阿家智能客服" },
        mockVehicles
      );
      expect(result.type).toBe("flex");
      expect(result.altText).toContain("歡迎");
    });

    it("should exclude sold vehicles from carousel", () => {
      const result = buildRichMenuResponse(
        { type: "vehicle_browse", label: "看車庫存" },
        mockVehicles
      );
      const bubbles = result.contents.contents;
      for (const bubble of bubbles) {
        const title = bubble.body.contents[0].text;
        expect(title).not.toContain("Tourneo"); // Ford Tourneo is sold
      }
    });
  });

  describe("buildAppointmentCard", () => {
    it("should have time slot buttons", () => {
      const card = buildAppointmentCard();
      expect(card.type).toBe("flex");
      const body = card.contents.body;
      const timeSlots = body.contents.find(
        (c: any) => c.type === "box" && c.contents?.some((cc: any) => cc.action?.text?.includes("上午"))
      );
      expect(timeSlots).toBeDefined();
    });

    it("should have phone call button", () => {
      const card = buildAppointmentCard();
      const body = card.contents.body;
      const phoneButton = body.contents.find(
        (c: any) => c.type === "button" && c.action?.uri === "tel:0936812818"
      );
      expect(phoneButton).toBeDefined();
    });
  });

  describe("buildWelcomeCard", () => {
    it("should contain 崑家汽車 branding", () => {
      const card = buildWelcomeCard();
      expect(card.altText).toContain("崑家汽車");
      const body = card.contents.body;
      const brandText = JSON.stringify(body);
      expect(brandText).toContain("崑家汽車");
      expect(brandText).toContain("高雄阿家");
    });

    it("should have quick action buttons", () => {
      const card = buildWelcomeCard();
      const body = card.contents.body;
      const buttonBox = body.contents.find(
        (c: any) => c.type === "box" && c.contents?.some((cc: any) => cc.type === "button")
      );
      expect(buttonBox).toBeDefined();
      const buttons = buttonBox.contents.filter((c: any) => c.type === "button");
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("buildSimpleCard", () => {
    it("should create a basic card with title and body", () => {
      const card = buildSimpleCard("測試標題", "測試內容", [
        { type: "uri", label: "按鈕", uri: "tel:123" },
      ]);
      expect(card.type).toBe("flex");
      expect(card.altText).toBe("測試標題");
    });
  });
});
