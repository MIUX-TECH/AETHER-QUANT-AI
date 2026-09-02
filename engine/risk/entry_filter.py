"""
engine/risk/entry_filter.py — Advanced entry filter logic ported & adapted
from aitrade's sophisticated filters (compression regime, fee edge, cooldown, directional exposure).
Integrated into the cleaner engine architecture.
"""

import logging
from typing import Dict

logger = logging.getLogger(__name__)


class EntryFilter:
    """Advanced pre-trade filter to improve entry quality."""

    def assess(self, decision: Dict, state: Dict, config: Dict, strategy_target: str = "spot") -> Dict:
        reasons = []
        score = 100.0

        regime = decision.get("regime", "") or decision.get("regime", {}).get("regime", "")
        if isinstance(regime, dict):
            regime = regime.get("regime", "")

        action = decision.get("action") or decision.get("score", {}).get("action", "HOLD")
        confidence = float(decision.get("confidence", decision.get("score", {}).get("confidence", 50) or 50))

        breakdown = decision.get("score_breakdown", {}) or decision.get("indicators", {}).get("1h", {})
        cooldown_level = state.get("cooldown_level") or state.get("risk", {}).get("cooldown_level", "none")
        open_positions = state.get("positions", {}).get("spot", {}) or state.get("open_positions", [])
        if isinstance(open_positions, dict):
            open_positions = list(open_positions.values())

        open_positions = [p for p in open_positions if p.get("status", "open") == "open"]

        category = decision.get("category", "alt")
        if "meme" in decision.get("symbol", "").lower() or decision.get("symbol", "") in ["PEPEUSDT", "DOGEUSDT", "WIFUSDT", "BONKUSDT", "FLOKIUSDT"]:
            category = "meme"

        # Regime filters
        if "compression" in regime.lower():
            score -= 20
            reasons.append("Compression regime - wait for expansion")

        vol = breakdown.get("volume", 0) or breakdown.get("volume_ratio", 1)
        if vol <= 0.7:
            score -= 8
            reasons.append("Weak volume")

        # Action specific
        if action == "SHORT" and confidence < 68:
            score -= 15
            reasons.append("Short edge insufficient")

        if action in ["BUY", "STRONG_BUY"] and "bear" in regime.lower() and confidence < 75:
            score -= 15
            reasons.append("Long against bear regime")

        if action in ["BUY", "STRONG_BUY"] and category == "meme" and "bear" in regime.lower():
            score -= 25
            reasons.append("Meme coins restricted in bear regime")

        # Cooldown handling
        if cooldown_level == "soft":
            score -= 10
            reasons.append("Soft cooldown active")
        if cooldown_level == "hard" and not strategy_target.startswith("btc"):
            score = min(score, 30)
            reasons.append("Hard cooldown - only BTC core allowed")

        # Directional exposure
        side = "short" if action == "SHORT" else "long"
        same_dir = [p for p in open_positions if p.get("side") == side]
        if len(same_dir) >= 3:
            score -= 18
            reasons.append("Too many same-direction positions")

        # Fee edge check (simplified)
        price = float(decision.get("price", 0) or 0)
        if price > 0 and action in ["BUY", "STRONG_BUY", "SHORT"]:
            atr_pct = float(decision.get("indicators", {}).get("1h", {}).get("atr_pct", 0.01) or 0.01)
            tp_estimate = max(0.015, atr_pct * 2.5)
            edge = tp_estimate * (1 if "spot" in strategy_target else 2.5)
            round_trip_fee = 0.002  # approx 0.1% spot + taker
            if edge < round_trip_fee * 1.8:
                score -= 20
                reasons.append("Expected edge too thin vs fees")

        passed = score >= 58
        return {
            "entry_quality": round(max(0, min(100, score)), 1),
            "filter_reasons": reasons,
            "filter_status": "passed" if passed else "blocked",
            "adjusted_confidence": min(100, confidence * (score / 100) if score > 0 else 0),
        }
