from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from bs4 import BeautifulSoup

from app.config import GRADES_FILE, USER_AGENT

IR_GRADE_URL = 'https://ir.gsu.edu/data/grade-distributions'


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace('+00:00', 'Z')


def _normalize_code(course_code: str) -> str:
    return course_code.upper().replace('%20', ' ').strip()


def _load_cached_grades() -> dict[str, Any]:
    if not Path(GRADES_FILE).exists():
        return {}
    try:
        payload = json.loads(Path(GRADES_FILE).read_text(encoding='utf-8'))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _save_cached_grades(payload: dict[str, Any]) -> None:
    Path(GRADES_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(GRADES_FILE).write_text(json.dumps(payload, indent=2), encoding='utf-8')


async def _fetch_ir_page() -> str:
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True, headers={'User-Agent': USER_AGENT}) as client:
        resp = await client.get(IR_GRADE_URL)
        resp.raise_for_status()
        return resp.text


def _extract_courses_from_ir(html: str) -> dict[str, Any]:
    # IR pages are not guaranteed to expose machine-readable tables.
    # We only parse available script payloads; otherwise we return {}.
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text(' ', strip=True).lower()
    if 'grade distribution' not in text:
        return {}
    return {}


async def refresh_grades_cache_if_available() -> dict[str, Any]:
    try:
        html = await _fetch_ir_page()
        extracted = _extract_courses_from_ir(html)
        if extracted:
            _save_cached_grades(extracted)
            return {'ok': True, 'updated': True, 'courses': len(extracted), 'source': IR_GRADE_URL, 'cachedAt': _iso()}
        return {'ok': True, 'updated': False, 'courses': 0, 'source': IR_GRADE_URL, 'cachedAt': _iso(), 'warning': 'No machine-readable grade dataset found on IR page.'}
    except Exception as exc:
        return {'ok': False, 'updated': False, 'courses': 0, 'source': IR_GRADE_URL, 'cachedAt': _iso(), 'warning': str(exc)}


def get_grade_distribution(course_code: str) -> dict:
    payload = _load_cached_grades()
    normalized = _normalize_code(course_code)
    if normalized in payload:
        row = payload[normalized]
        row['source'] = row.get('source') or 'GSU IR Cached Grade Data'
        row['cachedAt'] = row.get('cachedAt') or _iso()
        return row
    compact = normalized.replace(' ', '')
    for key, value in payload.items():
        if key.replace(' ', '') == compact:
            value['source'] = value.get('source') or 'GSU IR Cached Grade Data'
            value['cachedAt'] = value.get('cachedAt') or _iso()
            return value
    return {
        'courseCode': normalized,
        'courseName': normalized,
        'cachedAt': _iso(),
        'source': 'Unavailable',
        'warning': 'Historical grade data is not currently available from a live public endpoint.',
        'summary': {'avgGPA': 0, 'medianGrade': 'N/A', 'totalStudents': 0},
        'semesters': [],
    }

