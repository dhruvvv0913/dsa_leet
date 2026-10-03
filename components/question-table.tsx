"use client";

import { Circle, CircleCheck, ExternalLink, Eye, Upload } from "lucide-react";
import { useState } from "react";
import { Button, ExternalButton } from "@/components/ui/button";
import { DifficultyText } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useScreenshotUpload } from "@/components/upload-dialog";
import { useUploadingCount } from "@/lib/data/hooks";
import { compressScreenshot, imageFromDataTransfer } from "@/lib/image";
import type { Question, Submission } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";

interface QuestionTableProps {
  title: string;
  questions: Question[];
  submissions: Map<string, Submission>;
  canSubmit: boolean;
  onUpload: (question: Question) => void;
  onView: (question: Question) => void;
}

export function QuestionTable({ title, questions, submissions, canSubmit, onUpload, onView }: QuestionTableProps) {
  const done = questions.filter((q) => submissions.has(q.id)).length;
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold text-strong">
          {title}
          <span className="ml-2 font-mono text-xs font-normal text-faint">{questions.length}</span>
        </h2>
        <span className="font-mono text-xs text-muted tabular">
          {done}/{questions.length} done
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="hidden grid-cols-[28px_60px_minmax(0,1fr)_96px_200px] gap-x-3 border-b border-border px-4 py-2 text-xs text-faint md:grid">
          <span aria-hidden />
          <span>#</span>
          <span>Problem</span>
          <span>Difficulty</span>
          <span className="text-right">Proof</span>
        </div>
        {questions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No problems here yet.</p>
        ) : (
          <ul className="zebra">
            {questions.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                submission={submissions.get(q.id) ?? null}
                canSubmit={canSubmit}
                onUpload={onUpload}
                onView={onView}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function QuestionRow({
  question,
  submission,
  canSubmit,
  onUpload,
  onView,
}: {
  question: Question;
  submission: Submission | null;
  canSubmit: boolean;
  onUpload: (q: Question) => void;
  onView: (q: Question) => void;
}) {
  const uploading = useUploadingCount(question.id) > 0;
  const upload = useScreenshotUpload(question);
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const done = !!submission;

  // Dropping a screenshot straight onto the row uploads it — no dialog needed.
  const onDropFile = async (file: File) => {
    try {
      const image = await compressScreenshot(file);
      await upload(image, done);
    } catch (error) {
      toast.error("Couldn't use that file", errorMessage(error));
    }
  };

  return (
    <li
      onDragOver={(e) => {
        if (!canSubmit || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canSubmit) return;
        e.preventDefault();
        setDragging(false);
        const file = imageFromDataTransfer(e.dataTransfer);
        if (file) void onDropFile(file);
      }}
      className={cn(
        "relative grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2/70 md:grid-cols-[28px_60px_minmax(0,1fr)_96px_200px] md:py-2.5",
        dragging && "bg-accent/[0.07] outline-2 -outline-offset-2 outline-accent/60 outline-dashed",
      )}
    >
      <span className="flex items-center" aria-label={done ? "Done" : "Not done yet"}>
        {uploading ? (
          <Spinner className="size-[18px] text-accent" />
        ) : done ? (
          <CircleCheck className="size-[18px] text-success" />
        ) : (
          <Circle className="size-[18px] text-faint" />
        )}
      </span>

      <span className="hidden font-mono text-xs text-muted tabular md:block">{question.lcNumber ?? "—"}</span>

      <div className="min-w-0">
        <a
          href={question.leetcodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm text-strong/95 hover:text-accent md:block md:truncate"
          title={question.title}
        >
          <span className="mr-1.5 font-mono text-xs text-muted md:hidden">{question.lcNumber ? `${question.lcNumber}.` : ""}</span>
          {question.title}
        </a>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <DifficultyText difficulty={question.difficulty} className="text-xs md:hidden" />
          {question.hint && (
            <span className="truncate text-xs text-muted" title={question.hint}>
              {question.hint}
            </span>
          )}
        </div>
      </div>

      <DifficultyText difficulty={question.difficulty} className="hidden md:block" />

      <div className="flex items-center justify-end gap-1.5">
        <ExternalButton
          href={question.leetcodeUrl}
          variant="ghost"
          size="sm"
          icon={<ExternalLink className="size-3.5" />}
          aria-label={`Open ${question.title} on LeetCode`}
        >
          <span className="hidden sm:inline">Open</span>
        </ExternalButton>
        {done ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<Eye className="size-3.5" />}
            onClick={() => onView(question)}
            disabled={uploading}
            className="sm:w-[92px]"
          >
            View
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload className="size-3.5" />}
            onClick={() => onUpload(question)}
            disabled={!canSubmit || uploading}
            title={canSubmit ? "Upload a screenshot of your accepted solution" : "Submissions open once the session is published"}
            className="hover:border-accent/50 sm:w-[92px]"
          >
            Upload
          </Button>
        )}
      </div>
    </li>
  );
}
