# Active Project: Claude-Code-Remote (LINE chatbot & admin dashboard)

## Completed This Session
- Performance optimization PR #9 (5 improvements: compression, caching, DB pooling, chunk splitting, non-blocking sync)
- Installed claude-hud plugin v0.0.11 (real-time statusline HUD)
- Configured claude-hud with tools, agents, todos, duration, config counts display
- StatusLine config written to ~/.claude/settings.json

## Exact Next Step
Restart Claude Code to activate claude-hud statusline. Then verify HUD appears below input field.

## Open Blockers
- None

## Installed Plugins
- claude-hud v0.0.11 — statusline HUD showing context usage, tools, agents, todos, git status
  - Config: ~/.claude/plugins/claude-hud/config.json
  - Setup: /claude-hud:setup (re-run after issues)
  - Configure: /claude-hud:configure (change display options)
  - Reconfigure via: Edit ~/.claude/plugins/claude-hud/config.json

## Key Knowledge
- claude-hud requires restart after install to activate
- Plugin path: ~/.claude/plugins/cache/claude-hud/claude-hud/0.0.11/
- Runtime: /opt/node22/bin/node with dist/index.js
- Dynamic version resolution: auto-updates without re-running setup
- Drizzle ORM + mysql2: use `mysql2` (not `mysql2/promise`) for pool types
