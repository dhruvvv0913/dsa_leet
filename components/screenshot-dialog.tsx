"use client";

import { ImageOff, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useRemoveSubmission, useScreenshotUrl } from "@/lib/data/hooks";
import { formatDateTime } from "@/lib/format";
import type { Question, Submission } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export function ScreenshotImage({ submission, className }: { submission: Submission | null; className?: string }) {
  const { data: url, isPending, error } = useScreenshotUrl(submission);
  if (!submission?.screenshotPath || isPending) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md bg-bg">
        <Spinner className="size-6 text-muted" />
      </div>
    );
  }
  if (error || !url) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-md bg-bg text-sm text-muted">
        <ImageOff className="size-6" />
        Couldn&apos;t load this screenshot.
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block" title="Open full size">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Submitted screenshot" className={className ?? "max-h-[60vh] w-full rounded-md bg-bg object-contain"} />
    </a>
  );
}

/** A student's own submission: view it, replace it, or take it back. */
export function ScreenshotDialog({
  question,
  submission,
  onClose,
  onReplace,
}: {
  question: Question | null;
  submission: Submission | null;
  onClose: () => void;
  onReplace: (question: Question) => void;
}) {
  const remove = useRemoveSubmission();
  const confirm = useConfirm();
  const toast = useToast();

  const onRemove = async () => {
    if (!question) return;
    const ok = await confirm({
      title: "Remove this screenshot?",
      body: "The problem will go back to not done. You can upload again any time.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    onClose();
    try {
      await remove.mutateAsync(question.id);
      toast.info("Screenshot removed");
    } catch (error) {
      toast.error("Couldn't remove it", errorMessage(error));
    }
  };

  return (
    <Dialog
      open={!!question && !!submission}
      onClose={onClose}
      size="xl"
      title={
        question ? (
          <span>
            {question.lcNumber && <span className="font-mono text-muted">#{question.lcNumber} </span>}
            {question.title}
          </span>
        ) : null
      }
      description={
        submission ? (
          <span className="font-mono text-xs">
            Submitted {formatDateTime(submission.submittedAt)}
            {submission.updatedAt !== submission.submittedAt && ` · replaced ${formatDateTime(submission.updatedAt)}`}
          </span>
        ) : null
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={onRemove} className="hover:text-danger">
            Remove
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="secondary"
              icon={<RefreshCcw className="size-3.5" />}
              onClick={() => question && onReplace(question)}
            >
              Replace
            </Button>
          </div>
        </div>
      }
    >
      <ScreenshotImage submission={submission} />
    </Dialog>
  );
}
