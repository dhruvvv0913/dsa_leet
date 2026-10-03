"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MailX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import { useViewer } from "@/lib/data/hooks";
import { useData } from "@/lib/data/provider";

export function NotEnrolledView() {
  const { data: viewer, isPending, refetch, isFetching } = useViewer();
  const data = useData();
  const qc = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!viewer) router.replace("/login");
    else if (viewer.enrolled) router.replace("/");
  }, [viewer, isPending, router]);

  const signOut = async () => {
    setBusy(true);
    await data.signOut();
    qc.removeQueries();
    router.replace("/login");
  };

  return (
    <AuthShell>
      <span className="flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger">
        <MailX className="size-5" />
      </span>
      <h1 className="font-display mt-5 text-xl font-semibold tracking-tight text-strong">This account isn&apos;t enrolled</h1>
      <div className="mt-4 rounded-md border border-border bg-surface px-3 py-2.5">
        <p className="text-xs text-faint">Signed in as</p>
        {viewer ? (
          <p className="mt-0.5 break-all font-mono text-sm text-strong">{viewer.email}</p>
        ) : (
          <Skeleton className="mt-1 h-5 w-56" />
        )}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Ask your instructor to add this exact email to the cohort, then try again. If you meant to use a different Google
        account, sign out and pick that one.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={signOut} loading={busy}>
          Sign out
        </Button>
        <Button variant="secondary" onClick={() => refetch()} loading={isFetching && !isPending}>
          I&apos;ve been added — try again
        </Button>
      </div>
    </AuthShell>
  );
}
