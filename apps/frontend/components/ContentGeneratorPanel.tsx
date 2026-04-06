"use client";

import { useCallback, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

const MIN_LEN = 20;
const MAX_LEN = 50_000;

type Platform = "tiktok" | "instagram_reels" | "youtube_shorts" | "linkedin";

type GenData = {
  hooks: { curiosity: string; authority: string; contrarian: string };
  caption: string;
  hashtags?: string[];
  editorNote?: string;
};

export function ContentGeneratorPanel() {
  const [transcript, setTranscript] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenData | null>(null);

  const onGenerate = useCallback(async () => {
    setError(null);
    setResult(null);
    if (transcript.trim().length < MIN_LEN) {
      setError(`Transcript must be at least ${MIN_LEN} characters.`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.slice(0, MAX_LEN),
          platform,
          context: context.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: GenData;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(
          json.message ??
            json.error ??
            `Request failed (${res.status})`,
        );
        return;
      }
      if (json.data) {
        setResult(json.data);
      }
    } catch {
      setError("Network error — is the API running?");
    } finally {
      setLoading(false);
    }
  }, [transcript, platform, context]);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 sm:p-8"
      aria-labelledby="gen-heading"
    >
      <h2
        id="gen-heading"
        className="text-lg font-medium text-[var(--foreground)]"
      >
        Text-first generation
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Paste a short segment (one clip idea) for best results — not a full
        hour-long transcript.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-[var(--muted)]">
            Transcript ({transcript.length}/{MAX_LEN})
          </span>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            maxLength={MAX_LEN}
            placeholder="Paste transcript text from your recording…"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-cyan-500/30 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">
            Platform
          </span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="tiktok">TikTok</option>
            <option value="instagram_reels">Instagram Reels</option>
            <option value="youtube_shorts">YouTube Shorts</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">
            Extra context (optional)
          </span>
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Speaker, episode title, niche…"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void onGenerate()}
          className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-gray-950 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate hooks + caption"}
        </button>
      </div>
      {error ? (
        <p
          className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="mt-6 space-y-4 border-t border-[var(--border)] pt-6">
          {(["curiosity", "authority", "contrarian"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-cyan-400/90">
                  {k} hook
                </span>
                <button
                  type="button"
                  onClick={() => copy(result.hooks[k])}
                  className="text-xs text-[var(--muted)] hover:text-cyan-400"
                >
                  Copy
                </button>
              </div>
              <p className="mt-2 text-sm text-[var(--foreground)]">
                {result.hooks[k]}
              </p>
            </div>
          ))}
          <div className="rounded-lg border border-[var(--border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--muted)]">
                Caption
              </span>
              <button
                type="button"
                onClick={() => copy(result.caption)}
                className="text-xs text-[var(--muted)] hover:text-cyan-400"
              >
                Copy
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--foreground)]">
              {result.caption}
            </p>
          </div>
          {result.hashtags?.length ? (
            <p className="text-sm text-[var(--muted)]">
              {result.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
            </p>
          ) : null}
          {result.editorNote ? (
            <p className="text-xs text-[var(--muted)]">{result.editorNote}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
