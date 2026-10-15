# Sprint Index & Master Execution Roadmap

This directory contains the atomic, production-ready implementation sprints for the **Niva Multi-Tenant Restaurant Operating System (ERP)**. Every sprint is engineered to solve modern restaurant operational challenges, prevent financial leakage, maximize revenue, and guarantee enterprise-grade stability.

---

## Sprint Modules Overview

| Phase | Sprint File | Focus Area & Revenue Impact | Task Range |
| :---: | :--- | :--- | :---: |
| **00** | [phase-00-foundation.md](./phase-00-foundation.md) | Monorepo, Docker, Postgres/Redis/MinIO, Drizzle ORM, Event Bus | `T-0001`–`T-0012` |
| **01** | [phase-01-identity.md](./phase-01-identity.md) | Multi-factor Auth, RBAC, JWT rotation, Auditing, Staff PINs | `T-0101`–`T-0114` |
| **02** | [phase-02-tenancy.md](./phase-02-tenancy.md) | Tenant isolation, Organizations, Multi-Branch hierarchy | `T-0201`–`T-0210` |
| **03** | [phase-03-design-system.md](./phase-03-design-system.md) | High-contrast UI tokens, Touch primitives, Audio alerts | `T-0301`–`T-0308` |
| **04** | [phase-04-restaurant-setup.md](./phase-04-restaurant-setup.md) | Branch profiles, Fiscal tax IDs, Table layout editor, Staff | `T-0401`–`T-0408` |
| **05** | [phase-05-menu.md](./phase-05-menu.md) | **Menu Engineering, Modifiers, Dayparts, Realtime 86 Sync** | `T-0501`–`T-0508` |
| **06** | [phase-06-pos-orders.md](./phase-06-pos-orders.md) | **Offline POS, Split Bills, Shift Close Z-Report, QSR Token Display** | `T-0601`–`T-0616` |
| **07** | [phase-07-kitchen.md](./phase-07-kitchen.md) | **Station KDS, Expediter Expo Screen, Waiter Captain App** | `T-0701`–`T-0707` |
| **08** | [phase-08-inventory.md](./phase-08-inventory.md) | **Inventory Control, Supplier PO/GRN, Par Levels, Wastage** | `T-0801`–`T-0808` |
| **09** | [phase-09-recipes.md](./phase-09-recipes.md) | **Sub-Recipes, BOMs, Auto-Depletion, TvA Variance Loss** | `T-0901`–`T-0905` |
| **10** | [phase-10-delivery.md](./phase-10-delivery.md) | **Driver Fleet, Proof OTP, COD Reconciliation, TRM Reservations** | `T-1001`–`T-1009` |
| **11** | [phase-11-analytics.md](./phase-11-analytics.md) | **Menu Matrix (BCG), 94+ Report Catalog, AI Natural Language BI** | `T-1101`–`T-1107` |
| **12** | [phase-12-integrations.md](./phase-12-integrations.md) | **Aggregator Hub (Zomato/Swiggy), WhatsApp Bot, RFM CRM** | `T-1201`–`T-1206` |
| **13** | [phase-13-saas.md](./phase-13-saas.md) | **Multi-Tenant SaaS, Automated Billing, MRR BI, Super-Admin** | `T-1301`–`T-1308` |
| **14** | [phase-14-hardening.md](./phase-14-hardening.md) | Security audit, Load testing, Backup drill, Production Gate | `T-1401`–`T-1408` |

---

## Execution Standards & Invariants

1. **Strict Money Integrity:** All prices, costs, taxes, tips, discounts, and payments are stored and calculated strictly as integer minor units (cents/paise). Floating-point math is banned.
2. **Hard Tenant Isolation:** Every database query must filter on `organization_id` derived exclusively from the authenticated session, never accepted from unverified request parameters.
3. **Double-Entry Stock Tracking:** No stock balance can ever increment or decrement without an immutable row created in `inventory_transactions` in the same database transaction.
4. **Independent Order vs. Payment State:** An order can be `SERVED` while `UNPAID` (dine-in standard), or `PAID` while `PREPARING` (counter service standard). Financial completion requires full settlement balance == 0.
5. **Offline & High-Traffic Resilience:** The POS cashier must remain functional to take orders and print receipts even during internet outages, queuing transactions for automatic background sync.
