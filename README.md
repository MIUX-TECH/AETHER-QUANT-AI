# ◈ AETHER QUANT AI

**Terminal Trading Kuantitatif Otonom Generasi Baru untuk Binance.**  
Analisis Multi-Timeframe · Deteksi Market Regime Cerdas · Skoring AI Transparan · Manajemen Risiko Institusional · Memori Pembelajaran Adaptif · Dashboard Web Modern.

---

## Architecture Overview

```
BINANCE-AI-TRADER/
│
├── engine/                     # Python AI + trading engine
│   ├── analysis/
│   │   ├── market_data.py      # Binance API data fetcher + caching
│   │   ├── indicators.py       # Pure-Python TA: EMA, RSI, MACD, ATR, ADX, BB
│   │   ├── regime.py           # Market regime classifier (trending/ranging/panic/euphoria)
│   │   ├── scoring.py          # AI decision engine with transparent component scores
│   │   └── scanner.py          # Multi-symbol scanner orchestrator
│   ├── execution/
│   │   └── binance_executor.py # Order execution: paper + live, with retry logic
│   ├── portfolio/
│   │   └── portfolio_manager.py # Allocation, rebalancing, position tracking, PnL
│   ├── risk/
│   │   └── risk_manager.py     # Position sizing, drawdown guard, cooldown, kill switch
│   ├── sentiment/
│   │   └── news_service.py     # CryptoPanic + NewsAPI sentiment scoring
│   ├── learning/
│   │   └── memory_service.py   # Adaptive memory: weight adjustment, coin profiles, lessons
│   ├── reporting/
│   │   └── report_service.py   # Daily/weekly/monthly reports, performance analytics
│   ├── scheduler/
│   │   └── scheduler.py        # Background job runner (scan, rebalance, report, learn)
│   ├── storage.py              # Atomic file I/O, backup, recovery, rotation
│   ├── logger.py               # Structured logging with rotation
│   └── trader.py               # Main orchestrator connecting all modules
│
├── api/
│   └── main.py                 # FastAPI backend (boots all services, exposes REST API)
│
├── ui/                         # React + Vite + TypeScript frontend
│   └── src/
│       ├── App.tsx             # Shell + routing
│       ├── store/useStore.ts   # Zustand global state
│       ├── utils/api.ts        # API client
│       ├── styles/globals.css  # Premium dark trading terminal theme
│       └── components/
│           ├── shared/         # Reusable UI primitives
│           ├── dashboard/      # Overview dashboard
│           ├── scanner/        # Market scanner with signals
│           ├── portfolio/      # Portfolio allocation view
│           ├── positions/      # Active positions monitor
│           ├── history/        # Trade journal
│           ├── reports/        # Performance analytics + charts
│           ├── ai/             # AI decision log + news/sentiment
│           ├── memory/         # Learning summary + adaptive weights
│           └── settings/       # System config + controls
│
├── config/
│   ├── app.json                # App & scheduler config
│   └── trading.json            # Portfolio, risk, strategy, indicator params
│
├── state/
│   └── runtime_state.json      # Live system state (positions, risk, portfolio)
│
├── memory/
│   ├── portfolio_memory.json   # Learned allocations, strategy performance, weights
│   └── strategy_memory.json    # Coin profiles, pattern library, lessons
│
├── history/                    # Monthly trade + decision logs
├── reports/                    # Daily/weekly/monthly reports
├── logs/                       # App, error, trade, decision logs
├── cache/                      # Indicator and data cache
├── backup/                     # Automatic file backups
│
├── requirements.txt
├── .env.example
├── start_backend.sh
├── start_ui.sh
└── build.sh
```

---

## Stack

| Layer | Technology | Reason |
|---|---|---|
| AI Engine | Python 3.9+ | Best for numerical/analytical work, no TA-lib dependency |
| Backend API | FastAPI + Uvicorn | Fast async Python REST, auto-docs |
| Frontend | React 18 + Vite + TypeScript | Modern, fast, type-safe |
| State | Zustand | Lightweight global state |
| Charts | Recharts | Composable React charting |
| Storage | JSON files (atomic write + backup) | No database, restart-resilient |

---

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- (Optional) Binance API keys — paper mode works without them

### 1. Clone & Configure

```bash
git clone https://github.com/you/BINANCE-AI-TRADER.git
cd BINANCE-AI-TRADER

cp .env.example .env
# Edit .env and add your Binance API keys (optional for paper mode)
```

### 2. Start Backend

```bash
./start_backend.sh
# Or manually:
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --port 8000 --reload
```

### 3. Start UI (development)

```bash
./start_ui.sh
# Opens http://localhost:5173
# Proxies /api/* to http://localhost:8000
```

### 4. Or build for single-port serving

```bash
./build.sh
./start_backend.sh
# Opens http://localhost:8000 (UI + API on same port)
```

---

## Configuration

All config is in `config/` and editable from the UI Settings page.

### `config/trading.json` (key params)

