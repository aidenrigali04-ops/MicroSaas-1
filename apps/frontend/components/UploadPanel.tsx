export function UploadPanel() {
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
          Drop a video to get started
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          MP4, MOV, or WebM — processing pipeline wires in next (detect → hook →
          captions → export).
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-gray-950 shadow-sm transition hover:bg-cyan-400 sm:w-auto"
            disabled
          >
            Choose file (coming soon)
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-transparent px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-cyan-500/40 sm:w-auto"
            disabled
          >
            Paste link (coming soon)
          </button>
        </div>
      </div>
    </section>
  );
}
