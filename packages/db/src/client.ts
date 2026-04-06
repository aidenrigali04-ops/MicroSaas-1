import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolves whether we run from `src/` (tsx) or `dist/` (node). */
export function getMigrationsFolder(): string {
  return path.join(__dirname, "..", "migrations");
}

export type ClipforgeDb = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let singleton: ClipforgeDb | null = null;
let urlUsed: string | null = null;

/**
 * Connect, run pending migrations, then expose the Drizzle instance.
 * Call once per process before getDb().
 */
export async function initPostgres(databaseUrl: string): Promise<ClipforgeDb> {
  const trimmed = databaseUrl.trim();
  if (singleton && urlUsed === trimmed) {
    return singleton;
  }
  if (client && urlUsed !== trimmed) {
    await client.end({ timeout: 5 });
    client = null;
    singleton = null;
  }

  const sql = postgres(trimmed, { max: 10 });
  const db = drizzle(sql, { schema });

  await migrate(db, { migrationsFolder: getMigrationsFolder() });

  client = sql;
  singleton = db;
  urlUsed = trimmed;
  return singleton;
}

export function getDb(): ClipforgeDb {
  if (!singleton) {
    throw new Error("Database not initialized — call initPostgres(DATABASE_URL) first");
  }
  return singleton;
}

export async function closePostgres(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    singleton = null;
    urlUsed = null;
  }
}
