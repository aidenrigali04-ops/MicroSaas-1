export function ApiHealthLink() {
  const base =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:3001";
  const href = `${base}/health`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[var(--foreground)] transition hover:border-cyan-500/40"
    >
      API health
    </a>
  );
}
