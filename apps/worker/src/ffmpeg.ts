import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "node:fs";

const ffmpegBin =
  typeof ffmpegStatic === "string"
    ? ffmpegStatic
    : (ffmpegStatic as { default?: string } | null)?.default ?? null;
if (ffmpegBin) {
  ffmpeg.setFfmpegPath(ffmpegBin);
}

export function ffprobeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err: Error | null, data: { format?: { duration?: number | string } }) => {
      if (err) {
        reject(err);
        return;
      }
      const d = data.format?.duration;
      resolve(typeof d === "number" ? d : Number(d) || 0);
    });
  });
}

export function extractWav16kMono(input: string, outputWav: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(16000)
      .format("wav")
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputWav);
  });
}

export function cutClip(
  input: string,
  startSec: number,
  endSec: number,
  outputMp4: string,
): Promise<void> {
  const dur = Math.max(0.5, endSec - startSec);
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(startSec)
      .setDuration(dur)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset", "veryfast", "-crf", "23", "-movflags", "+faststart"])
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputMp4);
  });
}

/** Burn-in captions (Phase 5). Escapes path for ffmpeg subtitles filter. */
export function cutClipWithSubtitles(
  input: string,
  srtPath: string,
  startSec: number,
  endSec: number,
  outputMp4: string,
): Promise<void> {
  const dur = Math.max(0.5, endSec - startSec);
  if (!fs.existsSync(srtPath)) {
    return cutClip(input, startSec, endSec, outputMp4);
  }
  const escaped = srtPath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
  const vf = `subtitles='${escaped}':force_style='Fontname=Arial,Fontsize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,Outline=2'`;
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .setStartTime(startSec)
      .setDuration(dur)
      .videoFilters(vf)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset", "veryfast", "-crf", "23", "-movflags", "+faststart"])
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputMp4);
  });
}
