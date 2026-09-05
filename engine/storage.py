"""
engine/storage.py — File-based storage with atomic writes, backup, rotation, recovery.
All persistence in BINANCE-AI-TRADER uses this module.
"""

import json
import os
import shutil
import gzip
import hashlib
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, List
import threading

logger = logging.getLogger(__name__)

# Root of project (this file is engine/storage.py, so go up one level)
ROOT = Path(__file__).resolve().parent.parent

DIRS = {
    "config": ROOT / "config",
    "state": ROOT / "state",
    "memory": ROOT / "memory",
    "history": ROOT / "history",
    "reports": ROOT / "reports",
    "logs": ROOT / "logs",
    "cache": ROOT / "cache",
    "backup": ROOT / "backup",
}

_write_locks: Dict[str, threading.Lock] = {}
_global_lock = threading.Lock()


def _get_lock(path: str) -> threading.Lock:
    with _global_lock:
        if path not in _write_locks:
            _write_locks[path] = threading.Lock()
        return _write_locks[path]


def ensure_dirs():
    """Create all required directories on startup."""
    for name, path in DIRS.items():
        path.mkdir(parents=True, exist_ok=True)
    (ROOT / "history").mkdir(exist_ok=True)
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "backup" / "state").mkdir(parents=True, exist_ok=True)
    (ROOT / "backup" / "memory").mkdir(parents=True, exist_ok=True)


def _checksum(data: str) -> str:
    return hashlib.md5(data.encode()).hexdigest()[:8]


def read_json(path: Path, default: Optional[Dict] = None) -> Dict:
    """Read JSON file with recovery from backup if corrupted."""
    path = Path(path)
    lock = _get_lock(str(path))
    with lock:
        try:
            if not path.exists():
                return default if default is not None else {}
            with open(path, "r", encoding="utf-8") as f:
                content = f.read().strip()
            if not content:
                return default if default is not None else {}
            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {path}: {e}. Returning default.")
            return default if default is not None else {}
        except Exception as e:
            logger.error(f"Error reading {path}: {e}")
            return default if default is not None else {}


def write_json(path: Path, data: Dict, backup: bool = True) -> bool:
    """Atomic write with optional backup."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = _get_lock(str(path))
    tmp_path = path.with_suffix(".tmp")
    with lock:
        try:
            serialized = json.dumps(data, indent=2, ensure_ascii=False, default=str)
            # Write to temp first
            with open(tmp_path, "w", encoding="utf-8") as f:
                f.write(serialized)
            # Atomic replace
            tmp_path.replace(path)
            # Backup if requested
            if backup and path.exists():
                _create_backup(path, serialized)
            return True
        except Exception as e:
            logger.error(f"Error writing {path}: {e}")
            if tmp_path.exists():
                tmp_path.unlink()
            return False


def _create_backup(original_path: Path, content: str):
    """Create a timestamped backup of a file."""
    try:
        rel = original_path.relative_to(ROOT)
        backup_dir = ROOT / "backup" / rel.parent
        backup_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        chk = _checksum(content)
        backup_name = f"{original_path.stem}_{ts}_{chk}.json"
        backup_path = backup_dir / backup_name
        with open(backup_path, "w", encoding="utf-8") as f:
            f.write(content)
        # Keep only last 5 backups per file
        _prune_backups(backup_dir, original_path.stem, keep=5)
    except Exception as e:
        logger.warning(f"Backup failed for {original_path}: {e}")


def _prune_backups(backup_dir: Path, stem: str, keep: int = 5):
    backups = sorted(backup_dir.glob(f"{stem}_*.json"), key=lambda p: p.stat().st_mtime)
    while len(backups) > keep:
        backups.pop(0).unlink(missing_ok=True)


def _recover_from_backup(path: Path, default: Optional[Dict]) -> Dict:
    """Try to recover from most recent valid backup."""
    try:
        rel = path.relative_to(ROOT)
        backup_dir = ROOT / "backup" / rel.parent
        if not backup_dir.exists():
            return default if default is not None else {}
        backups = sorted(backup_dir.glob(f"{path.stem}_*.json"),
                         key=lambda p: p.stat().st_mtime, reverse=True)
        for bp in backups:
            try:
                with open(bp, "r") as f:
                    data = json.loads(f.read())
                logger.info(f"Recovered {path.name} from backup {bp.name}")
                shutil.copy2(bp, path)
                return data
            except Exception:
                continue
    except Exception as e:
        logger.error(f"Recovery failed for {path}: {e}")
    return default if default is not None else {}


def append_to_list_file(path: Path, entry: Dict, max_entries: int = 10000) -> bool:
    """Append an entry to a JSON list file safely."""
    path = Path(path)
    lock = _get_lock(str(path))
    with lock:
        try:
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    data = json.loads(f.read())
                if not isinstance(data, list):
                    data = []
            else:
                data = []
            data.append(entry)
            # Trim if too large
            if len(data) > max_entries:
                data = data[-max_entries:]
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
            tmp.replace(path)
            return True
        except Exception as e:
            logger.error(f"append_to_list_file error {path}: {e}")
            return False


def rotate_logs(log_dir: Path, days: int = 30):
    """Remove log files older than N days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    for log_file in Path(log_dir).glob("*.log*"):
        try:
            mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
            if mtime < cutoff:
                log_file.unlink()
        except Exception:
            pass


def get_history_path(prefix: str, dt: Optional[datetime] = None) -> Path:
    """Get dated history file path, e.g. history/trades_2024_01.json"""
    dt = dt or datetime.utcnow()
    fname = f"{prefix}_{dt.strftime('%Y_%m')}.json"
    return DIRS["history"] / fname


