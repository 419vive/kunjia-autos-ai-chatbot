/**
 * LINE Flex Message Templates for Rich Menu responses
 * Each function generates a LINE Flex Message JSON object
 */

import type { Vehicle } from "../drizzle/schema";

// ============ HELPER: Parse photo URLs from vehicle ============

function parsePhotoUrls(v: Vehicle): string[] {
  try {
    const raw = (v.photoUrls as string) || "";
    if (raw.startsWith("[")) {
      return JSON.parse(raw);
    } else if (raw.includes("|")) {
      return raw.split("|").filter(Boolean);
    } else if (raw.startsWith("http")) {
      return [raw];
    }
  } catch {
    // ignore
  }
  return [];
}

// ============ VEHICLE BUBBLE BUILDER ============

function buildVehicleBubble(v: Vehicle): any {
  const photos = parsePhotoUrls(v);
  const photoUrl = photos[0] || "https://via.placeholder.com/800x600?text=No+Photo";
  const priceText = v.priceDisplay || `${v.price}萬`;
  const specs: string[] = [];
  if (v.modelYear) specs.push(`${v.modelYear}年`);
  if (v.mileage) specs.push(v.mileage);
  if (v.displacement) specs.push(v.displacement);
  if (v.transmission) specs.push(v.transmission);
  if (v.fuelType) specs.push(v.fuelType);
  if (v.color) specs.push(v.color);

  const photoCount = photos.length;

  // Build LINE inquiry message with vehicle details
  const lineInquiryText = `我想詢問這台車：\n${v.brand} ${v.model} ${v.modelYear || ""}年\n售價：${priceText}\n${specs.slice(0, 3).join(" · ")}`;

  const footerButtons: any[] = [
    {
      type: "button",
      action: {
        type: "message",
        label: "💬 LINE 問這台車",
        text: lineInquiryText,
      },
      style: "primary",
      color: "#06C755",
    },
  ];

  // Add "看所有照片" button if vehicle has more than 1 photo
  if (photoCount > 1) {
    footerButtons.push({
      type: "button",
      action: {
        type: "message",
        label: `📸 看所有照片 (${photoCount}張)`,
        text: `看照片 ${v.externalId}`,
      },
      style: "secondary",
    });
  }

  footerButtons.push({
    type: "button",
    action: {
      type: "uri",
      label: "📞 直接聯繫",
      uri: "tel:0936812818",
    },
    style: "secondary",
  });

  return {
    type: "bubble",
    size: "kilo",
    hero: {
      type: "image",
      url: photoUrl,
      size: "full",
      aspectRatio: "4:3",
      aspectMode: "cover",
      action: {
        type: "uri",
        label: "查看詳情",
        uri: v.sourceUrl || "https://kunchatbot-yqvyvfb6.manus.space",
      },
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: `${v.brand} ${v.model}`,
          weight: "bold",
          size: "lg",
          wrap: true,
          maxLines: 2,
        },
        {
          type: "text",
          text: specs.slice(0, 4).join(" · "),
          size: "xs",
          color: "#999999",
          wrap: true,
          maxLines: 2,
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: priceText,
              size: "xl",
              weight: "bold",
              color: "#C4A265",
            },
          ],
          margin: "md",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerButtons,
    },
  };
}

// ============ VEHICLE CAROUSEL (returns array of messages) ============
// Used by: 看車庫存, 熱門推薦, 50萬以下
// Returns an ARRAY of Flex Messages to support >12 vehicles

