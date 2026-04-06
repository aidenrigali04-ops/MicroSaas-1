import path from "node:path";

export function getDataDir(): string {
  const c = process.cwd().replace(/\\/g, "/");
  if (c.endsWith("/apps/backend") || c.endsWith("/apps/worker")) {
    return path.resolve(c, "..", "..", "data");
  }
  return path.join(process.cwd(), "data");
}

export function getUploadRoot(localUploadDir: string): string {
  if (path.isAbsolute(localUploadDir)) {
    return localUploadDir;
  }
  return path.join(getDataDir(), localUploadDir.replace(/^\.\//, ""));
}
