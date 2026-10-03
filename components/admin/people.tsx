"use client";

import { FileUp, MoreHorizontal, Search, Shield, ShieldOff, Trash2, UserPlus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAddPeople, usePeople, useRemovePerson, useSetRole, useViewer } from "@/lib/data/hooks";
import { parseEmailList } from "@/lib/emails";
import { timeAgo } from "@/lib/format";
import { profileUrl } from "@/lib/leetcode";
import type { Person, Role } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";

type Filter = "all" | "student" | "admin" | "pending";

export function PeopleView() {
  const { data: people, isPending, error } = usePeople();
  const { data: viewer } = useViewer();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const list = people ?? [];
    return {
      all: list.length,
      student: list.filter((p) => p.role === "student").length,
      admin: list.filter((p) => p.role === "admin").length,
      pending: list.filter((p) => !p.userId).length,
    };
  }, [people]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? [])
      .filter((p) => (filter === "all" ? true : filter === "pending" ? !p.userId : p.role === filter))
      .filter(
        (p) =>
          !q ||
          p.email.includes(q) ||
          p.fullName?.toLowerCase().includes(q) ||
          p.leetcodeUsername?.toLowerCase().includes(q),
      )
      .sort((a, b) => (a.role === b.role ? (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email) : a.role === "admin" ? -1 : 1));
  }, [people, query, filter]);

  return (
    <div className="space-y-5">
      <AdminHeader
        title="People"
        description={
          people
            ? `${counts.student} students · ${counts.admin} admins · ${counts.pending} haven't signed in yet`
            : "Who can sign in, and with what role."
        }
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setAdding(true)}>
            Add people
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or username"
            className="pl-8"
            aria-label="Search people"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter">
          {(
            [
              ["all", "All"],
              ["student", "Students"],
              ["admin", "Admins"],
              ["pending", "Not signed in"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                filter === value ? "bg-surface-2 text-strong" : "text-muted hover:text-strong",
              )}
            >
              {label}
              <span className="font-mono text-xs text-faint">{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-danger">{error.message}</p>
      ) : isPending ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-faint">
                <th className="px-4 py-2 font-normal">Person</th>
                <th className="px-3 py-2 font-normal">Role</th>
                <th className="px-3 py-2 font-normal">LeetCode</th>
                <th className="px-3 py-2 text-right font-normal">Solved</th>
                <th className="px-3 py-2 font-normal">Last active</th>
                <th className="w-12 px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="zebra">
              {visible.map((person) => (
                <PersonRow
                  key={person.email}
                  person={person}
                  isSelf={person.email === viewer?.email}
                  lastAdmin={person.role === "admin" && counts.admin <= 1}
                />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                    No one matches that.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AddPeopleDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function PersonRow({ person, isSelf, lastAdmin }: { person: Person; isSelf: boolean; lastAdmin: boolean }) {
  const setRole = useSetRole();
  const remove = useRemovePerson();
  const confirm = useConfirm();
  const toast = useToast();
  const signedIn = !!person.userId;
  const linkable = !!person.leetcodeUsername;

  const changeRole = async (role: Role) => {
    try {
      await setRole.mutateAsync({ email: person.email, role });
      toast.success(role === "admin" ? "Made admin" : "Changed to student", person.email);
    } catch (error) {
      toast.error("Couldn't change role", errorMessage(error));
    }
  };

  const removePerson = async () => {
    const ok = await confirm({
      title: "Remove access?",
      body: (
        <>
          <span className="font-mono text-text">{person.email}</span> will lose access on their next page load. Their
          submissions are kept, and you can add them back any time.
        </>
      ),
      confirmLabel: "Remove access",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(person.email);
      toast.info("Access removed", person.email);
    } catch (error) {
      toast.error("Couldn't remove", errorMessage(error));
    }
  };

  return (
    <tr className="hover:bg-surface-2/70">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Avatar name={person.fullName} email={person.email} src={person.avatarUrl} size={30} className={cn(!signedIn && "opacity-50")} />
          <div className="min-w-0">
            <p className={cn("truncate", signedIn ? "text-strong" : "text-muted")}>
              {person.fullName ?? <span className="italic text-faint">Not signed in yet</span>}
              {isSelf && <span className="ml-2 text-xs text-faint">(you)</span>}
            </p>
            <p className="truncate font-mono text-xs text-muted">{person.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {person.role === "admin" ? <Badge tone="accent">Admin</Badge> : <Badge>Student</Badge>}
      </td>
      <td className="px-3 py-2.5">
        {person.leetcodeUsername ? (
          linkable ? (
            <a
              href={profileUrl(person.leetcodeUsername)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-text hover:text-accent"
            >
              @{person.leetcodeUsername}
            </a>
          ) : (
            <span className="font-mono text-xs text-text">@{person.leetcodeUsername}</span>
          )
        ) : (
          <span className="text-xs text-faint">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs text-text tabular">{signedIn ? person.solvedCount : "—"}</td>
      <td className="px-3 py-2.5 text-xs text-muted">{signedIn ? timeAgo(person.lastActiveAt) : <span className="text-faint">Invited</span>}</td>
      <td className="px-3 py-2.5 text-right">
        <Menu
          trigger={({ toggle, open }) => (
            <button
              onClick={toggle}
              aria-expanded={open}
              aria-label={`Actions for ${person.email}`}
              className="rounded-md p-1.5 text-muted hover:bg-surface-3 hover:text-strong"
            >
              <MoreHorizontal className="size-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              {person.role === "student" ? (
                <MenuItem icon={<Shield />} onClick={() => (close(), changeRole("admin"))}>
                  Make admin
                </MenuItem>
              ) : (
                <MenuItem icon={<ShieldOff />} disabled={lastAdmin} onClick={() => (close(), changeRole("student"))}>
                  {lastAdmin ? "Last admin — can't demote" : "Change to student"}
                </MenuItem>
              )}
              <MenuDivider />
              <MenuItem icon={<Trash2 />} danger disabled={lastAdmin || isSelf} onClick={() => (close(), removePerson())}>
                {isSelf ? "Can't remove yourself" : "Remove access"}
              </MenuItem>
            </>
          )}
        </Menu>
      </td>
    </tr>
  );
}

const PLACEHOLDER = `aarav.sharma@gmail.com
diya.patel@gmail.com, kabir@gmail.com
…or paste a column straight from a spreadsheet`;

function AddPeopleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddPeople();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [role, setRole] = useState<Role>("student");
  const parsed = useMemo(() => parseEmailList(text), [text]);

  const close = () => {
    setText("");
    setRole("student");
    onClose();
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText((current) => (current.trim() ? `${current}\n${content}` : content));
  };

  const submit = async () => {
    if (!parsed.valid.length) return;
    try {
      const result = await add.mutateAsync({ emails: parsed.valid, role });
      const parts = [
        `${result.added.length} added`,
        result.existing.length ? `${result.existing.length} already on the list` : null,
        result.invalid.length || parsed.invalid.length ? `${result.invalid.length + parsed.invalid.length} invalid` : null,
      ].filter(Boolean);
      toast.success(result.added.length ? "People added" : "No new people", parts.join(" · "));
      close();
    } catch (error) {
      toast.error("Couldn't add people", errorMessage(error));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title="Add people"
      description="They can sign in with Google as soon as they're on the list."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!parsed.valid.length} loading={add.isPending}>
            Add {parsed.valid.length || ""} {role === "admin" ? "admin" : "student"}
            {parsed.valid.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Emails"
          htmlFor="emails"
          hint="One per line, or separated by commas. Gmail addresses match even if the dots differ."
        >
          <Textarea
            id="emails"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            className="min-h-40 font-mono text-xs"
            autoFocus
          />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Role" htmlFor="role" className="w-40">
            <Select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => loadFile(e.target.files?.[0])} />
          <Button icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
            Import CSV
          </Button>
        </div>
        {(parsed.valid.length > 0 || parsed.invalid.length > 0) && (
          <div className="rounded-md border border-border bg-bg/60 p-3">
            <p className="text-xs text-muted">
              <span className="text-success">{parsed.valid.length} valid</span>
              {parsed.invalid.length > 0 && (
                <>
                  {" · "}
                  <span className="text-danger">{parsed.invalid.length} invalid</span>
                </>
              )}
              <span className="text-faint"> · duplicates removed</span>
            </p>
            <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {parsed.valid.slice(0, 60).map((email) => (
                <span key={email} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-text">
                  {email}
                </span>
              ))}
              {parsed.invalid.map((email) => (
                <span key={email} className="rounded bg-danger/10 px-1.5 py-0.5 font-mono text-2xs text-danger line-through">
                  {email}
                </span>
              ))}
              {parsed.valid.length > 60 && <span className="text-2xs text-faint">+{parsed.valid.length - 60} more</span>}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
