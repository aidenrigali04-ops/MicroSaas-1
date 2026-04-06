import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../env.js";
import { generateClipContent } from "../services/contentGeneration.js";

const bodySchema = z.object({
  transcript: z.string().min(20).max(50_000),
  platform: z.enum([
    "tiktok",
    "instagram_reels",
    "youtube_shorts",
    "linkedin",
  ]),
  context: z.string().max(2000).optional(),
});

export function registerGenerateRoutes(
  app: FastifyInstance,
  env: Env,
): void {
  app.post("/api/v1/generate", async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_body",
        details: parsed.error.flatten(),
      });
    }

    if (!env.OPENAI_API_KEY) {
      return reply.status(503).send({
        error: "openai_not_configured",
        message: "Set OPENAI_API_KEY on the API service to enable generation.",
      });
    }

    try {
      const data = await generateClipContent({
        transcript: parsed.data.transcript,
        platform: parsed.data.platform,
        context: parsed.data.context,
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
      });
      return reply.send({ ok: true, data });
    } catch (err) {
      app.log.error(err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.status(502).send({
        error: "generation_failed",
        message,
      });
    }
  });
}
