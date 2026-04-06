# Worker image — build context MUST be the monorepo root (all workspaces present).
# Railway: set this service Root Directory to the repo root (empty / ".").
#          Build → Docker, Dockerfile path: Dockerfile
#          Start: npm run start:worker
#
# Nixpacks with Root Directory = apps/worker copies only that folder, so npm tries
# to fetch @clipforge/db from npmjs and fails with 404.

FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci

RUN npm run build:worker

ENV NODE_ENV=production

CMD ["npm", "run", "start:worker"]
