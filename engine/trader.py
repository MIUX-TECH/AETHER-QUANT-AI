"""
engine/trader.py — Main Trading Orchestrator.

This is the central brain that connects all modules:
Scanner → Scoring → Risk → Portfolio → Execution → Memory → Reporting

Runs in a scheduler loop. All decisions are logged for auditability.
"""

import logging
import time
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


class TradingOrchestrator:
    def __init__(self,
                 market_data,
                 scanner,
                 risk_manager,
                 portfolio_manager,
                 executor,
                 news_service,
                 memory_service,
                 report_service,
                 config: Dict,
                 state: Dict,
                 ai_client=None):
        self.market_data = market_data
        self.scanner = scanner
        self.risk_manager = risk_manager
        self.portfolio_manager = portfolio_manager
        self.executor = executor
        self.news_service = news_service
        self.memory_service = memory_service
        self.report_service = report_service
        self.config = config
        self.state = state
        self.ai_client = ai_client
        self.trade_logger = logging.getLogger("trade")
        self.decision_logger = logging.getLogger("decision")
        self._scan_results: Dict = {}
        self._closed_today: List[Dict] = []

    def run_scan_cycle(self) -> Dict:
        """
        Full scan cycle:
        1. Periodic risk recovery check
        2. Get sentiment
        3. Scan all symbols
        4. Update state
        5. Return results
        """
        if self.state.get("system", {}).get("kill_switch"):
            return {"status": "kill_switch_active"}

        # Periodic check for drawdown recovery to restore normal mode
        if hasattr(self.risk_manager, "check_risk_recovery"):
            self.state = self.risk_manager.check_risk_recovery(self.state)

        symbols = self.state.get("scanner", {}).get("symbols", ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"])

        # Get sentiment
        try:
            sentiment = self.news_service.get_sentiment_scores(symbols)
        except Exception as e:
            logger.warning(f"Sentiment fetch failed: {e}")
            sentiment = {s: 0.5 for s in symbols}

        # Get coin memories
        coin_memories = {}
        for sym in symbols:
            coin_memories[sym] = self.memory_service.get_coin_context(sym)

        # Scan
        results = self.scanner.scan_all(symbols, sentiment, coin_memories)
        self._scan_results = results

        # Update state
        signals = {sym: r.get("score", {}) for sym, r in results.items()}
        regimes = {sym: r.get("regime", {}).get("regime", "unknown") for sym, r in results.items()}

        # Get dominant regime
        regime_counts: Dict = {}
        for r in regimes.values():
            regime_counts[r] = regime_counts.get(r, 0) + 1
        dominant_regime = max(regime_counts, key=regime_counts.get) if regime_counts else "unknown"

        self.state["scanner"]["last_signals"] = signals
        self.state["scanner"]["market_regime"] = dominant_regime
        self.state["system"]["last_scan"] = datetime.utcnow().isoformat()

        logger.info(f"Scan complete. Dominant regime: {dominant_regime}. Signals: "
                    + ", ".join(f"{s}:{v.get('signal','?')}" for s, v in signals.items()))

        return {"status": "ok", "results": results, "dominant_regime": dominant_regime}

    def run_execution_cycle(self) -> Dict:
        """
        Execution cycle:
        1. Check existing positions for exit conditions
        2. Check for new entry signals
        3. Execute approved trades
        """
        if self.state.get("system", {}).get("kill_switch"):
            return {"status": "kill_switch_active"}

        mode = self.state.get("system", {}).get("mode", "paper")
        executed = []
        exits = []

        # --- STEP 1: Monitor existing positions ---
        exits = self._monitor_positions()

        # --- STEP 2: Check entry signals (only if we have fresh scan) ---
        if not self._scan_results:
            return {"status": "no_scan_data", "exits": exits, "entries": []}

        if mode in ["paper", "live", "testnet"]:
            for symbol, scan in self._scan_results.items():
                score = scan.get("score", {})
                signal = score.get("signal", "WAIT")
                confidence = score.get("confidence", 0)

                if signal not in ["STRONG_BUY", "BUY", "SHORT"]:
                    self._log_decision(symbol, "skip", score, "Signal below action threshold")
                    continue

                # Spot entries
                if signal in ["STRONG_BUY", "BUY"]:
                    result = self._try_spot_entry(symbol, scan, score)
                    if result.get("executed"):
                        executed.append(result)

                # Futures entries (SHORT or high-confidence BUY)
                if signal == "SHORT" or (signal == "STRONG_BUY" and confidence > 0.82):
                    result = self._try_futures_entry(symbol, scan, score)
                    if result.get("executed"):
                        executed.append(result)

        return {"status": "ok", "exits": exits, "entries": executed}

    def _try_spot_entry(self, symbol: str, scan: Dict, score: Dict) -> Dict:
        """Attempt a spot long entry."""
        # Risk check
        allowed, reason = self.risk_manager.check_trade_allowed(self.state, score, "spot")
        if not allowed:
            self._log_decision(symbol, "blocked", score, reason)
            return {"executed": False, "reason": reason}

        # Check we don't already have a position
        existing = self.state.get("positions", {}).get("spot", {}).get(symbol)
        if existing and existing.get("status") == "active":
            return {"executed": False, "reason": "Position already open"}

        # Available capital
        available = self.portfolio_manager.get_available_for_trade("spot", symbol)
        if available < 10:
            return {"executed": False, "reason": f"Insufficient capital: ${available:.2f}"}

        # Position sizing
        current_price = scan.get("price", 0)
        atr = scan.get("indicators", {}).get("1h", {}).get("atr_pct", 0.02) * current_price
        sizing = self.risk_manager.calculate_position_size(
            self.state["portfolio"]["total_equity"],
            current_price, atr, score, "spot", symbol
        )
        if "error" in sizing:
            return {"executed": False, "reason": sizing["error"]}

        # Cap by available
        sizing["position_usdt"] = min(sizing["position_usdt"], available)
        sizing["position_qty"] = sizing["position_usdt"] / current_price if current_price > 0 else 0

        if sizing["position_usdt"] < 10:
            return {"executed": False, "reason": "Position too small"}

        # AI Decision Layer Validation (Qwen / Groq Gatekeeper)
        if self.ai_client and self.ai_client.is_available:
            regime = scan.get("regime", {}).get("regime", "unknown")
            bullish_f = score.get("bullish_factors", [])
            bearish_f = score.get("bearish_factors", [])
            ai_val = self.ai_client.validate_trade_setup(
                symbol=symbol,
                signal=score.get("signal", "BUY"),
                quant_score=score.get("confidence", 0.68),
                regime=regime,
                indicators=scan.get("indicators", {}),
                bullish_factors=bullish_f,
                bearish_factors=bearish_f
            )
            if not ai_val.get("approved", True):
                reason = f"AI Rejection ({ai_val.get('reasoning', 'Setup flagged as low quality')})"
                self._log_decision(symbol, "ai_rejected", score, reason)
                logger.info(f"🛑 AI GATEKEEPER REJECTED {symbol}: {reason}")
                return {"executed": False, "reason": reason}
            else:
                score["ai_verdict"] = "APPROVE"
                score["ai_reasoning"] = ai_val.get("reasoning", "Validasi AI disetujui")
                logger.info(f"🤖 AI APPROVED {symbol}: {score['ai_reasoning']}")

        # Execute
        order = self.executor.place_spot_market_buy(symbol, sizing["position_usdt"], current_price)
        if order.get("status") != "FILLED":
            logger.error(f"Order failed for {symbol}: {order}")
            return {"executed": False, "reason": "Order execution failed", "order": order}

        # Record position
        score["strategy"] = self._determine_strategy(scan)
        position = self.portfolio_manager.open_position(symbol, "BUY", "spot", order, sizing, score)
        self.state.setdefault("positions", {}).setdefault("spot", {})[symbol] = position

        # Log
        fill_price = float(order.get("price") or current_price)
        fill_qty = float(order.get("executedQty") or sizing.get("position_qty", 0))
        self._log_decision(symbol, "entry_spot", score, f"Entry @ {fill_price:.4f} | {sizing}")
        self.trade_logger.info(
            f"SPOT BUY {symbol} | price={fill_price:.4f} | "
            f"qty={fill_qty:.6f} | usdt={sizing['position_usdt']:.2f} | "
            f"sl={sizing['sl_price']:.4f} | tp={sizing['tp_price']:.4f} | "
            f"conf={float(score.get('confidence', 0)):.2%} | signal={score.get('signal')}"
        )

        return {"executed": True, "symbol": symbol, "type": "spot_buy", "order": order, "sizing": sizing}

    def _try_futures_entry(self, symbol: str, scan: Dict, score: Dict) -> Dict:
        """Attempt a futures entry (long or short)."""
        # Apply stricter futures filter
        volatility = scan.get("volatility_pct", 0.02)
        futures_score = self.scanner.scoring_engine.score_for_futures(score, volatility)

        if not futures_score.get("action_allowed"):
            self._log_decision(symbol, "futures_blocked", score, futures_score.get("futures_reason", ""))
            return {"executed": False, "reason": futures_score.get("futures_reason")}

        # Max concurrent positions
        current_futures = self.state.get("positions", {}).get("futures", {})
        active_futures = [p for p in current_futures.values() if p.get("status") == "active"]
        max_concurrent = self.config.get("futures", {}).get("max_concurrent_positions", 2)
        if len(active_futures) >= max_concurrent:
            return {"executed": False, "reason": f"Max futures positions ({max_concurrent}) reached"}

        allowed, reason = self.risk_manager.check_trade_allowed(self.state, futures_score, "futures")
        if not allowed:
            return {"executed": False, "reason": reason}

        available = self.portfolio_manager.get_available_for_trade("futures", symbol)
        if available < 10:
            return {"executed": False, "reason": "Insufficient futures capital"}

        current_price = scan.get("price", 0)
        atr = scan.get("indicators", {}).get("1h", {}).get("atr_pct", 0.02) * current_price
        leverage = futures_score.get("suggested_leverage", 3)

        side = "SELL" if futures_score.get("signal") == "SHORT" else "BUY"
        sizing = self.risk_manager.calculate_position_size(
            self.state["portfolio"]["total_equity"],
            current_price, atr, futures_score, "futures", symbol
        )
        sizing["position_usdt"] = min(sizing.get("position_usdt", 0), available)

        if sizing["position_usdt"] < 10:
            return {"executed": False, "reason": "Futures position too small"}

        # AI Decision Layer Validation for Futures
        if self.ai_client and self.ai_client.is_available:
            regime = scan.get("regime", {}).get("regime", "unknown")
            bullish_f = futures_score.get("bullish_factors", [])
            bearish_f = futures_score.get("bearish_factors", [])
            ai_val = self.ai_client.validate_trade_setup(
                symbol=symbol,
                signal=futures_score.get("signal", "SHORT" if side == "SELL" else "BUY"),
                quant_score=futures_score.get("confidence", 0.75),
                regime=regime,
                indicators=scan.get("indicators", {}),
                bullish_factors=bullish_f,
                bearish_factors=bearish_f
            )
            if not ai_val.get("approved", True):
                reason = f"AI Futures Rejection ({ai_val.get('reasoning', 'Setup flagged as low quality')})"
                self._log_decision(symbol, "ai_futures_rejected", futures_score, reason)
                logger.info(f"🛑 AI GATEKEEPER REJECTED FUTURES {symbol}: {reason}")
                return {"executed": False, "reason": reason}
            else:
                futures_score["ai_verdict"] = "APPROVE"
                futures_score["ai_reasoning"] = ai_val.get("reasoning", "Validasi AI disetujui")
                logger.info(f"🤖 AI APPROVED FUTURES {symbol}: {futures_score['ai_reasoning']}")

        order = self.executor.place_futures_order(
            symbol, side, sizing.get("position_qty", 0),
            current_price, "MARKET", leverage
        )
        if order.get("status") != "FILLED":
            return {"executed": False, "reason": "Futures order failed"}

        futures_score["strategy"] = f"futures_{side.lower()}"
        position = self.portfolio_manager.open_position(symbol, side, "futures", order, sizing, futures_score)
        self.state.setdefault("positions", {}).setdefault("futures", {})[symbol] = position

        self._log_decision(symbol, f"entry_futures_{side.lower()}", futures_score,
                           f"Entry @ {current_price:.4f} lev={leverage}x")
        self.trade_logger.info(
            f"FUTURES {side} {symbol} | price={current_price:.4f} | lev={leverage}x | "
            f"usdt={sizing['position_usdt']:.2f} | conf={futures_score.get('confidence'):.2%}"
        )

        return {"executed": True, "symbol": symbol, "type": f"futures_{side.lower()}", "order": order}

    def _monitor_positions(self) -> List[Dict]:
        """Check all open positions for exit conditions and update PnL."""
        exits = []
        now_prices = {}

        for trade_type in ["spot", "futures"]:
            positions = self.state.get("positions", {}).get(trade_type, {})
            to_close = []

            for symbol, position in list(positions.items()):
                if position.get("status") != "active":
                    continue

                # Get current price
                if symbol not in now_prices:
                    price = self.market_data.get_price(symbol)
                    if price:
                        now_prices[symbol] = price

                current_price = now_prices.get(symbol, position.get("current_price", 0))
                if not current_price:
                    continue

                # Update PnL
                position = self.portfolio_manager.update_position_pnl(position, current_price)
                positions[symbol] = position

                # Check partial TP
                if trade_type == "spot" and self.portfolio_manager.check_partial_tp(position, current_price):
                    self._execute_partial_tp(symbol, position, current_price, trade_type)

                # Check exit conditions
                should_exit, reason = self.portfolio_manager.check_exit_conditions(position, current_price)

                # Also check signal reversal
                scan = self._scan_results.get(symbol, {})
                signal = scan.get("score", {}).get("signal", "HOLD")
                if signal in ["SELL", "AVOID"] and position.get("side") == "BUY":
                    should_exit = True
                    reason = f"signal_reversal_{signal}"
                elif signal in ["STRONG_BUY", "BUY"] and position.get("side") == "SELL":
                    should_exit = True
                    reason = f"signal_reversal_{signal}"

                if should_exit:
                    to_close.append((symbol, position, reason, current_price, trade_type))

            # Execute closes
            for symbol, position, reason, price, ttype in to_close:
                result = self._close_position(symbol, position, reason, price, ttype)
                if result:
                    exits.append(result)

        return exits

    def _execute_partial_tp(self, symbol: str, position: Dict,
                              current_price: float, trade_type: str):
        """Take TP1 partial profits (40%), raise SL to BEP, and activate 60% runner."""
        partial_pct = self.config.get("spot", {}).get("partial_tp_pct", 0.40)
        partial_qty = position.get("qty", 0) * partial_pct

        order = self.executor.place_spot_market_sell(symbol, partial_qty, current_price)
        if order.get("status") == "FILLED":
            position["qty"] = position.get("qty", 0) * (1 - partial_pct)
            position["partial_tp_taken"] = True
            position["runner_active"] = True
            # Raise SL to breakeven after TP1
            position["sl_price"] = max(
                position.get("sl_price", 0),
                position.get("entry_price", 0)
            )
            self.state["positions"][trade_type][symbol] = position
            self._log_decision(symbol, "tp1_partial", {}, f"TP1 taken (40% qty) @ {current_price:.4f} | SL raised to BEP")
            self.trade_logger.info(f"TP1 HIT {symbol} | closed 40% (qty={partial_qty:.6f}) @ {current_price:.4f} | Runner 60% Active")

    def _close_position(self, symbol: str, position: Dict, reason: str,
                         price: float, trade_type: str) -> Optional[Dict]:
        """Close a position, record the trade, and auto-accumulate BTC Vault from realized profit."""
        qty = position.get("qty", 0)
        side = position.get("side", "BUY")
        close_side = "SELL" if side == "BUY" else "BUY"

        if trade_type == "spot":
            order = self.executor.place_spot_market_sell(symbol, qty, price)
        else:
            order = self.executor.place_futures_order(
                symbol, close_side, qty, price, "MARKET",
                position.get("leverage", 1), reduce_only=True
            )

        if order.get("status") != "FILLED":
            logger.error(f"Close order failed for {symbol}: {order}")
            return None

        # Build closed trade record
        closed = self.portfolio_manager.close_position(position, price, reason)

        # Remove from active positions
        self.state["positions"][trade_type].pop(symbol, None)

        # Record to history
        self.memory_service.record_trade(closed)
        self._closed_today.append(closed)

        # Update risk state
        self.state = self.risk_manager.update_risk_state(self.state, closed)

        pnl_val = float(closed.get('pnl_usdt', 0))
        pnl_pct_val = float(closed.get('pnl_pct', 0))

        # Update portfolio equity (paper trading)
        if self.state.get("system", {}).get("mode") == "paper":
            self.state["portfolio"]["total_equity"] = max(0, self.state["portfolio"]["total_equity"] + pnl_val)
            self.state["portfolio"]["realized_pnl_today"] = (
                self.state["portfolio"].get("realized_pnl_today", 0) + pnl_val
            )

        # BTC Treasury Accumulation (70% of realized profits converted to BTC Spot)
        if pnl_val > 0 and symbol != "BTCUSDT":
            btc_convert_pct = self.config.get("spot", {}).get("btc_vault_profit_convert_pct", 0.70)
            btc_alloc_usdt = round(pnl_val * btc_convert_pct, 2)
            if btc_alloc_usdt >= 5.0:
                try:
                    btc_price = self.market_data.get_price("BTCUSDT") or 67000.0
                    btc_buy = self.executor.place_spot_market_buy("BTCUSDT", btc_alloc_usdt, btc_price)
                    if btc_buy.get("status") == "FILLED":
                        bought_btc = float(btc_buy.get("executedQty", 0)) or (btc_alloc_usdt / btc_price)
                        vault = self.state.setdefault("portfolio", {}).setdefault("btc_vault", {})
                        vault["btc_stack"] = round(vault.get("btc_stack", 0.0) + bought_btc, 8)
                        vault["total_invested_usdt"] = round(vault.get("total_invested_usdt", 0.0) + btc_alloc_usdt, 2)
                        vault["last_accumulated_at"] = datetime.utcnow().isoformat()
                        self._log_decision("BTCUSDT", "vault_accumulation", {},
                                           f"Accumulated +{bought_btc:.8f} BTC (${btc_alloc_usdt} USDT from 70% profit of {symbol})")
                        self.trade_logger.info(
                            f"₿ BTC VAULT ACCUMULATION | +{bought_btc:.8f} BTC | "
                            f"cost=${btc_alloc_usdt:.2f} USDT | source={symbol} (+${pnl_val:.2f})"
                        )
                except Exception as e:
                    logger.warning(f"BTC Vault accumulation buy failed: {e}")

        self._log_decision(symbol, f"exit_{reason}", {}, f"Closed @ {float(price):.4f} | PnL: {pnl_val:.2f}")
        self.trade_logger.info(
            f"CLOSE {trade_type.upper()} {side} {symbol} | reason={reason} | "
            f"price={float(price):.4f} | pnl={pnl_val:.2f} | "
            f"pnl_pct={pnl_pct_val:.3f}% | result={closed.get('result')}"
        )

        return closed

    def run_rebalance(self) -> Dict:
        """Check and execute portfolio rebalancing."""
        should, reason = self.portfolio_manager.should_rebalance()
        if not should:
            return {"status": "no_rebalance_needed", "reason": reason}

        logger.info(f"Rebalancing triggered: {reason}")
        self.state["system"]["last_rebalance"] = datetime.utcnow().isoformat()
        return {"status": "rebalanced", "reason": reason}

    def run_learning_update(self) -> Dict:
        """Trigger learning update from recent trade history."""
        recent_trades = self._closed_today + self._load_recent_trades(days=7)
        if not recent_trades:
            return {"status": "no_trades"}
        result = self.memory_service.update_learning(recent_trades)
        return result

    def run_daily_report(self) -> Dict:
        """Generate end-of-day report."""
        return self.report_service.generate_daily_report(self.state, self._closed_today)

    def get_full_status(self) -> Dict:
        """Full system status for UI."""
        portfolio = self.state.get("portfolio", {})
        risk_summary = self.risk_manager.get_risk_summary(self.state)

        # Update exposure
        self.state.setdefault("risk", {})["total_exposure_pct"] = self.portfolio_manager.get_total_exposure_pct()
        portfolio["unrealized_pnl"] = self.portfolio_manager.get_total_unrealized_pnl()

        # Multi-asset live wallet balances
        wallet_balances = {}
        try:
            if hasattr(self.executor, "get_account_balances"):
                wallet_balances = self.executor.get_account_balances()
        except Exception:
            pass

        return {
            "system": self.state.get("system", {}),
            "portfolio": portfolio,
            "wallet": wallet_balances,
            "risk": risk_summary,
            "positions": {
                "spot": list(self.state.get("positions", {}).get("spot", {}).values()),
                "futures": list(self.state.get("positions", {}).get("futures", {}).values()),
            },
            "scanner": {
                "symbols": self.state.get("scanner", {}).get("symbols", []),
                "market_regime": self.state.get("scanner", {}).get("market_regime", "unknown"),
                "last_signals": self.state.get("scanner", {}).get("last_signals", {}),
            },
            "scan_results": self._scan_results,
            "health": self.state.get("health", {}),
            "closed_today": self._closed_today[-20:],
        }

    def toggle_kill_switch(self, active: bool):
        self.state["system"]["kill_switch"] = active
        logger.warning(f"Kill switch {'ACTIVATED' if active else 'deactivated'}")

    def toggle_safe_mode(self, active: bool):
        self.state["system"]["safe_mode"] = active
        logger.info(f"Safe mode {'ACTIVATED' if active else 'deactivated'}")

    def set_mode(self, mode: str):
        valid = ["paper", "testnet", "live", "safe", "analysis"]
        if mode not in valid:
            raise ValueError(f"Invalid mode: {mode}")
        self.state["system"]["mode"] = mode
        if hasattr(self.executor, "mode"):
            self.executor.mode = mode
        logger.info(f"Trading mode set to: {mode}")

    def _determine_strategy(self, scan: Dict) -> str:
        """Determine which strategy type triggered the signal."""
        indicators = scan.get("indicators", {})
        ind_1h = indicators.get("1h", {})
        ind_4h = indicators.get("4h", {})
        sr = scan.get("support_resistance", {})

        if sr.get("at_support"):
            return "pullback"
        struct = ind_4h.get("market_structure", {})
        if struct.get("hh_hl"):
            bb = ind_1h.get("bb_width", 0)
            if bb and bb > 0.04:
                return "breakout"
            return "swing"
        return "rotational"

    def _log_decision(self, symbol: str, action: str, score: Dict, reason: str):
        decision = {
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": symbol,
            "action": action,
            "signal": score.get("signal", ""),
            "confidence": score.get("confidence", 0),
            "reason": reason,
            "regime": score.get("regime", {}).get("regime", "") if isinstance(score.get("regime"), dict) else "",
            "mode": self.state.get("system", {}).get("mode", "paper")
        }
        self.memory_service.record_decision(decision)
        self.decision_logger.info(
            f"{action.upper()} {symbol} | {reason[:100]} | conf={score.get('confidence', 0):.2%}"
        )

    def _load_recent_trades(self, days: int = 7) -> List[Dict]:
        from engine.storage import get_history_path, read_json
        trades = []
        for d in range(days):
            dt = datetime.utcnow() - timedelta(days=d)
            path = get_history_path("trades", dt)
            if path.exists():
                data = read_json(path, default=[])
                if isinstance(data, list):
                    trades.extend(data)
        return trades
