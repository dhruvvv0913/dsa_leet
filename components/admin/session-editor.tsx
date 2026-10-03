"use client";

import { ArrowDown, ArrowLeft, ArrowUp, CircleCheck, ExternalLink, Eye, EyeOff, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DifficultyText, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  useCreateQuestion,
  useDeleteQuestion,
  useDeleteSession,
  useMoveQuestion,
  useSessions,
  useSetSessionStatus,
  useUpdateQuestion,
  useUpdateSession,
} from "@/lib/data/hooks";
import { useData } from "@/lib/data/provider";
import { lookupProblem, parseLeetCodeSlug, problemUrl, slugToTitle } from "@/lib/leetcode";
import { DIFFICULTIES, type Difficulty, type Question, type QuestionKind, type SessionWithQuestions } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";
import { fieldErrors, questionSchema, sessionSchema } from "@/lib/validators";

export function SessionEditorView({ id }: { id: string }) {
  const { data: sessions, isPending } = useSessions();
  const session = sessions?.find((s) => s.id === id) ?? null;

  if (isPending) return <Skeleton className="h-[480px]" />;
  if (!session) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-strong">Session not found</p>
        <ButtonLink href="/admin/sessions" variant="secondary" className="mt-4" icon={<ArrowLeft className="size-4" />}>
          All sessions
        </ButtonLink>
      </div>
    );
  }
  return <Editor session={session} />;
}

