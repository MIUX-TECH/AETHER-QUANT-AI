"""
engine/ai/groq_client.py — Groq Cloud AI Inference Client (Qwen 2.5 / 27B / 32B).
Provides high-speed LLM reasoning for:
1. Deep semantic news sentiment analysis.
2. Trade setup validation & reasoning.
3. Loss analysis & lesson extraction.
"""

import os
import re
import json
import logging
import requests
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "qwen/qwen3.6-27b"


class GroqAIClient:
    def __init__(self, api_key: str = "", model: str = ""):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.model = model or os.getenv("GROQ_MODEL", DEFAULT_MODEL)
        self.timeout = 25
        self.max_retries = 1

    @property
    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)

    def _call_groq(self, messages: List[Dict], max_tokens: int = 300, temperature: float = 0.2) -> Optional[str]:
        if not self.is_available:
            return None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        import time as _time
        for attempt in range(self.max_retries + 1):
            try:
                r = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=self.timeout)
                if r.status_code == 200:
                    data = r.json()
                    content = data["choices"][0]["message"]["content"]
                    # Strip thinking tags if Qwen includes them
                    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
                    return content
                elif r.status_code in [429, 503] and attempt < self.max_retries:
                    wait = 2 ** (attempt + 1)
                    logger.warning(f"Groq API {r.status_code}, retrying in {wait}s...")
                    _time.sleep(wait)
                    continue
                else:
                    logger.warning(f"Groq API error {r.status_code}: {r.text[:200]}")
            except requests.exceptions.Timeout:
                if attempt < self.max_retries:
                    logger.warning(f"Groq API timeout, retrying ({attempt + 1}/{self.max_retries})...")
                    _time.sleep(2)
                    continue
                logger.warning("Groq API timeout after all retries")
            except Exception as e:
                logger.warning(f"Groq API call failed: {e}")
                break
        return None

    def analyze_news_sentiment(self, articles: List[Dict]) -> Dict[str, float]:
        """
        Analyze news headlines semantically and return a sentiment score (0.0 to 1.0).
        """
        if not articles or not self.is_available:
            return {}

        headlines = [a.get("title", "") for a in articles[:10] if a.get("title")]
        if not headlines:
            return {}

        prompt = (
            "Analyze the following cryptocurrency news headlines and provide an aggregate market sentiment score "
            "between 0.0 (extreme fear/bearish) and 1.0 (extreme euphoria/bullish), where 0.5 is neutral.\n\n"
            f"Headlines:\n" + "\n".join(f"- {h}" for h in headlines) + "\n\n"
            "Respond ONLY with a valid JSON object in this format:\n"
            "{\"score\": 0.65, \"reason\": \"brief explanation\"}"
        )

        messages = [
            {"role": "system", "content": "You are a crypto quantitative sentiment analyst. Output strict JSON only."},
            {"role": "user", "content": prompt}
        ]

        raw = self._call_groq(messages, max_tokens=150)
        if raw:
            try:
                # Extract json block if surrounded by markdown
                json_match = re.search(r"\{.*\}", raw, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    score = float(parsed.get("score", 0.5))
                    return {"score": max(0.0, min(1.0, score)), "reason": parsed.get("reason", "")}
            except Exception as e:
                logger.warning(f"Failed to parse Groq sentiment JSON: {e}")

        return {}

    def validate_trade_setup(self, symbol: str, signal: str, quant_score: float,
                             regime: str, indicators: Dict, bullish_factors: List[str],
                             bearish_factors: List[str]) -> Dict:
        """
        AI Trade Validator: Reviews technical factors and confirms whether the setup is valid.
        """
        if not self.is_available:
            return {"approved": True, "ai_score": quant_score, "reasoning": "Quant model verified"}

        prompt = (
            f"Review this trading setup for {symbol}:\n"
            f"- Sinyal: {signal} (Quant Score: {quant_score:.2f})\n"
            f"- Market Regime: {regime}\n"
            f"- Faktor Bullish: {', '.join(bullish_factors[:4]) if bullish_factors else 'None'}\n"
            f"- Faktor Bearish: {', '.join(bearish_factors[:4]) if bearish_factors else 'None'}\n\n"
            "Determine if this entry is high quality or a potential fakeout. "
            "Output ONLY a JSON block like: {\"approved\": true, \"confidence\": 0.80, \"reasoning\": \"Alasan singkat dalam Bahasa Indonesia\"}"
        )

        messages = [
            {"role": "system", "content": "You are an institutional crypto quantitative analyst. Output JSON only."},
            {"role": "user", "content": prompt}
        ]

        raw = self._call_groq(messages, max_tokens=350)
        if raw:
            try:
                # Clean markdown blocks if any
                clean_raw = re.sub(r"```json|```", "", raw).strip()
                json_match = re.search(r"\{[\s\S]*\}", clean_raw)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    return {
                        "approved": bool(parsed.get("approved", True)),
                        "confidence": float(parsed.get("confidence", quant_score)),
                        "reasoning": str(parsed.get("reasoning", "Validasi AI disetujui"))
                    }
            except Exception as e:
                logger.warning(f"Failed to parse Groq trade validation JSON: {e} | raw={raw[:100]}")

        # Fail-closed: if AI validation was requested but Groq API failed/timed out, skip entry for risk safety
        return {"approved": False, "confidence": 0.0, "reasoning": "AI validation unavailable / timed out — trade skipped for capital safety"}

    def extract_trade_lesson(self, closed_trade: Dict) -> str:
        """
        Derive an actionable learning lesson from a losing trade.
        """
        if not self.is_available:
            return "Avoided in similar future conditions"

        symbol = closed_trade.get("symbol", "")
        pnl = closed_trade.get("pnl_pct", 0)
        regime = closed_trade.get("regime", "")
        reason = closed_trade.get("close_reason", "")

        prompt = (
            f"A trade on {symbol} closed with a loss of {pnl:.2f}% (Reason: {reason}) under market regime '{regime}'.\n"
            "Write a concise, 1-sentence trading lesson in Bahasa Indonesia to avoid this mistake in the future."
        )

        messages = [
            {"role": "system", "content": "You are a professional trading mentor. Output 1 concise Indonesian sentence."},
            {"role": "user", "content": prompt}
        ]

        raw = self._call_groq(messages, max_tokens=300)
        if raw:
            # Strip any residual think tags or quotes
            clean = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
            clean = re.sub(r"<think>.*", "", clean, flags=re.DOTALL).strip()
            return clean.replace('"', '').strip() or "Hindari entry dengan struktur serupa saat pasar berada di kondisi ini."
        return "Hindari entry dengan struktur serupa saat pasar berada di kondisi ini."
