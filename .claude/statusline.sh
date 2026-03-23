#!/bin/bash
# Kunjia Autos — Claude Code HUD (Heads-Up Display)
# Shows: model | git branch | context bar | cost | duration

input=$(cat)

# ── Extract fields ──────────────────────────────────
MODEL=$(echo "$input" | jq -r '.model.display_name // "Claude"')
DIR=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // "?"' | sed 's|.*/||')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
PCT_INT=$(printf '%.0f' "$PCT" 2>/dev/null || echo 0)
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')

# ── Colors ──────────────────────────────────────────
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Git branch ──────────────────────────────────────
BRANCH=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
fi

# ── Context progress bar (10 segments) ──────────────
if [ "$PCT_INT" -ge 90 ]; then
    BAR_COLOR="$RED"
elif [ "$PCT_INT" -ge 70 ]; then
    BAR_COLOR="$YELLOW"
else
    BAR_COLOR="$GREEN"
fi

FILLED=$((PCT_INT * 10 / 100))
EMPTY=$((10 - FILLED))
BAR=""
for ((i=0; i<FILLED; i++)); do BAR="${BAR}█"; done
for ((i=0; i<EMPTY; i++)); do BAR="${BAR}░"; done

# ── Cost formatting ─────────────────────────────────
COST_FMT=$(printf '$%.2f' "$COST" 2>/dev/null || echo '$0.00')

# ── Duration formatting ─────────────────────────────
DUR_SEC=$((DURATION_MS / 1000))
MINS=$((DUR_SEC / 60))
SECS=$((DUR_SEC % 60))
if [ "$MINS" -gt 0 ]; then
    TIME_FMT="${MINS}m ${SECS}s"
else
    TIME_FMT="${SECS}s"
fi

# ── Line 1: Model | Branch | Directory ──────────────
echo -e "${BOLD}${CYAN}${MODEL}${RESET} ${DIM}|${RESET} ${GREEN}${BRANCH}${RESET} ${DIM}|${RESET} ${DIR}"

# ── Line 2: Progress bar | Cost | Duration ──────────
echo -e "${BAR_COLOR}${BAR}${RESET} ${PCT_INT}% ${DIM}|${RESET} ${YELLOW}${COST_FMT}${RESET} ${DIM}|${RESET} ${DIM}${TIME_FMT}${RESET}"
