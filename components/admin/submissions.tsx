"use client";

import { Check, ChevronLeft, ChevronRight, Download, ExternalLink, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-shell";
import { ScreenshotImage } from "@/components/screenshot-dialog";
import { Avatar } from "@/components/ui/avatar";
import { DifficultyText, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/spinner";
import { useGrid, useSessions } from "@/lib/data/hooks";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import type { GridData, GridStudent, Question, Submission } from "@/lib/types";
import { cn, pct } from "@/lib/utils";

const DIFF_DOT = { Easy: "bg-easy", Medium: "bg-medium", Hard: "bg-hard" } as const;

export function SubmissionsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: sessions, isPending: sessionsPending } = useSessions();

  const defaultId = useMemo(() => {
    const published = (sessions ?? []).filter((s) => s.status === "published");
    return (published[published.length - 1] ?? sessions?.[0])?.id ?? null;
  }, [sessions]);
  const sessionId = params.get("session") ?? defaultId;
  const grid = useGrid(sessionId);

  const [query, setQuery] = useState("");
  const [hideFinished, setHideFinished] = useState(false);
  const [open, setOpen] = useState<{ userId: string; questionId: string } | null>(null);

  const selectSession = (id: string) => {
    setOpen(null);
    router.replace(`/admin/submissions?session=${id}`);
  };

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Submissions"
        description="Who has done what. Click a ✓ to see the screenshot."
        actions={
          <Button icon={<Download className="size-4" />} disabled={!grid.data} onClick={() => grid.data && exportCsv(grid.data)}>
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Select
          value={sessionId ?? ""}
          onChange={(e) => selectSession(e.target.value)}
          disabled={sessionsPending || !sessions?.length}
          className="lg:w-96"
          aria-label="Session"
        >
          {(sessions ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              S{s.number} · {s.title}
              {s.status === "draft" ? " (draft)" : ""}
            </option>
          ))}
        </Select>
        <div className="relative lg:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter students" className="pl-8" aria-label="Filter students" />
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted lg:ml-2">
          <input
            type="checkbox"
            checked={hideFinished}
            onChange={(e) => setHideFinished(e.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          Only show students with work left
        </label>
      </div>

      {sessionsPending || (sessionId && grid.isPending) ? (
        <Skeleton className="h-[480px]" />
      ) : !sessionId ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted">No sessions yet.</p>
      ) : grid.error ? (
        <p className="text-sm text-danger">{grid.error.message}</p>
      ) : grid.data ? (
        <Grid data={grid.data} query={query} hideFinished={hideFinished} open={open} setOpen={setOpen} />
      ) : null}
    </div>
  );
}

