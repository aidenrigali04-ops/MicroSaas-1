import OpenAI from "openai";
import { z } from "zod";

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

export type GenerationOutput = z.infer<typeof generationOutputSchema>;

const platformTone: Record<string, string> = {
  tiktok: "Punchy, native TikTok: short sentences, pattern interrupts, casual.",
  instagram_reels:
    "Visual-forward, energetic, emoji-light unless it fits the niche.",
  youtube_shorts:
    "Clear promise in first line, educational or story tease, searchable keywords where natural.",
  linkedin:
    "Professional authority: insight-led, no cringe hustle language, line breaks for readability.",
};

export async function generateClipContent(input: {
  transcript: string;
  platform: string;
  context?: string;
  apiKey: string;
  model: string;
}): Promise<GenerationOutput> {
  const client = new OpenAI({ apiKey: input.apiKey });
  const tone = platformTone[input.platform] ?? platformTone.youtube_shorts;

  const system = `You are a short-form content strategist and copywriter for viral-style clips.
Rules:
- Use ONLY ideas and facts that appear in the user's transcript. Do not invent statistics, names, or events.
- Each hook must work as the FIRST thing the viewer sees/hears (roughly the first 1–3 seconds of voiceover or on-screen text). Keep each hook under 180 characters unless the transcript requires a short direct quote.
- The caption should match the platform tone and can include line breaks.
- Return STRICT JSON only, no markdown, matching this shape:
{"hooks":{"curiosity":"","authority":"","contrarian":""},"caption":"","hashtags":[],"editorNote":""}
- "hashtags" is optional: array of strings without #. Max 12 items.
- "editorNote" is optional: one short sentence.`;

  const userParts = [
    `Platform: ${input.platform}`,
    `Platform tone: ${tone}`,
    input.context ? `Extra context from the user: ${input.context}` : null,
    `Transcript:\n${input.transcript}`,
  ].filter(Boolean);

  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0.65,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userParts.join("\n\n") },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty model response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("Model returned non-JSON");
  }

  return generationOutputSchema.parse(parsedJson);
}
