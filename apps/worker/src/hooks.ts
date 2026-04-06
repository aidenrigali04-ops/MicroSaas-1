import OpenAI from "openai";
import { z } from "zod";
import type { WorkerEnv } from "./env.js";

const generationOutputSchema = z.object({
  hooks: z.object({
    curiosity: z.string().min(1),
    authority: z.string().min(1),
    contrarian: z.string().min(1),
  }),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).max(12).optional(),
  editorNote: z.string().optional(),
});

export type HookPack = z.infer<typeof generationOutputSchema>;

const platformTone: Record<string, string> = {
  tiktok: "Punchy, native TikTok.",
  instagram_reels: "Visual-forward, energetic.",
  youtube_shorts: "Clear promise, story or education tease.",
  linkedin: "Professional authority, line breaks OK.",
};

export async function generateHooksForSegment(
  env: WorkerEnv,
  transcript: string,
  platform = "tiktok",
): Promise<HookPack> {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const tone = platformTone[platform] ?? platformTone.tiktok;
  const system = `You are a short-form content strategist.
Rules: use ONLY facts from transcript; hooks under 180 chars; JSON only:
{"hooks":{"curiosity":"","authority":"","contrarian":""},"caption":"","hashtags":[],"editorNote":""}`;

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.65,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Platform tone: ${tone}\nTranscript:\n${transcript}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty model response");
  }
  return generationOutputSchema.parse(JSON.parse(raw));
}
