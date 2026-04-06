import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { WorkerEnv } from "./env.js";

export function isS3Configured(env: WorkerEnv): boolean {
  return Boolean(
    env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
  );
}

export function createS3(env: WorkerEnv): S3Client {
  const endpoint = env.S3_ENDPOINT?.trim();
  return new S3Client({
    region: env.S3_REGION,
    ...(endpoint ? { endpoint, forcePathStyle: true as const } : {}),
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export async function downloadToFile(
  env: WorkerEnv,
  key: string,
  destPath: string,
): Promise<void> {
  const client = createS3(env);
  const out = await client.send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }),
  );
  const stream = out.Body as NodeJS.ReadableStream | undefined;
  if (!stream) {
    throw new Error("S3 body missing");
  }
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await pipeline(stream, createWriteStream(destPath));
}

export async function uploadFile(
  env: WorkerEnv,
  key: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const client = createS3(env);
  const body = await fs.readFile(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
