# Phase 8 — Inventory

## T-0801 Units and conversions

**Objective:** Integer ratio conversions.  
**Deps:** T-0201  
**AC:** Unit tests; no float.

## T-0802 Inventory items + balances

**Objective:** Item master, per-branch balance in base units.  
**Deps:** T-0801, T-0204  
**AC:** Never update balance without transaction (enforced T-0803).

## T-0803 Inventory transactions API

**Objective:** ADJUSTMENT/WASTAGE with actor, reason; tx updates balance.  
**Deps:** T-0802  
**AC:** Audit INVENTORY_ADJUSTED.

## T-0804 Suppliers CRUD

**Objective:** Schema + API + simple UI.  
**Deps:** T-0201  
**AC:** Org scoped.

## T-0805 Purchase orders

**Objective:** PO + lines; receive → PURCHASE transactions.  
**Deps:** T-0803, T-0804  
**AC:** Receive in DB transaction.

## T-0806 Low stock query + event

**Objective:** Threshold; outbox `inventory.low_stock`.  
**Deps:** T-0803, T-0009  
**AC:** Manager can list alerts.

## T-0807 Transfer between branches

**Objective:** TRANSFER_OUT/IN pair in one tx.  
**Deps:** T-0803  
**AC:** Same org only.

## T-0808 Inventory UI

**Objective:** Item list, adjust, wastage form.  
**Deps:** T-0803, T-0302  
**AC:** Loading/empty/error.
