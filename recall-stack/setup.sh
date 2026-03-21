#!/bin/bash
# One-command setup for the 5-layer Claude Code memory architecture
# Based on: github.com/keshavsuki/recall-stack
# Usage: bash setup.sh [--obsidian /path/to/vault]

set -e

OBSIDIAN_VAULT=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --obsidian) OBSIDIAN_VAULT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up 5-layer Claude Code memory architecture..."
echo ""

# --- Layer 1: CLAUDE.md ---
mkdir -p ~/.claude
if [ ! -f ~/.claude/CLAUDE.md ]; then
  cp "$SCRIPT_DIR/CLAUDE.md" ~/.claude/CLAUDE.md
  echo "[+] Layer 1: CLAUDE.md installed"
else
  echo "[=] Layer 1: CLAUDE.md already exists (not overwriting)"
fi

# --- Layer 2: primer.md ---
if [ ! -f ~/.claude/primer.md ]; then
  cp "$SCRIPT_DIR/primer.md" ~/.claude/primer.md
  echo "[+] Layer 2: primer.md installed"
else
  echo "[=] Layer 2: primer.md already exists (not overwriting)"
fi

# --- Layer 3+4: Hooks ---
mkdir -p ~/.claude/hooks
cp "$SCRIPT_DIR/hooks/session-start.sh" ~/.claude/hooks/session-start.sh
cp "$SCRIPT_DIR/hooks/session-end.sh" ~/.claude/hooks/session-end.sh
chmod +x ~/.claude/hooks/session-start.sh ~/.claude/hooks/session-end.sh
echo "[+] Layer 3+4: Hooks installed"

# Merge hooks into settings.json
if [ -f ~/.claude/settings.json ]; then
  if grep -q "session-start.sh" ~/.claude/settings.json 2>/dev/null; then
    echo "[=] Hooks already in settings.json (not overwriting)"
  else
    echo "[!] settings.json exists but has no recall-stack hooks."
    echo "    Merge manually from $SCRIPT_DIR/settings.json"
  fi
else
  cp "$SCRIPT_DIR/settings.json" ~/.claude/settings.json
  echo "[+] settings.json installed with hook configuration"
fi

# --- Layer 4: Hindsight (MCP + Docker) ---
echo ""

# 4a: MCP server config (works in any project with .mcp.json)
echo "[i] Layer 4: Hindsight MCP integration"
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/.mcp.json" ]; then
  if grep -q "hindsight" "$REPO_ROOT/.mcp.json" 2>/dev/null; then
    echo "[=] Hindsight MCP already in project .mcp.json"
  else
    echo "[!] Add Hindsight to $REPO_ROOT/.mcp.json:"
    echo '    "hindsight": {'
    echo '      "command": "npx",'
    echo '      "args": ["-y", "@vectorize-io/hindsight-mcp"],'
    echo '      "env": { "HINDSIGHT_API_URL": "http://localhost:8888" }'
    echo '    }'
  fi
else
  echo "[i] No .mcp.json found — MCP config skipped (add to your project manually)"
fi

