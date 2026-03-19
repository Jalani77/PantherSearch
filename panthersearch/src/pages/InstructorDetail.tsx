import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ClassCard from '../components/ClassCard';
import GradeChart from '../components/GradeChart';
import ReviewCard from '../components/ReviewCard';
import { classes } from '../data/classes';
import { instructorMap } from '../data/instructors';
import { api, liveSemesterToDistribution, redditResponseToReviews, rmpResponseToReviews } from '../lib/api';
import type { LiveGradeSemester, ProfessorApiResponse, Review } from '../types';
import { getMedianKey, sumDistributions } from '../utils/format';

export default function InstructorDetail() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const instructor = instructorMap.get(id);
  const [professorData, setProfessorData] = useState<ProfessorApiResponse | null>(null);
  const [redditReviews, setRedditReviews] = useState<Review[]>([]);
  const [gradeRows, setGradeRows] = useState<LiveGradeSemester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taughtClasses = useMemo(() => (instructor ? classes.filter((course) => instructor.classIds.includes(course.code)) : []), [instructor]);

  useEffect(() => {
    if (!instructor) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [professorResponse, redditResponse, ...gradeResponses] = await Promise.all([
          api.getProfessor(instructor.name),
          api.getReddit(`${instructor.name} GSU`),
          ...taughtClasses.map((course) => api.getGrades(course.code)),
        ]);

        if (cancelled) return;

        setProfessorData(professorResponse);
        setRedditReviews(redditResponseToReviews(taughtClasses[0]?.code ?? '', instructor.id, redditResponse));
        setGradeRows(
          gradeResponses.flatMap((response) =>
            response.semesters.filter((semester) => semester.instructor.toLowerCase().includes(instructor.name.toLowerCase().split(' ').slice(-1)[0] ?? '')),
          ),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [instructor, taughtClasses]);

  if (!instructor) {
    return <div className="page-shell py-16 text-sm text-[#6B7280]">Instructor not found.</div>;
  }

  const liveRmpReviews = rmpResponseToReviews(taughtClasses[0]?.code ?? '', instructor.id, instructor.name, professorData ?? { query: instructor.name, found: false, source: '', cachedAt: '' });
  const mergedDistribution = sumDistributions(gradeRows.map(liveSemesterToDistribution));
  const liveReviews = [...liveRmpReviews, ...redditReviews];
  const rating = professorData?.professor?.avgRating ?? instructor.rating;
  const difficulty = professorData?.professor?.avgDifficulty ?? instructor.difficulty;
  const wouldTakeAgain = professorData?.professor?.wouldTakeAgainPercent ?? instructor.wouldTakeAgain;

  return (
    <div className="page-shell py-10">
      <div className="mb-8 flex items-start gap-4">
        <button type="button" onClick={() => navigate(-1)} className="btn-outline px-3 py-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-[28px] font-bold text-[#111111]">{instructor.name}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            {instructor.title} - {instructor.department}
          </p>
        </div>
      </div>

      <section className="surface-card mb-8 p-6">
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="text-sm leading-7 text-[#111111]">{instructor.bio}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {instructor.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#6B7280]">
                  {tag}
                </span>
              ))}
            </div>
            {professorData?.source ? <div className="mt-4 text-caption">Live rating source: {professorData.source}</div> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-[#E5E7EB] p-4">
              <div className="text-caption">Overall Rating</div>
              <div className="mt-2 text-2xl font-bold text-[#111111]">{rating.toFixed(1)}</div>
            </div>
            <div className="rounded-md border border-[#E5E7EB] p-4">
              <div className="text-caption">Difficulty</div>
              <div className="mt-2 text-2xl font-bold text-[#111111]">{difficulty.toFixed(1)}</div>
            </div>
            <div className="rounded-md border border-[#E5E7EB] p-4">
              <div className="text-caption">Would Take Again</div>
              <div className="mt-2 text-2xl font-bold text-[#111111]">{wouldTakeAgain}%</div>
            </div>
          </div>
        </div>
      </section>

      {loading ? <div className="surface-card mb-6 p-4 text-sm text-[#6B7280]">Loading real instructor data...</div> : null}
      {error ? <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section>
            <div className="section-label mb-3">All Classes Taught</div>
            <div className="grid gap-4 md:grid-cols-2">
              {taughtClasses.map((course) => (
                <ClassCard key={course.code} course={course} />
              ))}
            </div>
          </section>

          <section>
            <div className="section-label mb-3">Reviews</div>
            <div className="space-y-4">
              {liveReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </section>
        </div>

        <div>
          <div className="section-label mb-3">Grade Distribution Across All Classes</div>
          <GradeChart gradeDistribution={mergedDistribution} medianGrade={getMedianKey(mergedDistribution)} />
        </div>
      </div>
    </div>
  );
}
