import { SAMPLE_STUDENTS, SAMPLE_TOTALS, SAMPLE_YOU } from "../demo/leaderboard-sample";
import { DEMO_USERS, PERSONA_USER, type DemoState } from "../demo/seed";
import { clearBlobs, deleteBlob, getBlob, loadState, putBlob, resetState, saveState } from "../demo/store";
import { isValidEmail, normalizeEmail } from "../emails";
import { rankEntries, visibleRows, type LeaderboardEntry } from "../leaderboard";
import { dayInZone, todayInZone } from "../format";
import type {
  AddPeopleResult,
  AdminOverview,
  AttendanceSheet,
  GridData,
  Leaderboard,
  LeaderboardCriteria,
  Person,
  Question,
  QuestionInput,
  Role,
  Session,
  SessionInput,
  SessionStatus,
  SessionWithQuestions,
  Submission,
  Viewer,
} from "../types";
import { sleep, uid } from "../utils";
import { AccessError, type DataClient, type DemoPersona } from "./client";

const LATENCY = 90;

function byPosition(a: Question, b: Question) {
  if (a.kind !== b.kind) return a.kind === "class" ? -1 : 1;
  return a.position - b.position;
}

/**
 * Preview mode: the whole backend simulated in the browser, so the site works before
 * the database is connected. Mirrors the access rules the database enforces in
 * production (enrolled-only, published-only, admin-only).
 */
export class DemoDataClient implements DataClient {
  readonly mode = "demo" as const;
  private urls = new Map<string, string>();

  private state() {
    return loadState();
  }

  private commit(state: DemoState) {
    saveState(state);
  }

  // ---------- demo controls ----------

  demoPersona() {
    return this.state().persona;
  }

  async setDemoPersona(persona: DemoPersona | null) {
    const s = this.state();
    s.persona = persona;
    this.commit(s);
  }

  async resetDemo() {
    const persona = this.state().persona;
    for (const url of this.urls.values()) if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    this.urls.clear();
    await clearBlobs();
    resetState(persona ?? "student");
    await sleep(250);
  }

  // ---------- identity ----------

  private currentUser(s: DemoState) {
    return s.persona ? DEMO_USERS[PERSONA_USER[s.persona]] : null;
  }

  private allowedEntry(s: DemoState, email: string) {
    const key = normalizeEmail(email);
    return s.allowed.find((a) => normalizeEmail(a.email) === key) ?? null;
  }

  private profileForEmail(s: DemoState, email: string) {
    const key = normalizeEmail(email);
    return s.profiles.find((p) => normalizeEmail(p.email) === key) ?? null;
  }

  private viewerFrom(s: DemoState): Viewer | null {
    const user = this.currentUser(s);
    if (!user) return null;
    const entry = this.allowedEntry(s, user.email);
    const profile = s.profiles.find((p) => p.id === user.id) ?? null;
    return {
      id: user.id,
      email: user.email,
      enrolled: !!entry,
      role: entry?.role ?? null,
      fullName: profile?.fullName ?? user.fullName,
      avatarUrl: null,
      leetcodeUsername: profile?.leetcodeUsername ?? null,
    };
  }

  private requireEnrolled(s: DemoState) {
    const viewer = this.viewerFrom(s);
    if (!viewer) throw new AccessError("Please sign in first.");
    if (!viewer.enrolled) throw new AccessError("This account isn't enrolled.");
    return viewer;
  }

  private requireAdmin(s: DemoState) {
    const viewer = this.requireEnrolled(s);
    if (viewer.role !== "admin") throw new AccessError("Only admins can do that.");
    return viewer;
  }

  async getViewer() {
    await sleep(40);
    const s = this.state();
    const user = this.currentUser(s);
    if (!user) return null;
    // Like the real database: a profile is created the first time an enrolled person signs in.
    if (this.allowedEntry(s, user.email) && !s.profiles.some((p) => p.id === user.id)) {
      s.profiles.push({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        leetcodeUsername: null,
        createdAt: new Date().toISOString(),
      });
      this.commit(s);
    }
    return this.viewerFrom(s);
  }

