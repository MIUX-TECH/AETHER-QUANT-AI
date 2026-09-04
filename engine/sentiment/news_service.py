"""
engine/sentiment/news_service.py — News and sentiment aggregator.
Fetches from CryptoPanic and/or NewsAPI. Falls back gracefully.
Converts headlines to sentiment scores. Never the sole entry signal.
"""

import logging
import time
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

SYMBOL_KEYWORDS = {
    "BTCUSDT": ["bitcoin", "btc", "satoshi", "crypto", "cryptocurrency"],
    "ETHUSDT": ["ethereum", "eth", "ether", "vitalik", "defi"],
    "SOLUSDT": ["solana", "sol"],
    "XRPUSDT": ["ripple", "xrp"],
    "BNBUSDT": ["binance", "bnb", "cz"],
    "DOGEUSDT": ["doge", "dogecoin", "elon"],
    "PEPEUSDT": ["pepe", "pepecoin", "frog"],
    "SHIBUSDT": ["shib", "shiba", "shibainu"],
    "TRXUSDT": ["tron", "trx", "justinsun"],
    "BONKUSDT": ["bonk", "bonkcoin"],
    "FLOKIUSDT": ["floki", "flokiinu"],
    "NEARUSDT": ["near", "nearprotocol"],
    "AVAXUSDT": ["avalanche", "avax"],
}

BULLISH_KEYWORDS = [
    "bullish", "rally", "surge", "breakout", "all-time high", "ath", "adoption",
    "partnership", "upgrade", "listing", "institutional", "buy", "positive", "growth",
    "record", "milestone", "approval", "etf", "investment", "accumulate"
]

BEARISH_KEYWORDS = [
    "bearish", "crash", "dump", "ban", "hack", "exploit", "SEC", "lawsuit",
    "regulation", "fine", "fraud", "collapse", "sell", "fear", "risk", "warning",
    "delisting", "probe", "investigation", "security breach", "liquidation"
]


