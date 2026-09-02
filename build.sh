#!/usr/bin/env bash
# build.sh — Build UI and embed into backend for single-port serving

set -e
cd "$(dirname "$0")"

echo "════════════════════════════════════════"
echo "  BINANCE-AI-TRADER — Production Build"
echo "════════════════════════════════════════"

# Build UI
echo "→  Building React UI..."
./start_ui.sh && ./start_backend.sh

echo "→  Open: http://localhost:8000"
echo ""

