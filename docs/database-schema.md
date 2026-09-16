# Database domain map

PostgreSQL. PK `id uuid`. Tenant tables include `organization_id uuid not null` referencing `organizations(id)`. Operational tables that are branch-scoped also include `restaurant_id` and `branch_id`. Soft delete only where legally/audit required (`deleted_at`); prefer immutable financial rows.

Timestamps: `created_at`, `updated_at` (`timestamptz`). Actor: `created_by` / `updated_by` where an action is attributable.

## Isolation

- Application: every query filters `organization_id = ctx.organizationId`.
- RLS: enable on tenant tables; policy `organization_id = current_setting('app.organization_id')::uuid`.
- API sets `SET LOCAL app.organization_id` at transaction start (`setLocalOrganizationId` in `packages/database/src/rls.ts`).
- **FK delete:** `organizations` cannot be deleted while `memberships` or `restaurants` exist (`ON DELETE RESTRICT`). User delete cascades memberships. Restaurant delete cascades branches, settings, and assignments. `membership_roles.role_id` is `RESTRICT`.
- Branches store `pos_idle_timeout_minutes` (default 15) for POS session lock.
- Platform tables (`platform_*`, `users` global identity) are not org-scoped; access via `platform.manage`.

`users` is global (email unique). Access to restaurants is via `memberships` and `branch_assignments`.

## Core identity

| Table | Purpose |
| --- | --- |
| `users` | Login identity, email, phone, password_hash, mfa_secret_encrypted nullable, status |
| `sessions` | Refresh token hash, device, user_agent, ip, expires_at, revoked_at |
| `email_verifications` / `otp_challenges` | Short-lived hashed codes |
| `organizations` | Tenant; billing customer later |
| `memberships` | user ↔ organization; unique `(user_id, organization_id)`; `is_owner`; org FK **RESTRICT** |
| `membership_roles` | membership ↔ role (many roles) |
| `roles` | org-defined or system seed; `is_system` |
| `permissions` | Catalog strings |
| `role_permissions` | M2M |
| `restaurants` | Belongs to organization |
| `branches` | Belongs to restaurant |
| `branch_assignments` | membership or user + branch + optional role override |
| `audit_logs` | actor, org, action, resource, metadata jsonb (no secrets) |

**Denormalization:** `audit_logs.metadata` is JSON for variable context. Not a source of truth for money or stock.

## Restaurant setup

| Table | Purpose |
| --- | --- |
| `restaurant_settings` | 1:1 with restaurant; timezone default Asia/Kolkata, currency INR, tax inclusive, inventory policy `OFF`/`ON_SALE`/`MANUAL`, address |
| `dining_tables` | Per branch; unique `(branch_id, code)`; not POS sessions |
| `staff_profiles` | employment fields linked to user + org |
| `shifts` | planned intervals per branch |
| `shift_punches` | clock in/out |

## Menu

| Table | Purpose |
| --- | --- |
| `menu_categories` | per restaurant; optional `parent_id` tree |
| `menu_items` | name, description, `base_price_minor` bigint, tax_class_id, available |
| `menu_item_variants` | size/sku, `price_delta_minor` bigint |
| `modifier_groups` | min/max select (`max >= min`) |
| `modifiers` | `price_delta_minor` bigint |
| `menu_item_modifier_groups` | M2M |
| `tax_classes` | name, inclusive flag |
| `tax_rates` | integer basis points: `rate_bps`, `cgst_bps`, `sgst_bps`, `igst_bps`; effective dates |
| `menu_availability_overrides` | 86 overlay; `branch_id` null = restaurant-wide |

Menu prices are **current selling prices** in integer minor units. Historical order lines store frozen amounts (`freezeMenuLine`). POS reads `effectiveAvailable` from item + overlay.

## Customers

| Table | Purpose |
| --- | --- |
| `customers` | org-scoped guest CRM |
| `customer_addresses` | delivery |
| `customer_notes` | |

## Orders and kitchen

| Table | Purpose |
| --- | --- |
| `orders` | type DINE_IN / TAKEAWAY / DELIVERY / ONLINE; `source` (default `pos`); optional `source_external_id` for partners; integer totals; no payment status column |
| `order_items` | frozen item/variant names, qty, unit_price_minor, line totals |
| `order_item_modifiers` | snapshot |
| `order_discounts` | percent_bps or amount_minor |
| `order_status_history` | immutable transitions |
| `coupons` / `coupon_redemptions` | one coupon per order; max_redemptions across orders |
| `outbox` | topic + payload; `published_at` null until processed |
| `kitchen_tickets` | one ticket per confirmed order; status NEW / IN_PROGRESS / READY / CANCELLED |
| `kitchen_ticket_items` | name, qty, modifier names JSON (no prices) |

