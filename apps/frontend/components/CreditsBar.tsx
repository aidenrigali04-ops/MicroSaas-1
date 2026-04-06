"use client";

import { useCallback, useEffect, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

export function CreditsBar() {
  const [balance, setBalance] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/billing/credits`);
      const j = (await res.json()) as { balance?: number };
      if (res.ok && typeof j.balance === "number") {
        setBalance(j.balance);
      }
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (balance === null) {
    return null;
  }

  return (
    <span className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted)]">
      Credits: <span className="text-[var(--foreground)]">{balance}</span>
    </span>
  );
}
