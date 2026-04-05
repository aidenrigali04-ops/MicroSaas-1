import Link from "next/link";
import { ApiHealthLink } from "@/components/ApiHealthLink";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        ClipForge
      </Link>
      <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
        <span className="hidden sm:inline">MVP: upload → clips → export</span>
        <ApiHealthLink />
      </nav>
    </header>
  );
}
