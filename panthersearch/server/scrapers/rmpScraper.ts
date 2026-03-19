import fetch from 'node-fetch';
import type { ProfessorApiResponse, RmpReview } from '../../src/types';
import { readJsonCache, safeCacheKey, writeJsonCache } from '../utils/cache';

const RMP_ENDPOINT = 'https://www.ratemyprofessors.com/graphql';
const RMP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RMP_SCHOOL_ID = 'U2Nob29sLTM1MA==';

const query = `
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
    }
  }
`;

export async function fetchProfessorRmp(name: string) {
  const cacheKey = safeCacheKey(name);
  const cached = await readJsonCache<ProfessorApiResponse>('rmp', cacheKey, RMP_TTL_MS);
  if (cached) return cached;

  const response = await fetch(RMP_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: 'Basic dGVzdDp0ZXN0',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'PantherSearch/1.0',
    },
    body: JSON.stringify({
      query,
      variables: {
        text: name,
        schoolID: RMP_SCHOOL_ID,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`RMP request failed with ${response.status}`);
  }

  const payload = (await response.json()) as any;
  const edges = payload?.data?.newSearch?.teachers?.edges ?? [];
  const bestMatch = edges[0]?.node;

  const result: ProfessorApiResponse = {
    query: name,
    found: Boolean(bestMatch),
    source: RMP_ENDPOINT,
    cachedAt: new Date().toISOString(),
    professor: bestMatch
      ? {
          id: bestMatch.id,
          firstName: bestMatch.firstName,
          lastName: bestMatch.lastName,
          department: bestMatch.department ?? '',
          avgRating: Number(bestMatch.avgRating ?? 0),
          avgDifficulty: Number(bestMatch.avgDifficulty ?? 0),
          wouldTakeAgainPercent: Number(bestMatch.wouldTakeAgainPercent ?? 0),
          numRatings: Number(bestMatch.numRatings ?? 0),
          reviews: ((bestMatch.ratings?.edges ?? []) as any[]).map(
            (edge, index): RmpReview => ({
              id: `${bestMatch.id}-${index}`,
              comment: edge.node.comment ?? '',
              className: edge.node.class ?? '',
              date: edge.node.date ?? '',
              grade: edge.node.grade ?? '',
              thumbsUpTotal: Number(edge.node.thumbsUpTotal ?? 0),
              thumbsDownTotal: Number(edge.node.thumbsDownTotal ?? 0),
              ratingTags: edge.node.ratingTags ?? [],
              helpfulRating: Number(edge.node.helpfulRating ?? 0),
              difficultyRating: Number(edge.node.difficultyRating ?? 0),
              attendanceMandatory: Boolean(edge.node.attendanceMandatory),
            }),
          ),
        }
      : undefined,
  };

  await writeJsonCache('rmp', cacheKey, result);
  return result;
}
