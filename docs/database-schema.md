# Database domain map

PostgreSQL. PK `id uuid`. Tenant tables include `organization_id uuid not null` referencing `organizations(id)`. Operational tables that are branch-scoped also include `restaurant_id` and `branch_id`. Soft delete only where legally/audit required (`deleted_at`); prefer immutable financial rows.

Timestamps: `created_at`, `updated_at` (`timestamptz`). Actor: `created_by` / `updated_by` where an action is attributable.

## Isolation

- Application: every query filters `organization_id = ctx.organizationId`.
- RLS: enable on tenant tables; policy `organization_id = current_setting('app.organization_id')::uuid`.
- API sets `SET LOCAL app.organization_id` at transaction start (`setLocalOrganizationId` in `packages/database/src/rls.ts`).
- **FK delete:** `organizations` cannot be deleted while `memberships` or `restaurants` exist (`ON DELETE RESTRICT`). User delete cascades memberships. Restaurant delete cascades branches and assignments. `membership_roles.role_id` is `RESTRICT`.
- Platform tables (`platform_*`, `users` global identity) are not org-scoped; access via `platform.manage`.

`users` is global (email unique). Access to restaurants is via `memberships` and `branch_assignments`.

## Core identity

| Table | Purpose |
| --- | --- |
| `users` | Login identity, email, phone, password_hash, mfa_secret_encrypted nullable, status |
| `sessions` | Refresh token hash, device, user_agent, ip, expires_at, revoked_at |
| `email_verifications` / `otp_challenges` | Short-lived hashed codes |
| `organizations` | Tenant; billing customer later |
| `memberships` | user ↔ organization; `is_owner` flag |
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
| `restaurant_settings` | timezone, currency, tax inclusive flag, inventory policy |
| `tables` | floor, capacity, status, qr_token_hash |
| `staff_profiles` | employment fields linked to user + org |
| `shifts` | planned intervals per branch |
| `shift_punches` | clock in/out |

## Menu

| Table | Purpose |
| --- | --- |
| `menu_categories` | per restaurant (or branch overlay later) |
| `menu_items` | name, description, base_price_minor, tax_class_id, available |
| `menu_item_variants` | size/sku, price_delta_minor |
| `modifier_groups` | min/max select |
| `modifiers` | price_delta_minor |
| `menu_item_modifier_groups` | M2M |
| `tax_classes` / `tax_rates` | GST-style rates; effective dates |

Menu prices are **current selling prices**. Historical order lines store frozen amounts.

## Customers

| Table | Purpose |
| --- | --- |
| `customers` | org-scoped guest CRM |
| `customer_addresses` | delivery |
| `customer_notes` | |

## Orders and kitchen

| Table | Purpose |
| --- | --- |
| `orders` | type, status, table_id, customer_id, branch_id, idempotency_key unique per org |
| `order_items` | item snapshot name, qty, unit_price_minor, line totals |
| `order_item_modifiers` | snapshot |
| `order_discounts` | |
| `order_status_history` | immutable transitions |
| `kitchen_tickets` | derived from order for a station/branch |
| `kitchen_ticket_items` | |
| `coupons` / `coupon_redemptions` | |

Order `status` enum: `DRAFT`, `CREATED`, `CONFIRMED`, `PREPARING`, `READY`, `SERVED`, `HANDED_OVER`, `COMPLETED`, `CANCELLED`.

Do not store payment status on `orders`.

## Payments

| Table | Purpose |
| --- | --- |
| `payments` | order_id, amount_minor, status, method, provider |
| `payment_attempts` | PSP raw normalized |
| `refunds` | payment_id, amount_minor, reason |

Payment status: `PENDING`, `PARTIALLY_PAID` (derived or on order **balance** view), `PAID`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`. Prefer computing order balance from sum(payments) − sum(refunds) vs order total.

## Inventory and recipes

| Table | Purpose |
| --- | --- |
| `units` | org units |
| `unit_conversions` | from_unit, to_unit, factor as rational stored as integer numerator/denominator |
| `inventory_items` | SKU, track_stock |
| `inventory_balances` | item + branch, quantity as integer in **base unit minor** (e.g. milligrams / millilitres) documented per unit type |
| `inventory_transactions` | type, qty, unit, source, reference_type, reference_id, actor |
| `suppliers` | |
| `purchase_orders` / `purchase_order_lines` | |
| `wastage_records` | links to transaction |
| `recipes` | menu_item (+ variant) |
| `recipe_lines` | inventory_item, qty in base unit |
| `inventory_consumptions` | order_id unique for idempotency of SALE_CONSUMPTION |

**Quantity storage:** store inventory in integer **base units** (e.g. milligrams, millilitres, each). Display converts via `units`. Never float.

Transaction types: `PURCHASE`, `SALE_CONSUMPTION`, `WASTAGE`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `RETURN`.

## Delivery

| Table | Purpose |
| --- | --- |
| `delivery_agents` | user + org, online flag |
| `deliveries` | order_id, agent_id, status, otp_hash, cod_amount_minor |
| `delivery_events` | |

## Finance ops

| Table | Purpose |
| --- | --- |
| `expenses` | branch, category, amount_minor |
| `expense_categories` | |

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
| `integration_accounts` | org + provider, encrypted secrets |
| `outbox` | event payload, published_at |
| `idempotency_keys` | |

## Indexing (initial)

- Unique `(organization_id, email)` not on users — users email global unique
- `memberships (user_id, organization_id)` unique
- `orders (organization_id, branch_id, created_at desc)`
- `orders (organization_id, idempotency_key)` unique
- `inventory_transactions (organization_id, inventory_item_id, created_at)`
- `audit_logs (organization_id, created_at)`
- `sessions (user_id, expires_at)`

## Critical transactions

- Order confirm + kitchen tickets + outbox
- Payment record + order completion eligibility
- Recipe consume: lock balances, insert transactions, insert consumption row (unique order_id)
- Refund + optional stock reversal
- Refresh token rotation: revoke old, insert new, same tx
