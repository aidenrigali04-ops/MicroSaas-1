# PostgreSQL setup (local + Railway)

The app uses **PostgreSQL** via `DATABASE_URL` and **Drizzle** migrations in [`packages/db/migrations`](packages/db/migrations).

## 1. Local database (Docker)

From the **repo root**:

```bash
docker compose up -d postgres
```

Connection string:

```bash
export DATABASE_URL="postgresql://clipforge:clipforge@127.0.0.1:5432/clipforge"
```

Tables are created automatically when the **API** or **worker** starts (`initPostgres` runs Drizzle `migrate`).

## 2. Run API + worker + frontend locally

```bash
export DATABASE_URL="postgresql://clipforge:clipforge@127.0.0.1:5432/clipforge"
export OPENAI_API_KEY="sk-..."

npm run dev:api      # terminal 1
npm run dev:worker   # terminal 2
export NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev:web      # terminal 3
```

## 3. Railway Postgres

1. In your Railway project, add **PostgreSQL** (plugin).
2. Link the plugin to **both** services (API + worker) so `DATABASE_URL` is injected on each.
3. Redeploy. On boot, migrations apply automatically.

Do **not** point the frontend (Vercel) at Postgres — only the Node services use `DATABASE_URL`.

## 4. New migrations (schema changes)

1. Edit [`packages/db/src/schema.ts`](packages/db/src/schema.ts).
2. From repo root:

   ```bash
   export DATABASE_URL="postgresql://clipforge:clipforge@127.0.0.1:5432/clipforge"
   cd packages/db && npx drizzle-kit generate
   ```

3. Commit the new files under `packages/db/migrations/`.
4. Deploy; the next API/worker boot will run pending migrations.

## 5. Optional: Drizzle Studio

```bash
export DATABASE_URL="postgresql://..."
cd packages/db && npx drizzle-kit studio
```
