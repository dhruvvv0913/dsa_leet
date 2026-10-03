import type {
  AddPeopleResult,
  AdminOverview,
  AttendanceSheet,
  GridData,
  Leaderboard,
  LeaderboardCriteria,
  Person,
  QuestionInput,
  Question,
  Role,
  Session,
  SessionInput,
  SessionStatus,
  SessionWithQuestions,
  Submission,
  Viewer,
} from "../types";

/** Preview-mode identities (used until real Google sign-in is connected). */
export type DemoPersona = "student" | "instructor" | "outsider";

/**
 * Everything the UI needs from the backend. There are two implementations:
 * - DemoDataClient: preview mode — everything kept in the visitor's browser (no setup needed)
 * - SupabaseDataClient: the real thing — Postgres + Row Level Security + Storage
 *
 * Access rules live in the backend (RLS for Supabase, explicit checks in the demo);
 * the UI's redirects are only for convenience.
 */
export interface DataClient {
  readonly mode: "demo" | "supabase";

  // Auth
  getViewer(): Promise<Viewer | null>;
  signInWithGoogle(next?: string): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(input: { leetcodeUsername: string }): Promise<void>;

  // Student-facing (admins also see drafts)
  listSessions(): Promise<SessionWithQuestions[]>;
  listMySubmissions(): Promise<Submission[]>;
  submitScreenshot(questionId: string, image: { blob: Blob; type: string; ext: string }): Promise<Submission>;
  removeSubmission(questionId: string): Promise<void>;
  getScreenshotUrl(submission: Submission): Promise<string>;

  // Admin
  getOverview(): Promise<AdminOverview>;
  listPeople(): Promise<Person[]>;
  addPeople(emails: string[], role: Role): Promise<AddPeopleResult>;
  setRole(email: string, role: Role): Promise<void>;
  removePerson(email: string): Promise<void>;

  createSession(input: SessionInput): Promise<Session>;
  updateSession(id: string, input: SessionInput): Promise<void>;
  setSessionStatus(id: string, status: SessionStatus): Promise<void>;
  deleteSession(id: string): Promise<void>;

  createQuestion(input: QuestionInput): Promise<Question>;
  updateQuestion(id: string, input: QuestionInput): Promise<void>;
  deleteQuestion(id: string): Promise<void>;
  moveQuestion(id: string, direction: -1 | 1): Promise<void>;
  countSubmissions(questionIds: string[]): Promise<number>;

  getGrid(sessionId: string): Promise<GridData>;

  // Leaderboard (everyone) and attendance (admins)
  getLeaderboard(criteria: LeaderboardCriteria): Promise<Leaderboard>;
  getAttendance(sessionId: string): Promise<AttendanceSheet>;
  /** present: true/false marks the class; null clears the mark */
  setAttendance(sessionId: string, emails: string[], present: boolean | null): Promise<void>;

  // Preview-mode controls (absent for Supabase)
  demoPersona?(): DemoPersona | null;
  setDemoPersona?(persona: DemoPersona | null): Promise<void>;
  resetDemo?(): Promise<void>;
}

export class AccessError extends Error {
  constructor(message = "You don't have access to do that.") {
    super(message);
  }
}
