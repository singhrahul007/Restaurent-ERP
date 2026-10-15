# Phase 12 — Integrations, Food Aggregators & Omnichannel Revenue Hub

In the modern restaurant ecosystem, isolation is fatal. Phase 12 builds a hexagonal integration layer (ports and adapters) that connects the ERP to third-party delivery aggregators (Zomato, Swiggy, UberEats, DoorDash), payment hardware terminals, fiscal tax machines, WhatsApp business messaging, and automated customer marketing CRM.

---

## T-1201 Encrypted Integration Credentials & Provider Port Architecture

**Objective:** Secure vault for storing third-party API keys, webhook secrets, OAuth tokens, and branch-to-store external mapping configurations with symmetric encryption at rest.  
**Revenue Impact:** Protects sensitive restaurant API credentials and customer data from security breaches and compliance fines.  
**Scope:**
- `integrations`: `id`, `organization_id`, `branch_id`, `provider_type` (`AGGREGATOR_ZOMATO`, `AGGREGATOR_SWIGGY`, `PAYMENT_STRIPE`, `PAYMENT_RAZORPAY`, `MESSAGING_WHATSAPP`, `ACCOUNTING_QUICKBOOKS`), `credentials_encrypted`, `is_active`, `sync_status`, `last_synced_at`.
- AES-256-GCM encryption for credentials at rest using environment master secret key.
- Safe serialization: API GET responses strictly mask sensitive secrets (e.g. `sk_live_...4x9f`).
**Deps:** T-0201  
**Files Likely Affected:**
- `packages/database/src/schema/integrations.ts`
- `apps/api/src/modules/integrations/vault.ts`
**AC:**
1. Zero unencrypted API keys stored in the database.
2. API GET payloads never return plaintext secrets or API keys.

---

## T-1202 Payment Gateway Port & In-Store Terminal Adapter

**Objective:** Decoupled payment port supporting online checkout sessions, UPI dynamic QR generation, and in-store card terminal handoff (e.g. WisePOS, Stripe Terminal, Razorpay POS) with automated webhook ingestion.  
**Revenue Impact:** Fast-tracks customer table payments and eliminates manual credit card entry errors into POS terminals.  
**Scope:**
- Port Interface: `createPaymentIntent()`, `verifyWebhook()`, `capturePayment()`, `initiateRefund()`.
- Adapters: Stripe, Razorpay, and Mock Dev Adapter with full unit test coverage.
- Webhook processor: handles asynchronous payment captures and updates order status with replay protection.
**Deps:** T-0607  
**Files Likely Affected:**
- `packages/integrations/src/payments/port.ts`
- `packages/integrations/src/payments/stripe-adapter.ts`
- `apps/api/src/modules/payments/webhooks.ts`
**AC:**
1. Core payment business logic interacts solely with the abstract port interface, never direct vendor SDKs.
2. Webhook endpoints verify cryptographic signatures (`stripe-signature`, etc.) before processing payloads.

---

## T-1203 WhatsApp Business Conversational Engine & Review Bot

**Objective:** WhatsApp Business Cloud API integration for automated order status notifications, digital e-bill delivery, instant 1-click table re-ordering, and automated Google review requests.  
**Revenue Impact:** 5-star Google review volume increases by 300% via post-dining automated review links, directly driving new customer walk-ins; WhatsApp re-ordering generates recurring revenue.  
**Scope:**
- Templates: Order Confirmed, Food Out for Delivery, Digital Bill with Receipt Link, Post-Meal Feedback Survey.
- If customer rates 5/5 stars: automatically sends direct Google Maps review link; if customer rates < 3 stars: alerts floor manager privately to resolve issue before negative public review is posted.
**Deps:** T-0009, T-0612  
**Files Likely Affected:**
- `packages/integrations/src/messaging/whatsapp-adapter.ts`
- `apps/worker/src/processors/messaging.ts`
**AC:**
1. Automated messages triggered via BullMQ queue worker to prevent blocking POS checkout threads.
2. Supports opt-out (STOP keyword) to maintain strict WhatsApp policy compliance.

