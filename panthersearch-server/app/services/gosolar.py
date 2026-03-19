from __future__ import annotations

import asyncio
import json
import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import ACTIVE_TERM_HINTS, DEFAULT_TERM, GOSOLAR_BASE_URL, USER_AGENT
from app.services.cache import cache_key

HEADERS = {'User-Agent': USER_AGENT, 'Accept': 'application/json, text/plain, */*'}
REGISTRATION_URL = f'{GOSOLAR_BASE_URL}/classRegistration/classRegistration'
SEATS_CACHE_DIR = __import__('pathlib').Path(__file__).resolve().parents[1] / 'cache' / 'seats'

_state: dict[str, Any] = {
    'terms': [],
    'activeTerms': [],
    'sections': [],
    'subjectsByTerm': {},
    'refreshedAt': None,
    'source': 'GoSOLAR Live Data',
    'healthy': False,
    'warning': None,
    'refreshing': False,
}
_state_lock = asyncio.Lock()


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _iso(dt: datetime | None = None) -> str:
    return (dt or _utc_now()).isoformat().replace('+00:00', 'Z')


def _term_label(term: str) -> str:
    year = term[:4]
    suffix = term[-2:]
    return {'01': f'Spring {year}', '05': f'Summer {year}', '08': f'Fall {year}'}.get(suffix, term)


def _term_rank(term: str) -> int:
    suffix = term[-2:]
    return {'01': 1, '05': 2, '08': 3}.get(suffix, 0)


def _term_sort_key(term: str) -> tuple[int, int]:
    return int(term[:4]), _term_rank(term)


def _normalize_instructor(name: str) -> tuple[str, str]:
    raw = (name or '').strip()
    if not raw:
        return 'Staff', ''
    if raw.lower() in {'staff', 'tba', 'to be announced'}:
        return 'Staff', ''
    if ',' in raw:
        last, first = [part.strip() for part in raw.split(',', 1)]
        clean = f'{first} {last}'.strip()
    else:
        clean = raw
    slug = re.sub(r'[^a-z0-9]+', '-', clean.lower()).strip('-')
    return clean, slug


def _to_ampm(value: str | None) -> str:
    if not value:
        return 'TBA'
    if len(value) != 4 or not value.isdigit():
        return value
    hour = int(value[:2])
    minute = value[2:]
    suffix = 'PM' if hour >= 12 else 'AM'
    hour12 = hour % 12 or 12
    return f'{hour12}:{minute} {suffix}'


def _meeting_data(meeting_rows: list[dict[str, Any]]) -> tuple[str, str, str, str]:
    if not meeting_rows:
        return 'Online', 'Async', 'Async', 'Online'
    row = meeting_rows[0]
    meeting = row.get('meetingTime') or {}
    days = ''.join(
        [
            'M' if meeting.get('monday') else '',
            'T' if meeting.get('tuesday') else '',
            'W' if meeting.get('wednesday') else '',
            'R' if meeting.get('thursday') else '',
            'F' if meeting.get('friday') else '',
        ]
    )
    begin = _to_ampm(meeting.get('beginTime'))
    end = _to_ampm(meeting.get('endTime'))
    building = meeting.get('buildingDescription') or row.get('buildingDescription') or ''
    room = meeting.get('room') or row.get('room') or ''
    location = ' '.join([part for part in [building, room] if part]).strip() or 'Online'
    if not days:
        days = 'Online'
    return days, begin, end, location


def _section_type(row: dict[str, Any], days: str, location: str) -> str:
    schedule = (row.get('scheduleTypeDescription') or '').strip()
    title = (row.get('courseTitle') or '').lower()
    if 'lab' in title:
        return 'Lab'
    if 'online' in schedule.lower() or days == 'Online' or 'online' in location.lower():
        return 'Online'
    if 'hybrid' in schedule.lower():
        return 'Hybrid'
    return schedule or 'Lecture'


def _is_registration_open(term_code: str) -> bool:
    # Do not expose Spring terms as registration-open seats.
    if term_code.endswith('01'):
        return False
    now = _utc_now()
    year = int(term_code[:4])
    if year < now.year:
        return False
    return term_code.endswith('05') or term_code.endswith('08')


