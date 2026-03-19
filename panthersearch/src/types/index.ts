export type GradeKey =
  | '4.0'
  | '3.5'
  | '3.0'
  | '2.5'
  | '2.0'
  | '1.5'
  | '1.0'
  | '0.0'
  | 'I'
  | 'CR'
  | 'NC';

export type GradeDistribution = Record<GradeKey, number>;

export type SemesterBreakdown = {
  semester: string;
  students: number;
  avgGPA: number;
  gradeDistribution: GradeDistribution;
};

export type ClassRecord = {
  code: string;
  slug: string;
  name: string;
  department: string;
  credits: number;
  description: string;
  totalStudents: number;
  avgGPA: number;
  medianGrade: string;
  semesterCount: number;
  gradeDistribution: GradeDistribution;
  semesterBreakdown: SemesterBreakdown[];
  instructorIds: string[];
  tags: string[];
  viewCount: number;
};

export type Instructor = {
  id: string;
  name: string;
  department: string;
  title: string;
  rating: number;
  difficulty: number;
  wouldTakeAgain: number;
  classIds: string[];
  semestersTaught: string[];
  tags: string[];
  bio: string;
  viewCount: number;
};

export type ReviewSource = 'RateMyProfessors' | 'Reddit' | 'PantherSearch';

export type Review = {
  id: string;
  classCode: string;
  instructorId?: string;
  source: ReviewSource;
  semester: string;
  rating: number;
  difficulty: number;
  gradeReceived: string;
  wouldTakeAgain: boolean;
  comment: string;
  thumbsUp: number;
  date: string;
  tags: string[];
  title?: string;
  url?: string;
  author?: string;
};

export type Section = {
  id: string;
  classCode: string;
  crn: string;
  instructorId?: string;
  instructorName?: string;
  days: string;
  startTime: string;
  endTime: string;
  location: string;
  enrolled: number;
  capacity: number;
  seatsRemaining: number;
  waitlisted: number;
  semester: string;
  isOnline: boolean;
  notes?: string;
};

export type SearchResultItem = {
  id: string;
  type: 'class' | 'instructor';
  title: string;
  subtitle: string;
  metric: string;
  href: string;
};

export type LiveGradeSemester = {
  term: string;
  instructor: string;
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
    W: number;
    WF: number;
  };
  totalStudents: number;
  avgGPA: number;
};

export type LiveGradesResponse = {
  courseCode: string;
  courseName: string;
  semesters: LiveGradeSemester[];
  cachedAt: string;
  source: string;
};

export type LiveSeatsResponse = {
  courseCode: string;
  termCode: string;
  termLabel: string;
  lastUpdated: string;
  sections: Section[];
  source: string;
};

export type RmpReview = {
  id: string;
  comment: string;
  className: string;
  date: string;
  grade: string;
  thumbsUpTotal: number;
  thumbsDownTotal: number;
  ratingTags: string[];
  helpfulRating: number;
  difficultyRating: number;
  attendanceMandatory?: boolean;
};

export type ProfessorApiResponse = {
  query: string;
  found: boolean;
  source: string;
  cachedAt: string;
  professor?: {
    id: string;
    firstName: string;
    lastName: string;
    department: string;
    avgRating: number;
    avgDifficulty: number;
    wouldTakeAgainPercent: number;
    numRatings: number;
    reviews: RmpReview[];
  };
};

export type RedditResult = {
  id: string;
  title: string;
  url: string;
  permalink: string;
  subreddit: string;
  score: number;
  createdUtc: number;
  author: string;
  selftext: string;
  topComment?: string;
};

export type RedditApiResponse = {
  query: string;
  source: string;
  cachedAt: string;
  subreddit: string;
  results: RedditResult[];
};
