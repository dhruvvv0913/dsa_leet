"use client";

import { ArrowRight, Circle, CircleCheck, Info } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { DifficultyText, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/spinner";
import { useMySubmissions, useSessions, useViewer } from "@/lib/data/hooks";
import { formatShortDay, formatWeekday, greeting } from "@/lib/format";
import { doneSet, nextUp, overallProgress, sessionProgress, type SessionProgress } from "@/lib/progress";
import type { Difficulty } from "@/lib/types";
import { cn, firstName, pct } from "@/lib/utils";

const DOT: Record<Difficulty, string> = { Easy: "bg-easy", Medium: "bg-medium", Hard: "bg-hard" };

export function DashboardView() {
  const { data: viewer } = useViewer();
  const sessions = useSessions();
  const submissions = useMySubmissions();
  const isAdmin = viewer?.role === "admin";

  const model = useMemo(() => {
    if (!sessions.data || !submissions.data) return null;
    const done = doneSet(submissions.data);
    const published = sessions.data.filter((s) => s.status === "published");
    const rows = sessions.data.map((s) => sessionProgress(s, done));
    return {
      rows,
      done,
      overall: overallProgress(published, done),
      next: nextUp(rows),
      publishedCount: published.length,
    };
  }, [sessions.data, submissions.data]);

  if (!viewer || !model) return <DashboardSkeleton />;

  const { overall, next, rows } = model;
  const name = firstName(viewer.fullName);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-xl font-semibold tracking-tight text-strong sm:text-2xl">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {model.publishedCount === 0
            ? "Your sessions will show up here as soon as they're published."
            : isAdmin
              ? "This is the student view. Students only see published sessions; drafts are marked."
              : model.publishedCount === 1
                ? "Session 1 is live. Solve each problem on LeetCode, then upload a screenshot here."
                : `${model.publishedCount} sessions so far. Solve on LeetCode, upload proof here.`}
        </p>
      </header>

      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-info/25 bg-info/[0.06] px-4 py-3 text-sm">
          <Info className="size-4 shrink-0 text-info" />
          <span className="min-w-0 flex-1 text-text">You&apos;re signed in as an admin. Manage sessions, people and submissions from the admin area.</span>
          <ButtonLink href="/admin" size="sm" variant="secondary">
            Open admin
          </ButtonLink>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <ProgressCard overall={overall} />
          <UpNextCard next={next} done={model.done} allDone={overall.total > 0 && overall.solved === overall.total} />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-strong">
            Sessions <span className="ml-1 font-mono text-xs font-normal text-faint">{rows.length}</span>
          </h2>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-strong">Nothing published yet</p>
            <p className="mt-1 text-sm text-muted">Session 1 will appear here once your instructor publishes it.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="hidden grid-cols-[56px_minmax(0,1fr)_120px_200px_28px] gap-x-4 border-b border-border px-4 py-2 text-xs text-faint md:grid">
              <span>#</span>
              <span>Session</span>
              <span>Class</span>
              <span>Progress</span>
              <span aria-hidden />
            </div>
            <ul className="zebra">
              {rows.map((row) => (
                <SessionRow key={row.session.id} row={row} highlight={next?.session.id === row.session.id && !isAdmin} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function ProgressCard({ overall }: { overall: ReturnType<typeof overallProgress> }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Problems solved</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-tight text-strong">{overall.solved}</span>
            <span className="text-base text-muted">/ {overall.total}</span>
          </p>
        </div>
        <span className="mt-1 rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-text">{pct(overall.solved, overall.total)}%</span>
      </div>
      <Meter value={overall.solved} max={overall.total} size="lg" className="mt-4" label="Overall progress" />
      <div className="mt-5 flex flex-wrap gap-x-12 gap-y-3 border-t border-border pt-4">
        {(["Easy", "Medium", "Hard"] as const).filter((d) => overall.byDifficulty[d].total > 0).map((d) => (
          <div key={d}>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span className={cn("size-2 rounded-full", DOT[d])} aria-hidden />
              {d}
            </p>
            <p className="mt-1 font-mono text-sm text-strong tabular">
              {overall.byDifficulty[d].done}
              <span className="text-faint">/{overall.byDifficulty[d].total}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        Classwork <span className="font-mono text-text">{overall.byKind.class.done}/{overall.byKind.class.total}</span>
        <span className="mx-2 text-faint">·</span>
        Homework <span className="font-mono text-text">{overall.byKind.homework.done}/{overall.byKind.homework.total}</span>
      </p>
    </div>
  );
}

function UpNextCard({ next, done, allDone }: { next: SessionProgress | null; done: Set<string>; allDone: boolean }) {
  if (!next) {
    return (
      <div className="flex flex-col justify-center rounded-lg border border-border bg-surface p-5">
        <CircleCheck className="size-6 text-success" />
        <p className="mt-3 text-base font-medium text-strong">{allDone ? "All caught up" : "Nothing to do yet"}</p>
        <p className="mt-1 text-sm text-muted">
          {allDone ? "Every published problem is done. New sessions appear here when they're published." : "Problems appear here once a session is published."}
        </p>
      </div>
    );
  }
  const left = next.total - next.done;
  const remaining = next.session.questions.filter((q) => !done.has(q.id)).slice(0, 3);
  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-accent/30 bg-surface p-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-brand-gradient-v" aria-hidden />
      <p className="font-mono text-2xs uppercase tracking-wider text-accent">Up next</p>
      <p className="mt-2 text-base font-semibold leading-snug text-strong">
        <span className="mr-1.5 font-mono text-muted">S{next.session.number}</span>
        {next.session.title}
      </p>
      <p className="mt-1 text-sm text-muted">
        {left} problem{left === 1 ? "" : "s"} left · class on {formatWeekday(next.session.classDate)}
      </p>
      <ul className="mt-4 space-y-2">
        {remaining.map((q) => (
          <li key={q.id} className="flex min-w-0 items-center gap-2.5 text-sm">
            <Circle className="size-3.5 shrink-0 text-faint" aria-hidden />
            <span className="w-9 shrink-0 font-mono text-xs text-muted">{q.lcNumber}</span>
            <span className="min-w-0 truncate text-text">{q.title}</span>
            <DifficultyText difficulty={q.difficulty} className="ml-auto shrink-0 text-xs" />
          </li>
        ))}
        {left > remaining.length && <li className="pl-6 text-xs text-faint">+{left - remaining.length} more</li>}
      </ul>
      <div className="mt-auto pt-5">
        <div className="mb-4 flex items-center gap-3">
          <Meter value={next.done} max={next.total} />
          <span className="shrink-0 font-mono text-xs text-muted tabular">
            {next.done}/{next.total}
          </span>
        </div>
        <ButtonLink href={`/s/${next.session.number}`} variant="primary" className="w-full sm:w-auto">
          {next.done === 0 ? `Start S${next.session.number}` : "Continue"} <ArrowRight className="size-4" />
        </ButtonLink>
      </div>
    </div>
  );
}

function SessionRow({ row, highlight }: { row: SessionProgress; highlight: boolean }) {
  const { session, done, total, complete } = row;
  return (
    <li>
      <Link
        href={`/s/${session.number}`}
        className={cn(
          "grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-surface-2/80 md:grid-cols-[56px_minmax(0,1fr)_120px_200px_28px] md:gap-x-4",
          highlight && "bg-accent/[0.04]",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-10 items-center justify-center rounded-md border font-mono text-xs",
            highlight ? "border-accent/50 text-accent" : "border-border text-muted",
          )}
        >
          S{session.number}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm text-strong">{session.title}</span>
            {session.status === "draft" && <StatusBadge status="draft" />}
          </span>
          <span className="mt-0.5 block text-xs text-faint md:hidden">
            {formatShortDay(session.classDate)} · {done}/{total} done
          </span>
        </span>
        <span className="hidden text-sm text-muted md:block">{formatWeekday(session.classDate)}</span>
        <span className="hidden items-center gap-3 md:flex">
          <Meter value={done} max={total} size="sm" />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-muted tabular">
            {done}/{total}
          </span>
        </span>
        <span className="flex justify-end">
          {complete ? (
            <CircleCheck className="size-[18px] text-success" aria-label="Complete" />
          ) : (
            <ArrowRight className="size-4 text-faint" aria-hidden />
          )}
        </span>
      </Link>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
