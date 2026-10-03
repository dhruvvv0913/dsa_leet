import { cn } from "@/lib/utils";

/**
 * Progress meter. The fill is the accent; the unfilled track is a faint step of the
 * same hue so the whole bar reads as one quantity. A finished meter turns green.
 */
export function Meter({
  value,
  max,
  className,
  size = "md",
  label,
}: {
  value: number;
  max: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const complete = max > 0 && value >= max;
  const height = size === "sm" ? "h-1" : size === "lg" ? "h-2" : "h-1.5";
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full", height, complete ? "bg-success/20" : "bg-accent/15", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", complete ? "bg-success" : "bg-accent")}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
