"""
Generate a professional LINE Rich Menu image for 崑家汽車
Size: 2500 x 1686 pixels (full size, 2 rows x 3 columns)
"""
from PIL import Image, ImageDraw, ImageFont
import os

# Canvas size
W, H = 2500, 1686
ROW_H = H // 2  # 843 per row
COL_W = W // 3  # ~833 per column

# Color palette - matching the website's dark blue + gold theme
BG_COLOR = (24, 47, 89)        # Dark navy blue (matches website header)
ACCENT_GOLD = (218, 165, 32)   # Gold accent
WHITE = (255, 255, 255)
LIGHT_BLUE = (41, 74, 130)     # Slightly lighter blue for alternating cells
BORDER_COLOR = (50, 90, 150)   # Border between cells
ICON_BG_1 = (30, 60, 110)     # Cell background 1
ICON_BG_2 = (35, 68, 120)     # Cell background 2

# Button definitions (row, col order)
buttons = [
    {"emoji": "🚗", "title": "看車庫存", "subtitle": "瀏覽所有在售車輛", "bg": ICON_BG_1},
    {"emoji": "📅", "title": "預約賞車", "subtitle": "安排到店看車時間", "bg": ICON_BG_2},
    {"emoji": "📞", "title": "聯絡我們", "subtitle": "0936-812-818 賴先生", "bg": ICON_BG_1},
    {"emoji": "🔥", "title": "熱門推薦", "subtitle": "精選人氣車款", "bg": ICON_BG_2},
    {"emoji": "💰", "title": "50萬以下", "subtitle": "超值好車推薦", "bg": ICON_BG_1},
    {"emoji": "💬", "title": "AI智能客服", "subtitle": "24小時線上諮詢", "bg": ICON_BG_2},
]

# Create image
img = Image.new("RGB", (W, H), BG_COLOR)
draw = ImageDraw.Draw(img)

# Try to load fonts
try:
    # Try system CJK fonts
    font_paths = [
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    title_font = None
    for fp in font_paths:
        if os.path.exists(fp):
            title_font = ImageFont.truetype(fp, 72)
            subtitle_font = ImageFont.truetype(fp, 40)
            break
    if title_font is None:
        # Download Noto Sans CJK
        os.system("sudo apt-get install -y fonts-noto-cjk 2>/dev/null")
        for fp in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
                    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc"]:
            if os.path.exists(fp):
                title_font = ImageFont.truetype(fp, 72)
                subtitle_font = ImageFont.truetype(fp, 40)
                break
    if title_font is None:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
except Exception as e:
    print(f"Font error: {e}")
    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()

# Draw each button cell
for idx, btn in enumerate(buttons):
    row = idx // 3
    col = idx % 3
    
    x0 = col * COL_W
    y0 = row * ROW_H
    x1 = x0 + COL_W
    y1 = y0 + ROW_H
    
    # Fill cell background with gradient effect
    bg = btn["bg"]
    draw.rectangle([x0, y0, x1, y1], fill=bg)
    
    # Draw subtle border
    draw.rectangle([x0, y0, x1, y1], outline=BORDER_COLOR, width=3)
    
    # Draw a subtle accent line at top of each cell
    draw.rectangle([x0 + 40, y0 + 20, x1 - 40, y0 + 24], fill=ACCENT_GOLD)
    
    # Center point of cell
    cx = x0 + COL_W // 2
    cy = y0 + ROW_H // 2
    
    # Draw icon circle background
    circle_r = 100
    circle_y = cy - 80
    draw.ellipse(
        [cx - circle_r, circle_y - circle_r, cx + circle_r, circle_y + circle_r],
        fill=(ACCENT_GOLD[0], ACCENT_GOLD[1], ACCENT_GOLD[2], 200),
        outline=WHITE,
        width=4
    )
    
    # Draw emoji text in circle (fallback: use text)
    emoji_text = btn["emoji"]
    try:
        # Try to use emoji font
        emoji_font_paths = [
            "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
            "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf",
        ]
        emoji_font = None
        for efp in emoji_font_paths:
            if os.path.exists(efp):
                emoji_font = ImageFont.truetype(efp, 80)
                break
        if emoji_font:
            bbox = draw.textbbox((0, 0), emoji_text, font=emoji_font)
            ew = bbox[2] - bbox[0]
            eh = bbox[3] - bbox[1]
            draw.text((cx - ew // 2, circle_y - eh // 2), emoji_text, font=emoji_font, fill=WHITE)
        else:
            # Draw a simple icon symbol instead
            draw.text((cx - 30, circle_y - 40), "●", font=title_font, fill=WHITE)
    except:
        pass
    
    # Draw title text
    title = btn["title"]
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    title_y = cy + 60
    draw.text((cx - tw // 2, title_y), title, font=title_font, fill=WHITE)
    
    # Draw subtitle text
    subtitle = btn["subtitle"]
    bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    sw = bbox[2] - bbox[0]
    subtitle_y = title_y + 90
    draw.text((cx - sw // 2, subtitle_y), subtitle, font=subtitle_font, fill=(180, 200, 230))

# Add a thin gold border around the entire image
draw.rectangle([0, 0, W-1, H-1], outline=ACCENT_GOLD, width=6)

# Save
output_path = "/home/ubuntu/kun-auto-chatbot/rich-menu-image.png"
img.save(output_path, "PNG")
print(f"Rich menu image saved to {output_path}")
print(f"Size: {img.size}")

# Also check file size
size_kb = os.path.getsize(output_path) / 1024
print(f"File size: {size_kb:.1f} KB")
if size_kb > 1024:
    # Need to compress - save as JPEG
    jpg_path = "/home/ubuntu/kun-auto-chatbot/rich-menu-image.jpg"
    img.save(jpg_path, "JPEG", quality=85)
    jpg_size = os.path.getsize(jpg_path) / 1024
    print(f"JPEG size: {jpg_size:.1f} KB")
