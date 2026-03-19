from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

from app.config import CACHE_DIR


def cache_key(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-') or 'default'


def _cache_path(namespace: str, key: str) -> Path:
    path = CACHE_DIR / namespace
    path.mkdir(parents=True, exist_ok=True)
    return path / f'{key}.json'


def read_cache(namespace: str, key: str, ttl_seconds: int) -> Any | None:
    path = _cache_path(namespace, key)
    if not path.exists():
        return None
    age = time.time() - path.stat().st_mtime
    if age > ttl_seconds:
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def write_cache(namespace: str, key: str, payload: Any) -> None:
    path = _cache_path(namespace, key)
    path.write_text(json.dumps(payload, indent=2), encoding='utf-8')
