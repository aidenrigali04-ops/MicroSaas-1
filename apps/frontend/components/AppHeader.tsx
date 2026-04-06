import Link from "next/link";
import { ApiHealthLink } from "@/components/ApiHealthLink";
import { CreditsBar } from "@/components/CreditsBar";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        ClipForge
      </Link>
      <nav className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
        <span className="hidden sm:inline">Upload → process → export</span>
        <CreditsBar />
        <ApiHealthLink />
      </nav>
    </header>
  );
}
