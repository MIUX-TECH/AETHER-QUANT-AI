"""
engine/reporting/report_service.py — Automated reporting engine.
Generates daily, weekly, monthly reports. Aggregates PnL, win rate, drawdown, etc.
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from engine.storage import (
    get_history_path, get_report_path, read_json, write_json, DIRS
)

logger = logging.getLogger(__name__)


class ReportService:
    def __init__(self, config: Dict):
        self.config = config

    def generate_daily_report(self, state: Dict, closed_today: List[Dict]) -> Dict:
        """Generate end-of-day performance report."""
        portfolio = state.get("portfolio", {})
        risk = state.get("risk", {})
        now = datetime.utcnow()

        wins = [t for t in closed_today if t.get("result") == "win"]
        losses = [t for t in closed_today if t.get("result") == "loss"]
        total_trades = len(closed_today)
        win_rate = len(wins) / total_trades if total_trades > 0 else 0
        total_pnl = sum(t.get("pnl_usdt", 0) for t in closed_today)
        total_pnl_pct = sum(t.get("pnl_pct", 0) for t in closed_today)
        avg_rr = self._avg_rr(closed_today)
        best_trade = max(closed_today, key=lambda t: t.get("pnl_usdt", 0), default={})
        worst_trade = min(closed_today, key=lambda t: t.get("pnl_usdt", 0), default={})

        report = {
            "report_type": "daily",
            "date": now.strftime("%Y-%m-%d"),
            "generated_at": now.isoformat(),
            "portfolio": {
                "total_equity": portfolio.get("total_equity", 0),
                "spot_equity": portfolio.get("spot_equity", 0),
                "futures_equity": portfolio.get("futures_equity", 0),
                "unrealized_pnl": portfolio.get("unrealized_pnl", 0),
                "drawdown_pct": portfolio.get("drawdown_pct", 0),
            },
            "performance": {
                "total_trades": total_trades,
                "wins": len(wins),
                "losses": len(losses),
                "win_rate": round(win_rate, 4),
                "total_pnl_usdt": round(total_pnl, 2),
                "total_pnl_pct": round(total_pnl_pct, 4),
                "avg_rr": round(avg_rr, 3),
                "daily_loss_pct": risk.get("daily_loss_pct", 0),
                "loss_streak": risk.get("loss_streak", 0),
            },
            "best_trade": {
                "symbol": best_trade.get("symbol", "N/A"),
                "pnl_usdt": best_trade.get("pnl_usdt", 0),
                "pnl_pct": best_trade.get("pnl_pct", 0),
                "strategy": best_trade.get("strategy", ""),
            } if best_trade else {},
            "worst_trade": {
                "symbol": worst_trade.get("symbol", "N/A"),
                "pnl_usdt": worst_trade.get("pnl_usdt", 0),
                "pnl_pct": worst_trade.get("pnl_pct", 0),
                "strategy": worst_trade.get("strategy", ""),
            } if worst_trade else {},
            "trades": closed_today,
            "risk_events": self._get_risk_events(risk),
            "market_regime": state.get("scanner", {}).get("market_regime", "unknown"),
        }

        # Save report
        path = get_report_path("daily_report", "daily", now)
        write_json(path, report, backup=False)
        logger.info(f"Daily report generated: {path.name}")
        return report

    def generate_performance_summary(self, months: int = 1) -> Dict:
        """Aggregate performance across history files."""
        all_trades = self._load_trades(months)
        if not all_trades:
            return {"status": "no_data"}

        wins = [t for t in all_trades if t.get("result") == "win"]
        losses = [t for t in all_trades if t.get("result") == "loss"]
        total = len(all_trades)
        win_rate = len(wins) / total if total > 0 else 0
        total_pnl = sum(t.get("pnl_usdt", 0) for t in all_trades)
        total_pnl_pct = sum(t.get("pnl_pct", 0) for t in all_trades)
        avg_win = sum(t.get("pnl_usdt", 0) for t in wins) / max(len(wins), 1)
        avg_loss = sum(t.get("pnl_usdt", 0) for t in losses) / max(len(losses), 1)
        profit_factor = abs(sum(t.get("pnl_usdt", 0) for t in wins) / min(sum(t.get("pnl_usdt", 0) for t in losses), -0.01))

        # By symbol
        by_symbol = self._group_by_field(all_trades, "symbol")
        # By strategy
        by_strategy = self._group_by_field(all_trades, "strategy")
        # By regime
        by_regime = self._group_by_field(all_trades, "regime")

        # Equity curve points (daily PnL)
        equity_curve = self._build_equity_curve(all_trades)
        max_dd = self._compute_max_drawdown(equity_curve)

        return {
            "period_months": months,
            "total_trades": total,
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(win_rate, 4),
            "total_pnl_usdt": round(total_pnl, 2),
            "total_pnl_pct": round(total_pnl_pct, 4),
            "avg_win_usdt": round(avg_win, 2),
            "avg_loss_usdt": round(avg_loss, 2),
            "profit_factor": round(profit_factor, 3),
            "avg_rr": round(self._avg_rr(all_trades), 3),
            "max_drawdown_pct": round(max_dd, 4),
            "equity_curve": equity_curve[-60:],
            "by_symbol": by_symbol,
            "by_strategy": by_strategy,
            "by_regime": by_regime,
            "generated_at": datetime.utcnow().isoformat()
        }

    def get_trade_journal(self, symbol: str = None, strategy: str = None,
                           limit: int = 50, months: int = 1) -> List[Dict]:
        """Return filtered trade journal."""
        trades = self._load_trades(months)
        if symbol:
            trades = [t for t in trades if t.get("symbol") == symbol]
        if strategy:
            trades = [t for t in trades if t.get("strategy") == strategy]
        trades.sort(key=lambda t: t.get("closed_at", ""), reverse=True)
        return trades[:limit]

    def _load_trades(self, months: int = 1) -> list:
        trades = []
        now = datetime.utcnow()
        for m in range(months):
            dt = now - timedelta(days=30 * m)
            path = get_history_path("trades", dt)
            if path.exists():
                data = read_json(path, default=[])
                if isinstance(data, list):
                    trades.extend(data)
        return trades

    def _avg_rr(self, trades: List[Dict]) -> float:
        rrs = [t.get("rr_ratio", 0) for t in trades if t.get("rr_ratio")]
        return sum(rrs) / len(rrs) if rrs else 0

    def _group_by_field(self, trades: List[Dict], field: str) -> Dict:
        groups = {}
        for t in trades:
            key = t.get(field, "unknown")
            if key not in groups:
                groups[key] = {"total": 0, "wins": 0, "losses": 0, "pnl_usdt": 0, "pnl_pct": 0}
            g = groups[key]
            g["total"] += 1
            if t.get("result") == "win":
                g["wins"] += 1
            else:
                g["losses"] += 1
            g["pnl_usdt"] += t.get("pnl_usdt", 0)
            g["pnl_pct"] += t.get("pnl_pct", 0)
        for key, g in groups.items():
            g["win_rate"] = round(g["wins"] / g["total"], 4) if g["total"] > 0 else 0
            g["pnl_usdt"] = round(g["pnl_usdt"], 2)
            g["pnl_pct"] = round(g["pnl_pct"], 4)
        return groups

    def _build_equity_curve(self, trades: List[Dict], start_equity: float = 1000) -> List[Dict]:
        """Build daily equity curve from trades."""
        daily_pnl: Dict[str, float] = {}
        for t in trades:
            date = t.get("closed_at", "")[:10]
            if date:
                daily_pnl[date] = daily_pnl.get(date, 0) + t.get("pnl_usdt", 0)
        curve = []
        equity = start_equity
        for date in sorted(daily_pnl.keys()):
            equity += daily_pnl[date]
            curve.append({"date": date, "equity": round(equity, 2), "pnl": round(daily_pnl[date], 2)})
        return curve

    def _compute_max_drawdown(self, equity_curve: List[Dict]) -> float:
        if not equity_curve:
            return 0
        peak = 0
        max_dd = 0
        for point in equity_curve:
            eq = point.get("equity", 0)
            if eq > peak:
                peak = eq
            if peak > 0:
                dd = (peak - eq) / peak
                max_dd = max(max_dd, dd)
        return max_dd

    def _get_risk_events(self, risk: Dict) -> List[str]:
        events = []
        if risk.get("risk_off_active"):
            events.append("Risk-off mode was active")
        if risk.get("capital_preservation_mode"):
            events.append("Capital preservation mode triggered")
        if risk.get("cooldown_until"):
            events.append(f"Cooldown triggered (loss streak: {risk.get('loss_streak', 0)})")
        return events
