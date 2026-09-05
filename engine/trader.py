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


from engine.sentiment.fear_greed import FearGreedService
from engine.strategy.macro_tp import MacroCycleTPController
from engine.strategy.buyback_matrix import BuybackMatrix
from engine.strategy.grid_dca import GridDCAVault
from engine.strategy.mean_reversion import MeanReversionStrategy
from engine.strategy.momentum_breakout import MomentumBreakoutStrategy
from engine.strategy.halving_cycle import HalvingCycleManager

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
        self.fear_greed = FearGreedService()
        self.config = config
        self.state = state if isinstance(state, dict) else {}
        # Ensure required state sub-dictionaries exist to prevent KeyError crashes
        self.state.setdefault("system", {})
        self.state.setdefault("scanner", {})
        self.state.setdefault("portfolio", {})
        self.state.setdefault("positions", {"spot": {}, "futures": {}})
        self.state.setdefault("risk", {})
        self.ai_client = ai_client
        self.macro_tp = MacroCycleTPController(self.state)
        self.buyback_matrix = BuybackMatrix(self.state)
        self.grid_dca = GridDCAVault(self.state, self.config)
        self.halving_cycle = HalvingCycleManager()
        self.trade_logger = logging.getLogger("trade")
        self.decision_logger = logging.getLogger("decision")
        self._scan_results: Dict = {}
        self._closed_today: List[Dict] = []
        self._last_macro_check: float = 0

    def run_macro_cycle(self) -> Dict:
        """
        Evaluate macro strategies (TP, Buyback, Grid DCA, Halving Cycle).
        Runs every 4 hours.
        """
        logger.info("Starting Macro Cycle Check...")
        try:
            fng_data = self.fear_greed.get_index()
            fng_val = fng_data.get("value", 50)
            
            # 1. Update cycle phase
            cycle_phase, cycle_name = self.halving_cycle.determine_phase()
            self.state["system"]["cycle_phase"] = cycle_phase
            logger.info(f"Current Halving Phase: {cycle_name}")
            
            # Get BTC price for checks
            if not self._scan_results or "BTCUSDT" not in self._scan_results:
                return {"status": "skipped", "reason": "No scan results for BTCUSDT"}
                
            btc_scan = self._scan_results["BTCUSDT"]
            btc_price = btc_scan.get("price", 0)
            
            # Placeholder for ATH (usually queried from historical data)
            btc_ath = 73750.0  # Temporary placeholder based on recent ATH
            
            # Fetch indicators from scan
            inds = btc_scan.get("indicators", {})
            ind_1d = inds.get("1d", {})
            ema200 = ind_1d.get("ema200", 0)
            
            # 2. Evaluate Macro TP
            ema200_dist = max(0.0, (btc_price - ema200) / ema200 * 100) if ema200 > 0 else 0.0
            tp_res = self.macro_tp.evaluate(fng_val, ema200_dist)
            if tp_res.get("trigger"):
                self.decision_logger.info(f"MACRO TP TRIGGERED: {tp_res['tier']} -> {tp_res['reason']}")
                # Execute TP ... (simplified logging for now)
                
            # 3. Evaluate Buyback Matrix
            bb_res = self.buyback_matrix.evaluate(fng_val, btc_price, btc_ath, ema200)
            if bb_res.get("trigger"):
                self.decision_logger.info(f"BUYBACK TRIGGERED: {bb_res['tier']} -> {bb_res['reason']}")
                # Execute Buyback ... (simplified logging for now)
                
            # 4. Evaluate Grid DCA
            is_euphoria = (fng_val >= 85)
            dca_res = self.grid_dca.evaluate(btc_price, btc_ath, is_paused=is_euphoria)
            if dca_res.get("trigger"):
                self.decision_logger.info(f"GRID DCA TRIGGERED: Buy ${dca_res['buy_amount_usdt']} BTC")
                
            return {"status": "ok", "macro_tp": tp_res, "buyback": bb_res, "grid_dca": dca_res}
            
        except Exception as e:
            logger.error(f"Error in macro cycle: {e}")
            return {"status": "error", "message": str(e)}

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

        # Fetch Fear & Greed Index
        try:
            fng_data = self.fear_greed.get_index()
            fng_score = fng_data.get("normalized", 0.5)
            self.state["system"]["fear_greed"] = fng_data
        except Exception as e:
            logger.warning(f"FearGreed integration failed: {e}")
            fng_score = 0.5

        # Get sentiment
        try:
            sentiment_data = self.news_service.get_sentiment_scores(symbols)
            # Mix News Sentiment and Fear & Greed (50/50 mix or pass directly)
            sentiment = {s: (d["score"] + fng_score) / 2 for s, d in sentiment_data.items()}
            unavailable = [s for s, d in sentiment_data.items() if not d.get("data_available")]
            if unavailable:
                logger.warning(f"Sentiment data unavailable for: {', '.join(unavailable)}")
        except Exception as e:
            logger.warning(f"Sentiment fetch failed: {e}")
            sentiment = {s: fng_score for s in symbols}

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

        # --- STEP 1.5: Macro strategy check (every 4 hours) ---
        macro_result = self._maybe_run_macro_strategies()

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

        return {"status": "ok", "exits": exits, "entries": executed, "macro": macro_result}

    def _maybe_run_macro_strategies(self) -> Optional[Dict]:
        """Run macro TP and buyback checks every 4 hours."""
        now = time.time()
        macro_interval = 4 * 3600  # 4 hours
        if now - self._last_macro_check < macro_interval:
            return None
        self._last_macro_check = now
        return self.run_macro_strategy_cycle()

    def run_macro_strategy_cycle(self) -> Dict:
        """
        Full macro strategy evaluation:
        1. Fetch Fear & Greed and BTC EMA200/ATH data
        2. Evaluate MacroCycleTP for euphoria-based portfolio sells
        3. Evaluate BuybackMatrix for deep-fear-based buys
        """
        result = {"macro_tp": None, "buyback": None}

        # Gather macro inputs
        fng_data = self.state.get("system", {}).get("fear_greed", {})
        fng_value = fng_data.get("value", 50)

        btc_scan = self._scan_results.get("BTCUSDT", {})
        btc_price = btc_scan.get("price", 0)
        if not btc_price:
            btc_price = self.market_data.get_price("BTCUSDT") or 0
        if not btc_price:
            logger.debug("Macro strategy skipped: no BTC price available")
            return result

        # EMA200 from 1d indicators
        btc_ind_1d = btc_scan.get("indicators", {}).get("1d", {})
        ema200 = btc_ind_1d.get("ema200")
        if not ema200:
            # Fallback: try computing from candles
            candles = self.market_data.get_klines("BTCUSDT", "1d", 220)
            if candles and len(candles) >= 200:
                from engine.analysis.indicators import ema as calc_ema
                closes = [c["close"] for c in candles]
                ema_vals = calc_ema(closes, 200)
                ema200 = ema_vals[-1] if ema_vals and ema_vals[-1] is not None else None

        ema200_dist_pct = 0.0
        if ema200 and ema200 > 0:
            ema200_dist_pct = ((btc_price - ema200) / ema200) * 100.0

        # --- Macro TP evaluation ---
        tp_eval = self.macro_tp.evaluate(fng_value, ema200_dist_pct)
        result["macro_tp"] = tp_eval

        if tp_eval.get("trigger"):
            self._execute_macro_tp(tp_eval)

        # --- Buyback evaluation ---
        ath_price = self._get_btc_ath()
        bb_eval = self.buyback_matrix.evaluate(fng_value, btc_price, ath_price, ema200)
        result["buyback"] = bb_eval

        if bb_eval.get("trigger"):
            self._execute_buyback(bb_eval, btc_price)

        # Persist state changes from cooldown tracking
        self.state["macro_tp"] = self.macro_tp._tp_state
        self.state["buyback_matrix"] = self.buyback_matrix._bb_state

        return result

    def _get_btc_ath(self) -> float:
        """Get BTC all-time high from state or default."""
        ath = self.state.get("macro_tp", {}).get("btc_ath", 0)
        btc_price = self.market_data.get_price("BTCUSDT") or 0
        if btc_price > ath:
            ath = btc_price
            self.state.setdefault("macro_tp", {})["btc_ath"] = ath
        return ath if ath > 0 else 109000.0  # fallback BTC ATH

    def _execute_macro_tp(self, tp_eval: Dict):
        """Sell a fraction of spot portfolio based on macro TP tier."""
        sell_pct = tp_eval["sell_pct"]
        tier = tp_eval["tier"]
        mode = self.state.get("system", {}).get("mode", "paper")

        positions = self.state.get("positions", {}).get("spot", {})
        if not positions:
            return

        for symbol, pos in list(positions.items()):
            if pos.get("status") != "active":
                continue
            qty = pos.get("qty", 0)
            sell_qty = qty * sell_pct
            if sell_qty <= 0:
                continue

            price = self.market_data.get_price(symbol) or pos.get("current_price", 0)
            if not price:
                continue

            sell_usdt = sell_qty * price
            if sell_usdt < 5.0:
                continue

            if mode in ["paper", "testnet", "live"]:
                self.executor.ensure_spot_balance(symbol, sell_qty)
                order = self.executor.place_spot_market_sell(symbol, sell_qty, price)
                if order.get("status") == "FILLED":
                    pos["qty"] = qty - sell_qty
                    pos["position_usdt"] = pos["qty"] * price
                    self.state["positions"]["spot"][symbol] = pos
                    self._log_decision(
                        symbol, f"macro_tp_{tier}",
                        {"signal": "MACRO_TP", "confidence": 0.95},
                        f"Macro TP [{tier}] sold {sell_pct:.0%} ({sell_qty:.6f}) @ {price:.4f}"
                    )
                    self.trade_logger.info(
                        f"MACRO TP [{tier.upper()}] {symbol} | sold {sell_pct:.0%} | "
                        f"qty={sell_qty:.6f} | price={price:.4f} | usdt={sell_usdt:.2f}"
                    )

    def _execute_buyback(self, bb_eval: Dict, btc_price: float):
        """Deploy cash into BTC based on buyback matrix tier."""
        deploy_pct = bb_eval["deploy_pct"]
        tier = bb_eval["tier"]
        mode = self.state.get("system", {}).get("mode", "paper")
        total_equity = self.state.get("portfolio", {}).get("total_equity", 0)
        deploy_usdt = total_equity * deploy_pct

        if deploy_usdt < 5.0:
            return

        available = self.portfolio_manager.get_available_for_trade("spot", "BTCUSDT")
        deploy_usdt = min(deploy_usdt, available)
        if deploy_usdt < 5.0:
            return

        if mode in ["paper", "testnet", "live"]:
            order = self.executor.place_spot_market_buy("BTCUSDT", deploy_usdt, btc_price)
            if order.get("status") == "FILLED":
                fill_qty = float(order.get("executedQty", 0)) or (deploy_usdt / btc_price)
                fill_price = float(order.get("price", 0)) or btc_price
                sizing = {
                    "position_usdt": deploy_usdt,
                    "position_qty": fill_qty,
                    "sl_price": round(fill_price * 0.90, 4),
                    "tp_price": round(fill_price * 1.20, 4),
                    "trailing_stop_pct": 0.05,
                    "leverage": 1,
                    "entry_price": fill_price,
                }
                signal = {"signal": "BUYBACK", "confidence": 0.90, "strategy": f"buyback_{tier}"}
                position = self.portfolio_manager.open_position(
                    "BTCUSDT", "BUY", "spot", order, sizing, signal
                )
                existing = self.state.get("positions", {}).get("spot", {}).get("BTCUSDT")
                if existing and existing.get("status") == "active":
                    # Merge into existing position (average up)
                    old_qty = existing.get("qty", 0)
                    old_entry = existing.get("entry_price", fill_price)
                    new_qty = old_qty + fill_qty
                    new_entry = ((old_entry * old_qty) + (fill_price * fill_qty)) / new_qty if new_qty > 0 else fill_price
                    existing["qty"] = new_qty
                    existing["entry_price"] = round(new_entry, 4)
                    existing["position_usdt"] = round(new_qty * fill_price, 2)
                    self.state["positions"]["spot"]["BTCUSDT"] = existing
                else:
                    self.state.setdefault("positions", {}).setdefault("spot", {})["BTCUSDT"] = position

                self._log_decision(
                    "BTCUSDT", f"buyback_{tier}",
                    {"signal": "BUYBACK", "confidence": 0.90},
                    f"Buyback [{tier}] deployed ${deploy_usdt:.2f} @ {fill_price:.4f}"
                )
                self.trade_logger.info(
                    f"BUYBACK [{tier.upper()}] BTCUSDT | deployed ${deploy_usdt:.2f} | "
                    f"qty={fill_qty:.8f} | price={fill_price:.4f} | "
                    f"F&G={bb_eval.get('fng')} | ATH drop={bb_eval.get('ath_drop_pct'):.1f}%"
                )

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

        # Available capital (Min Binance Spot Notional is $5.00)
        available = self.portfolio_manager.get_available_for_trade("spot", symbol)
        if available < 5.0:
            return {"executed": False, "reason": f"Insufficient capital: ${available:.2f} (min $5.00)"}

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

        if sizing["position_usdt"] < 5.0:
            return {"executed": False, "reason": "Position too small (< $5.00 Binance min)"}

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
        if available < 1.67:
            return {"executed": False, "reason": f"Insufficient futures margin: ${available:.2f} (min $1.67)"}

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

        if trade_type == "spot":
            self.executor.ensure_spot_balance(symbol, partial_qty)
            
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
            # Auto-redeem from Earn if balance is insufficient
            self.executor.ensure_spot_balance(symbol, qty)
            order = self.executor.place_spot_market_sell(symbol, qty, price)
        else:
            order = self.executor.place_futures_order(
                symbol, close_side, qty, price, "MARKET",
                position.get("leverage", 1), reduce_only=True
            )

        if order.get("status") != "FILLED":
            if hasattr(self.executor, "emergency_close_position") and reason in ["stop_loss", "trailing_stop"]:
                logger.warning(f"Normal close failed for {symbol}, attempting emergency close")
                order = self.executor.emergency_close_position(symbol, qty, close_side, trade_type)
            if order.get("status") != "FILLED" and not (order.get("orderId") and order.get("executedQty")):
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
        """
        Check and execute automatic portfolio rebalancing between Spot and Futures via Binance SAPI.
        If Spot free USDT is insufficient, pends the transfer until funds are available.
        """
        allocations = self.portfolio_manager.get_allocations()
        total_equity = float(allocations.get("total", 0.0) or self.state.get("portfolio", {}).get("total_equity", 0.0))
        
        if total_equity <= 0:
            return {"status": "skipped", "reason": "No equity detected"}

        futures_target = float(allocations.get("futures_budget", total_equity * 0.10))
        
        # Get live futures margin balance
        futures_current = 0.0
        try:
            if hasattr(self.executor, "get_futures_account"):
                fut_acc = self.executor.get_futures_account()
                futures_current = float(fut_acc.get("totalMarginBalance", 0.0))
        except Exception:
            futures_current = float(self.state.get("portfolio", {}).get("futures_equity", 0.0))

        # Get live Spot Free USDT
        spot_free_usdt = 0.0
        try:
            if hasattr(self.executor, "get_account_balances"):
                balances = self.executor.get_account_balances()
                spot_free_usdt = float(balances.get("USDT", {}).get("free", 0.0))
        except Exception:
            pass

        deficit = round(futures_target - futures_current, 2)
        surplus = round(futures_current - (futures_target * 1.5), 2)

        min_transfer = max(5.0, self.config.get("portfolio", {}).get("min_rebalance_transfer_usdt", 5.0))

        # CASE 1: Futures Deficit (Transfer from Spot -> Futures)
        if deficit >= min_transfer:
            if spot_free_usdt >= deficit and (spot_free_usdt - deficit) >= 5.0:
                logger.info(f"⚖️ EXECUTING AUTO-REBALANCE: Transferring ${deficit} USDT from Spot -> Futures")
                transfer_res = self.executor.execute_futures_transfer(deficit, "spot_to_futures")
                self.state["system"]["last_rebalance"] = datetime.utcnow().isoformat()
                return {
                    "status": "rebalanced_transferred",
                    "direction": "spot_to_futures",
                    "amount": deficit,
                    "transfer_result": transfer_res
                }
            else:
                if spot_free_usdt < 0.01:
                    logger.debug(f"Rebalance skipped: Spot USDT is zero, waiting for realized profits")
                    return {"status": "skipped_zero_balance", "reason": "Spot USDT is zero — will rebalance after next profitable trade close"}
                reason = f"Pending transfer: Spot Free USDT (${spot_free_usdt:.2f}) insufficient for ${deficit:.2f} transfer (min ${min_transfer:.0f})"
                logger.info(f"⏳ REBALANCE PENDING: {reason}")
                return {"status": "pending_insufficient_spot_usdt", "reason": reason, "spot_free": spot_free_usdt, "needed": deficit}

        # CASE 2: Futures Surplus (Sweep back from Futures -> Spot & 70% BTC Vault convert)
        elif surplus >= min_transfer:
            logger.info(f"⚖️ EXECUTING AUTO-SWEEP: Transferring ${surplus} USDT surplus from Futures -> Spot")
            transfer_res = self.executor.execute_futures_transfer(surplus, "futures_to_spot")
            
            # Convert 70% of swept surplus to BTC Vault
            btc_alloc_usdt = surplus * 0.70
            if btc_alloc_usdt >= 5.0 and hasattr(self.executor, "place_spot_market_buy"):
                btc_order = self.executor.place_spot_market_buy("BTCUSDT", btc_alloc_usdt)
                logger.info(f"🪙 AUTO-SWEEP BTC VAULT CONVERT: {btc_order}")

            self.state["system"]["last_rebalance"] = datetime.utcnow().isoformat()
            return {
                "status": "rebalanced_swept",
                "direction": "futures_to_spot",
                "amount": surplus,
                "transfer_result": transfer_res
            }

        self.state["system"]["last_rebalance"] = datetime.utcnow().isoformat()
        return {"status": "balanced", "reason": f"Futures equity (${futures_current:.2f}) aligned with target (${futures_target:.2f})"}

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

    def _sync_positions_from_holdings(self, wallet_balances: Dict) -> None:
        """Reconstruct active position objects if memory state was reset after container reboot."""
        if not wallet_balances or not isinstance(wallet_balances, dict):
            return
        
        spot_dict = self.state.setdefault("positions", {}).setdefault("spot", {})
        
        SYMBOLS_MAP = {
            "BTC": "BTCUSDT",
            "ETH": "ETHUSDT",
            "SOL": "SOLUSDT",
            "BNB": "BNBUSDT",
            "XRP": "XRPUSDT",
            "NEAR": "NEARUSDT",
            "AVAX": "AVAXUSDT"
        }
        for base, sym in SYMBOLS_MAP.items():
            qty_spot = float(wallet_balances.get(base, {}).get("total", 0.0))
            qty_earn = float(wallet_balances.get(f"LD{base}", {}).get("total", 0.0))
            tot_qty = qty_spot + qty_earn
            if tot_qty <= 0:
                continue

            FALLBACK_PRICES = {
                "BTCUSDT": 80800.0, "ETHUSDT": 2500.0, "SOLUSDT": 103.0,
                "BNBUSDT": 615.0, "XRPUSDT": 2.20, "NEARUSDT": 3.80, "AVAXUSDT": 23.0
            }
            curr_price = self.market_data.get_price(sym)
            if not curr_price or curr_price <= 1.0:
                curr_price = FALLBACK_PRICES.get(sym, 1.0)
            val_usd = tot_qty * curr_price
            
            # If position already exists, update live valuation & PnL
            if sym in spot_dict:
                entry_p = float(spot_dict[sym].get("entry_price") or curr_price)
                pnl_pct = ((curr_price - entry_p) / entry_p) * 100 if entry_p > 0 else 0
                pnl_usd = (curr_price - entry_p) * tot_qty
                spot_dict[sym]["symbol"] = sym
                spot_dict[sym]["side"] = spot_dict[sym].get("side", "BUY")
                spot_dict[sym]["trade_type"] = "spot"
                spot_dict[sym]["qty"] = tot_qty
                spot_dict[sym]["entry_price"] = round(entry_p, 4)
                spot_dict[sym]["current_price"] = round(curr_price, 4)
                spot_dict[sym]["position_usdt"] = round(val_usd, 2)
                spot_dict[sym]["unrealized_pnl"] = round(pnl_usd, 4)
                spot_dict[sym]["unrealized_pnl_pct"] = round(pnl_pct, 2)
                spot_dict[sym].setdefault("sl_price", round(entry_p * 0.98, 4))
                spot_dict[sym].setdefault("tp_price", round(entry_p * 1.035, 4))
                trail = spot_dict[sym].get("trailing_stop_pct", 0.025)
                spot_dict[sym]["trailing_stop_price"] = round(curr_price * (1 - trail), 4)
                spot_dict[sym].setdefault("status", "active")
                continue

            # Only track meaningful positions (> $1.00)
            if val_usd >= 1.0:
                entry_price = curr_price
                # Try to get true entry price from recent myTrades
                try:
                    trades = self.executor.get_my_trades(sym, limit=5)
                    buy_trades = [t for t in trades if t.get("isBuyer", True)]
                    if buy_trades:
                        entry_price = float(buy_trades[-1].get("price", curr_price))
                except Exception:
                    entry_price = curr_price

                pnl_pct = ((curr_price - entry_price) / entry_price) * 100 if entry_price > 0 else 0
                pnl_usd = (curr_price - entry_price) * tot_qty

                spot_dict[sym] = {
                    "symbol": sym,
                    "side": "BUY",
                    "trade_type": "spot",
                    "entry_price": round(entry_price, 4),
                    "current_price": round(curr_price, 4),
                    "qty": tot_qty,
                    "position_usdt": round(val_usd, 2),
                    "sl_price": round(entry_price * 0.98, 4),
                    "tp_price": round(entry_price * 1.035, 4),
                    "trailing_stop_pct": 0.025,
                    "trailing_stop_price": round(curr_price * 0.975, 4),
                    "unrealized_pnl": round(pnl_usd, 4),
                    "unrealized_pnl_pct": round(pnl_pct, 2),
                    "status": "active",
                    "opened_at": datetime.utcnow().isoformat(),
                    "regime": self.state.get("scanner", {}).get("market_regime", "trending_up"),
                    "reconstructed": True
                }

    def get_full_status(self) -> Dict:
        """Full system status for UI."""
        portfolio = self.state.get("portfolio", {})
        risk_summary = self.risk_manager.get_risk_summary(self.state)

        # Multi-asset live wallet balances
        wallet_balances = {}
        try:
            if hasattr(self.executor, "get_account_balances"):
                wallet_balances = self.executor.get_account_balances()
                self._sync_positions_from_holdings(wallet_balances)
        except Exception:
            pass

        # Update exposure & PnL
        self.state.setdefault("risk", {})["total_exposure_pct"] = self.portfolio_manager.get_total_exposure_pct()
        portfolio["unrealized_pnl"] = self.portfolio_manager.get_total_unrealized_pnl()

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
        
        fng_val = self.state.get("system", {}).get("fear_greed", {}).get("value", 50)
        regime = scan.get("regime", {}).get("regime", "unknown")

        # 1. Mean Reversion Check
        mr_eval = MeanReversionStrategy.evaluate(ind_1h, fng_val, regime)
        if mr_eval.get("trigger"):
            return "mean_reversion"

        # 2. Momentum Breakout Check
        mb_eval = MomentumBreakoutStrategy.evaluate(ind_1h, sr)
        if mb_eval.get("trigger"):
            return "momentum_breakout"

        # 3. Fallbacks / Defaults
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
