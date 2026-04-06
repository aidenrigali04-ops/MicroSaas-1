import { jobs as jobsTable } from "@clipforge/db";
import { eq } from "drizzle-orm";
import type { ClipforgeDb } from "@clipforge/db";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { cutClip, cutClipWithSubtitles, extractWav16kMono, ffprobeDuration } from "./ffmpeg.js";
import { generateHooksForSegment } from "./hooks.js";
import type { WorkerEnv } from "./env.js";
import {
  buildCandidates,
  buildSrtFromSegments,
  explainScore,
  type WhisperSeg,
  type WhisperWord,
} from "./segments.js";
import { defaultDataDir } from "./paths.js";

function uploadRoot(env: WorkerEnv): string {
  if (path.isAbsolute(env.LOCAL_UPLOAD_DIR)) {
    return env.LOCAL_UPLOAD_DIR;
  }
  return path.join(defaultDataDir(), env.LOCAL_UPLOAD_DIR.replace(/^\.\//, ""));
}

function artifactsRoot(env: WorkerEnv): string {
  if (path.isAbsolute(env.LOCAL_ARTIFACTS_DIR)) {
    return env.LOCAL_ARTIFACTS_DIR;
  }
  return path.join(defaultDataDir(), env.LOCAL_ARTIFACTS_DIR.replace(/^\.\//, ""));
}
import { downloadToFile, isS3Configured, uploadFile } from "./s3.js";

function nowIso() {
  return new Date().toISOString();
}

async function updateJob(
  db: ClipforgeDb,
  jobId: string,
  patch: Partial<{
    status: string;
    stage: string;
    error: string | null;
    durationMs: number | null;
    transcriptJson: string | null;
    candidatesJson: string | null;
    clipsJson: string | null;
  }>,
) {
  await db
    .update(jobsTable)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(jobsTable.id, jobId));
}

export async function processJob(
  db: ClipforgeDb,
  jobId: string,
  env: WorkerEnv,
): Promise<void> {
  const [row] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .limit(1);
  if (!row) {
    return;
  }

  const dataDir = defaultDataDir();
  const tmpDir = path.join(dataDir, "tmp", jobId);
  fs.mkdirSync(tmpDir, { recursive: true });

  let localVideo = path.join(
    uploadRoot(env),
    jobId,
    path.basename(row.assetOriginalKey),
  );

  try {
    await updateJob(db, jobId, {
      status: "processing",
      stage: "Downloading source",
      error: null,
    });

    if (isS3Configured(env)) {
      localVideo = path.join(tmpDir, path.basename(row.assetOriginalKey));
      await downloadToFile(env, row.assetOriginalKey, localVideo);
    } else if (!fs.existsSync(localVideo)) {
      throw new Error(`Missing upload file at ${localVideo}`);
    }

    await updateJob(db, jobId, { stage: "Analyzing duration" });
    const durationSec = await ffprobeDuration(localVideo);
    const durationMs = Math.round(durationSec * 1000);

    await updateJob(db, jobId, {
      stage: "Extracting audio for transcription",
      durationMs,
    });

    const wavPath = path.join(tmpDir, "audio.wav");
    await extractWav16kMono(localVideo, wavPath);

    await updateJob(db, jobId, { stage: "Transcribing (Whisper)" });
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavPath),
      model: env.OPENAI_WHISPER_MODEL,
      response_format: "verbose_json",
    });

    const tr = transcription as unknown as {
      text: string;
      segments?: WhisperSeg[];
      words?: WhisperWord[];
      duration?: number;
    };
    let segments = (tr.segments ?? []) as WhisperSeg[];
    if (segments.length === 0 && tr.text?.trim()) {
      segments = [
        { start: 0, end: durationSec, text: tr.text.trim() },
      ];
    }
    const words = tr.words;

    const transcriptPayload = {
      text: tr.text,
      segments,
      words: words ?? [],
      durationSec,
    };

    await updateJob(db, jobId, {
      stage: "Finding clip moments",
      transcriptJson: JSON.stringify(transcriptPayload),
    });

    const candidates = buildCandidates(segments, durationSec);
    await updateJob(db, jobId, {
      candidatesJson: JSON.stringify(candidates),
    });

    const artifactsDir = artifactsRoot(env);
    fs.mkdirSync(path.join(artifactsDir, jobId), { recursive: true });

    type ClipRow = {
      id: string;
      startSec: number;
      endSec: number;
      transcript: string;
      previewKey: string;
      finalKey: string;
      captionSrtKey: string;
      potentialScore: number;
      scoreReasons: string[];
      hooks?: unknown;
    };

    const clips: ClipRow[] = [];
    let i = 0;
    for (const c of candidates) {
      const clipId = randomUUID();
      const { potentialScore, scoreReasons } = explainScore(
        c.transcriptSnippet,
        c.endSec - c.startSec,
      );

      const srtBody = buildSrtFromSegments(segments, c.startSec, c.endSec);
      const srtPath = path.join(artifactsDir, jobId, `${clipId}.srt`);
      fs.writeFileSync(srtPath, srtBody, "utf8");

      const previewPath = path.join(artifactsDir, jobId, `${clipId}_preview.mp4`);
      const finalPath = path.join(artifactsDir, jobId, `${clipId}_final.mp4`);

      await updateJob(db, jobId, {
        stage: `Rendering clip ${i + 1} of ${candidates.length}`,
      });

      await cutClip(localVideo, c.startSec, c.endSec, previewPath);

      try {
        await cutClipWithSubtitles(
          localVideo,
          srtPath,
          c.startSec,
          c.endSec,
          finalPath,
        );
      } catch {
        await cutClip(localVideo, c.startSec, c.endSec, finalPath);
      }

      const previewKey = `artifacts/${jobId}/${clipId}_preview.mp4`;
      const finalKey = `artifacts/${jobId}/${clipId}_final.mp4`;
      const captionSrtKey = `artifacts/${jobId}/${clipId}.srt`;

      if (isS3Configured(env)) {
        await uploadFile(env, previewKey, previewPath, "video/mp4");
        await uploadFile(env, finalKey, finalPath, "video/mp4");
        await uploadFile(env, captionSrtKey, srtPath, "text/plain");
      }

      let hooks: unknown = undefined;
      if (i < 4) {
        await updateJob(db, jobId, {
          stage: `Writing hooks for clip ${i + 1}`,
        });
        try {
          hooks = await generateHooksForSegment(
            env,
            c.transcriptSnippet,
            "tiktok",
          );
        } catch {
          hooks = undefined;
        }
      }

      clips.push({
        id: clipId,
        startSec: c.startSec,
        endSec: c.endSec,
        transcript: c.transcriptSnippet,
        previewKey,
        finalKey,
        captionSrtKey,
        potentialScore,
        scoreReasons,
        hooks,
      });
      i++;
    }

    await updateJob(db, jobId, {
      status: "completed",
      stage: "Ready",
      clipsJson: JSON.stringify(clips),
      error: null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateJob(db, jobId, {
      status: "failed",
      stage: "Failed",
      error: msg,
    });
  }
}
