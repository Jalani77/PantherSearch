import type { Section } from '../types';
import { classes } from './classes';

const meetingPatterns = [
  { days: 'MWF', startTime: '9:30 AM', endTime: '10:20 AM' },
  { days: 'TR', startTime: '11:00 AM', endTime: '12:15 PM' },
  { days: 'MW', startTime: '1:00 PM', endTime: '2:15 PM' },
  { days: 'TR', startTime: '2:30 PM', endTime: '3:45 PM' },
  { days: 'F', startTime: '9:00 AM', endTime: '11:30 AM' },
  { days: 'Online', startTime: 'Async', endTime: 'Async' }
];

const locations = [
  'Aderhold Learning Center 101',
  'Classroom South 402',
  'Library North 152',
  'Urban Life Building 214',
  'One Park Place 315',
  'College of Law 240',
  'Science Annex 118',
  'Student Center East 207',
  '25 Park Place 1430',
  'Langdale Hall 207',
  'Kell Hall 301',
  'Andrew Young School 520'
];

export const sections: Section[] = classes.flatMap((course, courseIndex) =>
  Array.from({ length: 4 }).map((_, sectionIndex) => {
    const pattern = meetingPatterns[(courseIndex + sectionIndex) % meetingPatterns.length];
    const capacity = 24 + ((courseIndex + sectionIndex) % 4) * 12;
    const isFull = (courseIndex + sectionIndex) % 5 === 0;
    const isTight = (courseIndex + sectionIndex) % 5 === 1;
    const enrolled = isFull ? capacity : isTight ? capacity - (1 + ((courseIndex + sectionIndex) % 4)) : capacity - (8 + ((courseIndex + sectionIndex) % 10));
    const waitlisted = isFull ? 2 + ((courseIndex + sectionIndex) % 6) : 0;
    return {
      id: `${course.slug}-${sectionIndex + 1}`,
      classCode: course.code,
      crn: String(12000 + courseIndex * 11 + sectionIndex * 3).padStart(5, '0'),
      instructorId: course.instructorIds[sectionIndex % course.instructorIds.length],
      days: pattern.days,
      startTime: pattern.startTime,
      endTime: pattern.endTime,
      location: pattern.days === 'Online' ? 'Online Synchronous' : locations[(courseIndex + sectionIndex) % locations.length],
      enrolled,
      capacity,
      seatsRemaining: Math.max(0, capacity - enrolled),
      waitlisted,
      semester: 'Spring 2026',
      isOnline: pattern.days === 'Online',
      notes: pattern.days === 'Online' ? 'Hybrid attendance options' : sectionIndex === 2 ? 'Lab Required' : undefined
    };
  })
);
