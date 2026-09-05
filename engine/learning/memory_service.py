"""
engine/learning/memory_service.py — Adaptive memory and learning from trade history.
No ML models — uses rule refinement, parameter adjustment, pattern library.
Prevents memory corruption and duplicate entries.
"""

import logging
import hashlib
from collections import deque
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from engine.storage import (
    load_memory, save_memory, load_state, save_state,
    get_history_path, append_to_list_file, read_json, write_json, DIRS
)

logger = logging.getLogger(__name__)

LEARNING_UPDATE_MIN_TRADES = 5  # Minimum trades before adjusting weights


class MemoryService:
    def __init__(self, config: Dict):
        self.config = config
        self.portfolio_memory = load_memory("portfolio_memory")
        self.strategy_memory = load_memory("strategy_memory")
        self._seen_trade_ids: deque = deque(maxlen=50000)
        self._seen_trade_set: set = set()  # Fast O(1) lookup companion
        self._load_seen_ids()

    def _load_seen_ids(self):
        """Load known trade IDs to prevent duplicates."""
        try:
            history = self._load_recent_trades(months=2)
            for t in history:
                tid = t.get("order_id") or t.get("id")
                if tid and tid not in self._seen_trade_set:
                    self._seen_trade_ids.append(tid)
                    self._seen_trade_set.add(tid)
            # Sync set with deque in case deque evicted old entries
            self._seen_trade_set = set(self._seen_trade_ids)
        except Exception as e:
            logger.warning(f"Could not load seen IDs: {e}")

    def record_trade(self, trade: Dict) -> bool:
        """
        Record a completed trade to history files.
        Prevents duplicate entries.
        """
        trade_id = trade.get("order_id") or trade.get("id")

        # Dedup check
        if trade_id and trade_id in self._seen_trade_set:
            logger.debug(f"Trade {trade_id} already recorded, skipping")
            return False

        # Add metadata
        trade["recorded_at"] = datetime.utcnow().isoformat()
        if not trade.get("id"):
            trade["id"] = self._generate_id(trade)

        # Monthly history file
        path = get_history_path("trades")
        success = append_to_list_file(path, trade)
        if success and trade_id:
            self._seen_trade_ids.append(trade_id)
            self._seen_trade_set.add(trade_id)
            # Keep set in sync with deque evictions
            if len(self._seen_trade_set) > len(self._seen_trade_ids) + 100:
                self._seen_trade_set = set(self._seen_trade_ids)

        return success

    def record_decision(self, decision: Dict) -> bool:
        """Record an AI decision event (entry, exit, skip, hold)."""
        decision["recorded_at"] = datetime.utcnow().isoformat()
        path = get_history_path("decision_log")
        return append_to_list_file(path, decision)

    def update_learning(self, closed_trades: List[Dict]) -> Dict:
        """
        Analyze recent closed trades and update adaptive weights.
        Called periodically. Only updates if enough data.
        """
        if len(closed_trades) < LEARNING_UPDATE_MIN_TRADES:
            return {"status": "insufficient_data", "trades": len(closed_trades)}

        updates = []

        # Strategy performance
        strategy_stats = self._analyze_strategy_performance(closed_trades)
        self._update_strategy_memory(strategy_stats)
        updates.append(f"Strategy stats updated: {len(strategy_stats)} strategies")

        # Coin profiles
        coin_stats = self._analyze_coin_performance(closed_trades)
        self._update_coin_profiles(coin_stats)
        updates.append(f"Coin profiles updated: {len(coin_stats)} coins")

        # Regime performance
        regime_stats = self._analyze_regime_performance(closed_trades)
        self._update_regime_memory(regime_stats)
        updates.append(f"Regime stats updated")

        # Adaptive weight adjustment
        weight_updates = self._adjust_weights(closed_trades)
        if weight_updates:
            updates.append(f"Weights adjusted: {weight_updates}")

        # Extract lessons from losers
        lessons = self._extract_lessons(closed_trades)
        if lessons:
            existing = self.strategy_memory.get("error_log", [])
            existing.extend(lessons)
            self.strategy_memory["error_log"] = existing[-50:]
            updates.append(f"{len(lessons)} new lessons recorded")

        self.strategy_memory["updated_at"] = datetime.utcnow().isoformat()
        self.portfolio_memory["updated_at"] = datetime.utcnow().isoformat()
        save_memory("strategy_memory", self.strategy_memory)
        save_memory("portfolio_memory", self.portfolio_memory)

        logger.info(f"Learning update complete: {'; '.join(updates)}")
        return {"status": "updated", "updates": updates}

    def get_coin_context(self, symbol: str) -> Dict:
        """Get learned context for a coin to augment scoring."""
        profiles = self.strategy_memory.get("coin_profiles", {})
        return profiles.get(symbol, {})

    def get_adaptive_weights(self) -> Dict:
        return self.portfolio_memory.get("adaptive_weights", {})

    def get_strategy_stats(self) -> Dict:
        return self.portfolio_memory.get("strategy_performance", {})

    def get_lessons(self) -> List[Dict]:
        return self.strategy_memory.get("error_log", [])[-20:]

    def get_learning_summary(self) -> Dict:
        """Return a readable summary for the UI."""
        return {
            "total_trades_analyzed": self._count_total_trades(),
            "adaptive_weights": self.portfolio_memory.get("adaptive_weights", {}),
            "strategy_performance": self.portfolio_memory.get("strategy_performance", {}),
            "regime_performance": self.portfolio_memory.get("regime_performance", {}),
            "best_params": self.portfolio_memory.get("best_params_found", {}),
            "lessons": self.get_lessons(),
            "coin_profiles": {
                sym: {
                    "best_strategy": prof.get("best_strategy"),
                    "win_rate": prof.get("win_rate", 0),
                    "trade_count": prof.get("trade_count", 0),
                }
                for sym, prof in self.strategy_memory.get("coin_profiles", {}).items()
            },
            "last_updated": self.strategy_memory.get("updated_at", "never")
        }

    def _analyze_strategy_performance(self, trades: List[Dict]) -> Dict:
        stats = {}
        for t in trades:
            strat = t.get("strategy", "unknown")
            if strat not in stats:
                stats[strat] = {"wins": 0, "losses": 0, "total_rr": 0, "total_pnl": 0}
            if t.get("result") == "win":
                stats[strat]["wins"] += 1
            else:
                stats[strat]["losses"] += 1
            pnl_pct = t.get("pnl_pct", 0)
            stats[strat]["total_pnl"] += pnl_pct
        for strat, s in stats.items():
            total = s["wins"] + s["losses"]
            s["win_rate"] = s["wins"] / total if total > 0 else 0.5
            s["avg_pnl"] = s["total_pnl"] / total if total > 0 else 0
            s["trade_count"] = total
        return stats

    def _update_strategy_memory(self, stats: Dict):
        existing = self.portfolio_memory.get("strategy_performance", {})
        for strat, new in stats.items():
            if strat not in existing:
                existing[strat] = new
            else:
                old = existing[strat]
                # Blend
                old_n = old.get("trade_count", 0)
                new_n = new.get("trade_count", 0)
                total = old_n + new_n
                if total > 0:
                    old["win_rate"] = (old.get("win_rate", 0.5) * old_n + new.get("win_rate", 0.5) * new_n) / total
                    old["trade_count"] = total
                existing[strat] = old
        self.portfolio_memory["strategy_performance"] = existing

    def _analyze_coin_performance(self, trades: List[Dict]) -> Dict:
        stats = {}
        for t in trades:
            sym = t.get("symbol", "")
            if not sym:
                continue
            if sym not in stats:
                stats[sym] = {"wins": 0, "losses": 0, "strategies": {}, "last_10": []}
            if t.get("result") == "win":
                stats[sym]["wins"] += 1
            else:
                stats[sym]["losses"] += 1
            strat = t.get("strategy", "unknown")
            if strat not in stats[sym]["strategies"]:
                stats[sym]["strategies"][strat] = {"wins": 0, "losses": 0}
            stats[sym]["strategies"][strat]["wins" if t.get("result") == "win" else "losses"] += 1
            stats[sym]["last_10"].append({
                "result": t.get("result"),
                "pnl_pct": t.get("pnl_pct"),
                "strategy": strat,
                "closed_at": t.get("closed_at")
            })
        for sym, s in stats.items():
            total = s["wins"] + s["losses"]
            s["win_rate"] = s["wins"] / total if total > 0 else 0.5
            s["trade_count"] = total
            s["last_10"] = s["last_10"][-10:]
            # Best strategy
            best = max(s["strategies"].items(),
                       key=lambda x: x[1]["wins"] / max(x[1]["wins"] + x[1]["losses"], 1),
                       default=(None, None))
            s["best_strategy"] = best[0] if best else "unknown"
        return stats

    def _update_coin_profiles(self, stats: Dict):
        profiles = self.strategy_memory.get("coin_profiles", {})
        for sym, new in stats.items():
            if sym not in profiles:
                profiles[sym] = {}
            profiles[sym].update({
                "win_rate": new.get("win_rate", 0.5),
                "trade_count": new.get("trade_count", 0),
                "best_strategy": new.get("best_strategy"),
                "last_10_trades": new.get("last_10", [])
            })
        self.strategy_memory["coin_profiles"] = profiles

    def _analyze_regime_performance(self, trades: List[Dict]) -> Dict:
        stats = {}
        for t in trades:
            regime = t.get("regime", "unknown")
            if regime not in stats:
                stats[regime] = {"wins": 0, "losses": 0}
            if t.get("result") == "win":
                stats[regime]["wins"] += 1
            else:
                stats[regime]["losses"] += 1
        for regime, s in stats.items():
            total = s["wins"] + s["losses"]
            s["win_rate"] = s["wins"] / total if total > 0 else 0.5
            s["trades"] = total
        return stats

    def _update_regime_memory(self, stats: Dict):
        existing = self.portfolio_memory.get("regime_performance", {})
        for regime, new in stats.items():
            if regime not in existing:
                existing[regime] = new
            else:
                old = existing[regime]
                old_n = old.get("trades", 0)
                new_n = new.get("trades", 0)
                total = old_n + new_n
                if total > 0:
                    old["win_rate"] = (old.get("win_rate", 0.5) * old_n + new.get("win_rate", 0.5) * new_n) / total
                    old["trades"] = total
                existing[regime] = old
        self.portfolio_memory["regime_performance"] = existing

    def _adjust_weights(self, trades: List[Dict]) -> Dict:
        """Adaptively adjust scoring weights based on what's been most predictive."""
        # Analyze which factors were present in winning vs losing trades
        weight_adj = {}
        wins = [t for t in trades if t.get("result") == "win"]
        losses = [t for t in trades if t.get("result") == "loss"]

        if len(wins) < 3 or len(losses) < 3:
            return {}

        win_rate = len(wins) / len(trades)

        # If win rate is good (>60%), slightly increase trend weight
        # If win rate is bad (<40%), decrease momentum weight
        current = self.portfolio_memory.get("adaptive_weights", {})
        if win_rate > 0.60:
            current["trend"] = min(0.30, current.get("trend", 0.20) * 1.05)
            weight_adj["trend"] = "+5%"
        elif win_rate < 0.40:
            current["momentum"] = max(0.10, current.get("momentum", 0.18) * 0.95)
            weight_adj["momentum"] = "-5%"

        if weight_adj:
            self.portfolio_memory["adaptive_weights"] = current

        return weight_adj

    def _extract_lessons(self, trades: List[Dict]) -> List[Dict]:
        """Extract lessons from losing trades."""
        lessons = []
        losses = [t for t in trades if t.get("result") == "loss"]
        for t in losses[-10:]:
            lesson = {
                "symbol": t.get("symbol"),
                "reason": t.get("close_reason"),
                "regime": t.get("regime"),
                "confidence": t.get("confidence"),
                "pnl_pct": t.get("pnl_pct"),
                "note": "Avoided in similar future conditions" if (t.get("confidence", 0) < 0.65) else "Low confidence entry",
                "date": t.get("closed_at", datetime.utcnow().isoformat())
            }
            lessons.append(lesson)
        return lessons

    def _load_recent_trades(self, months: int = 3) -> List[Dict]:
        """Load trades from last N months."""
        from datetime import date
        trades = []
        now = datetime.utcnow()
        for m in range(months):
            dt = datetime(now.year, now.month, 1) - timedelta(days=30 * m)
            path = get_history_path("trades", dt)
            if path.exists():
                data = read_json(path, default=[])
                if isinstance(data, list):
                    trades.extend(data)
        return trades

    def _count_total_trades(self) -> int:
        trades = self._load_recent_trades(months=12)
        return len(trades)

    def _generate_id(self, trade: Dict) -> str:
        key = f"{trade.get('symbol','')}{trade.get('opened_at','')}{trade.get('entry_price','')}"
        return hashlib.md5(key.encode()).hexdigest()[:12]
