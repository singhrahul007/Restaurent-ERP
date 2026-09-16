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
| CRUD | `/restaurants` | `restaurant.view` / `restaurant.manage`; PATCH also `settings.manage` |
| CRUD | `/restaurants/:id/branches` | `branch.view` / `branch.manage`; `posIdleTimeoutMinutes` |
| CRUD | `/branches/:id/tables` | `tables.view` / `tables.manage`; unique code per branch |
| POST | `/staff/invites` | `staff.manage`; audit `ROLE_CHANGED`; no `SUPER_ADMIN` |
| GET/PATCH | `/staff` | `staff.view` / `staff.manage` |
| GET/PUT | `/roles` | `settings.manage` |
| GET | `/audit-logs` | `settings.manage` or `platform.manage` |

## Menu (Phase 5)

Money fields are integers (`basePriceMinor`, `priceDeltaMinor`). Tax rates are integer basis points (`1800` = 18%). Permissions: `menu.view` / `menu.manage`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/restaurants/:restaurantId/menu` | Categories, items (with `effectiveAvailable`), tax classes, modifier groups. Query `branchId` applies 86 overlay. |
| GET/POST | `/restaurants/:restaurantId/tax-classes` | Create includes first rate (`rateBps`, optional `cgstBps`/`sgstBps`/`igstBps`, `inclusive`) |
| PATCH/DELETE | `/tax-classes/:id` | |
| POST | `/tax-classes/:id/rates` | Closes the current rate |
| GET/POST | `/restaurants/:restaurantId/menu/categories` | Optional `parentId` tree |
| PATCH/DELETE | `/menu/categories/:id` | |
| GET/POST | `/restaurants/:restaurantId/menu/items` | `basePriceMinor` integer; GET query `branchId` |
| GET/PATCH/DELETE | `/menu/items/:id` | Variants, attached groups, availability overlays |
| POST | `/menu/items/:id/variants` | `priceDeltaMinor` integer |
| PATCH/DELETE | `/menu/variants/:id` | |
| GET/POST | `/restaurants/:restaurantId/menu/modifier-groups` | `minSelect` ≤ `maxSelect` |
| PATCH/DELETE | `/menu/modifier-groups/:id` | |
| POST | `/menu/modifier-groups/:id/modifiers` | `priceDeltaMinor` integer |
| PATCH/DELETE | `/menu/modifiers/:id` | |
| PUT | `/menu/items/:id/modifier-groups` | Replace attachments `{ modifierGroupIds }` |
| PUT/DELETE | `/menu/items/:id/availability` | 86 overlay; `branchId` null = restaurant-wide |

## Orders and POS (Phase 6)

Money is integer minor units. Totals come only from `priceOrder` in `apps/api/src/modules/pricing/pricing.service.ts`. Permissions: `orders.*`, `payments.create`, `payments.refund`.

**Occupied table:** a dine-in table is occupied while any order on that table is not `COMPLETED` or `CANCELLED`. Creating another dine-in order for it returns `409 CONFLICT`.

**Coupon redemption:** one coupon per order; one `coupon_redemptions` row per `(coupon_id, order_id)`; `max_redemptions` caps uses of a code across orders (`null` = unlimited).

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/branches/:branchId/orders` | `Idempotency-Key` header; `DINE_IN` requires `tableId`; status `DRAFT` or `CREATED` |
| GET | `/branches/:branchId/orders` | |
| GET | `/orders/:id` | Includes items, payments, `balanceMinor` |
| POST | `/orders/:id/items` | Mutate `DRAFT`/`CREATED` only; recalc in tx |
| PATCH/DELETE | `/order-items/:id` | Qty or remove |
| POST | `/orders/:id/discounts` | `PERCENT` (`percentBps`) or `AMOUNT`; cannot go negative |
| POST | `/restaurants/:restaurantId/coupons` | Create code |
| POST | `/orders/:id/coupon` | Apply code |
| POST | `/orders/:id/payments` | Cash; **does not** change order status |
| POST | `/orders/:id/confirm` | `CREATED` → `CONFIRMED` → `PREPARING`; kitchen tickets + outbox in the same tx |
| POST | `/orders/:id/ready` `/serve` `/hand-over` `/complete` | State machine; complete requires balance 0 |
| POST | `/orders/:id/cancel` | Not `COMPLETED`; refund captured payments first |
| POST | `/payments/:id/refunds` | `payments.refund`; amount ≤ captured |

