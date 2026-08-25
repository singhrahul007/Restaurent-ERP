# API specification (v1)

Base path: `/api/v1`. JSON only. Authenticated unless marked public.

## Envelope

Success:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "uuid", "page": { "cursor": null, "hasMore": false } }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found"
  }
}
```

Do not put stack traces or SQL in `message`. Use stable `code` values.

## Conventions

- List: cursor pagination (`limit` ≤ 100), `sort`, filters as query params
- Create: `201` + body
- Idempotency: header `Idempotency-Key` on POST payments, POST orders, POST inventory adjustments
- Context headers (validated against membership): `X-Organization-Id` (required when user has multiple orgs), `X-Restaurant-Id`, `X-Branch-Id`
- OpenAPI generated from Zod in `packages/validation`; served at `/api/v1/docs`

## Auth (Phase 1)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Org+owner bootstrap or invite-only later; Phase 1 may restrict |
| POST | `/auth/login` | public | Sets cookies; rate limited |
| POST | `/auth/refresh` | refresh cookie | Rotation |
| POST | `/auth/logout` | session | Revoke current |
| POST | `/auth/logout-all` | session | Revoke all sessions |
| GET | `/auth/me` | session | User + memberships + permissions for active org |

## Identity and tenancy (Phase 1–2)

| Method | Path | Permission |
| --- | --- | --- |
| GET/PATCH | `/users/me` | authenticated |
| GET | `/organizations` | membership |
| GET/PATCH | `/organizations/:id` | `settings.manage` or owner |
| CRUD | `/restaurants` | `restaurant.view` / `restaurant.manage` |
| CRUD | `/restaurants/:id/branches` | `branch.view` / `branch.manage` |
| CRUD | `/staff` | `staff.view` / `staff.manage` |
| GET/PUT | `/roles` | `settings.manage` |
| GET | `/audit-logs` | `settings.manage` or `platform.manage` |

## Operations (later phases)

Prefix resources by restaurant/branch when it reduces leakage, e.g. `/branches/:branchId/orders`.

Illustrative (not implemented until their phase):

| Resource | Examples |
| --- | --- |
| Tables | `/branches/:branchId/tables` |
| Menu | `/restaurants/:id/menu/categories`, `.../items` |
| Orders | `/branches/:branchId/orders` |
| Payments | `/orders/:id/payments`, `/payments/:id/refunds` |
| Kitchen | `/branches/:branchId/kitchen/tickets` |
| Inventory | `/branches/:branchId/inventory/items`, `.../transactions` |
| Recipes | `/restaurants/:id/recipes` |
| Delivery | `/deliveries`, `/delivery/me/shift` |
| Reports | `/reports/sales` (async job + download) |
| Platform | `/platform/metrics`, `/platform/organizations` |

## Health

`GET /health` liveness. `GET /ready` checks Postgres + Redis.

## Error codes (initial catalog)

`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `TENANT_MISMATCH`, `ORDER_NOT_FOUND`, `INVALID_STATE_TRANSITION`.