function Editor({ session }: { session: SessionWithQuestions }) {
  const setStatus = useSetSessionStatus();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ kind: QuestionKind; question: Question | null } | null>(null);
  const published = session.status === "published";

  const togglePublish = async () => {
    try {
      await setStatus.mutateAsync({ id: session.id, status: published ? "draft" : "published" });
      toast.success(published ? "Moved back to draft" : `S${session.number} is live`, published ? "Students can't see it anymore." : "Students can see it now.");
    } catch (error) {
      toast.error("Couldn't update", errorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/sessions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-strong">
        <ArrowLeft className="size-4" /> Sessions
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-md border border-border px-2 py-1 font-mono text-sm text-text">S{session.number}</span>
          <h1 className="font-display truncate text-xl font-semibold tracking-tight text-strong">{session.title}</h1>
          <StatusBadge status={session.status} />
        </div>
        <div className="flex shrink-0 gap-2">
          <ButtonLink href={`/s/${session.number}`} icon={<Eye className="size-4" />}>
            Preview
          </ButtonLink>
          <Button
            variant={published ? "secondary" : "primary"}
            icon={published ? <EyeOff className="size-4" /> : <CircleCheck className="size-4" />}
            onClick={togglePublish}
            loading={setStatus.isPending}
            disabled={!published && session.questions.length === 0}
            title={!published && session.questions.length === 0 ? "Add problems before publishing" : undefined}
          >
            {published ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 space-y-6 xl:order-1">
          {(["class", "homework"] as const).map((kind) => (
            <QuestionsSection
              key={kind}
              kind={kind}
              questions={session.questions.filter((q) => q.kind === kind)}
              onAdd={() => setDialog({ kind, question: null })}
              onEdit={(question) => setDialog({ kind, question })}
            />
          ))}
        </div>
        <div className="order-1 space-y-6 xl:order-2">
          <DetailsForm key={session.id} session={session} />
          <DangerZone session={session} />
        </div>
      </div>

      <QuestionDialog
        open={!!dialog}
        sessionId={session.id}
        kind={dialog?.kind ?? "class"}
        question={dialog?.question ?? null}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function DetailsForm({ session }: { session: SessionWithQuestions }) {
  const update = useUpdateSession();
  const toast = useToast();
  const initial = () => ({
    number: String(session.number),
    title: session.title,
    classDate: session.classDate ?? "",
    description: session.description ?? "",
    recordingUrl: session.recordingUrl ?? "",
    notesUrl: session.notesUrl ?? "",
  });
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial());

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = sessionSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    try {
      await update.mutateAsync({ id: session.id, input: parsed.data });
      toast.success("Session saved");
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-strong">Details</h2>
      <div className="grid grid-cols-[88px_1fr] gap-3">
        <Field label="Number" htmlFor="sd-number" error={errors.number}>
          <Input id="sd-number" inputMode="numeric" value={form.number} onChange={set("number")} className="font-mono" />
        </Field>
        <Field label="Class date" htmlFor="sd-date" error={errors.classDate}>
          <Input id="sd-date" type="date" value={form.classDate} onChange={set("classDate")} />
        </Field>
      </div>
      <Field label="Title" htmlFor="sd-title" error={errors.title}>
        <Input id="sd-title" value={form.title} onChange={set("title")} />
      </Field>
      <Field label="Description" htmlFor="sd-desc" error={errors.description} hint="Shown at the top of the session page.">
        <Textarea id="sd-desc" value={form.description} onChange={set("description")} className="min-h-20" />
      </Field>
      <Field label="Recording link" htmlFor="sd-rec" error={errors.recordingUrl} hint="YouTube, Drive or Zoom link — add it after class.">
        <Input id="sd-rec" value={form.recordingUrl} onChange={set("recordingUrl")} placeholder="https://" />
      </Field>
      <Field label="Notes link" htmlFor="sd-notes" error={errors.notesUrl}>
        <Input id="sd-notes" value={form.notesUrl} onChange={set("notesUrl")} placeholder="https://" />
      </Field>
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <div className="flex justify-end gap-2">
        {dirty && (
          <Button variant="ghost" onClick={() => (setForm(initial()), setErrors({}))}>
            Discard
          </Button>
        )}
        <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={!dirty} loading={update.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function QuestionsSection({
  kind,
  questions,
  onAdd,
  onEdit,
}: {
  kind: QuestionKind;
  questions: Question[];
  onAdd: () => void;
  onEdit: (q: Question) => void;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-strong">
          {kind === "class" ? "Classwork" : "Homework"}
          <span className="ml-2 font-mono text-xs font-normal text-faint">{questions.length}</span>
        </h2>
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={onAdd}>
          Add problem
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {questions.length === 0 ? (
          <button onClick={onAdd} className="flex w-full flex-col items-center gap-1 px-4 py-8 text-sm text-muted hover:bg-surface-2/60 hover:text-strong">
            <Plus className="size-4" />
            Paste a LeetCode link to add the first {kind === "class" ? "classwork" : "homework"} problem
          </button>
        ) : (
          <ul className="zebra">
            {questions.map((q, i) => (
              <EditorRow key={q.id} question={q} first={i === 0} last={i === questions.length - 1} onEdit={() => onEdit(q)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EditorRow({ question, first, last, onEdit }: { question: Question; first: boolean; last: boolean; onEdit: () => void }) {
  const move = useMoveQuestion();
  const remove = useDeleteQuestion();
  const data = useData();
  const confirm = useConfirm();
  const toast = useToast();

  const onDelete = async () => {
    const count = await data.countSubmissions([question.id]);
    const ok = await confirm({
      title: "Delete this problem?",
      body:
        count > 0 ? (
          <>
            <span className="text-danger">{count} student{count === 1 ? " has" : "s have"} already submitted it.</span> Their
            screenshots for this problem will be deleted too. This can&apos;t be undone.
          </>
        ) : (
          "Nobody has submitted it yet."
        ),
      confirmLabel: "Delete problem",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(question.id);
      toast.info("Problem deleted", question.title);
    } catch (error) {
      toast.error("Couldn't delete", errorMessage(error));
    }
  };

  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 hover:bg-surface-2/70 sm:grid-cols-[24px_52px_minmax(0,1fr)_68px_auto]">
      <span className="font-mono text-xs text-faint">{question.position}</span>
      <span className="hidden font-mono text-xs text-muted sm:block">{question.lcNumber ?? "—"}</span>
      <div className="min-w-0">
        <a
          href={question.leetcodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex max-w-full items-center gap-1.5 text-sm text-strong hover:text-accent"
        >
          <span className="truncate">{question.title}</span>
          <ExternalLink className="size-3 shrink-0 text-faint group-hover:text-accent" />
        </a>
        {question.hint && <p className="truncate text-xs text-muted">{question.hint}</p>}
      </div>
      <DifficultyText difficulty={question.difficulty} className="hidden text-xs sm:block" />
      <div className="flex items-center gap-0.5">
        <IconButton label="Move up" disabled={first || move.isPending} onClick={() => move.mutate({ id: question.id, direction: -1 })}>
          <ArrowUp />
        </IconButton>
        <IconButton label="Move down" disabled={last || move.isPending} onClick={() => move.mutate({ id: question.id, direction: 1 })}>
          <ArrowDown />
        </IconButton>
        <IconButton label="Edit" onClick={onEdit}>
          <Pencil />
        </IconButton>
        <IconButton label="Delete" onClick={onDelete} danger>
          <Trash2 />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-md p-1.5 text-muted transition-colors disabled:opacity-25 [&>svg]:size-3.5",
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-surface-3 hover:text-strong",
      )}
    >
      {children}
    </button>
  );
}

type LookupState = "idle" | "loading" | "found" | "guessed" | "invalid";

function QuestionDialog({
  open,
  sessionId,
  kind,
  question,
  onClose,
}: {
  open: boolean;
  sessionId: string;
  kind: QuestionKind;
  question: Question | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={question ? "Edit problem" : "Add a problem"}
      description={question ? undefined : "Paste a LeetCode link — the number, title and difficulty fill in automatically."}
    >
      {open && <QuestionForm key={question?.id ?? `new-${kind}`} sessionId={sessionId} kind={kind} question={question} onDone={onClose} />}
    </Dialog>
  );
}

function QuestionForm({
  sessionId,
  kind,
  question,
  onDone,
}: {
  sessionId: string;
  kind: QuestionKind;
  question: Question | null;
  onDone: () => void;
}) {
  const create = useCreateQuestion();
  const update = useUpdateQuestion();
  const toast = useToast();
  const [form, setForm] = useState({
    url: question?.leetcodeUrl ?? "",
    lcNumber: question?.lcNumber ? String(question.lcNumber) : "",
    title: question?.title ?? "",
    difficulty: (question?.difficulty ?? "Easy") as Difficulty,
    kind: question?.kind ?? kind,
    hint: question?.hint ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The last slug we resolved, and whether LeetCode confirmed it.
  const [resolved, setResolved] = useState<{ slug: string; verified: boolean } | null>(() => {
    const initial = question ? parseLeetCodeSlug(question.leetcodeUrl) : null;
    return initial ? { slug: initial, verified: true } : null;
  });

  const slug = parseLeetCodeSlug(form.url);
  const lookup: LookupState = !form.url.trim()
    ? "idle"
    : !slug
      ? "invalid"
      : resolved?.slug === slug
        ? resolved.verified
          ? "found"
          : "guessed"
        : "loading";
  const resolvedSlug = resolved?.slug;

  useEffect(() => {
    if (!slug || slug === resolvedSlug) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const problem = await lookupProblem(slug);
      if (cancelled) return;
      setForm((f) => ({
        ...f,
        title: problem.title,
        lcNumber: problem.number ? String(problem.number) : f.lcNumber,
        difficulty: problem.difficulty ?? f.difficulty,
      }));
      setResolved({ slug, verified: problem.verified });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, resolvedSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) {
      setErrors({ leetcodeUrl: "Paste a leetcode.com/problems/… link" });
      return;
    }
    const parsed = questionSchema.safeParse({
      kind: form.kind,
      lcNumber: form.lcNumber,
      title: form.title || slugToTitle(slug),
      leetcodeUrl: problemUrl(slug),
      difficulty: form.difficulty,
      hint: form.hint,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    const input = { ...parsed.data, sessionId };
    try {
      if (question) await update.mutateAsync({ id: question.id, input });
      else await create.mutateAsync(input);
      toast.success(question ? "Problem updated" : "Problem added", `${input.lcNumber ? `#${input.lcNumber} ` : ""}${input.title}`);
      onDone();
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="LeetCode link" htmlFor="q-url" error={errors.leetcodeUrl}>
        <div className="relative">
          <Input
            id="q-url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://leetcode.com/problems/two-sum/"
            className="pr-9 font-mono text-xs"
            autoFocus={!question}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {lookup === "loading" ? (
              <Spinner className="size-4 text-muted" />
            ) : lookup === "found" ? (
              <CircleCheck className="size-4 text-success" />
            ) : lookup === "guessed" || lookup === "invalid" ? (
              <TriangleAlert className="size-4 text-medium" />
            ) : null}
          </span>
        </div>
      </Field>
      {lookup === "guessed" && (
        <p className="-mt-2 text-xs text-medium">Couldn&apos;t reach LeetCode, so the title is a guess from the link. Check the number and difficulty.</p>
      )}
      {lookup === "invalid" && <p className="-mt-2 text-xs text-medium">That doesn&apos;t look like a LeetCode problem link yet.</p>}

      <div className="grid grid-cols-[96px_1fr] gap-3">
        <Field label="Number" htmlFor="q-num" error={errors.lcNumber}>
          <Input
            id="q-num"
            inputMode="numeric"
            value={form.lcNumber}
            onChange={(e) => setForm({ ...form, lcNumber: e.target.value })}
            className="font-mono"
            placeholder="268"
          />
        </Field>
        <Field label="Title" htmlFor="q-title" error={errors.title}>
          <Input id="q-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Missing Number" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Difficulty" htmlFor="q-diff">
          <Segmented
            value={form.difficulty}
            options={DIFFICULTIES.map((d) => ({ value: d, label: <DifficultyText difficulty={d} className="text-xs" /> }))}
            onChange={(difficulty) => setForm({ ...form, difficulty })}
          />
        </Field>
        <Field label="Section" htmlFor="q-kind">
          <Segmented
            value={form.kind}
            options={[
              { value: "class", label: "Classwork" },
              { value: "homework", label: "Homework" },
            ]}
            onChange={(k) => setForm({ ...form, kind: k })}
          />
        </Field>
      </div>

      <Field label="Hint (optional)" htmlFor="q-hint" error={errors.hint} hint="One short line, e.g. “Try two approaches: sum and XOR”.">
        <Input id="q-hint" value={form.hint} onChange={(e) => setForm({ ...form, hint: e.target.value })} />
      </Field>

      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={create.isPending || update.isPending} disabled={lookup === "loading"}>
          {question ? "Save" : "Add problem"}
        </Button>
      </div>
    </form>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex h-9 rounded-md border border-border bg-surface-2 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded px-2 text-xs transition-colors",
            value === o.value ? "bg-surface-3 text-strong shadow-sm" : "text-muted hover:text-strong",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DangerZone({ session }: { session: SessionWithQuestions }) {
  const remove = useDeleteSession();
  const data = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

  const onDelete = async () => {
    const count = await data.countSubmissions(session.questions.map((q) => q.id));
    const ok = await confirm({
      title: `Delete S${session.number}?`,
      body: (
        <>
          This removes the session and its {session.questions.length} problems
          {count > 0 && (
            <>
              , plus <span className="text-danger">{count} student submission{count === 1 ? "" : "s"}</span> and their screenshots
            </>
          )}
          . This can&apos;t be undone.
        </>
      ),
      confirmLabel: "Delete session",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(session.id);
      toast.info(`S${session.number} deleted`);
      router.push("/admin/sessions");
    } catch (error) {
      toast.error("Couldn't delete", errorMessage(error));
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/25 bg-danger/[0.04] p-5">
      <div>
        <h2 className="text-sm font-semibold text-strong">Delete session</h2>
        <p className="mt-1 text-xs text-muted">Removes its problems and every submission for them.</p>
      </div>
      <Button variant="danger" size="sm" icon={<Trash2 className="size-3.5" />} onClick={onDelete} loading={remove.isPending}>
        Delete
      </Button>
    </div>
  );
}
