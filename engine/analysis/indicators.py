"""
engine/analysis/indicators.py — Pure-Python technical indicators.
No external TA libs required. All computed from OHLCV candle lists.
"""

import math
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


def _safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safe division to prevent ZeroDivisionError."""
    try:
        if denominator is None or abs(denominator) < 1e-12:
            return default
        return float(numerator) / float(denominator)
    except (TypeError, ValueError, ZeroDivisionError):
        return default


def _closes(candles: List[Dict]) -> List[float]:
    return [c["close"] for c in candles]

def _highs(candles: List[Dict]) -> List[float]:
    return [c["high"] for c in candles]

def _lows(candles: List[Dict]) -> List[float]:
    return [c["low"] for c in candles]

def _volumes(candles: List[Dict]) -> List[float]:
    return [c["volume"] for c in candles]


def ema(values: List[float], period: int) -> List[float]:
    """Exponential Moving Average."""
    if len(values) < period:
        return [None] * len(values)
    k = 2 / (period + 1)
    result = [None] * (period - 1)
    sma = sum(values[:period]) / period
    result.append(sma)
    for v in values[period:]:
        result.append(result[-1] * (1 - k) + v * k)
    return result


def sma(values: List[float], period: int) -> List[float]:
    result = []
    for i in range(len(values)):
        if i < period - 1:
            result.append(None)
        else:
            result.append(sum(values[i - period + 1:i + 1]) / period)
    return result


def rsi(values: List[float], period: int = 14) -> List[float]:
    """Relative Strength Index."""
    result = [None] * period
    gains, losses = [], []
    for i in range(1, period + 1):
        delta = values[i] - values[i - 1]
        gains.append(max(delta, 0))
        losses.append(max(-delta, 0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        result.append(100.0)
    else:
        rs = avg_gain / avg_loss
        result.append(100 - (100 / (1 + rs)))
    for i in range(period + 1, len(values)):
        delta = values[i] - values[i - 1]
        gain = max(delta, 0)
        loss = max(-delta, 0)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        if avg_loss == 0:
            result.append(100.0)
        else:
            rs = avg_gain / avg_loss
            result.append(100 - (100 / (1 + rs)))
    return result


def macd(values: List[float], fast: int = 12, slow: int = 26, signal: int = 9
         ) -> Tuple[List[float], List[float], List[float]]:
    """MACD line, signal line, histogram."""
    ema_fast = ema(values, fast)
    ema_slow = ema(values, slow)
    macd_line = []
    for f, s in zip(ema_fast, ema_slow):
        if f is None or s is None:
            macd_line.append(None)
        else:
            macd_line.append(f - s)
    valid_macd = [v for v in macd_line if v is not None]
    if len(valid_macd) < signal:
        sig_line = [None] * len(macd_line)
        hist = [None] * len(macd_line)
    else:
        sig_values = ema(valid_macd, signal)
        offset = len(macd_line) - len(valid_macd)
        sig_line = [None] * offset + sig_values
        hist = []
        for m, s in zip(macd_line, sig_line):
            if m is None or s is None:
                hist.append(None)
            else:
                hist.append(m - s)
    return macd_line, sig_line, hist


def atr(candles: List[Dict], period: int = 14) -> List[float]:
    """Average True Range."""
    trs = [None]
    for i in range(1, len(candles)):
        h = candles[i]["high"]
        l = candles[i]["low"]
        pc = candles[i - 1]["close"]
        tr = max(h - l, abs(h - pc), abs(l - pc))
        trs.append(tr)
    result = [None] * period
    valid = [t for t in trs if t is not None]
    if len(valid) < period:
        return result
    atr_val = sum(valid[:period]) / period
    result.append(atr_val)
    for tr in valid[period:]:
        atr_val = (atr_val * (period - 1) + tr) / period
        result.append(atr_val)
    # Pad to match input length
    while len(result) < len(candles):
        result.insert(0, None)
    return result[-len(candles):]


def supertrend(candles: List[Dict], period: int = 10, multiplier: float = 3.0) -> Tuple[List[float], List[str]]:
    """
    SuperTrend Indicator.
    Returns (supertrend_values, supertrend_directions)
    Direction is 'bullish' or 'bearish'.
    """
    if len(candles) < period:
        return [None]*len(candles), [None]*len(candles)
        
    atr_vals = atr(candles, period)
    st_vals = [None] * len(candles)
    st_dir = [None] * len(candles)
    
    # Initialize basic upper and lower bands
    basic_upper = [None] * len(candles)
    basic_lower = [None] * len(candles)
    
    for i in range(len(candles)):
        h, l = candles[i]["high"], candles[i]["low"]
        hl2 = (h + l) / 2
        a = atr_vals[i]
        
        if a is not None:
            basic_upper[i] = hl2 + multiplier * a
            basic_lower[i] = hl2 - multiplier * a
            
    # Calculate SuperTrend
    final_upper = [None] * len(candles)
    final_lower = [None] * len(candles)
    
    for i in range(period, len(candles)):
        if i == period:
            final_upper[i] = basic_upper[i]
            final_lower[i] = basic_lower[i]
            st_vals[i] = final_upper[i]
            st_dir[i] = "bearish"
            continue
            
        # Upper band logic
        if basic_upper[i] < final_upper[i-1] or candles[i-1]["close"] > final_upper[i-1]:
            final_upper[i] = basic_upper[i]
        else:
            final_upper[i] = final_upper[i-1]
            
        # Lower band logic
        if basic_lower[i] > final_lower[i-1] or candles[i-1]["close"] < final_lower[i-1]:
            final_lower[i] = basic_lower[i]
        else:
            final_lower[i] = final_lower[i-1]
            
        # Direction and value logic
        prev_st = st_vals[i-1]
        prev_dir = st_dir[i-1]
        curr_close = candles[i]["close"]
        
        if prev_dir == "bearish" and curr_close > final_upper[i]:
            st_dir[i] = "bullish"
            st_vals[i] = final_lower[i]
        elif prev_dir == "bullish" and curr_close < final_lower[i]:
            st_dir[i] = "bearish"
            st_vals[i] = final_upper[i]
        else:
            st_dir[i] = prev_dir
            st_vals[i] = final_lower[i] if st_dir[i] == "bullish" else final_upper[i]
            
    return st_vals, st_dir


def obv(candles: List[Dict]) -> List[float]:
    """On-Balance Volume (OBV)."""
    if not candles:
        return []
        
    result = [0.0]
    for i in range(1, len(candles)):
        curr_c = candles[i]["close"]
        prev_c = candles[i-1]["close"]
        vol = candles[i]["volume"]
        
        if curr_c > prev_c:
            result.append(result[-1] + vol)
        elif curr_c < prev_c:
            result.append(result[-1] - vol)
        else:
            result.append(result[-1])
            
    return result


def adx(candles: List[Dict], period: int = 14) -> Tuple[List[float], List[float], List[float]]:
    """ADX, +DI, -DI."""
    n = len(candles)
    if n < period + 1:
        return [None] * n, [None] * n, [None] * n

    trs, plus_dm, minus_dm = [], [], []
    for i in range(1, n):
        h, l, ph, pl, pc = (candles[i]["high"], candles[i]["low"],
                             candles[i - 1]["high"], candles[i - 1]["low"],
                             candles[i - 1]["close"])
        tr = max(h - l, abs(h - pc), abs(l - pc))
        pdm = max(h - ph, 0) if (h - ph) > (pl - l) else 0
        mdm = max(pl - l, 0) if (pl - l) > (h - ph) else 0
        trs.append(tr)
        plus_dm.append(pdm)
        minus_dm.append(mdm)

    def wilder_smooth(vals, p):
        result = [None] * (p - 1)
        s = sum(vals[:p])
        result.append(s)
        for v in vals[p:]:
            s = s - s / p + v
            result.append(s)
        return result

    atr_s = wilder_smooth(trs, period)
    pdm_s = wilder_smooth(plus_dm, period)
    mdm_s = wilder_smooth(minus_dm, period)

    pdi_vals, mdi_vals, dx_vals = [], [], []
    for a, p, m in zip(atr_s, pdm_s, mdm_s):
        if a is None or a == 0:
            pdi_vals.append(None)
            mdi_vals.append(None)
            dx_vals.append(None)
        else:
            pdi = 100 * p / a
            mdi = 100 * m / a
            pdi_vals.append(pdi)
            mdi_vals.append(mdi)
            if pdi + mdi == 0:
                dx_vals.append(0.0)
            else:
                dx_vals.append(100 * abs(pdi - mdi) / (pdi + mdi))

    valid_dx = [v for v in dx_vals if v is not None]
    if len(valid_dx) < period:
        adx_vals = [None] * (n - 1)
    else:
        adx_list = [None] * (len(dx_vals) - len(valid_dx) + period - 1)
        adx_val = sum(valid_dx[:period]) / period
        adx_list.append(adx_val)
        for dx in valid_dx[period:]:
            adx_val = (adx_val * (period - 1) + dx) / period
            adx_list.append(adx_val)
        adx_vals = adx_list

    # Offset by 1 (first candle has no TR)
    adx_out = [None] + adx_vals
    pdi_out = [None] + pdi_vals
    mdi_out = [None] + mdi_vals

    def pad(lst, target):
        while len(lst) < target:
            lst.insert(0, None)
        return lst[-target:]

    return pad(adx_out, n), pad(pdi_out, n), pad(mdi_out, n)


def bollinger_bands(values: List[float], period: int = 20, std_dev: float = 2.0
                    ) -> Tuple[List[float], List[float], List[float]]:
    """Returns (upper, middle, lower)."""
    middle = sma(values, period)
    upper, lower = [], []
    for i in range(len(values)):
        if i < period - 1 or middle[i] is None:
            upper.append(None)
            lower.append(None)
        else:
            window = values[i - period + 1:i + 1]
            mean = middle[i]
            variance = sum((v - mean) ** 2 for v in window) / period
            sd = math.sqrt(variance)
            upper.append(mean + std_dev * sd)
            lower.append(mean - std_dev * sd)
    return upper, middle, lower


def volume_profile(candles: List[Dict], period: int = 20) -> Dict:
    """Simple volume analysis: spike detection, average, trend."""
    vols = _volumes(candles)
    if len(vols) < period:
        return {"avg": 0, "current": 0, "spike": False, "trend": "neutral"}
    recent = vols[-period:]
    avg = sum(recent) / period
    current = vols[-1]
    spike = current > avg * 1.5
    # Volume trend: compare last 5 avg vs previous 5 avg
    if len(vols) >= 10:
        last5 = sum(vols[-5:]) / 5
        prev5 = sum(vols[-10:-5]) / 5
        if prev5 > 0:
            vol_trend = "increasing" if last5 > prev5 * 1.1 else (
                "decreasing" if last5 < prev5 * 0.9 else "neutral"
            )
        else:
            vol_trend = "neutral"
    else:
        vol_trend = "neutral"
    return {
        "avg": round(avg, 2),
        "current": round(current, 2),
        "ratio": round(_safe_div(current, avg, 1.0), 3),
        "spike": spike,
        "trend": vol_trend,
        "taker_buy_pct": _safe_div(candles[-1].get("taker_buy_volume", 0), max(current, 1), 0.0)
    }


def support_resistance(candles: List[Dict], lookback: int = 50) -> Dict:
    """Detect key S/R levels using swing highs/lows."""
    recent = candles[-lookback:]
    highs = _highs(recent)
    lows = _lows(recent)
    closes = _closes(recent)
    current_price = closes[-1]

    # Find swing highs/lows
    swing_highs, swing_lows = [], []
    for i in range(2, len(recent) - 2):
        if highs[i] > highs[i-1] and highs[i] > highs[i-2] and \
           highs[i] > highs[i+1] and highs[i] > highs[i+2]:
            swing_highs.append(highs[i])
        if lows[i] < lows[i-1] and lows[i] < lows[i-2] and \
           lows[i] < lows[i+1] and lows[i] < lows[i+2]:
            swing_lows.append(lows[i])

    # Cluster levels
    def cluster(levels, tolerance=0.005):
        if not levels:
            return []
        levels = sorted(levels)
        clusters = [[levels[0]]]
        for lv in levels[1:]:
            if lv <= clusters[-1][-1] * (1 + tolerance):
                clusters[-1].append(lv)
            else:
                clusters.append([lv])
        return [sum(c) / len(c) for c in clusters]

    res_levels = cluster(swing_highs)
    sup_levels = cluster(swing_lows)

    nearest_res = min((r for r in res_levels if r > current_price), default=None,
                      key=lambda x: x - current_price)
    nearest_sup = max((s for s in sup_levels if s < current_price), default=None,
                      key=lambda x: current_price - x)

    return {
        "resistance_levels": res_levels[-5:],
        "support_levels": sup_levels[-5:],
        "nearest_resistance": nearest_res,
        "nearest_support": nearest_sup,
        "distance_to_resistance_pct": round(_safe_div((nearest_res or 0) - current_price, current_price, 0) * 100, 2) if nearest_res else None,
        "distance_to_support_pct": round(_safe_div(current_price - (nearest_sup or 0), current_price, 0) * 100, 2) if nearest_sup else None,
        "at_support": nearest_sup is not None and _safe_div(current_price - nearest_sup, current_price, 1) < 0.015,
        "at_resistance": nearest_res is not None and _safe_div(nearest_res - current_price, current_price, 1) < 0.015,
    }


def candle_patterns(candles: List[Dict]) -> Dict:
    """Detect common candle patterns on last few candles."""
    if len(candles) < 3:
        return {}
    c = candles[-1]
    prev = candles[-2]
    prev2 = candles[-3]

    body = abs(c["close"] - c["open"])
    full_range = c["high"] - c["low"]
    upper_wick = c["high"] - max(c["close"], c["open"])
    lower_wick = min(c["close"], c["open"]) - c["low"]
    is_bullish = c["close"] > c["open"]
    is_bearish = c["close"] < c["open"]

    patterns = {}

    # Doji
    if full_range > 0 and _safe_div(body, full_range) < 0.1:
        patterns["doji"] = True

    # Hammer (bullish)
    if is_bullish and full_range > 0 and _safe_div(lower_wick, full_range) > 0.6 and _safe_div(body, full_range) > 0.2:
        patterns["hammer"] = True

    # Shooting star (bearish)
    if is_bearish and full_range > 0 and _safe_div(upper_wick, full_range) > 0.6:
        patterns["shooting_star"] = True

    # Engulfing
    prev_body = abs(prev["close"] - prev["open"])
    if is_bullish and prev["close"] < prev["open"] and body > prev_body * 1.1:
        patterns["bullish_engulfing"] = True
    if is_bearish and prev["close"] > prev["open"] and body > prev_body * 1.1:
        patterns["bearish_engulfing"] = True

    # Marubozu (strong momentum)
    if full_range > 0 and _safe_div(body, full_range) > 0.8:
        patterns["marubozu"] = "bullish" if is_bullish else "bearish"

    # Inside bar (compression)
    if c["high"] < prev["high"] and c["low"] > prev["low"]:
        patterns["inside_bar"] = True

    # Morning/Evening star (simplified)
    prev_range = prev["high"] - prev["low"]
    if (prev2["close"] < prev2["open"] and
        prev_range > 0 and
        abs(prev["close"] - prev["open"]) / prev_range < 0.3 and
        c["close"] > c["open"] and c["close"] > (prev2["open"] + prev2["close"]) / 2):
        patterns["morning_star"] = True

    return patterns


def market_structure(candles: List[Dict]) -> Dict:
    """Detect HH/HL (uptrend) or LH/LL (downtrend) structure."""
    if len(candles) < 10:
        return {"trend": "unknown", "hh_hl": False, "lh_ll": False}

    pivots_high, pivots_low = [], []
    for i in range(2, len(candles) - 2):
        if (candles[i]["high"] > candles[i-1]["high"] and
            candles[i]["high"] > candles[i-2]["high"] and
            candles[i]["high"] > candles[i+1]["high"] and
            candles[i]["high"] > candles[i+2]["high"]):
            pivots_high.append(candles[i]["high"])
        if (candles[i]["low"] < candles[i-1]["low"] and
            candles[i]["low"] < candles[i-2]["low"] and
            candles[i]["low"] < candles[i+1]["low"] and
            candles[i]["low"] < candles[i+2]["low"]):
            pivots_low.append(candles[i]["low"])

    hh_hl = len(pivots_high) >= 2 and pivots_high[-1] > pivots_high[-2] and \
            len(pivots_low) >= 2 and pivots_low[-1] > pivots_low[-2]
    lh_ll = len(pivots_high) >= 2 and pivots_high[-1] < pivots_high[-2] and \
            len(pivots_low) >= 2 and pivots_low[-1] < pivots_low[-2]

    if hh_hl:
        trend = "uptrend"
    elif lh_ll:
        trend = "downtrend"
    else:
        trend = "ranging"

    return {
        "trend": trend,
        "hh_hl": hh_hl,
        "lh_ll": lh_ll,
        "pivot_highs": pivots_high[-3:],
        "pivot_lows": pivots_low[-3:]
    }


def calculate_supertrend(candles: List[Dict], period: int = 10,
                         multiplier: float = 3.0) -> List[Dict]:
    """SuperTrend indicator.

    Returns a list (same length as candles) of dicts:
        {"direction": +1 or -1, "upper_band": float, "lower_band": float, "value": float}
    +1 = Bullish (price above band), -1 = Bearish (price below band).
    Entries before enough data are None.
    """
    n = len(candles)
    if n < period + 1:
        return [None] * n

    atr_vals = atr(candles, period)

    upper_basic = [None] * n
    lower_basic = [None] * n
    for i in range(n):
        if atr_vals[i] is not None:
            hl2 = (candles[i]["high"] + candles[i]["low"]) / 2
            upper_basic[i] = hl2 + multiplier * atr_vals[i]
            lower_basic[i] = hl2 - multiplier * atr_vals[i]

    upper_band = [None] * n
    lower_band = [None] * n
    direction = [None] * n
    st_value = [None] * n

    # Find first valid index
    first = None
    for i in range(n):
        if upper_basic[i] is not None:
            first = i
            break
    if first is None:
        return [None] * n

    upper_band[first] = upper_basic[first]
    lower_band[first] = lower_basic[first]
    direction[first] = 1
    st_value[first] = lower_band[first]

    for i in range(first + 1, n):
        if upper_basic[i] is None:
            continue

        prev_close = candles[i - 1]["close"]

        # Lower band: ratchet up only
        if lower_basic[i] > (lower_band[i - 1] or 0) or prev_close < (lower_band[i - 1] or 0):
            lower_band[i] = lower_basic[i]
        else:
            lower_band[i] = lower_band[i - 1] or lower_basic[i]

        # Upper band: ratchet down only
        if upper_basic[i] < (upper_band[i - 1] or float('inf')) or prev_close > (upper_band[i - 1] or float('inf')):
            upper_band[i] = upper_basic[i]
        else:
            upper_band[i] = upper_band[i - 1] or upper_basic[i]

        close = candles[i]["close"]
        prev_dir = direction[i - 1] or 1

        if prev_dir == 1:
            direction[i] = -1 if close < lower_band[i] else 1
        else:
            direction[i] = 1 if close > upper_band[i] else -1

        st_value[i] = lower_band[i] if direction[i] == 1 else upper_band[i]

    result = [None] * n
    for i in range(n):
        if direction[i] is not None:
            result[i] = {
                "direction": direction[i],
                "upper_band": upper_band[i],
                "lower_band": lower_band[i],
                "value": st_value[i],
            }
    return result


def calculate_obv(candles: List[Dict]) -> List[float]:
    """On-Balance Volume. Returns cumulative OBV series (same length as candles)."""
    if not candles:
        return []
    result = [0.0]
    for i in range(1, len(candles)):
        close = candles[i]["close"]
        prev_close = candles[i - 1]["close"]
        vol = candles[i]["volume"]
        if close > prev_close:
            result.append(result[-1] + vol)
        elif close < prev_close:
            result.append(result[-1] - vol)
        else:
            result.append(result[-1])
    return result


def _obv_trend(obv_vals: List[float], lookback: int = 10) -> str:
    """Classify recent OBV direction as 'rising', 'falling', or 'neutral'."""
    if len(obv_vals) < lookback:
        return "neutral"
    recent = obv_vals[-lookback:]
    slope = recent[-1] - recent[0]
    avg_vol = max(abs(recent[-1]), abs(recent[0]), 1.0)
    ratio = slope / avg_vol
    if ratio > 0.05:
        return "rising"
    elif ratio < -0.05:
        return "falling"
    return "neutral"


def compute_all_indicators(candles: List[Dict], config: Dict = None) -> Dict:
    """Master function: compute all indicators for a candle set."""
    config = config or {}
    if not candles or len(candles) < 5:
        return {
            "price": 0.0,
            "ema9": 0.0, "ema21": 0.0, "ema50": 0.0, "ema200": 0.0,
            "rsi": 50.0, "macd": 0.0, "macd_signal": 0.0, "macd_hist": 0.0,
            "atr": 0.0, "atr_pct": 0.0,
            "adx": 0.0, "pdi": 0.0, "mdi": 0.0,
            "bb_upper": 0.0, "bb_middle": 0.0, "bb_lower": 0.0, "bb_width": 0.0,
            "supertrend_direction": 0, "supertrend_value": 0.0,
            "obv": 0.0, "obv_ema": 0.0, "obv_trend": "neutral",
            "volume": {"avg": 0, "current": 0, "ratio": 1.0, "spike": False, "trend": "neutral", "taker_buy_pct": 0},
            "support_resistance": {}, "candle_patterns": {}, "market_structure": {"trend": "unknown"},
            "above_ema9": False, "above_ema21": False, "above_ema50": False, "above_ema200": False,
            "ema_aligned_bullish": False, "ema_aligned_bearish": False,
            "rsi_overbought": False, "rsi_oversold": False,
            "macd_bullish": False, "adx_trending": False,
        }

    closes = _closes(candles)
    n = len(candles)

    ema9 = ema(closes, config.get("ema_fast", 9))
    ema21 = ema(closes, config.get("ema_slow", 21))
    ema50 = ema(closes, config.get("ema_trend", 50))
    ema200 = ema(closes, config.get("ema_macro", 200))

    rsi_vals = rsi(closes, config.get("rsi_period", 14))
    macd_line, sig_line, macd_hist = macd(closes,
        config.get("macd_fast", 12), config.get("macd_slow", 26), config.get("macd_signal", 9))
    atr_vals = atr(candles, config.get("atr_period", 14))
    adx_vals, pdi_vals, mdi_vals = adx(candles, config.get("adx_period", 14))
    bb_upper, bb_mid, bb_lower = bollinger_bands(closes, config.get("bb_period", 20), config.get("bb_std", 2))
    st_vals, st_dirs = supertrend(candles, config.get("supertrend_period", 10),
                                  config.get("supertrend_multiplier", 3.0))
    obv_vals = obv(candles)

    def last(lst):
        for v in reversed(lst):
            if v is not None:
                return v
        return None

    current_price = closes[-1] if closes else 0
    atr_val = last(atr_vals) or 0
    bb_up = last(bb_upper) or current_price
    bb_lo = last(bb_lower) or current_price
    bb_width = _safe_div(bb_up - bb_lo, current_price, 0)
    atr_pct = _safe_div(atr_val, current_price, 0)

    return {
        "price": current_price,
        "ema9": last(ema9),
        "ema21": last(ema21),
        "ema50": last(ema50),
        "ema200": last(ema200),
        "rsi": last(rsi_vals),
        "macd": last(macd_line),
        "macd_signal": last(sig_line),
        "macd_hist": last(macd_hist),
        "atr": atr_val,
        "atr_pct": atr_pct,
        "adx": last(adx_vals),
        "pdi": last(pdi_vals),
        "mdi": last(mdi_vals),
        "bb_upper": bb_up,
        "bb_middle": last(bb_mid),
        "bb_lower": bb_lo,
        "bb_width": bb_width,
        "supertrend_direction": last(st_dirs),
        "supertrend_value": last(st_vals) or 0.0,
        "obv": obv_vals[-1] if obv_vals else 0.0,
        "obv_ema": (ema(obv_vals, 20)[-1] if len(obv_vals) >= 20 else None) or 0.0,
        "obv_trend": "up" if len(obv_vals) > 1 and obv_vals[-1] > obv_vals[-2] else "down" if len(obv_vals) > 1 and obv_vals[-1] < obv_vals[-2] else "flat",
        "volume": volume_profile(candles, config.get("volume_ma_period", 20)),
        "support_resistance": support_resistance(candles),
        "candle_patterns": candle_patterns(candles),
        "market_structure": market_structure(candles),
        # Derived signals
        "above_ema9": current_price > (last(ema9) or 0),
        "above_ema21": current_price > (last(ema21) or 0),
        "above_ema50": current_price > (last(ema50) or 0),
        "above_ema200": current_price > (last(ema200) or 0),
        "ema_aligned_bullish": (last(ema9) or 0) > (last(ema21) or 0) > (last(ema50) or 0),
        "ema_aligned_bearish": (last(ema9) or 0) < (last(ema21) or 0) < (last(ema50) or 0),
        "rsi_overbought": (last(rsi_vals) or 50) > config.get("rsi_overbought", 70),
        "rsi_oversold": (last(rsi_vals) or 50) < config.get("rsi_oversold", 30),
        "macd_bullish": (last(macd_hist) or 0) > 0 and (last(macd_line) or 0) > (last(sig_line) or 0),
        "adx_trending": (last(adx_vals) or 0) > config.get("adx_trend_threshold", 25),
    }
