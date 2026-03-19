import fetch from 'node-fetch';
import type { RedditApiResponse, RedditResult } from '../../src/types';
import { readJsonCache, safeCacheKey, writeJsonCache } from '../utils/cache';

const REDDIT_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchListing(query: string, subreddit: string) {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&limit=10`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PantherSearch/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit search failed with ${response.status}`);
  }

  const payload = (await response.json()) as any;
  const children = payload?.data?.children ?? [];

  const results = await Promise.all(
    children.map(async (child: any): Promise<RedditResult> => {
      const permalink = `https://www.reddit.com${child.data.permalink}`;
      const postResponse = await fetch(`${permalink}.json`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PantherSearch/1.0',
        },
      });

      let topComment = '';
      if (postResponse.ok) {
        const postPayload = (await postResponse.json()) as any[];
        topComment = postPayload?.[1]?.data?.children?.[0]?.data?.body ?? '';
      }

      return {
        id: child.data.id,
        title: child.data.title,
        url: child.data.url_overridden_by_dest ?? permalink,
        permalink,
        subreddit,
        score: Number(child.data.score ?? 0),
        createdUtc: Number(child.data.created_utc ?? 0),
        author: child.data.author ?? 'unknown',
        selftext: child.data.selftext ?? '',
        topComment,
      };
    }),
  );

  return { url, results };
}

export async function fetchRedditResults(query: string) {
  const cacheKey = safeCacheKey(query);
  const cached = await readJsonCache<RedditApiResponse>('reddit', cacheKey, REDDIT_TTL_MS);
  if (cached) return cached;

  let source = 'https://www.reddit.com/r/GaState/search.json';
  let subreddit = 'GaState';
  let results: RedditResult[] = [];

  try {
    const primary = await fetchListing(query, 'GaState');
    source = primary.url;
    results = primary.results;
  } catch {
    results = [];
  }

  if (!results.length) {
    const fallback = await fetchListing(query, 'GeorgiaStateUniversity');
    source = fallback.url;
    subreddit = 'GeorgiaStateUniversity';
    results = fallback.results;
  }

  const payload: RedditApiResponse = {
    query,
    source,
    cachedAt: new Date().toISOString(),
    subreddit,
    results,
  };

  await writeJsonCache('reddit', cacheKey, payload);
  return payload;
}
