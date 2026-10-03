import type { ReactNode } from "react";
import { BrandLockup, LogoMark, Wordmark } from "@/components/brand";
import { DemoBar } from "@/components/demo-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { site } from "@/lib/site";

/** Minimal frame for the pages you see before getting into the app. */
export function AuthShell({ children, hero = false }: { children: ReactNode; hero?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-0.5 bg-brand-gradient" aria-hidden />
      <DemoBar />
      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <ThemeToggle className="absolute right-3 top-3" />
        <div className="w-full max-w-[420px]">
          {hero ? (
            <BrandLockup className="mb-10" />
          ) : (
            <div className="mb-8 flex items-center gap-2.5">
              <LogoMark size={34} />
              <Wordmark className="text-xl" />
            </div>
          )}
          {children}
        </div>
      </div>
      <p className="px-4 pb-6 text-center font-display text-[11px] lowercase tracking-[0.25em] text-faint">
        {site.name} · {site.tagline}
      </p>
    </div>
  );
}

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
