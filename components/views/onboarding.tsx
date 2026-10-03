"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { useUpdateProfile, useViewer } from "@/lib/data/hooks";
import { profileUrl } from "@/lib/leetcode";
import { firstName, errorMessage } from "@/lib/utils";
import { leetcodeUsernameSchema } from "@/lib/validators";

export function LeetCodeUsernameInput({
  value,
  onChange,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div
      className="flex h-10 items-center overflow-hidden rounded-md border border-border bg-surface-2 transition-colors focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20 aria-[invalid=true]:border-danger/70"
      aria-invalid={invalid}
    >
      <span className="select-none border-r border-border px-3 font-mono text-xs text-faint">leetcode.com/u/</span>
      <input
        id="leetcode-username"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/^@/, "").replace(/\s/g, ""))}
        placeholder="your_username"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-strong placeholder:text-faint focus:outline-none"
      />
    </div>
  );
}

export function OnboardingView() {
  const { data: viewer, isPending } = useViewer();
  const update = useUpdateProfile();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!viewer) router.replace("/login");
    else if (!viewer.enrolled) router.replace("/not-enrolled");
    else if (viewer.leetcodeUsername || viewer.role === "admin") router.replace("/");
  }, [viewer, isPending, router]);

  const parsed = leetcodeUsernameSchema.safeParse(username);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the username");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync(parsed.data);
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const name = firstName(viewer?.fullName);

  return (
    <AuthShell>
      <p className="font-mono text-2xs uppercase tracking-wider text-accent">One last step</p>
      <h1 className="font-display mt-2 text-xl font-semibold tracking-tight text-strong">
        {name ? `Welcome, ${name}.` : "Welcome."} What&apos;s your LeetCode username?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        It goes on your profile so your instructor can match your work. You can change it later.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <LeetCodeUsernameInput value={username} onChange={setUsername} invalid={!!error} autoFocus />
        {error ? (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        ) : parsed.success ? (
          <a
            href={profileUrl(parsed.data)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-strong"
          >
            Check it&apos;s you: <span className="font-mono text-text">leetcode.com/u/{parsed.data}</span>
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <p className="text-xs text-faint">Don&apos;t have one yet? Create a free account on leetcode.com first.</p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={update.isPending} disabled={!username}>
          Continue
        </Button>
      </form>
    </AuthShell>
  );
}
