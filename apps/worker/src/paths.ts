import path from "node:path";

/** Shared DB/artifacts layout when running from apps/backend or apps/worker. */
export function defaultDataDir(): string {
  const c = process.cwd().replace(/\\/g, "/");
  if (c.endsWith("/apps/backend") || c.endsWith("/apps/worker")) {
    return path.resolve(c, "..", "..", "data");
  }
  return path.join(process.cwd(), "data");
}
