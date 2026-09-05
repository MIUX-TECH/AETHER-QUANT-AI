"""
engine/strategy/halving_cycle.py — BTC Halving Cycle Strategy.

Adjusts macro strategy weights, allocations, and risk settings based on 
the estimated position within the Bitcoin halving cycle.
"""

import logging
from datetime import datetime
from typing import Dict, Tuple

logger = logging.getLogger(__name__)

class HalvingCycleManager:
    def __init__(self):
        # Estimates for halving blocks/dates
        # 4th Halving was ~April 2024
        # 5th Halving estimated ~April 2028
        self.next_halving_target = datetime(2028, 4, 15)
        self.last_halving = datetime(2024, 4, 19)

    def determine_phase(self, current_time: datetime = None) -> Tuple[str, str]:
        """
        Determine the current phase in the 4-year halving cycle.
        
        Phases:
        1. Pre-Halving (-18 to -6 months)
        2. Halving Zone (-6 to +3 months) 
        3. Post-Halving Rally (+3 to +18 months)
        4. Cycle Peak / Bear (+18 to +30 months)
        """
        if current_time is None:
            current_time = datetime.utcnow()
            
        months_to_halving = (self.next_halving_target.year - current_time.year) * 12 + (self.next_halving_target.month - current_time.month)
        
        if 6 < months_to_halving <= 18:
            return "pre_halving", "Pre-Halving Accumulation"
        elif -3 <= months_to_halving <= 6:
            return "halving_zone", "Halving Zone / Chop"
        elif -18 <= months_to_halving < -3:
            return "post_halving_rally", "Post-Halving Rally"
        else:
            return "cycle_peak", "Cycle Peak / Distribution"

    def get_cycle_adjustments(self) -> Dict:
        """Get strategy adjustments based on the current cycle phase."""
        phase, _ = self.determine_phase()
        
        adjustments = {
            "phase": phase,
            "grid_interval_hours": 24,
            "altcoin_alloc_pct": 30,
            "cash_reserve_pct": 20,
            "macro_tp_active": False
        }
        
        if phase == "pre_halving":
            adjustments["grid_interval_hours"] = 12
            adjustments["altcoin_alloc_pct"] = 30
            adjustments["cash_reserve_pct"] = 15
        elif phase == "halving_zone":
            adjustments["grid_interval_hours"] = 6
            adjustments["altcoin_alloc_pct"] = 20
            adjustments["cash_reserve_pct"] = 15
        elif phase == "post_halving_rally":
            adjustments["grid_interval_hours"] = 24
            adjustments["altcoin_alloc_pct"] = 50
            adjustments["cash_reserve_pct"] = 10
            adjustments["macro_tp_active"] = True
        elif phase == "cycle_peak":
            # Pause DCA, build cash
            adjustments["grid_interval_hours"] = 999 
            adjustments["altcoin_alloc_pct"] = 0
            adjustments["cash_reserve_pct"] = 40
            adjustments["macro_tp_active"] = True
            
        return adjustments
