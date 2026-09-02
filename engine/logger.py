"""
engine/logger.py — Centralized logging with file rotation, structured output.
"""

import logging
import logging.handlers
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)


def setup_logging(level: str = "INFO", name: str = "binance_ai_trader"):
    log_level = getattr(logging, level.upper(), logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)-25s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()

    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(log_level)
    console.setFormatter(formatter)
    root_logger.addHandler(console)

    # App log (rotating)
    app_handler = logging.handlers.TimedRotatingFileHandler(
        LOG_DIR / "app.log",
        when="midnight",
        backupCount=30,
        encoding="utf-8"
    )
    app_handler.setLevel(log_level)
    app_handler.setFormatter(formatter)
    root_logger.addHandler(app_handler)

    # Error log
    error_handler = logging.handlers.RotatingFileHandler(
        LOG_DIR / "error.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    root_logger.addHandler(error_handler)

    # Trade log — structured, append only
    trade_logger = logging.getLogger("trade")
    trade_handler = logging.handlers.TimedRotatingFileHandler(
        LOG_DIR / "trades.log",
        when="midnight",
        backupCount=90,
        encoding="utf-8"
    )
    trade_handler.setFormatter(logging.Formatter("%(asctime)s | %(message)s"))
    trade_logger.addHandler(trade_handler)
    trade_logger.propagate = False

    # Decision log
    decision_logger = logging.getLogger("decision")
    decision_handler = logging.handlers.TimedRotatingFileHandler(
        LOG_DIR / "decisions.log",
        when="midnight",
        backupCount=30,
        encoding="utf-8"
    )
    decision_handler.setFormatter(logging.Formatter("%(asctime)s | %(message)s"))
    decision_logger.addHandler(decision_handler)
    decision_logger.propagate = False

    return logging.getLogger(name)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
