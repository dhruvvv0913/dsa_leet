"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, ImageUp, Radio } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell, GoogleMark } from "@/components/auth-shell";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/lib/data/hooks";
import { useData } from "@/lib/data/provider";
import { isDemo, site } from "@/lib/site";
import { errorMessage } from "@/lib/utils";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

const FEATURES = [
  { icon: Radio, title: "Live sessions", body: "Recordings and notes after every class." },
  { icon: BookOpenCheck, title: "Hand-picked problems", body: "Classwork and homework sets, one click to LeetCode." },
  { icon: ImageUp, title: "Proof of work", body: "One screenshot per problem. Progress at a glance." },
];

export function LoginView() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const failed = params.get("error");
  const data = useData();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { data: viewer } = useViewer();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (viewer) router.replace(viewer.enrolled ? next : "/not-enrolled");
  }, [viewer, next, router]);

  const signIn = async () => {
    setBusy(true);
    try {
      await data.signInWithGoogle(next);
      if (isDemo) {
        qc.removeQueries();
        router.replace(next);
      }
      // Real mode: the browser is now on its way to Google.
    } catch (error) {
      toast.error("Couldn't start sign-in", errorMessage(error));
      setBusy(false);
    }
  };

  const exploreAsInstructor = async () => {
    setBusy(true);
    await data.setDemoPersona?.("instructor");
    qc.removeQueries();
    router.replace("/admin");
  };

  return (
    <AuthShell hero>
      <p className="font-mono text-2xs uppercase tracking-wider text-accent">{site.product}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-strong">Sign in to your cohort</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{site.description}</p>

      {failed && (
        <p className="mt-5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          Sign-in didn&apos;t complete. Please try again.
        </p>
      )}

      <button
        onClick={signIn}
        disabled={busy}
        className="mt-7 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[var(--gbtn-border)] bg-[var(--gbtn-bg)] text-sm font-medium text-[var(--gbtn-text)] shadow-card transition-colors hover:bg-[var(--gbtn-hover)] disabled:opacity-70"
      >
        {busy ? <Spinner className="size-4" /> : <GoogleMark className="size-[18px]" />}
        Continue with Google
      </button>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        Invite-only. Use the Google account your instructor enrolled.
      </p>

      {isDemo && (
        <div className="mt-5 rounded-md border border-accent/25 bg-accent/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted">
          <span className="font-medium text-accent">Preview mode.</span> Google sign-in switches on once the database is
          connected. For now you&apos;ll continue as a student, or{" "}
          <button onClick={exploreAsInstructor} disabled={busy} className="text-text underline underline-offset-2 hover:text-strong">
            open the instructor view
          </button>
          .
        </div>
      )}

      <ul className="mt-10 space-y-3.5 border-t border-border pt-6">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-muted">
              <Icon className="size-4" />
            </span>
            <span className="text-sm">
              <span className="text-strong">{title}</span>
              <span className="block text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </AuthShell>
  );
}
