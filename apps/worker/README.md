# ClipForge worker

Background process: claims `queued` jobs from Postgres, runs FFmpeg + Whisper, writes clips and updates job rows.

**This service does not expose HTTP.** All REST APIs live in `apps/backend` (Fastify).

## Environment

Required:

- `DATABASE_URL` — same PostgreSQL URL as the API (Railway plugin or local Docker; see root `POSTGRES.md`).
- `OPENAI_API_KEY` — Whisper + hook generation.

Optional: S3 vars (same names as API), `POLL_MS`, `LOCAL_UPLOAD_DIR`, `LOCAL_ARTIFACTS_DIR`.

## Railway (monorepo root)

Use the **same repository root** as the API service:

| Setting | Value |
|---------|--------|
| Root Directory | *(empty / repo root)* |
| Install | `npm ci` |
| Build | `npm run build:worker` |
| Start | `npm run start:worker` |

Copy **shared variables** from the API service (`DATABASE_URL`, `OPENAI_API_KEY`, S3, etc.).

## Local

```bash
export DATABASE_URL="postgresql://clipforge:clipforge@127.0.0.1:5432/clipforge"
export OPENAI_API_KEY="sk-..."
npm run dev:worker
```

Ensure `docker compose up -d postgres` is running from the repo root (see `POSTGRES.md`).
