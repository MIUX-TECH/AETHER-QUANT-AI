"""
api/main.py — FastAPI backend for BINANCE-AI-TRADER.
Boots all services, starts scheduler, exposes REST API for the UI.
"""

import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

# Ensure project root in path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from engine.logger import setup_logging
from engine.storage import load_config, load_state, save_state, load_memory, ensure_dirs
from engine.analysis.market_data import MarketDataService
from engine.analysis.scanner import MarketScanner
from engine.analysis.scoring import ScoringEngine
from engine.risk.risk_manager import RiskManager
from engine.portfolio.portfolio_manager import PortfolioManager
from engine.execution.binance_executor import BinanceExecutor
from engine.sentiment.news_service import NewsService
from engine.learning.memory_service import MemoryService
from engine.reporting.report_service import ReportService
from engine.trader import TradingOrchestrator
from engine.scheduler.scheduler import Scheduler

# ============================================================
# GLOBALS
# ============================================================
logger = logging.getLogger(__name__)
orchestrator: Optional[TradingOrchestrator] = None
scheduler: Optional[Scheduler] = None
state: dict = {}
app_config: dict = {}


def boot_system():
    """Initialize all services and wire them together."""
    global orchestrator, scheduler, state, app_config

    ensure_dirs()

    app_cfg = load_config("app")
    trading_cfg = load_config("trading")
    app_config = {**app_cfg, **trading_cfg}

    mode = os.getenv("TRADING_MODE", app_cfg.get("app", {}).get("mode", "paper"))
    log_level = app_cfg.get("app", {}).get("log_level", "INFO")
    setup_logging(log_level)

    state = load_state()
    state.setdefault("system", {})["mode"] = mode
    state.setdefault("system", {})["status"] = "starting"
    state.setdefault("system", {})["auto_enabled"] = True
    state.setdefault("health", {
        "api_connected": False,
        "data_feed_ok": False,
        "execution_ok": True,
        "memory_ok": True,
        "last_heartbeat": None,
        "last_error": None,
        "last_error_at": None,
    })
    
    # Complete default portfolio state
    default_portfolio = {
        "total_equity": 1000.0,
        "spot_equity": 900.0,
        "futures_equity": 100.0,
        "cash_reserve": 50.0,
        "unrealized_pnl": 0.0,
        "realized_pnl_today": 0.0,
        "daily_starting_equity": 1000.0,
        "drawdown_from_peak_pct": 0.0,
        "peak_equity": 1000.0,
        "mode": "normal",
        "last_rebalance": None,
        "last_drift_check": None,
    }
    for k, v in default_portfolio.items():
        state.setdefault("portfolio", {}).setdefault(k, v)

    state.setdefault("positions", {"spot": {}, "futures": {}})
    state.setdefault("risk", {
        "max_risk_per_trade_pct": 0.02,
        "max_portfolio_heat_pct": 0.06,
        "max_drawdown_limit_pct": 0.15,
        "daily_loss_limit_pct": 0.05,
        "kill_switch": False,
        "safe_mode": False,
        "total_exposure_pct": 0.0,
    })
    state.setdefault("scanner", {
        "dominant_regime": "ranging",
        "last_scan": None,
        "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "PEPEUSDT", "SHIBUSDT", "DOGEUSDT", "TRXUSDT", "BONKUSDT", "FLOKIUSDT"],
        "results": {}
    })
    save_state(state)

    # API credentials
    testnet = app_cfg.get("binance", {}).get("testnet", True)
    api_key = os.getenv("BINANCE_TESTNET_API_KEY") or os.getenv("BINANCE_API_KEY") or ""
    secret_key = os.getenv("BINANCE_TESTNET_SECRET_KEY") or os.getenv("BINANCE_SECRET_KEY") or ""

    # Initialize services
    market_data = MarketDataService(api_key, secret_key, testnet, mode)
    memory_svc = MemoryService(app_config)
    portfolio_memory = load_memory("portfolio_memory")
    scanner = MarketScanner(market_data, app_config, {"portfolio_memory": portfolio_memory})
    risk_mgr = RiskManager(app_config)
    portfolio_mgr = PortfolioManager(app_config, state, portfolio_memory)
    executor = BinanceExecutor(api_key, secret_key, testnet, mode)
    news_svc = NewsService(
        os.getenv("CRYPTOPANIC_API_KEY", ""),
        os.getenv("NEWSAPI_KEY", "")
    )
    report_svc = ReportService(app_config)

    orchestrator = TradingOrchestrator(
        market_data, scanner, risk_mgr, portfolio_mgr,
        executor, news_svc, memory_svc, report_svc,
        app_config, state
    )

    # Setup scheduler
    scheduler = Scheduler(app_config)
    sched_cfg = app_cfg.get("scheduler", {})

    scheduler.register("scan", orchestrator.run_scan_cycle, sched_cfg.get("scan_interval", 60))
    scheduler.register("execute", orchestrator.run_execution_cycle, sched_cfg.get("scan_interval", 60))
    scheduler.register("rebalance", orchestrator.run_rebalance, sched_cfg.get("rebalance_interval", 3600))
    scheduler.register("learning", orchestrator.run_learning_update, sched_cfg.get("learning_update_interval", 1800))
    scheduler.register("report", orchestrator.run_daily_report, sched_cfg.get("report_interval", 86400))
    scheduler.register("news", lambda: None, sched_cfg.get("news_refresh_interval", 300))  # news refreshed on-demand

    # Health check — test connectivity
    if market_data.ping():
        state["health"]["api_connected"] = True
        state["health"]["data_feed_ok"] = True
        logger.info("Binance API connected")
    else:
        logger.warning("Binance API unreachable — running in offline/paper mode")
        state["health"]["api_connected"] = False

    state["health"]["last_heartbeat"] = __import__("datetime").datetime.utcnow().isoformat()
    state["system"]["status"] = "running"
    state["system"]["auto_enabled"] = True  # Ensure auto/scheduler mode active in paper
    save_state(state)

    scheduler.start()

    # Do an initial scan
    try:
        orchestrator.run_scan_cycle()
    except Exception as e:
        logger.warning(f"Initial scan failed: {e}")

    logger.info(f"BINANCE-AI-TRADER booted. Mode: {mode}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    boot_system()
    yield
    if scheduler:
        scheduler.stop()
    save_state(state)
    logger.info("System shutdown cleanly")


app = FastAPI(
    title="BINANCE-AI-TRADER API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# ROUTES
# ============================================================

@app.get("/api/status")
def get_status():
    if not orchestrator:
        raise HTTPException(503, "System not initialized")
    return orchestrator.get_full_status()

@app.get("/api/health")
def get_health():
    h = state.get("health", {})
    return {
        "status": state.get("system", {}).get("status", "unknown"),
        "mode": state.get("system", {}).get("mode", "paper"),
        "auto_enabled": state.get("system", {}).get("auto_enabled", False),
        "scheduler": scheduler.get_status() if scheduler else {"running": False},
        "last_error": h.get("last_error"),
        "last_error_at": h.get("last_error_at"),
        "health": h,
        "uptime_ok": True
    }

@app.get("/api/scan")
def get_scan_results():
    return orchestrator._scan_results if orchestrator else {}

@app.post("/api/scan/trigger")
def trigger_scan():
    if not orchestrator:
        raise HTTPException(503)
    result = orchestrator.run_scan_cycle()
    return result

@app.get("/api/portfolio")
def get_portfolio():
    if not orchestrator:
        raise HTTPException(503)
    status = orchestrator.get_full_status()
    return {
        "portfolio": status["portfolio"],
        "positions": status["positions"],
        "risk": status["risk"],
        "allocations": orchestrator.portfolio_manager.get_allocations()
    }

@app.get("/api/positions")
def get_positions():
    if not orchestrator:
        raise HTTPException(503)
    return orchestrator.get_full_status()["positions"]

@app.get("/api/wallet")
def get_wallet():
    if not orchestrator:
        raise HTTPException(503)
    balances = {}
    try:
        if hasattr(orchestrator.executor, "get_account_balances"):
            balances = orchestrator.executor.get_account_balances()
    except Exception:
        pass
    
    scan_res = getattr(orchestrator, "_scan_results", {}) or {}
    items = []
    total_usd = 0.0
    
    PRIMARY_ASSETS = ["USDT", "USD", "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "PEPE", "SHIB", "NEAR", "AVAX", "TRX", "BONK", "FLOKI"]

    for asset, b in balances.items():
        free = float(b.get("free", 0))
        locked = float(b.get("locked", 0))
        total = float(b.get("total", free + locked))
        if total <= 0.00001:
            continue

        # Skip obscure non-crypto testnet tokens unless they are primary
        if asset not in PRIMARY_ASSETS and total > 1000 and not asset.endswith("USDT"):
            if not any(asset.startswith(p) for p in ["USDT", "USD", "BTC", "ETH", "SOL", "BNB"]):
                continue

        price = 1.0
        if asset in ["USDT", "USD", "USDC", "FDUSD", "BUSD"]:
            price = 1.0
        else:
            sym = f"{asset}USDT"
            if sym in scan_res and scan_res[sym].get("price", 0) > 0:
                price = float(scan_res[sym]["price"])
            else:
                try:
                    r = requests.get(f"https://data-api.binance.vision/api/v3/ticker/price?symbol={sym}", timeout=2)
                    if r.status_code == 200:
                        price = float(r.json().get("price", 0))
                except Exception:
                    price = 0.0

        usd_val = total * price if price > 0 else 0
        total_usd += usd_val
        items.append({
            "asset": asset,
            "free": round(free, 6) if free < 1 else round(free, 4),
            "locked": round(locked, 4),
            "total": round(total, 6) if total < 1 else round(total, 4),
            "price": price,
            "usd_value": round(usd_val, 2)
        })

    # Sort primary assets first, then by USD value
    items.sort(key=lambda x: (x["asset"] not in PRIMARY_ASSETS, -x["usd_value"]))
    return {
        "mode": state.get("system", {}).get("mode", "paper"),
        "total_equity_usd": round(total_usd, 2) if total_usd > 0 else 1000.0,
        "assets": items
    }

class ModeSwitchPayload(BaseModel):
    mode: str
    api_key: Optional[str] = None
    secret_key: Optional[str] = None

@app.post("/api/mode/switch")
def switch_mode(payload: ModeSwitchPayload):
    if not orchestrator:
        raise HTTPException(503)
    mode = payload.mode.lower()
    if mode not in ["paper", "testnet", "live"]:
        raise HTTPException(400, "Invalid mode")
    
    testnet = (mode == "testnet")
    api_key = payload.api_key or os.getenv("BINANCE_API_KEY", "")
    secret_key = payload.secret_key or os.getenv("BINANCE_SECRET_KEY", "")
    
    orchestrator.set_mode(mode)
    if hasattr(orchestrator, "executor"):
        orchestrator.executor.mode = mode
        orchestrator.executor.testnet = testnet
        orchestrator.executor.base_url = "https://testnet.binance.vision" if testnet else "https://api.binance.com"
        orchestrator.executor.futures_url = "https://testnet.binancefuture.com" if testnet else "https://fapi.binance.com"
        if payload.api_key and payload.secret_key:
            orchestrator.executor.api_key = payload.api_key
            orchestrator.executor.secret_key = payload.secret_key
            orchestrator.executor.session.headers.update({"X-MBX-APIKEY": payload.api_key})
    
    state["system"]["mode"] = mode
    save_state(state)
    return {"status": "ok", "mode": mode, "testnet": testnet}

@app.get("/api/orders/open")
def get_open_orders():
    if not orchestrator:
        raise HTTPException(503)
    try:
        if hasattr(orchestrator.executor, "get_open_orders"):
            return orchestrator.executor.get_open_orders()
    except Exception:
        pass
    return []


@app.get("/api/history")
def get_history(limit: int = 50, months: int = 1, symbol: str = None, strategy: str = None):
    if not orchestrator:
        raise HTTPException(503)
    return orchestrator.report_service.get_trade_journal(symbol, strategy, limit, months)

@app.get("/api/reports/performance")
def get_performance(months: int = 1):
    if not orchestrator:
        raise HTTPException(503)
    return orchestrator.report_service.generate_performance_summary(months)

@app.get("/api/reports/daily")
def get_daily_report():
    if not orchestrator:
        raise HTTPException(503)
    return orchestrator.run_daily_report()

@app.get("/api/decisions")
def get_decisions(limit: int = 50):
    from engine.storage import get_history_path, read_json
    path = get_history_path("decision_log")
    data = read_json(path, default=[])
    if isinstance(data, list):
        return data[-limit:]
    return []

@app.get("/api/news")
def get_news(symbol: str = None):
    if not orchestrator:
        raise HTTPException(503)
    if symbol:
        articles = orchestrator.news_service.get_news_for_symbol(symbol)
        return {"symbol": symbol, "articles": articles}
    return orchestrator.news_service.get_market_summary()

@app.get("/api/memory")
def get_memory():
    if not orchestrator:
        raise HTTPException(503)
    return orchestrator.memory_service.get_learning_summary()

@app.get("/api/config")
def get_config():
    return {
        "app": load_config("app"),
        "trading": load_config("trading")
    }

class ConfigUpdate(BaseModel):
    config_name: str
    data: dict

@app.post("/api/config")
def update_config(payload: ConfigUpdate):
    from engine.storage import save_config
    success = save_config(payload.config_name, payload.data)
    if not success:
        raise HTTPException(500, "Failed to save config")
    return {"status": "saved", "config": payload.config_name}

class ControlAction(BaseModel):
    action: str
    value: bool = None
    mode: str = None
    symbols: list = None

@app.post("/api/control")
def control(payload: ControlAction):
    if not orchestrator:
        raise HTTPException(503)
    action = payload.action

    if action == "kill_switch":
        orchestrator.toggle_kill_switch(payload.value)
        return {"kill_switch": payload.value}
    elif action == "safe_mode":
        orchestrator.toggle_safe_mode(payload.value)
        return {"safe_mode": payload.value}
    elif action == "set_mode":
        orchestrator.set_mode(payload.mode)
        return {"mode": payload.mode}
    elif action == "update_symbols":
        state["scanner"]["symbols"] = payload.symbols
        save_state(state)
        return {"symbols": payload.symbols}
    elif action == "trigger_rebalance":
        return orchestrator.run_rebalance()
    elif action == "trigger_learning":
        return orchestrator.run_learning_update()
    elif action == "run_job":
        job_name = payload.mode  # reusing mode field as job name
        if scheduler:
            scheduler.run_now(job_name)
        return {"status": "triggered", "job": job_name}
    else:
        raise HTTPException(400, f"Unknown action: {action}")

@app.get("/api/scheduler")
def get_scheduler():
    return scheduler.get_status() if scheduler else {}

@app.get("/api/candles/{symbol}")
def get_candles(symbol: str, interval: str = "1h", limit: int = 100):
    if not orchestrator:
        raise HTTPException(503)
    candles = orchestrator.market_data.get_klines(symbol, interval, limit)
    return {"symbol": symbol, "interval": interval, "candles": candles or []}

@app.get("/api/debug/account")
def debug_account():
    if not orchestrator:
        raise HTTPException(503)
    ex = orchestrator.executor
    status, data = ex._send_signed("GET", f"{ex.base_url}/api/v3/account")
    return {
        "status_code": status,
        "base_url": ex.base_url,
        "api_key_set": bool(ex.api_key),
        "api_key_prefix": ex.api_key[:6] if ex.api_key else None,
        "secret_key_set": bool(ex.secret_key),
        "secret_key_prefix": ex.secret_key[:6] if ex.secret_key else None,
        "time_offset": getattr(ex, "time_offset", 0),
        "response": data
    }

# Serve static UI files (built Vite app)
ui_dist = ROOT / "ui" / "dist"
if ui_dist.exists():
    app.mount("/", StaticFiles(directory=str(ui_dist), html=True), name="ui")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run("api.main:app", host="0.0.0.0", port=port, reload=False)
