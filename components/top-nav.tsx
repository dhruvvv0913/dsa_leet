"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Shield, Trophy, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { useData } from "@/lib/data/provider";
import type { Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex h-12 items-center px-2.5 text-sm transition-colors",
        active ? "text-strong" : "text-muted hover:text-strong",
      )}
    >
      {children}
      {active && <span className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-accent" />}
    </Link>
  );
}

export function TopNav({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const router = useRouter();
  const data = useData();
  const qc = useQueryClient();
  const isAdmin = viewer.role === "admin";

  const signOut = async () => {
    await data.signOut();
    qc.removeQueries();
    router.replace("/login");
  };

  const inAdmin = pathname.startsWith("/admin");
  const inProfile = pathname.startsWith("/profile");
  const inLeaderboard = pathname.startsWith("/leaderboard");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Brand />
        <nav className="ml-auto flex items-center sm:ml-6" aria-label="Main">
          <NavLink href="/" active={!inAdmin && !inProfile && !inLeaderboard}>
            Sessions
          </NavLink>
          <NavLink href="/leaderboard" active={inLeaderboard}>
            <span className="hidden sm:inline">Leaderboard</span>
            <Trophy className="size-4 sm:hidden" aria-label="Leaderboard" />
          </NavLink>
          {isAdmin && (
            <NavLink href="/admin" active={inAdmin}>
              Admin
            </NavLink>
          )}
          <NavLink href="/profile" active={inProfile}>
            <span className="hidden sm:inline">Profile</span>
            <User className="size-4 sm:hidden" aria-label="Profile" />
          </NavLink>
        </nav>
        <div className="ml-1 flex items-center gap-1 sm:ml-auto">
          <ThemeToggle />
          <Menu
            trigger={({ toggle, open }) => (
              <button
                onClick={toggle}
                aria-expanded={open}
                aria-label="Account menu"
                className="flex items-center gap-1 rounded-full p-0.5 pr-1 text-muted hover:bg-surface-2 hover:text-strong"
              >
                <Avatar name={viewer.fullName} email={viewer.email} src={viewer.avatarUrl} size={28} />
                <ChevronDown className="hidden size-3.5 sm:block" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 py-2">
                  <p className="truncate text-sm font-medium text-strong">{viewer.fullName ?? "Signed in"}</p>
                  <p className="truncate font-mono text-xs text-muted">{viewer.email}</p>
                  {viewer.leetcodeUsername && (
                    <p className="mt-0.5 truncate font-mono text-xs text-faint">@{viewer.leetcodeUsername}</p>
                  )}
                </div>
                <MenuDivider />
                <MenuItem icon={<User />} onClick={() => (close(), router.push("/profile"))}>
                  Profile
                </MenuItem>
                {isAdmin && (
                  <MenuItem icon={<Shield />} onClick={() => (close(), router.push("/admin"))}>
                    Admin
                  </MenuItem>
                )}
                <MenuDivider />
                <MenuItem icon={<LogOut />} onClick={() => (close(), signOut())}>
                  Sign out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  );
}
