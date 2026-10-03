"use client";

import { ArrowDown, FlaskConical, Trophy } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/spinner";
import { useLeaderboard } from "@/lib/data/hooks";
import { CRITERIA, TOP_N } from "@/lib/leaderboard";
import type { Leaderboard, LeaderboardCriteria, LeaderboardRow } from "@/lib/types";
import { cn, errorMessage, pct } from "@/lib/utils";

const MEDAL: Record<number, string> = {
  1: "bg-[#f5b83d] text-[#3b2a00]",
  2: "bg-[#c5ced9] text-[#1d2738]",
  3: "bg-[#d9925f] text-[#3a1f0c]",
};

export function LeaderboardView() {
  const [criteria, setCriteria] = useState<LeaderboardCriteria>("overall");
  const { data, isPending, error } = useLeaderboard(criteria);
  const me = data?.rows.find((r) => r.isMe) ?? null;
  const description = CRITERIA.find((c) => c.value === criteria)!.description;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-strong">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <div className="flex rounded-md border border-border bg-surface p-0.5" role="radiogroup" aria-label="Rank by">
          {CRITERIA.map((c) => (
            <button
              key={c.value}
              role="radio"
              aria-checked={criteria === c.value}
              onClick={() => setCriteria(c.value)}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                criteria === c.value ? "bg-surface-3 font-medium text-strong" : "text-muted hover:text-strong",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      {data?.sample && (
        <div className="flex gap-2.5 rounded-lg border border-info/30 bg-info/[0.07] px-4 py-3 text-sm leading-relaxed">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-info" />
          <p className="text-muted">
            <span className="font-medium text-strong">Sample leaderboard.</span> These are {data.studentCount - (me ? 1 : 0)} sample
            students, showing how the board might look a few weeks in. Once the database is connected, it ranks your real
            students from their uploads and the attendance you mark.
          </p>
        </div>
      )}

      {error ? (
        <p className="text-sm text-danger">{errorMessage(error)}</p>
      ) : isPending || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-[480px]" />
        </div>
      ) : (
        <>
          {me && <StandingCard me={me} data={data} />}
          <Board data={data} criteria={criteria} />
          {!data.full && data.rows.length > 0 && (
            <p className="text-xs text-faint">
              Showing the top {TOP_N}
              {me && data.rows.indexOf(me) >= TOP_N ? " and your place" : ""} out of {data.studentCount} students.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StandingCard({ me, data }: { me: LeaderboardRow; data: Leaderboard }) {
  return (
    <section className="grid gap-4 rounded-lg border border-accent/30 bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
      <div className="flex items-center gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Trophy className="size-6" />
        </span>
        <div>
          <p className="text-xs text-muted">Your place</p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-strong">#{me.rank}</span>
            <span className="text-sm text-muted">of {data.studentCount}</span>
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4 border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
        <div>
          <dt className="text-xs text-muted">Overall</dt>
          <dd className="mt-1 text-lg font-semibold text-strong">{me.score.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Problems</dt>
          <dd className="mt-1 font-mono text-sm text-strong tabular">
            {me.solved}
            <span className="text-faint">/{data.totalProblems}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Attendance</dt>
          <dd className="mt-1 font-mono text-sm text-strong tabular">
            {me.attended}
            <span className="text-faint">/{data.classesHeld}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function ColumnLabel({ active, children, className }: { active: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1", active ? "font-medium text-accent" : "", className)}>
      {children}
      {active && <ArrowDown className="size-3" aria-label="Sorted by this" />}
    </span>
  );
}

function Board({ data, criteria }: { data: Leaderboard; criteria: LeaderboardCriteria }) {
  if (data.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
        <Trophy className="mx-auto size-6 text-faint" />
        <p className="mt-3 text-sm text-strong">No one on the board yet</p>
        <p className="mt-1 text-sm text-muted">Rankings appear as soon as students start solving problems.</p>
      </div>
    );
  }

  const cols =
    "grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 md:grid-cols-[52px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_84px] md:gap-x-5";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className={cn(cols, "border-b border-border px-4 py-2 text-xs text-faint")}>
        <span>#</span>
        <span>Student</span>
        <ColumnLabel active={criteria === "problems"} className="hidden md:flex">
          Problems
        </ColumnLabel>
        <ColumnLabel active={criteria === "attendance"} className="hidden md:flex">
          Attendance
        </ColumnLabel>
        <ColumnLabel active={criteria === "overall"} className="hidden justify-end md:flex">
          Overall
        </ColumnLabel>
        <span className="text-right md:hidden">{CRITERIA.find((c) => c.value === criteria)!.label}</span>
      </div>
      <ul className="zebra">
        {data.rows.map((row, index) => (
          <li key={row.userId}>
            {!data.full && index === TOP_N && (
              <div className="border-y border-border/60 py-1 text-center text-xs tracking-[0.4em] text-faint" aria-hidden>
                ···
              </div>
            )}
            <div
              className={cn(
                cols,
                "relative px-4 py-2.5",
                row.isMe && "bg-accent/[0.09]",
              )}
            >
              {row.isMe && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" aria-hidden />}
              <RankBadge rank={row.rank} />
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={row.name === "You" ? null : row.name} src={row.avatarUrl} email={row.name} size={28} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className={cn("truncate text-sm", row.isMe ? "font-semibold text-strong" : "text-strong/95")}>{row.name}</span>
                    {row.isMe && row.name !== "You" && (
                      <span className="rounded-full bg-accent/15 px-1.5 text-2xs font-medium text-accent">You</span>
                    )}
                    {data.sample && <span className="font-mono text-[10px] uppercase tracking-wide text-faint">sample</span>}
                  </p>
                  {row.leetcodeUsername && <p className="truncate font-mono text-[11px] text-faint">@{row.leetcodeUsername}</p>}
                </div>
              </div>
              <Metric
                value={row.solved}
                max={data.totalProblems}
                active={criteria === "problems"}
                className="hidden md:flex"
              />
              <Metric
                value={row.attended}
                max={data.classesHeld}
                active={criteria === "attendance"}
                className="hidden md:flex"
              />
              <span
                className={cn(
                  "hidden text-right font-mono text-sm tabular md:block",
                  criteria === "overall" ? "font-semibold text-strong" : "text-muted",
                )}
              >
                {row.score.toFixed(1)}
              </span>
              <span className="text-right font-mono text-sm font-semibold text-strong tabular md:hidden">
                {criteria === "overall"
                  ? row.score.toFixed(1)
                  : criteria === "problems"
                    ? `${row.solved}/${data.totalProblems}`
                    : `${row.attended}/${data.classesHeld}`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (MEDAL[rank]) {
    return (
      <span className={cn("flex size-7 items-center justify-center rounded-full font-mono text-xs font-semibold", MEDAL[rank])}>
        {rank}
      </span>
    );
  }
  return <span className="pl-2 font-mono text-sm text-muted tabular">{rank}</span>;
}

function Metric({ value, max, active, className }: { value: number; max: number; active: boolean; className?: string }) {
  return (
    <div className={cn("items-center gap-3", className)}>
      <span className={cn("w-14 shrink-0 font-mono text-xs tabular", active ? "font-semibold text-strong" : "text-muted")}>
        {value}
        <span className="text-faint">/{max}</span>
      </span>
      <Meter value={value} max={max} size="sm" className="max-w-28" label={`${pct(value, max)}%`} />
    </div>
  );
}
