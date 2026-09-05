"""
engine/analysis/market_data.py — Binance market data fetcher.
Handles candles, ticker, order book, funding rates for futures.
Supports paper mode with realistic simulated data.
"""

import time
import logging
import requests
import hmac
import hashlib
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import json
from pathlib import Path

logger = logging.getLogger(__name__)

BINANCE_ENDPOINTS = [
    "https://api1.binance.com",
    "https://api2.binance.com",
    "https://api3.binance.com",
    "https://api4.binance.com",
    "https://data-api.binance.vision",
    "https://api.binance.com",
]

def _detect_best_binance_endpoint() -> str:
    """Ping each endpoint and return the first one that responds."""
    for ep in BINANCE_ENDPOINTS:
        try:
            r = requests.get(f"{ep}/api/v3/ping", timeout=4)
            if r.status_code == 200:
                logger.info(f"Binance endpoint auto-detected: {ep}")
                return ep
        except Exception:
            continue
    logger.warning("No Binance endpoint responded to ping, defaulting to api1.binance.com")
    return "https://api1.binance.com"

BINANCE_BASE = _detect_best_binance_endpoint()
BINANCE_TESTNET = "https://testnet.binance.vision"
FUTURES_BASE = "https://fapi.binance.com"
FUTURES_TESTNET = "https://testnet.binancefuture.com"

TIMEFRAME_MAP = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "8h": "8h",
    "12h": "12h", "1d": "1d", "3d": "3d", "1w": "1w"
}

TIMEFRAME_SECONDS = {
    "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "2h": 7200, "4h": 14400, "6h": 21600, "8h": 28800,
    "12h": 43200, "1d": 86400, "3d": 259200, "1w": 604800
}


TIMEFRAME_CACHE_TTL = {
    "1d": 14400,  # 4 hours
    "4h": 7200,   # 2 hours
    "1h": 1800,   # 30 minutes
    "15m": 300,   # 5 minutes
    "5m": 60,     # 1 minute
    "1m": 20      # 20 seconds
}


