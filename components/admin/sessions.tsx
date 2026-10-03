"use client";

import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useCreateSession, useSessions, useSetSessionStatus } from "@/lib/data/hooks";
import { dayOffset, formatWeekday } from "@/lib/format";
import type { SessionWithQuestions } from "@/lib/types";
import { errorMessage } from "@/lib/utils";
import { fieldErrors, sessionSchema } from "@/lib/validators";

export function SessionsAdminView() {
  const { data: sessions, isPending } = useSessions();
  const params = useSearchParams();
  const router = useRouter();
  const [creating, setCreating] = useState(() => params.get("new") === "1");

  useEffect(() => {
    if (params.get("new") === "1") router.replace("/admin/sessions");
  }, [params, router]);

  const nextNumber = (sessions ?? []).reduce((max, s) => Math.max(max, s.number), 0) + 1;

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Sessions"
        description="New sessions start as drafts. Students only see a session after you publish it."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New session
          </Button>
        }
      />

      {isPending ? (
        <Skeleton className="h-80" />
      ) : !sessions?.length ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm text-strong">No sessions yet</p>
          <p className="mt-1 text-sm text-muted">Create S1, add its problems, then publish it.</p>
          <Button variant="primary" className="mt-5" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Create the first session
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-faint">
                <th className="w-16 px-4 py-2 font-normal">#</th>
                <th className="px-3 py-2 font-normal">Title</th>
                <th className="px-3 py-2 font-normal">Class</th>
                <th className="px-3 py-2 font-normal">Problems</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-4 py-2 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="zebra">
              {sessions.map((s) => (
                <SessionAdminRow key={s.id} session={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewSessionDialog open={creating} onClose={() => setCreating(false)} nextNumber={nextNumber} />
    </div>
  );
}

function SessionAdminRow({ session }: { session: SessionWithQuestions }) {
  const setStatus = useSetSessionStatus();
  const toast = useToast();
  const classCount = session.questions.filter((q) => q.kind === "class").length;
  const hwCount = session.questions.length - classCount;
  const published = session.status === "published";

  const toggle = async () => {
    try {
      await setStatus.mutateAsync({ id: session.id, status: published ? "draft" : "published" });
      toast.success(published ? `S${session.number} is back to draft` : `S${session.number} is live`, published ? "Students can no longer see it." : "Students can see it now.");
    } catch (error) {
      toast.error("Couldn't update", errorMessage(error));
    }
  };

  return (
    <tr className="hover:bg-surface-2/70">
      <td className="px-4 py-2.5 font-mono text-xs text-muted">S{session.number}</td>
      <td className="w-full max-w-0 px-3 py-2.5">
        <Link href={`/admin/sessions/${session.id}`} className="block truncate text-strong hover:text-accent">
          {session.title}
        </Link>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted">{formatWeekday(session.classDate)}</td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted">
        {classCount} class · {hwCount} hw
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={session.status} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant={published ? "ghost" : "secondary"}
            icon={published ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            onClick={toggle}
            loading={setStatus.isPending}
            disabled={!published && session.questions.length === 0}
            title={!published && session.questions.length === 0 ? "Add problems before publishing" : undefined}
          >
            {published ? "Unpublish" : "Publish"}
          </Button>
          <ButtonLink href={`/admin/sessions/${session.id}`} size="sm" variant="secondary" icon={<Pencil className="size-3.5" />}>
            Edit
          </ButtonLink>
        </div>
      </td>
    </tr>
  );
}

function NewSessionDialog({ open, onClose, nextNumber }: { open: boolean; onClose: () => void; nextNumber: number }) {
  const create = useCreateSession();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ number: "", title: "", classDate: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const values = { number: form.number || String(nextNumber), title: form.title, classDate: form.classDate || dayOffset(7) };

  const close = () => {
    setForm({ number: "", title: "", classDate: "" });
    setErrors({});
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = sessionSchema.safeParse({ ...values, description: "", recordingUrl: "", notesUrl: "" });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    try {
      const session = await create.mutateAsync(parsed.data);
      toast.success(`S${session.number} created as a draft`, "Add problems, then publish when ready.");
      close();
      router.push(`/admin/sessions/${session.id}`);
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    }
  };

  return (
    <Dialog open={open} onClose={close} title="New session" description="It stays a draft until you publish it." size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[96px_1fr] gap-3">
          <Field label="Number" htmlFor="ns-number" error={errors.number}>
            <Input
              id="ns-number"
              inputMode="numeric"
              value={values.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              className="font-mono"
            />
          </Field>
          <Field label="Class date" htmlFor="ns-date" error={errors.classDate}>
            <Input id="ns-date" type="date" value={values.classDate} onChange={(e) => setForm({ ...form, classDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Title" htmlFor="ns-title" error={errors.title}>
          <Input
            id="ns-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Recursion & Backtracking"
            autoFocus
          />
        </Field>
        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create draft
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
