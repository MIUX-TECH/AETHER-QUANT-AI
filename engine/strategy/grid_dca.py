"""
engine/strategy/grid_dca.py — Grid DCA Vault Strategy.

Accumulates BTC over time using a grid DCA strategy, completely separate from active trading.
Buys more when the price drops according to a defined grid.
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class GridDCAVault:
    def __init__(self, state: Dict, config: Dict):
        self.state = state
        self.config = config
        self._dca_state = state.setdefault("grid_dca", {})
        
        # Grid definition: drop percentage -> buy amount (USDT)
        self.grid_levels = {
            0.0: 20,   # Base interval purchase
            5.0: 30,   # -5% drop
            10.0: 50,  # -10% drop
            15.0: 80,  # -15% drop
            20.0: 120  # -20% drop
        }

    def evaluate(self, current_price: float, ath_price: float, is_paused: bool = False) -> Dict:
        """
        Evaluate if Grid DCA should trigger.
        """
        if is_paused:
            return {"trigger": False, "reason": "Grid DCA is paused (e.g. Extreme Greed)"}
            
        drop_pct = 0.0
        if ath_price > 0:
            drop_pct = max(0.0, (1.0 - current_price / ath_price) * 100.0)

        # Find applicable grid level
        applicable_drop = 0.0
        for level in sorted(self.grid_levels.keys(), reverse=True):
            if drop_pct >= level:
                applicable_drop = level
                break
                
        amount = self.grid_levels[applicable_drop]
        
        return {
            "trigger": True,
            "buy_amount_usdt": amount,
            "drop_pct": drop_pct,
            "grid_level": applicable_drop,
            "reason": f"Grid DCA trigger: drop={drop_pct:.1f}% -> buy ${amount}"
        }