---

## T-1204 Third-Party Aggregator Bridge (Zomato / Swiggy / UberEats)

**Objective:** Unified Aggregator Hub: automatically ingests incoming orders from external delivery platforms into the central POS and KDS, syncs catalog menus, and pushes 86 out-of-stock items across all channels simultaneously.  
**Revenue Impact:** Eliminates the chaotic "tablet farm" where kitchen staff manually re-enter orders from 4 different aggregator tablets into the POS, cutting missed orders and dispatch delays.  
**Scope:**
- Ingest Webhook: normalizes incoming aggregator JSON order format into unified `orders` and `order_items` schema with `order_type = AGGREGATOR`.
- Central 86 Sync: toggling an item out of stock in the ERP sends push event to external aggregator APIs to pause item immediately.
- Mock aggregator testing suite simulating incoming peak-volume lunch rush orders.
**Deps:** T-0603, T-0506  
**Files Likely Affected:**
- `packages/integrations/src/aggregators/port.ts`
- `apps/api/src/modules/integrations/aggregators.ts`
**AC:**
1. Incoming external orders auto-print KOT or appear on KDS screen within 2 seconds of placement.
2. Price differences (e.g. +20% markup on aggregator menus compared to dine-in) handled transparently.

---

## T-1205 Automated Customer CRM & RFM Loyalty Ledger

**Objective:** Built-in customer relationship management (CRM) that profiles diners, tracks dining history, and runs automated Recency, Frequency, Monetary (RFM) segmentation:  
- **Champions:** Dine weekly, spend top 10%; rewarded with VIP booking and complimentary chef tastings.  
- **At-Risk / Lapsed:** Haven't visited in 45 days; targeted with automated "We miss you" personalized voucher.  
- **New Diners:** Visited once; sent welcome loyalty points to encourage second visit within 14 days.  
**Revenue Impact:** A 5% increase in diner retention increases restaurant profits by 25% to 75% (Bain & Company research).  
**Scope:**
- `customers`: `id`, `organization_id`, `name`, `phone`, `email`, `birthday`, `anniversary`, `total_visits`, `total_spend_minor`, `rfm_segment`, `loyalty_points_balance`.
- `loyalty_transactions`: `id`, `customer_id`, `order_id`, `points_earned`, `points_redeemed`, `balance_after`.
**Deps:** T-0603, T-1101  
**Files Likely Affected:**
- `packages/database/src/schema/customers.ts`
- `apps/api/src/modules/crm/rfm-segmentation.ts`
- `apps/web/app/dashboard/crm/page.tsx`
**AC:**
1. Customer phone number lookup during POS checkout auto-loads profile, favorites, dietary allergies, and redeemable points.
2. Background cron job recalculates RFM customer segmentation weekly.

---

## T-1206 Accounting Export Port (Tally / QuickBooks / CSV)

**Objective:** Automated daily sales summaries and cost ledger exports formatted for standard accounting software (Tally Prime, QuickBooks, Xero, Zoho Books).  
**Revenue Impact:** Eliminates 10+ hours per week of manual bookkeeper data entry and prevents costly year-end tax discrepancies.  
**Scope:**
- Daily Journal Entry generation: Debits (Cash in Hand, Bank Accounts, Gateway In-Transit) = Credits (Sales Revenue, Tax Liabilities, Service Charges).
- Export endpoints supporting CSV, JSON, and direct XML push for Tally.
**Deps:** T-1103, T-1104  
**Files Likely Affected:**
- `apps/api/src/modules/integrations/accounting.ts`
**AC:**
1. Journal debits and credits always balance exactly to the cent/paise (`Debits == Credits`).
2. Export files conform strictly to standard vendor schema specifications.
