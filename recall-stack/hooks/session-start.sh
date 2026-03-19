#!/bin/bash
# Layer 3+4: Fires on every Claude Code session start
# Injects git context (Layer 3) + Hindsight behavioral patterns (Layer 4)

HINDSIGHT_URL="${HINDSIGHT_URL:-http://localhost:8888}"
BANK="claude-sessions"

echo "## Live Context (auto-injected)"
echo ""

# --- Layer 3: Git context ---
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  REPO_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")

  echo "### Git Status"
  echo "**Branch:** $(git branch --show-current 2>/dev/null)"
  echo "**Last 5 commits:**"
  git log --oneline -5 2>/dev/null
  echo ""
  MODIFIED=$(git status --short 2>/dev/null)
  if [ -n "$MODIFIED" ]; then
    echo "**Modified files:**"
    echo "$MODIFIED"
    echo ""
  fi
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
  if [ -f "$REPO_ROOT/.claude-memory.md" ]; then
    echo "**Recent commit log:**"
    tail -10 "$REPO_ROOT/.claude-memory.md"
    echo ""
  fi
fi

# --- Layer 4: Hindsight recall ---
# Skip if Hindsight isn't running (fail silently)
if ! curl -sf "$HINDSIGHT_URL/health" > /dev/null 2>&1; then
  exit 0
fi

# Build a project-aware recall query
QUERY="behavioral patterns, corrections, preferences, and lessons learned"
if [ -n "$REPO_NAME" ]; then
  QUERY="$QUERY for project $REPO_NAME"
fi

RECALL_JSON=$(curl -sf -X POST "$HINDSIGHT_URL/v1/default/banks/$BANK/memories/recall" \
  -H 'Content-Type: application/json' \
  -d "{\"query\": \"$QUERY\", \"n\": 10}" \
  2>/dev/null)

if [ -n "$RECALL_JSON" ] && [ "$RECALL_JSON" != "null" ]; then
  PATTERNS=$(echo "$RECALL_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    seen = set()
    for r in data.get('results', []):
        t = r.get('text', '')
        if t and t not in seen:
            seen.add(t)
            # Truncate very long memories to keep context manageable
            if len(t) > 300:
                t = t[:300] + '...'
            print(f'- {t}')
except: pass
" 2>/dev/null)

  if [ -n "$PATTERNS" ]; then
    echo "### Hindsight Behavioral Patterns"
    echo "$PATTERNS"
    echo ""
  fi
fi

# Also recall recent session summaries for continuity
RECENT_JSON=$(curl -sf -X POST "$HINDSIGHT_URL/v1/default/banks/$BANK/memories/recall" \
  -H 'Content-Type: application/json' \
  -d "{\"query\": \"last session summary, what was completed, next steps\", \"n\": 3}" \
  2>/dev/null)

if [ -n "$RECENT_JSON" ] && [ "$RECENT_JSON" != "null" ]; then
  RECENT=$(echo "$RECENT_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for r in data.get('results', [])[:2]:
        t = r.get('text', '')
        if t:
            if len(t) > 500:
                t = t[:500] + '...'
            print(t)
            print('---')
except: pass
" 2>/dev/null)

  if [ -n "$RECENT" ]; then
    echo "### Recent Session Memory"
    echo "$RECENT"
    echo ""
  fi
fi

exit 0
