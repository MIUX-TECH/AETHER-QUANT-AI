#!/usr/bin/env bash
# start_backend.sh — Start the BINANCE-AI-TRADER backend

set -e
cd "$(dirname "$0")"

echo "════════════════════════════════════════"
echo "  BINANCE-AI-TRADER — Backend Startup"
echo "════════════════════════════════════════"

# Check .env
if [ ! -f ".env" ]; then
  echo "⚠  .env not found. Copying from .env.example..."
  cp .env.example .env
  echo "✓  .env created. Edit it with your API keys."
fi

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "✗  Python3 not found. Please install Python 3.9+"
  exit 1
fi

# Check/create virtualenv
#if [ ! -d "venv" ]; then
#  echo "→  Creating virtual environment..."
#  python3 -m venv venv
#fi

# Activate venv (sesuai setup user: ~/venvs/ai)
if [ -f ~/venvs/ai/bin/activate ]; then
  source ~/venvs/ai/bin/activate
else
  echo "⚠ Venv tidak ditemukan di ~/venvs/ai, membuat venv baru..."
  python3 -m venv ~/venvs/ai
  source ~/venvs/ai/bin/activate
fi

# Install dependencies
echo "→  Installing Python dependencies..."
pip install -q -r requirements.txt

# Create required directories
mkdir -p config state memory history reports logs cache backup

# Copy default configs if missing
if [ ! -f "config/app.json" ]; then
  echo "→  Default configs already present"
fi

echo ""
echo "✓  All dependencies installed"
echo "→  Starting backend on http://localhost:8000"
echo "→  API docs: http://localhost:8000/docs"
echo ""

# Start FastAPI
python3 -m uvicorn api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --log-level info
