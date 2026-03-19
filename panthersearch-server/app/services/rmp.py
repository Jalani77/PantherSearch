from __future__ import annotations

import base64
import re
from datetime import UTC, datetime
from difflib import SequenceMatcher
from typing import Any

import httpx

from app.config import CACHE_TTL_SECONDS, RATEMYPROFESSOR_CACHE_FILE, RMP_GRAPHQL_URL, USER_AGENT
from app.services.cache import cache_key, read_cache, write_cache
from app.services.gosolar import get_professor_index
from app.services.storage import load_json, save_json

RMP_SCHOOL_ID = 'U2Nob29sLTExNDM='
RMP_HEADERS = {
    'Authorization': 'Basic dGVzdDp0ZXN0',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': USER_AGENT,
}

SEARCH_QUERY = '''
query TeacherSearch($text: String!, $schoolID: ID!) {
  newSearch {
    teachers(query: { text: $text, schoolID: $schoolID }) {
      edges {
        node {
          id
          firstName
          lastName
          department
          avgRating
          avgDifficulty
          wouldTakeAgainPercent
          numRatings
        }
      }
    }
  }
}
'''

DETAIL_QUERY = '''
query TeacherDetail($id: ID!) {
  node(id: $id) {
    ... on Teacher {
      id
      firstName
      lastName
      department
      avgRating
      avgDifficulty
      wouldTakeAgainPercent
      numRatings
      ratings(first: 10) {
        edges {
          node {
            comment
            class
            date
            grade
            thumbsUpTotal
            thumbsDownTotal
            ratingTags
            helpfulRating
            difficultyRating
            attendanceMandatory
          }
        }
      }
    }
  }
}
'''


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(UTC)).isoformat().replace('+00:00', 'Z')


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except Exception:
        return None


def _load_rate_my_professor_cache() -> dict[str, Any]:
    payload = load_json(RATEMYPROFESSOR_CACHE_FILE, {'professors': {}})
    if not isinstance(payload, dict):
        return {'professors': {}}
    professors = payload.get('professors')
    if not isinstance(professors, dict):
        return {'professors': {}}
    return {'professors': professors}


def _read_rate_my_professor_cache(slug: str) -> dict[str, Any] | None:
    payload = _load_rate_my_professor_cache()
    entry = payload['professors'].get(slug)
    if not isinstance(entry, dict):
        return None
    cached_at = _parse_iso(entry.get('cachedAt'))
    if not cached_at:
        return None
    age_seconds = (datetime.now(UTC) - cached_at).total_seconds()
    if age_seconds > CACHE_TTL_SECONDS:
        return None
    return entry.get('payload') if isinstance(entry.get('payload'), dict) else None


def _write_rate_my_professor_cache(slug: str, payload: dict[str, Any]) -> None:
    data = _load_rate_my_professor_cache()
    data['professors'][slug] = {'cachedAt': _iso(), 'payload': payload}
    save_json(RATEMYPROFESSOR_CACHE_FILE, data)


async def _post_graphql(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=35.0, follow_redirects=True) as client:
        response = await client.post(RMP_GRAPHQL_URL, headers=RMP_HEADERS, json={'query': query, 'variables': variables})
        response.raise_for_status()
        payload = response.json()
        if payload.get('errors'):
            raise RuntimeError(str(payload.get('errors')))
        return payload


