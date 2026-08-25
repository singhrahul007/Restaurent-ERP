# Phase 0 — Foundation

## T-0001 Monorepo skeleton

**Objective:** pnpm workspaces + Turborepo with empty `apps/*` and `packages/*` package.json files and root scripts (`dev`, `lint`, `typecheck`, `test`).  
**Out of scope:** Business code, Docker.  
**Deps:** none  
**Files:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `apps/web`, `apps/api`, `apps/worker`, `packages/{database,types,validation,ui,config,auth}`  
**AC:** `pnpm install` works; turbo pipelines defined.

## T-0002 Shared TypeScript and ESLint

**Objective:** Strict TS configs, ESLint, Prettier, editorconfig.  
**Out of scope:** UI components.  
**Deps:** T-0001  
**Files:** `packages/config`, tsconfig bases  
**AC:** `pnpm typecheck` and `pnpm lint` succeed on empty packages.

## T-0003 Env schema

**Objective:** Zod env for api/worker/web; `.env.example` without secrets.  
**Out of scope:** Secret managers.  
**Deps:** T-0001  
**Files:** `packages/config`  
**AC:** Boot fails closed on missing `DATABASE_URL`.

## T-0004 Docker Compose databases

**Objective:** Postgres 16+, Redis, MinIO, healthchecks, named volumes.  
**Out of scope:** Production k8s.  
**Deps:** none  
**Files:** `docker/compose.yml`, `docker/README.md`  
**AC:** `docker compose up` yields healthy Postgres/Redis/MinIO.

## T-0005 Drizzle + first migration

**Objective:** Drizzle kit, connection helper, empty `schema.ts`, migration runner script.  
**Out of scope:** Domain tables (except optional `schema_migrations` internal).  
**Deps:** T-0004, T-0003  
**Files:** `packages/database`  
**AC:** `pnpm db:migrate` against compose Postgres succeeds.

## T-0006 Structured logging

**Objective:** Pino (or equivalent) JSON logs with `requestId` hook placeholder.  
**Out of scope:** APM vendor.  
**Deps:** T-0001  
**Files:** `packages/config` or `apps/api`  
**AC:** Log helper redacts `password`, `authorization`, `cookie`.

## T-0007 Fastify hello + error envelope

**Objective:** Fastify app, `/health`, `/ready` (db ping), standard error serializer.  
**Out of scope:** Auth.  
**Deps:** T-0005, T-0006  
**Files:** `apps/api`  
**AC:** OpenAPI stub route; 404 uses `{ success: false, error }`.

## T-0008 Next.js app shell

**Objective:** Next.js App Router TS, Tailwind, app placeholder page.  
**Out of scope:** shadcn full library, auth pages.  
**Deps:** T-0002  
**Files:** `apps/web`  
**AC:** `pnpm --filter web dev` renders.

## T-0009 Worker process stub

**Objective:** BullMQ connection + `health` queue ping job.  
**Out of scope:** Notification jobs.  
**Deps:** T-0004  
**Files:** `apps/worker`  
**AC:** Worker starts and completes ping job.

## T-0010 Socket.IO attach stub

**Objective:** Socket.IO on API http server, Redis adapter, auth handshake stub (reject unauthenticated).  
**Out of scope:** Domain events.  
**Deps:** T-0007  
**Files:** `apps/api`  
**AC:** Unauthenticated socket cannot join rooms.

## T-0011 Object storage adapter interface

**Objective:** Port + MinIO adapter for put/get presign.  
**Out of scope:** UI uploads.  
**Deps:** T-0004  
**Files:** `packages/types`, `apps/api` or `integrations`  
**AC:** Integration test uploads a byte to MinIO.

## T-0012 Root README for developers

**Objective:** How to run compose, migrate, web, api, worker.  
**Out of scope:** Marketing site.  
**Deps:** T-0004–T-0009  
**Files:** `README.md`  
**AC:** Follow README from clean clone (documented).