export function buildVehicleCarouselMessages(
  vehicles: Vehicle[],
  title: string,
  subtitle: string
): any[] {
  if (vehicles.length === 0) {
    return [
      buildSimpleCard(
        "😅 目前沒有符合的車輛",
        "不過我們隨時有新車進來！\n歡迎直接聯繫賴先生了解最新庫存。",
        [{ type: "uri", label: "📞 撥打 0936-812-818", uri: "tel:0936812818" }]
      ),
    ];
  }

  // Split vehicles into chunks of 12 (LINE carousel max)
  const CAROUSEL_MAX = 12;
  const messages: any[] = [];

  for (let i = 0; i < vehicles.length; i += CAROUSEL_MAX) {
    const chunk = vehicles.slice(i, i + CAROUSEL_MAX);
    const bubbles = chunk.map((v) => buildVehicleBubble(v));

    const chunkIndex = Math.floor(i / CAROUSEL_MAX) + 1;
    const totalChunks = Math.ceil(vehicles.length / CAROUSEL_MAX);
    const altSuffix = totalChunks > 1 ? ` (${chunkIndex}/${totalChunks})` : "";

    messages.push({
      type: "flex",
      altText: `${title} - ${vehicles.length}台車${altSuffix}`,
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    });
  }

  // LINE reply API max 5 messages, keep within limit
  return messages.slice(0, 5);
}

// ============ BACKWARD COMPAT: single message version ============

export function buildVehicleCarousel(
  vehicles: Vehicle[],
  title: string,
  subtitle: string
): any {
  const messages = buildVehicleCarouselMessages(vehicles, title, subtitle);
  return messages[0] || null;
}

// ============ PHOTO CAROUSEL ============
// Sends all photos of a specific vehicle as an image carousel

