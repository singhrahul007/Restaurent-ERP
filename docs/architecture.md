# Architecture

## Repository status (inspection)

The workspace `Restaurent-ERP` is a **fresh Git repository with no application source**. There is no existing Next.js app, API, schema, or CI. Phase 0 must create the monorepo from scratch. There are **no inherited constraints** other than this planning set and Git history.

## Locked decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Database | **PostgreSQL only** (local Docker and production) | Required for RLS, transactions, UUIDs, and indexes. Do **not** use SQLite, MySQL, or an in-memory store as a stand-in. |
| ORM | **Drizzle** only, targeting PostgreSQL | SQL-first migrations, explicit queries, strong TypeScript, cheaper multi-tenant RLS and transactional inventory/order workflows than Prisma’s client model. No second ORM. |
| Tenancy | Shared database, **shared schema**, `organization_id` on all tenant tables, **PostgreSQL RLS** as defense in depth | Operationally simple for SaaS; RLS catches missed filters; schema-per-tenant does not scale to many small restaurants. |
| Auth transport (web) | **HttpOnly, Secure, SameSite cookies** for access + refresh; CSRF via Origin/Referer allowlist + SameSite | Browser POS/KDS stay logged in without exposing tokens to JS. |
| Auth transport (future mobile) | Same refresh-token table; **Bearer access token** from a dedicated `/auth/token` client type | Adapter, not a second identity system. |
| Password hashing | **Argon2id** | Modern default; parameters in config, not code comments. |
| IDs | **UUIDv7** (app-generated) as `uuid` PK | Time-sortable, better B-tree locality than v4. |
| Money | `bigint` minor units + `char(3)` ISO 4217 on restaurant | No floats. Default currency **INR** until multi-currency UI exists. |
| API | Fastify `/api/v1`, Zod validation, OpenAPI from the same schemas | Single source of truth in `packages/validation`. |
| Web data | Next.js UI talks to Fastify; **no business logic in Next Route Handlers** except optional BFF cookie proxy if required by hosting | Agents do not duplicate domain rules. |
| Realtime | Socket.IO, Redis adapter, **scoped rooms** | Kitchen/POS latency; never global broadcast. |
| Jobs | BullMQ workers in `apps/worker` (or `apps/api` worker process) | Notifications, exports, integrations, invoices. |
| Objects | S3 API via adapter (`integrations` later; MinIO in Docker) | Cloud-agnostic. |
| Monorepo tool | **pnpm + Turborepo** | Simple, AI-friendly, fewer packages. |

## System context

```text
[Browser / PWA]
    │ HTTPS
    ▼
[apps/web Next.js] ── cookies ──► [apps/api Fastify]
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              [PostgreSQL]         [Redis]        [Object storage]
                    ▲                 │
                    │                 ├─ BullMQ
                    │                 └─ Socket.IO adapter
                    │
              [apps/worker]
```

Platform administration is the same API with `platform.manage` and no restaurant scope.

## Monorepo (do not add packages without a job)

```text
apps/web          Next.js App Router UI (role shells)
apps/api          Fastify HTTP + Socket.IO attach
apps/worker       BullMQ processors
packages/database Drizzle schema, migrations, RLS helpers
packages/types    Shared domain enums and DTO types (no runtime)
packages/validation Zod schemas + OpenAPI fragments
packages/ui       Design tokens + shadcn wrappers used by web
packages/config   Env schema (Zod), logger defaults
packages/auth     Password, JWT/session helpers, permission catalog (no HTTP)
integrations/*    Provider adapters only (payment, messaging, …)
docs/             Architecture and sprint tasks
docker/           Compose and images
scripts/          Dev/ops scripts
```

`packages/auth` must not import `apps/api`. API middleware imports `packages/auth` and `packages/database`.

## Request pipeline (API)

1. Request ID / correlation ID
2. Body size + rate limit (IP + authenticated user)
3. Auth: resolve session → user → memberships → **active organization** (header `X-Organization-Id` or cookie, validated against membership)
4. Optional restaurant/branch context (`X-Restaurant-Id`, `X-Branch-Id`) validated against membership
5. Permission check (`permission` string)
6. Handler → service → repository (Drizzle) with `organization_id` always from context
7. Audit for sensitive actions
8. Envelope `{ success, data, meta }` or `{ success: false, error }`

Tenant SQL must use `SET LOCAL app.organization_id` (see `packages/database/src/rls.ts` and `docs/tenancy-runtime.md`). RLS on `restaurants`, `branches`, and `branch_assignments` is defense in depth. Application filters are still required.

## Isolation

- Shared schema, `organization_id` on tenant tables
- Organization delete is **RESTRICT** while memberships or restaurants exist
- User delete **cascades** memberships; restaurant delete **cascades** branches


## Module boundaries

Each domain module under `apps/api/src/modules/<name>/` owns: `routes`, `service`, `repository`, tests. Validation lives in `packages/validation`. Types in `packages/types` when shared with web.

**Allowed dependency direction:** `routes → service → repository → database`. Integrations are called only from services via interfaces in `packages/types` or `integrations/*`.

No circular imports between `orders`, `payments`, and `inventory`. Cross-module work uses domain events (in-process + outbox for jobs/realtime).

## Domain events and outbox

Critical side effects (kitchen ticket, stock consume, notify) after commit:

1. Write business rows + `outbox` row in one transaction
2. Worker or API publisher reads outbox, emits Socket.IO / queues job
3. Mark published; retry on failure

Idempotency keys on: order create (client key), payment capture, inventory consume per order, webhook handlers.

## Pricing

`apps/api/src/modules/pricing/pricing.service.ts` is the only calculator. Web may display server-returned line totals; it must not recompute tax for persistence.

## Realtime rooms

| Room | Who joins | Events |
| --- | --- | --- |
| `org:{organizationId}` | Members of org (filtered server-side per event) | Coarse alerts |
| `restaurant:{id}` | Users assigned to restaurant | Menu/ops |
| `branch:{id}` | Branch-scoped staff | Orders, KDS, inventory alerts |
| `kitchen:{branchId}` | Cook / manager | Ticket events only (no money) |
| `user:{id}` | That user | Notifications, delivery assignments |

Server re-checks permission before emit payload. Kitchen payloads omit prices, payments, and PII beyond ticket needs.

## Environment

- `apps/api`, `apps/worker`, `apps/web` each have `.env.example` only
- Secrets never committed
- Config parsed with Zod at boot; process exits on invalid env

## Ambiguities deferred (do not invent in Phase 0–2)

See **Missing decisions** in the planning summary. Defaults until approved:

- India-first GST fields on tax config; not a full GST return product in Phase 6
- Single currency per restaurant
- Online orders = first-party QR/web menu, not marketplace APIs until Phase 12