def _banner_link(term: str, crn: str) -> str:
    return f'{REGISTRATION_URL}?txt_term={term}&txt_courseReferenceNumber={crn}'


def _dedupe_sections(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for row in rows:
        deduped[f"{row.get('term')}::{row.get('id')}"] = row
    return list(deduped.values())


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=45.0, headers=HEADERS, follow_redirects=True)


async def _set_term(client: httpx.AsyncClient, term: str) -> None:
    await client.post(
        f'{GOSOLAR_BASE_URL}/term/search',
        params={'mode': 'search'},
        data={'term': term},
        headers={'Content-Type': 'application/x-www-form-urlencoded', **HEADERS},
    )


async def fetch_terms(client: httpx.AsyncClient) -> list[dict[str, str]]:
    candidates = [
        ('/classSearch/getTerms', {'searchTerm': '', 'offset': 1, 'max': 50}),
        ('/classSearch/getTerms', {'dataType': 'json', 'searchTerm': '', 'offset': 1, 'max': 50}),
        ('/classSearch/get_terms', {'searchTerm': '', 'offset': 1, 'max': 50}),
    ]
    terms: list[dict[str, str]] = []
    for path, params in candidates:
        try:
            resp = await client.get(f'{GOSOLAR_BASE_URL}{path}', params=params)
            resp.raise_for_status()
            payload = resp.json()
            data = payload if isinstance(payload, list) else payload.get('data') or []
            for item in data:
                code = str(item.get('code') or item.get('term') or item.get('value') or '').strip()
                desc = str(item.get('description') or item.get('text') or _term_label(code)).strip()
                if code and len(code) == 6 and code.isdigit():
                    terms.append({'code': code, 'description': desc})
            if terms:
                break
        except Exception:
            continue
    dedup: dict[str, dict[str, str]] = {}
    for item in terms:
        dedup[item['code']] = item
    values = sorted(dedup.values(), key=lambda t: _term_sort_key(t['code']))
    return values


async def fetch_subjects(client: httpx.AsyncClient, term: str) -> list[dict[str, str]]:
    resp = await client.get(
        f'{GOSOLAR_BASE_URL}/classSearch/get_subject',
        params={'searchTerm': '', 'term': term, 'offset': 1, 'max': 500},
    )
    resp.raise_for_status()
    payload = resp.json()
    rows = payload if isinstance(payload, list) else payload.get('data') or []
    return [{'code': str(row.get('code') or '').strip(), 'description': str(row.get('description') or '').strip()} for row in rows if row.get('code')]


async def fetch_sections_for_subject(client: httpx.AsyncClient, term: str, subject: str, course_number: str = '') -> list[dict[str, Any]]:
    page_offset = 0
    page_size = 500
    out: list[dict[str, Any]] = []
    while True:
        resp = await client.get(
            f'{GOSOLAR_BASE_URL}/searchResults/searchResults',
            params={
                'txt_term': term,
                'txt_subject': subject,
                'txt_courseNumber': course_number,
                'txt_campus': '',
                'pageOffset': page_offset,
                'pageMaxSize': page_size,
            },
        )
        resp.raise_for_status()
        payload = resp.json()
        rows = payload.get('data', []) or []
        out.extend(rows)
        if len(rows) < page_size:
            break
        page_offset += page_size
    return out


async def _fetch_and_store_subject(term: str, subject: str, course_number: str = '') -> list[dict[str, Any]]:
    async with await _client() as client:
        await client.get(f'{GOSOLAR_BASE_URL}/classSearch/classSearch')
        await _set_term(client, term)
        rows = await fetch_sections_for_subject(client, term, subject, course_number=course_number)
    normalized = [_normalize_section(row, term) for row in rows]
    async with _state_lock:
        existing = _state.get('sections', [])
        # remove stale rows for this term/subject only when doing a full-subject fetch
        if not course_number:
            existing = [row for row in existing if not (row.get('term') == term and str(row.get('subject')).upper() == subject.upper())]
        existing.extend(normalized)
        _state['sections'] = _dedupe_sections(existing)
        _state['professors'] = _build_professor_index(_state['sections'])
        _state['refreshedAt'] = _iso()
        _state['healthy'] = True
        _state['source'] = 'GoSOLAR Live Data'
        _state['warning'] = None
    return normalized


