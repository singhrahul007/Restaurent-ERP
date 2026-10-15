# Phase 6 — POS, Table Turnover & Revenue Maximization

The POS is the operational heartbeat of the restaurant. Phase 6 transforms this module into a blazing-fast, offline-resilient, high-turnover sales terminal with intelligent upsell prompts, complex split billing, automated combo discounts, and rock-solid financial integrity.

---

## T-0601 Deterministic Pricing & Dynamic Upsell Engine

**Objective:** Pure calculation service: lines, variants, modifiers, quantity, tiered discounts, coupon codes, inclusive/exclusive taxes, service charges, tips, and fractional rounding rules.  
**Revenue Impact:** Accurately maximizes revenue through automated upsell bundle discounts (e.g. "Add a drink for only \$2") without manual cashier computation errors.  
**Scope:**
- Inputs: Order lines, branch tax policies, applied coupons, customer loyalty tier, auto-gratuity thresholds.
- Outputs: `subtotal_minor`, `discount_minor`, `tax_details` (per-rate breakdown), `service_charge_minor`, `rounding_delta_minor`, `grand_total_minor`.
- Algorithmic Combo Matching: checks line items against active combo definitions and applies package pricing automatically.
**Deps:** T-0508  
**Files Likely Affected:**
- `apps/api/src/modules/pricing/calculator.ts`
- `packages/types/src/pricing.ts`
**AC:**
1. Zero floating-point arithmetic; strictly minor integer cents/paise.
2. Comprehensive unit test suite covering 50+ real-world edge cases (split discounts, penny rounding, zero-tax items mixed with high-tax items).
3. Benchmark: executes full cart calculation in < 2ms.

---

## T-0602 Orders Schema, State Machine & Fraud-Proof Auditing