  async signInWithGoogle() {
    await sleep(350);
    const s = this.state();
    s.persona = s.persona && s.persona !== "outsider" ? s.persona : "student";
    this.commit(s);
  }

  async signOut() {
    await sleep(120);
    const s = this.state();
    s.persona = null;
    this.commit(s);
  }

  async updateProfile({ leetcodeUsername }: { leetcodeUsername: string }) {
    await sleep(LATENCY);
    const s = this.state();
    const viewer = this.requireEnrolled(s);
    const taken = s.profiles.find(
      (p) => p.id !== viewer.id && p.leetcodeUsername?.toLowerCase() === leetcodeUsername.toLowerCase(),
    );
    if (taken) throw new Error("Another student already uses that LeetCode username.");
    const profile = s.profiles.find((p) => p.id === viewer.id);
    if (profile) profile.leetcodeUsername = leetcodeUsername;
    this.commit(s);
  }

  // ---------- sessions & submissions ----------

  private withQuestions(s: DemoState, session: Session): SessionWithQuestions {
    return { ...session, questions: s.questions.filter((q) => q.sessionId === session.id).sort(byPosition) };
  }

  async listSessions() {
    await sleep(LATENCY);
    const s = this.state();
    const viewer = this.viewerFrom(s);
    if (!viewer?.enrolled) return [];
    return s.sessions
      .filter((session) => session.status === "published" || viewer.role === "admin")
      .sort((a, b) => a.number - b.number)
      .map((session) => this.withQuestions(s, session));
  }

  async listMySubmissions() {
    await sleep(LATENCY);
    const s = this.state();
    const viewer = this.viewerFrom(s);
    if (!viewer?.enrolled) return [];
    return s.submissions.filter((sub) => sub.userId === viewer.id);
  }

  async submitScreenshot(questionId: string, image: { blob: Blob; type: string; ext: string }) {
    const s = this.state();
    const viewer = this.requireEnrolled(s);
    const question = s.questions.find((q) => q.id === questionId);
    const session = question && s.sessions.find((x) => x.id === question.sessionId);
    if (!question || !session || session.status !== "published") {
      throw new AccessError("This question isn't open for submissions.");
    }
    const path = `${viewer.id}/${questionId}/${Date.now()}.${image.ext}`;
    await putBlob(path, image.blob);
    await sleep(350);

    const now = new Date().toISOString();
    const existing = s.submissions.find((sub) => sub.userId === viewer.id && sub.questionId === questionId);
    let oldPath: string | null = null;
    let result: Submission;
    if (existing) {
      oldPath = existing.screenshotPath;
      existing.screenshotPath = path;
      existing.updatedAt = now;
      result = { ...existing };
    } else {
      result = { id: uid("sub"), userId: viewer.id, questionId, screenshotPath: path, submittedAt: now, updatedAt: now };
      s.submissions.push(result);
    }
    this.commit(s);
    if (oldPath) await this.forgetFile(oldPath);
    return result;
  }

  async removeSubmission(questionId: string) {
    await sleep(LATENCY);
    const s = this.state();
    const viewer = this.requireEnrolled(s);
    const index = s.submissions.findIndex((sub) => sub.userId === viewer.id && sub.questionId === questionId);
    if (index === -1) return;
    const [removed] = s.submissions.splice(index, 1);
    this.commit(s);
    await this.forgetFile(removed.screenshotPath);
  }

  private async forgetFile(path: string) {
    const url = this.urls.get(path);
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    this.urls.delete(path);
    await deleteBlob(path);
  }

  async getScreenshotUrl(submission: Submission) {
    const s = this.state();
    const viewer = this.requireEnrolled(s);
    if (submission.userId !== viewer.id && viewer.role !== "admin") {
      throw new AccessError("You can only view your own screenshots.");
    }
    const cached = this.urls.get(submission.screenshotPath);
    if (cached) return cached;

    const blob = await getBlob(submission.screenshotPath);
    if (!blob) throw new Error("This screenshot isn't stored in this browser.");
    const url = URL.createObjectURL(blob);
    this.urls.set(submission.screenshotPath, url);
    return url;
  }

  // ---------- admin: overview & people ----------

