"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "center" | "drawer";
  className?: string;
}

const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl", xl: "max-w-4xl" };

/** Native <dialog>: focus trapping, Esc to close and inert background for free. */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", variant = "center", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const drawer = variant === "drawer";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 max-h-none bg-transparent p-0 backdrop:backdrop-blur-[1px]",
        drawer ? "ml-auto h-dvh w-full max-w-none sm:w-[560px]" : cn("mx-auto mt-[8vh] w-[calc(100%-32px)]", widths[size]),
      )}
    >
      {open ? (
        <div
          className={cn(
            "flex flex-col border border-border bg-surface text-text shadow-pop",
            drawer ? "h-full animate-slide-in border-y-0 border-r-0" : "max-h-[84vh] animate-pop rounded-lg",
            className,
          )}
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                {title && <h2 className="text-base font-semibold text-strong">{title}</h2>}
                {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
              </div>
              <button
                onClick={onClose}
                className="-mr-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-strong"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </div>
      ) : null}
    </dialog>
  );
}
