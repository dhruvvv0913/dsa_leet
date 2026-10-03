import Link from "next/link";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

// The imaginati bird, traced from the logo (coordinates are in the original artwork's pixel space).
const BIRD = (
  <>
    <polygon points="437,210 337,355 437,410" fill="#6FCDD5" />
    <polygon points="437,210 540,355 437,410" fill="#2D66CF" />
    <polygon points="437,252 400,330 437,372" fill="#87D6DD" />
    <polygon points="437,252 474,330 437,372" fill="#4D84D7" />
    <polygon points="437,412 303,460 392,538" fill="#72C2F3" />
    <polygon points="303,460 392,538 347,627" fill="#7350DE" />
    <polygon points="437,412 572,460 487,538" fill="#3373BB" />
    <polygon points="572,460 487,538 527,627" fill="#4259F5" />
    <polygon points="437,412 404,458 418,497 456,497 470,458" fill="#E8F5FD" />
    <polygon points="437,414 404,458 419,472" fill="#9FD8F7" />
    <polygon points="437,414 470,458 455,472" fill="#76AEE1" />
  </>
);

const ORBIT = (
  <>
    <g strokeLinecap="round" strokeWidth="3" strokeOpacity="0.55">
      <line x1="262" y1="311" x2="330" y2="360" stroke="#93D3F7" />
      <line x1="612" y1="300" x2="545" y2="352" stroke="#8FDAE0" />
      <line x1="252" y1="552" x2="305" y2="502" stroke="#A58CE6" />
      <line x1="630" y1="548" x2="575" y2="502" stroke="#8694F4" />
    </g>
    <circle cx="437" cy="160" r="6" fill="#79A2DD" />
    <circle cx="238" cy="295" r="9" fill="#93D3F7" />
    <circle cx="640" cy="282" r="12" fill="#8FDAE0" />
    <circle cx="222" cy="572" r="7" fill="#A58CE6" />
    <circle cx="663" cy="566" r="8" fill="#8694F4" />
  </>
);

/** The logo mark. `detailed` adds the orbiting dots and lines from the full logo. */
export function LogoMark({ size = 28, detailed = false, className }: { size?: number; detailed?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={detailed ? "200 148 485 485" : "225 206 425 425"}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {detailed && ORBIT}
      {BIRD}
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-normal lowercase leading-none tracking-[0.14em] text-strong", className)}>
      {site.name}
    </span>
  );
}

/** Logo + name in the top bar. */
export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label={`${site.name} — ${site.product}`}>
      <LogoMark size={30} />
      <Wordmark className="text-[17px]" />
      <span className="hidden border-l border-border pl-2.5 text-xs font-medium text-muted md:inline">{site.product}</span>
    </Link>
  );
}

/** The full lockup for the sign-in page: bird, wordmark and tagline. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <LogoMark size={88} detailed className="-ml-3" />
      <div>
        <Wordmark className="block text-[32px]" />
        <span className="mt-2 block font-display text-[11px] lowercase tracking-[0.3em] text-muted">{site.tagline}</span>
      </div>
    </div>
  );
}
