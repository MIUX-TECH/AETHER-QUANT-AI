"""
engine/execution/ws_price_stream.py — Fast price stream for TP/SL monitoring.
Uses Binance REST ticker endpoint with 2-second polling for near-realtime price tracking.
Falls back gracefully if Binance is rate-limited.
"""

import logging
import time
import threading
import requests
from typing import Dict, List, Callable, Optional

logger = logging.getLogger(__name__)

BINANCE_TICKER_URL = "https://api1.binance.com/api/v3/ticker/price"
BINANCE_TICKER_URLS = [
    "https://api1.binance.com/api/v3/ticker/price",
    "https://api2.binance.com/api/v3/ticker/price",
    "https://api3.binance.com/api/v3/ticker/price",
    "https://data-api.binance.vision/api/v3/ticker/price",
]


class PriceStream:
    """Fast price polling stream for near-realtime TP/SL monitoring."""

    def __init__(self, symbols: List[str], poll_interval: float = 2.0,
                 flash_crash_pct: float = 0.05):
        self.symbols = set(symbols)
        self.poll_interval = poll_interval
        self.flash_crash_pct = flash_crash_pct
        self._prices: Dict[str, float] = {}
        self._prev_prices: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._callbacks: List[Callable] = []
        self._crash_callbacks: List[Callable] = []
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "Mozilla/5.0"})
        self._endpoint_idx = 0
        self._error_count = 0
        self._last_update: float = 0
        self._cooldown_until: float = 0

    def add_symbols(self, symbols: List[str]):
        """Add symbols to track."""
        with self._lock:
            self.symbols.update(symbols)

    def remove_symbol(self, symbol: str):
        """Remove a symbol from tracking."""
        with self._lock:
            self.symbols.discard(symbol)

    def get_price(self, symbol: str) -> Optional[float]:
        """Get the latest cached price for a symbol. Thread-safe."""
        with self._lock:
            return self._prices.get(symbol)

    def get_all_prices(self) -> Dict[str, float]:
        """Get all cached prices. Thread-safe."""
        with self._lock:
            return dict(self._prices)

    def on_price_update(self, callback: Callable[[Dict[str, float]], None]):
        """Register a callback that fires on every price update batch."""
        self._callbacks.append(callback)

    def on_flash_crash(self, callback: Callable[[str, float, float, float], None]):
        """Register callback for flash crash detection.
        Args: symbol, current_price, previous_price, drop_pct
        """
        self._crash_callbacks.append(callback)

    def start(self):
        """Start the price stream in a background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True, name="PriceStream")
        self._thread.start()
        logger.info(f"PriceStream started: tracking {len(self.symbols)} symbols, polling every {self.poll_interval}s")

    def stop(self):
        """Stop the price stream."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("PriceStream stopped")

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def last_update_age(self) -> float:
        """Seconds since last successful price update."""
        return time.time() - self._last_update if self._last_update else float('inf')

    def _poll_loop(self):
        """Main polling loop."""
        while self._running:
            try:
                now = time.time()
                if now < self._cooldown_until:
                    time.sleep(1)
                    continue

                prices = self._fetch_prices()
                if prices:
                    self._process_update(prices)
                    self._error_count = 0
                else:
                    self._error_count += 1
                    if self._error_count >= 10:
                        self._cooldown_until = now + 30
                        logger.warning("PriceStream: 10 consecutive failures, cooling down 30s")
                        self._error_count = 0

            except Exception as e:
                logger.error(f"PriceStream poll error: {e}")
                self._error_count += 1

            time.sleep(self.poll_interval)

    def _fetch_prices(self) -> Dict[str, float]:
        """Fetch prices from Binance REST API with endpoint rotation."""
        with self._lock:
            symbols = list(self.symbols)
        if not symbols:
            return {}

        for attempt in range(len(BINANCE_TICKER_URLS)):
            url = BINANCE_TICKER_URLS[(self._endpoint_idx + attempt) % len(BINANCE_TICKER_URLS)]
            try:
                params = {"symbols": str(symbols).replace("'", '"')} if len(symbols) <= 20 else {}
                r = self._session.get(url, params=params, timeout=5)
                if r.status_code == 200:
                    data = r.json()
                    result = {}
                    if isinstance(data, list):
                        for item in data:
                            sym = item.get("symbol", "")
                            if sym in self.symbols:
                                result[sym] = float(item.get("price", 0))
                    elif isinstance(data, dict):
                        sym = data.get("symbol", "")
                        if sym in self.symbols:
                            result[sym] = float(data.get("price", 0))
                    self._endpoint_idx = (self._endpoint_idx + attempt) % len(BINANCE_TICKER_URLS)
                    return result
                elif r.status_code in [418, 429]:
                    logger.debug(f"PriceStream rate limited on {url}, rotating endpoint")
                    continue
                else:
                    logger.debug(f"PriceStream {url} returned {r.status_code}")
            except Exception as e:
                logger.debug(f"PriceStream fetch from {url} failed: {e}")
                continue

        return {}

    def _process_update(self, prices: Dict[str, float]):
        """Process a batch of price updates: cache, detect crashes, fire callbacks."""
        with self._lock:
            self._prev_prices = dict(self._prices)
            self._prices.update(prices)
            self._last_update = time.time()

        # Flash crash detection
        for symbol, price in prices.items():
            prev = self._prev_prices.get(symbol)
            if prev and prev > 0 and price > 0:
                drop_pct = (prev - price) / prev
                if drop_pct >= self.flash_crash_pct:
                    logger.warning(
                        f"🚨 FLASH CRASH DETECTED: {symbol} dropped {drop_pct:.1%} "
                        f"({prev:.4f} → {price:.4f})"
                    )
                    for cb in self._crash_callbacks:
                        try:
                            cb(symbol, price, prev, drop_pct)
                        except Exception as e:
                            logger.error(f"Flash crash callback error: {e}")

        # Fire general callbacks
        for cb in self._callbacks:
            try:
                cb(prices)
            except Exception as e:
                logger.error(f"Price update callback error: {e}")

    def get_status(self) -> Dict:
        """Return stream status for monitoring."""
        return {
            "running": self._running,
            "symbols_tracked": len(self.symbols),
            "poll_interval": self.poll_interval,
            "last_update_age_s": round(self.last_update_age, 1),
            "cached_prices": len(self._prices),
            "error_count": self._error_count,
            "cooldown_active": time.time() < self._cooldown_until,
        }
