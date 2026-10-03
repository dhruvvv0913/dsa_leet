"use client";

import { ArrowRight, Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/spinner";
import { useOverview } from "@/lib/data/hooks";
import { formatShortDay, timeAgo } from "@/lib/format";
import type { AdminOverview } from "@/lib/types";
import { pct } from "@/lib/utils";

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-strong">{value}</p>
      {detail && <p className="mt-2 text-xs text-faint">{detail}</p>}
    </div>
  );
}

export function OverviewView() {
  const { data, isPending, error } = useOverview();

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Overview"
        description="How the cohort is doing right now."
        actions={
          <>
            <ButtonLink href="/admin/people" icon={<UserPlus className="size-4" />}>
              Add people
            </ButtonLink>
            <ButtonLink href="/admin/sessions?new=1" variant="primary" icon={<Plus className="size-4" />}>
              New session
            </ButtonLink>
          </>
        }
      />
      {error ? (
        <p className="text-sm text-danger">{error.message}</p>
      ) : isPending || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <OverviewBody data={data} />
      )}
    </div>
  );
}

function OverviewBody({ data }: { data: AdminOverview }) {
  const published = data.sessions.filter((s) => s.status === "published");
  const possible = published.reduce((sum, s) => sum + s.questionCount * data.signedIn, 0);
  const done = published.reduce((sum, s) => sum + s.submissionCount, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Enrolled students" value={String(data.enrolled)} detail={`${data.admins} admin${data.admins === 1 ? "" : "s"}`} />
        <StatTile
          label="Signed in"
          value={String(data.signedIn)}
          detail={data.enrolled - data.signedIn > 0 ? `${data.enrolled - data.signedIn} haven't signed in yet` : "Everyone's in"}
        />
        <StatTile label="Submissions today" value={String(data.submissionsToday)} detail={`${data.totalSubmissions.toLocaleString("en-IN")} all time`} />
        <StatTile label="Average completion" value={`${pct(done, possible)}%`} detail="Published sessions, signed-in students" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-strong">Completion by session</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {data.sessions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No sessions yet.</p>
            ) : (
              <ul className="zebra">
                {data.sessions.map((s) => {
                  const total = s.questionCount * data.signedIn;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/admin/submissions?session=${s.id}`}
                        className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-surface-2/80 sm:grid-cols-[40px_minmax(0,1fr)_170px_72px]"
                      >
                        <span className="font-mono text-xs text-muted">S{s.number}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-strong">{s.title}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-faint">
                            <StatusBadge status={s.status} />
                            {formatShortDay(s.classDate)} · {s.questionCount} problems · {s.fullyDone} finished all
                          </span>
                        </span>
                        <span className="col-span-3 flex items-center gap-3 sm:col-span-1">
                          <Meter value={s.submissionCount} max={total} size="sm" />
                        </span>
                        <span className="hidden text-right font-mono text-xs text-text tabular sm:block">
                          {s.status === "published" ? `${pct(s.submissionCount, total)}%` : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold text-strong">Latest submissions</h2>
            <Link href="/admin/submissions" className="flex items-center gap-1 text-xs text-muted hover:text-strong">
              Open grid <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="rounded-lg border border-border bg-surface">
            {data.recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Nothing submitted yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-strong">{r.studentName}</p>
                      <p className="truncate text-xs text-muted">
                        <span className="font-mono">S{r.sessionNumber}</span> · {r.lcNumber ? `#${r.lcNumber} ` : ""}
                        {r.questionTitle}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-faint">{timeAgo(r.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
