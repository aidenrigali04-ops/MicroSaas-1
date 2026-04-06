import { jobs as jobsTable } from "@clipforge/db";
import { and, asc, eq } from "drizzle-orm";
import { getDb, initPostgres } from "@clipforge/db";
import { loadWorkerEnv } from "./env.js";
import { processJob } from "./processJob.js";

function nowIso() {
  return new Date().toISOString();
}

async function claimNextJob(db: ReturnType<typeof getDb>) {
  const [candidate] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.status, "queued"))
    .orderBy(asc(jobsTable.createdAt))
    .limit(1);
  if (!candidate) {
    return null;
  }
  const updated = await db
    .update(jobsTable)
    .set({
      status: "processing",
      stage: "Starting",
      updatedAt: nowIso(),
    })
    .where(
      and(eq(jobsTable.id, candidate.id), eq(jobsTable.status, "queued")),
    )
    .returning({ id: jobsTable.id });
  return updated[0]?.id ?? null;
}

const env = loadWorkerEnv();
await initPostgres(env.DATABASE_URL);
const db = getDb();

async function tick() {
  try {
    const id = await claimNextJob(db);
    if (id) {
      console.info("[worker] processing job", id);
      await processJob(db, id, env);
      console.info("[worker] finished job", id);
    }
  } catch (e) {
    console.error("[worker] tick error", e);
  }
}

async function main() {
  await tick();
  setInterval(tick, env.POLL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
