# Phase 13 — Multi-Tenant SaaS Platform, Subscription Billing & Feature Entitlements

Phase 13 turns the Restaurant ERP into a scalable, high-margin Software-as-a-Service (SaaS) business. It establishes automated billing cycles, subscription tiers (Starter, Growth, Multi-Chain Enterprise), feature gate enforcement, white-label tenant provisioning, automated invoice generation, and super-admin platform health monitoring.

---

## T-1301 SaaS Subscription Plans & Feature Tiers Schema

**Objective:** Database schema modeling subscription plans, billing frequencies (Monthly, Annual), feature limits (max branches, max POS terminals, KDS access, delivery fleet access, AI menu engineering), and tenant subscriptions.  
**Revenue Impact:** Unlocks recurring SaaS subscription revenue with smooth expansion revenue when clients open new branches or add registers.  
**Scope:**
- `saas_plans`: `id`, `name` (`STARTER`, `GROWTH`, `ENTERPRISE`), `monthly_price_minor`, `annual_price_minor`, `max_branches`, `max_terminals_per_branch`, `includes_kds`, `includes_inventory_boms`, `includes_aggregators`, `includes_crm_loyalty`, `is_active`.
- `saas_subscriptions`: `id`, `organization_id`, `plan_id`, `billing_cycle` (`MONTHLY`, `ANNUAL`), `status` (`TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELLED`), `trial_ends_at`, `current_period_start`, `current_period_end`, `cancel_at_period_end`.
**Deps:** T-0201  
**Files Likely Affected:**
- `packages/database/src/schema/saas.ts`
- `packages/types/src/saas.ts`
**AC:**
1. Exactly one active subscription per organization.
2. Tenant schema isolation guarantees billing data is isolated from general restaurant operational queries.

---

## T-1302 Dynamic Entitlement Guard & Plan Limit Enforcement

**Objective:** API middleware that intercepts requests and enforces plan entitlements (e.g. blocking branch creation when current branches >= plan max, or disabling KDS endpoints for Starter plan clients).  
**Revenue Impact:** Drives frictionless self-serve upsells when growing restaurant operators need advanced capabilities.  
**Scope:**
- Fast middleware evaluation using cached tenant subscription metadata in Redis.
- Returns explicit `403 FORBIDDEN_PLAN_LIMIT_REACHED` with payload detailing the required plan upgrade.
**Deps:** T-1301  
**Files Likely Affected:**
- `apps/api/src/middleware/entitlements.ts`
- `packages/auth/src/entitlements.ts`
**AC:**
1. Zero database query overhead on hot paths; plan entitlement bitmask cached in Redis session token.
2. Grace period handling: organizations in `PAST_DUE` state receive a 5-day warning banner before feature restriction occurs.

---

## T-1303 Instant Tenant Onboarding & 14-Day Free Trial Provisioning

**Objective:** Self-serve restaurant onboarding workflow: new user registers, system automatically provisions tenant organization, default tax classes, starter menu categories, demo tables, and starts a 14-day fully-featured Growth trial.  
**Revenue Impact:** Maximizes visitor-to-trial conversion by providing an instantly functional demo restaurant environment within 60 seconds of registration.  
**Scope:**
- Seed pipeline: creates organization, owner membership, 1 default branch, default currency, and starter demo menu items with sample photos.
- Initializes subscription with `status = 'TRIALING'` and `trial_ends_at = NOW() + 14 days`.
**Deps:** T-0203, T-1301  
**Files Likely Affected:**
- `apps/api/src/modules/onboarding/provision.ts`
- `apps/api/src/modules/organizations/create.ts`
**AC:**
1. Onboarding transaction creates complete working workspace in < 3 seconds.
2. Automated welcome email / WhatsApp message with quickstart guide dispatched via worker queue.

---

## T-1304 Automated Recurring Invoicing & Tax Receipt Generation

