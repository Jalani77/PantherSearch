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
