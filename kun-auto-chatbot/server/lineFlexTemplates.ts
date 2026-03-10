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

// ============ FAQ PROGRESSIVE CAROUSEL ============
// 崑家汽車五大核心優勢 FAQ - 漸進式訊息，用於 follow 事件和 Rich Menu

const FAQ_ITEMS = [
  {
    id: 1,
    icon: "🛡️",
    title: "第三方認證",
    color: "#1B3A5C",
    question: "車況有保障嗎？會不會買到事故車或泡水車？",
    answer:
      "絕對不會！我們全車系皆通過具公信力的「第三方認證」，並附有詳細的車況鑑定報告書。我們敢合約保證「無重大事故、無泡水、無引擎/車身號碼變造、非營業用車」，若有不符，保證原價買回！認證書就是您的定心丸，讓您買得安心、開得放心！",
    cta: { label: "🔍 瀏覽認證好車", text: "我想看車，有什麼車可以推薦？" },
  },
  {
    id: 2,
    icon: "💰",
    title: "超強貸款團隊",
    color: "#C4A265",
    question: "自備款不足，還可以貸款買車嗎？",
    answer:
      "完全沒問題！我們擁有業界經驗最豐富的「超強貸款團隊」，您只要負責挑喜歡的車，貸款難題交給我們幫您搞定！",
    cta: { label: "💬 詢問貸款方案", text: "我想了解貸款方案，自備款不多可以嗎？" },
  },
  {
    id: 3,
    icon: "🚗",
    title: "外縣市免費接駁",
    color: "#06C755",
    question: "住外縣市，過去看車不方便怎麼辦？",
    answer:
      "我們非常歡迎外縣市的朋友！提供專屬的「Uber」接送服務。只要您提前預約，無論搭高鐵、台鐵還是客運，到站後我們都會派專車免費接送您來店賞車。就算最後沒有成交也沒關係，買賣不成仁義在，誠心邀請您來體驗！",
    cta: { label: "📅 預約免費接駁", text: "我住外縣市，想預約看車可以接送嗎？" },
  },
  {
    id: 4,
    icon: "⚡",
    title: "最快3小時交車",
    color: "#FF6600",
    question: "所有手續跟流程走完，多久能開新車回家？",
    answer:
      "我們的流程絕對是業界最高效！現金購車，資料齊全最快「3小時內」就能把愛車開回家！貸款購車，銀行對保完成後最快「約3天」就能完美交車。",
    cta: { label: "📞 聯繫賴先生", text: "我想了解交車流程，大概要多久？" },
  },
  {
    id: 5,
    icon: "🔄",
    title: "高價收購舊車",
    color: "#9B59B6",
    question: "有台舊車想換新車，你們有幫忙處理嗎？",
    answer:
      "當然有！我們提供「高價收購與車換車」服務。因為我們有龐大的直營客群與銷售管道，不需經過中間商盤車的剝削，舊車價值可直接折抵新車車價，手續簡便、省去自己賣車的麻煩，輕鬆換車！",
    cta: { label: "💬 詢問舊車估價", text: "我有一台舊車想換新車，可以估價嗎？" },
  },
];

function buildFaqBubble(item: (typeof FAQ_ITEMS)[number]): any {
  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: item.icon,
          size: "xxl",
          flex: 0,
        },
        {
          type: "text",
          text: item.title,
          weight: "bold",
          size: "lg",
          color: "#FFFFFF",
          flex: 1,
          margin: "md",
          gravity: "center",
        },
      ],
      backgroundColor: item.color,
      paddingAll: "16px",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: `❓ ${item.question}`,
          size: "sm",
          color: "#C4A265",
          weight: "bold",
          wrap: true,
        },
        {
          type: "separator",
        },
        {
          type: "text",
          text: item.answer,
          size: "sm",
          color: "#555555",
          wrap: true,
        },
      ],
      paddingAll: "16px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "message",
            label: item.cta.label,
            text: item.cta.text,
          },
          style: "primary",
          color: item.color,
          height: "sm",
        },
      ],
      paddingAll: "12px",
    },
  };
}

/**
 * Build FAQ progressive carousel - 5 core advantages as swipeable cards
 * Used on: follow event, rich menu "了解崑家" trigger
 */
export function buildFaqCarousel(): any {
  return {
    type: "flex",
    altText: "🏆 崑家汽車五大保證 — 左右滑動瞭解更多",
    contents: {
      type: "carousel",
      contents: FAQ_ITEMS.map(buildFaqBubble),
    },
  };
}

/**
 * Build the complete follow welcome sequence (welcome text + FAQ carousel)
 * Returns array of messages for LINE push API
 */
export function buildFollowWelcomeMessages(): any[] {
  return [
    {
      type: "text",
      text: "人客你好！歡迎加入崑家汽車 🚗\n\n我是高雄阿家，在車界打滾40年！\n👇 先滑一下了解我們的五大保證，有問題隨時問，阿家24小時都在！",
    },
    buildFaqCarousel(),
    buildWelcomeCard(),
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
