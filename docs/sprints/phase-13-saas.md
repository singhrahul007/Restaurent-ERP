# Phase 13 — SaaS platform

## T-1301 Plans and subscriptions schema

**Objective:** plans, subscriptions, status trial/active/past_due.  
**Deps:** T-0201  
**AC:** Org 1:1 subscription.

## T-1302 Entitlement middleware

**Objective:** Feature flags / plan limits (e.g. branch cap).  
**Deps:** T-1301  
**AC:** Exceed limit 403 `PLAN_LIMIT`.

## T-1303 Trial start on org create

**Objective:** Hook from T-0203.  
**Deps:** T-1301  
**AC:** Trial end stored.

## T-1304 Invoice generation job

**Objective:** Worker + PDF or JSON invoice in object storage.  
**Deps:** T-1301, T-0011, T-0009  
**AC:** Retry/idempotent period key.

## T-1305 Billing portal API (provider port)

**Objective:** Use payment port; mock checkout in dev.  
**Deps:** T-1202, T-1301  
**AC:** Step-up for plan change.

## T-1306 Platform metrics API

**Objective:** Counts, MRR from subscriptions (document MRR formula).  
**Deps:** T-1301, T-0209  
**AC:** `platform.manage` only.

## T-1307 Super admin UI

**Objective:** Command center: tenants, trials, MRR, job failures (worker metrics stub).  
**Deps:** T-0306, T-1306  
**AC:** Distinct from owner UI.

## T-1308 Support issues stub

**Objective:** Optional `platform_tickets` table or skip if out of scope—**default skip**, use alerts table only.  
**Deps:** T-1307  
**AC:** If skipped, document in remaining issues.
