/**
 * LINE Rich Menu Management
 * Handles creating, uploading images, and setting default rich menus
 * via the LINE Messaging API.
 */

const LINE_API_BASE = "https://api.line.me/v2/bot";
const LINE_API_DATA_BASE = "https://api-data.line.me/v2/bot";

// Rich Menu image hosted on S3 CDN (2500x1686, JPEG, ~450KB)
const RICH_MENU_IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663029682479/UTwlvmRxvCHnYuiR.jpg";

// 6-button layout: 3 columns x 2 rows (2500x1686)
const COL_W = Math.floor(2500 / 3); // 833
const ROW_H = Math.floor(1686 / 2); // 843

interface RichMenuArea {
  bounds: { x: number; y: number; width: number; height: number };
  action: { type: string; label: string; text?: string; uri?: string };
}

function buildRichMenuObject() {
  const areas: RichMenuArea[] = [
    // Row 1
    {
      bounds: { x: 0, y: 0, width: COL_W, height: ROW_H },
      action: { type: "message", label: "看車庫存", text: "我想看車，有什麼車可以推薦？" },
    },
    {
      bounds: { x: COL_W, y: 0, width: COL_W, height: ROW_H },
      action: { type: "message", label: "預約賞車", text: "我想預約看車，什麼時候方便？" },
    },
    {
      bounds: { x: COL_W * 2, y: 0, width: 2500 - COL_W * 2, height: ROW_H },
      action: { type: "uri", label: "聯絡我們", uri: "tel:0936812818" },
    },
    // Row 2
    {
      bounds: { x: 0, y: ROW_H, width: COL_W, height: 1686 - ROW_H },
      action: { type: "message", label: "熱門推薦", text: "有什麼熱門車款推薦？" },
    },
    {
      bounds: { x: COL_W, y: ROW_H, width: COL_W, height: 1686 - ROW_H },
      action: { type: "message", label: "50萬以下", text: "50萬以下有什麼好車？" },
    },
    {
      bounds: { x: COL_W * 2, y: ROW_H, width: 2500 - COL_W * 2, height: 1686 - ROW_H },
      action: { type: "uri", label: "導航到店", uri: "https://maps.google.com/?q=高雄市三民區大順二路269號" },
    },
  ];

  return {
    size: { width: 2500, height: 1686 },
    selected: true, // Auto-open the rich menu
    name: "崑家汽車 Rich Menu",
    chatBarText: "📋 點我開啟選單",
    areas,
  };
}

/**
 * Get the current default rich menu ID
 */
export async function getDefaultRichMenuId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${LINE_API_BASE}/user/all/richmenu`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.richMenuId || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * List all rich menus
 */
export async function listRichMenus(accessToken: string): Promise<any[]> {
  try {
    const res = await fetch(`${LINE_API_BASE}/richmenu/list`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.richmenus || [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Delete a rich menu by ID
 */
export async function deleteRichMenu(accessToken: string, richMenuId: string): Promise<boolean> {
  try {
    const res = await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Create a new rich menu and return the rich menu ID
 */
export async function createRichMenu(accessToken: string): Promise<string> {
  const body = buildRichMenuObject();
  console.log("[RichMenu] Creating rich menu...");

  const res = await fetch(`${LINE_API_BASE}/richmenu`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create rich menu: ${res.status} ${errText}`);
  }

  const data = await res.json();
  console.log(`[RichMenu] Created: ${data.richMenuId}`);
  return data.richMenuId;
}

/**
 * Upload the rich menu image from CDN URL
 */
export async function uploadRichMenuImage(
  accessToken: string,
  richMenuId: string
): Promise<void> {
  console.log(`[RichMenu] Downloading image from CDN...`);

  // Download image from CDN
  const imgRes = await fetch(RICH_MENU_IMAGE_URL);
  if (!imgRes.ok) {
    throw new Error(`Failed to download rich menu image: ${imgRes.status}`);
  }
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  console.log(`[RichMenu] Image downloaded: ${imgBuffer.length} bytes`);

  // Upload to LINE
  console.log(`[RichMenu] Uploading image to LINE for menu ${richMenuId}...`);
  const uploadRes = await fetch(
    `${LINE_API_DATA_BASE}/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/jpeg",
      },
      body: imgBuffer,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload rich menu image: ${uploadRes.status} ${errText}`);
  }

  console.log(`[RichMenu] Image uploaded successfully`);
}

/**
 * Set a rich menu as the default for all users
 */
export async function setDefaultRichMenu(
  accessToken: string,
  richMenuId: string
): Promise<void> {
  console.log(`[RichMenu] Setting ${richMenuId} as default...`);

  const res = await fetch(
    `${LINE_API_BASE}/user/all/richmenu/${richMenuId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to set default rich menu: ${res.status} ${errText}`);
  }

  console.log(`[RichMenu] Default rich menu set successfully`);
}

/**
 * Cancel the default rich menu
 */
export async function cancelDefaultRichMenu(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${LINE_API_BASE}/user/all/richmenu`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Full deployment: create → upload image → set as default
 * Optionally cleans up old rich menus first.
 */
export async function deployRichMenu(accessToken: string): Promise<{
  richMenuId: string;
  success: boolean;
  steps: string[];
}> {
  const steps: string[] = [];

  try {
    // Step 1: Clean up old rich menus (optional, keep it tidy)
    const existingMenus = await listRichMenus(accessToken);
    const currentDefault = await getDefaultRichMenuId(accessToken);
    
    if (currentDefault) {
      await cancelDefaultRichMenu(accessToken);
      steps.push(`取消舊的預設 Rich Menu: ${currentDefault}`);
    }

    // Delete old menus created by us (keep LINE Official Account Manager ones)
    for (const menu of existingMenus) {
      if (menu.name === "崑家汽車 Rich Menu") {
        await deleteRichMenu(accessToken, menu.richMenuId);
        steps.push(`刪除舊 Rich Menu: ${menu.richMenuId}`);
      }
    }

    // Step 2: Create new rich menu
    const richMenuId = await createRichMenu(accessToken);
    steps.push(`建立新 Rich Menu: ${richMenuId}`);

    // Step 3: Upload image
    await uploadRichMenuImage(accessToken, richMenuId);
    steps.push("上傳 Rich Menu 圖片完成");

    // Step 4: Set as default
    await setDefaultRichMenu(accessToken, richMenuId);
    steps.push("設為預設 Rich Menu 完成");

    return { richMenuId, success: true, steps };
  } catch (err: any) {
    steps.push(`錯誤: ${err.message}`);
    return { richMenuId: "", success: false, steps };
  }
}

/**
 * Get rich menu status (for admin dashboard)
 */
export async function getRichMenuStatus(accessToken: string): Promise<{
  hasDefault: boolean;
  defaultMenuId: string | null;
  totalMenus: number;
  menus: Array<{ richMenuId: string; name: string; chatBarText: string }>;
}> {
  const [defaultId, menus] = await Promise.all([
    getDefaultRichMenuId(accessToken),
    listRichMenus(accessToken),
  ]);

  return {
    hasDefault: !!defaultId,
    defaultMenuId: defaultId,
    totalMenus: menus.length,
    menus: menus.map((m: any) => ({
      richMenuId: m.richMenuId,
      name: m.name,
      chatBarText: m.chatBarText,
    })),
  };
}
