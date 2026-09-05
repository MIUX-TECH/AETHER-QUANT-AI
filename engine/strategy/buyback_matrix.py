"""
engine/strategy/buyback_matrix.py — Buyback Matrix.

Evaluates deep-fear / deep-discount conditions for graduated re-entry:
  - Fear & Greed < 20   (Extreme Fear)
  - Drop from ATH tiers (30%, 50%, 70%)
  - Price below EMA200

Returns a buyback signal with suggested allocation size.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Buyback tiers — ordered lightest to heaviest
BUYBACK_TIERS = [
    {
        "name": "nibble",
        "deploy_pct": 0.10,
        "max_fng": 20,
        "min_ath_drop_pct": 30.0,
        "description": "Nibble buy: F&G <= 20, >= 30% below ATH",
    },
    {
        "name": "accumulate",
        "deploy_pct": 0.20,
        "max_fng": 15,
        "min_ath_drop_pct": 50.0,
        "description": "Accumulate: F&G <= 15, >= 50% below ATH",
    },
    {
        "name": "aggressive",
        "deploy_pct": 0.35,
        "max_fng": 10,
        "min_ath_drop_pct": 70.0,
        "description": "Aggressive buy: F&G <= 10, >= 70% below ATH",
    },
]

COOLDOWN_DAYS = 7


class BuybackMatrix:
    """Evaluates extreme-fear and deep-discount conditions for graduated re-entry."""

    def __init__(self, state: Dict):
        self.state = state
        self._bb_state = state.setdefault("buyback_matrix", {})

    def _last_trigger_dt(self, tier_name: str) -> Optional[datetime]:
        ts = self._bb_state.get(f"last_{tier_name}_trigger")
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
        self._bb_state[f"last_{tier_name}_trigger"] = now_iso
        self._bb_state["last_trigger"] = now_iso
        triggers = self._bb_state.setdefault("trigger_history", [])
        triggers.append({"tier": tier_name, "at": now_iso})
        if len(triggers) > 50:
            self._bb_state["trigger_history"] = triggers[-50:]

    @staticmethod
    def calc_ath_drop_pct(current_price: float, ath_price: float) -> float:
        """Percentage drop from ATH (returns positive number, e.g. 40.0 = 40% below ATH)."""
        if ath_price <= 0 or current_price <= 0:
            return 0.0
        return max(0.0, (1.0 - current_price / ath_price) * 100.0)

    def evaluate(
        self,
        fng_value: int,
        current_price: float,
        ath_price: float,
        ema200: Optional[float] = None,
    ) -> Dict:
        """
        Evaluate buyback conditions.

        Args:
            fng_value: Fear & Greed index (0-100).
            current_price: Current BTC (or reference asset) price.
            ath_price: All-time-high price of the reference asset.
            ema200: EMA-200 value (optional, adds confluence bonus).

        Returns:
            Dict with keys:
                trigger (bool), tier (str|None), deploy_pct (float),
                reason (str), ath_drop_pct (float), below_ema200 (bool),
                cooldowns (dict).
        """
        ath_drop = self.calc_ath_drop_pct(current_price, ath_price)
        below_ema200 = (ema200 is not None and ema200 > 0 and current_price < ema200)

        cooldowns = {}
        for tier in BUYBACK_TIERS:
            name = tier["name"]
            last = self._last_trigger_dt(name)
            if last:
                remaining = timedelta(days=COOLDOWN_DAYS) - (datetime.utcnow() - last)
                cooldowns[name] = max(remaining.total_seconds(), 0)
            else:
                cooldowns[name] = 0

        # Evaluate from heaviest to lightest
        for tier in reversed(BUYBACK_TIERS):
            name = tier["name"]
            if self._is_on_cooldown(name):
                continue
            if fng_value <= tier["max_fng"] and ath_drop >= tier["min_ath_drop_pct"]:
                deploy = tier["deploy_pct"]
                # Confluence bonus: price also below EMA200 → +5% extra allocation
                if below_ema200:
                    deploy = min(deploy + 0.05, 0.50)

                self._record_trigger(name)
                logger.info(
                    f"💰 BUYBACK [{name.upper()}] triggered: "
                    f"F&G={fng_value}, ATH drop={ath_drop:.1f}%, "
                    f"below_EMA200={below_ema200}, deploy={deploy:.0%}"
                )
                return {
                    "trigger": True,
                    "tier": name,
                    "deploy_pct": deploy,
                    "reason": tier["description"],
                    "fng": fng_value,
                    "ath_drop_pct": round(ath_drop, 2),
                    "below_ema200": below_ema200,
                    "cooldowns": cooldowns,
                }

        return {
            "trigger": False,
            "tier": None,
            "deploy_pct": 0,
            "reason": f"No buyback conditions met (F&G={fng_value}, ATH drop={ath_drop:.1f}%)",
            "ath_drop_pct": round(ath_drop, 2),
            "below_ema200": below_ema200,
            "cooldowns": cooldowns,
        }
