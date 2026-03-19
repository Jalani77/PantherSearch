import type { GradeDistribution, LiveGradeSemester, LiveGradesResponse, LiveSeatsResponse, ProfessorApiResponse, RedditApiResponse, Review } from '../types';
import { emptyDistribution } from '../utils/format';

const API_BASE = '/api';

async function requestJson<T>(path: string) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? payload?.message ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  getGrades: (courseCode: string) => requestJson<LiveGradesResponse>(`/grades/${encodeURIComponent(courseCode)}`),
  getSeats: (courseCode: string, term = '202601') => requestJson<LiveSeatsResponse>(`/seats/${encodeURIComponent(courseCode)}?term=${term}`),
  getProfessor: (name: string) => requestJson<ProfessorApiResponse>(`/professor/${encodeURIComponent(name)}`),
  getReddit: (query: string) => requestJson<RedditApiResponse>(`/reddit/${encodeURIComponent(query)}`),
};

export function liveSemesterToDistribution(semester: LiveGradeSemester): GradeDistribution {
  const distribution = emptyDistribution();
  distribution['4.0'] = semester.gradeDistribution.A;
  distribution['3.0'] = semester.gradeDistribution.B;
  distribution['2.0'] = semester.gradeDistribution.C;
  distribution['1.0'] = semester.gradeDistribution.D;
  distribution['0.0'] = semester.gradeDistribution.F;
  distribution.I = semester.gradeDistribution.W;
  distribution.NC = semester.gradeDistribution.WF;
  return distribution;
}

export function rmpResponseToReviews(classCode: string, instructorId: string | undefined, professorName: string, response: ProfessorApiResponse): Review[] {
  const reviews = response.professor?.reviews ?? [];
  return reviews.map((item) => ({
    id: item.id,
    classCode,
    instructorId,
    source: 'RateMyProfessors',
    semester: item.className || 'Recent',
    rating: Math.round(item.helpfulRating || response.professor?.avgRating || 0),
    difficulty: Math.round(item.difficultyRating || response.professor?.avgDifficulty || 0),
    gradeReceived: item.grade || 'N/A',
    wouldTakeAgain: (response.professor?.wouldTakeAgainPercent ?? 0) >= 50,
    comment: item.comment || 'No written comment provided.',
    thumbsUp: item.thumbsUpTotal,
    date: item.date || 'Recent',
    tags: item.ratingTags?.length ? item.ratingTags : ['RMP'],
    title: `${professorName} on ${item.className || classCode}`,
  }));
}

export function redditResponseToReviews(classCode: string, instructorId: string | undefined, response: RedditApiResponse): Review[] {
  return response.results.map((item) => ({
    id: item.id,
    classCode,
    instructorId,
    source: 'Reddit',
    semester: item.subreddit,
    rating: 4,
    difficulty: 3,
    gradeReceived: 'N/A',
    wouldTakeAgain: true,
    comment: item.topComment || item.selftext || item.title,
    thumbsUp: item.score,
    date: new Date(item.createdUtc * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    tags: ['Reddit', `r/${item.subreddit}`],
    title: item.title,
    url: item.permalink,
    author: item.author,
  }));
}
