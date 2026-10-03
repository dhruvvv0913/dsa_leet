import Link from "next/link";
import { LogoMark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark size={32} />
      <p className="font-mono text-sm text-faint">404</p>
      <h1 className="text-xl font-semibold tracking-tight text-strong">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-muted">The link might be old, or the session hasn&apos;t been published yet.</p>
      <Link href="/" className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover">
        Back to sessions
      </Link>
    </div>
  );
}
