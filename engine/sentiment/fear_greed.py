import requests
import time
import logging

logger = logging.getLogger(__name__)

class FearGreedService:
    def __init__(self):
        self.url = "https://api.alternative.me/fng/?limit=1&format=json"
        self._cache = None
        self._cache_time = 0
        self._cache_ttl = 1800  # 30 minutes cache

    def get_index(self) -> dict:
        """
        Fetch Fear & Greed index.
        Returns dict with 'value' (0-100, int), 'class' (str), and 'normalized' (0.0-1.0 float).
        """
        now = time.time()
        if self._cache and (now - self._cache_time) < self._cache_ttl:
            return self._cache

        try:
            r = requests.get(self.url, timeout=5)
            if r.status_code == 200:
                data = r.json()
                if "data" in data and len(data["data"]) > 0:
                    item = data["data"][0]
                    value = int(item.get("value", 50))
                    classification = item.get("value_classification", "Neutral")
                    
                    self._cache = {
                        "value": value,
                        "class": classification,
                        "normalized": value / 100.0,
                        "timestamp": int(item.get("timestamp", now))
                    }
                    self._cache_time = now
                    return self._cache
        except Exception as e:
            logger.warning(f"Failed to fetch Fear & Greed index: {e}")

        # Fallback to Neutral if API fails
        if not self._cache:
            self._cache = {
                "value": 50,
                "class": "Neutral (Fallback)",
                "normalized": 0.5,
                "timestamp": int(now)
            }
        return self._cache