**Objective:** Database schema and formal deterministic state machine for order lifecycle: `DRAFT` → `CONFIRMED` → `IN_PREPARATION` → `READY` → `SERVED` → `COMPLETED` / `CANCELLED` / `REFUNDED`.  
**Revenue Impact:** Halts inventory theft and unauthorized order voids (a leading cause of 5-10% restaurant revenue leakage).  
**Scope:**
- `orders`: `id`, `organization_id`, `branch_id`, `order_number` (daily counter, e.g. #104), `order_type` (`DINE_IN`, `TAKEAWAY`, `DELIVERY`, `DRIVE_THRU`), `table_id`, `waiter_id`, `cashier_id`, `status`, `payment_status` (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`), financial summary minors.
- `order_items`: line snapshots, quantity, preparation status, fire-time, void reason.
- `order_state_history`: state transitions with timestamps, IP address, and authorizing employee ID.
**Deps:** T-0204, T-0503  
**Files Likely Affected:**
- `packages/database/src/schema/orders.ts`
- `apps/api/src/modules/orders/state-machine.ts`
**AC:**
1. Illegal state transitions throw `INVALID_STATE_TRANSITION` (e.g. `COMPLETED` cannot transition to `DRAFT`).
2. Voiding or deleting items after order is `CONFIRMED` requires explicit manager authorization reason code.

---

## T-0603 High-Speed Order Creation & Fast-Checkout API

**Objective:** Optimized API endpoint for rapid order creation with idempotency keys to handle high-concurrency peak rush periods.  
**Revenue Impact:** Shaves 30-45 seconds off each transaction, directly boosting lunch rush throughput and daily table turns.  
**Scope:**
- Idempotency via `idempotency-key` header cached in Redis for 24 hours.
- Automatic dining room table lock to prevent two waiters taking orders on the same table simultaneously.
**Deps:** T-0602, T-0601  
**Files Likely Affected:**
- `apps/api/src/modules/orders/create-order.ts`
**AC:**
1. Concurrent duplicate submissions with same idempotency key return identical response without creating duplicate orders.
2. Full transaction executes with lines, modifiers, and initial pricing in a single DB commit.

---

## T-0604 Realtime Item Increments, Fire Course & Hold Orders

**Objective:** Ability to add, modify, or send items to the kitchen in progressive batches ("Fire Starters", "Hold Mains", "Fire Desserts").  
**Revenue Impact:** Pacing dishes correctly increases diner satisfaction and encourages higher beverage & dessert ordering.  
**Scope:**
- `order_batches` or `kot_tickets`: groups newly added items into a Kitchen Order Ticket (KOT).
- Mutation guards: items already cooked/served cannot be mutated without a manager comp/void audit row.
**Deps:** T-0603  
**Files Likely Affected:**
- `apps/api/src/modules/orders/update-items.ts`
**AC:**
1. Recalculates order financial totals atomically inside a database transaction.
2. Generates incremental KOT containing only newly fired items.

---

## T-0605 Smart Discounts, Dynamic Happy Hour & Manager Comps

**Objective:** Flexible discounting: Percentage off, fixed amount off, complimentary (comp) items, item-level discounts, and automated Happy Hour / Daypart pricing.  
**Revenue Impact:** Drives off-peak foot traffic while enforcing strict discount caps and permission limits to stop employee fraud.  
**Scope:**
- Max discount threshold per role (e.g., Cashier max 10%, Floor Manager max 25%, Owner unlimited).
- Comp reason taxonomy (`CUSTOMER_COMPLAINT`, `STAFF_MEAL`, `VIP_GUEST`, `SPILLAGE`).
**Deps:** T-0604  
**Files Likely Affected:**
- `apps/api/src/modules/orders/discounts.ts`
- `packages/validation/src/discounts.ts`
**AC:**
1. Applying a discount that exceeds cashier's role limit returns `FORBIDDEN_MANAGER_APPROVAL_REQUIRED`.
2. Total discount cannot exceed order subtotal (subtotal cannot become negative).

---

## T-0606 Intelligent Coupon Redemption & Referral Rewards

**Objective:** Coupon engine supporting single-use codes, minimum order value (MOV), expiry dates, customer-specific referral rewards, and max usage limits.  
**Revenue Impact:** Powers customer acquisition campaigns and trackable influencer/local corporate marketing promotions.  
**Scope:**
- `coupons`: `code`, `discount_type` (`PERCENT`, `FLAT`), `discount_value`, `min_order_value_minor`, `max_discount_minor`, `valid_from`, `valid_until`, `usage_limit`, `times_used`.
- `coupon_redemptions`: audit log attaching order, customer, and saved money.
**Deps:** T-0605  
**Files Likely Affected:**
- `packages/database/src/schema/orders.ts`
- `apps/api/src/modules/orders/coupons.ts`
**AC:**
1. Concurrency-safe: atomic increment of `times_used` prevents double-redemption of single-use coupons during simultaneous checkouts.
2. Rejects expired or sub-threshold coupons with descriptive error codes.

---

## T-0607 Flexible Multi-Method Split Payments & Tips

**Objective:** Advanced payment ledger: Cash, Credit/Debit Card, UPI / QR, Digital Wallets, House Account, and Gift Cards, with split billing capabilities.  
**Revenue Impact:** Eliminates checkout bottlenecks when large groups dine together and wish to pay separately.  
**Scope:**
- Split types: Equal split across N people, split by item/seat, custom amount split (e.g. \$40 cash + \$60 card on a \$100 bill).
- Gratuity / Tip capture: recorded separately from revenue for tip-pool distribution.
- `payments`: `id`, `order_id`, `method`, `amount_minor`, `tip_minor`, `status`, `reference_no`, `gateway_tx_id`.
**Deps:** T-0603  
**Files Likely Affected:**
- `packages/database/src/schema/payments.ts`
- `apps/api/src/modules/payments/process-payment.ts`
**AC:**
1. Order `payment_status` transitions from `PARTIALLY_PAID` to `PAID` only when sum of captured payments equals or exceeds `grand_total_minor`.
2. Overpayments automatically compute and return cash change minor.

---

## T-0608 Transactional Order Confirmation & Outbox Event Bus

**Objective:** Atomically transition order to `CONFIRMED` and stage domain events into the transactional outbox (`order.confirmed`, `kot.generated`, `inventory.reserve_triggered`).  
**Revenue Impact:** 100% guarantee that kitchen screens, inventory balances, and reporting systems never drop an order even under server reboots.  
**Scope:**
- Outbox pattern: writes to `orders` and `outbox_events` in the same PostgreSQL transaction.
- Outbox worker polls and pushes to Redis/BullMQ and Socket.IO.
**Deps:** T-0603, T-0010  
**Files Likely Affected:**
- `apps/api/src/modules/orders/confirm-order.ts`
- `apps/worker/src/processors/outbox.ts`
**AC:**
1. Zero phantom orders: outbox event cannot exist if order write fails, and order cannot be confirmed without outbox record.

---

## T-0609 Order Completion, Table Release & Receipt Archival

**Objective:** Clean completion lifecycle: checks all food items are marked served, payments captured, releases table status to `CLEANING_REQUIRED` / `AVAILABLE`, and saves immutable PDF/thermal receipt payload.  
**Revenue Impact:** Accelerates table turnover time—immediately notifying hostesses that table is open for the next seating.  
**Scope:**
- Validates balance due == 0 before allowing `COMPLETED`.
- Emits `table.status_changed` to update visual floor map.
**Deps:** T-0607, T-0608  
**Files Likely Affected:**
- `apps/api/src/modules/orders/complete-order.ts`
**AC:**
1. Order cannot transition to `COMPLETED` if outstanding balance > 0 (unless explicitly tagged as corporate house account).
2. Linked table status is automatically updated to available for waitlist seating.

---

## T-0610 Offline-First POS Cashier Workspace UI

**Objective:** Modern cashier interface built for speed: keyboard shortcuts (`/` quick search, `F1` pay, `F2` hold, `Esc` back), touch-friendly category cards, customizable quick-action buttons, and visual upsell badges.  
**Revenue Impact:** Cashiers can punch a 5-item order in under 10 seconds, drastically reducing customer wait times.  
**Scope:**
- Built with React, Tailwind CSS, TanStack Query, and Zustand/Redux for local state.
- Offline mode: local browser caching via IndexedDB; queues orders locally if internet connection drops and syncs seamlessly upon reconnection.
**Deps:** T-0307, T-0507, T-0604  
**Files Likely Affected:**
- `apps/web/app/pos/page.tsx`
- `packages/ui/src/components/pos-cart.tsx`
**AC:**
1. Full keyboard-only workflow supported for high-speed counter service.
2. Network drop indicator appears without freezing the screen; local orders queue successfully.

---

## T-0611 Interactive Visual Floor Plan & Table Management UI

**Objective:** Interactive 2D floor plan editor and live status viewer (Sections: Indoor, Patio, Bar; Tables: 2-top, 4-top, Round, Booth).  
**Revenue Impact:** Visual color-coding (Occupied, Reserved, Bill Requested, Idle > 45m) enables managers to optimize seating capacity and turn tables 20% faster.  
**Scope:**
- Table badges: Elapsed seating timer, current ticket total, waiter assigned.
- Drag-and-drop table merging (e.g. joining Table 4 + 5 for a party of 8) and order shifting.
**Deps:** T-0405, T-0610  
**Files Likely Affected:**
- `apps/web/app/pos/tables/page.tsx`
- `packages/ui/src/components/floor-plan.tsx`
**AC:**
1. Table merge combines items into a unified bill while retaining original seat origins.
2. Seat transfers update KDS tickets immediately.

---

## T-0612 Thermal Receipt Printing & Digital E-Bill (WhatsApp / SMS)

**Objective:** Dual receipt generation: ESC/POS direct network/USB thermal printing (80mm/58mm standard) and zero-paper digital e-bill sent directly via WhatsApp/SMS with guest feedback link.  
**Revenue Impact:** Saves on paper rolls while capturing customer phone numbers for marketing CRM with high opt-in compliance.  
**Scope:**
- Raw ESC/POS bytecode generator for thermal receipt printers (EPSON, Star Micronics, TVS).
- QR code printed on physical receipt for instant UPI payment or Google review submission.
**Deps:** T-0607, T-0610  
**Files Likely Affected:**
- `packages/printing/src/escpos-builder.ts`
- `apps/api/src/modules/orders/receipt.ts`
**AC:**
1. Receipt layout includes business GSTIN/Tax ID, itemized rates, discounts, service charge, and tax breakups.
2. Supports browser print fallback (`window.print`) and network IP socket print.

---

## T-0613 Order Cancellation & Wastage Accountability

**Objective:** Secure order cancellation workflow requiring mandatory manager credentials and categorizing whether prepared food was wasted or returned to inventory.  
**Revenue Impact:** Holds staff accountable for mistakes and prevents kitchen inventory leakage disguised as fake cancellations.  
**Scope:**
- Cancellation reason codes (`CUSTOMER_WALKOUT`, `PREPARATION_DELAY`, `ORDER_MISTAKE`, `DUPLICATE`).
- Reverse inventory flag: if food not yet cooked, restock ingredients; if cooked, log to wastage loss ledger.
**Deps:** T-0608  
**Files Likely Affected:**
- `apps/api/src/modules/orders/cancel-order.ts`
**AC:**
1. Completed or already paid orders cannot be cancelled via this endpoint—must go through formal refund workflow.
2. Audit log stores manager ID, timestamp, and financial loss incurred.

---

## T-0614 Partial & Full Refund Workflow with Gateway Reversal

**Objective:** Multi-tier refund engine: full bill refunds, line-item partial refunds, service charge waivers, or issuing restaurant store credit / gift voucher.  
**Revenue Impact:** Resolves customer disputes professionally while preserving customer lifetime value (LTV) through store credit alternatives.  
**Scope:**
- `refunds`: `id`, `payment_id`, `order_id`, `amount_minor`, `reason`, `authorized_by_id`, `gateway_refund_id`, `created_at`.
- Integrates with payment ports (Stripe, Razorpay, Cash drawer return).
**Deps:** T-0607  
**Files Likely Affected:**
- `packages/database/src/schema/payments.ts`
- `apps/api/src/modules/payments/refunds.ts`
**AC:**
1. Cumulative refunds cannot exceed the original captured payment amount.
2. Initiates automated gateway refund or records cash disbursement in till drawer reconciliation.

---

## T-0615 Cash Drawer Reconciliation, Shift Handover & Day-End (Z-Report)

**Objective:** End-of-shift and end-of-day closure workflow: cashier declares denomination counts (e.g. count of 500s, 200s, 100s, 50s), system calculates expected cash (`Opening Float + Cash Sales - Paid Expenses`), highlights discrepancy variance, and locks register till next shift.  
**Industry Benchmark (Petpooja Shift Close & Day End Report):** Blocks closing if bills remain in unpaid status; generates formal X-Report (live mid-shift audit) and Z-Report (day closure).  
**Scope:**
- `pos_shifts`: `id`, `branch_id`, `register_id`, `cashier_id`, `opened_at`, `closed_at`, `opening_float_minor`, `expected_cash_minor`, `actual_cash_minor`, `cash_discrepancy_minor`, `card_total_minor`, `upi_total_minor`, `status` (`OPEN`, `CLOSED`).
- Denomination breakdown JSON object: `{ "500": 10, "200": 5, "100": 20 }`.
- Print Day-End Z-Report to thermal printer and send summary email to store owner.
**Deps:** T-0607, T-0408  
**Files Likely Affected:**
- `packages/database/src/schema/payments.ts`
- `apps/api/src/modules/pos/shifts.ts`
- `apps/web/app/pos/shift-close/page.tsx`
**AC:**
1. Cannot execute Day-End close if active orders remain un-settled in DRAFT or UNPAID status.
2. Discrepancy (cash shortage or excess) logged permanently to audit trail with mandatory cashier explanation note.

---

## T-0616 QSR Token Management System (TMS) & Calling Screen

**Objective:** Quick Service Restaurant (QSR) customer pickup token system: auto-generates 2- or 3-digit daily token number (e.g., #042) on bill and powers a live TV pickup display board split into "Preparing" and "Ready for Pickup".  
**Industry Benchmark (Petpooja Token Display & Audio Chime):** Displays order readiness on a counter screen with automated text-to-speech voice callout ("Token 42 is ready for collection").  
**Scope:**
- Daily cycling token generator per branch counter.
- Live fullscreen TV display route (`/display/tokens/:branchId`) updated via WebSocket in real time.
- Integrated audio synthesizer: speaks token number when marked READY on KDS or Expediter screen.
**Deps:** T-0603, T-0706  
**Files Likely Affected:**
- `packages/database/src/schema/orders.ts`
- `apps/web/app/display/tokens/[branchId]/page.tsx`
- `apps/api/src/modules/orders/tokens.ts`
**AC:**
1. Token cycles clean at midnight or day-end shift close.
2. TV screen responsive to large 1080p/4K counter monitors with high-contrast accessibility.

