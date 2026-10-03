import type { Difficulty, Question, SessionWithQuestions, Submission } from "./types";

export interface Tally {
  done: number;
  total: number;
}

export interface SessionProgress {
  session: SessionWithQuestions;
  done: number;
  total: number;
  complete: boolean;
}

export function doneSet(submissions: Submission[] | undefined) {
  return new Set((submissions ?? []).map((s) => s.questionId));
}

export function sessionProgress(session: SessionWithQuestions, done: Set<string>): SessionProgress {
  const total = session.questions.length;
  const count = session.questions.filter((q) => done.has(q.id)).length;
  return { session, done: count, total, complete: total > 0 && count === total };
}

export function overallProgress(sessions: SessionWithQuestions[], done: Set<string>) {
  const questions: Question[] = sessions.flatMap((s) => s.questions);
  const byDifficulty: Record<Difficulty, Tally> = {
    Easy: { done: 0, total: 0 },
    Medium: { done: 0, total: 0 },
    Hard: { done: 0, total: 0 },
  };
  const byKind = { class: { done: 0, total: 0 }, homework: { done: 0, total: 0 } };
  let solved = 0;
  for (const q of questions) {
    const isDone = done.has(q.id);
    byDifficulty[q.difficulty].total++;
    byKind[q.kind].total++;
    if (isDone) {
      solved++;
      byDifficulty[q.difficulty].done++;
      byKind[q.kind].done++;
    }
  }
  return { solved, total: questions.length, byDifficulty, byKind };
}

/** The first published session that still has something left to do. */
export function nextUp(progress: SessionProgress[]) {
  return progress.find((p) => p.session.status === "published" && p.total > 0 && !p.complete) ?? null;
}
