"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { DemoBar } from "@/components/demo-bar";
import { TopNav } from "@/components/top-nav";
import { Skeleton } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useViewer } from "@/lib/data/hooks";
import type { Viewer } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

/** Where should this viewer be sent instead of the app? null = they may stay. */
export function redirectFor(viewer: Viewer | null | undefined, pathname: string): string | null {
  if (!viewer) return `/login?next=${encodeURIComponent(pathname)}`;
  if (!viewer.enrolled) return "/not-enrolled";
  if (viewer.role !== "admin" && !viewer.leetcodeUsername) return "/onboarding";
  if (pathname.startsWith("/admin") && viewer.role !== "admin") return "/";
  return null;
}

/**
 * Client-side gate for the signed-in app. This is only for a smooth UX — the real
 * enforcement is Row Level Security in the database (or the demo client's checks).
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { data: viewer, isPending, error, refetch } = useViewer();
  const pathname = usePathname();
  const router = useRouter();
  const target = isPending || error ? null : redirectFor(viewer, pathname);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-medium text-strong">Couldn&apos;t reach the server</p>
        <p className="text-sm text-muted">{errorMessage(error)}</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  if (isPending || target || !viewer) return <ShellSkeleton />;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-0.5 bg-brand-gradient" aria-hidden />
      <DemoBar />
      <TopNav viewer={viewer} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">{children}</main>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-8 sm:px-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
