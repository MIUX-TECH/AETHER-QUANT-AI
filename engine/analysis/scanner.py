"""
engine/analysis/scanner.py — Market Scanner.
Orchestrates full analysis for each symbol: fetch data → indicators → regime → score.
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime

from .market_data import MarketDataService
from .indicators import compute_all_indicators
from .regime import RegimeClassifier
from .scoring import ScoringEngine
from ..risk.entry_filter import EntryFilter

logger = logging.getLogger(__name__)


class MarketScanner:
    def __init__(self, market_data: MarketDataService,
                 config: Dict = None, memory: Dict = None, state: Dict = None):
        self.market_data = market_data
        self.config = config or {}
        self.memory = memory or {}
        self.state = state or {}
        self.regime_classifier = RegimeClassifier(config)
        self.scoring_engine = ScoringEngine(config, memory.get("portfolio_memory", {}))
        self.entry_filter = EntryFilter()
        self.scan_config = config.get("scanner", {})
        self.indicator_config = config.get("indicators", {})
        self.timeframes = self.scan_config.get("timeframes", ["5m", "15m", "1h", "4h", "1d"])
        self.lookback = self.scan_config.get("lookback_candles", 200)

    def scan_symbol(self, symbol: str, sentiment_score: float = 0.5,
                    coin_memory: Dict = None) -> Optional[Dict]:
        """
        Full analysis pipeline for one symbol.
        Returns rich analysis dict or None on failure.
        """
        try:
            logger.info(f"Scanning {symbol}...")

            # 1. Fetch candles for all timeframes
            candles_by_tf = self.market_data.get_multi_timeframe(
                symbol, self.timeframes, self.lookback
            )
            if not candles_by_tf:
                logger.warning(f"No candle data for {symbol}")
                return self._empty_result(symbol, "No data")

            # 2. Compute indicators for each timeframe
            indicators_by_tf = {}
            for tf, candles in candles_by_tf.items():
                if len(candles) < 30:
                    continue
                try:
                    # Filter out candles with zero/invalid prices to prevent ZeroDivisionError
                    valid_candles = [c for c in candles if c.get("close", 0) > 0 and c.get("high", 0) > 0]
                    if len(valid_candles) < 30:
                        logger.warning(f"Insufficient valid candles for {symbol} {tf}: {len(valid_candles)}")
                        continue
                    indicators_by_tf[tf] = compute_all_indicators(valid_candles, self.indicator_config)
                except ZeroDivisionError:
                    logger.warning(f"ZeroDivisionError computing indicators for {symbol} {tf} — skipping timeframe")
                except Exception as e:
                    logger.error(f"Indicator error {symbol} {tf}: {e}")

            if not indicators_by_tf:
                return self._empty_result(symbol, "Indicator computation failed")

            # 3. Get current ticker for extra info
            ticker = self.market_data.get_ticker(symbol)
            current_price = indicators_by_tf.get("1h", indicators_by_tf.get("4h", {})).get("price", 0)
            if ticker:
                current_price = float(ticker.get("lastPrice", current_price))

            # Normalize TF keys to match regime/scoring expectations
            ind_1d = indicators_by_tf.get("1d", {})
            ind_4h = indicators_by_tf.get("4h", {})
            ind_1h = indicators_by_tf.get("1h", {})
            candles_1h = candles_by_tf.get("1h", [])

            # 4. Regime classification
            regime = self.regime_classifier.classify(ind_1d, ind_4h, ind_1h, candles_1h)

            # 5. AI Score
            score_result = self.scoring_engine.score_asset(
                symbol, indicators_by_tf, regime,
                sentiment_score=sentiment_score,
                coin_memory=coin_memory
            )

            # 5b. Advanced Entry Filter (ported from aitrade)
            filter_meta = self.entry_filter.assess(score_result, self.state, self.config, strategy_target="spot")
            score_result = {**score_result, **filter_meta}

            # 6. Compute volatility metrics
            atr_1h = ind_1h.get("atr_pct", 0) or 0
            price_change_24h = float(ticker.get("priceChangePercent", 0)) / 100 if ticker else 0

            # 7. Support/Resistance from best TF
            sr = ind_1h.get("support_resistance", {})

            # 8. Summary
            return {
                "symbol": symbol,
                "timestamp": datetime.utcnow().isoformat(),
                "price": current_price,
                "price_change_24h": price_change_24h,
                "volume_24h": float(ticker.get("volume", 0)) if ticker else 0,
                "quote_volume_24h": float(ticker.get("quoteVolume", 0)) if ticker else 0,
                "high_24h": float(ticker.get("highPrice", 0)) if ticker else 0,
                "low_24h": float(ticker.get("lowPrice", 0)) if ticker else 0,
                "regime": regime,
                "indicators": {
                    tf: {
                        "price": ind.get("price"),
                        "rsi": ind.get("rsi"),
                        "macd_hist": ind.get("macd_hist"),
                        "adx": ind.get("adx"),
                        "ema9": ind.get("ema9"),
                        "ema21": ind.get("ema21"),
                        "ema50": ind.get("ema50"),
                        "ema200": ind.get("ema200"),
                        "atr_pct": ind.get("atr_pct"),
                        "bb_width": ind.get("bb_width"),
                        "volume": ind.get("volume"),
                        "candle_patterns": ind.get("candle_patterns"),
                        "market_structure": ind.get("market_structure"),
                        "ema_aligned_bullish": ind.get("ema_aligned_bullish"),
                        "ema_aligned_bearish": ind.get("ema_aligned_bearish"),
                    }
                    for tf, ind in indicators_by_tf.items()
                },
                "support_resistance": sr,
                "score": score_result,
                "volatility_pct": atr_1h,
                "sentiment_score": sentiment_score,
                "scan_status": "ok"
            }

        except Exception as e:
            logger.error(f"Scan failed for {symbol}: {e}", exc_info=True)
            return self._empty_result(symbol, str(e))

    def scan_all(self, symbols: List[str], sentiment_scores: Dict[str, float] = None,
                 coin_memories: Dict[str, Dict] = None) -> Dict[str, Dict]:
        """Scan multiple symbols and return results dict."""
        results = {}
        sentiment_scores = sentiment_scores or {}
        coin_memories = coin_memories or {}

        import time
        for symbol in symbols:
            sentiment = sentiment_scores.get(symbol, 0.5)
            memory = coin_memories.get(symbol, {})
            result = self.scan_symbol(symbol, sentiment, memory)
            if result:
                results[symbol] = result
            else:
                results[symbol] = self._empty_result(symbol, "Scan returned None")
            time.sleep(0.15)

        logger.info(f"Scan complete: {len(results)} symbols processed")
        return results

    def get_ranked_signals(self, scan_results: Dict[str, Dict]) -> List[Dict]:
        """Return symbols sorted by confidence score, actionable ones first."""
        ranked = []
        for symbol, result in scan_results.items():
            score = result.get("score", {})
            ranked.append({
                "symbol": symbol,
                "signal": score.get("signal", "WAIT"),
                "confidence": score.get("confidence", 0),
                "regime": result.get("regime", {}).get("regime", "unknown"),
                "price": result.get("price", 0),
                "price_change_24h": result.get("price_change_24h", 0),
                "action_allowed": score.get("action_allowed", False),
            })
        ranked.sort(key=lambda x: x["confidence"], reverse=True)
        return ranked

    def _empty_result(self, symbol: str, reason: str) -> Dict:
        return {
            "symbol": symbol,
            "timestamp": datetime.utcnow().isoformat(),
            "price": 0,
            "regime": {"regime": "unknown", "confidence": 0},
            "score": {"signal": "WAIT", "confidence": 0, "action_allowed": False},
            "scan_status": "error",
            "error": reason
        }