# 4b: Docker backend
if command -v docker &> /dev/null; then
  if docker info > /dev/null 2>&1; then
    if ! docker ps -a --format '{{.Names}}' | grep -q '^hindsight$'; then
      # Detect available API key (prefer Anthropic, fallback to OpenAI)
      LLM_PROVIDER=""
      LLM_KEY=""
      if [ -n "$ANTHROPIC_API_KEY" ]; then
        LLM_PROVIDER="anthropic"
        LLM_KEY="$ANTHROPIC_API_KEY"
      elif [ -n "$OPENAI_API_KEY" ]; then
        LLM_PROVIDER="openai"
        LLM_KEY="$OPENAI_API_KEY"
      fi

      if [ -z "$LLM_KEY" ]; then
        echo "[!] Layer 4: Set ANTHROPIC_API_KEY or OPENAI_API_KEY, then run:"
        echo "    docker run -d --name hindsight --restart unless-stopped \\"
        echo "      -p 8888:8888 -p 9999:9999 \\"
        echo "      -e HINDSIGHT_API_LLM_PROVIDER=anthropic \\"
        echo "      -e HINDSIGHT_API_LLM_API_KEY=\$ANTHROPIC_API_KEY \\"
        echo "      -v hindsight-data:/home/hindsight/.pg0 \\"
        echo "      ghcr.io/vectorize-io/hindsight:latest"
      else
        echo "[*] Starting Hindsight (provider: $LLM_PROVIDER)..."
        docker run -d \
          --name hindsight \
          --restart unless-stopped \
          -p 8888:8888 \
          -p 9999:9999 \
          -e "HINDSIGHT_API_LLM_PROVIDER=$LLM_PROVIDER" \
          -e "HINDSIGHT_API_LLM_API_KEY=$LLM_KEY" \
          -v hindsight-data:/home/hindsight/.pg0 \
          ghcr.io/vectorize-io/hindsight:latest

        # Wait for startup
        echo -n "    Waiting for Hindsight..."
        for i in $(seq 1 30); do
          if curl -sf http://localhost:8888/health > /dev/null 2>&1; then
            echo " ready"
            break
          fi
          sleep 2
          echo -n "."
        done

        # Create memory bank for Claude sessions
        curl -sf -X PUT http://localhost:8888/v1/default/banks/claude-sessions \
          -H 'Content-Type: application/json' \
          -d '{"name": "claude-sessions"}' > /dev/null 2>&1

        echo "[+] Layer 4: Hindsight running (API: :8888, UI: :9999, MCP: via npx)"
        echo "    Claude Code tools: retain, recall, reflect"
      fi
    else
      # Container exists — check if running
      if docker ps --format '{{.Names}}' | grep -q '^hindsight$'; then
        echo "[=] Layer 4: Hindsight container running"
      else
        docker start hindsight > /dev/null 2>&1
        echo "[+] Layer 4: Hindsight container restarted"
      fi
    fi
  else
    echo "[!] Layer 4: Docker installed but not running. Start Docker first."
    echo "    Hooks will work without it (graceful fallback)."
  fi
else
  echo "[!] Layer 4: Docker not found. Install Docker for Hindsight."
  echo "    Hooks and MCP will fall back gracefully without it."
  echo "    Layers 1-3 and 5 work independently."
fi

# --- Layer 5: Obsidian ---
echo ""
if [ -n "$OBSIDIAN_VAULT" ]; then
  SHELL_RC="$HOME/.bashrc"
  [ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"

  if grep -q 'alias claude=' "$SHELL_RC" 2>/dev/null; then
    echo "[=] Layer 5: Claude alias already exists in $SHELL_RC"
  else
    echo "" >> "$SHELL_RC"
    echo "# Claude Code with Obsidian vault (Layer 5 - recall-stack)" >> "$SHELL_RC"
    echo "alias claude='claude --add-dir \"$OBSIDIAN_VAULT\"'" >> "$SHELL_RC"
    echo "[+] Layer 5: Obsidian alias added to $SHELL_RC"
    echo "    Your vault at $OBSIDIAN_VAULT will be available in every Claude session"
  fi
else
  echo "[=] Layer 5: No Obsidian vault specified (use --obsidian /path/to/vault)"
fi

# --- Optional: post-commit hook ---
echo ""
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  REPO_ROOT=$(git rev-parse --show-toplevel)
  if [ -f "$REPO_ROOT/.git/hooks/post-commit" ]; then
    echo "[=] post-commit hook already exists in this repo"
  else
    cp "$SCRIPT_DIR/hooks/post-commit" "$REPO_ROOT/.git/hooks/post-commit"
    chmod +x "$REPO_ROOT/.git/hooks/post-commit"
    echo "[+] post-commit hook installed (logs commits to .claude-memory.md)"
  fi
fi

echo ""
echo "============================================"
echo "  5-Layer Memory Architecture Ready"
echo "============================================"
echo "  Layer 1: CLAUDE.md      (permanent rules)"
echo "  Layer 2: primer.md      (auto-rewriting state)"
echo "  Layer 3: Git Context    (SessionStart hook)"
echo "  Layer 4: Hindsight      (behavioral learning)"
echo "  Layer 5: Obsidian Vault (knowledge base)"
echo ""
echo "Open a new terminal and run 'claude' to verify."
