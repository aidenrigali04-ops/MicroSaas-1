"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

const MAX_BYTES = 500 * 1024 * 1024;

export function UploadAndJobsPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = useCallback(async () => {
    setError(null);
    setJobId(null);
    setProgress(null);
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setError("Choose a video file first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large (max 500 MB).");
      return;
    }
    setBusy(true);
    try {
      const presign = await fetch(`${API}/api/v1/jobs/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      });
      const p = (await presign.json()) as {
        jobId?: string;
        uploadUrl?: string;
        method?: string;
        error?: string;
      };
      if (!presign.ok) {
        setError(p.error ?? `Presign failed (${presign.status})`);
        return;
      }
      if (!p.jobId || !p.uploadUrl) {
        setError("Invalid presign response");
        return;
      }

      if (p.method === "PUT") {
        setProgress("Uploading to storage…");
        const put = await fetch(p.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) {
          setError(`Upload failed (${put.status})`);
          return;
        }
        const done = await fetch(
          `${API}/api/v1/jobs/${p.jobId}/complete-upload`,
          { method: "POST" },
        );
        if (!done.ok) {
          setError("complete-upload failed");
          return;
        }
      } else {
        setProgress("Uploading…");
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch(p.uploadUrl, { method: "POST", body: fd });
        if (!up.ok) {
          setError(`Upload failed (${up.status})`);
          return;
        }
      }

      setJobId(p.jobId);
      setProgress(null);
      if (input) {
        input.value = "";
      }
    } catch {
      setError("Network error — is the API running?");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section
      className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/60 p-8 shadow-inner backdrop-blur-sm sm:p-10"
      aria-labelledby="upload-heading"
    >
      <div className="mx-auto max-w-xl text-center">
        <h2
          id="upload-heading"
          className="text-lg font-medium text-[var(--foreground)]"
        >
          Upload long-form video
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          MP4, MOV, or WebM — max 500 MB. Processing runs in the worker (FFmpeg +
          Whisper + clip detection).
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,audio/*"
          className="mt-6 block w-full text-sm text-[var(--muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-950"
        />
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPick()}
            className="inline-flex w-full items-center justify-center rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-gray-950 shadow-sm transition hover:bg-cyan-400 disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Working…" : "Upload & create job"}
          </button>
        </div>
        {progress ? (
          <p className="mt-4 text-sm text-cyan-400/90">{progress}</p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        {jobId ? (
          <p className="mt-6 text-sm text-[var(--foreground)]">
            Job created.{" "}
            <Link
              href={`/jobs/${jobId}`}
              className="font-medium text-cyan-400 underline-offset-4 hover:underline"
            >
              Open job →
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