class MarketDataService:
    """
    Fetches market data from Binance REST API.
    Falls back gracefully; works with testnet.
    """

    def __init__(self, api_key: str = "", secret_key: str = ""):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = BINANCE_BASE
        self.futures_url = FUTURES_BASE
        self.session = requests.Session()
        self.session.headers.update({
            "X-MBX-APIKEY": api_key,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        })
        self._cache: Dict[str, Tuple[float, any]] = {}
        self._cache_ttl = 10  # seconds
        self.used_weight = 0
        self.cooldown_until = 0.0

    def _get(self, url: str, params: dict = None, timeout: int = 10) -> Optional[dict]:
        now = time.time()
        if now < self.cooldown_until:
            logger.warning(f"MarketData in rate-limit cooldown for next {int(self.cooldown_until - now)}s. Skipping remote call.")
            return None

        try:
            r = self.session.get(url, params=params, timeout=timeout)
            
            # Track Binance Used Weight Header
            weight = r.headers.get("X-MBX-USED-WEIGHT-1M")
            if weight:
                try:
                    self.used_weight = int(weight)
                    if self.used_weight > 1000:
                        logger.warning(f"⚠️ Binance API Weight high ({self.used_weight}/1200). Throttling 15s.")
                        self.cooldown_until = now + 15
                except Exception:
                    pass

            if r.status_code in [418, 429]:
                logger.error(f"🚨 Binance Rate Limit Triggered (HTTP {r.status_code}): Entering 180s Cooldown.")
                self.cooldown_until = now + 180
                return None

            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"Primary endpoint {url} failed ({e}). Trying fallback...")
            return self._get_public_fallback(url, params, timeout)

    def _get_public_fallback(self, url: str, params: dict, timeout: int) -> Optional[dict]:
        """Fallback to alternative public Binance endpoints."""
        now = time.time()
        if now < self.cooldown_until:
            return None

        endpoints = [ep for ep in BINANCE_ENDPOINTS if ep != self.base_url]
        path = url.split(".com")[-1].split(".vision")[-1]
        for base in endpoints:
            try:
                fallback_url = f"{base}{path}"
                r = requests.get(fallback_url, params=params, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
                if r.status_code in [418, 429]:
                    self.cooldown_until = now + 180
                    return None
                if r.status_code == 200:
                    return r.json()
            except Exception:
                continue
        logger.error(f"All fallback endpoints failed for path {path}")
        return None

    def _cached(self, key: str, fetch_fn, ttl: int = None):
        ttl = ttl or self._cache_ttl
        now = time.time()
        if key in self._cache:
            ts, val = self._cache[key]
            if now - ts < ttl:
                return val
        val = fetch_fn()
        if val is not None:
            self._cache[key] = (now, val)
            # Evict expired entries when cache grows too large
            if len(self._cache) > 500:
                expired = [k for k, (ts, _) in self._cache.items() if now - ts > ttl * 3]
                for k in expired:
                    del self._cache[k]
        elif key in self._cache:
            # Stale cache fallback if remote call failed/cooldown
            return self._cache[key][1]
        return val

    def get_ticker(self, symbol: str) -> Optional[Dict]:
        """Get 24h ticker stats with 30s cache."""
        cache_key = f"ticker_{symbol}"
        def fetch():
            url = f"{self.base_url}/api/v3/ticker/24hr"
            return self._get(url, {"symbol": symbol})
        return self._cached(cache_key, fetch, ttl=30)

    def get_price(self, symbol: str) -> Optional[float]:
        """Get current price with 5s cache."""
        cache_key = f"price_{symbol}"
        def fetch():
            url = f"{self.base_url}/api/v3/ticker/price"
            data = self._get(url, {"symbol": symbol})
            if data and "price" in data:
                return float(data["price"])
            return None
        return self._cached(cache_key, fetch, ttl=5)

    def get_all_prices(self) -> Dict[str, float]:
        """Fetch all current market prices with 10s caching."""
        cache_key = "all_ticker_prices"
        def fetch():
            url = f"{self.base_url}/api/v3/ticker/price"
            data = self._get(url)
            if data and isinstance(data, list):
                return {p["symbol"]: float(p["price"]) for p in data if "symbol" in p and "price" in p}
            return {}
        return self._cached(cache_key, fetch, ttl=10) or {}

    def get_klines(self, symbol: str, interval: str, limit: int = 200) -> Optional[List[Dict]]:
        """
        Fetch OHLCV candlestick data with tiered TTL per timeframe.
        """
        cache_key = f"klines_{symbol}_{interval}_{limit}"
        ttl = TIMEFRAME_CACHE_TTL.get(interval, 60)
        def fetch():
            url = f"{self.base_url}/api/v3/klines"
            raw = self._get(url, {"symbol": symbol, "interval": interval, "limit": limit})
            if not raw:
                return None
            candles = []
            for k in raw:
                candles.append({
                    "open_time": int(k[0]),
                    "open": float(k[1]),
                    "high": float(k[2]),
                    "low": float(k[3]),
                    "close": float(k[4]),
                    "volume": float(k[5]),
                    "close_time": int(k[6]),
                    "quote_volume": float(k[7]),
                    "trades": int(k[8]),
                    "taker_buy_volume": float(k[9]),
                    "taker_buy_quote": float(k[10]),
                    "dt": datetime.utcfromtimestamp(k[0] / 1000).isoformat()
                })
            return candles
        return self._cached(cache_key, fetch, ttl=ttl)

    def get_multi_timeframe(self, symbol: str,
                             timeframes: List[str] = None,
                             limit: int = 200) -> Dict[str, List[Dict]]:
        """Fetch candles for multiple timeframes at once."""
        timeframes = timeframes or ["5m", "15m", "1h", "4h", "1d"]
        result = {}
        for tf in timeframes:
            data = self.get_klines(symbol, tf, limit)
            if data:
                result[tf] = data
            else:
                logger.warning(f"No data for {symbol} {tf}")
        return result

    def get_order_book(self, symbol: str, limit: int = 20) -> Optional[Dict]:
        """Get order book depth."""
        url = f"{self.base_url}/api/v3/depth"
        return self._get(url, {"symbol": symbol, "limit": limit}, timeout=5)

    def get_exchange_info(self) -> Optional[Dict]:
        """Get exchange info (trading rules, lot sizes, etc.)."""
        url = f"{self.base_url}/api/v3/exchangeInfo"
        return self._cached("exchange_info", lambda: self._get(url), ttl=3600)

    def get_symbol_info(self, symbol: str) -> Optional[Dict]:
        """Get info for a specific symbol."""
        info = self.get_exchange_info()
        if not info:
            return None
        for s in info.get("symbols", []):
            if s["symbol"] == symbol:
                return s
        return None

    def get_min_notional(self, symbol: str) -> float:
        """Get minimum notional value for a symbol."""
        info = self.get_symbol_info(symbol)
        if info:
            for f in info.get("filters", []):
                if f["filterType"] == "MIN_NOTIONAL":
                    return float(f.get("minNotional", 10))
        return 10.0

    def get_lot_size(self, symbol: str) -> Dict:
        """Get step size and min/max qty."""
        info = self.get_symbol_info(symbol)
        if info:
            for f in info.get("filters", []):
                if f["filterType"] == "LOT_SIZE":
                    return {
                        "step_size": float(f["stepSize"]),
                        "min_qty": float(f["minQty"]),
                        "max_qty": float(f["maxQty"])
                    }
        return {"step_size": 0.001, "min_qty": 0.001, "max_qty": 9000000}

    def round_quantity(self, symbol: str, qty: float) -> float:
        """Round quantity to valid step size."""
        lot = self.get_lot_size(symbol)
        step = lot["step_size"]
        if step <= 0:
            return qty
        decimals = len(str(step).rstrip("0").split(".")[-1])
        qty = round(qty - (qty % step), decimals)
        return max(qty, lot["min_qty"])

    def get_account_balance(self) -> Optional[Dict]:
        """Get spot account balance (signed request)."""
        return self._signed_get(f"{self.base_url}/api/v3/account")

    def _signed_get(self, url: str, params: dict = None) -> Optional[Dict]:
        params = params or {}
        params["timestamp"] = int(time.time() * 1000)
        params["recvWindow"] = 5000
        query = "&".join(f"{k}={v}" for k, v in params.items())
        sig = hmac.new(self.secret_key.encode(), query.encode(), hashlib.sha256).hexdigest()
        params["signature"] = sig
        try:
            r = self.session.get(url, params=params, timeout=10)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.error(f"Signed GET {url} failed: {e}")
            return None

    def get_recent_trades(self, symbol: str, limit: int = 50) -> Optional[List]:
        url = f"{self.base_url}/api/v3/trades"
        return self._get(url, {"symbol": symbol, "limit": limit}, timeout=5)

    def ping(self) -> bool:
        """Test connectivity."""
        try:
            r = self.session.get(f"{self.base_url}/api/v3/ping", timeout=5)
            return r.status_code == 200
        except Exception:
            # Try public
            try:
                r = requests.get(f"{BINANCE_BASE}/api/v3/ping", timeout=5)
                return r.status_code == 200
            except Exception:
                return False

    def get_server_time(self) -> int:
        url = f"{self.base_url}/api/v3/time"
        data = self._get(url)
        if data:
            return data.get("serverTime", int(time.time() * 1000))
        return int(time.time() * 1000)
