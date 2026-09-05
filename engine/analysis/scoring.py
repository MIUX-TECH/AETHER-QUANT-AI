"""
engine/analysis/scoring.py — AI Decision Scoring Engine.

Transparent, explainable scoring system that combines:
- Multi-timeframe technical analysis
- Market regime
- Candle/price action
- Volume confirmation
- Support/resistance
- Momentum
- HTF alignment
- Sentiment
- Historical memory context

Produces: signal, confidence, reasoning, bullish/bearish factors.
"""

import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

SIGNAL_LABELS = {
    "STRONG_BUY": "🟢 STRONG BUY",
    "BUY": "🟩 BUY",
    "HOLD": "🟡 HOLD",
    "REDUCE": "🟠 REDUCE",
    "SELL": "🔴 SELL",
    "SHORT": "🔻 SHORT",
    "AVOID": "⛔ AVOID",
    "WAIT": "⏳ WAIT"
}


class ScoringEngine:
    def __init__(self, config: Dict = None, memory: Dict = None):
        self.config = config or {}
        self.memory = memory or {}
        self.weights = self.config.get("scoring", {}).get("weights", {
            "trend": 0.20, "momentum": 0.18, "structure": 0.15,
            "volume": 0.12, "htf_alignment": 0.15, "volatility": 0.08,
            "sentiment": 0.07, "risk": 0.05
        })
        self.thresholds = self.config.get("scoring", {}).get("thresholds", {
            "STRONG_BUY": 0.82, "BUY": 0.68, "HOLD": 0.52,
            "REDUCE": 0.42, "SELL": 0.32, "SHORT": 0.22
        })
        # Load adaptive weights from memory if available
        if memory and "adaptive_weights" in memory:
            self._apply_adaptive_weights(memory["adaptive_weights"])

    def _apply_adaptive_weights(self, adaptive: Dict):
        for key, val in adaptive.items():
            if key in self.weights:
                # Blend: 80% original + 20% learned
                self.weights[key] = self.weights[key] * 0.8 + val * 0.2

    def score_asset(self, symbol: str, indicators: Dict[str, Dict],
                    regime: Dict, sentiment_score: float = 0.5,
                    coin_memory: Dict = None) -> Dict:
        """
        Main scoring function. indicators is a dict keyed by timeframe.
        Returns full scoring breakdown with signal and reasoning.
        """
        ind_1d = indicators.get("1d", {})
        ind_4h = indicators.get("4h", {})
        ind_1h = indicators.get("1h", {})
        ind_15m = indicators.get("15m", {})
        ind_5m = indicators.get("5m", {})

        bullish_factors = []
        bearish_factors = []
        neutral_factors = []

        # =====================================
        # 1. TREND SCORE (20%)
        # =====================================
        trend_score = 0.0
        trend_notes = []

        # --- EMA sub-score (60% of trend pillar) ---
        ema_sub = 0.0
        if ind_1d.get("ema_aligned_bullish"):
            ema_sub += 0.35
            bullish_factors.append("Daily EMA fully bullish aligned (9>21>50)")
        elif ind_1d.get("above_ema200"):
            ema_sub += 0.15
            bullish_factors.append("Price above EMA200 daily")

        if ind_4h.get("ema_aligned_bullish"):
            ema_sub += 0.30
            bullish_factors.append("4H EMA aligned bullish")
        elif ind_4h.get("above_ema50"):
            ema_sub += 0.15

        if ind_1h.get("ema_aligned_bullish"):
            ema_sub += 0.20
            bullish_factors.append("1H EMA bullish")

        if ind_1d.get("ema_aligned_bearish"):
            ema_sub -= 0.40
            bearish_factors.append("Daily EMA bearish aligned — macro downtrend")
        if ind_4h.get("ema_aligned_bearish"):
            ema_sub -= 0.30
            bearish_factors.append("4H EMA bearish aligned")

        ema_sub = max(0, min(1, ema_sub + 0.15))

        # --- SuperTrend sub-score (40% of trend pillar) ---
        st_sub = 0.5  # neutral baseline
        st_dir_4h = ind_4h.get("supertrend_direction", 0)
        st_dir_1h = ind_1h.get("supertrend_direction", 0)
        st_dir_1d = ind_1d.get("supertrend_direction", 0)

        if st_dir_1d == "bullish":
            st_sub += 0.25
            bullish_factors.append("SuperTrend Daily: Bullish")
        elif st_dir_1d == "bearish":
            st_sub -= 0.25
            bearish_factors.append("SuperTrend Daily: Bearish")

        if st_dir_4h == "bullish":
            st_sub += 0.20
            bullish_factors.append("SuperTrend 4H: Bullish")
        elif st_dir_4h == "bearish":
            st_sub -= 0.20
            bearish_factors.append("SuperTrend 4H: Bearish")

        if st_dir_1h == "bullish":
            st_sub += 0.10
        elif st_dir_1h == "bearish":
            st_sub -= 0.10

        st_sub = max(0.0, min(1.0, st_sub))

        trend_score = ema_sub * 0.60 + st_sub * 0.40
        trend_score = max(0.0, min(1.0, trend_score))

        # =====================================
        # 2. MOMENTUM SCORE (18%)
        # =====================================
        momentum_score = 0.5

        rsi_1d = ind_1d.get("rsi") or 50
        rsi_4h = ind_4h.get("rsi") or 50
        rsi_1h = ind_1h.get("rsi") or 50

        # RSI momentum
        if 50 < rsi_4h < 70:
            momentum_score += 0.15
            bullish_factors.append(f"RSI 4H bullish zone ({rsi_4h:.0f})")
        elif rsi_4h > 70:
            momentum_score -= 0.10
            bearish_factors.append(f"RSI 4H overbought ({rsi_4h:.0f})")
        elif rsi_4h < 30:
            momentum_score += 0.05  # potential bounce
            neutral_factors.append(f"RSI 4H oversold ({rsi_4h:.0f}) — watch for reversal")
        elif rsi_4h < 40:
            momentum_score -= 0.10
            bearish_factors.append(f"RSI 4H weak ({rsi_4h:.0f})")

        # MACD
        if ind_4h.get("macd_bullish"):
            momentum_score += 0.15
            bullish_factors.append("MACD 4H bullish crossover/histogram positive")
        elif ind_4h.get("macd_hist", 0) and ind_4h["macd_hist"] < 0:
            momentum_score -= 0.10
            bearish_factors.append("MACD 4H bearish")

        if ind_1h.get("macd_bullish"):
            momentum_score += 0.10
            bullish_factors.append("MACD 1H bullish")

        momentum_score = max(0, min(1, momentum_score))

        # =====================================
        # 3. STRUCTURE SCORE (15%)
        # =====================================
        structure_score = 0.5

        struct_1d = ind_1d.get("market_structure", {})
        struct_4h = ind_4h.get("market_structure", {})
        sr_1h = ind_1h.get("support_resistance", {})

        if struct_1d.get("hh_hl"):
            structure_score += 0.30
            bullish_factors.append("Daily market structure: HH/HL — uptrend confirmed")
        elif struct_1d.get("lh_ll"):
            structure_score -= 0.30
            bearish_factors.append("Daily market structure: LH/LL — downtrend confirmed")

        if struct_4h.get("hh_hl"):
            structure_score += 0.20
            bullish_factors.append("4H HH/HL structure bullish")
        elif struct_4h.get("lh_ll"):
            structure_score -= 0.20

        if sr_1h.get("at_support"):
            structure_score += 0.15
            bullish_factors.append("Price at key support level")
        if sr_1h.get("at_resistance"):
            structure_score -= 0.10
            bearish_factors.append("Price at resistance — potential rejection")

        # Candle patterns
        patterns_1h = ind_1h.get("candle_patterns", {})
        if patterns_1h.get("bullish_engulfing") or patterns_1h.get("hammer") or patterns_1h.get("morning_star"):
            structure_score += 0.15
            bullish_factors.append(f"Bullish candle pattern: {list(patterns_1h.keys())}")
        if patterns_1h.get("bearish_engulfing") or patterns_1h.get("shooting_star"):
            structure_score -= 0.10
            bearish_factors.append(f"Bearish candle pattern detected")

        structure_score = max(0, min(1, structure_score))

        # =====================================
        # 4. VOLUME SCORE (12%)
        # =====================================
        vol_sub = 0.5  # existing volume sub-score (70% of volume pillar)

        vol_1h = ind_1h.get("volume", {})
        vol_4h = ind_4h.get("volume", {})

        if vol_1h.get("spike") and ind_1h.get("above_ema21"):
            vol_sub += 0.30
            bullish_factors.append(f"Volume spike {vol_1h.get('ratio', 1):.1f}x avg with price above EMA21")
        elif vol_1h.get("spike"):
            vol_sub += 0.10
            neutral_factors.append("Volume spike detected (direction unclear)")

        if vol_1h.get("trend") == "increasing":
            vol_sub += 0.15
            bullish_factors.append("Volume trending up")
        elif vol_1h.get("trend") == "decreasing" and ind_1h.get("above_ema21"):
            vol_sub -= 0.10
            bearish_factors.append("Price rising but volume declining — weak move")

        taker_buy = vol_1h.get("taker_buy_pct", 0.5)
        if taker_buy > 0.60:
            vol_sub += 0.10
            bullish_factors.append(f"Taker buy pressure high ({taker_buy:.0%})")
        elif taker_buy < 0.40:
            vol_sub -= 0.10
            bearish_factors.append(f"Sell pressure dominant ({1-taker_buy:.0%} taker sell)")

        vol_sub = max(0.0, min(1.0, vol_sub))

        # --- OBV sub-score (30% of volume pillar) ---
        obv_sub = 0.5  # neutral baseline

        obv_trend_4h = ind_4h.get("obv_trend", "neutral")
        obv_trend_1h = ind_1h.get("obv_trend", "neutral")

        # OBV trend alignment with price
        price_up_4h = ind_4h.get("above_ema21", False)
        price_up_1h = ind_1h.get("above_ema21", False)

        if obv_trend_4h == "up" and price_up_4h:
            obv_sub += 0.25
            bullish_factors.append("OBV 4H rising with price — accumulation confirmed")
        elif obv_trend_4h == "down" and price_up_4h:
            obv_sub -= 0.25
            bearish_factors.append("OBV 4H divergence: price up but OBV falling — distribution")
        elif obv_trend_4h == "up" and not price_up_4h:
            obv_sub += 0.15
            bullish_factors.append("OBV 4H rising while price weak — hidden accumulation")
        elif obv_trend_4h == "down" and not price_up_4h:
            obv_sub -= 0.15

        if obv_trend_1h == "up":
            obv_sub += 0.10
        elif obv_trend_1h == "down":
            obv_sub -= 0.10

        # OBV above/below its EMA
        obv_val_4h = ind_4h.get("obv", 0)
        obv_ema_4h = ind_4h.get("obv_ema", 0)
        if obv_val_4h > obv_ema_4h and obv_ema_4h != 0:
            obv_sub += 0.10
        elif obv_val_4h < obv_ema_4h and obv_ema_4h != 0:
            obv_sub -= 0.10

        obv_sub = max(0.0, min(1.0, obv_sub))

        volume_score = vol_sub * 0.70 + obv_sub * 0.30
        volume_score = max(0.0, min(1.0, volume_score))

        # =====================================
        # 5. HTF ALIGNMENT SCORE (15%)
        # =====================================
        htf_score = 0.5

        above_ema200_1d = ind_1d.get("above_ema200", False)
        above_ema200_4h = ind_4h.get("above_ema200", False)
        rsi_1d_bull = 45 < rsi_1d < 75

        if above_ema200_1d:
            htf_score += 0.30
            bullish_factors.append("Price above 200 EMA on Daily — macro bull")
        else:
            htf_score -= 0.20
            bearish_factors.append("Price below 200 EMA Daily — macro bear")

        if above_ema200_4h:
            htf_score += 0.20

        if rsi_1d_bull:
            htf_score += 0.10
            neutral_factors.append(f"Daily RSI in healthy range ({rsi_1d:.0f})")

        # Regime alignment
        regime_name = regime.get("regime", "unknown")
        if regime_name == "trending_up":
            htf_score += 0.20
            bullish_factors.append("Regime: TRENDING UP — macro tailwind")
        elif regime_name in ["panic", "trending_down"]:
            htf_score -= 0.30
            bearish_factors.append(f"Regime: {regime_name.upper()} — adverse conditions")
        elif regime_name == "euphoria":
            htf_score -= 0.15

        htf_score = max(0, min(1, htf_score))

        # =====================================
        # 6. VOLATILITY SCORE (8%)
        # =====================================
        volatility_score = 0.5

        atr_pct_1h = ind_1h.get("atr_pct") or 0
        bb_width_1h = ind_1h.get("bb_width") or 0

        if 0.005 < atr_pct_1h < 0.03:
            volatility_score += 0.20
            neutral_factors.append(f"Volatility in tradeable range (ATR {atr_pct_1h:.1%})")
        elif atr_pct_1h > 0.05:
            volatility_score -= 0.20
            bearish_factors.append(f"Very high volatility (ATR {atr_pct_1h:.1%}) — risky")
        elif atr_pct_1h < 0.002:
            volatility_score -= 0.15
            neutral_factors.append("Very low volatility — low opportunity")

        volatility_score = max(0, min(1, volatility_score))

        # =====================================
        # 7. SENTIMENT SCORE (7%)
        # =====================================
        sentiment_score_norm = max(0, min(1, sentiment_score))
        if sentiment_score > 0.65:
            bullish_factors.append(f"Sentiment bullish ({sentiment_score:.0%})")
        elif sentiment_score < 0.35:
            bearish_factors.append(f"Sentiment bearish ({sentiment_score:.0%})")

        # =====================================
        # 8. RISK SCORE (5%) — inverted: higher = less risky
        # =====================================
        risk_score = 1.0 - regime.get("risk_level", 0.5)

        # =====================================
        # FINAL WEIGHTED SCORE
        # =====================================
        w = self.weights
        component_scores = {
            "trend": trend_score,
            "momentum": momentum_score,
            "structure": structure_score,
            "volume": volume_score,
            "htf_alignment": htf_score,
            "volatility": volatility_score,
            "sentiment": sentiment_score_norm,
            "risk": risk_score
        }

        final_score = sum(component_scores[k] * w.get(k, 0) for k in component_scores)
        final_score = max(0, min(1, final_score))

        # =====================================
        # SIGNAL DETERMINATION
        # =====================================
        t = self.thresholds
        if final_score >= t.get("STRONG_BUY", 0.82):
            signal = "STRONG_BUY"
        elif final_score >= t.get("BUY", 0.68):
            signal = "BUY"
        elif final_score >= t.get("HOLD", 0.52):
            signal = "HOLD"
        elif final_score >= t.get("REDUCE", 0.42):
            signal = "REDUCE"
        elif final_score >= t.get("SELL", 0.32):
            signal = "SELL"
        elif final_score >= t.get("SHORT", 0.22):
            signal = "SHORT"
        else:
            signal = "AVOID"

        # Override: always avoid in panic
        if regime_name == "panic":
            signal = "AVOID" if signal not in ["SHORT"] else "SHORT"

        # Reasoning summary
        reasoning = self._build_reasoning(signal, final_score, bullish_factors,
                                           bearish_factors, regime, component_scores)

        return {
            "symbol": symbol,
            "signal": signal,
            "signal_label": SIGNAL_LABELS.get(signal, signal),
            "confidence": round(final_score, 4),
            "component_scores": {k: round(v, 3) for k, v in component_scores.items()},
            "weights_used": {k: round(v, 3) for k, v in w.items()},
            "bullish_factors": bullish_factors,
            "bearish_factors": bearish_factors,
            "neutral_factors": neutral_factors,
            "regime": regime,
            "reasoning": reasoning,
            "timestamp": datetime.utcnow().isoformat(),
            "action_allowed": signal in ["STRONG_BUY", "BUY", "SHORT"],
            "should_exit": signal in ["SELL", "AVOID"],
            "should_reduce": signal == "REDUCE"
        }

    def _build_reasoning(self, signal: str, score: float, bullish: List,
                          bearish: List, regime: Dict, components: Dict) -> str:
        lines = [
            f"Signal: {SIGNAL_LABELS.get(signal, signal)} | Score: {score:.1%}",
            f"Regime: {regime.get('regime', 'unknown').upper()} — {regime.get('summary', '')}",
            "",
        ]
        if bullish:
            lines.append("✅ Bullish Factors:")
            for f in bullish[:5]:
                lines.append(f"  • {f}")
        if bearish:
            lines.append("⚠️ Bearish Factors:")
            for f in bearish[:5]:
                lines.append(f"  • {f}")
        lines += [
            "",
            "📊 Component Scores:",
            f"  Trend:{components['trend']:.0%} | Momentum:{components['momentum']:.0%} | "
            f"Structure:{components['structure']:.0%} | Volume:{components['volume']:.0%}",
            f"  HTF:{components['htf_alignment']:.0%} | Volatility:{components['volatility']:.0%} | "
            f"Sentiment:{components['sentiment']:.0%} | Risk:{components['risk']:.0%}"
        ]
        return "\n".join(lines)

    def score_for_futures(self, base_score: Dict, volatility: float) -> Dict:
        """Apply stricter filter for futures trades."""
        score = base_score.copy()
        conf = score.get("confidence", 0)
        # Futures need higher bar
        min_conf = self.config.get("risk", {}).get("min_confidence_futures", 0.75)
        if conf < min_conf:
            score["signal"] = "AVOID"
            score["signal_label"] = "⛔ AVOID (futures threshold not met)"
            score["action_allowed"] = False
            score["futures_reason"] = f"Confidence {conf:.1%} below futures minimum {min_conf:.1%}"
        else:
            score["futures_reason"] = f"Confidence {conf:.1%} meets futures threshold"
        # Leverage suggestion
        base_lev = self.config.get("futures", {}).get("default_leverage", 3)
        max_lev = self.config.get("futures", {}).get("max_leverage", 10)
        if volatility > 0.04:
            lev = 2
        elif volatility > 0.02:
            lev = min(base_lev, 4)
        elif conf > 0.85:
            lev = min(int(conf * max_lev), max_lev)
        else:
            lev = base_lev
        score["suggested_leverage"] = lev
        return score
