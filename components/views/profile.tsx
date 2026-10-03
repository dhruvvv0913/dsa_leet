"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LeetCodeUsernameInput } from "@/components/views/onboarding";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useMySubmissions, useSessions, useUpdateProfile, useViewer } from "@/lib/data/hooks";
import { useData } from "@/lib/data/provider";
import { profileUrl } from "@/lib/leetcode";
import { doneSet, overallProgress, sessionProgress } from "@/lib/progress";
import { errorMessage } from "@/lib/utils";
import { leetcodeUsernameSchema } from "@/lib/validators";

export function ProfileView() {
  const { data: viewer } = useViewer();
  const sessions = useSessions();
  const mine = useMySubmissions();
  const update = useUpdateProfile();
  const data = useData();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!sessions.data || !mine.data) return null;
    const done = doneSet(mine.data);
    const published = sessions.data.filter((s) => s.status === "published");
    return {
      overall: overallProgress(published, done),
      completed: published.filter((s) => sessionProgress(s, done).complete).length,
      sessions: published.length,
    };
  }, [sessions.data, mine.data]);

  if (!viewer) return <Skeleton className="h-96" />;

  const username = draft ?? viewer.leetcodeUsername ?? "";
  const changed = username !== (viewer.leetcodeUsername ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leetcodeUsernameSchema.safeParse(username);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the username");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync(parsed.data);
      setDraft(null);
      toast.success("LeetCode username saved");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const signOut = async () => {
    await data.signOut();
    qc.removeQueries();
    router.replace("/login");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-4">
        <Avatar name={viewer.fullName} email={viewer.email} src={viewer.avatarUrl} size={56} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display truncate text-xl font-semibold tracking-tight text-strong">{viewer.fullName ?? "Your profile"}</h1>
            {viewer.role === "admin" && <Badge tone="accent">Admin</Badge>}
          </div>
          <p className="truncate font-mono text-sm text-muted">{viewer.email}</p>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-strong">LeetCode username</h2>
        <p className="mt-1 text-sm text-muted">
          Shown to your instructor next to your submissions. &ldquo;Open&rdquo; links use whichever LeetCode account is signed in on
          your browser.
        </p>
        <form onSubmit={save} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <LeetCodeUsernameInput value={username} onChange={(v) => setDraft(v)} invalid={!!error} />
          </div>
          <Button type="submit" variant={changed ? "primary" : "secondary"} size="lg" disabled={!changed} loading={update.isPending}>
            Save
          </Button>
        </form>
        {error ? (
          <p className="mt-2 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : viewer.leetcodeUsername ? (
          <a
            href={profileUrl(viewer.leetcodeUsername)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-strong"
          >
            View on LeetCode <ExternalLink className="size-3" />
          </a>
        ) : null}
      </section>

      {viewer.role !== "admin" && (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-strong">Your progress</h2>
          {!stats ? (
            <Skeleton className="mt-4 h-16" />
          ) : (
            <>
              <div className="mt-4 flex items-center gap-4">
                <span className="shrink-0 text-sm text-muted">
                  <span className="text-2xl font-semibold text-strong">{stats.overall.solved}</span> / {stats.overall.total} solved
                </span>
                <Meter value={stats.overall.solved} max={stats.overall.total} />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
                <Stat label="Sessions finished" value={`${stats.completed}/${stats.sessions}`} />
                {(["Easy", "Medium", "Hard"] as const)
                  .filter((d) => stats.overall.byDifficulty[d].total > 0)
                  .map((d) => (
                    <Stat key={d} label={d} value={`${stats.overall.byDifficulty[d].done}/${stats.overall.byDifficulty[d].total}`} />
                  ))}
              </dl>
            </>
          )}
        </section>
      )}

      <section className="flex items-center justify-between rounded-lg border border-border bg-surface p-5">
        <div>
          <h2 className="text-sm font-semibold text-strong">Sign out</h2>
          <p className="mt-1 text-sm text-muted">You&apos;ll need your Google account to get back in.</p>
        </div>
        <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={signOut}>
          Sign out
        </Button>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-strong tabular">{value}</dd>
    </div>
  );
}
