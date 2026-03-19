import { ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Review } from '../types';

const sourceColors = {
  RateMyProfessors: 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]',
  Reddit: 'bg-orange-50 text-orange-700 border-orange-200',
  PantherSearch: 'bg-[#111827] text-white border-[#111827]',
};

export default function ReviewCard({ review }: { review: Review }) {
  const [helpful, setHelpful] = useState(review.thumbsUp);
  const fullStars = Math.max(0, Math.min(5, Math.round(review.rating || 0)));
  const stars = `${'*'.repeat(fullStars)}${'.'.repeat(5 - fullStars)}`;
  const sourceLabel = review.source === 'RateMyProfessors' ? 'RateMyProfessor' : review.source;

  return (
    <div className="surface-card bg-[#F8F8FD] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${sourceColors[review.source]}`}>
          {review.source === 'RateMyProfessors' ? <span className="h-1.5 w-1.5 rounded-full bg-[#6C2DFF]" /> : null}
          Source: {sourceLabel}
        </div>
        <div className="text-caption">
          {review.semester} - {review.date}
        </div>
      </div>
      {review.classCode ? <div className="mb-2 text-xs font-semibold tracking-wide text-[#1B3BFF]">{review.classCode}</div> : null}
      {review.title ? <div className="mb-2 text-sm font-semibold text-[#111111]">{review.title}</div> : null}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">{stars}</span>
        <span className="text-[#6B7280]">Difficulty: {review.difficulty}/5</span>
        <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#1E3A8A]">Grade: {review.gradeReceived}</span>
        <span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 text-xs font-medium text-[#5B21B6]">Would take again: {review.wouldTakeAgain ? 'Yes' : 'No'}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {review.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-[#DDE3FF] bg-white px-2.5 py-1 text-xs text-[#6B7280]">
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
      {review.instructorId ? (
        <Link to={`/instructor/${review.instructorId}`} className="mb-3 inline-block text-sm font-medium text-[#111111] underline-offset-2 hover:underline">
          View instructor
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