def _normalize_section(row: dict[str, Any], term: str) -> dict[str, Any]:
    meetings = row.get('meetingsFaculty') or []
    faculty = row.get('faculty') or []
    raw_instructor = ''
    if faculty:
        raw_instructor = faculty[0].get('displayName') or ''
    if not raw_instructor and meetings and meetings[0].get('faculty'):
        raw_instructor = meetings[0]['faculty'][0].get('displayName') or ''
    instructor_clean, instructor_slug = _normalize_instructor(raw_instructor)
    days, start_time, end_time, location = _meeting_data(meetings)

    seats_available = int(row.get('seatsAvailable') or 0)
    seats_total = int(row.get('maximumEnrollment') or 0)
    enrolled = int(row.get('enrollment') or 0)
    wait_count = int(row.get('waitCount') or 0)
    wait_cap = int(row.get('waitCapacity') or 0)
    section_type = _section_type(row, days, location)
    campus = (row.get('campusDescription') or '').strip() or ('Online' if days == 'Online' else 'Atlanta (main)')
    if days == 'Online' and campus.lower() not in {'online', 'online learning'}:
        campus = 'Online'

    return {
        'id': f"{row.get('subject', '')}-{row.get('courseNumber', '')}-{row.get('courseReferenceNumber', '')}",
        'crn': str(row.get('courseReferenceNumber') or ''),
        'subject': row.get('subject') or '',
        'courseNumber': str(row.get('courseNumber') or ''),
        'courseCode': f"{row.get('subject', '')} {row.get('courseNumber', '')}".strip(),
        'courseTitle': row.get('courseTitle') or '',
        'term': term,
        'termLabel': _term_label(term),
        'seatsAvailable': seats_available,
        'seatsTotal': seats_total,
        'enrolled': enrolled,
        'waitlistAvailable': max(0, wait_cap - wait_count),
        'waitlistCapacity': wait_cap,
        'instructor': raw_instructor or 'Staff',
        'instructorClean': instructor_clean,
        'instructorSlug': instructor_slug,
        'meetingDays': days,
        'meetingTime': f'{start_time} - {end_time}' if start_time != 'Async' else 'Async',
        'startTime': start_time,
        'endTime': end_time,
        'location': location,
        'campus': campus,
        'creditHours': int(row.get('creditHourLow') or row.get('creditHours') or 0),
        'sectionType': section_type,
        'isOpen': seats_available > 0,
        'isOverEnrolled': seats_available < 0,
        'registrationLink': _banner_link(term, str(row.get('courseReferenceNumber') or '')),
    }


def _save_term_cache(term: str, sections: list[dict[str, Any]]) -> None:
    SEATS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {'term': term, 'termLabel': _term_label(term), 'refreshedAt': _iso(), 'sections': sections, 'source': _state['source']}
    (SEATS_CACHE_DIR / f'{term}-all.json').write_text(json.dumps(payload, indent=2), encoding='utf-8')


def _load_term_cache(term: str) -> list[dict[str, Any]]:
    path = SEATS_CACHE_DIR / f'{term}-all.json'
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding='utf-8'))
        return payload.get('sections', []) or []
    except Exception:
        return []


