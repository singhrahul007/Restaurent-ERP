# Roadmap

Do not implement a later phase’s product features during an earlier phase except shared foundations explicitly listed.

| Phase | Name | Outcome |
| --- | --- | --- |
| 0 | Foundation | Monorepo, Docker Postgres/Redis/MinIO, Drizzle, logging, errors, env |
| 1 | Identity | Users, sessions, refresh rotation, roles, permissions, audit, auth API |
| 2 | Multi-tenancy | Orgs, restaurants, branches, memberships, isolation tests |
| 3 | Design system | Tokens, primitives, empty/error/skeleton, motion policy |
| 4 | Restaurant setup | Profile, branches, tables, staff UI, settings |
| 5 | Menu | Categories, items, variants, modifiers, tax classes, availability |
| 6 | POS / orders | Incremental order/pay/cancel/refund; pricing service |
| 7 | Kitchen | Tickets, KDS, realtime |
| 8 | Inventory | Items, units, suppliers, purchases, transactions, low stock |
| 9 | Recipes | BOM, consume, reverse |
| 10 | Delivery | Agents, OTP, COD, PWA |
| 11 | Analytics | Sales, items, inventory, expenses, profit estimates |
| 12 | Integrations | Ports + verified providers only |
| 13 | SaaS | Plans, trials, billing, platform admin, flags |
| 14 | Hardening | Security review, load, backup restore, monitoring, go-live checklist |

## Dependency graph

Phase 0 → 1 → 2 is strictly serial.  
Phase 3 can overlap late Phase 2 (UI against mocked `/me`).  
Phase 4 depends on 2+3.  
Phase 5 depends on 4.  
Phase 6 depends on 5 + pricing module.  
Phase 7 depends on 6 + Socket.IO from 0.  
Phase 8 can start after 2; **consume** waits for 9.  
Phase 9 depends on 6+8.  
Phase 10 depends on 6.  
Phase 11 depends on 6+8+expenses.  
Phase 12 after 6 (payments) and 1 (webhooks).  
Phase 13 after 2.  
Phase 14 continuous from Phase 6 onward; formal gate before production.

## Sprint files

Atomic tasks: `docs/sprints/`. Execute in ID order unless a task marks optional.
