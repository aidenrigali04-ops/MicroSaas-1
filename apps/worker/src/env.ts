import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_WHISPER_MODEL: z.string().default("whisper-1"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  LOCAL_UPLOAD_DIR: z.string().default("uploads"),
  LOCAL_ARTIFACTS_DIR: z.string().default("artifacts"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  POLL_MS: z.coerce.number().default(2500),
});

export type WorkerEnv = z.infer<typeof envSchema>;

export function loadWorkerEnv(): WorkerEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid worker environment");
  }
  return parsed.data;
}
