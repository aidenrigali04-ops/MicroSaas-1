# Deployment: Vercel + Railway + env reference

This repo is a **monorepo**. The **HTTP API is only** the Fastify app in `apps/backend`. The **worker** in `apps/worker` is a **background process** (no public HTTP API)—it polls the database and runs FFmpeg / Whisper.

---

## Where each piece runs

| Piece | Code | Role |
|--------|------|------|
| **Frontend** | `apps/frontend` (Next.js) | **Vercel** — browser calls your API via `NEXT_PUBLIC_API_URL`. |
| **Fastify API** | `apps/backend` | **Railway service #1** — all REST routes below. |
| **Worker** | `apps/worker` | **Railway service #2** — same DB + OpenAI + S3 vars; no routes to expose. |
| **Database** | `@clipforge/db` (PostgreSQL) | **`DATABASE_URL`** on API + worker. Local: `docker compose up -d postgres` — see [`POSTGRES.md`](POSTGRES.md). Migrations run on boot. |

---

## Fastify API — entrypoints (code)

| File | Purpose |
|------|---------|
| [`apps/backend/src/index.ts`](apps/backend/src/index.ts) | Boots server: `loadEnv` → `await initDb` (Postgres + migrate) → `buildApp` → `listen`. |
| [`apps/backend/src/app.ts`](apps/backend/src/app.ts) | Registers CORS, multipart, raw body (Stripe), mounts routes. |
| [`apps/backend/src/routes/generate.ts`](apps/backend/src/routes/generate.ts) | `POST /api/v1/generate` |
| [`apps/backend/src/routes/jobs.ts`](apps/backend/src/routes/jobs.ts) | Jobs, uploads, artifacts, export, regenerate-hook |
| [`apps/backend/src/routes/stripe.ts`](apps/backend/src/routes/stripe.ts) | Billing + Stripe webhook |

---

## All HTTP routes (Fastify API only)

Base URL on Railway: `https://<your-api-service>.up.railway.app` (set this as `NEXT_PUBLIC_API_URL` on Vercel).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check (use for Railway healthcheck). |
| GET | `/api/v1` | API metadata. |
| POST | `/api/v1/generate` | Text → hooks + caption (OpenAI). Body: `{ transcript, platform, context? }`. |
| POST | `/api/v1/jobs/presign` | Create job + presign URL or local upload URL. Body: `{ filename, contentType }`. |
| POST | `/api/v1/jobs/:jobId/upload` | Multipart upload when **not** using S3. |
| POST | `/api/v1/jobs/:jobId/complete-upload` | After S3 PUT, mark job queued for worker. |
| GET | `/api/v1/jobs` | List recent jobs. |
| GET | `/api/v1/jobs/:jobId` | Job detail + `clipPreviews` map when ready. |
| GET | `/api/v1/jobs/:jobId/file` | Stream original file (local storage only). |
| GET | `/api/v1/artifacts/:key` | Stream artifact file; `key` is URL-encoded (e.g. `artifacts%2F...`). |
| POST | `/api/v1/jobs/:jobId/regenerate-hook` | Body: `{ clipId, platform? }`. |
| POST | `/api/v1/jobs/:jobId/export` | Body: `{ clipIds? }`; spends credits; returns download URLs. |
| GET | `/api/v1/billing/credits` | Current credit balance. |
| POST | `/api/v1/billing/checkout-session` | Body: `{ credits?, successUrl?, cancelUrl? }` → Stripe Checkout URL. |
| POST | `/api/v1/webhooks/stripe` | Stripe webhook (raw body; **must** be this exact path on the API service). |

**Do not** point Vercel or users at the worker URL for HTTP—there is no Fastify server there.

---

## Railway: two services from one repo

Use the **same GitHub repo** for both. Set **Root Directory** to **repository root** (empty / `.`) so `npm workspaces` resolves `@clipforge/db`.

### Service A — Fastify API

| Setting | Value |
|---------|--------|
| Root Directory | *(repo root)* |
| Install | `npm ci` |
| Build | `npm run build:api` |
| Start | `npm run start:api` |
| Healthcheck path | `/health` |
| **PORT** | Railway injects; Fastify uses `process.env.PORT`. |

### Service B — Worker

| Setting | Value |
|---------|--------|
| Root Directory | *(same repo root)* |
| Install | `npm ci` *(or leave default if Railway runs it)* |
| Build | **`npm ci && npm run build:worker`** *(single step avoids missing `node_modules`)* |
| Start | `npm run start:worker` |
| Healthcheck | Optional process check (no HTTP). |

**Build exit 127:** Usually **`tsc` or `npm` not found**. Causes: (1) build ran **`npm run build:worker` without `npm ci` first**; (2) **`NODE_ENV=production`** omitted `typescript` — we keep `typescript` in **dependencies** so `npm ci` still installs it. Use **monorepo root**, not `apps/worker`, as the Railway root directory.

Copy **shared variables** to both services: **`DATABASE_URL`**, `OPENAI_API_KEY`, and the same S3 / upload settings when you use them.

**Config files (reference):** [`apps/backend/railway.toml`](apps/backend/railway.toml), [`apps/worker/railway.toml`](apps/worker/railway.toml), [`apps/worker/README.md`](apps/worker/README.md).

---

## Environment variables

### Railway — Fastify API (`apps/backend`)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **yes** | Railway Postgres plugin (same value on worker). |
| `NODE_ENV` | recommended | `production` |
| `PORT` | auto | Set by Railway. |
| `OPENAI_API_KEY` | yes* | For `/api/v1/generate` and hook regen. |
| `OPENAI_MODEL` | no | Default `gpt-4o-mini`. |
| `CORS_ORIGIN` | yes for Vercel | e.g. `https://your-app.vercel.app` |
| `LOCAL_UPLOAD_DIR` | optional | Default `uploads` under `data/`. |
| S3 vars | optional | See `apps/backend/.env.example`. |
| Stripe vars | optional | Webhook URL = `https://<api-host>/api/v1/webhooks/stripe` |

\*503 on generate if missing.

### Railway — Worker (`apps/worker`)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **yes** | Same as API. |
| `OPENAI_API_KEY` | yes | Whisper + hook generation for clips. |
| `OPENAI_WHISPER_MODEL` | no | Default `whisper-1`. |
| `OPENAI_MODEL` | no | For hooks on first clips. |
| `POLL_MS` | no | Default `2500`. |
| Same S3 / upload paths as API | when using S3 or local disk | So worker reads the same jobs and writes artifacts. |

### Vercel — Frontend

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://<your-railway-api>.up.railway.app` (no trailing slash) |

---

## Local commands (repo root)

```bash
docker compose up -d postgres
export DATABASE_URL="postgresql://clipforge:clipforge@127.0.0.1:5432/clipforge"
```

```bash
npm ci
npm run build          # everything
npm run build:api      # db + Fastify only
npm run build:worker   # db + worker only
```

```bash
export DATABASE_URL="postgresql://clipforge:clipforge@127.0.0.1:5432/clipforge"
export OPENAI_API_KEY="sk-..."
npm run dev:api        # http://localhost:3001
npm run dev:worker
export NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev:web        # http://localhost:3000
```

Full DB notes: [`POSTGRES.md`](POSTGRES.md).