Order `status` enum: `DRAFT`, `CREATED`, `CONFIRMED`, `PREPARING`, `READY`, `SERVED`, `HANDED_OVER`, `COMPLETED`, `CANCELLED`.

Do not store payment status on `orders`. Balance = `total_minor` − (captured payments − refunds).

## Payments

| Table | Purpose |
| --- | --- |
| `payments` | order_id, amount_minor, status, method (`CASH`) |
| `refunds` | payment_id, amount_minor, reason; cannot exceed captured remainder |

Payment status lives on `payments` only (`PENDING`, `PAID`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`). Creating a payment does not change `orders.status`. Order balance = `total_minor` − (captured payments − refunds).

## Inventory and recipes

| Table | Purpose |
| --- | --- |
| `units` | restaurant-scoped codes; default g/kg, ml/l, each |
| `unit_conversions` | from_unit, to_unit, integer numerator/denominator (no float) |
| `inventory_items` | SKU unique per restaurant, track_stock, low_stock_threshold, `unit_cost_minor` last-cost per base unit |
| `inventory_balances` | item + branch, quantity as integer in the item **base unit** |
| `inventory_transactions` | type, qty_base, qty_in_unit, unit, reason, actor, reference, idempotency_key unique per org |
| `suppliers` | |
| `purchase_orders` / `purchase_order_lines` | |
| `wastage_records` | links to transaction |
| `recipes` | unique per menu item, or per item+variant; lines in base units |
| `recipe_lines` | inventory_item, qty_base integer |
| `inventory_consumptions` | unique order_id for SALE_CONSUMPTION idempotency; `reversed_at` for refund reverse |

**Quantity storage:** store inventory in integer **base units** (e.g. milligrams, millilitres, each). Display converts via `units`. Never float.

**Stock valuation (reports):** last-cost estimate = on-hand `quantity` × `unit_cost_minor`. Default cost is 0 until set on the item.

Transaction types: `PURCHASE`, `SALE_CONSUMPTION`, `WASTAGE`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `RETURN`.

## Delivery

| Table | Purpose |
| --- | --- |
| `delivery_agents` | user + org, unique, online flag |
| `deliveries` | order_id unique; composite FK `(order_id, order_type)` to `orders` with type `DELIVERY`; otp_hash; integer `cod_amount_minor` / `cod_collected_minor` |
| `delivery_events` | ASSIGNED, PICKED_UP, DELIVERED, COD_RECORDED, CANCELLED |

## Finance ops

| Table | Purpose |
| --- | --- |
| `expenses` | restaurant, optional branch, category (varchar), `amount_minor`, `incurred_at` |
| `expense_categories` | not used in v1; category is a string on `expenses` |

## SaaS billing (Phase 13)

| Table | Purpose |
| --- | --- |
| `subscription_plans` | platform |
| `subscriptions` | organization |
| `invoices` | |
| `feature_flags` | |

## Platform

| Table | Purpose |
| --- | --- |
| `platform_alerts` | |
| `integration_accounts` | org + provider, AES-GCM `credentials_encrypted`; API GET is masked |
| `integration_events` | inbound/outbound raw payloads for debug |
| `outbox` | event payload, published_at |
| `idempotency_keys` | |

## Indexing (initial)

- Unique `(organization_id, email)` not on users — users email global unique
- `orders (organization_id, restaurant_id, status, created_at)`
- `order_items (organization_id, item_name)`
- `payments (organization_id, method, created_at)`
- `memberships (user_id, organization_id)` unique
- `orders (organization_id, branch_id, created_at desc)`
- `orders (organization_id, idempotency_key)` unique
- `inventory_transactions (organization_id, inventory_item_id, created_at)`
- `audit_logs (organization_id, created_at)`
- `sessions (user_id, expires_at)`

## Critical transactions

- Order confirm + kitchen tickets + outbox
- Inventory movement: insert transaction + update/insert balance (and wastage/outbox) in one tx
- Purchase receive: lock PO, PURCHASE rows, mark RECEIVED
- Branch transfer: TRANSFER_OUT + TRANSFER_IN in one tx
- Payment record + order completion eligibility
- Recipe consume: lock balances, insert `SALE_CONSUMPTION` transactions, insert consumption row (unique order_id) in the same tx as order complete
- Full refund of a consumed order: `RETURN` txs + set `reversed_at` (idempotent)
- Refresh token rotation: revoke old, insert new, same tx
