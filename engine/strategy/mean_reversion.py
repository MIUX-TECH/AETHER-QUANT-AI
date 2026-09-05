"""
engine/strategy/mean_reversion.py — Mean Reversion Strategy.

A strategy to profit from overextended assets (too far from their mean).
Targeting quick reversions to the Bollinger Middle Band (SMA20).
"""

import logging
from typing import Dict

logger = logging.getLogger(__name__)

class MeanReversionStrategy:
    """Mean Reversion evaluation logic."""
    
    @staticmethod
    def evaluate(indicators: Dict, fng_value: int, regime: str) -> Dict:
        """
        Evaluate mean reversion conditions for an asset.
        
        Args:
            indicators: Dict of computed indicators for the asset (needs RSI, BB, EMA200, Volume)
            fng_value: Fear & Greed index
            regime: Current market regime (e.g. 'ranging', 'compression')
        """
        result = {"trigger": False, "side": None, "reason": ""}
        
        # Safe extraction of indicators
        try:
            rsi = indicators.get("rsi", [None])[-1]
            bb_lower = indicators.get("bb_lower", [None])[-1]
            bb_upper = indicators.get("bb_upper", [None])[-1]
            bb_mid = indicators.get("bb_mid", [None])[-1]
            ema200 = indicators.get("ema", {}).get("200", [None])[-1]
            close = indicators.get("close", [None])[-1]
            vol = indicators.get("volume", [None])[-1]
            sma20_vol = indicators.get("volume_sma20", [None])[-1]
        except (IndexError, TypeError):
            return result
            
        if None in (rsi, bb_lower, bb_upper, bb_mid, ema200, close, vol, sma20_vol):
            return result

        # Mean Reversion LONG Conditions
        if (
            rsi < 30 and 
            close < bb_lower and 
            close > ema200 and 
            vol > (1.5 * sma20_vol) and 
            fng_value < 45 and 
            regime in ["ranging", "compression"]
        ):
            return {
                "trigger": True,
                "side": "LONG",
                "strategy": "mean_reversion",
                "target": bb_mid,
                "reason": "Oversold, below BB lower, above EMA200, volume spike, suitable regime."
            }

        # Mean Reversion SHORT Conditions
        if (
            rsi > 70 and 
            close > bb_upper and 
            vol < sma20_vol and 
            fng_value > 65 and 
            regime in ["ranging", "expansion"]
        ):
            return {
                "trigger": True,
                "side": "SHORT",
                "strategy": "mean_reversion",
                "target": bb_mid,
                "reason": "Overbought, above BB upper, declining volume, greed territory."
            }
            
        return result
