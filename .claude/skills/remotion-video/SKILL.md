---
name: remotion-video
description: Create and render programmatic videos using Remotion. Trigger whenever the user mentions video creation, video ads, reels, shorts, animated content, or wants to make visual content — even if they don't say "Remotion" directly.
metadata:
  tags: remotion, video, react, animation, ads, reels, shorts, tiktok, instagram
---

## When to use

Activate this skill when the user wants to:
- Create any kind of video (ads, reels, shorts, showcases, explainers)
- Animate text, graphics, or data
- Render MP4/WebM output
- Preview video in Remotion Studio

## Project Setup

Our Remotion project lives at: `car-videos/`

### Environment Notes (Claude Code Remote)
- Browser: Use Playwright's headless_shell at `/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell`
- GL Renderer: `angle` (required for this environment)
- Fonts: System fonts only (Google Fonts CDN is blocked by proxy)
- External images: Blocked by proxy — use inline SVG or `staticFile()` for local images
- Format: 1080x1920 vertical (optimized for LINE/Instagram/TikTok/Shorts)

### Key Commands
```bash
# Preview in studio
cd car-videos && npx remotion studio

# Render video
npx remotion render <CompositionId> out/<filename>.mp4

# Render single frame (for previews)
npx remotion still <CompositionId> --frame=<N> out/<filename>.png
```

## Remotion Best Practices

Load rules from the global skill library for domain-specific knowledge:
- Animation: `~/.agents/skills/remotion-best-practices/rules/animations.md`
- Timing: `~/.agents/skills/remotion-best-practices/rules/timing.md`
- Transitions: `~/.agents/skills/remotion-best-practices/rules/transitions.md`
- Text animations: `~/.agents/skills/remotion-best-practices/rules/text-animations.md`
- Sequencing: `~/.agents/skills/remotion-best-practices/rules/sequencing.md`
- Charts: `~/.agents/skills/remotion-best-practices/rules/charts.md`
- Images: `~/.agents/skills/remotion-best-practices/rules/images.md`
- Captions: `~/.agents/skills/remotion-best-practices/rules/subtitles.md`
- Full index: `~/.agents/skills/remotion-best-practices/SKILL.md`

### Critical Rules
1. **ALL animations** must use `useCurrentFrame()` + `interpolate()` or `spring()`. CSS transitions/animations are FORBIDDEN.
2. Use Remotion's `<Img>` component, never native `<img>`.
3. Always `premountFor` on `<Sequence>` components.
4. `useCurrentFrame()` inside a `<Sequence>` returns local frame (0-based).
5. Use `<Series>` for sequential non-overlapping scenes.

## Starter Prompt Templates

### 1. Product Ad (Car Dealership)
```
Create a 30-second vertical video ad for 崑家汽車.
Dark background (#0f0f0f). Accent color: #D4AF37 (gold).
Hook (0-5s): "[車款名稱] 限量釋出" fades in large and bold.
Features (5-20s): Three cards slide in one at a time:
 - Price with urgency badge
 - Key specs (排氣量/里程/年份)
 - Dealer trust stats
CTA (20-30s): "LINE 立即詢問" with green LINE button.
Resolution: 1080x1920.
```

### 2. Text Animation Reel
```
Create a 20-second vertical video with animated text.
Background: dark gradient from #0a0a0a to #1a1a2e.
Text color: white.
Show these lines one at a time, each fading in and sliding
up from the bottom:
Line 1 (0-5s): "[First statement]"
Line 2 (5-10s): "[Second statement]"
Line 3 (10-15s): "[Third statement]"
Line 4 (15-20s): "[Call to action]" in gold (#D4AF37)
Each line should be centered and large. Smooth transitions.
```

### 3. Stats / Social Proof Video
```
Create an animated statistics video, 20 seconds, vertical.
Dark background. Show these numbers one at a time with a
count-up animation:
- 40+ — 年經營歷史
- 500+ — 台成交紀錄
- 4.8 — Google 評分
- 100% — 實車實價
Use alternating gold/white accents.
Big numbers, clean layout, smooth transitions between each.
```
