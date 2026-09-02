"""
engine/analysis/regime.py — Market regime detection.
Classifies market as: trending, ranging, expansion, compression, panic, euphoria.
Uses multi-timeframe data, ADX, BB width, RSI, price velocity.
"""

import logging
from typing import Dict, List, Optional
from .indicators import compute_all_indicators

logger = logging.getLogger(__name__)

REGIMES = ["trending_up", "trending_down", "ranging", "expansion", "compression", "panic", "euphoria", "unknown"]


class RegimeClassifier:
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.regime_config = self.config.get("regime", {})

    def classify(self, indicators_1d: Dict, indicators_4h: Dict,
                 indicators_1h: Dict, candles_1h: List[Dict] = None) -> Dict:
        """
        Multi-timeframe regime classification.
        Returns regime name, confidence, and component scores.
        """
        scores = {
            "trending": 0.0,
            "ranging": 0.0,
            "expansion": 0.0,
            "compression": 0.0,
            "panic": 0.0,
            "euphoria": 0.0
        }

        # ---- ADX-based trending/ranging ----
        adx_1d = indicators_1d.get("adx") or 0
        adx_4h = indicators_4h.get("adx") or 0
        adx_1h = indicators_1h.get("adx") or 0
        avg_adx = (adx_1d * 0.4 + adx_4h * 0.35 + adx_1h * 0.25)

        if avg_adx > self.regime_config.get("trending_adx_min", 25):
            scores["trending"] += min(avg_adx / 50, 1.0) * 0.5
        if avg_adx < self.regime_config.get("ranging_adx_max", 20):
            scores["ranging"] += (1 - avg_adx / 20) * 0.5

        # ---- EMA alignment for trend direction ----
        bullish_align_1d = indicators_1d.get("ema_aligned_bullish", False)
        bearish_align_1d = indicators_1d.get("ema_aligned_bearish", False)
        bullish_align_4h = indicators_4h.get("ema_aligned_bullish", False)

        if (bullish_align_1d or bullish_align_4h) and avg_adx > 20:
            scores["trending"] += 0.3
        if (bearish_align_1d) and avg_adx > 20:
            scores["trending"] += 0.3

        # ---- BB width for expansion/compression ----
        bb_width_1h = indicators_1h.get("bb_width") or 0
        bb_width_4h = indicators_4h.get("bb_width") or 0

        expansion_threshold = self.regime_config.get("expansion_bb_width_pct", 0.04)
        compression_threshold = self.regime_config.get("compression_bb_width_pct", 0.015)

        if bb_width_1h > expansion_threshold:
            scores["expansion"] += min(bb_width_1h / 0.08, 1.0) * 0.6
        if bb_width_1h < compression_threshold:
            scores["compression"] += (1 - bb_width_1h / compression_threshold) * 0.6

        # ---- RSI extremes for panic/euphoria ----
        rsi_1h = indicators_1h.get("rsi") or 50
        rsi_4h = indicators_4h.get("rsi") or 50
        rsi_1d = indicators_1d.get("rsi") or 50

        if rsi_1h < 20 and rsi_4h < 30:
            scores["panic"] += 0.7
        elif rsi_1h < 25:
            scores["panic"] += 0.4

        euphoria_rsi = self.regime_config.get("euphoria_rsi_min", 78)
        if rsi_1h > euphoria_rsi and rsi_4h > 70:
            scores["euphoria"] += 0.7
        elif rsi_1h > 75:
            scores["euphoria"] += 0.4

        # ---- Price velocity (panic detection) ----
        if candles_1h and len(candles_1h) >= 3:
            last_close = candles_1h[-1]["close"]
            prev_close = candles_1h[-3]["close"]
            pct_change = (last_close - prev_close) / prev_close if prev_close > 0 else 0
            panic_drop = self.regime_config.get("panic_drop_pct_1h", 0.04)
            if pct_change < -panic_drop:
                scores["panic"] += 0.5
            if pct_change > panic_drop * 1.5:
                scores["euphoria"] += 0.3

        # ---- Determine dominant regime ----
        dominant = max(scores, key=scores.get)
        confidence = min(scores[dominant], 1.0)

        # Refine: if trending + determine direction
        direction = "neutral"
        if dominant == "trending":
            pdi_avg = ((indicators_1d.get("pdi") or 0) * 0.4 +
                       (indicators_4h.get("pdi") or 0) * 0.35 +
                       (indicators_1h.get("pdi") or 0) * 0.25)
            mdi_avg = ((indicators_1d.get("mdi") or 0) * 0.4 +
                       (indicators_4h.get("mdi") or 0) * 0.35 +
                       (indicators_1h.get("mdi") or 0) * 0.25)
            direction = "up" if pdi_avg > mdi_avg else "down"
            dominant = f"trending_{direction}"

        # Risk rating per regime
        risk_map = {
            "trending_up": 0.3,
            "trending_down": 0.6,
            "ranging": 0.4,
            "expansion": 0.5,
            "compression": 0.3,
            "panic": 0.9,
            "euphoria": 0.8,
            "unknown": 0.5
        }

        regime_name = dominant if dominant in risk_map else "unknown"

        return {
            "regime": regime_name,
            "confidence": round(confidence, 3),
            "risk_level": risk_map.get(regime_name, 0.5),
            "scores": {k: round(v, 3) for k, v in scores.items()},
            "tradeable": regime_name in ["trending_up", "trending_down", "expansion", "compression"],
            "bias": "bullish" if "up" in regime_name else (
                "bearish" if "down" in regime_name or regime_name == "panic" else "neutral"
            ),
            "summary": self._describe(regime_name, confidence)
        }

    def _describe(self, regime: str, conf: float) -> str:
        descriptions = {
            "trending_up": f"Market in confirmed uptrend (conf={conf:.0%}). Favor long setups with trend.",
            "trending_down": f"Market in downtrend (conf={conf:.0%}). Reduce longs, watch for shorts.",
            "ranging": f"Market ranging/consolidating (conf={conf:.0%}). Trade range extremes only.",
            "expansion": f"Market expanding/breaking out (conf={conf:.0%}). Momentum setups active.",
            "compression": f"Market compressing/coiling (conf={conf:.0%}). Await breakout direction.",
            "panic": f"PANIC conditions detected (conf={conf:.0%}). High risk, reduce exposure.",
            "euphoria": f"EUPHORIA conditions (conf={conf:.0%}). Overbought, caution on longs.",
            "unknown": "Regime undetermined. Wait for clearer signal."
        }
        return descriptions.get(regime, "Unknown regime.")
