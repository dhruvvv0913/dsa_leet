"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface MenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

/**
 * Small popover menu, rendered in a portal with fixed positioning so it never gets
 * clipped by scrolling tables. Flips upward near the bottom of the screen.
 */
export function Menu({ trigger, children, align = "right", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const height = menuRef.current.offsetHeight;
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
    setStyle(
      align === "right"
        ? { top, right: Math.max(8, window.innerWidth - rect.right) }
        : { top, left: Math.max(8, rect.left) },
    );
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="relative inline-flex">
      {trigger({
        open,
        toggle: () => {
          setStyle({ visibility: "hidden" });
          setOpen((v) => !v);
        },
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", ...style }}
            className={cn(
              "z-50 min-w-48 animate-pop rounded-lg border border-border bg-surface-2 p-1 text-left shadow-pop",
              className,
            )}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  icon,
  danger,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm disabled:pointer-events-none disabled:opacity-40",
        danger ? "text-danger hover:bg-danger/10" : "text-text hover:bg-surface-3 hover:text-strong",
      )}
    >
      {icon && <span className="text-muted [&>svg]:size-4">{icon}</span>}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-border" />;
}
