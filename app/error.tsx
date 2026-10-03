"use client";

import { LogoMark } from "@/components/brand";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark size={32} />
      <h1 className="text-xl font-semibold tracking-tight text-strong">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted">{error.message || "An unexpected error happened."}</p>
      <button
        onClick={reset}
        className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
      >
        Try again
      </button>
    </div>
  );
}
