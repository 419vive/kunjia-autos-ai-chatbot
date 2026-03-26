#!/bin/bash
# Pixel Agents Relay Hook — sends tool events to Railway server
# Called by Claude Code hooks (PreToolUse, PostToolUse, Stop)

RELAY_URL="${PIXEL_RELAY_URL:-https://claude-code-remote-production.up.railway.app/api/pixel-events}"
AGENT_ID="${CLAUDE_SESSION_ID:-1}"

# Read stdin (hook provides JSON)
INPUT=$(cat)

# Extract tool info
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event // empty' 2>/dev/null)

# Determine event type based on hook
case "$HOOK_EVENT" in
  PreToolUse)
    TOOL_ID=$(echo "$INPUT" | jq -r '.tool_input | keys[0] // "unknown"' 2>/dev/null || echo "tool-$$")
    STATUS="$TOOL_NAME"
    curl -s -X POST "$RELAY_URL" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"agentToolStart\",\"id\":1,\"toolId\":\"$TOOL_ID\",\"status\":\"$STATUS\"}" \
      >/dev/null 2>&1 &
    curl -s -X POST "$RELAY_URL" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"agentStatus\",\"id\":1,\"status\":\"active\"}" \
      >/dev/null 2>&1 &
    ;;
  PostToolUse)
    curl -s -X POST "$RELAY_URL" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"agentToolDone\",\"id\":1,\"toolId\":\"tool-$$\"}" \
      >/dev/null 2>&1 &
    ;;
  Stop)
    curl -s -X POST "$RELAY_URL" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"agentStatus\",\"id\":1,\"status\":\"waiting\"}" \
      >/dev/null 2>&1 &
    ;;
esac
