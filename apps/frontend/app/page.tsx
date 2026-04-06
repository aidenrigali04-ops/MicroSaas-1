import { AppHeader } from "@/components/AppHeader";
import { ContentGeneratorPanel } from "@/components/ContentGeneratorPanel";
import { UploadAndJobsPanel } from "@/components/UploadAndJobsPanel";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <AppHeader />
        <main className="mt-12 flex flex-1 flex-col gap-10">
          <section className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-widest text-cyan-400/90">
              Content multiplication engine
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn one recording into{" "}
              <span className="text-cyan-400">hook-ready clips</span>.
            </h1>
            <p className="max-w-2xl text-lg text-[var(--muted)]">
              Upload long-form video or audio. We detect strong moments, sharpen
              hooks, add captions, and format for short-form — so you ship faster,
              not edit longer.
            </p>
          </section>
          <ContentGeneratorPanel />
          <UploadAndJobsPanel />
        </main>
      </div>
    </div>
  );
}