export function buildPhotoCarousel(vehicle: Vehicle): any[] {
  const photos = parsePhotoUrls(vehicle);

  if (photos.length === 0) {
    return [
      buildSimpleCard(
        "😅 暫無照片",
        `${vehicle.brand} ${vehicle.model} 目前沒有照片資料。`,
        [{ type: "message", label: "💬 詢問這台車", text: `我想了解 ${vehicle.brand} ${vehicle.model}` }]
      ),
    ];
  }

  // Build header text message
  const headerMsg = {
    type: "text",
    text: `📸 ${vehicle.brand} ${vehicle.model} ${vehicle.modelYear || ""}年\n共 ${photos.length} 張照片，左右滑動瀏覽 👉`,
  };

  // LINE image carousel: each bubble is just an image
  // Max 12 bubbles per carousel, so split if needed
  const CAROUSEL_MAX = 12;
  const messages: any[] = [headerMsg];

  for (let i = 0; i < photos.length; i += CAROUSEL_MAX) {
    const chunk = photos.slice(i, i + CAROUSEL_MAX);

    const bubbles = chunk.map((url, idx) => ({
      type: "bubble",
      size: "kilo",
      hero: {
        type: "image",
        url: url,
        size: "full",
        aspectRatio: "4:3",
        aspectMode: "cover",
        action: {
          type: "message",
          label: "查看車輛",
          text: `我想詢問這台車：\n${vehicle.brand} ${vehicle.model} ${vehicle.modelYear || ""}年`,
        },
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${i + idx + 1} / ${photos.length}`,
            size: "xs",
            color: "#999999",
            align: "center",
          },
        ],
        paddingAll: "8px",
      },
    }));

    messages.push({
      type: "flex",
      altText: `${vehicle.brand} ${vehicle.model} 照片 (${Math.floor(i / CAROUSEL_MAX) + 1}/${Math.ceil(photos.length / CAROUSEL_MAX)})`,
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    });
  }

  // Add a footer with action buttons
  messages.push({
    type: "flex",
    altText: "查看更多",
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "💬 LINE 問這台車",
              text: `我想詢問這台車：\n${vehicle.brand} ${vehicle.model} ${vehicle.modelYear || ""}年\n售價：${vehicle.priceDisplay || vehicle.price + "萬"}`,
            },
            style: "primary",
            color: "#06C755",
          },
          {
            type: "button",
            action: {
              type: "uri",
              label: "📞 直接聯繫賴先生",
              uri: "tel:0936812818",
            },
            style: "secondary",
          },
        ],
      },
    },
  });

  // LINE reply API max 5 messages
  return messages.slice(0, 5);
}

// ============ PHOTO TRIGGER DETECTION ============

/**
 * Detect if a message is a photo gallery trigger.
 * Format: "看照片 {externalId}"
 * Returns the externalId or null.
 */
export function detectPhotoTrigger(message: string): string | null {
  const match = message.match(/^看照片\s+(\d+)$/);
  return match ? match[1] : null;
}

// ============ WELCOME CARD ============
// Used by: 阿家智能客服

export function buildWelcomeCard(): any {
  return {
    type: "flex",
    altText: "歡迎來到崑家汽車！",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "lg",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "🚗",
                size: "3xl",
                flex: 0,
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "崑家汽車",
                    weight: "bold",
                    size: "xl",
                    color: "#1B3A5C",
                  },
                  {
                    type: "text",
                    text: "高雄優質中古車商 · 誠信經營40年老口碑",
                    size: "xs",
                    color: "#999999",
                  },
                ],
                margin: "lg",
              },
            ],
          },
          {
            type: "separator",
          },
          {
            type: "text",
            text: "人客你好！我是高雄阿家 👋\n在高雄車界打滾40年，專門幫你找到最適合的好車！有什麼需要儘管問，阿家24小時都在！",
            wrap: true,
            size: "sm",
            color: "#555555",
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "lg",
            contents: [
              {
                type: "button",
                action: {
                  type: "message",
                  label: "🔍 瀏覽在售車輛",
                  text: "我想看車，有什麼車可以推薦？",
                },
                style: "primary",
                color: "#1B3A5C",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "💰 50萬以下好車",
                  text: "50萬以下有什麼好車？",
                },
                style: "primary",
                color: "#C4A265",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "📅 預約到店賞車",
                  text: "我想預約看車，什麼時候方便？",
                },
                style: "secondary",
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "lg",
            contents: [
              {
                type: "text",
                text: "📍 三民區大順二路269號",
                size: "xs",
                color: "#AAAAAA",
                flex: 2,
              },
              {
                type: "text",
                text: "📞 0936-812-818 賴先生",
                size: "xs",
                color: "#AAAAAA",
                flex: 2,
                align: "end",
              },
            ],
          },
        ],
      },
    },
  };
}

// ============ APPOINTMENT CARD ============
// Used by: 預約賞車

export function buildAppointmentCard(): any {
  return {
    type: "flex",
    altText: "預約賞車 - 崑家汽車",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "lg",
        contents: [
          {
            type: "text",
            text: "📅 預約到店賞車",
            weight: "bold",
            size: "xl",
            color: "#1B3A5C",
          },
          {
            type: "separator",
          },
          {
            type: "text",
            text: "歡迎來崑家汽車看車！\n📍 地址：高雄市三民區大順二路269號（肯德基斜對面）\n賴先生親自為你服務。\n\n來之前先跟我們約個時間，\n阿家幫你把車準備好，讓你看得舒服！",
            wrap: true,
            size: "sm",
            color: "#555555",
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "md",
            margin: "lg",
            contents: [
              {
                type: "text",
                text: "⏰ 營業時間",
                weight: "bold",
                size: "sm",
                color: "#1B3A5C",
              },
              {
                type: "text",
                text: "週一至週六 09:00 - 20:00\n週日 預約制",
                size: "sm",
                color: "#555555",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "lg",
            contents: [
              {
                type: "text",
                text: "選擇你方便的時段：",
                size: "sm",
                color: "#999999",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "🌅 平日上午 (9:00-12:00)",
                  text: "我想平日上午去看車",
                },
                style: "secondary",
                height: "sm",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "☀️ 平日下午 (13:00-17:00)",
                  text: "我想平日下午去看車",
                },
                style: "secondary",
                height: "sm",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "🌙 平日晚上 (17:00-20:00)",
                  text: "我想平日晚上去看車",
                },
                style: "secondary",
                height: "sm",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "🗓️ 週末 (需預約)",
                  text: "我想週末去看車，可以預約嗎？",
                },
                style: "secondary",
                height: "sm",
              },
            ],
          },
          {
            type: "button",
            action: {
              type: "uri",
              label: "📞 直接打電話預約",
              uri: "tel:0936812818",
            },
            color: "#C4A265",
            margin: "lg",
          },
        ],
      },
    },
  };
}

// ============ SIMPLE CARD ============
// Generic card with title, body, and actions

export function buildSimpleCard(
  title: string,
  body: string,
  actions: any[]
): any {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "lg",
            color: "#1B3A5C",
            wrap: true,
          },
          {
            type: "text",
            text: body,
            size: "sm",
            color: "#555555",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: actions.map((a: any) => ({
          type: "button",
          action: a,
          style: "primary",
          color: "#1B3A5C",
        })),
      },
    },
  };
}

// ============ FAQ PROGRESSIVE MESSAGE SYSTEM ============
// 漸進式訊息設計：只露問題 → 點擊才揭曉答案 → 每次互動加深信任
//
// Flow: Follow → 歡迎 + 問題選單（不露答案）
//       → 用戶點問題 → 揭曉答案 + 推車 + 「還想知道？」
//       → 每次點擊 = Lead Score +10

export const FAQ_ITEMS = [
  {
    id: 1,
    icon: "🛡️",
    title: "第三方認證",
    color: "#1B3A5C",
    triggerText: "崑家FAQ：車況有保障嗎",
    shortQuestion: "車況有保障嗎？會不會買到事故車？",
    answer:
      "絕對不會！我們全車系皆通過具公信力的「第三方認證」，並附有詳細的車況鑑定報告書。\n\n我們敢合約保證：\n✅ 無重大事故\n✅ 無泡水\n✅ 無引擎/車身號碼變造\n✅ 非營業用車\n\n若有不符，保證原價買回！認證書就是您的定心丸，讓您買得安心、開得放心！",
    ctaLabel: "🔍 看認證好車",
    ctaText: "我想看車，有什麼車可以推薦？",
  },
  {
    id: 2,
    icon: "💰",
    title: "超強貸款團隊",
    color: "#C4A265",
    triggerText: "崑家FAQ：自備款不足怎辦",
    shortQuestion: "自備款不足，還可以貸款買車嗎？",
    answer:
      "完全沒問題！我們擁有業界經驗最豐富的「超強貸款團隊」💪\n\n您只要負責挑喜歡的車，貸款難題交給我們搞定！\n\n不管您的條件如何，我們都會盡全力幫您爭取最佳方案。",
    ctaLabel: "💬 詢問貸款方案",
    ctaText: "我想了解貸款方案，自備款不多可以嗎？",
  },
  {
    id: 3,
    icon: "🚗",
    title: "外縣市免費接駁",
    color: "#06C755",
    triggerText: "崑家FAQ：外縣市怎看車",
    shortQuestion: "住外縣市，過去看車不方便怎辦？",
    answer:
      "我們非常歡迎外縣市的朋友！🙌\n\n提供專屬「Uber」免費接送：\n🚄 高鐵到站 → 專車接送\n🚂 台鐵到站 → 專車接送\n🚌 客運到站 → 專車接送\n\n只要提前預約，我們都會派車接您！\n就算最後沒成交也沒關係，買賣不成仁義在，當作交個朋友！",
    ctaLabel: "📅 預約免費接駁",
    ctaText: "我住外縣市，想預約看車可以接送嗎？",
  },
  {
    id: 4,
    icon: "⚡",
    title: "最快3小時交車",
    color: "#FF6600",
    triggerText: "崑家FAQ：多久能交車",
    shortQuestion: "流程走完，多久能開新車回家？",
    answer:
      "我們的流程絕對是業界最高效！⚡\n\n💵 現金購車：資料齊全，最快 3 小時內 開回家！\n🏦 貸款購車：對保完成後，最快約 3 天 交車！\n\n不讓您等，效率就是我們的招牌。",
    ctaLabel: "📞 聯繫賴先生",
    ctaText: "我想了解交車流程，大概要多久？",
  },
  {
    id: 5,
    icon: "🔄",
    title: "高價收購舊車",
    color: "#9B59B6",
    triggerText: "崑家FAQ：舊車可換新車嗎",
    shortQuestion: "有台舊車想換，你們有幫忙處理嗎？",
    answer:
      "當然有！我們提供「高價收購 & 車換車」服務 🔄\n\n因為我們有龐大的直營客群與銷售管道：\n💎 不經中間商 → 省下盤車剝削\n💎 舊車直接折抵新車車價\n💎 手續簡便、無縫換車\n\n省去自己賣車的麻煩，輕鬆升級！",
    ctaLabel: "💬 詢問舊車估價",
    ctaText: "我有一台舊車想換新車，可以估價嗎？",
  },
];

// ============ FAQ QUESTION MENU (only questions, no answers!) ============
// This is what users see FIRST — curiosity gap drives clicks

/**
 * Build the FAQ question menu — shows ONLY questions as clickable buttons.
 * Answers are hidden until user clicks. This is the core of progressive messaging.
 */
export function buildFaqQuestionMenu(): any {
  return {
    type: "flex",
    altText: "🏆 買車最怕什麼？點一個你最在意的問題 👇",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🏆 崑家汽車 — 五大保證",
            weight: "bold",
            size: "lg",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: "買車最怕什麼？點你最在意的 👇",
            size: "sm",
            color: "#FFFFFFCC",
            margin: "sm",
          },
        ],
        backgroundColor: "#1B3A5C",
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: FAQ_ITEMS.map((item) => ({
          type: "button",
          action: {
            type: "message",
            label: `${item.icon} ${item.shortQuestion}`,
            text: item.triggerText,
          },
          style: "secondary",
          height: "sm",
          margin: "sm",
        })),
        paddingAll: "12px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "🚗 跳過，直接看車！",
              text: "我想看車，有什麼車可以推薦？",
            },
            style: "primary",
            color: "#C4A265",
            height: "sm",
          },
        ],
        paddingAll: "12px",
      },
    },
  };
}

// ============ FAQ ANSWER REVEAL (shown when user clicks a question) ============

/**
 * Detect if a message is an FAQ trigger. Returns the FAQ item or null.
 */
export function detectFaqTrigger(message: string): (typeof FAQ_ITEMS)[number] | null {
  return FAQ_ITEMS.find((item) => item.triggerText === message) || null;
}

/**
 * Build the answer reveal for a specific FAQ item.
 * Returns array of messages: [answer bubble, follow-up prompt]
 */
export function buildFaqAnswerMessages(faqItem: (typeof FAQ_ITEMS)[number]): any[] {
  // 1. The answer reveal — beautiful Flex bubble
  const answerBubble: any = {
    type: "flex",
    altText: `${faqItem.icon} ${faqItem.title}：${faqItem.shortQuestion}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: faqItem.icon,
            size: "xxl",
            flex: 0,
          },
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: faqItem.title,
                weight: "bold",
                size: "lg",
                color: "#FFFFFF",
              },
              {
                type: "text",
                text: faqItem.shortQuestion,
                size: "xs",
                color: "#FFFFFFCC",
                wrap: true,
              },
            ],
            margin: "lg",
            flex: 1,
          },
        ],
        backgroundColor: faqItem.color,
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: faqItem.answer,
            size: "sm",
            color: "#333333",
            wrap: true,
          },
        ],
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: faqItem.ctaLabel,
              text: faqItem.ctaText,
            },
            style: "primary",
            color: faqItem.color,
            height: "sm",
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "📞 直接打給賴先生",
              text: "我想打電話聯繫",
            },
            style: "secondary",
            height: "sm",
          },
        ],
        paddingAll: "12px",
      },
    },
  };

  // 2. Follow-up: "還想知道什麼？" with remaining questions
  const remainingItems = FAQ_ITEMS.filter((item) => item.id !== faqItem.id);
  const followUpBubble: any = {
    type: "flex",
    altText: "還想了解什麼？",
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "還想了解什麼？👇",
            weight: "bold",
            size: "md",
            color: "#1B3A5C",
          },
          ...remainingItems.map((item) => ({
            type: "button",
            action: {
              type: "message",
              label: `${item.icon} ${item.title}`,
              text: item.triggerText,
            },
            style: "secondary",
            height: "sm",
            margin: "sm",
          })),
          {
            type: "button",
            action: {
              type: "message",
              label: "🚗 直接看車！",
              text: "我想看車，有什麼車可以推薦？",
            },
            style: "primary",
            color: "#C4A265",
            height: "sm",
            margin: "md",
          },
        ],
        paddingAll: "12px",
      },
    },
  };

  return [answerBubble, followUpBubble];
}

