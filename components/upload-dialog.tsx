"use client";

import { ImagePlus, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useSubmitScreenshot } from "@/lib/data/hooks";
import { ACCEPTED_TYPES, compressScreenshot, imageFromDataTransfer, type CompressedImage } from "@/lib/image";
import type { Question } from "@/lib/types";
import { cn, errorMessage, formatBytes } from "@/lib/utils";

/** Shared upload flow: compress in the browser, then upload with an optimistic ✓. */
export function useScreenshotUpload(question: Question) {
  const mutation = useSubmitScreenshot(question);
  const toast = useToast();
  return async (image: CompressedImage, replacing: boolean) => {
    try {
      await mutation.mutateAsync(image);
      toast.success(
        replacing ? "Screenshot replaced" : `Nice — ${question.lcNumber ? `#${question.lcNumber}` : question.title} is done`,
        replacing ? undefined : "Keep going.",
      );
    } catch (error) {
      toast.error("Upload failed", errorMessage(error));
    }
  };
}

export function UploadDialog({
  question,
  replacing,
  onClose,
}: {
  question: Question | null;
  replacing: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!question}
      onClose={onClose}
      size="lg"
      title={replacing ? "Replace screenshot" : "Upload proof"}
      description={
        question ? (
          <span>
            {question.lcNumber && <span className="font-mono text-muted">#{question.lcNumber} </span>}
            <span className="text-text">{question.title}</span>
          </span>
        ) : null
      }
    >
      {question && <UploadBody key={question.id} question={question} replacing={replacing} onDone={onClose} />}
    </Dialog>
  );
}

function UploadBody({
  question,
  replacing,
  onDone,
}: {
  question: Question;
  replacing: boolean;
  onDone: () => void;
}) {
  const upload = useScreenshotUpload(question);
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<CompressedImage | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const accept = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const compressed = await compressScreenshot(file);
      setImage(compressed);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(compressed.blob);
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Ctrl+V / Cmd+V anywhere while the dialog is open
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromDataTransfer(e.clipboardData);
      if (file) {
        e.preventDefault();
        void accept(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const submit = () => {
    if (!image) return;
    onDone();
    void upload(image, replacing);
  };

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void accept(imageFromDataTransfer(e.dataTransfer));
        }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed px-6 text-center transition-colors",
          preview ? "border-border bg-bg p-2" : "min-h-52 border-border-strong bg-surface-2/40 py-10 hover:border-accent/60 hover:bg-accent/[0.04]",
          dragging && "border-accent bg-accent/[0.06]",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => void accept(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Screenshot preview" className="max-h-72 w-auto rounded-md object-contain" />
        ) : busy ? (
          <Spinner className="size-6 text-accent" />
        ) : (
          <>
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-muted">
              <ImagePlus className="size-5" />
            </span>
            <p className="text-sm text-strong">
              Drop a screenshot, <span className="text-accent">browse</span>, or paste with{" "}
              <kbd className="rounded border border-border-strong bg-surface-3 px-1 font-mono text-xs">Ctrl</kbd>+
              <kbd className="rounded border border-border-strong bg-surface-3 px-1 font-mono text-xs">V</kbd>
            </p>
            <p className="text-xs text-faint">PNG, JPG or WebP · up to 10 MB</p>
          </>
        )}
      </label>

      {error && (
        <p className="flex items-center gap-2 text-sm text-danger" role="alert">
          <TriangleAlert className="size-4" /> {error}
        </p>
      )}

      {image ? (
        <p className="font-mono text-xs text-muted">
          {formatBytes(image.originalBytes)} → <span className="text-success">{formatBytes(image.blob.size)}</span> · {image.width}×
          {image.height} · {image.ext.toUpperCase()}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          Tip: capture just the <span className="text-success">Accepted</span> result panel on LeetCode (Win + Shift + S on Windows, Cmd + Shift + 4 on Mac).
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        {image ? (
          <Button variant="ghost" onClick={() => inputRef.current?.click()}>
            Choose another
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!image || busy} onClick={submit}>
            {replacing ? "Replace" : "Upload & mark done"}
          </Button>
        </div>
      </div>
    </div>
  );
}
