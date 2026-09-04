"""
api/main.py — FastAPI backend for BINANCE-AI-TRADER.
Boots all services, starts scheduler, exposes REST API for the UI.
"""

import os
import sys
import time
import logging
import requests
from datetime import datetime, timedelta
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

import secrets
from fastapi import FastAPI, HTTPException, Header, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

# Ensure project root in path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

# Master Admin Secret Token
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "aether-quant-admin-2026")

security_bearer = HTTPBearer(auto_error=False)

def verify_master_token(
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")
) -> bool:
    """Verifies Master Admin Token via Bearer or X-Admin-Token header."""
    expected = os.getenv("ADMIN_SECRET_KEY", "aether-quant-admin-2026")
    provided = None
    if auth and auth.credentials:
        provided = auth.credentials
    elif x_admin_token:
        provided = x_admin_token

    if not provided or not secrets.compare_digest(provided.strip(), expected.strip()):
        raise HTTPException(
            status_code=401,
            detail="Akses Ditolak: Master Admin Token tidak valid atau belum dimasukkan."
        )
    return True

def mask_key(k: Optional[str]) -> str:
    """Masks secret API keys to prevent exposure in logs or UI."""
    if not k:
        return "—"
    s = str(k).strip()
    if len(s) <= 8:
        return "••••••••"
    return f"{s[:4]}{'•' * (len(s) - 8)}{s[-4:]}"

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
from engine.ai.groq_client import GroqAIClient
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

    # API credentials with persistence
    saved_creds = state.get("credentials", {})
    if mode == "live":
        testnet = False
        api_key = (saved_creds.get("api_key") or os.getenv("BINANCE_API_KEY") or "").strip()
        secret_key = (saved_creds.get("secret_key") or os.getenv("BINANCE_SECRET_KEY") or "").strip()
    elif mode == "testnet":
        testnet = True
        api_key = (saved_creds.get("testnet_api_key") or os.getenv("BINANCE_TESTNET_API_KEY") or "").strip()
        secret_key = (saved_creds.get("testnet_secret_key") or os.getenv("BINANCE_TESTNET_SECRET_KEY") or "").strip()
    else:
        testnet = False
        api_key = ""
        secret_key = ""

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
    ai_client = GroqAIClient(
        api_key=os.getenv("GROQ_API_KEY", ""),
        model=os.getenv("GROQ_MODEL", "qwen/qwen3.6-27b")
    )

    orchestrator = TradingOrchestrator(
        market_data, scanner, risk_mgr, portfolio_mgr,
        executor, news_svc, memory_svc, report_svc,
        app_config, state, ai_client=ai_client
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
    try:
        state["health"]["api_connected"] = market_data.ping() if hasattr(market_data, "ping") else True
        state["health"]["data_feed_ok"] = True
        logger.info("Binance API connectivity verified")
    except Exception:
        state["health"]["api_connected"] = False

    state["health"]["last_heartbeat"] = datetime.utcnow().isoformat()
    state["system"]["status"] = "running"
    state["system"]["auto_enabled"] = True
    save_state(state)

    scheduler.start()
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

# Strict CORS Allowlist
ALLOWED_ORIGINS = [
    "https://aether-quant-api-sg.onrender.com",
    "https://aether-quant-ai.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# ROUTES
# ============================================================

@app.post("/api/auth/verify")
def verify_admin_auth(verified: bool = Depends(verify_master_token)):
    return {"authenticated": True, "message": "Master Admin Token valid."}

_wallet_cache_data = None
_wallet_cache_time = 0.0
_status_cache_data = None
_status_cache_time = 0.0

@app.get("/api/status")
def get_status():
    global _status_cache_data, _status_cache_time
    if not orchestrator:
        raise HTTPException(503, "System not initialized")
    now = time.time()
    if _status_cache_data and (now - _status_cache_time) < 4.0:
        return _status_cache_data
    res = orchestrator.get_full_status()
    try:
        w = get_wallet()
        if w.get("total_equity_usd", 0) > 0:
            res["portfolio"]["total_equity"] = w["total_equity_usd"]
            res["portfolio"]["spot_equity"] = w.get("spot_usd", w["total_equity_usd"])
            res["portfolio"]["futures_equity"] = w.get("futures_usd", 0.0)
    except Exception:
        pass
    _status_cache_data = res
    _status_cache_time = now
    return res

@app.get("/api/health")
def health_check():
    return {
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "scheduler_running": scheduler.is_running if scheduler else False,
    }

@app.post("/api/admin/reset-cooldown")
def reset_cooldown(verified: bool = Depends(verify_master_token)):
    if orchestrator and hasattr(orchestrator, "executor"):
        orchestrator.executor.cooldown_until = 0.0
        orchestrator.executor._balance_cache = None
        orchestrator.executor._futures_cache = None
    if orchestrator and hasattr(orchestrator, "market_data"):
        orchestrator.market_data.cooldown_until = 0.0
    global _status_cache_data, _status_cache_time, _wallet_cache_data, _wallet_cache_time
    _status_cache_data = None
    _wallet_cache_data = None
    return {"status": "cooldown_reset", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/debug/binance")
def debug_binance(verified: bool = Depends(verify_master_token)):
    if not orchestrator or not hasattr(orchestrator, "executor"):
        return {"error": "No executor"}
    ex = orchestrator.executor
    status, data = ex._send_signed("GET", f"{ex.base_url}/api/v3/account")
    balances = [b for b in data.get("balances", []) if float(b.get("free", 0)) + float(b.get("locked", 0)) > 0] if isinstance(data, dict) else []
    now = time.time()
    return {
        "mode": ex.mode,
        "testnet": ex.testnet,
        "base_url": ex.base_url,
        "api_key_len": len(ex.api_key),
        "api_key_masked": f"{ex.api_key[:6]}...{ex.api_key[-4:]}" if ex.api_key else "EMPTY",
        "secret_key_len": len(ex.secret_key),
        "time_offset": ex.time_offset,
        "cooldown_remaining_sec": max(0, int(ex.cooldown_until - now)),
        "http_status": status,
        "raw_response": data if not isinstance(data, dict) or "balances" not in data else f"Found {len(balances)} non-zero balances",
        "non_zero_balances": balances[:10]
    }

@app.get("/api/scan")
def get_scan_results():
    return orchestrator._scan_results if orchestrator else {}

@app.post("/api/scan/trigger")
def trigger_scan(verified: bool = Depends(verify_master_token)):
    if not orchestrator:
        raise HTTPException(503)
    result = orchestrator.run_scan_cycle()
    return result

_portfolio_cache_data = None
_portfolio_cache_time = 0.0

@app.get("/api/portfolio")
def get_portfolio():
    global _portfolio_cache_data, _portfolio_cache_time
    if not orchestrator:
        raise HTTPException(503)
    now = time.time()
    if _portfolio_cache_data and (now - _portfolio_cache_time) < 4.0:
        return _portfolio_cache_data

    status = orchestrator.get_full_status()
    # Pull dynamic wallet valuation from cached get_wallet
    try:
        w = get_wallet()
        if w.get("total_equity_usd", 0) > 0:
            status["portfolio"]["total_equity"] = w["total_equity_usd"]
            status["portfolio"]["spot_equity"] = w.get("spot_usd", w["total_equity_usd"])
            status["portfolio"]["futures_equity"] = w.get("futures_usd", 0.0)
    except Exception:
        pass

    res = {
        "portfolio": status["portfolio"],
        "positions": status["positions"],
        "risk": status["risk"],
        "allocations": orchestrator.portfolio_manager.get_allocations()
    }
    _portfolio_cache_data = res
    _portfolio_cache_time = now
    return res

@app.get("/api/positions")
def get_positions():
    if not orchestrator:
        raise HTTPException(503)
    return orchestrator.get_full_status()["positions"]

@app.get("/api/wallet")
def get_wallet():
    global _wallet_cache_data, _wallet_cache_time
    if not orchestrator:
        raise HTTPException(503)
    now = time.time()
    if _wallet_cache_data and (now - _wallet_cache_time) < 5.0:
        return _wallet_cache_data

    balances = {}
    try:
        if hasattr(orchestrator.executor, "get_account_balances"):
            balances = orchestrator.executor.get_account_balances()
    except Exception:
        pass
    
    # Fetch real-time market prices for accurate valuation
    price_map = {}
    try:
        r = requests.get("https://data-api.binance.vision/api/v3/ticker/price", timeout=8)
        if r.status_code != 200:
            r = requests.get("https://api1.binance.com/api/v3/ticker/price", timeout=8)
        if r.status_code == 200:
            price_map = {p["symbol"]: float(p["price"]) for p in r.json() if "USDT" in p.get("symbol", "")}
    except Exception:
        pass

    scan_res = getattr(orchestrator, "_scan_results", {}) or {}
    items = []
    spot_usd = 0.0
    earn_usd = 0.0
    total_usd = 0.0

    PRIMARY_ASSETS = ["USDT", "USD", "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "PEPE", "SHIB", "NEAR", "AVAX", "TRX", "BONK", "FLOKI"]

    for asset, b in balances.items():
        free = float(b.get("free", 0))
        locked = float(b.get("locked", 0))
        total = float(b.get("total", free + locked))
        if total <= 0.00000001:
            continue

        # Check if Simple Earn (Flexible LD asset)
        is_earn = asset.startswith("LD") and len(asset) > 2
        underlying = asset[2:] if is_earn else asset

        price = 1.0
        if underlying in ["USDT", "USD", "USDC", "FDUSD", "BUSD"]:
            price = 1.0
        else:
            sym = f"{underlying}USDT"
            if sym in price_map:
                price = price_map[sym]
            elif sym in scan_res and scan_res[sym].get("price", 0) > 0:
                price = float(scan_res[sym]["price"])
            else:
                try:
                    pr_res = requests.get(f"https://data-api.binance.vision/api/v3/ticker/price?symbol={sym}", timeout=3)
                    if pr_res.status_code != 200:
                        pr_res = requests.get(f"https://api.binance.com/api/v3/ticker/price?symbol={sym}", timeout=3)
                    if pr_res.status_code == 200:
                        price = float(pr_res.json().get("price", 0))
                        price_map[sym] = price
                except Exception:
                    price = 0.0

        usd_val = total * price if price > 0 else 0
        
        # Skip zero-value airdrop dust
        if usd_val < 0.0001 and underlying not in ["USDT", "USD", "BTC", "BNB", "ETH", "SOL", "PEPE", "SHIB"]:
            continue

        if is_earn:
            earn_usd += usd_val
        else:
            spot_usd += usd_val
        total_usd += usd_val

        items.append({
            "asset": asset,
            "underlying": underlying,
            "category": "earn" if is_earn else "spot",
            "free": round(free, 8) if free < 1 else round(free, 4),
            "locked": round(locked, 4),
            "total": round(total, 8) if total < 1 else round(total, 4),
            "price": price,
            "usd_value": round(usd_val, 4)
        })

    # USD-M Futures Margin Balance Probe
    futures_data = {}
    futures_usd = 0.0
    try:
        if hasattr(orchestrator.executor, "get_futures_account"):
            futures_data = orchestrator.executor.get_futures_account()
            futures_usd = float(futures_data.get("totalMarginBalance", 0.0))
            total_usd += futures_usd
    except Exception:
        pass

    # Sort primary & valuable assets first
    items.sort(key=lambda x: (x["category"] == "earn", x["underlying"] not in PRIMARY_ASSETS, -x["usd_value"]))

    final_total = round(total_usd, 2) if total_usd > 0 else (1000.0 if orchestrator.executor.mode == "paper" else 0.0)

    # Update orchestrator state memory & sync positions
    try:
        orchestrator.portfolio_manager.state["portfolio"]["total_equity"] = final_total
        orchestrator.portfolio_manager.state["portfolio"]["spot_equity"] = round(spot_usd + earn_usd, 2)
        orchestrator.portfolio_manager.state["portfolio"]["futures_equity"] = round(futures_usd, 2)
        if hasattr(orchestrator, "_sync_positions_from_holdings"):
            orchestrator._sync_positions_from_holdings(balances)
    except Exception:
        pass

    res_wallet = {
        "mode": orchestrator.executor.mode,
        "total_equity_usd": final_total,
        "spot_usd": round(spot_usd, 2),
        "earn_usd": round(earn_usd, 2),
        "futures_usd": round(futures_usd, 2),
        "futures_account": futures_data,
        "assets": items
    }
    _wallet_cache_data = res_wallet
    _wallet_cache_time = now
    return res_wallet

class ModeSwitchPayload(BaseModel):
    mode: str
    api_key: Optional[str] = None
    secret_key: Optional[str] = None

@app.post("/api/mode/switch")
def switch_mode(payload: ModeSwitchPayload, verified: bool = Depends(verify_master_token)):
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
        orchestrator.executor.base_url = "https://testnet.binance.vision" if testnet else "https://api1.binance.com"
        orchestrator.executor.futures_url = "https://testnet.binancefuture.com" if testnet else "https://fapi.binance.com"
        if payload.api_key and payload.secret_key:
            orchestrator.executor.api_key = payload.api_key.strip()
            orchestrator.executor.secret_key = payload.secret_key.strip()
            orchestrator.executor.session.headers.update({"X-MBX-APIKEY": payload.api_key.strip()})
            
            # Persist credentials into state so reboots never lose them
            state.setdefault("credentials", {})
            if mode == "live":
                state["credentials"]["api_key"] = payload.api_key.strip()
                state["credentials"]["secret_key"] = payload.secret_key.strip()
            elif mode == "testnet":
                state["credentials"]["testnet_api_key"] = payload.api_key.strip()
                state["credentials"]["testnet_secret_key"] = payload.secret_key.strip()

    if hasattr(orchestrator, "market_data"):
        orchestrator.market_data.mode = mode
        orchestrator.market_data.testnet = testnet
        if payload.api_key:
            orchestrator.market_data.api_key = payload.api_key.strip()
            orchestrator.market_data.secret_key = payload.secret_key.strip()

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

class ClosePositionPayload(BaseModel):
    symbol: str
    trade_type: str = "spot"

@app.post("/api/positions/close")
def close_single_position(payload: ClosePositionPayload, verified: bool = Depends(verify_master_token)):
    if not orchestrator:
        raise HTTPException(503)
    pos = orchestrator.state.get("positions", {}).get(payload.trade_type, {}).get(payload.symbol)
    if not pos:
        raise HTTPException(404, detail="Position not found")
    price = orchestrator.market_data.get_price(payload.symbol) or pos.get("current_price", 0)
    closed = orchestrator._close_position(payload.symbol, pos, "manual_close", price, payload.trade_type)
    return {"status": "ok", "closed": closed}

@app.post("/api/positions/close-all")
def close_all_positions(verified: bool = Depends(verify_master_token)):
    if not orchestrator:
        raise HTTPException(503)
    exits = []
    for ttype in ["spot", "futures"]:
        positions = list(orchestrator.state.get("positions", {}).get(ttype, {}).items())
        for sym, pos in positions:
            price = orchestrator.market_data.get_price(sym) or pos.get("current_price", 0)
            res = orchestrator._close_position(sym, pos, "emergency_close_all", price, ttype)
            if res:
                exits.append(res)
    return {"status": "ok", "closed_count": len(exits), "exits": exits}

@app.get("/api/binance/deposits")
def get_binance_deposits(limit: int = 20):
    if not orchestrator or not hasattr(orchestrator, "executor"):
        return []
    return orchestrator.executor.get_deposit_history(limit)

@app.get("/api/binance/withdrawals")
def get_binance_withdrawals(limit: int = 20):
    if not orchestrator or not hasattr(orchestrator, "executor"):
        return []
    return orchestrator.executor.get_withdrawal_history(limit)

@app.get("/api/binance/transfers")
def get_binance_transfers(limit: int = 20):
    if not orchestrator or not hasattr(orchestrator, "executor"):
        return []
    return orchestrator.executor.get_transfer_history(limit)

class BinanceTransferPayload(BaseModel):
    amount: float
    direction: str = "spot_to_futures"
    asset: str = "USDT"

@app.post("/api/binance/transfer")
def execute_transfer(payload: BinanceTransferPayload, verified: bool = Depends(verify_master_token)):
    if not orchestrator or not hasattr(orchestrator, "executor"):
        raise HTTPException(503, "Orchestrator executor unavailable")
    res = orchestrator.executor.execute_futures_transfer(payload.amount, payload.direction, payload.asset)
    return res


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
    app_c = load_config("app")
    trading_c = load_config("trading")
    # Mask sensitive API secrets
    if isinstance(app_c, dict):
        if "binance" in app_c and isinstance(app_c["binance"], dict):
            if "api_key" in app_c["binance"]:
                app_c["binance"]["api_key"] = mask_key(app_c["binance"]["api_key"])
            if "secret_key" in app_c["binance"]:
                app_c["binance"]["secret_key"] = "••••••••••••••••"
        if "ai" in app_c and isinstance(app_c["ai"], dict):
            if "groq_api_key" in app_c["ai"]:
                app_c["ai"]["groq_api_key"] = mask_key(app_c["ai"]["groq_api_key"])
    return {
        "app": app_c,
        "trading": trading_c
    }

class ConfigUpdate(BaseModel):
    config_name: str
    data: dict

@app.post("/api/config")
def update_config(payload: ConfigUpdate, verified: bool = Depends(verify_master_token)):
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
def control(payload: ControlAction, verified: bool = Depends(verify_master_token)):
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
def debug_account(verified: bool = Depends(verify_master_token)):
    if not orchestrator:
        raise HTTPException(503)
    ex = orchestrator.executor
    status, data = ex._send_signed("GET", f"{ex.base_url}/api/v3/account")
    return {
        "status_code": status,
        "base_url": ex.base_url,
        "api_key_set": bool(ex.api_key),
        "api_key_prefix": mask_key(ex.api_key),
        "secret_key_set": bool(ex.secret_key),
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