def _normalize_search_rows(edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for edge in edges:
        node = edge.get('node') or {}
        if not node.get('id'):
            continue
        rows.append(
            {
                'id': node.get('id', ''),
                'firstName': node.get('firstName', ''),
                'lastName': node.get('lastName', ''),
                'avgRating': float(node.get('avgRating') or 0),
                'avgDifficulty': float(node.get('avgDifficulty') or 0),
                'wouldTakeAgainPercent': int(node.get('wouldTakeAgainPercent') or 0),
                'numRatings': int(node.get('numRatings') or 0),
                'department': node.get('department') or '',
            }
        )
    return rows


def _split_name(value: str) -> tuple[str, str]:
    clean = re.sub(r'\s+', ' ', (value or '').strip())
    if not clean:
        return '', ''
    parts = clean.split(' ')
    return parts[0], parts[-1]


def _decode_teacher_legacy_id(teacher_id: str) -> str:
    if not teacher_id:
        return ''
    try:
        decoded = base64.b64decode(teacher_id + '===').decode('utf-8', errors='ignore')
    except Exception:
        return ''
    if decoded.startswith('Teacher-'):
        return decoded.split('-', 1)[1]
    return ''


def _match_by_last_name(name: str, candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    first, last = _split_name(name)
    if not last:
        return None
    first_initial = first[:1].lower()
    best_score = 0.0
    best_match: dict[str, Any] | None = None

    for candidate in candidates:
        candidate_last = (candidate.get('lastName') or '').strip().lower()
        candidate_first = (candidate.get('firstName') or '').strip().lower()
        if candidate_last != last.lower():
            continue
        if first_initial and candidate_first[:1] and candidate_first[:1] != first_initial:
            continue
        similarity = SequenceMatcher(None, first.lower(), candidate_first).ratio() if first else 0.5
        if candidate_first == first.lower():
            similarity += 0.35
        similarity += min(0.3, (candidate.get('numRatings') or 0) / 500.0)
        if similarity > best_score:
            best_score = similarity
            best_match = candidate

    return best_match


def _top_tags(reviews: list[dict[str, Any]], limit: int = 6) -> list[str]:
    counts: dict[str, int] = {}
    for review in reviews:
        for tag in review.get('ratingTags') or []:
            if not tag:
                continue
            counts[tag] = counts.get(tag, 0) + 1
    return [tag for tag, _ in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]]


def _build_rate_my_professor_url(teacher_id: str) -> str:
    legacy_id = _decode_teacher_legacy_id(teacher_id)
    if not legacy_id:
        return 'https://www.ratemyprofessors.com'
    return f'https://www.ratemyprofessors.com/professor/{legacy_id}'


async def search_professors(name: str) -> dict[str, Any]:
    key = cache_key(f'search-{name}')
    cached = read_cache('rmp', key, CACHE_TTL_SECONDS)
    if cached:
        return cached

    payload = await _post_graphql(SEARCH_QUERY, {'text': name, 'schoolID': RMP_SCHOOL_ID})
    edges = payload.get('data', {}).get('newSearch', {}).get('teachers', {}).get('edges', [])
    results = _normalize_search_rows(edges)
    result = {'query': name, 'cachedAt': _iso(), 'results': results}
    write_cache('rmp', key, result)
    return result


async def get_professor_detail(rmp_id: str) -> dict[str, Any]:
    key = cache_key(f'detail-{rmp_id}')
    cached = read_cache('rmp', key, CACHE_TTL_SECONDS)
    if cached:
        return cached

    payload = await _post_graphql(DETAIL_QUERY, {'id': rmp_id})
    node = payload.get('data', {}).get('node') or {}
    reviews: list[dict[str, Any]] = []
    tags = set()
    for index, edge in enumerate(node.get('ratings', {}).get('edges', [])):
        item = edge.get('node') or {}
        rating_tags = item.get('ratingTags') or []
        tags.update(rating_tags)
        reviews.append(
            {
                'id': f'{rmp_id}-{index}',
                'comment': item.get('comment') or '',
                'className': item.get('class') or '',
                'date': item.get('date') or '',
                'grade': item.get('grade') or '',
                'thumbsUpTotal': int(item.get('thumbsUpTotal') or 0),
                'thumbsDownTotal': int(item.get('thumbsDownTotal') or 0),
                'ratingTags': rating_tags,
                'helpfulRating': float(item.get('helpfulRating') or 0),
                'difficultyRating': float(item.get('difficultyRating') or 0),
                'attendanceMandatory': item.get('attendanceMandatory'),
            }
        )

    professor = {
        'id': node.get('id', rmp_id),
        'firstName': node.get('firstName', ''),
        'lastName': node.get('lastName', ''),
        'department': node.get('department', ''),
        'avgRating': float(node.get('avgRating') or 0),
        'avgDifficulty': float(node.get('avgDifficulty') or 0),
        'wouldTakeAgainPercent': int(node.get('wouldTakeAgainPercent') or 0),
        'numRatings': int(node.get('numRatings') or 0),
        'tags': sorted(tags),
        'reviews': reviews,
    }
    result = {'cachedAt': _iso(), 'professor': professor}
    write_cache('rmp', key, result)
    return result


def _no_rate_my_professor_payload(professor: dict[str, Any] | None) -> dict[str, Any]:
    return {
        'cachedAt': _iso(),
        'source': 'RateMyProfessor',
        'hasRateMyProfessorData': False,
        'rating': 0.0,
        'difficulty': 0.0,
        'wouldTakeAgainPercent': 0,
        'numRatings': 0,
        'tags': [],
        'reviews': [],
        'ratemyprofessorUrl': 'https://www.ratemyprofessors.com',
        'professorSlug': (professor or {}).get('slug'),
    }


def _map_rate_my_professor_payload(
    professor: dict[str, Any],
    candidate: dict[str, Any],
    detail: dict[str, Any],
) -> dict[str, Any]:
    detail_professor = detail.get('professor') or {}
    raw_reviews = detail_professor.get('reviews') or []
    mapped_reviews = [
        {
            'id': review.get('id', ''),
            'date': review.get('date', ''),
            'courseCode': review.get('className', ''),
            'comment': review.get('comment', ''),
            'rating': float(review.get('helpfulRating') or 0),
            'difficulty': float(review.get('difficultyRating') or 0),
        }
        for review in raw_reviews
    ]
    return {
        'cachedAt': _iso(),
        'source': 'RateMyProfessor',
        'hasRateMyProfessorData': True,
        'rating': float(detail_professor.get('avgRating') or candidate.get('avgRating') or 0),
        'difficulty': float(detail_professor.get('avgDifficulty') or candidate.get('avgDifficulty') or 0),
        'wouldTakeAgainPercent': int(detail_professor.get('wouldTakeAgainPercent') or candidate.get('wouldTakeAgainPercent') or 0),
        'numRatings': int(detail_professor.get('numRatings') or candidate.get('numRatings') or 0),
        'tags': _top_tags(raw_reviews) or detail_professor.get('tags') or [],
        'reviews': mapped_reviews,
        'ratemyprofessorUrl': _build_rate_my_professor_url(str(candidate.get('id') or detail_professor.get('id') or '')),
        'professorSlug': professor.get('slug'),
        'firstName': detail_professor.get('firstName') or candidate.get('firstName') or '',
        'lastName': detail_professor.get('lastName') or candidate.get('lastName') or '',
        'department': detail_professor.get('department') or candidate.get('department') or '',
        'teacherId': detail_professor.get('id') or candidate.get('id') or '',
        'rawReviews': raw_reviews,
    }


async def get_rate_my_professor_by_slug(slug: str) -> dict[str, Any]:
    roster = get_professor_index()
    professor = next((item for item in roster if item.get('slug') == slug), None)
    if not professor:
        payload = _no_rate_my_professor_payload({'slug': slug})
        payload['error'] = 'Professor not found in Banner index.'
        return payload

    cached = _read_rate_my_professor_cache(slug)
    if cached:
        return cached

    try:
        search = await search_professors(professor.get('rmpSearchName') or professor.get('name') or '')
        match = _match_by_last_name(professor.get('name') or '', search.get('results', []))
        if not match:
            payload = _no_rate_my_professor_payload(professor)
            _write_rate_my_professor_cache(slug, payload)
            return payload
        detail = await get_professor_detail(match.get('id', ''))
        payload = _map_rate_my_professor_payload(professor, match, detail)
        _write_rate_my_professor_cache(slug, payload)
        return payload
    except Exception:
        payload = _no_rate_my_professor_payload(professor)
        _write_rate_my_professor_cache(slug, payload)
        return payload


def _to_legacy_professor(rate_my_professor_payload: dict[str, Any]) -> dict[str, Any] | None:
    if not rate_my_professor_payload.get('hasRateMyProfessorData'):
        return None
    reviews = []
    for index, review in enumerate(rate_my_professor_payload.get('rawReviews') or []):
        reviews.append(
            {
                'id': review.get('id') or f"{rate_my_professor_payload.get('teacherId')}-{index}",
                'comment': review.get('comment') or '',
                'className': review.get('className') or review.get('courseCode') or '',
                'date': review.get('date') or '',
                'grade': review.get('grade') or '',
                'thumbsUpTotal': int(review.get('thumbsUpTotal') or 0),
                'thumbsDownTotal': int(review.get('thumbsDownTotal') or 0),
                'ratingTags': review.get('ratingTags') or [],
                'helpfulRating': float(review.get('helpfulRating') or review.get('rating') or 0),
                'difficultyRating': float(review.get('difficultyRating') or review.get('difficulty') or 0),
                'attendanceMandatory': review.get('attendanceMandatory'),
            }
        )

    return {
        'id': rate_my_professor_payload.get('teacherId', ''),
        'firstName': rate_my_professor_payload.get('firstName', ''),
        'lastName': rate_my_professor_payload.get('lastName', ''),
        'department': rate_my_professor_payload.get('department', ''),
        'avgRating': float(rate_my_professor_payload.get('rating') or 0),
        'avgDifficulty': float(rate_my_professor_payload.get('difficulty') or 0),
        'wouldTakeAgainPercent': int(rate_my_professor_payload.get('wouldTakeAgainPercent') or 0),
        'numRatings': int(rate_my_professor_payload.get('numRatings') or 0),
        'tags': rate_my_professor_payload.get('tags') or [],
        'reviews': reviews,
    }


async def get_professor_by_slug(slug: str) -> dict[str, Any]:
    roster = get_professor_index()
    professor = next((item for item in roster if item.get('slug') == slug), None)
    if not professor:
        return {'cachedAt': _iso(), 'found': False, 'source': 'Banner Professor Index', 'professor': None}

    rate_my_professor_payload = await get_rate_my_professor_by_slug(slug)
    legacy_professor = _to_legacy_professor(rate_my_professor_payload)
    return {
        'cachedAt': _iso(),
        'found': True,
        'source': 'Banner + RateMyProfessor',
        'professor': professor,
        'rmpData': legacy_professor,
    }


async def refresh_rmp_cache_for_professors(limit: int | None = None) -> dict[str, Any]:
    roster = get_professor_index()
    checked = 0
    errors = 0
    for professor in roster[: limit or len(roster)]:
        slug = professor.get('slug')
        if not slug:
            continue
        try:
            await get_rate_my_professor_by_slug(slug)
            checked += 1
        except Exception:
            errors += 1
    return {'checked': checked, 'errors': errors, 'cachedAt': _iso()}