  private studentIds(s: DemoState) {
    const ids = new Set<string>();
    for (const entry of s.allowed) {
      if (entry.role !== "student") continue;
      const profile = this.profileForEmail(s, entry.email);
      if (profile) ids.add(profile.id);
    }
    return ids;
  }

  async getOverview(): Promise<AdminOverview> {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const students = s.allowed.filter((a) => a.role === "student");
    const studentIds = this.studentIds(s);
    const subs = s.submissions.filter((sub) => studentIds.has(sub.userId));
    const today = todayInZone();

    const sessions = [...s.sessions]
      .sort((a, b) => a.number - b.number)
      .map((session) => {
        const qids = new Set(s.questions.filter((q) => q.sessionId === session.id).map((q) => q.id));
        const sessionSubs = subs.filter((sub) => qids.has(sub.questionId));
        const perUser = new Map<string, number>();
        for (const sub of sessionSubs) perUser.set(sub.userId, (perUser.get(sub.userId) ?? 0) + 1);
        const fullyDone = qids.size ? [...perUser.values()].filter((n) => n === qids.size).length : 0;
        return {
          id: session.id,
          number: session.number,
          title: session.title,
          status: session.status,
          classDate: session.classDate,
          questionCount: qids.size,
          submissionCount: sessionSubs.length,
          fullyDone,
        };
      });

    const recent = [...subs]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8)
      .map((sub) => {
        const profile = s.profiles.find((p) => p.id === sub.userId);
        const question = s.questions.find((q) => q.id === sub.questionId);
        const session = question && s.sessions.find((x) => x.id === question.sessionId);
        return {
          id: sub.id,
          updatedAt: sub.updatedAt,
          studentName: profile?.fullName ?? profile?.email ?? "Unknown",
          studentEmail: profile?.email ?? "",
          questionTitle: question?.title ?? "Deleted question",
          lcNumber: question?.lcNumber ?? null,
          sessionNumber: session?.number ?? 0,
        };
      });

