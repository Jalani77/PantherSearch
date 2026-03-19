from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import VIEWS_FILE


def load_json(path: Path, default: Any):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding='utf-8')


def _empty_views_payload() -> dict[str, dict[str, int]]:
    return {'courses': {}, 'professors': {}}


def _coerce_counts(payload: dict[str, Any]) -> dict[str, int]:
    out: dict[str, int] = {}
    for key, value in payload.items():
        try:
            count = int(value)
        except Exception:
            count = 0
        if key and count > 0:
            out[str(key)] = count
    return out


def _migrate_legacy_views(raw: dict[str, Any]) -> dict[str, dict[str, int]]:
    courses: dict[str, int] = {}
    professors: dict[str, int] = {}

    for item in raw.get('class', []) or []:
        key = str(item.get('key') or '').strip()
        if not key:
            continue
        courses[key] = max(courses.get(key, 0), int(item.get('count') or 0))

    for item in raw.get('instructor', []) or []:
        key = str(item.get('key') or '').strip()
        if not key:
            continue
        professors[key] = max(professors.get(key, 0), int(item.get('count') or 0))

    return {'courses': courses, 'professors': professors}


def load_views() -> dict[str, dict[str, int]]:
    if not VIEWS_FILE.exists():
        save_json(VIEWS_FILE, _empty_views_payload())
    raw = load_json(VIEWS_FILE, _empty_views_payload())
    if isinstance(raw, dict) and isinstance(raw.get('courses'), dict) and isinstance(raw.get('professors'), dict):
        return {
            'courses': _coerce_counts(raw.get('courses') or {}),
            'professors': _coerce_counts(raw.get('professors') or {}),
        }

    migrated = _migrate_legacy_views(raw if isinstance(raw, dict) else {})
    save_json(VIEWS_FILE, migrated)
    return migrated