// ============ BACKWARD COMPAT: full FAQ carousel (all answers visible) ============

export function buildFaqCarousel(): any {
  return buildFaqQuestionMenu();
}

/**
 * Build the complete follow welcome sequence (progressive design)
 * Message 1: Warm welcome text
 * Message 2: FAQ question menu (questions only, no answers!)
 * The user CHOOSES what they want to know → answers revealed on click
 */
export function buildFollowWelcomeMessages(): any[] {
  return [
    {
      type: "text",
      text: "人客你好！歡迎加入崑家汽車 🚗\n\n我是高雄阿家，在車界打滾40年，專門幫你找到最適合的好車！\n\n👇 買車前最怕什麼？點一個你最在意的，阿家幫你解答！",
    },
    buildFaqQuestionMenu(),
  ];
}

// ============ RICH MENU TRIGGER DETECTION ============

export interface RichMenuTrigger {
  type: "vehicle_browse" | "appointment" | "popular" | "budget" | "welcome" | "faq";
  label: string;
}

/**
 * Detect if a message is a Rich Menu trigger (exact match from button actions)
 * Returns the trigger type or null if it's a regular message
 */
export function detectRichMenuTrigger(message: string): RichMenuTrigger | null {
  const triggers: Record<string, RichMenuTrigger> = {
    "我想看車，有什麼車可以推薦？": { type: "vehicle_browse", label: "看車庫存" },
    "我想預約看車，什麼時候方便？": { type: "appointment", label: "預約賞車" },
    "有什麼熱門車款推薦？": { type: "popular", label: "熱門推薦" },
    "50萬以下有什麼好車？": { type: "budget", label: "50萬以下" },
    "你好，我想了解崑家汽車": { type: "welcome", label: "阿家智能客服" },
    "崑家五大保證": { type: "faq", label: "五大保證" },
    "為什麼選崑家": { type: "faq", label: "五大保證" },
  };

  return triggers[message] || null;
}

