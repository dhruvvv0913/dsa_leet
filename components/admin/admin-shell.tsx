"use client";

import { BookCopy, CalendarCheck, Grid3x3, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/people", label: "People", icon: Users },
  { href: "/admin/sessions", label: "Sessions", icon: BookCopy },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/admin/submissions", label: "Submissions", icon: Grid3x3 },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <nav
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
        aria-label="Admin sections"
      >
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-3 pb-2.5 pt-1 text-sm transition-colors",
                active ? "text-strong" : "text-muted hover:text-strong",
              )}
            >
              <Icon className="size-4" />
              {label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export function AdminHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-tight text-strong">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
