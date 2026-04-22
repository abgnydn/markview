#!/bin/bash
# Install MarkView Brain as a global Claude Code plugin

GREEN='\033[0;32m'
PURPLE='\033[0;35m'
DIM='\033[2m'
NC='\033[0m'

echo -e "${PURPLE}🧠 Installing MarkView Brain to Claude Code${NC}"
echo ""

if ! command -v claude &> /dev/null; then
  echo "❌ Claude Code CLI not found. Install it first: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_SCRIPT="$SCRIPT_DIR/apps/mcp/src/index.ts"
VAULT_DIR="$HOME/Documents/research-vault"

# Add it globally to Claude Code
echo -e "${DIM}Running: claude mcp add markview-brain...${NC}"
claude mcp add markview-brain --scope user -- npx tsx "$MCP_SCRIPT" "$VAULT_DIR"

echo ""
echo -e "${GREEN}✓${NC} MarkView Brain installed globally in Claude Code!"
echo -e "${DIM}Next time you run 'claude' anywhere in your terminal, it will have access to all 24 MarkView tools, including your research vault.${NC}"