```json
{
  "portfolio": {
    "total_capital_usdt": 1000,
    "spot_allocation_pct": 0.90,
    "futures_allocation_pct": 0.10,
    "spot_btc_pct": 0.70
  },
  "risk": {
    "max_risk_per_trade_pct": 0.02,
    "max_daily_loss_pct": 0.05,
    "max_drawdown_pct": 0.15,
    "min_confidence_to_trade": 0.60,
    "min_confidence_futures": 0.75,
    "cooldown_after_loss_streak": 3
  },
  "futures": {
    "max_leverage": 10,
    "default_leverage": 3,
    "margin_mode": "isolated",
    "max_concurrent_positions": 2
  }
}
```

---

## Trading Modes

| Mode | Behavior |
|---|---|
| `paper` | Full simulation. No real orders. Uses live prices. |
| `live` | Real Binance execution. Requires API key. |
| `safe` | Monitors and exits only. No new entries. |
| `analysis` | Scan and score only. No execution. |

Switch mode from the UI Settings page or in `.env` (`TRADING_MODE=paper`).

---

## AI Decision Flow & Two-Layer Gatekeeping Architecture

```
Every 60s (Autonomous Scheduler Cycle):

 LAYER 1: DETERMINISTIC QUANTITATIVE SCORING ENGINE
 ─────────────────────────────────────────────────────────────
 1. MARKET DATA INGESTION
    Multi-tier K-Line Cache (1d: 4h, 4h: 2h, 1h: 30m, 15m: 5m, 5m: 1m)
    Weight-aware throttle (X-MBX-USED-WEIGHT-1M) + Binance Cluster Failover

 2. TECHNICAL INDICATOR SUITE
    EMA(9,21,50,200) · RSI(14) · MACD · ATR(14) · ADX(14) · Bollinger Bands

 3. MARKET REGIME CLASSIFIER
    Multi-TF ADX + BB width + RSI extremes + Price Velocity
    → trending_up / trending_down / ranging / panic / euphoria

 4. QUANTITATIVE COMPONENT SCORING (per symbol)
    Weighted component scores (adaptive weights calibrated by historical memory):
    - Trend (20%): EMA alignment, structure HH/HL
    - Momentum (18%): RSI dynamic zones, MACD histogram
    - Structure (15%): Price action, candle patterns, Key S/R
    - Volume (12%): Volume spike, taker buy/sell pressure
    - HTF Alignment (15%): 1D/4H macro bias, EMA200
    - Volatility (8%): ATR range & expansion checks
    - Sentiment (7%): Deep news sentiment (CryptoPanic/NewsAPI/Groq)
    - Risk Guard (5%): Inverted regime risk penalty

 5. QUANTITATIVE SIGNAL GENERATION
    Score ≥ 0.82 → STRONG_BUY | Score ≥ 0.68 → BUY | Score ≥ 0.52 → HOLD
    Score ≤ 0.22 → SHORT      | Score ≤ 0.32 → SELL | else → WAIT/AVOID

 6. RISK FILTER & CAPITAL SIZING (RiskManager)
    - Kill switch / Safe mode / Cooldown checks
    - Drawdown Guard: Risk-off at 10% DD, Capital preservation at 15% DD
    - Auto-Recovery: Hysteresis reset to normal mode when DD < 8%
    - ATR-based Position Sizing: Risk amount / (2 * ATR / Entry Price)

 LAYER 2: LLM REASONING & VALIDATION GATEKEEPER (Groq Qwen 2.5)
 ─────────────────────────────────────────────────────────────
 7. AI TRADE VALIDATION (GroqAIClient)
    - Triggered ONLY on high-conviction signals (Quant Score ≥ 0.68)
    - Prompts Qwen with: Quant score, Regime, Bullish/Bearish factors, Indicators,
      Historical win rate & loss patterns
    - Validates setup quality vs fakeout risk
    - Fail-Closed Invariant: Defaults to SKIP/WAIT if AI API unavailable

 8. IDEMPOTENT ORDER EXECUTION (BinanceExecutor)
    - Unified `newClientOrderId` per trade intent
    - Precise Decimal quantization using Binance `exchangeInfo` stepSize filters
    - Spot & USD-M Futures with isolated leverage and circuit-breaker backoff

 9. CONTINUOUS POSITION MONITORING
    - Reconstructed from holdings & `myTrades` on reboot
    - 40% Partial Take-Profit (TP1 at +3.5%) with auto-move SL to BEP (Breakeven)
    - 60% Runner Adaptive Trailing Stop (2.5%)

 10. ADAPTIVE MEMORY & EXTERNAL PERSISTENCE
     - Synced to Upstash Redis REST API / local atomic files
     - Adaptive weights updated every 30m based on closed trade performance
     - Automated daily reporting (00:00 UTC)
```

---

## File Storage

All state is file-based — no database required. The system survives restarts.

