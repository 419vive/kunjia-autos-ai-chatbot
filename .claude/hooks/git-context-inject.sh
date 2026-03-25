#!/bin/bash
# Layer 3: SessionStart Git Context Injection Hook
# Injects current branch, recent commits, modified files, and memory into session context
set -euo pipefail

# Only inject on startup/resume, not on clear/compact
INPUT=$(cat)
SOURCE=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('source',''))" 2>/dev/null || echo "")

if [[ "$SOURCE" == "clear" || "$SOURCE" == "compact" ]]; then
  echo '{}'
  exit 0
fi

# Gather git context
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMITS=$(git log --oneline -5 2>/dev/null || echo "No git history")
MODIFIED=$(git diff --name-only 2>/dev/null || echo "")
STAGED=$(git diff --cached --name-only 2>/dev/null || echo "")
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -10 || echo "")
REMOTE_STATUS=$(git status -sb 2>/dev/null | head -1 || echo "")

# Read lessons if available
LESSONS=""
if [ -f "tasks/lessons.md" ]; then
  LESSONS=$(cat tasks/lessons.md 2>/dev/null || echo "")
fi

# Build context string
CONTEXT="== GIT CONTEXT (Layer 3 — auto-injected) ==\n"
CONTEXT+="Branch: ${BRANCH}\n"
CONTEXT+="Remote: ${REMOTE_STATUS}\n\n"
CONTEXT+="Last 5 commits:\n${LAST_COMMITS}\n"

if [ -n "$MODIFIED" ]; then
  CONTEXT+="\nModified files:\n${MODIFIED}\n"
fi
if [ -n "$STAGED" ]; then
  CONTEXT+="\nStaged files:\n${STAGED}\n"
fi
if [ -n "$UNTRACKED" ]; then
  CONTEXT+="\nUntracked files:\n${UNTRACKED}\n"
fi
if [ -n "$LESSONS" ]; then
  CONTEXT+="\n== LESSONS LEARNED ==\n${LESSONS}\n"
fi

# Escape for JSON
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

ESCAPED=$(escape_for_json "$CONTEXT")

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${ESCAPED}"
  }
}
EOF

exit 0
