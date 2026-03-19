import type { Review, ReviewSource } from '../types';
import { classes } from './classes';
import { instructorMap } from './instructors';

const reviewSources: ReviewSource[] = ['RateMyProfessors', 'Reddit', 'PantherSearch'];
const reviewTags = [
  ['Clear expectations', 'Helpful notes'],
  ['Attendance helps', 'Exam heavy'],
  ['Project based', 'Real world examples'],
  ['Fast paced', 'Use office hours'],
  ['Great lecturer', 'Fair grading'],
  ['Discussion heavy', 'Read the rubric']
];

const praiseLead = [
  'This class was much more manageable once I stayed on top of the weekly work.',
  'The course had structure, and that honestly made the semester less stressful.',
  'I expected this one to be rough, but the professor made the material feel learnable.',
  'PantherSearch was right about the pacing here because the class follows a clear rhythm.'
];

const cautionLead = [
  'You cannot disappear for two weeks and expect to recover easily in this class.',
  'The content itself is not impossible, but the class moves faster than students expect.',
  'Most people who struggled around me waited too long to start reviewing.',
  'This class rewards consistency way more than cramming.'
];

const closeOut = [
  'If you do the practice set and review the slides before lecture, you will be in a good spot.',
  'I would take this professor again because the grading felt transparent and the comments were useful.',
  'The exams matched the lecture style, which made the whole course feel fair.',
  'Reddit made this sound worse than it was, but it definitely still takes discipline.'
];

export const reviews: Review[] = classes.flatMap((course, classIndex) =>
  course.instructorIds.flatMap((instructorId, instructorIndex) => {
    const instructor = instructorMap.get(instructorId);
    return Array.from({ length: 2 }).map((_, reviewIndex) => {
      const source = reviewSources[(classIndex + instructorIndex + reviewIndex) % reviewSources.length];
      const rating = Math.min(5, Math.max(2, Math.round((instructor?.rating ?? 4) + (reviewIndex === 0 ? 0 : -0.5))));
      const difficulty = Math.min(5, Math.max(1, Math.round((instructor?.difficulty ?? 3) + (reviewIndex === 0 ? 0 : 0.4))));
      const wouldTakeAgain = (instructor?.wouldTakeAgain ?? 75) > 72 || reviewIndex === 0;
      const semester = course.semesterBreakdown[(classIndex + reviewIndex) % course.semesterBreakdown.length].semester;
      const comment = [
        (reviewIndex + classIndex) % 3 === 0 ? cautionLead[(classIndex + instructorIndex) % cautionLead.length] : praiseLead[(classIndex + reviewIndex) % praiseLead.length],
        `${instructor?.name ?? 'The instructor'} kept ${course.name.toLowerCase()} grounded in examples that actually showed up on assignments.`,
        closeOut[(classIndex + instructorIndex + reviewIndex) % closeOut.length]
      ].join(' ');

      return {
        id: `review-${classIndex}-${instructorIndex}-${reviewIndex}`,
        classCode: course.code,
        instructorId,
        source,
        semester,
        rating,
        difficulty,
        gradeReceived: ['A', 'B', 'A', 'B', 'C'][(classIndex + instructorIndex + reviewIndex) % 5],
        wouldTakeAgain,
        comment,
        thumbsUp: 8 + ((classIndex * 3 + instructorIndex * 7 + reviewIndex) % 71),
        date: ['December 2025', 'August 2025', 'May 2025', 'December 2024', 'August 2024'][(classIndex + reviewIndex) % 5],
        tags: reviewTags[(classIndex + instructorIndex + reviewIndex) % reviewTags.length]
      };
    });
  })
);
