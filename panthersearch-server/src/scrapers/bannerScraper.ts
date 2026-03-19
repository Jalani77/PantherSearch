import fetch from 'node-fetch';
import type { LiveSeatsResponse, Section } from '../types';
import { readJsonCache, safeCacheKey, writeJsonCache } from '../utils/cache';
import { formatBannerTermLabel, matchInstructorIdByName, splitCourseCode } from '../utils/normalize';

const BANNER_BASE = 'https://registration.gosolar.gsu.edu/StudentRegistrationSsb/ssb';
const SEATS_TTL_MS = 15 * 60 * 1000;

type BannerTerm = {
  code: string;
  description: string;
};

type BannerSearchResult = {
  id: number | string;
  courseReferenceNumber: string;
  subject: string;
  courseNumber: string;
  subjectCourse: string;
  faculty: Array<{ displayName: string }>;
  meetingsFaculty: Array<{
    meetingTime?: {
      beginTime?: string;
      endTime?: string;
      monday?: boolean;
      tuesday?: boolean;
      wednesday?: boolean;
      thursday?: boolean;
      friday?: boolean;
      saturday?: boolean;
      sunday?: boolean;
      buildingDescription?: string;
      room?: string;
    };
    faculty?: Array<{ displayName: string }>;
  }>;
  seatsAvailable: number;
  maximumEnrollment: number;
  enrollment: number;
  waitCapacity: number;
  waitCount: number;
  scheduleTypeDescription?: string;
  courseTitle?: string;
};

function formatMeetingPattern(result: BannerSearchResult) {
  const meeting = result.meetingsFaculty?.[0]?.meetingTime;
  if (!meeting) {
    return { days: 'Online', startTime: 'Async', endTime: 'Async', location: 'Online', isOnline: true };
  }

  const letters = [
    meeting.monday ? 'M' : '',
    meeting.tuesday ? 'T' : '',
    meeting.wednesday ? 'W' : '',
    meeting.thursday ? 'R' : '',
    meeting.friday ? 'F' : '',
    meeting.saturday ? 'S' : '',
    meeting.sunday ? 'U' : '',
  ].join('');

  const locationParts = [meeting.buildingDescription, meeting.room].filter(Boolean);
  return {
    days: letters || 'Online',
    startTime: normalizeBannerTime(meeting.beginTime),
    endTime: normalizeBannerTime(meeting.endTime),
    location: locationParts.join(' ') || 'Online',
    isOnline: !letters,
  };
}

function normalizeBannerTime(value?: string) {
  if (!value) return 'Async';
  const clean = value.padStart(4, '0');
  const hours = Number(clean.slice(0, 2));
  const minutes = clean.slice(2);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

async function getTerms() {
  const response = await fetch(`${BANNER_BASE}/classSearch/getTerms?dataType=json&searchTerm=&offset=1&max=10`, {
    headers: { Accept: 'application/json', 'User-Agent': 'PantherSearch/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Banner getTerms failed with ${response.status}`);
  }

  return (await response.json()) as BannerTerm[];
}

async function initializeTermSession(termCode: string) {
  const response = await fetch(`${BANNER_BASE}/term/search?mode=search`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'PantherSearch/1.0',
    },
    body: new URLSearchParams({ term: termCode }).toString(),
    redirect: 'manual',
  });

  const cookieHeader = ((response.headers as any).raw?.()['set-cookie'] as string[] | undefined)?.map((cookie) => cookie.split(';')[0]).join('; ') ?? '';
  return cookieHeader;
}

async function searchBanner(courseCode: string, requestedTermCode?: string) {
  const { subject, courseNumber } = splitCourseCode(courseCode);
  const terms = await getTerms();
  const termCode = requestedTermCode ?? terms.find((term) => /(Spring|Summer|Fall)\s+20\d{2}/i.test(term.description))?.code ?? terms[0]?.code;

  if (!termCode) {
    throw new Error('No Banner terms available');
  }

  const cookie = await initializeTermSession(termCode);
  const searchUrl = new URL(`${BANNER_BASE}/searchResults/searchResults`);
  searchUrl.searchParams.set('txt_subject', subject);
  searchUrl.searchParams.set('txt_courseNumber', courseNumber);
  searchUrl.searchParams.set('txt_term', termCode);
  searchUrl.searchParams.set('pageOffset', '0');
  searchUrl.searchParams.set('pageMaxSize', '50');

  const response = await fetch(searchUrl.toString(), {
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
      'User-Agent': 'PantherSearch/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Banner searchResults failed with ${response.status}`);
  }

  const payload = (await response.json()) as { data?: BannerSearchResult[] };
  const rows = payload.data ?? [];

  const sections: Section[] = rows.map((row, index) => {
    const primaryFaculty = row.faculty?.[0]?.displayName ?? row.meetingsFaculty?.[0]?.faculty?.[0]?.displayName ?? 'Staff';
    const meeting = formatMeetingPattern(row);
    return {
      id: `${subject}-${courseNumber}-${row.courseReferenceNumber || index}`,
      classCode: `${subject} ${courseNumber}`,
      crn: row.courseReferenceNumber,
      instructorId: matchInstructorIdByName(primaryFaculty),
      instructorName: primaryFaculty,
      days: meeting.days,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      enrolled: row.enrollment ?? 0,
      capacity: row.maximumEnrollment ?? 0,
      seatsRemaining: row.seatsAvailable ?? Math.max(0, (row.maximumEnrollment ?? 0) - (row.enrollment ?? 0)),
      waitlisted: row.waitCount ?? 0,
      semester: formatBannerTermLabel(termCode),
      isOnline: meeting.isOnline,
      notes: row.scheduleTypeDescription,
    };
  });

  return {
    courseCode: `${subject} ${courseNumber}`,
    termCode,
    termLabel: formatBannerTermLabel(termCode),
    lastUpdated: new Date().toISOString(),
    sections,
    source: searchUrl.toString(),
  };
}

export async function fetchBannerSeats(courseCode: string, termCode?: string) {
  const cacheKey = safeCacheKey(`${courseCode}-${termCode ?? 'current'}`);
  const cached = await readJsonCache<LiveSeatsResponse>('seats', cacheKey, SEATS_TTL_MS);
  if (cached) return cached;

  const fresh = await searchBanner(courseCode, termCode);
  await writeJsonCache('seats', cacheKey, fresh);
  return fresh;
}
