"""
engine/risk/risk_manager.py — Professional risk management engine.
Handles: position sizing, exposure control, drawdown guards, cooldown, capital preservation.
"""

import logging
import math
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RiskManager:
    def __init__(self, config: Dict):
        self.config = config
        self.risk_cfg = config.get("risk", {})
        self.futures_cfg = config.get("futures", {})

    def check_trade_allowed(self, state: Dict, signal: Dict, trade_type: str = "spot") -> Tuple[bool, str]:
        """
        Check if a trade is allowed given current risk state.
        Returns (allowed: bool, reason: str)
        """
        risk_state = state.get("risk", {})
        portfolio = state.get("portfolio", {})
        system = state.get("system", {})

        # Kill switch
        if system.get("kill_switch"):
            return False, "Kill switch active — all trading halted"

        # Safe mode
        if system.get("safe_mode"):
            return False, "Safe mode active — no new entries"

        # Capital preservation
        if risk_state.get("capital_preservation_mode"):
            return False, "Capital preservation mode — no new trades"

        # Risk-off
        if risk_state.get("risk_off_active"):
            if trade_type == "futures":
                return False, "Risk-off mode — futures blocked"

        # Cooldown check
        cooldown_until = risk_state.get("cooldown_until")
        if cooldown_until:
            try:
                cd_dt = datetime.fromisoformat(cooldown_until)
                if datetime.utcnow() < cd_dt:
                    remaining = (cd_dt - datetime.utcnow()).seconds // 60
                    return False, f"Cooldown active — {remaining}m remaining"
            except Exception:
                pass

        # Daily loss limit
        daily_loss = risk_state.get("daily_loss_pct", 0)
        max_daily = self.risk_cfg.get("max_daily_loss_pct", 0.05)
        if daily_loss >= max_daily:
            return False, f"Daily loss limit reached ({daily_loss:.1%} of {max_daily:.1%})"

        # Drawdown limit
        drawdown = portfolio.get("drawdown_pct", 0)
        max_dd = self.risk_cfg.get("max_drawdown_pct", 0.15)
        if drawdown >= max_dd:
            return False, f"Max drawdown reached ({drawdown:.1%})"

        # Minimum confidence
        confidence = signal.get("confidence", 0)
        min_conf = self.risk_cfg.get("min_confidence_to_trade", 0.60)
        if trade_type == "futures":
            min_conf = self.risk_cfg.get("min_confidence_futures", 0.75)
        if confidence < min_conf:
            return False, f"Confidence {confidence:.1%} below minimum {min_conf:.1%}"

        # Exposure check
        total_exposure = risk_state.get("total_exposure_pct", 0)
        max_exposure = self.risk_cfg.get("max_portfolio_exposure_pct", 0.85)
        if total_exposure >= max_exposure:
            return False, f"Max portfolio exposure reached ({total_exposure:.1%})"

        return True, "Trade approved"

    def calculate_position_size(self, equity: float, entry_price: float,
                                 atr: float, signal: Dict,
                                 trade_type: str = "spot",
                                 symbol: str = "") -> Dict:
        """
        Professional position sizing using ATR-based risk.
        Returns position size in base asset and USDT value.
        """
        confidence = signal.get("confidence", 0.6)

        if trade_type == "spot":
            # Risk per trade, scaled by confidence
            base_risk_pct = self.risk_cfg.get("max_risk_per_trade_pct", 0.02)
            risk_pct = base_risk_pct * min(confidence / 0.7, 1.0)

            # SL distance using ATR
            sl_multiplier = 2.0
            sl_distance = atr * sl_multiplier
            if entry_price > 0 and sl_distance > 0:
                risk_amount = equity * risk_pct
                position_usdt = risk_amount / (sl_distance / entry_price)
                position_usdt = min(position_usdt,
                                    equity * self.risk_cfg.get("max_exposure_per_coin_pct", 0.25))
                position_qty = position_usdt / entry_price

                sl_price = entry_price - sl_distance
                tp_distance = sl_distance * 2.0  # 2:1 RR minimum
                tp_price = entry_price + tp_distance
                trailing_stop_pct = self.config.get("spot", {}).get("trailing_stop_pct", 0.02)
            else:
                return {"error": "Invalid ATR or price"}
        else:
            # Futures
            leverage = signal.get("suggested_leverage", self.futures_cfg.get("default_leverage", 3))
            base_risk_pct = self.risk_cfg.get("max_futures_risk_pct", 0.03)
            risk_pct = base_risk_pct * min(confidence / 0.80, 1.0)

            sl_pct = self.futures_cfg.get("sl_pct", 0.025)
            sl_distance = entry_price * sl_pct
            risk_amount = equity * risk_pct
            notional = risk_amount / sl_pct
            position_usdt = notional / leverage

            sl_price_long = entry_price * (1 - sl_pct)
            tp_price_long = entry_price * (1 + self.futures_cfg.get("tp_pct", 0.06))

            # Liquidation distance check
            liq_price_approx = entry_price * (1 - 1 / leverage * 0.9)
            liq_distance_pct = (entry_price - liq_price_approx) / entry_price
            min_liq_dist = self.futures_cfg.get("min_liquidation_distance_pct", 0.30)

            if liq_distance_pct < min_liq_dist:
                leverage = max(2, leverage - 1)
                liq_price_approx = entry_price * (1 - 1 / leverage * 0.9)

            position_qty = (position_usdt * leverage) / entry_price
            sl_price = sl_price_long
            tp_price = tp_price_long
            trailing_stop_pct = self.futures_cfg.get("trailing_stop_pct", 0.015)

        return {
            "position_qty": round(position_qty, 6),
            "position_usdt": round(position_usdt, 2),
            "entry_price": entry_price,
            "sl_price": round(sl_price, 6),
            "tp_price": round(tp_price, 6),
            "risk_pct": round(risk_pct, 4),
            "risk_amount": round(equity * risk_pct, 2),
            "rr_ratio": round((tp_price - entry_price) / (entry_price - sl_price), 2) if trade_type == "spot" else 2.0,
            "trailing_stop_pct": trailing_stop_pct,
            "leverage": leverage if trade_type == "futures" else 1,
            "trade_type": trade_type
        }

    def update_risk_state(self, state: Dict, trade_result: Dict) -> Dict:
        """Update risk state after a trade closes."""
        risk_state = state.get("risk", {})
        pnl_pct = trade_result.get("pnl_pct", 0)

        # Daily loss tracking
        if pnl_pct < 0:
            risk_state["daily_loss_pct"] = risk_state.get("daily_loss_pct", 0) + abs(pnl_pct)
            risk_state["loss_streak"] = risk_state.get("loss_streak", 0) + 1
        else:
            risk_state["loss_streak"] = 0

        # Cooldown after loss streak
        streak = risk_state.get("loss_streak", 0)
        cooldown_streak = self.risk_cfg.get("cooldown_after_loss_streak", 3)
        if streak >= cooldown_streak:
            cooldown_mins = self.risk_cfg.get("cooldown_duration_minutes", 60)
            cooldown_until = datetime.utcnow() + timedelta(minutes=cooldown_mins)
            risk_state["cooldown_until"] = cooldown_until.isoformat()
            logger.warning(f"Loss streak {streak} — entering cooldown for {cooldown_mins}m")

        # Capital preservation & Risk-Off mode with Auto-Recovery
        portfolio = state.get("portfolio", {})
        drawdown = portfolio.get("drawdown_pct", 0)
        risk_off_thresh = self.risk_cfg.get("risk_off_mode_threshold", 0.10)
        cap_pres_thresh = self.risk_cfg.get("max_drawdown_pct", 0.15) * 0.8  # 12%

        if drawdown >= cap_pres_thresh:
            if not risk_state.get("capital_preservation_mode"):
                logger.warning(f"Drawdown {drawdown:.1%} — Capital preservation mode activated")
            risk_state["capital_preservation_mode"] = True
            risk_state["risk_off_active"] = True
        elif drawdown >= risk_off_thresh:
            if not risk_state.get("risk_off_active"):
                logger.warning(f"Drawdown {drawdown:.1%} — Risk-off mode activated")
            risk_state["risk_off_active"] = True
            if risk_state.get("capital_preservation_mode"):
                risk_state["capital_preservation_mode"] = False
                logger.info(f"Drawdown recovered to {drawdown:.1%} — Capital preservation deactivated, remaining in Risk-Off")
        elif drawdown < 0.08:  # Hysteresis recovery when drawdown drops below 8%
            if risk_state.get("risk_off_active") or risk_state.get("capital_preservation_mode"):
                logger.info(f"✅ RISK RECOVERY: Drawdown recovered to {drawdown:.1%} (<8%) — Normal trading mode restored")
            risk_state["risk_off_active"] = False
            risk_state["capital_preservation_mode"] = False

        state["risk"] = risk_state
        return state

    def check_risk_recovery(self, state: Dict) -> Dict:
        """Periodic check to auto-recover risk state if equity improved."""
        risk_state = state.get("risk", {})
        portfolio = state.get("portfolio", {})
        drawdown = portfolio.get("drawdown_pct", 0)
        if drawdown < 0.08 and (risk_state.get("risk_off_active") or risk_state.get("capital_preservation_mode")):
            logger.info(f"✅ RISK RECOVERY: Periodic check confirmed drawdown {drawdown:.1%} — Normal mode restored")
            risk_state["risk_off_active"] = False
            risk_state["capital_preservation_mode"] = False
            state["risk"] = risk_state
        return state

    def compute_drawdown(self, current_equity: float, peak_equity: float) -> float:
        if peak_equity <= 0:
            return 0.0
        return max(0, (peak_equity - current_equity) / peak_equity)

    def compute_leverage_for_asset(self, symbol: str, volatility_pct: float,
                                    confidence: float) -> int:
        """Dynamic leverage based on volatility and confidence."""
        max_lev = self.futures_cfg.get("max_leverage", 10)
        if volatility_pct > 0.05:
            base = 2
        elif volatility_pct > 0.03:
            base = 3
        elif volatility_pct > 0.015:
            base = 5
        else:
            base = self.futures_cfg.get("default_leverage", 3)

        # Scale by confidence
        conf_multiplier = min(confidence / 0.75, 1.2)
        lev = int(base * conf_multiplier)
        return max(1, min(lev, max_lev))

    def get_risk_summary(self, state: Dict) -> Dict:
        """Human-readable risk summary for UI."""
        risk = state.get("risk", {})
        portfolio = state.get("portfolio", {})
        return {
            "daily_loss_pct": risk.get("daily_loss_pct", 0),
            "loss_streak": risk.get("loss_streak", 0),
            "cooldown_active": bool(risk.get("cooldown_until")),
            "cooldown_until": risk.get("cooldown_until"),
            "risk_off": risk.get("risk_off_active", False),
            "capital_preservation": risk.get("capital_preservation_mode", False),
            "drawdown_pct": portfolio.get("drawdown_pct", 0),
            "total_exposure_pct": risk.get("total_exposure_pct", 0),
            "kill_switch": state.get("system", {}).get("kill_switch", False),
            "safe_mode": state.get("system", {}).get("safe_mode", False),
        }
