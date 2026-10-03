export type Role = "student" | "admin";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type QuestionKind = "class" | "homework";
export type SessionStatus = "draft" | "published";

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

/** The signed-in person, as far as the app is concerned. */
export interface Viewer {
  id: string;
  email: string;
  enrolled: boolean;
  role: Role | null;
  fullName: string | null;
  avatarUrl: string | null;
  leetcodeUsername: string | null;
}

export interface Session {
  id: string;
  number: number;
  title: string;
  description: string | null;
  /** YYYY-MM-DD, no time zone */
  classDate: string | null;
  recordingUrl: string | null;
  notesUrl: string | null;
  status: SessionStatus;
  publishedAt: string | null;
  createdAt: string;
}

export interface Question {
  id: string;
  sessionId: string;
  kind: QuestionKind;
  position: number;
  lcNumber: number | null;
  title: string;
  leetcodeUrl: string;
  difficulty: Difficulty;
  hint: string | null;
}

export interface SessionWithQuestions extends Session {
  questions: Question[];
}

export interface Submission {
  id: string;
  userId: string;
  questionId: string;
  screenshotPath: string;
  submittedAt: string;
  updatedAt: string;
}

/** A row on the admin People page: an allowlisted email plus whatever we know once they sign in. */
export interface Person {
  email: string;
  role: Role;
  createdAt: string;
  userId: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  leetcodeUsername: string | null;
  solvedCount: number;
  lastActiveAt: string | null;
}

export interface SessionStat {
  id: string;
  number: number;
  title: string;
  status: SessionStatus;
  classDate: string | null;
  questionCount: number;
  submissionCount: number;
  /** students who finished every question in the session */
  fullyDone: number;
}

export interface RecentSubmission {
  id: string;
  updatedAt: string;
  studentName: string;
  studentEmail: string;
  questionTitle: string;
  lcNumber: number | null;
  sessionNumber: number;
}

export interface AdminOverview {
  enrolled: number;
  signedIn: number;
  admins: number;
  submissionsToday: number;
  totalSubmissions: number;
  sessions: SessionStat[];
  recent: RecentSubmission[];
}

export interface GridStudent {
  userId: string | null;
  email: string;
  fullName: string | null;
  leetcodeUsername: string | null;
}

export interface GridData {
  session: SessionWithQuestions;
  students: GridStudent[];
  submissions: Submission[];
}

export interface SessionInput {
  number: number;
  title: string;
  description: string | null;
  classDate: string | null;
  recordingUrl: string | null;
  notesUrl: string | null;
}

export interface QuestionInput {
  sessionId: string;
  kind: QuestionKind;
  lcNumber: number | null;
  title: string;
  leetcodeUrl: string;
  difficulty: Difficulty;
  hint: string | null;
}

export interface AddPeopleResult {
  added: string[];
  existing: string[];
  invalid: string[];
}

export interface LeetCodeProblem {
  slug: string;
  number: number | null;
  title: string;
  difficulty: Difficulty | null;
  url: string;
  /** false when we fell back to guessing from the slug */
  verified: boolean;
}

export type LeaderboardCriteria = "overall" | "problems" | "attendance";

export interface LeaderboardRow {
  /** Rank under the chosen criteria; equal values share a rank */
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Only filled in for admins */
  leetcodeUsername: string | null;
  solved: number;
  attended: number;
  /** Overall score, 0–100 (70% problems + 30% attendance) */
  score: number;
  isMe: boolean;
}

export interface Leaderboard {
  criteria: LeaderboardCriteria;
  /** Ordered best first. Students get the top 10 plus their own row; admins get everyone. */
  rows: LeaderboardRow[];
  totalProblems: number;
  classesHeld: number;
  studentCount: number;
  full: boolean;
  /** Preview mode: illustrative sample students, not real data */
  sample: boolean;
}

export interface AttendanceRow {
  email: string;
  userId: string | null;
  fullName: string | null;
  /** null = not marked yet */
  present: boolean | null;
}

export interface AttendanceSheet {
  session: Session;
  rows: AttendanceRow[];
}
