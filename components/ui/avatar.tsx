import { cn, initials } from "@/lib/utils";

// Six brand-tinted swatches, defined per theme in globals.css (--avatar-0 … --avatar-5).
function tint(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `var(--avatar-${h % 6})`;
}

export function Avatar({
  name,
  email,
  src,
  size = 28,
  className,
}: {
  name: string | null;
  email?: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const label = name || email || "?";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-medium", className)}
      style={{ width: size, height: size, background: tint(label), color: "var(--avatar-ink)", fontSize: Math.max(10, size * 0.38) }}
    >
      {initials(name, (email ?? "?").slice(0, 1).toUpperCase())}
    </span>
  );
}
