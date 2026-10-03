import type { ReactNode } from "react";
import type { Difficulty, SessionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "info" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-3/70 text-muted",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  danger: "bg-danger/15 text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-2xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  return status === "published" ? (
    <Badge tone="success">
      <span className="size-1.5 rounded-full bg-success" aria-hidden />
      Published
    </Badge>
  ) : (
    <Badge tone="neutral">
      <span className="size-1.5 rounded-full border border-muted" aria-hidden />
      Draft
    </Badge>
  );
}

const difficultyColor: Record<Difficulty, string> = {
  Easy: "text-easy",
  Medium: "text-medium",
  Hard: "text-hard",
};

export function DifficultyText({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return <span className={cn("text-sm font-medium", difficultyColor[difficulty], className)}>{difficulty}</span>;
}

export function KindLabel({ kind }: { kind: "class" | "homework" }) {
  return <span className="font-mono text-2xs uppercase tracking-wide text-faint">{kind === "class" ? "Classwork" : "Homework"}</span>;
}
