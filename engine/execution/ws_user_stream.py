"""
engine/execution/ws_user_stream.py — Binance Futures User Data Stream (WebSocket)
Replaces intensive REST API polling with zero-latency, 0-weight event-driven updates.
Handles listenKey generation, 30m keep-alive pinging, and automatic reconnection.
"""

import json
import time
import logging
import threading
import websocket
from typing import Callable, Optional, Dict

logger = logging.getLogger(__name__)

class FuturesUserStream:
    def __init__(self, executor):
        self.executor = executor
        self.listen_key: Optional[str] = None
        self._ws: Optional[websocket.WebSocketApp] = None
        self._ws_thread: Optional[threading.Thread] = None
        self._keepalive_thread: Optional[threading.Thread] = None
        self._running = False
        
        # Event callbacks
        self.on_account_update: Optional[Callable[[Dict], None]] = None
        self.on_order_update: Optional[Callable[[Dict], None]] = None
        self.on_margin_call: Optional[Callable[[Dict], None]] = None

    def _get_listen_key(self) -> bool:
        """POST /fapi/v1/listenKey"""
        try:
            status, data = self.executor._send_signed("POST", f"{self.executor.futures_url}/fapi/v1/listenKey")
            if status == 200 and isinstance(data, dict) and "listenKey" in data:
                self.listen_key = data["listenKey"]
                logger.info(f"✅ Diperoleh listenKey Futures: {self.listen_key[:8]}***")
                return True
            logger.error(f"❌ Gagal mendapat listenKey ({status}): {data}")
        except Exception as e:
            logger.error(f"Exception mendapat listenKey: {e}")
        return False

    def _keepalive_listen_key(self):
        """PUT /fapi/v1/listenKey setiap 30 menit (Binance meminta tiap 60 menit, 30 menit lebih aman)."""
        while self._running:
            time.sleep(1800)  # 30 menit
            if not self._running or not self.listen_key:
                break
            try:
                status, data = self.executor._send_signed("PUT", f"{self.executor.futures_url}/fapi/v1/listenKey")
                if status == 200:
                    logger.debug("🔄 listenKey dipertahankan (Keep-Alive sukses).")
                else:
                    logger.warning(f"⚠️ Gagal Keep-Alive listenKey ({status}). Memaksa Reconnect.")
                    self.reconnect()
                    break
            except Exception as e:
                logger.error(f"Exception Keep-Alive listenKey: {e}")

    def _close_listen_key(self):
        """DELETE /fapi/v1/listenKey saat bot dimatikan."""
        if self.listen_key:
            self.executor._send_signed("DELETE", f"{self.executor.futures_url}/fapi/v1/listenKey")
            self.listen_key = None

    def start(self):
        if self._running:
            return
            
        if not self._get_listen_key():
            logger.error("Membatalkan start User Data Stream karena gagal mendapat listenKey.")
            return

        self._running = True
        
        # Start keep-alive thread
        self._keepalive_thread = threading.Thread(target=self._keepalive_listen_key, daemon=True, name="WS-KeepAlive")
        self._keepalive_thread.start()
        
        # Start WebSocket
        self._connect_ws()

    def _connect_ws(self):
        ws_url = f"wss://fstream.binance.com/ws/{self.listen_key}"
        self._ws = websocket.WebSocketApp(
            ws_url,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close,
            on_open=self._on_open
        )
        self._ws_thread = threading.Thread(target=self._ws.run_forever, daemon=True, name="WS-UserStream")
        self._ws_thread.start()

    def stop(self):
        self._running = False
        if self._ws:
            self._ws.close()
        self._close_listen_key()
        logger.info("🛑 Futures User Data Stream dihentikan.")

    def reconnect(self):
        logger.info("🔄 Menjalankan Reconnect otomatis untuk User Data Stream...")
        if self._ws:
            self._ws.close()
        self._close_listen_key()
        
        time.sleep(2) # Jeda aman
        if self._get_listen_key():
            self._connect_ws()

    def _on_open(self, ws):
        logger.info("✅ Terhubung ke Binance Futures User Data Stream (WebSocket)!")

    def _on_error(self, ws, error):
        logger.error(f"⚠️ WebSocket Error: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        logger.warning(f"⚠️ WebSocket Terputus: {close_status_code} - {close_msg}")
        if self._running:
            # Auto-reconnect jika terputus namun self._running masih True
            time.sleep(3)
            self.reconnect()

    def _on_message(self, ws, message):
        try:
            data = json.loads(message)
            event_type = data.get("e")
            
            if event_type == "listenKeyExpired":
                logger.warning("🚨 listenKey Kedaluwarsa! Meminta ulang dan reconnect...")
                self.reconnect()
                
            elif event_type == "ACCOUNT_UPDATE":
                if self.on_account_update:
                    self.on_account_update(data)
                    
            elif event_type == "ORDER_TRADE_UPDATE":
                if self.on_order_update:
                    self.on_order_update(data)
                    
            elif event_type == "MARGIN_CALL":
                if self.on_margin_call:
                    self.on_margin_call(data)
                    
        except Exception as e:
            logger.error(f"Error parsing WS message: {e}")
