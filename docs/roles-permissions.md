# Roles and permissions

Authorization is **permission strings**, not `if (role === 'CASHIER')` in services. Roles are bundles. A user may hold **multiple roles** in an organization. Branch assignments can **narrow** restaurant-wide roles (cannot grant permissions the membership does not have).

## System roles (seeded, `is_system = true`)

| Role | Intent | Typical permissions |
| --- | --- | --- |
| `SUPER_ADMIN` | Platform operator; not an org member by default | `platform.manage` plus read of platform metrics |
| `RESTAURANT_OWNER` | Org owner / full restaurant control | All org permissions except `platform.manage` |
| `RESTAURANT_MANAGER` | Branch/restaurant operations | View/manage ops; no billing/ownership; limited staff |
| `RECEPTIONIST` | Front of house | tables, orders create/update, customers; no refunds unless granted |
| `CASHIER` | POS | orders + payments.create; refunds optional |
| `COOK` | Kitchen | kitchen tickets; `orders.view` kitchen-safe; **no** payments, reports financials, inventory costs |
| `DELIVERY_AGENT` | Own deliveries only | delivery self + assigned order subset |

Custom roles allowed later via `settings.manage`; cannot include `platform.manage`.

## Permission catalog (v1)

```
platform.manage

restaurant.view
restaurant.manage

branch.view
branch.manage

staff.view
staff.manage

menu.view
menu.manage

orders.view
orders.create
orders.update
orders.cancel

payments.view
payments.create
payments.refund

inventory.view
inventory.manage

reports.view

settings.view
settings.manage

customers.view
customers.manage

kitchen.view
kitchen.update

delivery.view
delivery.manage
delivery.self

tables.view
tables.manage
```

Add permissions only with a migration + catalog update in `packages/auth`. Never string-compare ad hoc.

## Enforcement

- Fastify `preHandler` `requirePermission('orders.create')`
- Resource checks: order.branch_id in user’s branch set (unless owner/manager with restaurant-wide)
- COOK: strip financial fields in serializers (`toKitchenOrderDto`)
- DELIVERY_AGENT: `WHERE deliveries.agent_id = ctx.userId` unless `delivery.manage`
- SUPER_ADMIN: impersonation / org switch is a **sensitive action** (re-auth + audit)

## Role × UI shell

| Role | App shell |
| --- | --- |
| SUPER_ADMIN | Platform command center (`/platform`) |
| RESTAURANT_OWNER | Analytics shell (`/o/:orgId`) |
| RESTAURANT_MANAGER | Operations shell |
| RECEPTIONIST / CASHIER | POS workspace (`/pos`) — speed layout |
| COOK | KDS fullscreen (`/kds`) |
| DELIVERY_AGENT | PWA mobile shell (`/driver`) |

Route guards in Next.js are UX only. API is authoritative.

## Default seed matrix

Documented fully in code during Phase 1. Summary:

- Owner: all org permissions
- Manager: all except `settings.manage` billing-level, `payments.refund` configurable, no `platform.manage`
- Cashier: menu.view, orders.*, payments.view/create, customers.view, tables.view
- Receptionist: like cashier minus payments.create (or include if dual-role)
- Cook: kitchen.*, orders.view (filtered)
- Delivery: delivery.self, orders.view (assigned)
