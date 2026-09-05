"""
engine/strategy/macro_tp.py — Macro Cycle Take-Profit Controller.

Evaluates macro conditions (Fear & Greed, distance from EMA200) to trigger
graduated portfolio-level take-profits (10% / 25% / 50%) with 7-day cooldowns.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Graduated TP tiers ordered from lightest to heaviest
MACRO_TP_TIERS = [
    {
        "name": "light",
        "sell_pct": 0.10,
        "min_fng": 75,
        "min_ema200_dist_pct": 20.0,
        "description": "Light TP: F&G >= 75, price >= 20% above EMA200",
    },
    {
        "name": "moderate",
        "sell_pct": 0.25,
        "min_fng": 82,
        "min_ema200_dist_pct": 35.0,
        "description": "Moderate TP: F&G >= 82, price >= 35% above EMA200",
    },
    {
        "name": "heavy",
        "sell_pct": 0.50,
        "min_fng": 90,
        "min_ema200_dist_pct": 50.0,
        "description": "Heavy TP: F&G >= 90, price >= 50% above EMA200",
    },
]

COOLDOWN_DAYS = 7


class MacroCycleTPController:
    """Checks macro euphoria conditions and decides if portfolio-level TP should fire."""

    def __init__(self, state: Dict):
        self.state = state
        self._tp_state = state.setdefault("macro_tp", {})

    def _last_trigger_dt(self, tier_name: str) -> Optional[datetime]:
        ts = self._tp_state.get(f"last_{tier_name}_trigger")
        if ts:
            try:
                return datetime.fromisoformat(ts)
            except (ValueError, TypeError):
                return None
        return None

    def _is_on_cooldown(self, tier_name: str) -> bool:
        last = self._last_trigger_dt(tier_name)
        if last is None:
            return False
        return datetime.utcnow() - last < timedelta(days=COOLDOWN_DAYS)

    def _record_trigger(self, tier_name: str):
        now_iso = datetime.utcnow().isoformat()
        self._tp_state[f"last_{tier_name}_trigger"] = now_iso
        self._tp_state["last_trigger"] = now_iso
        triggers = self._tp_state.setdefault("trigger_history", [])
        triggers.append({"tier": tier_name, "at": now_iso})
        # Keep last 50 entries
        if len(triggers) > 50:
            self._tp_state["trigger_history"] = triggers[-50:]

    def evaluate(self, fng_value: int, ema200_distance_pct: float) -> Dict:
        """
        Evaluate whether a macro TP should trigger.

        Args:
            fng_value: Fear & Greed index (0-100).
            ema200_distance_pct: Percent distance of current price above EMA200
                                 (e.g. 25.0 means price is 25% above EMA200).

        Returns:
            Dict with keys:
                trigger (bool): Whether any tier should fire.
                tier (str|None): Name of the triggered tier.
                sell_pct (float): Fraction of portfolio to sell (0.10 / 0.25 / 0.50).
                reason (str): Human-readable explanation.
                cooldowns (dict): Remaining cooldown info per tier.
        """
        cooldowns = {}
        for tier in MACRO_TP_TIERS:
            name = tier["name"]
            last = self._last_trigger_dt(name)
            if last:
                remaining = timedelta(days=COOLDOWN_DAYS) - (datetime.utcnow() - last)
                cooldowns[name] = max(remaining.total_seconds(), 0)
            else:
                cooldowns[name] = 0

        # Evaluate from heaviest to lightest — only trigger the highest qualifying tier
        for tier in reversed(MACRO_TP_TIERS):
            name = tier["name"]
            if self._is_on_cooldown(name):
                continue
            if fng_value >= tier["min_fng"] and ema200_distance_pct >= tier["min_ema200_dist_pct"]:
                self._record_trigger(name)
                logger.info(
                    f"🎯 MACRO TP [{name.upper()}] triggered: "
                    f"F&G={fng_value}, EMA200 dist={ema200_distance_pct:.1f}%, "
                    f"sell {tier['sell_pct']:.0%} of portfolio"
                )
                return {
                    "trigger": True,
                    "tier": name,
                    "sell_pct": tier["sell_pct"],
                    "reason": tier["description"],
                    "fng": fng_value,
                    "ema200_distance_pct": round(ema200_distance_pct, 2),
                    "cooldowns": cooldowns,
                }

        return {
            "trigger": False,
            "tier": None,
            "sell_pct": 0,
            "reason": f"No macro TP conditions met (F&G={fng_value}, EMA200 dist={ema200_distance_pct:.1f}%)",
            "cooldowns": cooldowns,
        }
