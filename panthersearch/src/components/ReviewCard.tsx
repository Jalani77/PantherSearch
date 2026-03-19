import { ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { instructorMap } from '../data/instructors';
import type { Review } from '../types';

const sourceColors = {
  RateMyProfessors: 'bg-blue-50 text-blue-700 border-blue-200',
  Reddit: 'bg-orange-50 text-orange-700 border-orange-200',
  PantherSearch: 'bg-black text-white border-black',
};

export default function ReviewCard({ review }: { review: Review }) {
  const [helpful, setHelpful] = useState(review.thumbsUp);
  const instructor = review.instructorId ? instructorMap.get(review.instructorId) : undefined;
  const fullStars = Math.max(0, Math.min(5, Math.round(review.rating || 0)));
  const stars = `${'*'.repeat(fullStars)}${'.'.repeat(5 - fullStars)}`;

  return (
    <div className="surface-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className={`rounded-full border px-2.5 py-1 text-xs font-medium ${sourceColors[review.source]}`}>{review.source}</div>
        <div className="text-caption">
          {review.semester} - {review.date}
        </div>
      </div>
      {review.title ? <div className="mb-2 text-sm font-semibold text-[#111111]">{review.title}</div> : null}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">{stars}</span>
        <span className="text-[#6B7280]">Difficulty: {review.difficulty}/5</span>
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium">Grade: {review.gradeReceived}</span>
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium">Would take again: {review.wouldTakeAgain ? 'Yes' : 'No'}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {review.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-xs text-[#6B7280]">
            {tag}
          </span>
        ))}
      </div>
      <p className="mb-3 text-sm leading-6 text-[#111111]">{review.comment}</p>
      {review.url ? (
        <a href={review.url} target="_blank" rel="noreferrer" className="mb-3 inline-block text-sm font-medium text-[#111111] underline-offset-2 hover:underline">
          View original post
        </a>
      ) : null}
      {instructor ? (
        <Link to={`/instructor/${instructor.id}`} className="mb-3 inline-block text-sm font-medium text-[#111111] underline-offset-2 hover:underline">
          {instructor.name}
        </Link>
      ) : null}
      <div>
        <button type="button" onClick={() => setHelpful((value) => value + 1)} className="btn-outline gap-2 px-3 py-2 text-xs">
          <ThumbsUp size={14} />
          Helpful ({helpful})
        </button>
      </div>
    </div>
  );
}
