import { jobs as jobsTable } from "@clipforge/db";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Env } from "../env.js";
import { getDb } from "../db.js";
import { getDataDir, getUploadRoot } from "../paths.js";
import { isS3Configured, presignGet, presignPut, publicUrlForKey } from "../lib/s3.js";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

function nowIso() {
  return new Date().toISOString();
}

export function registerJobRoutes(app: FastifyInstance, env: Env): void {
  app.post<{
    Body: { filename?: string; contentType?: string };
  }>("/api/v1/jobs/presign", async (request, reply) => {
    const filename = request.body?.filename ?? "upload.bin";
    const contentType = request.body?.contentType ?? "application/octet-stream";
    const jobId = randomUUID();
    const ext = path.extname(filename) || ".bin";
    const key = `jobs/${jobId}/original${ext}`;

    const db = getDb();
    await db.insert(jobsTable).values({
      id: jobId,
      status: "awaiting_upload",
      stage: "Waiting for upload",
      error: null,
      assetOriginalKey: key,
      mime: contentType,
      durationMs: null,
      transcriptJson: null,
      candidatesJson: null,
      clipsJson: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    if (isS3Configured(env)) {
      const uploadUrl = await presignPut(env, key, contentType);
      return reply.send({
        jobId,
        key,
        uploadUrl,
        method: "PUT" as const,
        headers: { "Content-Type": contentType },
      });
    }

    return reply.send({
      jobId,
      key,
      uploadUrl: `/api/v1/jobs/${jobId}/upload`,
      method: "POST" as const,
    });
  });

  app.post(`/api/v1/jobs/:jobId/upload`, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const db = getDb();
    const [row] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (!row) {
      return reply.status(404).send({ error: "not_found" });
    }
    if (isS3Configured(env)) {
      return reply.status(400).send({
        error: "use_presigned_upload",
        message: "Upload via S3 presigned PUT for this environment.",
      });
    }

    const data = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!data) {
      return reply.status(400).send({ error: "missing_file" });
    }

    const dir = path.join(getUploadRoot(env.LOCAL_UPLOAD_DIR), jobId);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, path.basename(row.assetOriginalKey));
    const buffer = await data.toBuffer();
    fs.writeFileSync(dest, buffer);

    await db
      .update(jobsTable)
      .set({
        status: "queued",
        stage: "Queued for processing",
        mime: data.mimetype,
        updatedAt: nowIso(),
      })
      .where(eq(jobsTable.id, jobId));

    return reply.send({ ok: true, jobId });
  });

  app.post<{
    Params: { jobId: string };
  }>("/api/v1/jobs/:jobId/complete-upload", async (request, reply) => {
    const { jobId } = request.params;
    const db = getDb();
    const [row] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (!row) {
      return reply.status(404).send({ error: "not_found" });
    }
    await db
      .update(jobsTable)
      .set({
        status: "queued",
        stage: "Queued for processing",
        updatedAt: nowIso(),
      })
      .where(eq(jobsTable.id, jobId));
    return reply.send({ ok: true, jobId });
  });

  app.get("/api/v1/jobs", async (_request, reply) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(jobsTable)
      .orderBy(desc(jobsTable.createdAt))
      .limit(50);
    return reply.send({ items: rows, nextCursor: null });
  });

  app.get<{
    Params: { jobId: string };
  }>("/api/v1/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params;
    const db = getDb();
    const [row] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (!row) {
      return reply.status(404).send({ error: "not_found" });
    }

    let downloadOriginal: string | null = null;
    if (isS3Configured(env)) {
      try {
        downloadOriginal = await presignGet(env, row.assetOriginalKey, 900);
      } catch (e) {
        app.log.warn(e, "presign get failed");
      }
    } else {
      const localPath = path.join(
        getUploadRoot(env.LOCAL_UPLOAD_DIR),
        jobId,
        path.basename(row.assetOriginalKey),
      );
      if (fs.existsSync(localPath)) {
        downloadOriginal = `/api/v1/jobs/${jobId}/file`;
      }
    }

    const publicBase = publicUrlForKey(env, row.assetOriginalKey);

    const clipPreviews: Record<string, string> = {};
    if (row.clipsJson) {
      try {
        const clips = JSON.parse(row.clipsJson) as {
          id: string;
          previewKey: string;
        }[];
        for (const c of clips) {
          if (isS3Configured(env)) {
            clipPreviews[c.id] = await presignGet(env, c.previewKey, 3600);
          } else {
            clipPreviews[c.id] = `/api/v1/artifacts/${encodeURIComponent(c.previewKey)}`;
          }
        }
      } catch {
        /* ignore */
      }
    }

    return reply.send({
      job: row,
      links: { downloadOriginal, publicOriginal: publicBase },
      clipPreviews,
    });
  });

  /** Local dev: stream original file from disk */
  app.get<{
    Params: { jobId: string };
  }>("/api/v1/jobs/:jobId/file", async (request, reply) => {
    const { jobId } = request.params;
    if (isS3Configured(env)) {
      return reply.status(404).send({ error: "not_found" });
    }
    const db = getDb();
    const [row] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (!row) {
      return reply.status(404).send({ error: "not_found" });
    }
    const localPath = path.join(
      getUploadRoot(env.LOCAL_UPLOAD_DIR),
      jobId,
      path.basename(row.assetOriginalKey),
    );
    if (!fs.existsSync(localPath)) {
      return reply.status(404).send({ error: "not_found" });
    }
    reply.type(row.mime ?? "application/octet-stream");
    return reply.send(fs.createReadStream(localPath));
  });

  app.post<{
    Params: { jobId: string };
    Body: { clipId?: string; platform?: string };
  }>("/api/v1/jobs/:jobId/regenerate-hook", async (request, reply) => {
    const { jobId } = request.params;
    const clipId = request.body?.clipId;
    const platform = request.body?.platform ?? "tiktok";
    if (!clipId) {
      return reply.status(400).send({ error: "clipId required" });
    }
    if (!env.OPENAI_API_KEY) {
      return reply.status(503).send({ error: "openai_not_configured" });
    }

    const db = getDb();
    const [row] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (!row?.clipsJson) {
      return reply.status(400).send({ error: "no_clips" });
    }

    type Clip = {
      id: string;
      startSec: number;
      endSec: number;
      transcript?: string;
      hooks?: unknown;
    };
    const clips = JSON.parse(row.clipsJson) as Clip[];
    const clip = clips.find((c) => c.id === clipId);
    if (!clip?.transcript) {
      return reply.status(404).send({ error: "clip_not_found" });
    }

    const { generateClipContent } = await import(
      "../services/contentGeneration.js"
    );
    const data = await generateClipContent({
      transcript: clip.transcript,
      platform,
      context: `Clip ${clip.startSec}s–${clip.endSec}s`,
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    });

    clip.hooks = data;
    await db
      .update(jobsTable)
      .set({ clipsJson: JSON.stringify(clips), updatedAt: nowIso() })
      .where(eq(jobsTable.id, jobId));

    return reply.send({ ok: true, data });
  });

  app.post<{
    Params: { jobId: string };
    Body: { clipIds?: string[] };
  }>("/api/v1/jobs/:jobId/export", async (request, reply) => {
    const { jobId } = request.params;
    const clipIds = request.body?.clipIds ?? [];
    const db = getDb();
    const [row] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    if (!row?.clipsJson) {
      return reply.status(400).send({ error: "no_clips" });
    }

    const { getCredits, spendCredits } = await import("../services/credits.js");
    const cost = clipIds.length || 1;
    const bal = await getCredits(db);
    if (bal < cost) {
      return reply.status(402).send({
        error: "insufficient_credits",
        balance: bal,
        required: cost,
      });
    }
    try {
      await spendCredits(db, cost);
    } catch {
      return reply.status(402).send({
        error: "insufficient_credits",
        balance: bal,
        required: cost,
      });
    }

    type Clip = {
      id: string;
      finalKey?: string;
      previewKey?: string;
      captionSrtKey?: string;
    };
    const clips = JSON.parse(row.clipsJson) as Clip[];
    const selected =
      clipIds.length > 0
        ? clips.filter((c) => clipIds.includes(c.id))
        : clips;

    const downloads: { clipId: string; url: string | null }[] = [];
    for (const c of selected) {
      const key = c.finalKey ?? c.previewKey;
      if (!key) {
        downloads.push({ clipId: c.id, url: null });
        continue;
      }
      if (isS3Configured(env)) {
        const url = await presignGet(env, key, 3600);
        downloads.push({ clipId: c.id, url });
      } else {
        downloads.push({
          clipId: c.id,
          url: `/api/v1/artifacts/${encodeURIComponent(key)}`,
        });
      }
    }

    const captionLinks: { clipId: string; url: string | null }[] = [];
    for (const c of selected) {
      if (!c.captionSrtKey) {
        captionLinks.push({ clipId: c.id, url: null });
        continue;
      }
      if (isS3Configured(env)) {
        const url = await presignGet(env, c.captionSrtKey, 3600);
        captionLinks.push({ clipId: c.id, url });
      } else {
        captionLinks.push({
          clipId: c.id,
          url: `/api/v1/artifacts/${encodeURIComponent(c.captionSrtKey)}`,
        });
      }
    }

    return reply.send({ ok: true, downloads, captionLinks });
  });

  app.get<{
    Params: { key: string };
  }>("/api/v1/artifacts/:key", async (request, reply) => {
    if (isS3Configured(env)) {
      return reply.status(404).send({ error: "not_found" });
    }
    const key = decodeURIComponent(request.params.key);
    const safe = key.replace(/\.\./g, "");
    const base = path.join(getDataDir(), "artifacts");
    const full = path.join(base, safe);
    if (!full.startsWith(base) || !fs.existsSync(full)) {
      return reply.status(404).send({ error: "not_found" });
    }
    return reply.send(fs.createReadStream(full));
  });
}