def get_report_path(prefix: str, period: str = "daily", dt: Optional[datetime] = None) -> Path:
    dt = dt or datetime.utcnow()
    if period == "daily":
        fname = f"{prefix}_{dt.strftime('%Y_%m_%d')}.json"
    elif period == "weekly":
        week = dt.isocalendar()[1]
        fname = f"{prefix}_{dt.strftime('%Y')}_W{week:02d}.json"
    elif period == "monthly":
        fname = f"{prefix}_{dt.strftime('%Y_%m')}.json"
    else:
        fname = f"{prefix}_{dt.strftime('%Y_%m_%d_%H%M%S')}.json"
    return DIRS["reports"] / fname


def _get_upstash_creds() -> tuple:
    url = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip("/")
    token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
    if url and token:
        return url, token
    try:
        cfg = read_json(DIRS["config"] / "app.json", default={})
        storage_cfg = cfg.get("storage", {})
        url = (storage_cfg.get("upstash_rest_url") or "").rstrip("/")
        token = storage_cfg.get("upstash_rest_token") or ""
        if url and token:
            return url, token
    except Exception:
        pass
    return "", ""


def set_upstash_credentials(url: str, token: str) -> bool:
    """Dynamically set and persist Upstash Redis credentials."""
    url = url.strip().rstrip("/")
    token = token.strip()
    os.environ["UPSTASH_REDIS_REST_URL"] = url
    os.environ["UPSTASH_REDIS_REST_TOKEN"] = token
    try:
        cfg_path = DIRS["config"] / "app.json"
        cfg = read_json(cfg_path, default={})
        cfg.setdefault("storage", {})["upstash_rest_url"] = url
        cfg.setdefault("storage", {})["upstash_rest_token"] = token
        write_json(cfg_path, cfg, backup=False)
        return True
    except Exception as e:
        logger.error(f"Failed to persist Upstash credentials to config: {e}")
        return False


def _upstash_get(key: str) -> Optional[Dict]:
    url, token = _get_upstash_creds()
    if not url or not token:
        logger.debug(f"Upstash credentials not configured, skipping remote GET for '{key}'")
        return None
    try:
        import requests
        r = requests.get(f"{url}/get/{key}", headers={"Authorization": f"Bearer {token}"}, timeout=4)
        if r.status_code == 200:
            res = r.json().get("result")
            if res:
                parsed = json.loads(res) if isinstance(res, str) else res
                if isinstance(parsed, dict) and parsed:
                    logger.info(f"✅ [UPSTASH REDIS] GET '{key}' successful — restored persistent cloud state")
                    return parsed
        else:
            logger.warning(f"⚠️ [UPSTASH REDIS] GET '{key}' returned HTTP {r.status_code}: {r.text[:100]}")
    except Exception as e:
        logger.warning(f"⚠️ [UPSTASH REDIS] GET '{key}' connection failed: {e}")
    return None


def _upstash_set(key: str, data: Any) -> bool:
    url, token = _get_upstash_creds()
    if not url or not token:
        logger.debug(f"Upstash credentials not configured, skipping remote SET for '{key}'")
        return False
    try:
        import requests
        serialized = json.dumps(data, ensure_ascii=False, default=str)
        r = requests.post(f"{url}/set/{key}", headers={"Authorization": f"Bearer {token}"}, data=serialized, timeout=4)
        if r.status_code == 200:
            logger.info(f"✅ [UPSTASH REDIS] SET '{key}' successful ({len(serialized)} bytes synced to cloud)")
            return True
        else:
            logger.warning(f"⚠️ [UPSTASH REDIS] SET '{key}' returned HTTP {r.status_code}: {r.text[:100]}")
            return False
    except Exception as e:
        logger.warning(f"⚠️ [UPSTASH REDIS] SET '{key}' connection failed: {e}")
        return False


def load_config(name: str) -> Dict:
    return read_json(DIRS["config"] / f"{name}.json")


def save_config(name: str, data: Dict) -> bool:
    return write_json(DIRS["config"] / f"{name}.json", data)


def load_state() -> Dict:
    # 1. Try Upstash Redis remote persistence first if configured
    remote = _upstash_get("runtime_state")
    if remote and isinstance(remote, dict) and (remote.get("portfolio") or remote.get("positions")):
        logger.info("Loaded runtime_state from external Upstash Redis cloud persistence")
        write_json(DIRS["state"] / "runtime_state.json", remote, backup=False)
        return remote

    # 2. Fallback to local storage
    local = read_json(DIRS["state"] / "runtime_state.json")
    if local:
        return local

    if remote:
        return remote

    return {}


def save_state(data: Dict) -> bool:
    ok = write_json(DIRS["state"] / "runtime_state.json", data, backup=True)
    safe_data = {k: v for k, v in data.items() if k != "credentials"}
    _upstash_set("runtime_state", safe_data)
    return ok


def load_memory(name: str) -> Dict:
    remote = _upstash_get(f"memory_{name}")
    if remote and isinstance(remote, dict):
        logger.info(f"Loaded memory '{name}' from external Upstash Redis cloud persistence")
        write_json(DIRS["memory"] / f"{name}.json", remote, backup=False)
        return remote

    local = read_json(DIRS["memory"] / f"{name}.json")
    return local if local else {}


def save_memory(name: str, data: Dict) -> bool:
    ok = write_json(DIRS["memory"] / f"{name}.json", data, backup=True)
    _upstash_set(f"memory_{name}", data)
    return ok


def validate_schema(data: Dict, required_keys: List[str]) -> bool:
    """Simple schema validation."""
    for key in required_keys:
        if key not in data:
            logger.warning(f"Missing key in data: {key}")
            return False
    return True


# Initialize dirs on import
ensure_dirs()
