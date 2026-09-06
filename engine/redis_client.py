import os
import logging
import json
from typing import Any, Dict, List, Optional, Union
import redis
from redis.exceptions import RedisError, ConnectionError, TimeoutError

logger = logging.getLogger(__name__)

class RedisManager:
    """
    Professional Redis Client for AETHER QUANT AI.
    Handles connection pooling, distributed locking, and schema-specific operations
    (Hashes for state, Lists for AI memory, Strings for general config).
    """
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(RedisManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, 'initialized'):
            # The system previously used UPSTASH_REDIS_REST_URL, we'll look for REDIS_URL first
            # Upstash standard redis connection URL: rediss://...
            redis_url = os.getenv("REDIS_URL") or os.getenv("UPSTASH_REDIS_URL")
            
            if not redis_url:
                rest_url = os.getenv("UPSTASH_REDIS_REST_URL")
                rest_token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
                if rest_url and rest_token:
                    host = rest_url.replace("https://", "").rstrip("/")
                    redis_url = f"rediss://default:{rest_token}@{host}:6379"
            
            if not redis_url:
                logger.warning("No REDIS_URL found. Running in offline/mock mode.")
                self.client = None
            else:
                try:
                    # Connection pooling for high concurrency and resilience
                    self.pool = redis.ConnectionPool.from_url(
                        redis_url,
                        decode_responses=True,
                        max_connections=10,
                        socket_timeout=5.0,
                        socket_connect_timeout=5.0,
                        retry_on_timeout=True
                    )
                    self.client = redis.Redis(connection_pool=self.pool)
                    # Ping to verify connection immediately
                    self.client.ping()
                    logger.info("Successfully connected to Native Redis via connection pool.")
                except Exception as e:
                    logger.error(f"Failed to initialize Native Redis connection: {e}")
                    self.client = None
                    
            self.initialized = True

    @property
    def is_connected(self) -> bool:
        return self.client is not None

    def acquire_lock(self, lock_name: str, expiration_seconds: int = 30) -> bool:
        """Distributed lock for preventing race conditions across multi-bot setups."""
        if not self.is_connected:
            return True # Fallback for local testing
        try:
            return bool(self.client.set(lock_name, "locked", ex=expiration_seconds, nx=True))
        except RedisError as e:
            logger.error(f"Redis Lock Error ({lock_name}): {e}")
            return False

    def release_lock(self, lock_name: str) -> None:
        """Release the distributed lock."""
        if not self.is_connected:
            return
        try:
            self.client.delete(lock_name)
        except RedisError as e:
            logger.error(f"Redis Release Lock Error ({lock_name}): {e}")

    # --- HASH OPERATIONS (Portfolio, Risk, Positions) ---

    def hset_dict(self, hash_name: str, mapping: Dict[str, Any]) -> bool:
        """Set multiple hash fields to multiple values natively."""
        if not self.is_connected or not mapping:
            return False
        
        # Serialize nested dicts/lists to JSON strings
        serialized = {}
        for k, v in mapping.items():
            if isinstance(v, (dict, list)):
                serialized[k] = json.dumps(v)
            elif isinstance(v, bool):
                serialized[k] = str(v).lower() # "true"/"false"
            elif v is None:
                serialized[k] = ""
            else:
                serialized[k] = str(v)

        try:
            self.client.hset(hash_name, mapping=serialized)
            return True
        except RedisError as e:
            logger.error(f"Redis HSET Error ({hash_name}): {e}")
            return False

    def hset_field(self, hash_name: str, key: str, value: Any) -> bool:
        """Set a single field in a hash."""
        if not self.is_connected:
            return False
        
        if isinstance(value, (dict, list)):
            val_str = json.dumps(value)
        elif isinstance(value, bool):
            val_str = str(value).lower()
        elif value is None:
            val_str = ""
        else:
            val_str = str(value)
            
        try:
            self.client.hset(hash_name, key, val_str)
            return True
        except RedisError as e:
            logger.error(f"Redis HSET Error ({hash_name}[{key}]): {e}")
            return False

    def hget_all(self, hash_name: str) -> Dict[str, Any]:
        """Get all fields and values of a hash."""
        if not self.is_connected:
            return {}
        try:
            raw_data = self.client.hgetall(hash_name)
            parsed = {}
            for k, v in raw_data.items():
                try:
                    # Attempt JSON parse for nested structures
                    parsed[k] = json.loads(v)
                except (json.JSONDecodeError, TypeError):
                    # Fallback for primitive types (bools, numbers, strings)
                    if v == "true": parsed[k] = True
                    elif v == "false": parsed[k] = False
                    elif v == "": parsed[k] = None
                    else:
                        try:
                            if '.' in v: parsed[k] = float(v)
                            else: parsed[k] = int(v)
                        except ValueError:
                            parsed[k] = v
            return parsed
        except RedisError as e:
            logger.error(f"Redis HGETALL Error ({hash_name}): {e}")
            return {}

    def hdel(self, hash_name: str, *keys) -> bool:
        """Delete one or more fields from a hash."""
        if not self.is_connected or not keys:
            return False
        try:
            self.client.hdel(hash_name, *keys)
            return True
        except RedisError as e:
            logger.error(f"Redis HDEL Error ({hash_name}): {e}")
            return False

    # --- LIST OPERATIONS (AI Memory, Trade History) ---

    def lpush_json(self, list_name: str, item: Dict[str, Any], max_len: int = 1000) -> bool:
        """Push a dict as JSON string to the head of a list, and trim it to max_len."""
        if not self.is_connected:
            return False
        try:
            pipe = self.client.pipeline()
            pipe.lpush(list_name, json.dumps(item))
            pipe.ltrim(list_name, 0, max_len - 1)
            pipe.execute()
            return True
        except RedisError as e:
            logger.error(f"Redis LPUSH Error ({list_name}): {e}")
            return False

    def lrange_json(self, list_name: str, start: int = 0, end: int = -1) -> List[Dict[str, Any]]:
        """Retrieve a range of elements from a list and parse JSON."""
        if not self.is_connected:
            return []
        try:
            raw_items = self.client.lrange(list_name, start, end)
            parsed = []
            for item in raw_items:
                try:
                    parsed.append(json.loads(item))
                except json.JSONDecodeError:
                    pass
            return parsed
        except RedisError as e:
            logger.error(f"Redis LRANGE Error ({list_name}): {e}")
            return []
