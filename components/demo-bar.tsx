"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import type { DemoPersona } from "@/lib/data/client";
import { useData } from "@/lib/data/provider";
import { useViewer } from "@/lib/data/hooks";
import { isDemo } from "@/lib/site";
import { cn } from "@/lib/utils";

const PERSONAS: { value: DemoPersona; label: string; home: string }[] = [
  { value: "student", label: "Student", home: "/" },
  { value: "instructor", label: "Instructor", home: "/admin" },
  { value: "outsider", label: "Not enrolled", home: "/not-enrolled" },
];

/**
 * Thin strip shown only in preview mode (no database connected yet): who you're
 * viewing as, and a reset. It disappears once Supabase is configured.
 */
export function DemoBar({ className }: { className?: string }) {
  const data = useData();
  const qc = useQueryClient();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { data: viewer } = useViewer();
  const [busy, setBusy] = useState(false);

  if (!isDemo) return null;
  const persona = viewer ? (data.demoPersona?.() ?? null) : null;

  const switchTo = async (value: DemoPersona) => {
    setBusy(true);
    await data.setDemoPersona?.(value);
    qc.removeQueries();
    router.push(PERSONAS.find((p) => p.value === value)?.home ?? "/");
    setBusy(false);
  };

  const reset = async () => {
    const ok = await confirm({
      title: "Start fresh?",
      body: "This clears everything you uploaded or changed in this browser and goes back to a clean Day 1.",
      confirmLabel: "Start fresh",
    });
    if (!ok) return;
    setBusy(true);
    await data.resetDemo?.();
    qc.removeQueries();
    router.push(persona === "instructor" ? "/admin" : "/");
    toast.success("Back to a clean Day 1");
    setBusy(false);
  };

  return (
    <div className={cn("border-b border-accent/20 bg-accent/[0.06]", className)}>
      <div className="mx-auto flex min-h-9 max-w-6xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-1.5 text-xs sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-muted">
          <span className="rounded-sm bg-accent px-1.5 py-px font-mono text-2xs font-semibold uppercase tracking-wider text-accent-ink">
            Preview
          </span>
          <span className="truncate">Not connected to a database yet — changes stay in this browser.</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-faint sm:inline">Viewing as</span>
          <div className="flex rounded-md border border-border bg-surface p-0.5" role="radiogroup" aria-label="View as">
            {PERSONAS.map((p) => (
              <button
                key={p.value}
                role="radio"
                aria-checked={persona === p.value}
                disabled={busy}
                onClick={() => switchTo(p.value)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs transition-colors",
                  persona === p.value ? "bg-surface-3 text-strong" : "text-muted hover:text-strong",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={reset}
            disabled={busy}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-muted hover:bg-surface-2 hover:text-strong"
            title="Start fresh"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
