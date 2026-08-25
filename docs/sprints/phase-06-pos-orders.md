# Phase 6 — POS and orders

Implement in order. Do not skip to refunds.

## T-0601 Pricing service

**Objective:** Pure function: lines → totals (item, variant, modifiers, qty, discount, coupon stub, tax, service charge, rounding).  
**Deps:** T-0508  
**Files:** `apps/api` pricing module  
**AC:** Unit tests; no float money.

## T-0602 Orders schema + state machine

**Objective:** orders, items, history; transition helper.  
**Deps:** T-0204, T-0503  
**AC:** Illegal transition throws `INVALID_STATE_TRANSITION`.

## T-0603 Create order API

**Objective:** DRAFT/CREATED dine-in/takeaway; idempotency key.  
**Deps:** T-0602, T-0601  
**AC:** Totals from pricing service persisted on lines.

## T-0604 Add/modify/remove items API

**Objective:** Mutate DRAFT/CREATED per policy.  
**Deps:** T-0603  
**AC:** Recalc totals in tx.

## T-0605 Discount apply API

**Objective:** Percent or amount_minor; permission.  
**Deps:** T-0604  
**AC:** Cannot go negative.

## T-0606 Coupon schema + apply

**Objective:** Simple coupon codes; redemption row.  
**Deps:** T-0605  
**AC:** One redemption rule documented.

## T-0607 Payments schema + create payment

**Objective:** Independent payment status; cash first.  
**Deps:** T-0603  
**AC:** Order status unchanged by payment create alone.

## T-0608 Confirm → preparing transition

**Objective:** CONFIRMED; outbox event `order.updated`.  
**Deps:** T-0603, T-0010  
**AC:** Transactional outbox.

## T-0609 Complete order when paid + served rules

**Objective:** COMPLETED guards.  
**Deps:** T-0607, T-0608  
**AC:** Cannot complete if balance > 0 (unless house account later—out of scope).

## T-0610 POS UI: catalog + cart

**Objective:** Cashier shell, search, categories, cart.  
**Deps:** T-0307, T-0507, T-0604  
**AC:** Keyboard `/` search; touch targets.

## T-0611 POS table select

**Objective:** Attach dine-in table.  
**Deps:** T-0405, T-0610  
**AC:** Occupied table rules defined.

## T-0612 POS pay + receipt view

**Objective:** Record cash payment; printable receipt (browser print).  
**Deps:** T-0607, T-0610  
**AC:** Amounts from API.

## T-0613 Cancel order

**Objective:** CANCELLED + audit; payment constraints.  
**Deps:** T-0608  
**AC:** Cannot cancel COMPLETED without refunds policy.

## T-0614 Refund API

**Objective:** refunds table; payment status; audit; step-up later optional.  
**Deps:** T-0607  
**AC:** Refund ≤ captured; `payments.refund` required.
