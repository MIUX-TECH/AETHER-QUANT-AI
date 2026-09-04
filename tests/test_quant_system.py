"""
tests/test_quant_system.py — Comprehensive Unit & Integration Test Suite.
Validates math, indicators, risk management, execution, state persistence, and API invariants.
"""

import os
import sys
import unittest
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from engine.analysis.indicators import (
    ema, rsi, macd, atr, adx, bollinger_bands, compute_all_indicators
)
from engine.analysis.regime import RegimeClassifier
from engine.risk.risk_manager import RiskManager
from engine.execution.binance_executor import BinanceExecutor
from engine.ai.groq_client import GroqAIClient
from engine.storage import write_json, read_json, _checksum, ensure_dirs
from fastapi.testclient import TestClient
from api.main import app


class TestIndicators(unittest.TestCase):
    def setUp(self):
        self.prices = [100.0 + (i * 0.5) if i % 2 == 0 else 100.0 - (i * 0.3) for i in range(100)]
        self.candles = [
            {"open": p - 0.2, "high": p + 1.0, "low": p - 1.0, "close": p, "volume": 1000 + i * 10}
            for i, p in enumerate(self.prices)
        ]

    def test_ema_calculation(self):
        res = ema(self.prices, 9)
        self.assertIsNotNone(res[-1])
        self.assertIsInstance(res[-1], float)
        self.assertGreater(res[-1], 0)

    def test_rsi_calculation(self):
        res = rsi(self.prices, 14)
        self.assertIsNotNone(res[-1])
        self.assertGreaterEqual(res[-1], 0.0)
        self.assertLessEqual(res[-1], 100.0)

    def test_macd_calculation(self):
        m_line, s_line, h_line = macd(self.prices)
        self.assertIsNotNone(m_line[-1])
        self.assertIsNotNone(s_line[-1])
        self.assertIsNotNone(h_line[-1])

    def test_atr_calculation(self):
        res = atr(self.candles, 14)
        self.assertIsNotNone(res[-1])
        self.assertGreater(res[-1], 0)

    def test_adx_calculation(self):
        res, p_di, m_di = adx(self.candles, 14)
        self.assertIsNotNone(res[-1])
        self.assertGreaterEqual(res[-1], 0.0)

    def test_bollinger_bands(self):
        upper, middle, lower = bollinger_bands(self.prices, 20, 2.0)
        self.assertGreater(upper[-1], lower[-1])
        self.assertAlmostEqual(middle[-1], (upper[-1] + lower[-1]) / 2, places=4)


class TestRiskManager(unittest.TestCase):
    def setUp(self):
        self.config = {
            "risk": {
                "max_risk_per_trade_pct": 0.02,
                "max_portfolio_exposure_pct": 0.85,
                "max_drawdown_pct": 0.15,
                "max_daily_loss_pct": 0.05,
                "risk_off_mode_threshold": 0.10,
                "cooldown_after_loss_streak": 3,
                "cooldown_duration_minutes": 60
            },
            "futures": {
                "default_leverage": 3,
                "max_leverage": 10,
                "sl_pct": 0.025,
                "tp_pct": 0.06
            }
        }
        self.rm = RiskManager(self.config)

    def test_position_sizing(self):
        res = self.rm.calculate_position_size(
            equity=1000.0,
            entry_price=80000.0,
            atr=800.0,
            signal={"confidence": 0.75},
            trade_type="spot",
            symbol="BTCUSDT"
        )
        self.assertIn("position_usdt", res)
        self.assertIn("sl_price", res)
        self.assertIn("tp_price", res)
        self.assertGreater(res["tp_price"], res["entry_price"])
        self.assertLess(res["sl_price"], res["entry_price"])

    def test_risk_recovery_hysteresis(self):
        state = {
            "portfolio": {"drawdown_pct": 0.12},
            "risk": {"risk_off_active": False, "capital_preservation_mode": False}
        }
        # Drawdown 12% activates risk-off & capital preservation
        state = self.rm.update_risk_state(state, {"pnl_pct": -0.02})
        self.assertTrue(state["risk"]["capital_preservation_mode"])

        # Recovery when drawdown drops to 4%
        state["portfolio"]["drawdown_pct"] = 0.04
        state = self.rm.check_risk_recovery(state)
        self.assertFalse(state["risk"]["risk_off_active"])
        self.assertFalse(state["risk"]["capital_preservation_mode"])


class TestBinanceExecutorFormatting(unittest.TestCase):
    def setUp(self):
        self.ex = BinanceExecutor(testnet=True, mode="paper")
        self.ex._exchange_info_time = time.time()

    def test_lot_size_formatting(self):
        self.ex._symbol_rules["BTCUSDT"] = {"stepSize": "0.00001000"}
        self.ex._symbol_rules["PEPEUSDT"] = {"stepSize": "1.00000000"}
        self.ex._symbol_rules["SOLUSDT"] = {"stepSize": "0.01000000"}

        fmt_btc = self.ex._format_qty("BTCUSDT", 0.001234567)
        fmt_pepe = self.ex._format_qty("PEPEUSDT", 1234567.89)
        fmt_sol = self.ex._format_qty("SOLUSDT", 4.5678)

        self.assertEqual(fmt_btc, "0.00123")
        self.assertEqual(fmt_pepe, "1234567")
        self.assertEqual(fmt_sol, "4.56")


class TestGroqAIFailClosed(unittest.TestCase):
    def test_fail_closed_on_unreachable_api(self):
        client = GroqAIClient(api_key="invalid_fake_key_1234567890", model="qwen/qwen3.6-27b")
        client.timeout = 1
        res = client.validate_trade_setup(
            symbol="BTCUSDT",
            signal="BUY",
            quant_score=0.85,
            regime="trending_up",
            indicators={},
            bullish_factors=["EMA bullish", "RSI expanding"],
            bearish_factors=[]
        )
        self.assertFalse(res.get("approved"))
        self.assertIn("skipped", res.get("reasoning", "").lower())


class TestStorageAtomic(unittest.TestCase):
    def setUp(self):
        ensure_dirs()
        self.test_path = ROOT / "state" / "test_state.json"

    def tearDown(self):
        if self.test_path.exists():
            self.test_path.unlink()

    def test_write_and_read(self):
        sample = {"symbol": "BTCUSDT", "value": 1234.56, "active": True}
        ok = write_json(self.test_path, sample, backup=False)
        self.assertTrue(ok)
        loaded = read_json(self.test_path)
        self.assertEqual(loaded, sample)


class TestFastAPIEndpoints(unittest.TestCase):
    def test_health_and_protected_endpoints(self):
        client = TestClient(app)
        
        # Public health check
        r_health = client.get("/api/health")
        self.assertEqual(r_health.status_code, 200)
        self.assertEqual(r_health.json().get("status"), "running")

        # Protected debug endpoint without token
        r_debug_unauth = client.get("/api/debug/binance")
        self.assertEqual(r_debug_unauth.status_code, 401)

        # Protected debug endpoint with valid token
        headers = {"Authorization": "Bearer aether-quant-admin-2026"}
        r_debug_auth = client.get("/api/debug/binance", headers=headers)
        self.assertIn(r_debug_auth.status_code, [200, 503])


if __name__ == "__main__":
    unittest.main()
