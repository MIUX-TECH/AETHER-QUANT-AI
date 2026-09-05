"""
engine/execution/binance_executor.py — Binance order execution.
Supports paper trading (simulation) and live modes.
Handles retry logic, slippage awareness, fee deduction.
"""

import logging
import time
import hmac
import hashlib
import uuid
import requests
from typing import Dict, Optional, List, Tuple, Any
from datetime import datetime

import os

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
                logger.info(f"Binance executor endpoint auto-detected: {ep}")
                return ep
        except Exception:
            continue
    logger.warning("No Binance endpoint responded, defaulting to api1.binance.com")
    return "https://api1.binance.com"

BINANCE_BASE = _detect_best_binance_endpoint()
BINANCE_TESTNET = "https://testnet.binance.vision"
FUTURES_BASE = "https://fapi.binance.com"
FUTURES_TESTNET = "https://testnet.binancefuture.com"

# Paper trading fee simulation
TAKER_FEE = 0.001  # 0.1%
MAKER_FEE = 0.001
SLIPPAGE_BPS = 5  # 0.05% simulated slippage


class BinanceExecutor:
    def __init__(self, api_key: str = "", secret_key: str = "",
                 testnet: bool = True, mode: str = "paper"):
        self.api_key = api_key
        self.secret_key = secret_key
        self.testnet = testnet
        self.mode = mode
        self.base_url = BINANCE_TESTNET if testnet else BINANCE_BASE
        self.futures_url = FUTURES_TESTNET if testnet else FUTURES_BASE
        self.session = requests.Session()
        self.session.headers.update({"X-MBX-APIKEY": api_key})
        self.max_retries = 3
        self.retry_delay = 2
        self.time_offset = 0
        self._balance_cache = None
        self._balance_cache_time = 0.0
        self._futures_cache = None
        self._futures_cache_time = 0.0
        self._exchange_info = None
        self._exchange_info_time = 0.0
        self._symbol_rules = {}
        self._cache_ttl = 6.0  # seconds
        self.cooldown_until = 0.0
        self._sync_time()

    def _sync_time(self):
        """Sync millisecond time offset with Binance server time."""
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            r = requests.get(f"{self.base_url}/api/v3/time", headers=headers, timeout=5)
            if r.status_code == 200:
                server_time = r.json().get("serverTime", 0)
                local_time = int(time.time() * 1000)
                self.time_offset = server_time - local_time
                logger.info(f"Binance time synced. Offset: {self.time_offset}ms")
        except Exception as e:
            logger.warning(f"Binance time sync failed: {e}")

    def get_symbol_rules(self, symbol: str) -> Dict:
        """Fetch and cache LOT_SIZE, MIN_NOTIONAL and PRICE_FILTER for symbol."""
        now = time.time()
        if symbol in self._symbol_rules and (now - self._exchange_info_time) <= 14400:
            return self._symbol_rules[symbol]

        if not self._exchange_info or (now - self._exchange_info_time) > 14400:
            try:
                r = requests.get(f"{self.base_url}/api/v3/exchangeInfo", timeout=10, headers={"User-Agent": "Mozilla/5.0"})
                if r.status_code == 200:
                    data = r.json()
                    self._exchange_info = data
                    self._exchange_info_time = now
                    for s in data.get("symbols", []):
                        sym = s.get("symbol")
                        rules = {
                            "stepSize": "0.0001",
                            "minQty": "0.0001",
                            "minNotional": 5.0,
                            "tickSize": "0.01",
                            "status": s.get("status", "TRADING")
                        }
                        for f in s.get("filters", []):
                            if f.get("filterType") == "LOT_SIZE":
                                rules["stepSize"] = f.get("stepSize", "0.0001")
                                rules["minQty"] = f.get("minQty", "0.0001")
                            elif f.get("filterType") in ["MIN_NOTIONAL", "NOTIONAL"]:
                                rules["minNotional"] = float(f.get("minNotional", f.get("notional", 5.0)))
                            elif f.get("filterType") == "PRICE_FILTER":
                                rules["tickSize"] = f.get("tickSize", "0.01")
                        self._symbol_rules[sym] = rules
            except Exception as e:
                logger.warning(f"Failed to fetch exchangeInfo: {e}")

        return self._symbol_rules.get(symbol, {
            "stepSize": "0.0001",
            "minQty": "0.0001",
            "minNotional": 5.0,
            "tickSize": "0.01"
        })

    # ============================================================
    # SPOT ORDERS
    # ============================================================

    def place_spot_market_buy(self, symbol: str, usdt_amount: float,
                               price: float = 0) -> Dict:
        """Place spot market buy order."""
        if self.mode == "paper":
            return self._paper_spot_order(symbol, "BUY", "MARKET", usdt_amount, price)
        return self._live_spot_order(symbol, "BUY", "MARKET", quote_qty=usdt_amount)

    def place_spot_market_sell(self, symbol: str, qty: float, price: float = 0) -> Dict:
        """Place spot market sell."""
        if self.mode == "paper":
            return self._paper_spot_order(symbol, "SELL", "MARKET", qty * price, price, qty=qty)
        return self._live_spot_order(symbol, "SELL", "MARKET", qty=qty)

    def place_spot_limit_buy(self, symbol: str, qty: float, price: float) -> Dict:
        if self.mode == "paper":
            return self._paper_spot_order(symbol, "BUY", "LIMIT", qty * price, price, qty=qty)
        return self._live_spot_order(symbol, "BUY", "LIMIT", qty=qty, price=price)

    def place_spot_limit_sell(self, symbol: str, qty: float, price: float) -> Dict:
        if self.mode == "paper":
            return self._paper_spot_order(symbol, "SELL", "LIMIT", qty * price, price, qty=qty)
        return self._live_spot_order(symbol, "SELL", "LIMIT", qty=qty, price=price)

    def cancel_spot_order(self, symbol: str, order_id: str) -> Dict:
        if self.mode == "paper":
            return {"status": "CANCELED", "orderId": order_id, "symbol": symbol}
        return self._live_cancel(symbol, order_id, futures=False)

    # ============================================================
    # FUTURES ORDERS
    # ============================================================

    def place_futures_order(self, symbol: str, side: str, qty: float,
                             price: float = 0, order_type: str = "MARKET",
                             leverage: int = 3, margin_mode: str = "ISOLATED",
                             reduce_only: bool = False) -> Dict:
        if self.mode == "paper":
            return self._paper_futures_order(symbol, side, order_type, qty, price, leverage)
        return self._live_futures_order(symbol, side, order_type, qty, price, leverage,
                                         margin_mode, reduce_only)

    def set_futures_leverage(self, symbol: str, leverage: int) -> Dict:
        if self.mode == "paper":
            return {"leverage": leverage, "symbol": symbol, "status": "ok"}
        return self._live_set_leverage(symbol, leverage)

    # ============================================================
    # PAPER TRADING SIMULATION
    # ============================================================

    def _paper_spot_order(self, symbol: str, side: str, order_type: str,
                           usdt_value: float, current_price: float,
                           qty: float = None) -> Dict:
        order_id = f"PAPER_{uuid.uuid4().hex[:12].upper()}"
        slippage = current_price * (SLIPPAGE_BPS / 10000) * (1 if side == "BUY" else -1)
        fill_price = current_price + slippage if current_price > 0 else 0

        if qty is None:
            qty = usdt_value / fill_price if fill_price > 0 else 0
        fee = usdt_value * TAKER_FEE
        filled_usdt = qty * fill_price
        net_usdt = filled_usdt - fee if side == "SELL" else -(filled_usdt + fee)

        logger.info(f"[PAPER] SPOT {side} {symbol}: {qty:.6f} @ {fill_price:.4f} | fee={fee:.4f} USDT")

        return {
            "orderId": order_id,
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "status": "FILLED",
            "origQty": qty,
            "executedQty": qty,
            "price": fill_price,
            "cummulativeQuoteQty": filled_usdt,
            "fee": fee,
            "net_pnl": net_usdt,
            "timestamp": int(time.time() * 1000),
            "mode": "paper"
        }

    def _paper_futures_order(self, symbol: str, side: str, order_type: str,
                              qty: float, price: float, leverage: int) -> Dict:
        order_id = f"PAPER_FUT_{uuid.uuid4().hex[:12].upper()}"
        slippage = price * (SLIPPAGE_BPS / 10000) * (1 if side == "BUY" else -1)
        fill_price = price + slippage if price > 0 else 0
        notional = qty * fill_price
        fee = notional * TAKER_FEE
        margin_used = notional / leverage

        logger.info(f"[PAPER] FUTURES {side} {symbol}: {qty:.6f} @ {fill_price:.4f} lev={leverage}x")

        return {
            "orderId": order_id,
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "status": "FILLED",
            "origQty": qty,
            "executedQty": qty,
            "price": fill_price,
            "notional": notional,
            "margin_used": margin_used,
            "leverage": leverage,
            "fee": fee,
            "timestamp": int(time.time() * 1000),
            "mode": "paper",
            "futures": True
        }

    # ============================================================
    # LIVE ORDER EXECUTION (with retry)
    # ============================================================

    def _format_qty(self, symbol: str, qty: float) -> str:
        """Format quantity to comply with Binance LOT_SIZE stepSize rules using precise decimal math."""
        rules = self.get_symbol_rules(symbol)
        step_size_str = rules.get("stepSize", "0.0001")
        min_qty_str = rules.get("minQty", "0.0001")
        try:
            from decimal import Decimal, ROUND_DOWN
            step = Decimal(step_size_str.rstrip('0') or '1')
            d_qty = Decimal(str(qty))
            min_qty = Decimal(min_qty_str.rstrip('0') or '0')
            formatted = (d_qty / step).to_integral_value(rounding=ROUND_DOWN) * step
            if formatted < min_qty:
                formatted = min_qty
            if step >= 1:
                return str(int(formatted))
            result = str(formatted.normalize())
            if 'E' in result or 'e' in result:
                result = f"{formatted:f}"
            return result
        except Exception as e:
            logger.warning(f"_format_qty fallback for {symbol} qty={qty}: {e}")
            step_str = step_size_str.rstrip('0')
            if '.' in step_str:
                decimals = len(step_str.split('.')[1])
            else:
                decimals = 0
            import math
            factor = 10 ** decimals
            truncated = math.floor(qty * factor) / factor
            return f"{truncated:.{decimals}f}"

    def _format_price(self, symbol: str, price: float) -> str:
        """Format price to comply with Binance PRICE_FILTER tickSize rules."""
        rules = self.get_symbol_rules(symbol)
        tick_size_str = rules.get("tickSize", "0.01")
        try:
            from decimal import Decimal, ROUND_DOWN
            tick = Decimal(tick_size_str.rstrip('0') or '1')
            d_price = Decimal(str(price))
            formatted = (d_price / tick).to_integral_value(rounding=ROUND_DOWN) * tick
            if tick >= 1:
                return str(int(formatted))
            result = str(formatted.normalize())
            if 'E' in result or 'e' in result:
                result = f"{formatted:f}"
            return result
        except Exception as e:
            logger.warning(f"_format_price fallback for {symbol} price={price}: {e}")
            tick_str = tick_size_str.rstrip('0')
            if '.' in tick_str:
                decimals = len(tick_str.split('.')[1])
            else:
                decimals = 2
            import math
            factor = 10 ** decimals
            truncated = math.floor(price * factor) / factor
            return f"{truncated:.{decimals}f}"

    def _live_spot_order(self, symbol: str, side: str, order_type: str,
                          qty: float = None, price: float = None,
                          quote_qty: float = None) -> Dict:
        client_oid = f"AQ_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
        params = {
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "newClientOrderId": client_oid,
            "timestamp": int(time.time() * 1000),
            "recvWindow": 60000
        }
        if order_type == "MARKET":
            if quote_qty:
                params["quoteOrderQty"] = round(quote_qty, 2)
            elif qty:
                params["quantity"] = self._format_qty(symbol, qty)
        else:
            params["quantity"] = self._format_qty(symbol, qty) if qty else "0.001"
            if price:
                params["price"] = self._format_price(symbol, price)
            params["timeInForce"] = "GTC"

        return self._signed_post(f"{self.base_url}/api/v3/order", params)

    def _live_futures_order(self, symbol: str, side: str, order_type: str,
                             qty: float, price: float = None, leverage: int = 3,
                             margin_mode: str = "ISOLATED",
                             reduce_only: bool = False) -> Dict:
        # Set leverage first
        self._live_set_leverage(symbol, leverage)

        client_oid = f"AQ_FUT_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
        params = {
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "quantity": self._format_qty(symbol, qty),
            "newClientOrderId": client_oid,
            "timestamp": int(time.time() * 1000),
            "recvWindow": 5000
        }
        if order_type == "LIMIT":
            params["price"] = self._format_price(symbol, price)
            params["timeInForce"] = "GTC"
        if reduce_only:
            params["reduceOnly"] = "true"

        return self._signed_post(f"{self.futures_url}/fapi/v1/order", params, futures=True)

    def _live_set_leverage(self, symbol: str, leverage: int) -> Dict:
        params = {
            "symbol": symbol,
            "leverage": leverage,
            "timestamp": int(time.time() * 1000)
        }
        return self._signed_post(f"{self.futures_url}/fapi/v1/leverage", params, futures=True)

    def _live_cancel(self, symbol: str, order_id: str, futures: bool = False) -> Dict:
        params = {
            "symbol": symbol,
            "orderId": order_id,
            "timestamp": int(time.time() * 1000)
        }
        base = self.futures_url if futures else self.base_url
        endpoint = "/fapi/v1/order" if futures else "/api/v3/order"
        return self._signed_delete(f"{base}{endpoint}", params)

    def place_spot_oco_order(self, symbol: str, qty: float, tp_price: float,
                             sl_stop_price: float, sl_limit_price: float = None) -> Dict:
        """
        Place official Binance Spot OCO Order (One-Cancels-the-Other):
        - Limits Take Profit at tp_price
        - Stops Loss at sl_stop_price with limit execution at sl_limit_price
        """
        if self.mode == "paper":
            return {
                "orderListId": f"PAPER_OCO_{uuid.uuid4().hex[:8].upper()}",
                "symbol": symbol,
                "status": "EXECUTING",
                "mode": "paper"
            }
        
        sl_limit = sl_limit_price or sl_stop_price * 0.995
        params = {
            "symbol": symbol,
            "side": "SELL",
            "quantity": self._format_qty(symbol, qty),
            "price": self._format_price(symbol, tp_price),
            "stopPrice": self._format_price(symbol, sl_stop_price),
            "stopLimitPrice": self._format_price(symbol, sl_limit),
            "stopLimitTimeInForce": "GTC"
        }
        return self._signed_post(f"{self.base_url}/api/v3/order/oco", params)

    def _send_signed(self, method: str, url: str, params: dict = None) -> Tuple[int, Any]:
        now = time.time()
        if now < self.cooldown_until:
            logger.warning(f"BinanceExecutor in cooldown for {int(self.cooldown_until - now)}s. Skipping signed call.")
            return 429, {"error": "Rate limit cooldown active", "code": -1003}

        import urllib.parse
        p = dict(params or {})
        p.setdefault("recvWindow", 60000)
        p["timestamp"] = int(time.time() * 1000) + self.time_offset
        p.pop("signature", None)

        query = urllib.parse.urlencode(sorted(p.items()))
        sig = hmac.new(self.secret_key.encode("utf-8"), query.encode("utf-8"), hashlib.sha256).hexdigest()
        full_url = f"{url}?{query}&signature={sig}"
        headers = {
            "X-MBX-APIKEY": self.api_key.strip(),
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }

        import re
        CLUSTER_HOSTS = ["api.binance.com", "api1.binance.com", "api2.binance.com", "api3.binance.com", "api4.binance.com"]
        last_err = None
        for attempt in range(len(CLUSTER_HOSTS)):
            # Rotate cluster endpoint on each attempt
            cur_url = full_url
            if not self.testnet:
                alt_host = CLUSTER_HOSTS[attempt % len(CLUSTER_HOSTS)]
                cur_url = re.sub(r"https://(api\d*|data-api)\.binance\.(com|vision)", f"https://{alt_host}", full_url)

            try:
                if method.upper() == "GET":
                    r = self.session.get(cur_url, headers=headers, timeout=10)
                elif method.upper() == "POST":
                    r = self.session.post(cur_url, headers=headers, timeout=10)
                elif method.upper() == "DELETE":
                    r = self.session.delete(cur_url, headers=headers, timeout=10)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                try:
                    data = r.json()
                except Exception:
                    data = {"text": r.text, "status_code": r.status_code}

                if r.status_code == 200:
                    return 200, data

                if r.status_code in [418, 429]:
                    logger.warning(f"Host {cur_url} returned {r.status_code}. Failover to next cluster endpoint...")
                    last_err = {"http_status": r.status_code, "body": data}
                    continue

                last_err = {"http_status": r.status_code, "body": data}
                code = data.get("code", 0) if isinstance(data, dict) else 0
                if code in [-1121, -1100, -2010, -1013, -6006, -6009, -6001]:
                    logger.error(f"Order/Action rejected ({code}): {data}")
                    return r.status_code, data

                logger.warning(f"{method} {cur_url} attempt {attempt+1} failed ({r.status_code}): {data}")
            except Exception as e:
                last_err = {"exception": str(e), "type": type(e).__name__}
                logger.error(f"{method} {cur_url} attempt {attempt+1} exception: {e}")

        # If ALL cluster hosts failed with 418/429, enter cooldown
        if last_err and last_err.get("http_status") in [418, 429]:
            self.cooldown_until = time.time() + 180
            logger.error("🚨 All Binance cluster endpoints rate limited. Entering 180s cooldown.")
            return last_err.get("http_status"), last_err.get("body", {})

        return 500, {"error": "Max retries exceeded", "last_error": last_err}

    def _send_signed_emergency(self, method: str, url: str, params: dict = None) -> Tuple[int, Any]:
        """Emergency signed request that bypasses cooldown. Used only for closing positions."""
        import urllib.parse
        import re
        p = dict(params or {})
        p.setdefault("recvWindow", 60000)
        p["timestamp"] = int(time.time() * 1000) + self.time_offset
        p.pop("signature", None)

        query = urllib.parse.urlencode(sorted(p.items()))
        sig = hmac.new(self.secret_key.encode("utf-8"), query.encode("utf-8"), hashlib.sha256).hexdigest()
        full_url = f"{url}?{query}&signature={sig}"
        headers = {
            "X-MBX-APIKEY": self.api_key.strip(),
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }

        EMERGENCY_HOSTS = ["api4.binance.com", "api3.binance.com", "api2.binance.com", "api1.binance.com", "api.binance.com"]
        for host in EMERGENCY_HOSTS:
            try:
                cur_url = re.sub(r"https://(api\d*|data-api)\.binance\.(com|vision)", f"https://{host}", full_url)
                if method.upper() == "POST":
                    r = requests.post(cur_url, headers=headers, timeout=15)
                elif method.upper() == "DELETE":
                    r = requests.delete(cur_url, headers=headers, timeout=15)
                else:
                    r = requests.get(cur_url, headers=headers, timeout=15)
                if r.status_code == 200:
                    logger.info(f"🚨 EMERGENCY request succeeded via {host}")
                    return 200, r.json()
                if r.status_code not in [418, 429]:
                    return r.status_code, r.json()
            except Exception as e:
                logger.error(f"Emergency request to {host} failed: {e}")
                continue
        return 503, {"error": "All emergency endpoints exhausted"}

    def _signed_post(self, url: str, params: dict, futures: bool = False) -> Dict:
        status, data = self._send_signed("POST", url, params)
        return data if isinstance(data, dict) else {"error": str(data), "status": "FAILED"}

    def _signed_delete(self, url: str, params: dict) -> Dict:
        status, data = self._send_signed("DELETE", url, params)
        return data if isinstance(data, dict) else {"error": str(data)}

    def get_open_orders(self, symbol: str = None, futures: bool = False) -> List[Dict]:
        if self.mode == "paper":
            return []
        base = self.futures_url if futures else self.base_url
        endpoint = "/fapi/v1/openOrders" if futures else "/api/v3/openOrders"
        params = {}
        if symbol:
            params["symbol"] = symbol
        status, data = self._send_signed("GET", f"{base}{endpoint}", params)
        return data if status == 200 and isinstance(data, list) else []

    def get_account_balances(self) -> Dict[str, Dict]:
        now = time.time()
        if self._balance_cache is not None and (now - self._balance_cache_time) < self._cache_ttl:
            return self._balance_cache

        if not self.api_key or not self.secret_key:
            if self.mode == "live" or not self.testnet:
                self.api_key = os.getenv("BINANCE_API_KEY", "").strip()
                self.secret_key = os.getenv("BINANCE_SECRET_KEY", "").strip()
            else:
                self.api_key = os.getenv("BINANCE_TESTNET_API_KEY", "").strip()
                self.secret_key = os.getenv("BINANCE_TESTNET_SECRET_KEY", "").strip()
            if self.api_key:
                self.session.headers.update({"X-MBX-APIKEY": self.api_key})
                logger.info("Loaded API credentials from environment variables")

        if self.api_key and self.secret_key:
            status, data = self._send_signed("GET", f"{self.base_url}/api/v3/account")
            if status == 200 and isinstance(data, dict):
                res = {}
                for b in data.get("balances", []):
                    free = float(b.get("free", 0))
                    locked = float(b.get("locked", 0))
                    total = free + locked
                    if total > 0.00000001:
                        res[b["asset"]] = {"free": free, "locked": locked, "total": total}
                self._balance_cache = res
                self._balance_cache_time = now
                return res
            logger.error(f"get_account_balances failed ({status}): {data}")

        if self.mode == "paper":
            return {"USDT": {"free": 1000.0, "locked": 0.0, "total": 1000.0}}
        
        return self._balance_cache or {}

    def get_futures_account(self) -> Dict:
        """Fetch USD-M Futures account balances and margin with 6s caching."""
        if self.mode == "paper":
            return {"totalMarginBalance": "0.0", "availableBalance": "0.0", "positions": []}
        now = time.time()
        if self._futures_cache is not None and (now - self._futures_cache_time) < self._cache_ttl:
            return self._futures_cache
        status, data = self._send_signed("GET", f"{self.futures_url}/fapi/v2/account")
        if status == 200 and isinstance(data, dict):
            self._futures_cache = data
            self._futures_cache_time = now
            return data
        return self._futures_cache or {}

    def get_my_trades(self, symbol: str = "BTCUSDT", limit: int = 50) -> List[Dict]:
        """Fetch recent executions for a symbol."""
        if self.mode == "paper":
            return []
        params = {"symbol": symbol, "limit": limit}
        status, data = self._send_signed("GET", f"{self.base_url}/api/v3/myTrades", params)
        return data if status == 200 and isinstance(data, list) else []

    def get_deposit_history(self, limit: int = 20) -> List[Dict]:
        """Fetch deposit history via SAPI."""
        if self.mode == "paper":
            return []
        params = {"limit": limit}
        status, data = self._send_signed("GET", f"{self.base_url}/sapi/v1/capital/deposit/hisrec", params)
        return data if status == 200 and isinstance(data, list) else []

    def get_withdrawal_history(self, limit: int = 20) -> List[Dict]:
        """Fetch withdrawal history via SAPI."""
        if self.mode == "paper":
            return []
        params = {"limit": limit}
        status, data = self._send_signed("GET", f"{self.base_url}/sapi/v1/capital/withdraw/history", params)
        return data if status == 200 and isinstance(data, list) else []

    def get_transfer_history(self, limit: int = 20) -> List[Dict]:
        """Fetch internal Spot <-> Futures transfer history via SAPI."""
        if self.mode == "paper":
            return []
        params = {"asset": "USDT", "startTime": int((time.time() - 86400 * 90) * 1000), "limit": limit}
        status, data = self._send_signed("GET", f"{self.base_url}/sapi/v1/futures/transfer", params)
        if status == 200 and isinstance(data, dict):
            return data.get("rows", [])
        return data if status == 200 and isinstance(data, list) else []

    def execute_futures_transfer(self, amount: float, direction: str = "spot_to_futures", asset: str = "USDT") -> Dict:
        """
        Transfer funds internally between Spot and USD-M Futures via Binance SAPI.
        direction: 'spot_to_futures' (type=1) or 'futures_to_spot' (type=2)
        """
        if self.mode == "paper":
            return {"tranId": 999999, "status": "CONFIRMED", "simulated": True, "amount": amount, "direction": direction}

        transfer_type = 1 if direction in ["spot_to_futures", "1", 1] else 2
        # Use string truncation to avoid floating-point dust that Binance SAPI rejects
        amt_str = f"{float(amount):.8f}"
        params = {
            "asset": asset.upper(),
            "amount": amt_str,
            "type": transfer_type
        }
        status, data = self._send_signed("POST", f"{self.base_url}/sapi/v1/futures/transfer", params)
        if status == 200 and isinstance(data, dict) and "tranId" in data:
            logger.info(f"✅ SAPI Futures Transfer SUCCESS: {amount} {asset} ({direction}) | TranId: {data['tranId']}")
            return {"status": "SUCCESS", "tranId": data["tranId"], "amount": amount, "direction": direction}
        
        logger.error(f"❌ SAPI Futures Transfer FAILED ({status}): {data}")
        return {"status": "FAILED", "error": str(data), "http_status": status}

    # ============================================================
    # BINANCE EARN AUTO-REDEEM
    # ============================================================

    def get_earn_positions(self, asset: str = None) -> List[Dict]:
        """Fetch active Flexible Simple Earn positions."""
        if self.mode == "paper":
            return []
        params = {"size": 100}
        if asset:
            params["asset"] = asset.upper()
        status, data = self._send_signed("GET", f"{self.base_url}/sapi/v1/simple-earn/flexible/position", params)
        if status == 200 and isinstance(data, dict):
            return data.get("rows", [])
        return []

    def redeem_from_earn(self, product_id: str, amount: float, asset: str) -> Dict:
        """Redeem specific amount from Simple Earn to Spot wallet."""
        if self.mode == "paper":
            logger.info(f"[PAPER] Redeemed {amount} {asset} from Earn to Spot")
            return {"status": "SUCCESS", "simulated": True}
        
        # Binance requires string formatting for amount
        amt_str = f"{float(amount):.8f}".rstrip("0").rstrip(".")
        params = {
            "productId": product_id,
            "amount": amt_str,
            "destAccount": "SPOT"
        }
        logger.info(f"Attempting to redeem {amt_str} {asset} from Earn (ProductID: {product_id})")
        status, data = self._send_signed("POST", f"{self.base_url}/sapi/v1/simple-earn/flexible/redeem", params)
        
        if status == 200:
            logger.info(f"✅ Earn Redeem SUCCESS: {amt_str} {asset} to Spot")
            # Invalidate balance cache so next read is fresh
            self._balance_cache = None
            return {"status": "SUCCESS", "data": data}
            
        logger.error(f"❌ Earn Redeem FAILED ({status}): {data}")
        return {"status": "FAILED", "error": str(data), "http_status": status}

    def ensure_spot_balance(self, symbol: str, required_qty: float) -> bool:
        """
        Check if Spot wallet has required_qty of base asset.
        If not, check Simple Earn and auto-redeem the exact missing amount.
        Returns True if balance is sufficient (or successfully redeemed), False otherwise.
        """
        if self.mode == "paper":
            return True
            
        # Extract base asset from symbol (e.g., BTC from BTCUSDT)
        base_asset = symbol.replace("USDT", "") if symbol.endswith("USDT") else symbol
        
        # 1. Check current Spot balance (force fresh fetch by bypassing cache)
        self._balance_cache = None
        balances = self.get_account_balances()
        spot_free = float(balances.get(base_asset, {}).get("free", 0.0))
        
        if spot_free >= required_qty * 0.999:  # Allow tiny dust tolerance
            return True
            
        missing_qty = required_qty - spot_free
        logger.warning(f"Insufficient Spot balance for {base_asset}. Have {spot_free:.6f}, need {required_qty:.6f}. Missing: {missing_qty:.6f}")
        
        # 2. Check Simple Earn positions
        earn_positions = self.get_earn_positions(asset=base_asset)
        if not earn_positions:
            logger.error(f"No Simple Earn positions found for {base_asset} to cover shortfall.")
            return False
            
        # 3. Find flexible position with enough balance
        redeemed = False
        for pos in earn_positions:
            total_amt = float(pos.get("totalAmount", 0))
            product_id = pos.get("productId")
            
            if total_amt > 0:
                # Redeem either exactly what's missing, or max available if less than missing
                redeem_amt = min(missing_qty, total_amt)
                res = self.redeem_from_earn(product_id, redeem_amt, base_asset)
                
                if res.get("status") == "SUCCESS":
                    missing_qty -= redeem_amt
                    redeemed = True
                    if missing_qty <= 0.00001:
                        break
        
        # 4. If redeemed, wait for balance to reflect (Binance usually takes 1-3 seconds)
        if redeemed:
            logger.info("Waiting for Earn redemption to reflect in Spot balance...")
            for i in range(15):  # Wait up to 7.5 seconds
                time.sleep(0.5)
                self._balance_cache = None
                new_bals = self.get_account_balances()
                new_spot_free = float(new_bals.get(base_asset, {}).get("free", 0.0))
                if new_spot_free >= required_qty * 0.999:
                    logger.info(f"✅ Spot balance updated successfully. New balance: {new_spot_free:.6f} {base_asset}")
                    return True
            
            logger.error(f"Timeout waiting for Spot balance to update after redemption.")
            return False
            
        return False

    def emergency_close_position(self, symbol: str, qty: float, side: str = "SELL",
                                   trade_type: str = "spot") -> Dict:
        """Emergency position close that bypasses rate-limit cooldown.
        Used when positions must be closed during flash crashes regardless of cooldown state."""
        logger.warning(f"🚨 EMERGENCY CLOSE: {side} {qty} {symbol} ({trade_type}) — bypassing cooldown")
        
        if self.mode == "paper":
            return self._paper_spot_order(symbol, side, "MARKET", qty * 1, 1, qty=qty)

        formatted_qty = self._format_qty(symbol, qty)
        client_oid = f"AQ_EMRG_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"

        if trade_type == "futures":
            params = {
                "symbol": symbol,
                "side": side,
                "type": "MARKET",
                "quantity": formatted_qty,
                "newClientOrderId": client_oid,
                "reduceOnly": "true",
                "timestamp": int(time.time() * 1000),
                "recvWindow": 60000
            }
            status, data = self._send_signed_emergency("POST", f"{self.futures_url}/fapi/v1/order", params)
        else:
            params = {
                "symbol": symbol,
                "side": side,
                "type": "MARKET",
                "quantity": formatted_qty,
                "newClientOrderId": client_oid,
                "timestamp": int(time.time() * 1000),
                "recvWindow": 60000
            }
            status, data = self._send_signed_emergency("POST", f"{self.base_url}/api/v3/order", params)

        if status == 200:
            logger.info(f"✅ EMERGENCY CLOSE SUCCESS: {symbol} {formatted_qty} — order filled")
        else:
            logger.error(f"❌ EMERGENCY CLOSE FAILED: {symbol} — {data}")
        
        return data if isinstance(data, dict) else {"error": str(data), "status": "FAILED"}