/**
 * Build the appropriate Flex Message response for a Rich Menu trigger.
 * Now returns an ARRAY of messages to support >12 vehicles.
 */
export function buildRichMenuResponseMessages(
  trigger: RichMenuTrigger,
  allVehicles: Vehicle[]
): any[] {
  const availableVehicles = allVehicles.filter((v) => v.status === "available");

  switch (trigger.type) {
    case "vehicle_browse": {
      return buildVehicleCarouselMessages(
        availableVehicles,
        "🚗 崑家汽車在售車輛",
        "左右滑動瀏覽所有車輛"
      );
    }

    case "popular": {
      const popular = [...availableVehicles].sort((a, b) => {
        const pa = parseFloat(String(a.price || "0"));
        const pb = parseFloat(String(b.price || "0"));
        return pb - pa;
      });
      return buildVehicleCarouselMessages(
        popular.slice(0, 6),
        "⭐ 熱門推薦車款",
        "精選人氣車款"
      );
    }

    case "budget": {
      const budget = availableVehicles.filter((v) => {
        const p = parseFloat(String(v.price || "999"));
        return p <= 50;
      });
      budget.sort((a, b) => {
        const pa = parseFloat(String(a.price || "0"));
        const pb = parseFloat(String(b.price || "0"));
        return pa - pb;
      });
      return buildVehicleCarouselMessages(
        budget,
        "💰 50萬以下超值好車",
        "精選超值車款"
      );
    }

    case "appointment": {
      return [buildAppointmentCard()];
    }

    case "welcome": {
      return [buildWelcomeCard()];
    }

    case "faq": {
      return [buildFaqCarousel()];
    }

    default:
      return [];
  }
}

// Backward compat: single message version
export function buildRichMenuResponse(
  trigger: RichMenuTrigger,
  allVehicles: Vehicle[]
): any {
  const messages = buildRichMenuResponseMessages(trigger, allVehicles);
  return messages[0] || null;
}
