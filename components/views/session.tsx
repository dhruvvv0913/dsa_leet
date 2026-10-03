"use client";

import { ArrowLeft, FileText, Info, Pencil, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { QuestionTable } from "@/components/question-table";
import { ScreenshotDialog } from "@/components/screenshot-dialog";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink, ExternalButton } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/spinner";
import { UploadDialog } from "@/components/upload-dialog";
import { useMySubmissions, useSessions, useViewer } from "@/lib/data/hooks";
import { formatDay } from "@/lib/format";
import type { Question, Submission } from "@/lib/types";

export function SessionView({ number }: { number: number }) {
  const { data: viewer } = useViewer();
  const sessions = useSessions();
  const mine = useMySubmissions();

  const [uploadFor, setUploadFor] = useState<{ question: Question; replacing: boolean } | null>(null);
  const [viewing, setViewing] = useState<Question | null>(null);

  const session = sessions.data?.find((s) => s.number === number) ?? null;
  const submissions = useMemo(() => new Map<string, Submission>((mine.data ?? []).map((s) => [s.questionId, s])), [mine.data]);

  if (sessions.isPending || mine.isPending || !viewer) return <SessionSkeleton />;

  if (!session) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="font-mono text-sm text-faint">S{Number.isFinite(number) ? number : "?"}</p>
        <h1 className="font-display mt-2 text-lg font-semibold text-strong">This session isn&apos;t available</h1>
        <p className="mt-1 text-sm text-muted">It may not be published yet, or the link is wrong.</p>
        <ButtonLink href="/" className="mt-6" variant="secondary" icon={<ArrowLeft className="size-4" />}>
          All sessions
        </ButtonLink>
      </div>
    );
  }

  const classQs = session.questions.filter((q) => q.kind === "class");
  const homeworkQs = session.questions.filter((q) => q.kind === "homework");
  const done = session.questions.filter((q) => submissions.has(q.id)).length;
  const canSubmit = session.status === "published";
  const isAdmin = viewer.role === "admin";

  return (
    <div className="space-y-7">
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-strong">
          <ArrowLeft className="size-4" /> Sessions
        </Link>
      </div>

      {session.status === "draft" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <StatusBadge status="draft" />
          <span className="min-w-0 flex-1 text-muted">Students can&apos;t see this session yet. This is a preview.</span>
          {isAdmin && (
            <ButtonLink href={`/admin/sessions/${session.id}`} size="sm" variant="secondary" icon={<Pencil className="size-3.5" />}>
              Edit
            </ButtonLink>
          )}
        </div>
      )}

      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-xs text-text">S{session.number}</span>
            <span>{formatDay(session.classDate)}</span>
          </div>
          <h1 className="font-display mt-2.5 text-2xl font-semibold tracking-tight text-strong">{session.title}</h1>
          {session.description && <p className="mt-2 text-sm leading-relaxed text-muted">{session.description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {session.recordingUrl && (
            <ExternalButton href={session.recordingUrl} icon={<PlayCircle className="size-4" />}>
              Recording
            </ExternalButton>
          )}
          {session.notesUrl && (
            <ExternalButton href={session.notesUrl} icon={<FileText className="size-4" />}>
              Notes
            </ExternalButton>
          )}
        </div>
      </header>

      <div className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="shrink-0 text-sm text-muted">
          <span className="font-mono text-base font-semibold text-strong tabular">{done}</span>
          <span className="font-mono"> / {session.questions.length}</span> done
        </span>
        <Meter value={done} max={session.questions.length} label="Session progress" />
      </div>

      <div className="flex gap-2.5 rounded-lg border border-border/70 bg-surface/50 px-4 py-3 text-xs leading-relaxed text-muted">
        <Info className="mt-px size-4 shrink-0 text-faint" />
        <p>
          <span className="text-text">Open</span> uses whichever LeetCode account is signed in on this browser
          {viewer.leetcodeUsername && (
            <>
              {" "}
              (<span className="font-mono text-text">@{viewer.leetcodeUsername}</span>)
            </>
          )}
          . Once you get <span className="text-success">Accepted</span>, upload a screenshot: click{" "}
          <span className="text-text">Upload</span>, or drag the image straight onto the problem&apos;s row.
        </p>
      </div>

      <QuestionTable
        title="Classwork"
        questions={classQs}
        submissions={submissions}
        canSubmit={canSubmit}
        onUpload={(q) => setUploadFor({ question: q, replacing: false })}
        onView={setViewing}
      />
      <QuestionTable
        title="Homework"
        questions={homeworkQs}
        submissions={submissions}
        canSubmit={canSubmit}
        onUpload={(q) => setUploadFor({ question: q, replacing: false })}
        onView={setViewing}
      />

      <UploadDialog
        question={uploadFor?.question ?? null}
        replacing={uploadFor?.replacing ?? false}
        onClose={() => setUploadFor(null)}
      />
      <ScreenshotDialog
        question={viewing}
        submission={viewing ? (submissions.get(viewing.id) ?? null) : null}
        onClose={() => setViewing(null)}
        onReplace={(q) => {
          setViewing(null);
          setUploadFor({ question: q, replacing: true });
        }}
      />
    </div>
  );
}

function SessionSkeleton() {
  return (
    <div className="space-y-7">
      <Skeleton className="h-5 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-[28rem] max-w-full" />
        <Skeleton className="h-4 w-[36rem] max-w-full" />
      </div>
      <Skeleton className="h-12" />
      <Skeleton className="h-72" />
      <Skeleton className="h-96" />
    </div>
  );
}
