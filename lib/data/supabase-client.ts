import type { PostgrestError } from "@supabase/supabase-js";
import { isValidEmail, normalizeEmail } from "../emails";
import { getSupabaseBrowser } from "../supabase/browser";
import type {
  AddPeopleResult,
  AdminOverview,
  AttendanceSheet,
  Difficulty,
  GridData,
  Leaderboard,
  LeaderboardCriteria,
  LeaderboardRow,
  Person,
  Question,
  QuestionInput,
  QuestionKind,
  Role,
  Session,
  SessionInput,
  SessionStatus,
  SessionWithQuestions,
  Submission,
  Viewer,
} from "../types";
import { AccessError, type DataClient } from "./client";

const BUCKET = "screenshots";
const SIGNED_URL_SECONDS = 600;

// ---------- row shapes (snake_case, as stored) ----------

interface SessionRow {
  id: string;
  number: number;
  title: string;
  description: string | null;
  class_date: string | null;
  recording_url: string | null;
  notes_url: string | null;
  status: SessionStatus;
  published_at: string | null;
  created_at: string;
  questions?: QuestionRow[];
}

interface QuestionRow {
  id: string;
  session_id: string;
  kind: QuestionKind;
  position: number;
  lc_number: number | null;
  title: string;
  leetcode_url: string;
  difficulty: Difficulty;
  hint: string | null;
}

interface SubmissionRow {
  id: string;
  user_id: string;
  question_id: string;
  screenshot_path: string;
  submitted_at: string;
  updated_at: string;
}

interface PersonRow {
  email: string;
  role: Role;
  created_at: string;
  user_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  leetcode_username: string | null;
  solved_count: number;
  last_active_at: string | null;
}

const toQuestion = (r: QuestionRow): Question => ({
  id: r.id,
  sessionId: r.session_id,
  kind: r.kind,
  position: r.position,
  lcNumber: r.lc_number,
  title: r.title,
  leetcodeUrl: r.leetcode_url,
  difficulty: r.difficulty,
  hint: r.hint,
});

const sortQuestions = (qs: Question[]) =>
  qs.sort((a, b) => (a.kind === b.kind ? a.position - b.position : a.kind === "class" ? -1 : 1));

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  number: r.number,
  title: r.title,
  description: r.description,
  classDate: r.class_date,
  recordingUrl: r.recording_url,
  notesUrl: r.notes_url,
  status: r.status,
  publishedAt: r.published_at,
  createdAt: r.created_at,
});

const toSessionWithQuestions = (r: SessionRow): SessionWithQuestions => ({
  ...toSession(r),
  questions: sortQuestions((r.questions ?? []).map(toQuestion)),
});

const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  userId: r.user_id,
  questionId: r.question_id,
  screenshotPath: r.screenshot_path,
  submittedAt: r.submitted_at,
  updatedAt: r.updated_at,
});

const toPerson = (r: PersonRow): Person => ({
  email: r.email,
  role: r.role,
  createdAt: r.created_at,
  userId: r.user_id,
  fullName: r.full_name,
  avatarUrl: r.avatar_url,
  leetcodeUsername: r.leetcode_username,
  solvedCount: Number(r.solved_count ?? 0),
  lastActiveAt: r.last_active_at,
});

const sessionRow = (input: SessionInput) => ({
  number: input.number,
  title: input.title,
  description: input.description,
  class_date: input.classDate,
  recording_url: input.recordingUrl,
  notes_url: input.notesUrl,
});

const questionRow = (input: QuestionInput) => ({
  session_id: input.sessionId,
  kind: input.kind,
  lc_number: input.lcNumber,
  title: input.title,
  leetcode_url: input.leetcodeUrl,
  difficulty: input.difficulty,
  hint: input.hint,
});

function friendly(error: PostgrestError | { message: string; code?: string }): Error {
  const code = "code" in error ? error.code : undefined;
  if (code === "42501") return new AccessError();
  if (code === "23505") {
    if (/number/.test(error.message)) return new Error("A session with that number already exists.");
    if (/leetcode/.test(error.message)) return new Error("Another student already uses that LeetCode username.");
    return new Error("That already exists.");
  }
  if (/last admin/i.test(error.message)) return new Error("There must always be at least one admin.");
  if (/row-level security/i.test(error.message)) return new AccessError();
  return new Error(error.message);
}