    return {
      enrolled: students.length,
      signedIn: students.filter((a) => this.profileForEmail(s, a.email)).length,
      admins: s.allowed.filter((a) => a.role === "admin").length,
      submissionsToday: subs.filter((sub) => dayInZone(sub.updatedAt) === today).length,
      totalSubmissions: subs.length,
      sessions,
      recent,
    };
  }

  async listPeople(): Promise<Person[]> {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const people = s.allowed.map((entry) => {
      const profile = this.profileForEmail(s, entry.email);
      const subs = profile ? s.submissions.filter((sub) => sub.userId === profile.id) : [];
      const last = subs.reduce<string | null>((max, sub) => (!max || sub.updatedAt > max ? sub.updatedAt : max), null);
      return {
        email: entry.email,
        role: entry.role,
        createdAt: entry.createdAt,
        userId: profile?.id ?? null,
        fullName: profile?.fullName ?? null,
        avatarUrl: null,
        leetcodeUsername: profile?.leetcodeUsername ?? null,
        solvedCount: subs.length,
        lastActiveAt: last,
      } satisfies Person;
    });
    return people.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addPeople(emails: string[], role: Role): Promise<AddPeopleResult> {
    await sleep(LATENCY + 150);
    const s = this.state();
    this.requireAdmin(s);
    const result: AddPeopleResult = { added: [], existing: [], invalid: [] };
    const now = new Date().toISOString();
    for (const raw of emails) {
      const email = raw.trim().toLowerCase();
      if (!isValidEmail(email)) result.invalid.push(email);
      else if (this.allowedEntry(s, email)) result.existing.push(email);
      else {
        s.allowed.push({ email, role, createdAt: now });
        result.added.push(email);
      }
    }
    this.commit(s);
    return result;
  }

  private guardLastAdmin(s: DemoState, email: string) {
    const entry = this.allowedEntry(s, email);
    if (entry?.role === "admin" && s.allowed.filter((a) => a.role === "admin").length <= 1) {
      throw new Error("There must always be at least one admin.");
    }
  }

  async setRole(email: string, role: Role) {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const entry = this.allowedEntry(s, email);
    if (!entry) throw new Error("That email isn't on the list.");
    if (entry.role === role) return;
    if (role === "student") this.guardLastAdmin(s, email);
    entry.role = role;
    this.commit(s);
  }

  async removePerson(email: string) {
    await sleep(LATENCY);
    const s = this.state();
    const viewer = this.requireAdmin(s);
    if (normalizeEmail(email) === normalizeEmail(viewer.email)) throw new Error("You can't remove your own access.");
    this.guardLastAdmin(s, email);
    const key = normalizeEmail(email);
    s.allowed = s.allowed.filter((a) => normalizeEmail(a.email) !== key);
    s.attendance = s.attendance.filter((a) => normalizeEmail(a.email) !== key);
    this.commit(s);
  }

  // ---------- admin: sessions & questions ----------

  private assertUniqueNumber(s: DemoState, number: number, exceptId?: string) {
    if (s.sessions.some((x) => x.number === number && x.id !== exceptId)) {
      throw new Error(`Session S${number} already exists.`);
    }
  }

  async createSession(input: SessionInput) {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    this.assertUniqueNumber(s, input.number);
    const session: Session = {
      id: uid("s"),
      ...input,
      status: "draft",
      publishedAt: null,
      createdAt: new Date().toISOString(),
    };
    s.sessions.push(session);
    this.commit(s);
    return session;
  }

  async updateSession(id: string, input: SessionInput) {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    this.assertUniqueNumber(s, input.number, id);
    const session = s.sessions.find((x) => x.id === id);
    if (!session) throw new Error("Session not found.");
    Object.assign(session, input);
    this.commit(s);
  }

  async setSessionStatus(id: string, status: SessionStatus) {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const session = s.sessions.find((x) => x.id === id);
    if (!session) throw new Error("Session not found.");
    session.status = status;
    if (status === "published") session.publishedAt = new Date().toISOString();
    this.commit(s);
  }

  async deleteSession(id: string) {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const qids = new Set(s.questions.filter((q) => q.sessionId === id).map((q) => q.id));
    const doomed = s.submissions.filter((sub) => qids.has(sub.questionId));
    s.sessions = s.sessions.filter((x) => x.id !== id);
    s.attendance = s.attendance.filter((a) => a.sessionId !== id);
    s.questions = s.questions.filter((q) => !qids.has(q.id));
    s.submissions = s.submissions.filter((sub) => !qids.has(sub.questionId));
    this.commit(s);
    await Promise.all(doomed.map((sub) => this.forgetFile(sub.screenshotPath)));
  }

  private compact(s: DemoState, sessionId: string, kind: Question["kind"]) {
    s.questions
      .filter((q) => q.sessionId === sessionId && q.kind === kind)
      .sort((a, b) => a.position - b.position)
      .forEach((q, i) => (q.position = i + 1));
  }

  private nextPosition(s: DemoState, sessionId: string, kind: Question["kind"]) {
    return s.questions.filter((q) => q.sessionId === sessionId && q.kind === kind).reduce((max, q) => Math.max(max, q.position), 0) + 1;
  }

  async createQuestion(input: QuestionInput) {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    if (!s.sessions.some((x) => x.id === input.sessionId)) throw new Error("Session not found.");
    const question: Question = { id: uid("q"), ...input, position: this.nextPosition(s, input.sessionId, input.kind) };
    s.questions.push(question);
    this.commit(s);
    return question;
  }

  async updateQuestion(id: string, input: QuestionInput) {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const question = s.questions.find((q) => q.id === id);
    if (!question) throw new Error("Question not found.");
    const oldKind = question.kind;
    if (input.kind !== oldKind) question.position = this.nextPosition(s, question.sessionId, input.kind);
    Object.assign(question, { ...input, sessionId: question.sessionId });
    if (input.kind !== oldKind) this.compact(s, question.sessionId, oldKind);
    this.commit(s);
  }

  async deleteQuestion(id: string) {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const question = s.questions.find((q) => q.id === id);
    if (!question) return;
    const doomed = s.submissions.filter((sub) => sub.questionId === id);
    s.questions = s.questions.filter((q) => q.id !== id);
    s.submissions = s.submissions.filter((sub) => sub.questionId !== id);
    this.compact(s, question.sessionId, question.kind);
    this.commit(s);
    await Promise.all(doomed.map((sub) => this.forgetFile(sub.screenshotPath)));
  }

  async moveQuestion(id: string, direction: -1 | 1) {
    await sleep(60);
    const s = this.state();
    this.requireAdmin(s);
    const question = s.questions.find((q) => q.id === id);
    if (!question) return;
    const siblings = s.questions
      .filter((q) => q.sessionId === question.sessionId && q.kind === question.kind)
      .sort((a, b) => a.position - b.position);
    const index = siblings.findIndex((q) => q.id === id);
    const other = siblings[index + direction];
    if (!other) return;
    [question.position, other.position] = [other.position, question.position];
    this.commit(s);
  }

  async countSubmissions(questionIds: string[]) {
    const s = this.state();
    this.requireAdmin(s);
    const ids = new Set(questionIds);
    return s.submissions.filter((sub) => ids.has(sub.questionId)).length;
  }

  // ---------- leaderboard & attendance ----------

  /** Preview mode shows an illustrative board of sample students (see demo/leaderboard-sample.ts). */
  async getLeaderboard(criteria: LeaderboardCriteria): Promise<Leaderboard> {
    await sleep(LATENCY);
    const s = this.state();
    const viewer = this.requireEnrolled(s);
    const full = viewer.role === "admin";
    const entries: LeaderboardEntry[] = SAMPLE_STUDENTS.map(([name, solved, attended], i) => ({
      userId: `sample-${i + 1}`,
      name,
      avatarUrl: null,
      leetcodeUsername: null,
      solved,
      attended,
      isMe: false,
    }));
    if (!full) {
      entries.push({ userId: viewer.id, name: "You", avatarUrl: null, leetcodeUsername: null, ...SAMPLE_YOU, isMe: true });
    }
    const ranked = rankEntries(entries, SAMPLE_TOTALS.totalProblems, SAMPLE_TOTALS.classesHeld, criteria);
    return {
      criteria,
      rows: visibleRows(ranked, full),
      totalProblems: SAMPLE_TOTALS.totalProblems,
      classesHeld: SAMPLE_TOTALS.classesHeld,
      studentCount: entries.length,
      full,
      sample: true,
    };
  }

  async getAttendance(sessionId: string): Promise<AttendanceSheet> {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const session = s.sessions.find((x) => x.id === sessionId);
    if (!session) throw new Error("Session not found.");
    const rows = s.allowed
      .filter((a) => a.role === "student")
      .map((entry) => {
        const profile = this.profileForEmail(s, entry.email);
        const mark = s.attendance.find((a) => a.sessionId === sessionId && a.email === entry.email);
        return {
          email: entry.email,
          userId: profile?.id ?? null,
          fullName: profile?.fullName ?? null,
          present: mark ? mark.present : null,
        };
      })
      .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
    return { session, rows };
  }

  async setAttendance(sessionId: string, emails: string[], present: boolean | null) {
    await sleep(60);
    const s = this.state();
    this.requireAdmin(s);
    const targets = new Set(emails);
    s.attendance = s.attendance.filter((a) => !(a.sessionId === sessionId && targets.has(a.email)));
    if (present !== null) {
      for (const email of targets) s.attendance.push({ sessionId, email, present });
    }
    this.commit(s);
  }

  async getGrid(sessionId: string): Promise<GridData> {
    await sleep(LATENCY);
    const s = this.state();
    this.requireAdmin(s);
    const session = s.sessions.find((x) => x.id === sessionId);
    if (!session) throw new Error("Session not found.");
    const full = this.withQuestions(s, session);
    const students = s.allowed
      .filter((a) => a.role === "student")
      .map((entry) => {
        const profile = this.profileForEmail(s, entry.email);
        return {
          userId: profile?.id ?? null,
          email: entry.email,
          fullName: profile?.fullName ?? null,
          leetcodeUsername: profile?.leetcodeUsername ?? null,
        };
      })
      .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
    const qids = new Set(full.questions.map((q) => q.id));
    const userIds = new Set(students.map((st) => st.userId).filter(Boolean));
    return {
      session: full,
      students,
      submissions: s.submissions.filter((sub) => qids.has(sub.questionId) && userIds.has(sub.userId)),
    };
  }
}
