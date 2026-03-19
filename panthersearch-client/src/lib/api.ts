import type {
  ActiveTerm,
  CatalogByCodeResponse,
  CatalogResponse,
  GradeDistribution,
  LiveGradeSemester,
  LiveGradesResponse,
  LiveSeatsResponse,
  ProfessorApiResponse,
  ProfessorBySlugResponse,
  ProfessorSearchResponse,
  ProfessorsResponse,
  RedditApiResponse,
  RateMyProfessorResponse,
  SearchIndexResponse,
  Review,
  SearchResultItem,
  Section,
  StatusResponse,
  TrendingResponse,
  ViewEntry,
} from '../types';
import { emptyDistribution } from '../utils/format';

const API_BASE = '/api';

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? payload?.error ?? payload?.message ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

type RawSeatSection = {
  id: string;
  courseCode: string;
  classCode?: string;
  crn: string;
  subject: string;
  courseNumber: string;
  courseTitle: string;
  term: string;
  termLabel: string;
  seatsAvailable: number;
  seatsTotal: number;
  enrolled: number;
  waitlistAvailable: number;
  waitlistCapacity: number;
  instructor: string;
  instructorClean: string;
  instructorSlug: string;
  meetingDays: string;
  meetingTime: string;
  startTime: string;
  endTime: string;
  location: string;
  campus: string;
  creditHours: number;
  sectionType: string;
  isOpen: boolean;
  isOverEnrolled: boolean;
  registrationLink: string;
};

type RawSeatsResponse = {
  courseCode?: string;
  subject: string;
  term: string;
  termLabel?: string;
  activeTerms?: ActiveTerm[];
  cachedAt?: string;
  lastUpdated?: string;
  sections: RawSeatSection[];
  source?: string;
  warning?: string | null;
};

type RawViewsResponse = {
  type: 'class' | 'instructor' | 'course' | 'professor';
  items: ViewEntry[];
};

const slugifyClassCode = (code: string) => code.replace(/\s+/g, '');
let searchIndexCache: SearchIndexResponse | null = null;
let searchIndexPromise: Promise<SearchIndexResponse> | null = null;

function mapSeatSection(section: RawSeatSection, termLabel: string): Section {
  return {
    id: section.id,
    classCode: section.courseCode || section.classCode || `${section.subject} ${section.courseNumber}`,
    courseTitle: section.courseTitle,
    subject: section.subject,
    courseNumber: section.courseNumber,
    termCode: section.term,
    termLabel: section.termLabel || termLabel,
    crn: section.crn,
    instructorName: section.instructorClean || section.instructor,
    instructorSlug: section.instructorSlug || undefined,
    days: section.meetingDays || 'TBA',
    startTime: section.startTime || 'TBA',
    endTime: section.endTime || 'TBA',
    location: section.location || 'TBA',
    campus: section.campus || 'Atlanta (main)',
    enrolled: section.enrolled,
    capacity: section.seatsTotal,
    seatsRemaining: section.seatsAvailable,
    waitlisted: Math.max(0, section.waitlistCapacity - section.waitlistAvailable),
    semester: termLabel,
    isOnline: (section.meetingDays || '').toLowerCase() === 'online' || (section.location || '').toLowerCase().includes('online'),
    notes: section.sectionType,
  };
}

