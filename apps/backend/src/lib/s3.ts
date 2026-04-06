import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../env.js";

export function isS3Configured(env: Env): boolean {
  return Boolean(
    env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
  );
}

export function createS3Client(env: Env): S3Client {
  const endpoint = env.S3_ENDPOINT?.trim();
  return new S3Client({
    region: env.S3_REGION,
    ...(endpoint
      ? { endpoint, forcePathStyle: true as const }
      : {}),
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export async function presignPut(
  env: Env,
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const client = createS3Client(env);
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET!,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function presignGet(
  env: Env,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const client = createS3Client(env);
  const cmd = new GetObjectCommand({
    Bucket: env.S3_BUCKET!,
    Key: key,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

export function publicUrlForKey(env: Env, key: string): string | null {
  if (!env.S3_PUBLIC_BASE_URL) {
    return null;
  }
  const base = env.S3_PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${base}/${key.replace(/^\//, "")}`;
}
