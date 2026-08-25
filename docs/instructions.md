# Agent instructions

Working product name: **Niva** (placeholder; rename before public launch).

This repository is a multi-tenant restaurant operating system. Implement **one module, one feature, one outcome** per request. Do not start a new phase until the previous phase’s acceptance criteria are met unless the user explicitly redirects.

## Before writing code

1. Inspect the repository and the files listed under **Files likely affected**.
2. Read this file plus `architecture.md`, `security-architecture.md`, and the relevant module docs.
3. Identify database, API, permission, UI, security, and failure-mode impact.
4. Fill `docs/feature-contract-template.md` in the task or PR description.
5. Make the smallest correct change. Reuse types, validation, and UI primitives.

## Non-negotiables

| Priority | Rule |
| --- | --- |
| 1 | Security and tenant isolation |
| 2 | Correctness (money, stock, order/payment state) |
| 3 | Maintainability |
| 4 | Performance |
| 5 | UI experience |
| 6 | Feature velocity |

- The frontend is never trusted for authorization.
- Every tenant query is scoped by `organization_id` derived from the session, not from the client body.
- Money is integer minor units. Pricing lives only in `packages` / API calculation services.
- Stock quantity never changes without an inventory transaction row in the same database transaction.
- Order status and payment status are independent.
- No vendor-specific logic in core order, payment, or customer services.
- Do not claim a feature complete without tests or an explicit verification note.

## Stack (locked for Phase 0)

- Apps: Next.js (App Router, TypeScript) + Fastify API (TypeScript, REST, OpenAPI)
- Data: PostgreSQL + **Drizzle ORM** (see `architecture.md`)
- Jobs: Redis + BullMQ
- Realtime: Socket.IO with Redis adapter
- Objects: S3-compatible API (MinIO locally)
- Monorepo: pnpm workspaces + Turborepo
- UI: Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query, React Hook Form, Zod

## Response format after an implementation task

1. Files changed
2. What was implemented
3. Important design decisions
4. Validation/tests run
5. Remaining issues

Do not paste unchanged files or restating the full architecture.