| Path | Contents |
|---|---|
| `config/app.json` | App settings, scheduler intervals |
| `config/trading.json` | Portfolio, risk, strategy, indicator params |
| `state/runtime_state.json` | Live positions, portfolio, risk state |
| `memory/portfolio_memory.json` | Adaptive weights, strategy performance |
| `memory/strategy_memory.json` | Coin profiles, lessons, pattern library |
| `history/trades_YYYY_MM.json` | Monthly trade journal |
| `history/decision_log_YYYY_MM.json` | AI decision log |
| `reports/daily_report_YYYY_MM_DD.json` | Daily performance reports |
| `logs/app.log` | Application log (rotated daily) |
| `logs/trades.log` | Trade execution log |
| `logs/decisions.log` | Decision audit log |
| `backup/` | Auto-backups of state and memory |

---

## Risk Management

The system is designed around **capital preservation first**:

- **Per-trade risk**: 2% of equity (ATR-based SL)
- **Per-coin max**: 25% of portfolio
- **Daily loss limit**: 5% → trading halted for the day
- **Drawdown guard**: 10% → risk-off mode, 15% → capital preservation mode
- **Loss streak cooldown**: 3 consecutive losses → 60-minute cooldown
- **Futures**: Isolated margin, dynamic leverage (2–10x based on volatility + confidence), max 2 concurrent positions
- **Kill switch**: Immediately halts all trading from the UI

---

## News / Sentiment

Sentiment is a **7% weight auxiliary signal** — never the sole entry trigger.

- Source 1: **CryptoPanic** (free API key at cryptopanic.com)
- Source 2: **NewsAPI** (free tier at newsapi.org)
- Fallback: Neutral score (0.5) used if all sources fail
- System operates fully without news data

---

## Learning System

The AI adapts over time using **rule refinement and historical context** (not ML training):

1. After every trade closes, outcomes are stored in `history/trades_YYYY_MM.json`
2. Every 30 minutes, `MemoryService.update_learning()` analyzes recent trades
3. Adaptive weights are adjusted based on which factors predicted wins vs losses
4. Coin profiles store: best strategy, win rate, last 10 trades per symbol
5. Regime performance tracks win rates per market condition
6. "Lessons" are extracted from losing trades to avoid similar patterns
7. Memory is loaded on startup — system recovers learned context after restart

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/status` | Full system status |
| GET | `/api/health` | Health + scheduler status |
| GET | `/api/scan` | Latest scan results |
| POST | `/api/scan/trigger` | Trigger manual scan |
| GET | `/api/portfolio` | Portfolio + positions + allocations |
| GET | `/api/positions` | Active positions |
| GET | `/api/history` | Trade journal (filterable) |
| GET | `/api/reports/performance` | Aggregated performance |
| GET | `/api/decisions` | AI decision log |
| GET | `/api/news` | Market sentiment summary |
| GET | `/api/memory` | Learning summary |
| GET/POST | `/api/config` | Read/write configuration |
| POST | `/api/control` | Kill switch, mode, symbols, triggers |
| GET | `/api/candles/{symbol}` | OHLCV candle data |
| GET | `/docs` | Auto-generated FastAPI docs |

---

## UI Pages

| Page | Features |
|---|---|
| **Dashboard** | Equity, PnL, regime, signals, risk monitor, today's trades |
| **Market Scanner** | All symbols with signal, confidence bar, regime, indicator breakdown, bullish/bearish factors |
| **Portfolio** | Equity breakdown, pie chart, target allocations, position exposure |
| **Active Positions** | Real-time PnL, SL/TP levels, trailing stop, partial TP status |
| **Trade Journal** | Filterable history, win/loss stats, full trade detail with AI reasoning |
| **Reports** | Equity curve, daily PnL bar chart, by-symbol / by-strategy performance |
| **AI Decisions** | Full decision log with action type, reasoning, confidence, regime |
| **News & Sentiment** | Market sentiment gauge, per-symbol news feed |
| **Memory & Learning** | Adaptive weights, strategy performance, coin profiles, lessons |
| **Settings** | Kill switch, safe mode, trading mode, symbols, risk params, scheduler status |

---

## Extending

### Add a new symbol
1. Go to **Settings → Symbols** in the UI
2. Type `BNBUSDT` and click Add → Save

### Add a new strategy
1. Add logic to `engine/analysis/scoring.py` in the structure score section
2. Register the strategy name in `engine/trader.py` `_determine_strategy()`
3. Memory will automatically track its performance

### Change scan interval
Edit `config/app.json`:
```json
"scheduler": {
  "scan_interval": 30
}
```
Or change from **Settings → Scheduler** in the UI.

### Add a new news source
Implement a new fetch method in `engine/sentiment/news_service.py` and call it from `_fetch_all_news()`.

---

## Disclaimer

**This software is for educational and research purposes only.**  
Cryptocurrency trading involves significant financial risk.  
Paper mode is strongly recommended for testing.  
Never trade with money you cannot afford to lose.  
Past performance of any algorithm does not guarantee future results.

---

*Built with Python · FastAPI · React · Vite · Recharts · Zustand*