export const api = {
  getStatus: () => requestJson<StatusResponse>('/status'),
  getActiveTerms: async () => {
    const payload = await requestJson<{ terms: ActiveTerm[] }>('/terms/active');
    return payload.terms;
  },
  getCatalog: (query?: string) => requestJson<CatalogResponse>(`/catalog${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  getCatalogByCode: (courseCode: string) => requestJson<CatalogByCodeResponse>(`/catalog/${encodeURIComponent(courseCode)}`),
  getProfessors: (courseCode?: string, query?: string) =>
    requestJson<ProfessorsResponse>(`/professors${courseCode || query ? `?${new URLSearchParams({ ...(courseCode ? { courseCode } : {}), ...(query ? { query } : {}) }).toString()}` : ''}`),
  getProfessorBySlug: (slug: string) => requestJson<ProfessorBySlugResponse>(`/professor/${encodeURIComponent(slug)}`),
  getProfessorRateMyProfessor: (slug: string) => requestJson<RateMyProfessorResponse>(`/professor/${encodeURIComponent(slug)}/ratemyprofessor`),
  getGrades: (courseCode: string) => requestJson<LiveGradesResponse>(`/grades/${encodeURIComponent(courseCode)}`),
  getSeats: async (courseCode: string, term?: string, campus?: string): Promise<LiveSeatsResponse> => {
    const params = new URLSearchParams();
    if (term) params.set('term', term);
    if (campus) params.set('campus', campus);
    const raw = await requestJson<RawSeatsResponse>(`/course/${encodeURIComponent(courseCode)}/sections${params.size ? `?${params.toString()}` : ''}`);
    const termLabel = raw.termLabel ?? raw.term;
    return {
      courseCode: courseCode,
      termCode: raw.term,
      termLabel,
      activeTerms: raw.activeTerms,
      lastUpdated: raw.lastUpdated ?? raw.cachedAt ?? new Date().toISOString(),
      sections: raw.sections.map((section) => mapSeatSection(section, termLabel)),
      source: raw.source ?? 'GoSOLAR Live Data',
      warning: raw.warning ?? null,
    };
  },
  searchProfessor: (name: string) => requestJson<ProfessorSearchResponse>(`/professor/search?name=${encodeURIComponent(name)}`),
  getProfessorDetail: (rmpId: string) => requestJson<ProfessorApiResponse>(`/professor/${encodeURIComponent(rmpId)}`),
  getReddit: (query: string, mode: 'professor' | 'query' = 'query') =>
    requestJson<RedditApiResponse>(mode === 'professor' ? `/reddit?professor=${encodeURIComponent(query)}` : `/reddit?query=${encodeURIComponent(query)}`),
  searchClasses: async (query: string, term?: string, campus?: string): Promise<SearchResultItem[]> => {
    const params = new URLSearchParams({ query });
    if (term) params.set('term', term);
    if (campus) params.set('campus', campus);
    const raw = await requestJson<RawSeatsResponse>(`/classes?${params.toString()}`);
    const seen = new Set<string>();
    return raw.sections
      .filter((section) => {
        const key = section.courseCode || `${section.subject} ${section.courseNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((section) => ({
        id: section.courseCode || `${section.subject} ${section.courseNumber}`,
        type: 'class' as const,
        title: `${section.courseCode || `${section.subject} ${section.courseNumber}`} - ${section.courseTitle}`,
        subtitle: section.campus || raw.termLabel || raw.term,
        metric: `${Math.max(0, section.seatsAvailable)} open`,
        href: `/class/${slugifyClassCode(section.courseCode || `${section.subject} ${section.courseNumber}`)}`,
      }));
  },
  trackView: (payload: { type: 'course' | 'professor' | 'class' | 'instructor'; key: string; label?: string; href?: string; subtitle?: string }) =>
    requestJson<{ ok: boolean }>('/track-view', { method: 'POST', body: JSON.stringify(payload) }),
  getTrending: (limit = 5) => requestJson<TrendingResponse>(`/trending?limit=${limit}`),
  getSearchIndex: async (forceRefresh = false) => {
    if (!forceRefresh && searchIndexCache) return searchIndexCache;
    if (!forceRefresh && searchIndexPromise) return searchIndexPromise;
    searchIndexPromise = requestJson<SearchIndexResponse>('/search-index')
      .then((payload) => {
        searchIndexCache = payload;
        return payload;
      })
      .finally(() => {
        searchIndexPromise = null;
      });
    return searchIndexPromise;
  },
  getViews: async (type: 'class' | 'instructor', limit = 5) => {
    const raw = await requestJson<RawViewsResponse>(`/views?type=${type}&limit=${limit}`);
    return raw.items;
  },
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
    url: item.url || item.permalink,
    author: item.author,
  }));
}
