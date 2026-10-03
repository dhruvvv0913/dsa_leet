"use client";

import { CircleCheck, CircleX, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAttendance, useSessions, useSetAttendance } from "@/lib/data/hooks";
import { formatWeekday } from "@/lib/format";
import { WEIGHTS } from "@/lib/leaderboard";
import type { AttendanceRow } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";

export function AttendanceView() {
  const { data: sessions, isPending: sessionsPending } = useSessions();
  const published = useMemo(() => (sessions ?? []).filter((s) => s.status === "published"), [sessions]);
  const [picked, setPicked] = useState<string | null>(null);
  const sessionId = picked ?? published[published.length - 1]?.id ?? null;

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Attendance"
        description={`Mark who came to each class. Attendance is ${WEIGHTS.attendance * 100}% of the overall leaderboard; a class counts once you've marked it.`}
      />
      {sessionsPending ? (
        <Skeleton className="h-96" />
      ) : !sessionId ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted">
          Publish a session first — attendance is taken per class.
        </p>
      ) : (
        <Sheet
          key={sessionId}
          sessionId={sessionId}
          sessionPicker={
            <Select value={sessionId} onChange={(e) => setPicked(e.target.value)} className="sm:w-96" aria-label="Class">
              {published.map((s) => (
                <option key={s.id} value={s.id}>
                  S{s.number} · {formatWeekday(s.classDate)} · {s.title}
                </option>
              ))}
            </Select>
          }
        />
      )}
    </div>
  );
}

function Sheet({ sessionId, sessionPicker }: { sessionId: string; sessionPicker: React.ReactNode }) {
  const { data: sheet, isPending, error } = useAttendance(sessionId);
  const mark = useSetAttendance(sessionId);
  const confirm = useConfirm();
  const toast = useToast();
  const [query, setQuery] = useState("");

  const rows = sheet?.rows ?? [];
  const counts = {
    present: rows.filter((r) => r.present === true).length,
    absent: rows.filter((r) => r.present === false).length,
    unmarked: rows.filter((r) => r.present === null).length,
  };
  const visible = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    return !q || r.email.includes(q) || r.fullName?.toLowerCase().includes(q);
  });

  const set = (emails: string[], present: boolean | null) =>
    mark.mutate({ emails, present }, { onError: (e) => toast.error("Couldn't save attendance", errorMessage(e)) });

  const clearAll = async () => {
    const ok = await confirm({
      title: "Clear this class's attendance?",
      body: "Every mark for this class is removed, and it stops counting toward the leaderboard until you mark it again.",
      confirmLabel: "Clear marks",
      danger: true,
    });
    if (ok) set(rows.map((r) => r.email), null);
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {sessionPicker}
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a student" className="pl-8" aria-label="Find a student" />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-danger">{errorMessage(error)}</p>
      ) : isPending || !sheet ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted">
          No students yet. Add them on the People page.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <span className="text-muted">
              <span className="font-mono font-semibold text-success">{counts.present}</span> present
            </span>
            <span className="text-muted">
              <span className="font-mono font-semibold text-danger">{counts.absent}</span> absent
            </span>
            <span className="text-muted">
              <span className="font-mono font-semibold text-strong">{counts.unmarked}</span> not marked
            </span>
            <div className="ml-auto flex gap-2">
              {counts.present + counts.absent > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear marks
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                icon={<CircleCheck className="size-3.5" />}
                disabled={counts.unmarked === 0}
                onClick={() => set(rows.filter((r) => r.present === null).map((r) => r.email), true)}
              >
                {counts.present + counts.absent === 0 ? "Mark everyone present" : "Mark the rest present"}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <ul className="zebra">
              {visible.map((row) => (
                <AttendanceItem key={row.email} row={row} onSet={(present) => set([row.email], present)} />
              ))}
              {visible.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">No one matches that.</li>}
            </ul>
          </div>
          <p className="text-xs text-faint">Tip: mark the few who were absent, then use “Mark the rest present”. Click a selected option again to clear it.</p>
        </>
      )}
    </>
  );
}

function AttendanceItem({ row, onSet }: { row: AttendanceRow; onSet: (present: boolean | null) => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/70">
      <Avatar name={row.fullName} email={row.email} size={30} className={cn(!row.userId && "opacity-50")} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-strong">{row.fullName ?? row.email}</p>
        {(row.fullName || !row.userId) && (
          <p className="truncate font-mono text-xs text-faint">
            {[row.fullName ? row.email : null, row.userId ? null : "hasn't signed in yet"].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 rounded-md border border-border bg-surface-2 p-0.5" role="radiogroup" aria-label={`Attendance for ${row.fullName ?? row.email}`}>
        <button
          role="radio"
          aria-checked={row.present === true}
          onClick={() => onSet(row.present === true ? null : true)}
          className={cn(
            "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
            row.present === true ? "bg-success/15 font-medium text-success" : "text-muted hover:text-strong",
          )}
        >
          <CircleCheck className="size-3.5" /> Present
        </button>
        <button
          role="radio"
          aria-checked={row.present === false}
          onClick={() => onSet(row.present === false ? null : false)}
          className={cn(
            "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
            row.present === false ? "bg-danger/15 font-medium text-danger" : "text-muted hover:text-strong",
          )}
        >
          <CircleX className="size-3.5" /> Absent
        </button>
      </div>
    </li>
  );
}
