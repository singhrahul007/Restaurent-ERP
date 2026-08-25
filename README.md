# Niva

Multi-tenant restaurant operating system. PostgreSQL is the only database.

## Prerequisites

- Node.js 20.11+
- [pnpm 10.15.1](https://pnpm.io) (Corepack: `corepack enable && corepack prepare pnpm@10.15.1 --activate`)
- Docker Desktop (Postgres, Redis, MinIO)

## Setup

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install
copy .env.example .env
pnpm compose:up
```

Wait until Postgres, Redis, and MinIO are healthy (`pnpm compose:ps`). Docker Desktop must be running.

If Docker is not running, `pnpm test` skips the MinIO upload test and `pnpm db:migrate` cannot apply.

Apply PostgreSQL migrations:

```bash
pnpm db:migrate
```

## Run

```bash
pnpm dev:web      # Next.js  http://localhost:3000
pnpm dev:api      # Fastify  http://localhost:3001
pnpm dev:worker   # BullMQ health ping
```

OpenAPI UI: http://localhost:3001/api/v1/docs  
Health: http://localhost:3001/health  
Ready (Postgres ping): http://localhost:3001/ready

All three together: `pnpm dev`

## Quality

```bash
pnpm lint
pnpm typecheck
pnpm test
```

MinIO upload test runs when `.env` contains `S3_ENDPOINT` (after compose is up).

## Layout

- `apps/web` — Next.js UI
- `apps/api` — Fastify `/api/v1`
- `apps/worker` — background jobs
- `packages/database` — Drizzle + PostgreSQL
- `docker/compose.yml` — local Postgres 16, Redis, MinIO

See `docs/` for architecture. Next implementation task after Phase 0: `docs/sprints/phase-01-identity.md` (T-0101).
