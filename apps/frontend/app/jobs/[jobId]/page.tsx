import { JobDetailClient } from "@/components/JobDetailClient";

export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <JobDetailClient jobId={jobId} />;
}