function Grid({
  data,
  query,
  hideFinished,
  open,
  setOpen,
}: {
  data: GridData;
  query: string;
  hideFinished: boolean;
  open: { userId: string; questionId: string } | null;
  setOpen: (cell: { userId: string; questionId: string } | null) => void;
}) {
  const { session, students } = data;
  const questions = session.questions;
  const classCount = questions.filter((q) => q.kind === "class").length;

  const byCell = useMemo(() => {
    const map = new Map<string, Submission>();
    for (const s of data.submissions) map.set(`${s.userId}:${s.questionId}`, s);
    return map;
  }, [data.submissions]);

  const doneCount = (student: GridStudent) =>
    student.userId ? questions.filter((q) => byCell.has(`${student.userId}:${q.id}`)).length : 0;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !(s.fullName?.toLowerCase().includes(q) || s.email.includes(q) || s.leetcodeUsername?.toLowerCase().includes(q))) return false;
      if (hideFinished && s.userId && questions.length > 0 && doneCount(s) === questions.length) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, query, hideFinished, byCell, questions]);

  // Every ✓ in reading order, for prev/next in the side panel.
  const cells = useMemo(() => {
    const list: { userId: string; questionId: string }[] = [];
    for (const s of rows) {
      if (!s.userId) continue;
      for (const q of questions) if (byCell.has(`${s.userId}:${q.id}`)) list.push({ userId: s.userId, questionId: q.id });
    }
    return list;
  }, [rows, questions, byCell]);

  const signedIn = students.filter((s) => s.userId);
  const total = signedIn.length * questions.length;
  const done = data.submissions.length;
  const started = signedIn.filter((s) => doneCount(s) > 0).length;
  const finished = signedIn.filter((s) => questions.length > 0 && doneCount(s) === questions.length).length;

  if (questions.length === 0) {
    return <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted">This session has no problems yet.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <StatusBadge status={session.status} />
        </span>
        <span className="text-muted">
          <span className="font-mono text-strong">{started}</span>/{signedIn.length} started
        </span>
        <span className="text-muted">
          <span className="font-mono text-strong">{finished}</span> finished everything
        </span>
        <span className="flex min-w-48 flex-1 items-center gap-3">
          <Meter value={done} max={total} size="sm" />
          <span className="shrink-0 font-mono text-xs text-muted">{pct(done, total)}%</span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-2xs uppercase tracking-wider text-faint">
              <th className="sticky left-0 z-10 bg-surface px-4 pt-2.5 text-left font-normal" />
              {classCount > 0 && (
                <th colSpan={classCount} className="border-l border-border px-2 pt-2.5 text-left font-normal">
                  Classwork
                </th>
              )}
              {questions.length - classCount > 0 && (
                <th colSpan={questions.length - classCount} className="border-l border-border px-2 pt-2.5 text-left font-normal">
                  Homework
                </th>
              )}
              <th className="border-l border-border px-3 pt-2.5 font-normal" />
            </tr>
            <tr>
              <th className="sticky left-0 z-10 min-w-56 border-b border-border bg-surface px-4 pb-2.5 pt-1 text-left text-xs font-normal text-faint">
                Student
              </th>
              {questions.map((q, i) => (
                <th
                  key={q.id}
                  title={`${q.lcNumber ? `#${q.lcNumber} ` : ""}${q.title} · ${q.difficulty}`}
                  className={cn("border-b border-border px-0.5 pb-2.5 pt-1 font-normal", i === classCount && "border-l")}
                >
                  <span className="flex w-11 flex-col items-center gap-1">
                    <span className={cn("size-1.5 rounded-full", DIFF_DOT[q.difficulty])} aria-hidden />
                    <span className="font-mono text-[10px] text-muted">{q.lcNumber ?? `Q${q.position}`}</span>
                  </span>
                </th>
              ))}
              <th className="border-b border-l border-border px-3 pb-2.5 pt-1 text-right text-xs font-normal text-faint">Done</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => {
              const count = doneCount(student);
              return (
                <tr key={student.email} className="group">
                  <td className="sticky left-0 z-10 border-b border-border/60 bg-surface px-4 py-1.5 group-hover:bg-surface-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={student.fullName} email={student.email} size={24} className={cn(!student.userId && "opacity-40")} />
                      <div className="min-w-0 max-w-48">
                        <p className={cn("truncate text-sm", student.userId ? "text-strong" : "text-faint")}>
                          {student.fullName ?? student.email}
                        </p>
                        <p className="truncate font-mono text-[10px] text-faint">
                          {student.userId ? (student.leetcodeUsername ? `@${student.leetcodeUsername}` : student.email) : "not signed in"}
                        </p>
                      </div>
                    </div>
                  </td>
                  {questions.map((q, i) => {
                    const sub = student.userId ? byCell.get(`${student.userId}:${q.id}`) : undefined;
                    const isOpen = open?.userId === student.userId && open?.questionId === q.id;
                    return (
                      <td key={q.id} className={cn("border-b border-border/60 px-0.5 py-1 text-center group-hover:bg-surface-2/60", i === classCount && "border-l border-l-border")}>
                        {sub ? (
                          <button
                            onClick={() => setOpen({ userId: student.userId!, questionId: q.id })}
                            title={`${student.fullName ?? student.email} · ${q.title} · ${formatDateTime(sub.updatedAt)}`}
                            aria-label={`View ${student.fullName ?? student.email}'s screenshot for ${q.title}`}
                            className={cn(
                              "mx-auto flex size-7 items-center justify-center rounded-[5px] bg-success/20 text-success transition-colors hover:bg-success/35",
                              isOpen && "ring-2 ring-accent",
                            )}
                          >
                            <Check className="size-3.5" strokeWidth={3} />
                          </button>
                        ) : (
                          <span className="mx-auto block size-1 rounded-full bg-surface-3" title={`${student.fullName ?? student.email} · ${q.title} · not yet`} />
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b border-l border-border/60 border-l-border px-3 py-1.5 text-right font-mono text-xs tabular group-hover:bg-surface-2/60">
                    {student.userId ? (
                      <span className={count === questions.length ? "text-success" : "text-text"}>
                        {count}/{questions.length}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={questions.length + 2} className="px-4 py-10 text-center text-sm text-muted">
                  No students match.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-xs text-faint">Completed by</td>
              {questions.map((q, i) => {
                const n = data.submissions.filter((s) => s.questionId === q.id).length;
                return (
                  <td key={q.id} className={cn("px-0.5 py-2.5 text-center font-mono text-[10px] text-muted", i === classCount && "border-l border-border")}>
                    {pct(n, signedIn.length)}%
                  </td>
                );
              })}
              <td className="border-l border-border" />
            </tr>
          </tfoot>
        </table>
      </div>

      <ScreenshotPanel data={data} byCell={byCell} cells={cells} open={open} setOpen={setOpen} />
    </>
  );
}

function ScreenshotPanel({
  data,
  byCell,
  cells,
  open,
  setOpen,
}: {
  data: GridData;
  byCell: Map<string, Submission>;
  cells: { userId: string; questionId: string }[];
  open: { userId: string; questionId: string } | null;
  setOpen: (cell: { userId: string; questionId: string } | null) => void;
}) {
  const index = open ? cells.findIndex((c) => c.userId === open.userId && c.questionId === open.questionId) : -1;
  const student = open ? data.students.find((s) => s.userId === open.userId) : undefined;
  const question: Question | undefined = open ? data.session.questions.find((q) => q.id === open.questionId) : undefined;
  const submission = open ? (byCell.get(`${open.userId}:${open.questionId}`) ?? null) : null;

  const go = useCallback(
    (delta: number) => {
      if (index < 0) return;
      const next = cells[index + delta];
      if (next) setOpen(next);
    },
    [cells, index, setOpen],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "j") go(1);
      if (e.key === "ArrowLeft" || e.key === "k") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  return (
    <Dialog
      open={!!open && !!submission}
      onClose={() => setOpen(null)}
      variant="drawer"
      title={
        student ? (
          <span className="flex items-center gap-2.5">
            <Avatar name={student.fullName} email={student.email} size={28} />
            <span className="min-w-0">
              <span className="block truncate">{student.fullName ?? student.email}</span>
              <span className="block truncate font-mono text-xs font-normal text-muted">
                {student.leetcodeUsername ? `@${student.leetcodeUsername} · ` : ""}
                {student.email}
              </span>
            </span>
          </span>
        ) : null
      }
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="font-mono text-xs text-faint">
            {index + 1} of {cells.length}
            <span className="ml-2 hidden sm:inline">· ← → to move</span>
          </span>
          <div className="flex gap-2">
            <Button size="sm" icon={<ChevronLeft className="size-4" />} disabled={index <= 0} onClick={() => go(-1)}>
              Prev
            </Button>
            <Button size="sm" disabled={index < 0 || index >= cells.length - 1} onClick={() => go(1)}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      }
    >
      {question && submission && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-strong">
                {question.lcNumber && <span className="font-mono text-muted">#{question.lcNumber} </span>}
                {question.title}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                <DifficultyText difficulty={question.difficulty} className="text-xs" />
                <span className="text-faint">·</span>
                {question.kind === "class" ? "Classwork" : "Homework"}
              </p>
            </div>
            <a
              href={question.leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 text-xs text-muted hover:text-strong"
            >
              LeetCode <ExternalLink className="size-3" />
            </a>
          </div>
          <ScreenshotImage key={submission.screenshotPath} submission={submission} className="w-full rounded-md border border-border bg-bg object-contain" />
          <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div>
              <dt className="text-faint">Submitted</dt>
              <dd className="mt-0.5 text-text">{formatDateTime(submission.submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-faint">Last updated</dt>
              <dd className="mt-0.5 text-text">{formatDateTime(submission.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Dialog>
  );
}

function exportCsv(data: GridData) {
  const { session, students, submissions } = data;
  const done = new Set(submissions.map((s) => `${s.userId}:${s.questionId}`));
  const header = [
    "Name",
    "Email",
    "LeetCode",
    ...session.questions.map((q) => `${q.kind === "class" ? "C" : "H"}${q.position} ${q.lcNumber ? `#${q.lcNumber} ` : ""}${q.title}`),
    "Done",
    "Total",
  ];
  const rows = students.map((s) => {
    const marks = session.questions.map((q) => (s.userId && done.has(`${s.userId}:${q.id}`) ? "Yes" : ""));
    return [
      s.fullName ?? "",
      s.email,
      s.leetcodeUsername ?? "",
      ...marks,
      marks.filter(Boolean).length,
      session.questions.length,
    ];
  });
  downloadCsv(`S${session.number}-submissions.csv`, [header, ...rows]);
}
