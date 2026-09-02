"""
engine/scheduler/scheduler.py — Job scheduler.
Runs periodic tasks: scan, execute, rebalance, reports, learning, health check.
"""

import logging
import time
import threading
from typing import Dict, Callable
from datetime import datetime

logger = logging.getLogger(__name__)


class Job:
    def __init__(self, name: str, fn: Callable, interval_seconds: int):
        self.name = name
        self.fn = fn
        self.interval = interval_seconds
        self.last_run: float = 0
        self.run_count: int = 0
        self.error_count: int = 0
        self.last_error: str = ""
        self.enabled: bool = True

    def is_due(self) -> bool:
        return self.enabled and (time.time() - self.last_run) >= self.interval

    def run(self):
        try:
            self.fn()
            self.last_run = time.time()
            self.run_count += 1
        except Exception as e:
            self.error_count += 1
            self.last_error = str(e)
            logger.error(f"Job {self.name} failed: {e}", exc_info=True)


class Scheduler:
    def __init__(self, config: Dict):
        self.config = config
        self.sched_cfg = config.get("scheduler", {})
        self.jobs: Dict[str, Job] = {}
        self._running = False
        self._thread: threading.Thread = None
        self._lock = threading.Lock()

    def register(self, name: str, fn: Callable, interval_seconds: int = None):
        """Register a job by name with interval (or use config default)."""
        interval = interval_seconds or self.sched_cfg.get(f"{name}_interval", 60)
        self.jobs[name] = Job(name, fn, interval)
        logger.info(f"Registered job: {name} (every {interval}s)")

    def start(self):
        """Start scheduler in background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="Scheduler")
        self._thread.start()
        logger.info("Scheduler started")

    def stop(self):
        """Stop scheduler."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Scheduler stopped")

    def _loop(self):
        while self._running:
            with self._lock:
                for job in self.jobs.values():
                    if job.is_due():
                        logger.debug(f"Running job: {job.name}")
                        job.run()
            time.sleep(1)

    def run_now(self, name: str) -> bool:
        """Manually trigger a job by name."""
        if name not in self.jobs:
            logger.warning(f"Job {name} not found")
            return False
        job = self.jobs[name]
        job.last_run = 0  # Reset to force run
        job.run()
        return True

    def enable_job(self, name: str):
        if name in self.jobs:
            self.jobs[name].enabled = True

    def disable_job(self, name: str):
        if name in self.jobs:
            self.jobs[name].enabled = False

    def get_status(self) -> Dict:
        return {
            "running": self._running,
            "jobs": {
                name: {
                    "enabled": job.enabled,
                    "interval_seconds": job.interval,
                    "last_run": datetime.utcfromtimestamp(job.last_run).isoformat() if job.last_run else None,
                    "run_count": job.run_count,
                    "error_count": job.error_count,
                    "last_error": job.last_error or None,
                    "next_run_in": max(0, int(job.interval - (time.time() - job.last_run)))
                }
                for name, job in self.jobs.items()
            }
        }
