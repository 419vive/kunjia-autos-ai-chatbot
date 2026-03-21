#!/bin/bash
# Layer 4: Fires on Claude Code session end
# Stores rich session summary in Hindsight for cross-session learning
# Falls back gracefully if Hindsight is not running

HINDSIGHT_URL="${HINDSIGHT_URL:-http://localhost:8888}"
BANK="claude-sessions"

# Quick health check — skip if Hindsight isn't running
if ! curl -sf "$HINDSIGHT_URL/health" > /dev/null 2>&1; then
  exit 0
fi

# --- Gather session context ---
BRANCH=""
LAST_COMMITS=""
MODIFIED_FILES=""
REPO_NAME=""

if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  REPO_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")
  LAST_COMMITS=$(git log --oneline -5 2>/dev/null)
  MODIFIED_FILES=$(git diff --name-only HEAD~5..HEAD 2>/dev/null | head -20)
fi

# Read primer.md for session state (what was worked on, next steps)
PRIMER=""
if [ -f "$HOME/.claude/primer.md" ]; then
  PRIMER=$(head -50 "$HOME/.claude/primer.md")
fi

# Read recent lessons learned
LESSONS=""
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/tasks/lessons.md" ]; then
  LESSONS=$(tail -10 "$REPO_ROOT/tasks/lessons.md")
fi

# --- Build rich memory content ---
CONTENT=$(python3 -c "
import json, sys, os

parts = []
parts.append(f'Session ended: {os.popen(\"date -Iseconds\").read().strip()}')

branch = '''$BRANCH'''
repo = '''$REPO_NAME'''
if repo:
    parts.append(f'Project: {repo} (branch: {branch})')

commits = '''$LAST_COMMITS'''
if commits.strip():
    parts.append(f'Recent commits:\\n{commits}')

files = '''$MODIFIED_FILES'''
if files.strip():
    parts.append(f'Modified files:\\n{files}')

primer = '''$PRIMER'''
if primer.strip():
    parts.append(f'Session state:\\n{primer}')

lessons = '''$LESSONS'''
if lessons.strip():
    parts.append(f'Recent lessons:\\n{lessons}')

content = '\\n\\n'.join(parts)
print(json.dumps({'items': [{'content': content}]}))
" 2>/dev/null)

if [ -n "$CONTENT" ]; then
  curl -sf -X POST "$HINDSIGHT_URL/v1/default/banks/$BANK/memories" \
    -H 'Content-Type: application/json' \
    -d "$CONTENT" \
    > /dev/null 2>&1
fi

exit 0