class NewsService:
    def __init__(self, cryptopanic_key: str = "", newsapi_key: str = ""):
        self.cryptopanic_key = cryptopanic_key
        self.newsapi_key = newsapi_key
        self._cache: Dict = {}
        self._cache_ttl = 300  # 5 min

    def get_sentiment_scores(self, symbols: List[str]) -> Dict[str, float]:
        """
        Return sentiment score per symbol (0.0 = very bearish, 1.0 = very bullish, 0.5 = neutral).
        """
        scores = {s: 0.5 for s in symbols}
        try:
            all_news = self._fetch_all_news()
            if not all_news:
                return scores
            for symbol in symbols:
                keywords = SYMBOL_KEYWORDS.get(symbol, [symbol.replace("USDT", "").lower()])
                relevant = [n for n in all_news if self._is_relevant(n, keywords)]
                if relevant:
                    scores[symbol] = self._score_articles(relevant)
        except Exception as e:
            logger.warning(f"Sentiment scoring failed: {e}")
        return scores

    def get_news_for_symbol(self, symbol: str, limit: int = 10) -> List[Dict]:
        """Get recent news articles for a symbol."""
        try:
            all_news = self._fetch_all_news()
            keywords = SYMBOL_KEYWORDS.get(symbol, [symbol.replace("USDT", "").lower()])
            relevant = [n for n in all_news if self._is_relevant(n, keywords)]
            return relevant[:limit]
        except Exception as e:
            logger.warning(f"News fetch failed for {symbol}: {e}")
            return []

    def get_market_summary(self) -> Dict:
        """Overall market sentiment summary."""
        all_news = self._fetch_all_news()
        if not all_news:
            return {
                "overall_sentiment": 0.5,
                "article_count": 0,
                "bullish_count": 0,
                "bearish_count": 0,
                "status": "no_data",
                "last_updated": datetime.utcnow().isoformat()
            }

        total_score = 0
        bullish_count = 0
        bearish_count = 0
        for article in all_news[:50]:
            score = self._score_single(article)
            total_score += score
            if score > 0.6:
                bullish_count += 1
            elif score < 0.4:
                bearish_count += 1

        n = min(len(all_news), 50)
        avg = total_score / n if n > 0 else 0.5

        return {
            "overall_sentiment": round(avg, 3),
            "article_count": len(all_news),
            "bullish_count": bullish_count,
            "bearish_count": bearish_count,
            "neutral_count": n - bullish_count - bearish_count,
            "status": "ok",
            "last_updated": datetime.utcnow().isoformat()
        }

    def _fetch_all_news(self) -> List[Dict]:
        """Fetch from all available sources."""
        cache_key = "all_news"
        now = time.time()
        if cache_key in self._cache:
            ts, data = self._cache[cache_key]
            if now - ts < self._cache_ttl:
                return data

        news = []

        if self.cryptopanic_key:
            news.extend(self._fetch_cryptopanic())

        if self.newsapi_key and len(news) < 20:
            news.extend(self._fetch_newsapi())

        if not news:
            news = self._get_synthetic_news()

        self._cache[cache_key] = (now, news)
        return news

    def _fetch_cryptopanic(self) -> List[Dict]:
        try:
            url = "https://cryptopanic.com/api/v1/posts/"
            params = {
                "auth_token": self.cryptopanic_key,
                "kind": "news",
                "filter": "important",
                "public": "true"
            }
            r = requests.get(url, params=params, timeout=8)
            if r.status_code != 200:
                return []
            data = r.json()
            articles = []
            for item in data.get("results", []):
                articles.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "published_at": item.get("published_at", ""),
                    "source": "cryptopanic",
                    "votes": item.get("votes", {})
                })
            return articles
        except Exception as e:
            logger.debug(f"CryptoPanic fetch failed: {e}")
            return []

    def _fetch_newsapi(self) -> List[Dict]:
        try:
            url = "https://newsapi.org/v2/everything"
            params = {
                "q": "bitcoin OR ethereum OR cryptocurrency",
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 30,
                "apiKey": self.newsapi_key
            }
            r = requests.get(url, params=params, timeout=8)
            if r.status_code != 200:
                return []
            data = r.json()
            articles = []
            for item in data.get("articles", []):
                articles.append({
                    "title": item.get("title", ""),
                    "description": item.get("description", ""),
                    "url": item.get("url", ""),
                    "published_at": item.get("publishedAt", ""),
                    "source": item.get("source", {}).get("name", "newsapi")
                })
            return articles
        except Exception as e:
            logger.debug(f"NewsAPI fetch failed: {e}")
            return []

    def _get_synthetic_news(self) -> List[Dict]:
        """Return neutral placeholder news when no API available."""
        return [
            {
                "title": "Crypto markets continue to develop globally",
                "source": "synthetic",
                "published_at": datetime.utcnow().isoformat(),
                "url": "#"
            }
        ]

    def _is_relevant(self, article: Dict, keywords: List[str]) -> bool:
        text = (article.get("title", "") + " " + article.get("description", "")).lower()
        return any(kw in text for kw in keywords)

    def _score_articles(self, articles: List[Dict]) -> float:
        if not articles:
            return 0.5
        scores = [self._score_single(a) for a in articles]
        return round(sum(scores) / len(scores), 3)

    def _score_single(self, article: Dict) -> float:
        text = (article.get("title", "") + " " + article.get("description", "")).lower()
        bull = sum(1 for kw in BULLISH_KEYWORDS if kw in text)
        bear = sum(1 for kw in BEARISH_KEYWORDS if kw in text)

        # CryptoPanic vote boost
        if "votes" in article:
            votes = article["votes"]
            bull += votes.get("positive", 0) * 0.1
            bear += votes.get("negative", 0) * 0.1

        total = bull + bear
        if total == 0:
            return 0.5
        return round(0.5 + (bull - bear) / (total * 2), 3)