## Kitchen (Phase 7)

Permissions: `kitchen.view`, `kitchen.update`. JSON omits prices and payments. Socket events go only to `kitchen:{branchId}`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/branches/:branchId/kitchen/tickets` | Columns `NEW`, `IN_PROGRESS`, `READY` |
| PATCH | `/kitchen/ticket-items/:id` | `{ status }` |
| POST | `/kitchen/tickets/:id/ready` | All items ready; order `PREPARING` → `READY` |

Restaurant setting `kitchenSoundEnabled` plus KDS mute.

## Inventory (Phase 8)

Permissions: `inventory.view`, `inventory.manage`. Quantities are integers in the item base unit. Conversions use integer ratios only (`qty * numerator / denominator` with remainder 0). Balance rows change only inside the same database transaction as an `inventory_transactions` row.

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/restaurants/:restaurantId/units` | Seeds g/kg, ml/l, each on first GET |
| POST | `/restaurants/:restaurantId/unit-conversions` | `{ fromUnitId, toUnitId, numerator, denominator }` |
| GET/POST | `/restaurants/:restaurantId/inventory/items` | Optional `?branchId=` for on-hand qty |
| GET | `/branches/:branchId/inventory/items` | Balances in base units |
| PATCH | `/inventory/items/:id` | Name, trackStock, threshold |
| GET/POST | `/branches/:branchId/inventory/transactions` | `ADJUSTMENT`/`WASTAGE`; audit `INVENTORY_ADJUSTED`; `Idempotency-Key` |
| GET | `/restaurants/:restaurantId/inventory/alerts` | Qty ≤ threshold |
| POST | `/restaurants/:restaurantId/inventory/transfers` | `TRANSFER_OUT`/`IN` pair, same restaurant |
| GET/POST | `/restaurants/:restaurantId/suppliers` | Org scoped |
| PATCH/DELETE | `/suppliers/:id` | |
| POST | `/branches/:branchId/purchase-orders` | Draft + lines |
| POST | `/purchase-orders/:id/receive` | `PURCHASE` movements + status `RECEIVED` in one tx |

Outbox topic `inventory.low_stock` when a movement crosses the threshold from above.

## Recipes (Phase 9)

Permission: **`inventory.manage`** for all recipe CRUD (not `menu.manage`).

Quantities on recipe lines are integers in the inventory item **base unit**. Unique recipe per menu item, or per item+variant.

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/restaurants/:restaurantId/recipes` | `{ menuItemId, variantId?, lines: [{ inventoryItemId, qtyBase }] }` |
| PATCH/DELETE | `/recipes/:id` | PATCH replaces lines |

### Consume / reverse policy

Restaurant setting `inventoryPolicy`:

| Policy | Auto consume | Reverse |
| --- | --- | --- |
| `OFF` | None | None |
| `MANUAL` | None (adjustments only) | None |
| `ON_SALE` | On **order complete**, same DB tx as the status change: insert `inventory_consumptions` (unique `order_id`), `SELECT FOR UPDATE` balances, `SALE_CONSUMPTION` rows | When a **completed** order is **fully refunded** (`netPaidMinor === 0`): `RETURN` txs and `reversed_at`. Partial refunds do not reverse. Cancel before complete never consumed, so no reverse. |

A second consume for the same order is a no-op (unique consumption row). A second reverse is a no-op (`reversed_at` already set). Insufficient stock fails the complete (transaction rolls back).

## Delivery (Phase 10)

Permissions: `delivery.self` (own shift, jobs, earnings), `delivery.manage` (assign). Order type `DELIVERY` is required; `deliveries (order_id, order_type)` FK references `orders (id, type)` with `order_type = DELIVERY`.

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/delivery/me`, `/delivery/me/shift` | `{ online }`; audit `SETTINGS_CHANGED` |
| GET | `/delivery/me/jobs` | Assigned jobs only |
| GET | `/delivery/me/earnings?date=` | Daily count + `codCollectedMinor` for self |
| GET | `/delivery/agents` | `delivery.manage` |
| POST | `/deliveries` | Assign; plaintext OTP **once**; socket `delivery.assigned` on `user:{id}` |
| GET | `/deliveries/:id` | No `otp` / `otpHash` |
| POST | `/deliveries/:id/pickup` | `ASSIGNED` → `PICKED_UP` |
| POST | `/deliveries/:id/confirm` | `{ otp, codCollectedMinor }` integers |