**Objective:** Background worker that handles subscription renewals, charges saved payment methods via payment ports (Stripe / Razorpay Subscriptions), and generates compliant tax invoice PDFs stored in MinIO/S3.  
**Revenue Impact:** Guarantees zero missed billing cycles and delivers compliant B2B tax invoices required by corporate restaurant groups.  
**Scope:**
- `saas_invoices`: `id`, `subscription_id`, `invoice_number`, `amount_minor`, `tax_minor`, `status` (`DRAFT`, `PAID`, `FAILED`), `pdf_url`, `billing_period_start`, `billing_period_end`.
- Worker cron job checks expiring periods daily and generates invoices with idempotent keys (`sub_{id}_{period_end}`).
**Deps:** T-1301, T-0011, T-0009  
**Files Likely Affected:**
- `apps/worker/src/processors/saas-billing.ts`
- `packages/pdf/src/invoice-generator.ts`
**AC:**
1. Idempotency guarantees no organization is ever double-billed for the same subscription period.
2. PDF invoice includes vendor GSTIN/VAT info, tenant business details, itemized plan fees, and payment receipt stamp.

---

## T-1305 Customer Self-Serve Billing Portal API & Upgrade Flow

**Objective:** Billing management portal allowing restaurant owners to view invoices, update credit cards, change billing cycles, upgrade/downgrade tiers, or cancel subscriptions.  
**Revenue Impact:** Empowers clients to instantly upgrade their own plans when expanding to new locations without waiting for manual sales support.  
**Scope:**
- Integrates with Stripe Customer Portal / Razorpay Subscriptions port.
- Proration calculation: upgrades take effect immediately with pro-rated billing charge; downgrades take effect at end of period.
**Deps:** T-1202, T-1301  
**Files Likely Affected:**
- `apps/api/src/modules/saas/portal.ts`
- `apps/web/app/dashboard/settings/billing/page.tsx`
**AC:**
1. Step-up MFA verification required for plan cancellation or primary credit card changes.
2. Proration calculations verify exact minor-unit credit against remaining days in current billing cycle.

---

## T-1306 Platform Executive Metrics & MRR Analytics API

**Objective:** Real-time business intelligence endpoints for platform operators: Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), Churn Rate, Average Revenue Per Account (ARPA), Active Trials, and Conversion %.  
**Revenue Impact:** Informs SaaS executive leadership where to allocate engineering and sales resources to drive maximal platform valuation.  
**Scope:**
- MRR Formula: `Sum(Active Monthly Subscriptions) + Sum(Active Annual Subscriptions / 12)`.
- Churn metrics: logo churn and net revenue churn rates over 30-day and 90-day moving windows.
- Accessible strictly to users with `platform.manage` / `SUPER_ADMIN` system credentials.
**Deps:** T-1301, T-0209  
**Files Likely Affected:**
- `apps/api/src/modules/platform/saas-metrics.ts`
- `packages/validation/src/platform.ts`
**AC:**
1. Completely isolated from restaurant tenant query scopes.
2. Returns aggregated MRR and churn metrics with sub-second response times.

---

## T-1307 Super-Admin Multi-Tenant Command Center UI

**Objective:** Platform control center for super-admins: browse all tenant organizations, inspect subscription statuses, view system-wide BullMQ job queues, grant trial extensions, and shadow-login (impersonation) for customer support.  
**Revenue Impact:** Fast-tracks customer issue resolution and minimizes support churn through immediate operational assistance.  
**Scope:**
- Tenant Directory: search by restaurant name, owner email, plan, or revenue volume.
- Impersonation mode: generates short-lived audit-logged token to view restaurant dashboard exactly as the client sees it.
- Failed job inspector: displays BullMQ dead-letter queues with 1-click retry.
**Deps:** T-0306, T-1306  
**Files Likely Affected:**
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/tenants/[id]/page.tsx`
**AC:**
1. Impersonation sessions strictly log every action into `audit_logs` with `is_impersonation: true` and the super-admin's real identity.
2. Complete visual separation from standard restaurant manager views.
