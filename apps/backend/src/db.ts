import { getDb, initPostgres, type ClipforgeDb } from "@clipforge/db";
import type { Env } from "./env.js";

export async function initDb(env: Env): Promise<void> {
  await initPostgres(env.DATABASE_URL);
}

export { getDb, type ClipforgeDb };
