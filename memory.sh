#!/bin/bash

# Persistent Memory Launcher for Claude Code
# Reads primer, git history, lessons, and launches Claude with full context

PRIMER_FILE="$HOME/.claude/primer.md"
LESSONS_FILE="tasks/lessons.md"

# Read primer if it exists
PRIMER=""
if [ -f "$PRIMER_FILE" ]; then
  PRIMER=$(cat "$PRIMER_FILE")
fi

# Get last 5 git commits
GIT_LOG=$(git log --oneline -5 2>/dev/null || echo "No git history")

# Get modified files
MODIFIED=$(git diff --name-only 2>/dev/null || echo "No changes")

# Get current branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# Read lessons if they exist
LESSONS=""
if [ -f "$LESSONS_FILE" ]; then
  LESSONS=$(cat "$LESSONS_FILE")
fi

# Build system prompt
SYSTEM_PROMPT="PERSISTENT MEMORY CONTEXT:

== PRIMER (last session state) ==
$PRIMER

== CURRENT BRANCH ==
$BRANCH

== LAST 5 COMMITS ==
$GIT_LOG

== MODIFIED FILES ==
$MODIFIED

== LESSONS LEARNED ==
$LESSONS

Resume work from where we left off. Read CLAUDE.md for project rules."

# Launch Claude with context
claude --system-prompt "$SYSTEM_PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Bash(git:*) Bash(npm:*) Edit Write Read"
