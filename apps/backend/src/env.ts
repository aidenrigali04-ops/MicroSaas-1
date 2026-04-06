import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  /** PostgreSQL connection string (Railway plugin injects DATABASE_URL). */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Comma-separated origins; omit to reflect request origin (dev-friendly). */
  CORS_ORIGIN: z.string().optional(),
  OPENAI_API_KEY: z
    .string()
    .min(1)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  /** Whisper / audio transcription */
  OPENAI_WHISPER_MODEL: z.string().default("whisper-1"),
  /** S3-compatible (omit for AWS default endpoint) */
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  /** Relative to repo `data/` unless absolute */
  LOCAL_UPLOAD_DIR: z.string().default("uploads"),
  /** Stripe (Phase 7) */
  STRIPE_SECRET_KEY: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  STRIPE_PRICE_EXPORT_CREDITS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