Maps: `maps` Google/Apple deeplinks plus `geocode` mock. No billed Maps API.

## Integrations (Phase 12)

Ports live in `@niva/types`. Adapters live in `@niva/integrations`. Domain services depend on ports only. POS capture/refund goes through `PaymentGateway` (`MockPaymentGateway` in this repo). Email/SMS/WhatsApp mocks log in the worker (`notifications` queue) — they do not send.

**T-1204:** Razorpay/live PSP adapter is **not** implemented (no verified sandbox keys). Do not treat mock payments as a live provider.

| Method | Path | Notes |
| --- | --- | --- |
| GET/PUT | `/integration-accounts` | `settings.manage`. PUT `{ provider, credentials }`. GET returns `credentialsMasked` only |
| DELETE | `/integration-accounts/:id` | |
| POST | `/webhooks/:provider` | Public stub. `mock` parses JSON `{ providerRef }`, writes `integration_events`, 200 |
| POST | `/restaurants/:restaurantId/channels/mock/orders` | Mock food-delivery ingest → `ONLINE` order, `source = partner:mock` |

## Analytics (Phase 11)

Permissions: `reports.view` for aggregates. Expense CRUD uses `restaurant.manage`. Money fields are integers (`*Minor`). Sales windows are **UTC** calendar day / ISO week (Monday) / month. Revenue is `sum(orders.total_minor)` for `COMPLETED` orders only. AOV is `trunc(revenue / orderCount)` (0 if no orders).

Stock valuation is **last-cost**: `sum(inventory_balances.quantity * inventory_items.unit_cost_minor)` in the item base unit.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/restaurants/:restaurantId/reports/sales` | Query `branchId`. `{ today, week, month, trend }` with `orderCount`, `revenueMinor`, `aovMinor` |
| GET | `/restaurants/:restaurantId/reports/items` | Top items from `order_items` name snapshots; category from live catalog when `menuItemId` exists |
| GET | `/restaurants/:restaurantId/reports/payments` | Sum `payments.amount_minor` by method (PAID / PARTIALLY_REFUNDED / REFUNDED) minus refunds |
| GET | `/restaurants/:restaurantId/reports/inventory` | `{ stock: { valuationMinor, method: LAST_COST }, expenses: { amountMinor, count } }` |
| GET | `/restaurants/:restaurantId/reports/operations` | Live `openOrders` + kitchen ticket counts (not BI) |
| GET/POST | `/restaurants/:restaurantId/expenses` | `{ category, amountMinor, branchId?, incurredAt?, notes? }` |
| PATCH/DELETE | `/restaurants/:restaurantId/expenses/:id` | |

## Operations (later phases)

Prefix resources by restaurant/branch when it reduces leakage, e.g. `/branches/:branchId/orders`.

Illustrative (not implemented until their phase):

| Resource | Examples |
| --- | --- |
| Orders | `/branches/:branchId/orders` |
| Payments | `/orders/:id/payments`, `/payments/:id/refunds` |
| Kitchen | `/branches/:branchId/kitchen/tickets` (implemented) |
| Inventory | `/branches/:branchId/inventory/items`, `.../transactions` (implemented) |
| Recipes | `/restaurants/:id/recipes` (implemented) |
| Delivery | `/deliveries`, `/delivery/me/shift` (implemented) |
| Reports | `/restaurants/:id/reports/sales` (implemented) |
| Platform | `/platform/metrics`, `/platform/organizations` |

## Health

`GET /health` liveness. `GET /ready` checks Postgres + Redis.

## Error codes (initial catalog)

`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `TENANT_MISMATCH`, `ORDER_NOT_FOUND`, `INVALID_STATE_TRANSITION`.
