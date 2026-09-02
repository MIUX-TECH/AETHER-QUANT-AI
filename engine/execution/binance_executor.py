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
from typing import Dict, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

BINANCE_BASE = "https://api.binance.com"
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

    def _live_spot_order(self, symbol: str, side: str, order_type: str,
                          qty: float = None, price: float = None,
                          quote_qty: float = None) -> Dict:
        params = {
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "timestamp": int(time.time() * 1000),
            "recvWindow": 5000
        }
        if order_type == "MARKET":
            if quote_qty:
                params["quoteOrderQty"] = round(quote_qty, 2)
            elif qty:
                params["quantity"] = qty
        else:
            params["quantity"] = qty
            params["price"] = price
            params["timeInForce"] = "GTC"

        return self._signed_post(f"{self.base_url}/api/v3/order", params)

    def _live_futures_order(self, symbol: str, side: str, order_type: str,
                             qty: float, price: float = None, leverage: int = 3,
                             margin_mode: str = "ISOLATED",
                             reduce_only: bool = False) -> Dict:
        # Set leverage first
        self._live_set_leverage(symbol, leverage)

        params = {
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "quantity": qty,
            "timestamp": int(time.time() * 1000),
            "recvWindow": 5000
        }
        if order_type == "LIMIT":
            params["price"] = price
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

    def _sign(self, params: dict) -> str:
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return hmac.new(self.secret_key.encode(), query.encode(), hashlib.sha256).hexdigest()

    def _signed_post(self, url: str, params: dict, futures: bool = False) -> Dict:
        params["signature"] = self._sign(params)
        for attempt in range(self.max_retries):
            try:
                r = self.session.post(url, params=params, timeout=10)
                if r.status_code == 200:
                    return r.json()
                error = r.json()
                code = error.get("code", 0)
                # Don't retry on these codes
                if code in [-1121, -1100, -2010, -1013]:
                    logger.error(f"Order rejected: {error}")
                    return {"error": error, "status": "REJECTED"}
                logger.warning(f"Order attempt {attempt+1} failed: {error}")
            except Exception as e:
                logger.error(f"Order execution error attempt {attempt+1}: {e}")
            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay * (attempt + 1))
        return {"error": "Max retries exceeded", "status": "FAILED"}

    def _signed_delete(self, url: str, params: dict) -> Dict:
        params["signature"] = self._sign(params)
        try:
            r = self.session.delete(url, params=params, timeout=10)
            return r.json()
        except Exception as e:
            logger.error(f"Cancel order failed: {e}")
            return {"error": str(e)}

    def get_open_orders(self, symbol: str = None, futures: bool = False) -> List[Dict]:
        if self.mode == "paper":
            return []
        base = self.futures_url if futures else self.base_url
        endpoint = "/fapi/v1/openOrders" if futures else "/api/v3/openOrders"
        params = {"timestamp": int(time.time() * 1000)}
        if symbol:
            params["symbol"] = symbol
        params["signature"] = self._sign(params)
        try:
            r = self.session.get(f"{base}{endpoint}", params=params, timeout=10)
            return r.json() if r.status_code == 200 else []
        except Exception as e:
            logger.error(f"get_open_orders failed: {e}")
            return []
