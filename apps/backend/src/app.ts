import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyRawBody from "fastify-raw-body";
import Fastify, { type FastifyInstance } from "fastify";
import type { Env } from "./env.js";
import { registerGenerateRoutes } from "./routes/generate.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerStripeRoutes } from "./routes/stripe.js";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MiB — tune per plan / infra

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  const corsOrigin =
    env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? true;

  await app.register(cors, { origin: corsOrigin, credentials: true });
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });

  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    routes: ["/api/v1/webhooks/stripe"],
  });

  app.get("/health", async () => ({
    status: "ok",
    ts: new Date().toISOString(),
  }));

  app.get("/api/v1", async () => ({
    service: "clipforge-api",
    version: "0.1.0",
  }));

  registerGenerateRoutes(app, env);
  registerJobRoutes(app, env);
  await registerStripeRoutes(app, env);

  return app;
}
