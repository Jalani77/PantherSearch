from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from app.config import VIEWS_FILE
from app.services.storage import load_views, save_json


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace('+00:00', 'Z')


def _normalize_course_key(value: str) -> str:
    clean = re.sub(r'[^A-Za-z0-9]+', ' ', (value or '').strip().upper()).strip()
    match = re.match(r'^([A-Z]{2,5})\s*(\d{3,4}[A-Z]?)$', clean)
    if match:
        return f'{match.group(1)}-{match.group(2)}'
    compact = clean.replace(' ', '')
    match = re.match(r'^([A-Z]{2,5})(\d{3,4}[A-Z]?)$', compact)
    if match:
        return f'{match.group(1)}-{match.group(2)}'
    return clean.replace(' ', '-')


def _normalize_professor_key(value: str) -> str:
    return re.sub(r'[^a-z0-9-]+', '-', (value or '').strip().lower()).strip('-')


def track_view(payload: dict[str, Any]) -> dict[str, Any]:
    view_type = (payload.get('type') or '').strip().lower()
    key = str(payload.get('key') or '').strip()
    if not key:
        return {'ok': False, 'error': 'Missing view key.'}

    views = load_views()
    if view_type in {'course', 'class'}:
        bucket = 'courses'
        normalized_key = _normalize_course_key(key)
    elif view_type in {'professor', 'instructor'}:
        bucket = 'professors'
        normalized_key = _normalize_professor_key(key)
    else:
        return {'ok': False, 'error': f'Unsupported view type: {view_type}'}

    views[bucket][normalized_key] = int(views[bucket].get(normalized_key, 0)) + 1
    save_json(VIEWS_FILE, views)
    return {'ok': True, 'type': view_type, 'key': normalized_key, 'count': views[bucket][normalized_key]}


def get_trending(
    catalog_rows: list[dict[str, Any]],
    professor_rows: list[dict[str, Any]],
    limit: int = 5,
) -> dict[str, Any]:
    views = load_views()
    course_counts = sorted(views.get('courses', {}).items(), key=lambda item: item[1], reverse=True)
    professor_counts = sorted(views.get('professors', {}).items(), key=lambda item: item[1], reverse=True)

    courses_by_key: dict[str, dict[str, Any]] = {}
    for row in catalog_rows:
        normalized = _normalize_course_key(str(row.get('code') or ''))
        courses_by_key[normalized] = row

    professors_by_slug: dict[str, dict[str, Any]] = {}
    for row in professor_rows:
        slug = _normalize_professor_key(str(row.get('slug') or ''))
        if slug:
            professors_by_slug[slug] = row

    trending_courses: list[dict[str, Any]] = []
    for key, count in course_counts:
        row = courses_by_key.get(_normalize_course_key(key))
        if not row:
            continue
        code = str(row.get('code') or '').strip()
        if not code:
            continue
        trending_courses.append(
            {
                'type': 'course',
                'key': key,
                'label': f"{code}: {row.get('name') or code}",
                'href': f"/class/{code.replace(' ', '')}",
                'subtitle': row.get('department') or '',
                'count': int(count),
            }
        )
        if len(trending_courses) >= limit:
            break

    trending_professors: list[dict[str, Any]] = []
    for slug, count in professor_counts:
        row = professors_by_slug.get(_normalize_professor_key(slug))
        if not row:
            continue
        clean_slug = str(row.get('slug') or slug)
        name = str(row.get('displayName') or row.get('name') or clean_slug).strip()
        trending_professors.append(
            {
                'type': 'professor',
                'key': clean_slug,
                'label': name,
                'href': f'/instructor/{clean_slug}',
                'subtitle': ', '.join(row.get('departments') or []),
                'count': int(count),
            }
        )
        if len(trending_professors) >= limit:
            break

    return {
        'source': 'Tracked Views',
        'cachedAt': _iso(),
        'courses': trending_courses,
        'professors': trending_professors,
    }

