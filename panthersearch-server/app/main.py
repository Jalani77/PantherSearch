from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import RMP_REFRESH_SECONDS, SEATS_REFRESH_SECONDS
from app.services.gosolar import (
    full_refresh,
    get_active_terms,
    get_catalog_summary,
    get_class_by_crn,
    get_course_sections,
    get_professor_index,
    get_status_payload,
    search_classes,
)
from app.services.grades import get_grade_distribution, refresh_grades_cache_if_available
from app.services.reddit import search_reddit
from app.services.rmp import get_professor_by_slug, get_professor_detail, get_rate_my_professor_by_slug, refresh_rmp_cache_for_professors, search_professors
from app.services.views import get_trending, track_view

app = FastAPI(title='PantherSearch API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.state.last_refresh = {'banner': None, 'rmp': None, 'grades': None}
app.state.background_tasks: list[asyncio.Task] = []


class TrackViewPayload(BaseModel):
    type: str
    key: str
    label: str | None = None
    href: str | None = None
    subtitle: str = ''


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace('+00:00', 'Z')


async def _refresh_banner_and_grades() -> None:
    state = await full_refresh()
    app.state.last_refresh['banner'] = state.get('refreshedAt') or _iso()
    grades = await refresh_grades_cache_if_available()
    app.state.last_refresh['grades'] = grades.get('cachedAt') or _iso()


async def _refresh_rmp() -> None:
    result = await refresh_rmp_cache_for_professors()
    app.state.last_refresh['rmp'] = result.get('cachedAt') or _iso()


async def _periodic_runner(interval_seconds: int, coro, run_immediately: bool = False) -> None:
    if run_immediately:
        try:
            await coro()
        except Exception:
            pass
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await coro()
        except Exception:
            pass


@app.on_event('startup')
async def on_startup() -> None:
    # Start immediately from cache/state and run refresh in background.
    app.state.background_tasks = [
        asyncio.create_task(_periodic_runner(SEATS_REFRESH_SECONDS, _refresh_banner_and_grades, run_immediately=True)),
        asyncio.create_task(_periodic_runner(RMP_REFRESH_SECONDS, _refresh_rmp, run_immediately=True)),
    ]


@app.on_event('shutdown')
async def on_shutdown() -> None:
    for task in app.state.background_tasks:
        task.cancel()
    await asyncio.gather(*app.state.background_tasks, return_exceptions=True)


@app.get('/api/health')
async def health():
    return {'ok': True, 'service': 'PantherSearch FastAPI'}


@app.get('/api/status')
async def status():
    payload = get_status_payload()
    payload['refresh'] = app.state.last_refresh
    payload['activeTerms'] = get_active_terms()
    return payload


@app.post('/api/admin/refresh')
async def admin_refresh():
    await _refresh_banner_and_grades()
    await _refresh_rmp()
    return {'ok': True, 'refresh': app.state.last_refresh, 'status': get_status_payload()}


@app.get('/api/terms/active')
async def active_terms():
    return {'terms': get_active_terms()}


@app.get('/api/catalog')
async def catalog(query: str | None = None):
    rows = get_catalog_summary()
    if query:
        q = query.lower().strip()
        rows = [row for row in rows if q in f"{row['code']} {row['name']} {row['department']}".lower()]
    return {'cachedAt': app.state.last_refresh.get('banner') or _iso(), 'source': 'GoSOLAR Live Data', 'items': rows}


@app.get('/api/catalog/{course_code:path}')
async def catalog_by_code(course_code: str):
    normalized = course_code.upper().replace('%20', ' ').strip()
    compact = normalized.replace(' ', '')
    for row in get_catalog_summary():
        if row['code'].replace(' ', '') == compact:
            return {'cachedAt': app.state.last_refresh.get('banner') or _iso(), 'source': 'GoSOLAR Live Data', 'item': row}
    raise HTTPException(status_code=404, detail=f'Course not found: {normalized}')


@app.get('/api/professors')
async def professors(courseCode: str | None = None, query: str | None = None):
    rows = get_professor_index()
    if courseCode:
        compact = courseCode.upper().replace('%20', '').replace(' ', '')
        rows = [row for row in rows if any(course.replace(' ', '') == compact for course in row.get('courses', []))]
    if query:
        q = query.lower().strip()
        rows = [row for row in rows if q in f"{row['name']} {' '.join(row['courses'])} {' '.join(row['campus'])}".lower()]
    return {'cachedAt': app.state.last_refresh.get('banner') or _iso(), 'source': 'GoSOLAR Live Data', 'results': rows}


@app.get('/api/professor/search')
async def professor_search(name: str = Query(..., min_length=2)):
    # Return roster matches first, then RMP.
    roster = [item for item in get_professor_index() if name.lower() in item['name'].lower()]
    rmp = await search_professors(name)
    return {'query': name, 'cachedAt': _iso(), 'source': 'Banner + RMP', 'roster': roster, 'results': rmp.get('results', [])}


@app.get('/api/professor/{identifier}')
async def professor_detail(identifier: str):
    try:
        # Prefer slug-based lookup to avoid mis-attaching ratings.
        if '-' in identifier and not identifier.startswith('VGVhY2hlci'):
            return await get_professor_by_slug(identifier)
        return await get_professor_detail(identifier)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Unable to retrieve professor details: {exc}') from exc


@app.get('/api/professor/{slug}/ratemyprofessor')
async def professor_rate_my_professor(slug: str):
    try:
        return await get_rate_my_professor_by_slug(slug)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Unable to retrieve RateMyProfessor data: {exc}') from exc


@app.get('/api/reddit')
async def reddit(professor: str | None = None, query: str | None = None):
    try:
        return await search_reddit(professor=professor, query=query)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Unable to retrieve Reddit results: {exc}') from exc


@app.get('/api/reddit/{query:path}')
async def reddit_legacy(query: str):
    return await search_reddit(query=query)


@app.get('/api/classes')
async def classes(subject: str | None = None, term: str | None = None, query: str | None = None, campus: str | None = None):
    try:
        return await search_classes(subject=subject, term=term, query=query, campus=campus)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Unable to retrieve GoSOLAR class data: {exc}') from exc


@app.get('/api/course/{course_code:path}/sections')
async def course_sections(course_code: str, term: str | None = None, campus: str | None = None):
    try:
        return await get_course_sections(course_code, term=term, campus=campus)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Unable to retrieve course sections: {exc}') from exc


@app.get('/api/seats/{course_code:path}')
async def seats_legacy(course_code: str, term: str | None = None, campus: str | None = None):
    return await get_course_sections(course_code, term=term, campus=campus)


@app.get('/api/class/{crn}')
async def class_detail(crn: str, term: str | None = None, subject: str | None = None):
    try:
        return await get_class_by_crn(crn, term=term, subject=subject)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Unable to retrieve class details: {exc}') from exc


@app.get('/api/grades/{course_code:path}')
async def grades(course_code: str):
    return get_grade_distribution(course_code)


@app.post('/api/track-view')
async def track(payload: TrackViewPayload):
    return track_view(payload.model_dump())


@app.get('/api/trending')
async def trending(limit: int = 5):
    return get_trending(get_catalog_summary(), get_professor_index(), limit=max(1, min(limit, 50)))


@app.get('/api/views')
async def views(type: str = Query(...), limit: int = 5):
    trend = get_trending(get_catalog_summary(), get_professor_index(), limit=max(1, min(limit, 50)))
    if type in {'course', 'class'}:
        return {'type': type, 'items': trend.get('courses', [])}
    return {'type': type, 'items': trend.get('professors', [])}


@app.get('/api/search-index')
async def search_index():
    catalog = get_catalog_summary()
    professors = get_professor_index()
    return {
        'cachedAt': app.state.last_refresh.get('banner') or _iso(),
        'source': 'GoSOLAR Live Data',
        'courses': [{'code': item.get('code'), 'title': item.get('name'), 'slug': str(item.get('code', '')).replace(' ', '')} for item in catalog if item.get('code')],
        'instructors': [{'name': row.get('displayName') or row.get('name'), 'slug': row.get('slug')} for row in professors if row.get('slug')],
    }
