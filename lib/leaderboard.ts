import type { LeaderboardCriteria, LeaderboardRow } from "./types";

/**
 * Overall score = 70% problems + 30% attendance, each as a share of what's possible so far
 * (problems in published sessions; classes where attendance was taken).
 * Keep in sync with public.leaderboard() in supabase/migrations/20261003000000_leaderboard.sql.
 */
export const WEIGHTS = { problems: 0.7, attendance: 0.3 } as const;

/** Students see this many places, plus their own. Admins see everyone. */
export const TOP_N = 10;

export const CRITERIA: { value: LeaderboardCriteria; label: string; description: string }[] = [
  {
    value: "overall",
    label: "Overall",
    description: `Ranked by problems solved (${WEIGHTS.problems * 100}%) and classes attended (${WEIGHTS.attendance * 100}%).`,
  },
  { value: "problems", label: "Problems", description: "Ranked by problems solved across all published sessions." },
  { value: "attendance", label: "Attendance", description: "Ranked by classes attended." },
];

function ratio(part: number, whole: number) {
  return whole > 0 ? part / whole : null;
}

/** 0–100, one decimal. If nothing has been held yet on one side, the other side counts fully. */
export function overallScore(solved: number, attended: number, totalProblems: number, classesHeld: number) {
  const p = ratio(solved, totalProblems);
  const a = ratio(attended, classesHeld);
  const value = p === null && a === null ? 0 : a === null ? p! : p === null ? a : WEIGHTS.problems * p + WEIGHTS.attendance * a;
  return Math.round(value * 1000) / 10;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  leetcodeUsername: string | null;
  solved: number;
  attended: number;
  isMe: boolean;
}

/** Orders entries by the chosen criteria. Ties share a rank (1, 2, 2, 4) and break by problems, then attendance. */
export function rankEntries(
  entries: LeaderboardEntry[],
  totalProblems: number,
  classesHeld: number,
  criteria: LeaderboardCriteria,
): LeaderboardRow[] {
  const valued = entries.map((e) => {
    const score = overallScore(e.solved, e.attended, totalProblems, classesHeld);
    const sortValue =
      criteria === "problems"
        ? (ratio(e.solved, totalProblems) ?? 0)
        : criteria === "attendance"
          ? (ratio(e.attended, classesHeld) ?? 0)
          : score;
    return { ...e, score, sortValue };
  });
  valued.sort(
    (a, b) =>
      b.sortValue - a.sortValue || b.solved - a.solved || b.attended - a.attended || a.name.localeCompare(b.name),
  );
  let rank = 0;
  let previous: number | null = null;
  return valued.map((v, i) => {
    if (previous === null || v.sortValue !== previous) {
      rank = i + 1;
      previous = v.sortValue;
    }
    return {
      rank,
      userId: v.userId,
      name: v.name,
      avatarUrl: v.avatarUrl,
      leetcodeUsername: v.leetcodeUsername,
      solved: v.solved,
      attended: v.attended,
      score: v.score,
      isMe: v.isMe,
    };
  });
}

/** Students see the top places plus their own row; admins see everyone. */
export function visibleRows(rows: LeaderboardRow[], full: boolean) {
  return full ? rows : rows.filter((row, index) => index < TOP_N || row.isMe);
}
