# Testing strategy

## Unit (`vitest`)

Must cover:

- Pricing service (variants, modifiers, qty, discount, coupon, tax inclusive/exclusive, rounding)
- Permission resolver and role seed matrix
- Order state machine (illegal transitions throw)
- Inventory qty + unit conversion integers
- Recipe consumption idempotency (second call no extra tx)

## Integration

Fastify inject + test Postgres (Testcontainers or docker compose `niva_test`).

- Login, refresh rotation, reuse detection
- Tenant isolation: user A cannot read user B org rows
- RLS: missing `SET LOCAL` cannot read (optional dedicated test)
- Order + payment transaction rollback

## E2E (Playwright, later)

Happy path in `docs/instructions.md` contract:

Login → restaurant → menu → order → kitchen ready → pay → complete → stock → report figure.

POS and KDS as separate projects (viewport).

## Security tests

- IDOR on `/orders/:id`
- Cookie without CSRF origin
- COOK cannot fetch payment endpoints
- Rate limit on login

## Quality gates

CI: lint, `tsc`, unit, integration. E2E on main. No merge if tenant isolation tests fail.
