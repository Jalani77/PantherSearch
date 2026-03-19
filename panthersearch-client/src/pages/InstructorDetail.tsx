import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import GradeChart from '../components/GradeChart';
import ReviewCard from '../components/ReviewCard';
import { api, liveSemesterToDistribution, redditResponseToReviews } from '../lib/api';
import type { GradeDistribution, LiveGradeSemester, ProfessorBySlugResponse, RateMyProfessorResponse, Review } from '../types';
import { emptyDistribution, formatClassRoute, getMedianKey, sumDistributions } from '../utils/format';

export default function InstructorDetail() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [profile, setProfile] = useState<ProfessorBySlugResponse | null>(null);
  const [courses, setCourses] = useState<{ code: string; name: string }[]>([]);
  const [redditReviews, setRedditReviews] = useState<Review[]>([]);
  const [gradeRows, setGradeRows] = useState<LiveGradeSemester[]>([]);
  const [rateMyProfessorData, setRateMyProfessorData] = useState<RateMyProfessorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await api.getProfessorBySlug(id);
        if (!detail.found || !detail.professor) {
          throw new Error('Instructor not found.');
        }
        const name = detail.professor.name;
        const [redditResponse, catalogResponse, rateMyProfessorResponse, ...gradeResponses] = await Promise.all([
          api.getReddit(name, 'professor'),
          api.getCatalog(),
          api.getProfessorRateMyProfessor(detail.professor.slug).catch(() => null),
          ...detail.professor.courses.slice(0, 8).map((course) => api.getGrades(course)),
        ]);
        if (cancelled) return;

        setProfile(detail);
        setRateMyProfessorData(
          rateMyProfessorResponse ?? {
            cachedAt: new Date().toISOString(),
            source: 'RateMyProfessor',
            hasRateMyProfessorData: false,
            rating: 0,
            difficulty: 0,
            wouldTakeAgainPercent: 0,
            numRatings: 0,
            tags: [],
            reviews: [],
            ratemyprofessorUrl: 'https://www.ratemyprofessors.com',
          },
        );
        setRedditReviews(redditResponseToReviews(detail.professor.courses[0] ?? '', detail.professor.slug, redditResponse));
        setCourses(
          detail.professor.courses.map((code) => {
            const catalogMatch = catalogResponse.items.find((item) => item.code === code);
            return { code, name: catalogMatch?.name ?? code };
          }),
        );
        setGradeRows(gradeResponses.flatMap((response) => response.semesters.filter((semester) => semester.instructor.toLowerCase().includes(name.toLowerCase().split(' ').slice(-1)[0] ?? ''))));
        void api.trackView({
          type: 'professor',
          key: detail.professor.slug,
        }).catch(() => undefined);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!profile?.professor) {
    return <div className="page-shell py-16 text-sm text-[#6B7280]">{error || 'Loading instructor...'}</div>;
  }

  const rating = rateMyProfessorData?.rating ?? 0;
  const difficulty = rateMyProfessorData?.difficulty ?? 0;
  const wouldTakeAgain = rateMyProfessorData?.wouldTakeAgainPercent ?? 0;
  const hasRateMyProfessorData = Boolean(rateMyProfessorData?.hasRateMyProfessorData);

  const rmpReviews: Review[] = (rateMyProfessorData?.reviews ?? []).map((review) => ({
    id: review.id || `${profile.professor!.slug}-${review.date}-${review.courseCode}`,
    classCode: review.courseCode || '',
    instructorId: profile.professor!.slug,
    source: 'RateMyProfessors',
    semester: review.courseCode || 'Recent',
    rating: Math.round(review.rating || rating),
    difficulty: Math.round(review.difficulty || difficulty),
    gradeReceived: 'N/A',
    wouldTakeAgain: wouldTakeAgain >= 50,
    comment: review.comment || 'No written comment provided',
    thumbsUp: 0,
    date: review.date || 'Recent',
    tags: rateMyProfessorData?.tags?.length ? rateMyProfessorData.tags.slice(0, 3) : ['RateMyProfessor'],
  }));

  const mergedDistribution: GradeDistribution = useMemo(
    () => (gradeRows.length ? sumDistributions(gradeRows.map(liveSemesterToDistribution)) : emptyDistribution()),
    [gradeRows],
  );
  const liveReviews = [...rmpReviews, ...redditReviews];
  const ratingPct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const difficultyPct = Math.max(0, Math.min(100, (difficulty / 5) * 100));
  const takeAgainPct = Math.max(0, Math.min(100, wouldTakeAgain));

  return (
    <div className="page-shell py-10">
      <div className="mb-8 flex items-start gap-4">
        <button type="button" onClick={() => navigate(-1)} className="btn-outline px-3 py-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-[30px] font-bold text-[#111827]">{profile.professor.name}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">{profile.professor.departments.join(', ')} - {profile.professor.campus.join(', ')}</p>
        </div>
      </div>
      {loading ? <div className="surface-card mb-6 p-4 text-sm text-[#6B7280]">Loading real instructor data...</div> : null}
      {error ? <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
        <div className="space-y-6">
          <section className="surface-card bg-[#F7F7FB] p-6">
            <div className="mb-4 text-sm leading-7 text-[#111827]">Instructor profile built from live GoSOLAR sections and RateMyProfessor when available.</div>
            <div className="mb-5 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-[#1B3BFF]">
                  <span>Rating</span>
                  <span>{rating ? rating.toFixed(1) : 'N/A'}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#DBEAFE]">
                  <div className={`h-full rounded-full ${hasRateMyProfessorData ? 'bg-[#1B3BFF]' : 'bg-gray-400'}`} style={{ width: `${ratingPct}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-[#6C2DFF]">
                  <span>Difficulty</span>
                  <span>{difficulty ? difficulty.toFixed(1) : 'N/A'}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#EDE9FE]">
                  <div className={`h-full rounded-full ${hasRateMyProfessorData ? 'bg-[#6C2DFF]' : 'bg-gray-400'}`} style={{ width: `${difficultyPct}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-[#374151]">
                  <span>Would Take Again</span>
                  <span>{wouldTakeAgain ? `${wouldTakeAgain}%` : 'N/A'}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div className="h-full rounded-full bg-[#334155]" style={{ width: `${takeAgainPct}%` }} />
                </div>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {rateMyProfessorData?.tags?.length ? (
                rateMyProfessorData.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[#1B3BFF] px-2.5 py-1 text-xs font-medium text-white">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#6B7280]">Not yet on RateMyProfessor</span>
              )}
            </div>
            {!hasRateMyProfessorData ? <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">RateMyProfessor data is not available for this instructor right now.</div> : null}
            <div className="text-caption">
              Source: {profile.source}
              {rateMyProfessorData?.cachedAt ? ` • Last updated ${new Date(rateMyProfessorData.cachedAt).toLocaleString()}` : ''}
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="section-label mb-3">Grade Distribution Across All Classes</div>
            <GradeChart gradeDistribution={mergedDistribution} medianGrade={getMedianKey(mergedDistribution)} />
          </section>

          <section>
            <div className="section-label mb-3">All Classes Taught</div>
            <div className="grid gap-3 md:grid-cols-2">
              {courses.map((course) => (
                <Link key={course.code} to={formatClassRoute(course.code)} className="surface-card block p-4 transition hover:bg-[#EEF2FF]">
                  <div className="mb-1 text-base font-semibold text-[#111827]">{course.code}</div>
                  <div className="text-sm text-[#6B7280]">{course.name}</div>
                </Link>
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

        <div className="space-y-4">
          <div className="surface-card bg-[#F8FAFF] p-4">
            <div className="section-label mb-2">Quick Stats</div>
            <div className="grid gap-3">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="text-caption">Overall Rating</div>
                <div className="mt-1 text-xl font-bold text-[#1B3BFF]">{rating ? rating.toFixed(1) : 'N/A'}</div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="text-caption">Difficulty</div>
                <div className="mt-1 text-xl font-bold text-[#6C2DFF]">{difficulty ? difficulty.toFixed(1) : 'N/A'}</div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="text-caption">Would Take Again</div>
                <div className="mt-1 text-xl font-bold text-[#111827]">{wouldTakeAgain ? `${wouldTakeAgain}%` : 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
