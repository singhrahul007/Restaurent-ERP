# Phase 9 — Recipes

## T-0901 Recipe schema

**Objective:** recipe + lines in base units.  
**Deps:** T-0503, T-0802  
**AC:** Unique recipe per item/variant.

## T-0902 Recipe API + UI

**Objective:** CRUD recipes.  
**Deps:** T-0901  
**AC:** `inventory.manage` or `menu.manage` (pick one and document).

## T-0903 Consume on order complete (or ready)

**Objective:** Policy flag; idempotent `inventory_consumptions`; SALE_CONSUMPTION rows.  
**Deps:** T-0901, T-0609, T-0803  
**AC:** Second consume no-op; row lock balances.

## T-0904 Reverse on cancel/refund policy

**Objective:** Documented when reverse; RETURN or reversal tx.  
**Deps:** T-0903, T-0613  
**AC:** Idempotent reverse.

## T-0905 Consume tests

**Objective:** Integration: order complete reduces stock.  
**Deps:** T-0903  
**AC:** Isolation + concurrency test if feasible.