def _build_professor_index(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    bucket: dict[str, dict[str, Any]] = {}
    for section in sections:
        name = section.get('instructorClean') or ''
        slug = section.get('instructorSlug') or ''
        if not name or not slug or name.lower() == 'staff':
            continue
        professor = bucket.setdefault(
            slug,
            {
                'id': slug,
                'name': name,
                'displayName': name,
                'slug': slug,
                'rmpSearchName': name,
                'departments': set(),
                'campus': set(),
                'courses': set(),
                'terms': set(),
                'sectionIds': set(),
                'sections': [],
                'rmpData': None,
            },
        )
        professor['departments'].add(section.get('subject') or '')
        professor['campus'].add(section.get('campus') or 'Unknown')
        professor['courses'].add(section.get('courseCode') or '')
        professor['terms'].add(section.get('term') or '')
        section_id = str(section.get('id') or '')
        if section_id and section_id not in professor['sectionIds']:
            professor['sectionIds'].add(section_id)
            professor['sections'].append(section)

    out: list[dict[str, Any]] = []
    for item in bucket.values():
        out.append(
            {
                'id': item['id'],
                'name': item['name'],
                'displayName': item['displayName'],
                'slug': item['slug'],
                'rmpSearchName': item['rmpSearchName'],
                'departments': sorted(d for d in item['departments'] if d),
                'campus': sorted(c for c in item['campus'] if c),
                'courses': sorted(c for c in item['courses'] if c),
                'terms': sorted((t for t in item['terms'] if t), key=_term_sort_key),
                'sections': item['sections'],
                'rmpData': item.get('rmpData'),
            }
        )
    out.sort(key=lambda p: p['name'])
    return out


def _active_terms_from_term_list(terms: list[dict[str, str]]) -> list[str]:
    available = {item['code'] for item in terms}
    candidates = [term for term in sorted(available, key=_term_sort_key) if _is_registration_open(term)]
    preferred = [term for term in ACTIVE_TERM_HINTS if term in available and term in candidates]
    remaining = [term for term in candidates if term not in preferred]
    active = preferred + remaining
    if not active:
        active = [term for term in ACTIVE_TERM_HINTS if _is_registration_open(term)]
    return active


async def full_refresh() -> dict[str, Any]:
    async with _state_lock:
        _state['refreshing'] = True
    warning = None
    terms_data: list[dict[str, str]] = []
    subjects_by_term: dict[str, list[dict[str, str]]] = {}
    sections_all: list[dict[str, Any]] = []

    try:
        async with await _client() as client:
            await client.get(f'{GOSOLAR_BASE_URL}/classSearch/classSearch')
            terms_data = await fetch_terms(client)
            active_terms = _active_terms_from_term_list(terms_data)

            failures: list[str] = []
            for term in active_terms:
                await _set_term(client, term)
                subjects = await fetch_subjects(client, term)
                subjects_by_term[term] = subjects
                for idx, subject in enumerate(subjects):
                    try:
                        rows = await fetch_sections_for_subject(client, term, subject['code'])
                        sections_all.extend(_normalize_section(row, term) for row in rows)
                    except Exception as exc:
                        failures.append(f"{term}:{subject['code']}:{exc}")
                    if idx < len(subjects) - 1:
                        await asyncio.sleep(0.3)
                _save_term_cache(term, [section for section in sections_all if section['term'] == term])

            async with _state_lock:
                _state.update(
                    {
                        'terms': terms_data,
                        'activeTerms': active_terms,
                        'sections': _dedupe_sections(sections_all),
                        'subjectsByTerm': subjects_by_term,
                        'refreshedAt': _iso(),
                        'source': 'GoSOLAR Live Data',
                        'healthy': True,
                        'warning': None if not failures else f'Partial refresh completed with {len(failures)} subject errors.',
                        'professors': _build_professor_index(sections_all),
                    }
                )
                _state['refreshing'] = False
            return _state
    except Exception as exc:
        # Keep serving last known good cache data.
        cached_sections: list[dict[str, Any]] = []
        for term in ACTIVE_TERM_HINTS:
            cached_sections.extend(_load_term_cache(term))
        cached_sections = _dedupe_sections(cached_sections)
        if cached_sections:
            warning = (
                f"Seat data may be outdated - GoSOLAR is currently unreachable. "
                f"Last updated: {_state.get('refreshedAt') or _iso()}."
            )
            async with _state_lock:
                _state.update(
                    {
                        'sections': cached_sections,
                        'activeTerms': [term for term in ACTIVE_TERM_HINTS if _is_registration_open(term)],
                        'source': 'GoSOLAR Cached Data',
                        'healthy': False,
                        'warning': warning,
                        'professors': _build_professor_index(cached_sections),
                    }
                )
                _state['refreshing'] = False
            return _state

        async with _state_lock:
            _state.update(
                {
                    'sections': [],
                    'activeTerms': [term for term in ACTIVE_TERM_HINTS if _is_registration_open(term)],
                    'source': 'Unavailable',
                    'healthy': False,
                    'warning': f'Live class data is temporarily unavailable. GoSOLAR may be down. Error: {exc}',
                }
            )
            _state['refreshing'] = False
        return _state


def _course_code_from_query(query: str) -> tuple[str, str]:
    clean = query.strip().upper()
    match = re.match(r'^([A-Z]{2,4})\s*(\d{4})?$', clean)
    if not match:
        return '', ''
    return match.group(1) or '', match.group(2) or ''


def _ensure_sections_loaded() -> None:
    if _state.get('sections'):
        return
    sections: list[dict[str, Any]] = []
    for term in ACTIVE_TERM_HINTS:
        sections.extend(_load_term_cache(term))
    sections = _dedupe_sections(sections)
    if sections:
        _state['sections'] = sections
        _state['activeTerms'] = [term for term in ACTIVE_TERM_HINTS if _is_registration_open(term)]
        _state['source'] = 'GoSOLAR Cached Data'
        _state['healthy'] = False
        _state['warning'] = 'Serving cached GoSOLAR data. Live refresh pending.'
        _state['professors'] = _build_professor_index(sections)


def get_state() -> dict[str, Any]:
    _ensure_sections_loaded()
    return _state


def get_active_terms() -> list[dict[str, str]]:
    state = get_state()
    terms = state.get('terms') or [{'code': term, 'description': _term_label(term)} for term in state.get('activeTerms', [])]
    active = set(state.get('activeTerms') or [])
    return [{'code': item['code'], 'label': item.get('description') or _term_label(item['code'])} for item in terms if item['code'] in active]


def get_professor_index() -> list[dict[str, Any]]:
    state = get_state()
    return state.get('professors') or _build_professor_index(state.get('sections') or [])


def get_catalog_summary() -> list[dict[str, Any]]:
    state = get_state()
    grouped: dict[str, dict[str, Any]] = {}
    for row in state.get('sections', []):
        code = row.get('courseCode') or ''
        if not code:
            continue
        item = grouped.setdefault(
            code,
            {
                'code': code,
                'name': row.get('courseTitle') or code,
                'department': row.get('subject') or '',
                'totalStudents': 0,
                'openSeats': 0,
                'sections': 0,
                'terms': set(),
            },
        )
        item['totalStudents'] += int(row.get('enrolled') or 0)
        item['openSeats'] += max(0, int(row.get('seatsAvailable') or 0))
        item['sections'] += 1
        item['terms'].add(row.get('term') or '')
    results: list[dict[str, Any]] = []
    for item in grouped.values():
        results.append(
            {
                'code': item['code'],
                'name': item['name'],
                'department': item['department'],
                'totalStudents': item['totalStudents'],
                'openSeats': item['openSeats'],
                'sections': item['sections'],
                'termCount': len([t for t in item['terms'] if t]),
            }
        )
    results.sort(key=lambda x: x['code'])
    return results


def _apply_filters(
    rows: list[dict[str, Any]],
    *,
    term: str | None = None,
    subject: str | None = None,
    course_number: str | None = None,
    query: str | None = None,
    campus: str | None = None,
) -> list[dict[str, Any]]:
    out = rows
    if term:
        out = [row for row in out if row.get('term') == term]
    if subject:
        out = [row for row in out if str(row.get('subject') or '').upper() == subject.upper()]
    if course_number:
        out = [row for row in out if str(row.get('courseNumber') or '') == str(course_number)]
    if campus and campus.lower() != 'all campuses':
        out = [row for row in out if str(row.get('campus') or '').lower() == campus.lower()]
    if query:
        q = query.lower().strip()
        out = [
            row
            for row in out
            if q in f"{row.get('courseCode', '')} {row.get('courseTitle', '')} {row.get('instructorClean', '')} {row.get('location', '')} {row.get('campus', '')}".lower()
        ]
    return out


async def search_classes(
    subject: str | None = None,
    term: str | None = None,
    query: str | None = None,
    campus: str | None = None,
) -> dict[str, Any]:
    state = get_state()
    rows = state.get('sections', [])
    infer_subject, infer_course = _course_code_from_query(query or '')
    picked_subject = (subject or infer_subject or '').upper() or None
    picked_course = infer_course or None
    active_terms = state.get('activeTerms') or [DEFAULT_TERM]
    selected_term = term if term in active_terms else (active_terms[0] if active_terms else DEFAULT_TERM)
    if picked_subject:
        has_rows = any(row.get('term') == selected_term and str(row.get('subject')).upper() == picked_subject for row in rows)
        if not has_rows:
            try:
                await _fetch_and_store_subject(selected_term, picked_subject, course_number=picked_course or '')
                state = get_state()
                rows = state.get('sections', [])
            except Exception as exc:
                state['warning'] = f"GoSOLAR fetch failed for {picked_subject} {selected_term}: {exc}"
    filtered = _apply_filters(rows, term=selected_term, subject=picked_subject, course_number=picked_course, query=query, campus=campus)
    if not filtered and not term and len(active_terms) > 1:
        for alt_term in active_terms:
            if alt_term == selected_term:
                continue
            alt_rows = _apply_filters(rows, term=alt_term, subject=picked_subject, course_number=picked_course, query=query, campus=campus)
            if alt_rows:
                selected_term = alt_term
                filtered = alt_rows
                break
    return {
        'subject': picked_subject or '',
        'term': selected_term,
        'termLabel': _term_label(selected_term),
        'activeTerms': get_active_terms(),
        'cachedAt': state.get('refreshedAt') or _iso(),
        'lastUpdated': state.get('refreshedAt') or _iso(),
        'source': state.get('source') or 'GoSOLAR Live Data',
        'warning': state.get('warning'),
        'sections': filtered,
    }


async def get_class_by_crn(crn: str, term: str | None = None, subject: str | None = None) -> dict[str, Any]:
    state = get_state()
    rows = state.get('sections', [])
    filtered = _apply_filters(rows, term=term, subject=subject)
    for row in filtered:
        if str(row.get('crn')) == str(crn):
            return row
    raise KeyError(f'No class section found for CRN {crn}')


async def get_course_sections(course_code: str, term: str | None = None, campus: str | None = None) -> dict[str, Any]:
    state = get_state()
    active_terms = state.get('activeTerms') or [DEFAULT_TERM]
    selected_term = term if term in active_terms else (active_terms[0] if active_terms else DEFAULT_TERM)
    normalized = course_code.upper().replace('%20', ' ').strip()
    subject, course_number = _course_code_from_query(normalized)
    all_rows = state.get('sections', [])
    if subject:
        has_rows = any(row.get('term') == selected_term and str(row.get('subject')).upper() == subject.upper() for row in all_rows)
        if not has_rows:
            try:
                await _fetch_and_store_subject(selected_term, subject, course_number=course_number or '')
                state = get_state()
                all_rows = state.get('sections', [])
            except Exception as exc:
                state['warning'] = f"GoSOLAR fetch failed for {subject} {selected_term}: {exc}"
    rows = _apply_filters(all_rows, term=selected_term, subject=subject or None, course_number=course_number or None, campus=campus)
    if not rows and not term and len(active_terms) > 1:
        for alt_term in active_terms:
            if alt_term == selected_term:
                continue
            alt_rows = _apply_filters(all_rows, term=alt_term, subject=subject or None, course_number=course_number or None, campus=campus)
            if alt_rows:
                selected_term = alt_term
                rows = alt_rows
                break
    return {
        'courseCode': normalized,
        'subject': subject,
        'courseNumber': course_number,
        'term': selected_term,
        'termLabel': _term_label(selected_term),
        'activeTerms': get_active_terms(),
        'lastUpdated': state.get('refreshedAt') or _iso(),
        'source': state.get('source') or 'GoSOLAR Live Data',
        'warning': state.get('warning'),
        'sections': rows,
    }


def get_status_payload() -> dict[str, Any]:
    state = get_state()
    return {
        'lastRefresh': state.get('refreshedAt'),
        'refreshing': bool(state.get('refreshing')),
        'termsLoaded': state.get('activeTerms') or [],
        'totalSections': len(state.get('sections') or []),
        'totalProfessors': len(get_professor_index()),
        'sources': {
            'banner': {'status': 'healthy' if state.get('healthy') else 'degraded', 'source': state.get('source'), 'warning': state.get('warning')},
            'rmp': {'status': 'unknown'},
            'reddit': {'status': 'unknown'},
        },
    }
