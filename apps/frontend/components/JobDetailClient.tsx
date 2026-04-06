"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

type JobRow = {
  id: string;
  status: string;
  stage: string;
  error: string | null;
  transcriptJson: string | null;
  candidatesJson: string | null;
  clipsJson: string | null;
};

type Clip = {
  id: string;
  startSec: number;
  endSec: number;
  transcript: string;
  previewKey: string;
  finalKey: string;
  captionSrtKey: string;
  potentialScore: number;
  scoreReasons: string[];
  hooks?: unknown;
};

export function JobDetailClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobRow | null>(null);
  const [downloadOriginal, setDownloadOriginal] = useState<string | null>(null);
  const [clipPreviews, setClipPreviews] = useState<Record<string, string>>({});
  const [clips, setClips] = useState<Clip[]>([]);
  const [shortlist, setShortlist] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [exportLinks, setExportLinks] = useState<
    { clipId: string; url: string | null }[] | null
  >(null);
  const [captionLinks, setCaptionLinks] = useState<
    { clipId: string; url: string | null }[] | null
  >(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/jobs/${jobId}`);
      const j = (await res.json()) as {
        job?: JobRow;
        links?: { downloadOriginal?: string | null };
        clipPreviews?: Record<string, string>;
        error?: string;
      };
      if (!res.ok) {
        setError(j.error ?? "Failed to load job");
        return;
      }
      if (j.job) {
        setJob(j.job);
        const dl = j.links?.downloadOriginal ?? null;
        setDownloadOriginal(
          dl && !dl.startsWith("http") ? `${API}${dl}` : dl,
        );
        setClipPreviews(j.clipPreviews ?? {});
        if (j.job.clipsJson) {
          try {
            setClips(JSON.parse(j.job.clipsJson) as Clip[]);
          } catch {
            setClips([]);
          }
        } else {
          setClips([]);
        }
      }
    } catch {
      setError("Network error");
    }
  }, [jobId]);

  useEffect(() => {
    void poll();
    const t = setInterval(() => void poll(), 3000);
    return () => clearInterval(t);
  }, [poll]);

  const toggleShort = (id: string) => {
    setShortlist((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  };

  const previewUrl = (clip: Clip) => {
    const presigned = clipPreviews[clip.id];
    if (presigned) {
      return presigned;
    }
    return `${API}/api/v1/artifacts/${encodeURIComponent(clip.previewKey)}`;
  };

  const onExport = async () => {
    setExportErr(null);
    setExportLinks(null);
    setCaptionLinks(null);
    const ids = [...shortlist];
    const res = await fetch(`${API}/api/v1/jobs/${jobId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clipIds: ids.length ? ids : undefined,
      }),
    });
    const j = (await res.json()) as {
      downloads?: { clipId: string; url: string | null }[];
      captionLinks?: { clipId: string; url: string | null }[];
      error?: string;
      balance?: number;
      required?: number;
    };
    if (res.status === 402) {
      setExportErr(
        `Not enough credits (have ${j.balance ?? 0}, need ${j.required ?? 1}).`,
      );
      return;
    }
    if (!res.ok) {
      setExportErr(j.error ?? "Export failed");
      return;
    }
    setExportLinks(j.downloads ?? []);
    setCaptionLinks(j.captionLinks ?? []);
  };

  const onCheckout = async () => {
    const res = await fetch(`${API}/api/v1/billing/checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: 10 }),
    });
    const j = (await res.json()) as { url?: string; error?: string };
    if (j.url) {
      window.location.href = j.url;
    }
  };

  const onRegen = async (clipId: string) => {
    await fetch(`${API}/api/v1/jobs/${jobId}/regenerate-hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId, platform: "tiktok" }),
    });
    void poll();
  };

  if (error && !job) {
    return (
      <div className="p-8 text-red-300">
        {error}{" "}
        <Link href="/" className="text-cyan-400 underline">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-cyan-400 hover:underline">
          ← Home
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Job {jobId}</h1>
        {job ? (
          <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            <p>
              Status:{" "}
              <span className="text-[var(--foreground)]">{job.status}</span>
            </p>
            <p>
              Stage:{" "}
              <span className="text-[var(--foreground)]">{job.stage}</span>
            </p>
            {job.error ? (
              <p className="text-red-300">Error: {job.error}</p>
            ) : null}
            {downloadOriginal ? (
              <a
                href={downloadOriginal}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 underline"
              >
                Download original
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-[var(--muted)]">Loading…</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void onExport()}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-gray-950"
          >
            Export (uses credits)
          </button>
          <button
            type="button"
            onClick={() => void onCheckout()}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            Buy credits (Stripe)
          </button>
        </div>
        {exportErr ? (
          <p className="mt-2 text-sm text-amber-200">{exportErr}</p>
        ) : null}
        {exportLinks ? (
          <ul className="mt-4 space-y-2 text-sm">
            {exportLinks.map((d) => (
              <li key={d.clipId}>
                {d.url ? (
                  <a
                    href={
                      d.url.startsWith("http")
                        ? d.url
                        : `${API}${d.url}`
                    }
                    className="text-cyan-400 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download clip {d.clipId.slice(0, 8)}…
                  </a>
                ) : (
                  <span className="text-[var(--muted)]">No file for {d.clipId}</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {captionLinks?.length ? (
          <ul className="mt-2 space-y-2 text-sm text-[var(--muted)]">
            <li className="font-medium text-[var(--foreground)]">Captions (SRT)</li>
            {captionLinks.map((d) => (
              <li key={`cap-${d.clipId}`}>
                {d.url ? (
                  <a
                    href={
                      d.url.startsWith("http")
                        ? d.url
                        : `${API}${d.url}`
                    }
                    className="text-cyan-400 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    SRT {d.clipId.slice(0, 8)}…
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <h2 className="mt-10 text-lg font-medium text-[var(--foreground)]">
          Clips
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Potential score is an estimate from pacing and language cues — not a
          guarantee of performance.
        </p>
        <div className="mt-4 space-y-8">
          {clips.map((c) => (
            <article
              key={c.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)]/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-cyan-400/90">
                    Potential score: {c.potentialScore}
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs text-[var(--muted)]">
                    {c.scoreReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {c.startSec.toFixed(1)}s – {c.endSec.toFixed(1)}s
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={shortlist.has(c.id)}
                    onChange={() => toggleShort(c.id)}
                  />
                  Shortlist
                </label>
              </div>
              <video
                src={previewUrl(c)}
                controls
                className="mt-4 max-h-80 w-full rounded-lg bg-black"
              />
              <p className="mt-3 text-sm text-[var(--foreground)]">
                {c.transcript}
              </p>
              <button
                type="button"
                onClick={() => void onRegen(c.id)}
                className="mt-3 text-xs text-cyan-400 underline"
              >
                Regenerate hooks (TikTok tone)
              </button>
            </article>
          ))}
        </div>
        {clips.length === 0 && job?.status === "completed" ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No clips produced.</p>
        ) : null}
      </div>
    </div>
  );
}