async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
) {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw friendly(error);
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The production backend: Supabase Postgres (with RLS) + Storage, called from the browser. */
export class SupabaseDataClient implements DataClient {
  readonly mode = "supabase" as const;
  private signed = new Map<string, { url: string; expires: number }>();

  // Created on first use so pages pre-rendered on the server never touch it.
  private get sb() {
    return getSupabaseBrowser();
  }

  private async userId() {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AccessError("Please sign in first.");
    return id;
  }

  // ---------- auth ----------

  async getViewer(): Promise<Viewer | null> {
    const { data: auth } = await this.sb.auth.getSession();
    if (!auth.session) return null;
    // get_viewer() also creates the profile row the first time an enrolled person signs in.
    const { data, error } = await this.sb.rpc("get_viewer");
    if (error) throw friendly(error);
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      enrolled: !!data.enrolled,
      role: data.role ?? null,
      fullName: data.full_name ?? null,
      avatarUrl: data.avatar_url ?? null,
      leetcodeUsername: data.leetcode_username ?? null,
    };
  }

  async signInWithGoogle(next?: string) {
    const target = next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "";
    const { error } = await this.sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${target}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw friendly(error);
  }

  async signOut() {
    await this.sb.auth.signOut();
    this.signed.clear();
  }

  async updateProfile({ leetcodeUsername }: { leetcodeUsername: string }) {
    const id = await this.userId();
    const { error } = await this.sb.from("profiles").update({ leetcode_username: leetcodeUsername }).eq("id", id);
    if (error) throw friendly(error);
  }

  // ---------- sessions & submissions ----------

  async listSessions() {
    const { data, error } = await this.sb.from("sessions").select("*, questions(*)").order("number");
    if (error) throw friendly(error);
    return (data as SessionRow[]).map(toSessionWithQuestions);
  }

  async listMySubmissions() {
    const id = await this.userId();
    const rows = await fetchAll<SubmissionRow>((from, to) =>
      this.sb.from("submissions").select("*").eq("user_id", id).range(from, to),
    );
    return rows.map(toSubmission);
  }

  async submitScreenshot(questionId: string, image: { blob: Blob; type: string; ext: string }) {
    const userId = await this.userId();
    // A fresh path per upload: no stale CDN copies, and the old file stays valid until the row moves.
    const path = `${userId}/${questionId}/${Date.now()}.${image.ext}`;
    const upload = await this.sb.storage.from(BUCKET).upload(path, image.blob, { contentType: image.type, upsert: false });
    if (upload.error) throw friendly(upload.error);

    const { data: previous } = await this.sb
      .from("submissions")
      .select("screenshot_path")
      .eq("user_id", userId)
      .eq("question_id", questionId)
      .maybeSingle();

    const { data, error } = await this.sb
      .from("submissions")
      .upsert({ user_id: userId, question_id: questionId, screenshot_path: path }, { onConflict: "user_id,question_id" })
      .select()
      .single();
    if (error) {
      await this.sb.storage.from(BUCKET).remove([path]);
      throw friendly(error);
    }
    const oldPath = (previous as { screenshot_path: string } | null)?.screenshot_path;
    if (oldPath && oldPath !== path) {
      this.signed.delete(oldPath);
      await this.sb.storage.from(BUCKET).remove([oldPath]);
    }
    return toSubmission(data as SubmissionRow);
  }

  async removeSubmission(questionId: string) {
    const userId = await this.userId();
    const { data, error } = await this.sb
      .from("submissions")
      .delete()
      .eq("user_id", userId)
      .eq("question_id", questionId)
      .select("screenshot_path");
    if (error) throw friendly(error);
    const paths = (data as { screenshot_path: string }[]).map((r) => r.screenshot_path);
    if (paths.length) await this.sb.storage.from(BUCKET).remove(paths);
  }

  async getScreenshotUrl(submission: Submission) {
    const cached = this.signed.get(submission.screenshotPath);
    if (cached && cached.expires > Date.now()) return cached.url;
    const { data, error } = await this.sb.storage
      .from(BUCKET)
      .createSignedUrl(submission.screenshotPath, SIGNED_URL_SECONDS);
    if (error || !data) throw friendly(error ?? { message: "Couldn't load the screenshot." });
    this.signed.set(submission.screenshotPath, {
      url: data.signedUrl,
      expires: Date.now() + (SIGNED_URL_SECONDS - 60) * 1000,
    });
    return data.signedUrl;
  }

  // ---------- admin ----------

  async getOverview(): Promise<AdminOverview> {
    const { data, error } = await this.sb.rpc("admin_overview");
    if (error) throw friendly(error);
    if (!data) throw new AccessError();
    return {
      enrolled: data.enrolled,
      signedIn: data.signed_in,
      admins: data.admins,
      submissionsToday: data.submissions_today,
      totalSubmissions: data.total_submissions,
      sessions: (data.sessions ?? []).map((s: Record<string, unknown>) => ({
        id: s.id,
        number: s.number,
        title: s.title,
        status: s.status,
        classDate: s.class_date,
        questionCount: Number(s.question_count),
        submissionCount: Number(s.submission_count),
        fullyDone: Number(s.fully_done),
      })),
      recent: (data.recent ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        updatedAt: r.updated_at,
        studentName: r.full_name ?? r.email,
        studentEmail: r.email,
        questionTitle: r.title,
        lcNumber: r.lc_number,
        sessionNumber: r.session_number,
      })),
    } as AdminOverview;
  }

  async listPeople() {
    const { data, error } = await this.sb.rpc("admin_people");
    if (error) throw friendly(error);
    return (data as PersonRow[]).map(toPerson);
  }

  async addPeople(emails: string[], role: Role): Promise<AddPeopleResult> {
    const { data: auth } = await this.sb.auth.getSession();
    const { data: current, error: listError } = await this.sb.from("allowed_emails").select("email");
    if (listError) throw friendly(listError);
    const keys = new Set((current as { email: string }[]).map((r) => normalizeEmail(r.email)));
    const result: AddPeopleResult = { added: [], existing: [], invalid: [] };
    const rows: { email: string; role: Role; added_by: string | null }[] = [];
    for (const raw of emails) {
      const email = raw.trim().toLowerCase();
      if (!isValidEmail(email)) result.invalid.push(email);
      else if (keys.has(normalizeEmail(email))) result.existing.push(email);
      else {
        keys.add(normalizeEmail(email));
        rows.push({ email, role, added_by: auth.session?.user.id ?? null });
        result.added.push(email);
      }
    }
    if (rows.length) {
      const { error } = await this.sb.from("allowed_emails").insert(rows);
      if (error) throw friendly(error);
    }
    return result;
  }

  async setRole(email: string, role: Role) {
    const { error } = await this.sb.from("allowed_emails").update({ role }).eq("email", email);
    if (error) throw friendly(error);
  }

  async removePerson(email: string) {
    const { data: auth } = await this.sb.auth.getSession();
    const mine = auth.session?.user.email;
    if (mine && normalizeEmail(mine) === normalizeEmail(email)) throw new Error("You can't remove your own access.");
    const { error } = await this.sb.from("allowed_emails").delete().eq("email", email);
    if (error) throw friendly(error);
  }

  async createSession(input: SessionInput) {
    const { data, error } = await this.sb.from("sessions").insert(sessionRow(input)).select().single();
    if (error) throw friendly(error);
    return toSession(data as SessionRow);
  }

  async updateSession(id: string, input: SessionInput) {
    const { error } = await this.sb.from("sessions").update(sessionRow(input)).eq("id", id);
    if (error) throw friendly(error);
  }

  async setSessionStatus(id: string, status: SessionStatus) {
    const { error } = await this.sb.from("sessions").update({ status }).eq("id", id);
    if (error) throw friendly(error);
  }

  private async removeFilesFor(questionIds: string[]) {
    if (!questionIds.length) return;
    const rows = await fetchAll<{ screenshot_path: string }>((from, to) =>
      this.sb.from("submissions").select("screenshot_path").in("question_id", questionIds).range(from, to),
    );
    for (const part of chunk(rows.map((r) => r.screenshot_path), 100)) {
      await this.sb.storage.from(BUCKET).remove(part);
    }
  }

  async deleteSession(id: string) {
    const { data: qs, error: qError } = await this.sb.from("questions").select("id").eq("session_id", id);
    if (qError) throw friendly(qError);
    await this.removeFilesFor((qs as { id: string }[]).map((q) => q.id));
    const { error } = await this.sb.from("sessions").delete().eq("id", id);
    if (error) throw friendly(error);
  }

  private async nextPosition(sessionId: string, kind: QuestionKind) {
    const { data, error } = await this.sb
      .from("questions")
      .select("position")
      .eq("session_id", sessionId)
      .eq("kind", kind)
      .order("position", { ascending: false })
      .limit(1);
    if (error) throw friendly(error);
    return ((data as { position: number }[])[0]?.position ?? 0) + 1;
  }

  async createQuestion(input: QuestionInput) {
    const position = await this.nextPosition(input.sessionId, input.kind);
    const { data, error } = await this.sb
      .from("questions")
      .insert({ ...questionRow(input), position })
      .select()
      .single();
    if (error) throw friendly(error);
    return toQuestion(data as QuestionRow);
  }

  async updateQuestion(id: string, input: QuestionInput) {
    const { data: current, error: readError } = await this.sb.from("questions").select("kind").eq("id", id).single();
    if (readError) throw friendly(readError);
    const patch: Record<string, unknown> = questionRow(input);
    delete patch.session_id;
    if ((current as { kind: QuestionKind }).kind !== input.kind) {
      patch.position = await this.nextPosition(input.sessionId, input.kind);
    }
    const { error } = await this.sb.from("questions").update(patch).eq("id", id);
    if (error) throw friendly(error);
  }

  async deleteQuestion(id: string) {
    await this.removeFilesFor([id]);
    const { error } = await this.sb.from("questions").delete().eq("id", id);
    if (error) throw friendly(error);
  }

  async moveQuestion(id: string, direction: -1 | 1) {
    const { data: me, error } = await this.sb.from("questions").select("*").eq("id", id).single();
    if (error) throw friendly(error);
    const question = me as QuestionRow;
    const { data: siblings, error: sibError } = await this.sb
      .from("questions")
      .select("id, position")
      .eq("session_id", question.session_id)
      .eq("kind", question.kind)
      .order("position");
    if (sibError) throw friendly(sibError);
    const list = siblings as { id: string; position: number }[];
    const index = list.findIndex((q) => q.id === id);
    const other = list[index + direction];
    if (!other) return;
    const a = await this.sb.from("questions").update({ position: other.position }).eq("id", id);
    if (a.error) throw friendly(a.error);
    const b = await this.sb.from("questions").update({ position: question.position }).eq("id", other.id);
    if (b.error) throw friendly(b.error);
  }

  async countSubmissions(questionIds: string[]) {
    if (!questionIds.length) return 0;
    const { count, error } = await this.sb
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("question_id", questionIds);
    if (error) throw friendly(error);
    return count ?? 0;
  }

  // ---------- leaderboard & attendance ----------

  async getLeaderboard(criteria: LeaderboardCriteria): Promise<Leaderboard> {
    // Ranked in the database: students only receive the top 10 and their own row.
    const { data, error } = await this.sb.rpc("leaderboard", { criteria });
    if (error) throw friendly(error);
    if (!data) throw new AccessError();
    return {
      criteria,
      totalProblems: Number(data.total_problems),
      classesHeld: Number(data.classes_held),
      studentCount: Number(data.student_count),
      full: !!data.full,
      sample: false,
      rows: (data.rows ?? []).map(
        (r: Record<string, unknown>): LeaderboardRow => ({
          rank: Number(r.rank),
          userId: String(r.user_id),
          name: String(r.name),
          avatarUrl: (r.avatar_url as string | null) ?? null,
          leetcodeUsername: (r.leetcode_username as string | null) ?? null,
          solved: Number(r.solved),
          attended: Number(r.attended),
          score: Number(r.score),
          isMe: !!r.is_me,
        }),
      ),
    };
  }

  async getAttendance(sessionId: string): Promise<AttendanceSheet> {
    const [sessionRes, people, marksRes] = await Promise.all([
      this.sb.from("sessions").select("*").eq("id", sessionId).single(),
      this.listPeople(),
      this.sb.from("attendance").select("email, present").eq("session_id", sessionId),
    ]);
    if (sessionRes.error) throw friendly(sessionRes.error);
    if (marksRes.error) throw friendly(marksRes.error);
    const marks = new Map((marksRes.data as { email: string; present: boolean }[]).map((m) => [m.email, m.present]));
    const rows = people
      .filter((p) => p.role === "student")
      .map((p) => ({ email: p.email, userId: p.userId, fullName: p.fullName, present: marks.get(p.email) ?? null }))
      .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
    return { session: toSession(sessionRes.data as SessionRow), rows };
  }

  async setAttendance(sessionId: string, emails: string[], present: boolean | null) {
    if (!emails.length) return;
    if (present === null) {
      const { error } = await this.sb.from("attendance").delete().eq("session_id", sessionId).in("email", emails);
      if (error) throw friendly(error);
      return;
    }
    const markedBy = (await this.sb.auth.getSession()).data.session?.user.id ?? null;
    const { error } = await this.sb
      .from("attendance")
      .upsert(
        emails.map((email) => ({ session_id: sessionId, email, present, marked_by: markedBy, marked_at: new Date().toISOString() })),
        { onConflict: "session_id,email" },
      );
    if (error) throw friendly(error);
  }

  async getGrid(sessionId: string): Promise<GridData> {
    const { data, error } = await this.sb.from("sessions").select("*, questions(*)").eq("id", sessionId).single();
    if (error) throw friendly(error);
    const session = toSessionWithQuestions(data as SessionRow);
    const people = await this.listPeople();
    const students = people
      .filter((p) => p.role === "student")
      .map((p) => ({ userId: p.userId, email: p.email, fullName: p.fullName, leetcodeUsername: p.leetcodeUsername }))
      .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
    const qids = session.questions.map((q) => q.id);
    const rows = qids.length
      ? await fetchAll<SubmissionRow>((from, to) =>
          this.sb.from("submissions").select("*").in("question_id", qids).range(from, to),
        )
      : [];
    const userIds = new Set(students.map((s) => s.userId));
    return { session, students, submissions: rows.map(toSubmission).filter((s) => userIds.has(s.userId)) };
  }
}
