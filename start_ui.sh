#!/usr/bin/env bash
# start_ui.sh — Start the BINANCE-AI-TRADER web UI

set -e
cd "$(dirname "$0")/ui"

echo "════════════════════════════════════════"
echo "  BINANCE-AI-TRADER — UI Startup"
echo "════════════════════════════════════════"

# Setup Node (support nvm if used)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

# Check Node
if ! command -v node &>/dev/null; then
  echo "✗  Node.js not found. Please install Node 18+ (via nvm or system)"
  exit 1
fi

echo "Node: $(node -v) | npm: $(npm -v)"

# Install deps
if [ ! -d "node_modules" ]; then
  echo "→  Installing Node dependencies..."
  npm install
fi

echo ""
echo "✓  Dependencies ready"
echo "→  Starting UI dev server on http://localhost:5173"
echo "→  API proxy: http://localhost:8000"
echo ""

npm run dev
