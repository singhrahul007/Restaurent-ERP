# Phase 5 — Menu

## T-0501 Tax classes schema + API

**Objective:** Tax classes and rates (GST-oriented fields: cgst/sgst/igst or single rate + inclusive flag).  
**Deps:** T-0401  
**AC:** Rates integer basis points (e.g. 1800 = 18%).

## T-0502 Categories CRUD

**Objective:** Schema, API, UI.  
**Deps:** T-0204  
**AC:** Tenant isolation.

## T-0503 Menu items CRUD

**Objective:** Item with base_price_minor, tax class, availability.  
**Deps:** T-0501, T-0502  
**AC:** Money integers only.

## T-0504 Variants API + UI

**Objective:** Variant price_delta_minor.  
**Deps:** T-0503  
**AC:** Cannot use floats.

## T-0505 Modifier groups API + UI

**Objective:** Groups, modifiers, attach to items.  
**Deps:** T-0503  
**AC:** min/max selection validated.

## T-0506 Menu availability toggle

**Objective:** 86 item at restaurant or branch overlay table.  
**Deps:** T-0503  
**AC:** POS will read this in Phase 6.

## T-0507 Menu list UI

**Objective:** Category tree + item editor screens.  
**Deps:** T-0505, T-0302  
**AC:** States handled.

## T-0508 Snapshot helper

**Objective:** Function to freeze item/variant/modifier names and prices for order lines (used Phase 6).  
**Deps:** T-0505  
**AC:** Unit test freeze ≠ live price after item change.
