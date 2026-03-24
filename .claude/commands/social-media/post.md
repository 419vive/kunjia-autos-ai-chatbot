---
description: Post content to social media platforms via Blotato
arguments:
  - name: content
    description: What to post (text, or describe the media file)
    required: true
---

# Social Media Post

Post content across connected Blotato platforms with platform-optimized captions.

## Instructions

1. Read the Blotato skill file at `.claude/skills/blotato-social-media/SKILL.md`
2. Check if `brand.md` exists in the project root — use it for tone and style
3. Identify the content type (text, image, video) from the user's input
4. Write platform-specific captions following the skill file rules
5. Use Blotato MCP to publish to connected platforms
6. Report back: which platforms, what captions, any issues

## User Input
$ARGUMENTS
