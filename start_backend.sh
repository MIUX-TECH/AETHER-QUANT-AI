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

# Activate venv (check project-local first, then user-global fallback)
VENV_PATH="${VENV_DIR:-}"
if [ -z "$VENV_PATH" ]; then
  if [ -f "venv/bin/activate" ]; then
    VENV_PATH="venv"
  elif [ -f "$HOME/venvs/ai/bin/activate" ]; then
    VENV_PATH="$HOME/venvs/ai"
  fi
fi

if [ -n "$VENV_PATH" ] && [ -f "$VENV_PATH/bin/activate" ]; then
  source "$VENV_PATH/bin/activate"
  echo "✓  Using venv: $VENV_PATH"
else
  echo "⚠  No venv found, using system Python"
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

# Port: use $PORT env var (Render sets this), fallback to 8000
API_PORT="${PORT:-${API_PORT:-8000}}"

echo ""
echo "✓  All dependencies installed"
echo "→  Starting backend on http://localhost:${API_PORT}"
echo "→  API docs: http://localhost:${API_PORT}/docs"
echo ""

# Start FastAPI
python3 -m uvicorn api.main:app \
  --host 0.0.0.0 \
  --port "$API_PORT" \
  --reload \
  --log-level info
