export function normalizeCourseCode(courseCode: string) {
  return courseCode
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(/^([A-Z]+)\s?(\d+)$/, '$1 $2');
}

export function splitCourseCode(courseCode: string) {
  const normalized = normalizeCourseCode(courseCode);
  const match = normalized.match(/^([A-Z]+)\s+(\d+[A-Z]?)$/);
  if (!match) {
    throw new Error(`Invalid course code: ${courseCode}`);
  }
  return { normalized, subject: match[1], courseNumber: match[2] };
}

export function resolveCourseName(courseCode: string) {
  return normalizeCourseCode(courseCode);
}

export function matchInstructorIdByName(name: string) {
  if (!name.trim()) return undefined;
  return name
    .trim()
    .toLowerCase()
    .replace(/^dr\.?\s+|^prof\.?\s+/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatBannerTermLabel(termCode: string) {
  const year = termCode.slice(0, 4);
  const suffix = termCode.slice(4);
  if (suffix === '01') return `Spring ${year}`;
  if (suffix === '05') return `Summer ${year}`;
  if (suffix === '08') return `Fall ${year}`;
  return termCode;
}
