import { classes } from '../../src/data/classes';
import { instructors } from '../../src/data/instructors';

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
  return classes.find((course) => course.code === normalizeCourseCode(courseCode))?.name ?? normalizeCourseCode(courseCode);
}

export function matchInstructorIdByName(name: string) {
  const normalized = name.trim().toLowerCase();
  const direct = instructors.find((instructor) => instructor.name.toLowerCase() === normalized);
  if (direct) return direct.id;

  const stripped = normalized.replace(/^dr\.?\s+|^prof\.?\s+/i, '');
  const partial = instructors.find((instructor) => instructor.name.toLowerCase().includes(stripped));
  return partial?.id;
}

export function formatBannerTermLabel(termCode: string) {
  const year = termCode.slice(0, 4);
  const suffix = termCode.slice(4);
  if (suffix === '01') return `Spring ${year}`;
  if (suffix === '05') return `Summer ${year}`;
  if (suffix === '08') return `Fall ${year}`;
  return termCode;
}
