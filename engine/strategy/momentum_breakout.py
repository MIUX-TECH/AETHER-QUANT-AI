"""
engine/strategy/momentum_breakout.py — Momentum Breakout Strategy.

Catches breakouts confirmed by large volume surges, OBV, and SuperTrend.
"""

import logging
from typing import Dict

logger = logging.getLogger(__name__)

class MomentumBreakoutStrategy:
    """Momentum Breakout evaluation logic."""
    
    @staticmethod
    def evaluate(indicators: Dict, structure: Dict) -> Dict:
        """
        Evaluate momentum breakout conditions.
        
        Args:
            indicators: Dict of computed indicators
            structure: Market structure dict (support/resistance levels)
        """
        result = {"trigger": False, "side": None, "reason": ""}
        
        try:
            close = indicators.get("close", [None])[-1]
            vol = indicators.get("volume", [None])[-1]
            sma20_vol = indicators.get("volume_sma20", [None])[-1]
            obv_trend = indicators.get("obv_trend", "flat")
            adx = indicators.get("adx", [None])[-1]
            supertrend_dir = indicators.get("supertrend_dir", [None])[-1]
            rsi = indicators.get("rsi", [None])[-1]
            taker_buy_ratio = indicators.get("taker_buy_ratio", [None])[-1] or 0.5
            
            resistances = structure.get("resistances", [])
        except (IndexError, TypeError, AttributeError):
            return result
            
        if None in (close, vol, sma20_vol, adx, supertrend_dir, rsi):
            return result
            
        nearest_res = min([r for r in resistances if r > close], default=None)
        if not nearest_res:
            # Need a resistance reference
            return result
            
        # Is price breaking out? (very close to or just broke resistance)
        breaking_out = (close >= nearest_res * 0.99)
        
        # Momentum Breakout LONG Conditions
        if (
            breaking_out and
            vol > (2.5 * sma20_vol) and
            obv_trend == "up" and
            adx > 25 and
            supertrend_dir == "bullish" and
            50 <= rsi <= 70 and
            taker_buy_ratio > 0.60
        ):
            return {
                "trigger": True,
                "side": "LONG",
                "strategy": "momentum_breakout",
                "reason": "Breaking resistance with massive volume, rising OBV, strong ADX and bullish SuperTrend."
            }
            
        return result
