#!/bin/bash
# MarkView Brain — One-command startup
# Usage: ./start-brain.sh

set -e

GREEN='\033[0;32m'
PURPLE='\033[0;35m'
DIM='\033[2m'
NC='\033[0m'

echo -e "${PURPLE}🧠 MarkView Brain — Starting local AI loop${NC}"
echo ""

# Check Ollama
if ! command -v ollama &> /dev/null; then
  echo "❌ Ollama not found. Install from https://ollama.com"
  exit 1
fi

# Check if model is available
if ! ollama list 2>/dev/null | grep -q "qwen3:0.6b"; then
  echo "📥 Pulling qwen3:0.6b model..."
  ollama pull qwen3:0.6b
fi

# Ensure Ollama is running
if ! curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
  echo -e "${DIM}Starting Ollama...${NC}"
  ollama serve &
  sleep 2
fi

echo -e "${GREEN}✓${NC} Ollama ready (qwen3:0.6b)"

# Start signaling server in background
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$SCRIPT_DIR/apps/mcp"

echo -e "${DIM}Starting signaling server...${NC}"
cd "$MCP_DIR" && npx tsx scripts/signaling-server.ts &
SIGNALING_PID=$!
sleep 2
echo -e "${GREEN}✓${NC} Signaling server (ws://localhost:4445)"

# Start MCP server
echo -e "${DIM}Starting MCP server...${NC}"
cd "$MCP_DIR" && npx tsx src/index.ts --webrtc --room local-vault &
MCP_PID=$!
sleep 3
echo -e "${GREEN}✓${NC} MCP server (WebRTC, room: local-vault)"

echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🧠 Brain is LIVE!${NC}"
echo -e "${DIM}  • Open any GitHub page or AI chat${NC}"
echo -e "${DIM}  • Brain auto-connects & auto-analyzes${NC}"
echo -e "${DIM}  • Press ⌘⇧B to toggle the panel${NC}"
echo -e "${DIM}  • Select text + ⌘⇧B to ask about it${NC}"
echo -e "${DIM}  • Right-click → 'Ask Brain about this'${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${DIM}Press Ctrl+C to stop all services${NC}"

# Trap exit to kill background processes
trap "kill $SIGNALING_PID $MCP_PID 2>/dev/null; echo ''; echo '🧠 Brain stopped.'; exit 0" SIGINT SIGTERM

# Wait
wait
