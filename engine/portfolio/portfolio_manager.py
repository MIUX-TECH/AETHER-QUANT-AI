"""
engine/portfolio/portfolio_manager.py — Portfolio management engine.
Manages allocations, rebalancing, compounding, exposure control.
"""

import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class PortfolioManager:
    def __init__(self, config: Dict, state: Dict, memory: Dict = None):
        self.config = config
        self.state = state
        self.memory = memory or {}
        self.port_cfg = config.get("portfolio", {})
        self.risk_cfg = config.get("risk", {})

    def get_allocations(self) -> Dict:
        """Calculate target allocations based on config and market conditions."""
        total = self.state["portfolio"]["total_equity"]
        spot_pct = self.port_cfg["spot_allocation_pct"]
        futures_pct = self.port_cfg["futures_allocation_pct"]
        cash_reserve = self.port_cfg.get("cash_reserve_pct", 0.05)

        # Reduce allocations if risk-off
        risk_state = self.state.get("risk", {})
        if risk_state.get("risk_off_active"):
            spot_pct *= 0.7
            futures_pct *= 0.3
            cash_reserve = max(cash_reserve, 0.20)
        if risk_state.get("capital_preservation_mode"):
            spot_pct *= 0.5
            futures_pct = 0
            cash_reserve = 0.40

        spot_budget = total * spot_pct
        futures_budget = total * futures_pct
        cash_budget = total * cash_reserve

        btc_pct = self.port_cfg.get("spot_btc_pct", 0.70)
        alt_pct = self.port_cfg.get("spot_altcoin_pct", 0.30)

        return {
            "total": total,
            "spot_budget": round(spot_budget, 2),
            "futures_budget": round(futures_budget, 2),
            "cash_reserve": round(cash_budget, 2),
            "btc_budget": round(spot_budget * btc_pct, 2),
            "altcoin_budget": round(spot_budget * alt_pct, 2),
            "spot_pct": spot_pct,
            "futures_pct": futures_pct,
            "cash_pct": cash_reserve,
        }

    def get_available_for_trade(self, trade_type: str = "spot",
                                 symbol: str = "BTCUSDT") -> float:
        """How much USDT is available for a new trade."""
        allocations = self.get_allocations()
        positions = self.state.get("positions", {})
        spot_positions = positions.get("spot", {})
        futures_positions = positions.get("futures", {})

        if trade_type == "spot":
            budget = allocations["btc_budget"] if "BTC" in symbol else allocations["altcoin_budget"]
            # Subtract existing position size if any
            if symbol in spot_positions:
                existing = spot_positions[symbol].get("position_usdt", 0)
                budget = max(0, budget - existing)
            return budget

        elif trade_type == "futures":
            budget = allocations["futures_budget"]
            total_futures_used = sum(p.get("margin_used", 0) for p in futures_positions.values())
            return max(0, budget - total_futures_used)

        return 0

    def should_rebalance(self) -> Tuple[bool, str]:
        """Check if portfolio needs rebalancing."""
        positions = self.state.get("positions", {}).get("spot", {})
        allocations = self.get_allocations()
        total = allocations["total"]
        if total <= 0:
            return False, "No equity"

        threshold = self.port_cfg.get("rebalance_threshold_pct", 0.05)

        # Check BTC allocation
        btc_pos = positions.get("BTCUSDT", {})
        btc_value = btc_pos.get("current_value", 0)
        btc_target = allocations["btc_budget"]
        if btc_value > 0 and abs(btc_value - btc_target) / total > threshold:
            return True, f"BTC allocation drift: {btc_value:.0f} vs target {btc_target:.0f}"

        # Check total spot exposure
        total_spot = sum(p.get("current_value", 0) for p in positions.values())
        spot_target = allocations["spot_budget"]
        if abs(total_spot - spot_target) / total > threshold * 2:
            return True, f"Spot exposure drift: {total_spot:.0f} vs target {spot_target:.0f}"

        return False, "Allocation within tolerance"

    def compute_compounding(self, equity: float, peak_equity: float) -> Dict:
        """Compute compounding adjustments based on equity growth."""
        initial = self.port_cfg.get("total_capital_usdt", 1000)
        growth_pct = (equity - initial) / initial if initial > 0 else 0
        threshold = self.port_cfg.get("compounding_threshold_pct", 0.10)

        if growth_pct > threshold and self.port_cfg.get("compounding_enabled", True):
            # Compound by increasing position sizes proportionally
            compound_factor = 1 + (growth_pct * 0.5)
            return {
                "apply": True,
                "factor": round(compound_factor, 4),
                "growth_pct": round(growth_pct, 4),
                "message": f"Compounding active: {growth_pct:.1%} growth → {compound_factor:.2f}x sizing"
            }
        return {"apply": False, "factor": 1.0, "growth_pct": growth_pct}

    def open_position(self, symbol: str, side: str, trade_type: str,
                       order_result: Dict, sizing: Dict, signal: Dict) -> Dict:
        """Record opening a position in state."""
        position = {
            "symbol": symbol,
            "side": side,
            "trade_type": trade_type,
            "entry_price": order_result.get("price", 0),
            "qty": order_result.get("executedQty", 0),
            "position_usdt": sizing.get("position_usdt", 0),
            "sl_price": sizing.get("sl_price", 0),
            "tp_price": sizing.get("tp_price", 0),
            "trailing_stop_pct": sizing.get("trailing_stop_pct", 0),
            "trailing_stop_price": None,
            "leverage": sizing.get("leverage", 1),
            "margin_used": sizing.get("position_usdt", 0) / max(sizing.get("leverage", 1), 1),
            "fee": order_result.get("fee", 0),
            "opened_at": datetime.utcnow().isoformat(),
            "current_price": order_result.get("price", 0),
            "current_value": sizing.get("position_usdt", 0),
            "unrealized_pnl": 0,
            "unrealized_pnl_pct": 0,
            "signal": signal.get("signal", ""),
            "confidence": signal.get("confidence", 0),
            "strategy": signal.get("strategy", "ai_signal"),
            "regime": signal.get("regime", {}).get("regime", "unknown"),
            "order_id": order_result.get("orderId", ""),
            "status": "active",
            "partial_tp_taken": False,
            "highest_price": order_result.get("price", 0),
        }
        return position

    def update_position_pnl(self, position: Dict, current_price: float) -> Dict:
        """Update position with current price and calculate PnL."""
        entry = position.get("entry_price", 0)
        qty = position.get("qty", 0)
        side = position.get("side", "BUY")
        leverage = position.get("leverage", 1)

        if entry <= 0 or qty <= 0:
            return position

        if side == "BUY":
            pnl_pct = (current_price - entry) / entry
        else:
            pnl_pct = (entry - current_price) / entry

        pnl_usdt = pnl_pct * position.get("position_usdt", 0) * leverage
        current_value = position.get("position_usdt", 0) + pnl_usdt

        # Update trailing stop
        if side == "BUY":
            position["highest_price"] = max(position.get("highest_price", entry), current_price)
            trail_pct = position.get("trailing_stop_pct", 0.02)
            if trail_pct > 0:
                new_trail = position["highest_price"] * (1 - trail_pct)
                old_trail = position.get("trailing_stop_price")
                if old_trail is None or new_trail > old_trail:
                    position["trailing_stop_price"] = new_trail

        position.update({
            "current_price": current_price,
            "current_value": round(current_value, 2),
            "unrealized_pnl": round(pnl_usdt, 2),
            "unrealized_pnl_pct": round(pnl_pct * 100, 3),
        })
        return position

    def check_exit_conditions(self, position: Dict, current_price: float) -> Tuple[bool, str]:
        """Check if position should be closed."""
        entry = position.get("entry_price", 0)
        side = position.get("side", "BUY")
        sl = position.get("sl_price", 0)
        tp = position.get("tp_price", 0)
        trail = position.get("trailing_stop_price")

        if side == "BUY":
            if sl > 0 and current_price <= sl:
                return True, "stop_loss"
            if tp > 0 and current_price >= tp:
                return True, "take_profit"
            if trail and current_price <= trail:
                return True, "trailing_stop"
        else:
            if sl > 0 and current_price >= sl:
                return True, "stop_loss"
            if tp > 0 and current_price <= tp:
                return True, "take_profit"

        return False, "hold"

    def check_partial_tp(self, position: Dict, current_price: float) -> bool:
        """Check if partial TP should be taken."""
        if position.get("partial_tp_taken"):
            return False
        entry = position.get("entry_price", 0)
        tp = position.get("tp_price", 0)
        rr = self.config.get("spot", {}).get("partial_tp_at_rr", 1.5)
        sl = position.get("sl_price", 0)
        if entry <= 0 or sl <= 0:
            return False
        risk = entry - sl
        partial_target = entry + risk * rr
        return current_price >= partial_target and not position.get("partial_tp_taken")

    def close_position(self, position: Dict, close_price: float, reason: str) -> Dict:
        """Create a closed trade record."""
        entry = position.get("entry_price", 0)
        side = position.get("side", "BUY")

        if side == "BUY":
            pnl_pct = (close_price - entry) / entry if entry > 0 else 0
        else:
            pnl_pct = (entry - close_price) / entry if entry > 0 else 0

        leverage = position.get("leverage", 1)
        pnl_usdt = pnl_pct * position.get("position_usdt", 0) * leverage
        fee = position.get("fee", 0)
        net_pnl = pnl_usdt - fee

        opened_at = position.get("opened_at", datetime.utcnow().isoformat())
        closed_at = datetime.utcnow().isoformat()
        try:
            from datetime import timedelta
            open_dt = datetime.fromisoformat(opened_at)
            close_dt = datetime.fromisoformat(closed_at)
            hold_duration = str(close_dt - open_dt)
        except Exception:
            hold_duration = "unknown"

        return {
            **position,
            "close_price": close_price,
            "pnl_usdt": round(net_pnl, 2),
            "pnl_pct": round(pnl_pct * 100, 3),
            "gross_pnl": round(pnl_usdt, 2),
            "fee_total": round(fee * 2, 4),
            "close_reason": reason,
            "closed_at": closed_at,
            "hold_duration": hold_duration,
            "status": "closed",
            "result": "win" if net_pnl > 0 else "loss"
        }

    def get_total_unrealized_pnl(self) -> float:
        positions = self.state.get("positions", {})
        total = 0
        for trade_type in ["spot", "futures"]:
            for symbol, pos in positions.get(trade_type, {}).items():
                total += pos.get("unrealized_pnl", 0)
        return total

    def get_total_exposure_pct(self) -> float:
        """What % of portfolio is currently deployed."""
        positions = self.state.get("positions", {})
        total_equity = self.state["portfolio"]["total_equity"]
        if total_equity <= 0:
            return 0
        deployed = 0
        for trade_type in ["spot", "futures"]:
            for pos in positions.get(trade_type, {}).values():
                deployed += pos.get("position_usdt", 0)
        return deployed / total_equity
