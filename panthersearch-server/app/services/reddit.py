from __future__ import annotations

import httpx

from app.config import CACHE_TTL_SECONDS, REDDIT_BASE_URL
from app.services.cache import cache_key, read_cache, write_cache

HEADERS = {'User-Agent': 'PantherSearch/1.0', 'Accept': 'application/json'}


async def search_reddit(professor: str | None = None, query: str | None = None) -> dict:
    search_term = (professor or query or '').strip()
    cache_name = cache_key(search_term)
    cached = read_cache('reddit', cache_name, 6 * 60 * 60)
    if cached:
        return cached

    q = query or f'{search_term} GSU Georgia State'
    url = f'{REDDIT_BASE_URL}/search.json'
    params = {'q': q, 'limit': 5, 'sort': 'relevance'}
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

        # fallback to GSU-focused subreddits when no broad matches
        rows = payload.get('data', {}).get('children', [])
        if not rows:
            response = await client.get(
                f'{REDDIT_BASE_URL}/r/GaState/search.json',
                params={'q': q, 'restrict_sr': 1, 'limit': 10, 'sort': 'relevance'},
            )
            response.raise_for_status()
            payload = response.json()
            rows = payload.get('data', {}).get('children', [])
        if not rows:
            response = await client.get(
                f'{REDDIT_BASE_URL}/r/GeorgiaStateUniversity/search.json',
                params={'q': q, 'restrict_sr': 1, 'limit': 10, 'sort': 'relevance'},
            )
            response.raise_for_status()
            payload = response.json()

    tokens = [token.lower() for token in search_term.split() if token]
    posts = []
    for child in payload.get('data', {}).get('children', []):
        data = child.get('data', {})
        permalink = data.get('permalink') or ''
        haystack = f"{data.get('title', '')} {data.get('selftext', '')} {data.get('subreddit', '')}".lower()
        if professor and tokens and not all(token in haystack for token in tokens):
            continue
        if not professor and tokens and not all(token in haystack for token in tokens[:2]) and data.get('subreddit') not in {'GaState', 'GeorgiaStateUniversity'}:
            continue
        posts.append({
            'id': data.get('id', ''),
            'title': data.get('title', ''),
            'url': f"{REDDIT_BASE_URL}{permalink}" if permalink else data.get('url_overridden_by_dest') or '',
            'permalink': permalink,
            'score': int(data.get('score') or 0),
            'subreddit': data.get('subreddit', ''),
            'createdUtc': int(data.get('created_utc') or 0),
            'author': data.get('author') or '',
            'selftext': data.get('selftext', ''),
            'topComment': '',
        })

    result = {'query': search_term, 'source': url, 'cachedAt': __import__('datetime').datetime.utcnow().isoformat() + 'Z', 'results': posts}
    write_cache('reddit', cache_name, result)
    return result
