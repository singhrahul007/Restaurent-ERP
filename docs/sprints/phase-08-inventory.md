# Phase 8 — Inventory Control, Supplier Management & Wastage Defense

Food and beverage inventory represents 28% to 35% of a restaurant's total revenue. Phase 8 delivers uncompromising inventory control: multi-unit conversions, live stock ledgers, automated purchase orders, cold-storage par level tracking, branch transfers, and theoretical vs. actual variance analysis to eliminate theft and spoilage.

---

## T-0801 Exact Multi-Tier Unit Conversions & Metric Engine

**Objective:** Unit definition and integer-ratio conversion engine (e.g. 1 Bag = 25 Kilograms, 1 Kilogram = 1000 Grams; 1 Case = 12 Bottles, 1 Bottle = 750 Milliliters).  
**Revenue Impact:** Eradicates calculation rounding errors that hide ingredient leakage and distort recipe margins.  
**Scope:**
- `units`: `id`, `name` (e.g., Kilogram, Gram, Liter, Milliliter, Piece, Case, Can), `symbol`, `unit_type` (`MASS`, `VOLUME`, `COUNT`).
- `unit_conversions`: `from_unit_id`, `to_unit_id`, `multiplier_numerator`, `multiplier_denominator` (stored as exact integers to avoid float precision loss).
- Pure conversion function: `convertUnits(quantity, fromUnitId, toUnitId)`.
**Deps:** T-0201  
**Files Likely Affected:**
- `packages/database/src/schema/inventory.ts`
- `packages/validation/src/inventory.ts`
- `apps/api/src/modules/inventory/units.ts`
**AC:**
1. Zero floating-point arithmetic in conversions; stores exact rational fractions.
2. Incompatible unit type conversion (e.g. Kilograms to Milliliters without density factor) throws explicit `INCOMPATIBLE_UNIT_TYPE` error.

---

## T-0802 Raw Material Items Master, Par Levels & Stock Balances

**Objective:** Master ingredient catalog with per-branch stock balance tracking, reorder thresholds (par levels), minimum order quantities, and unit cost profiles.  
**Revenue Impact:** Avoids both embarrassing "86 stockouts" during high-traffic shifts and over-purchasing perishable items that end up spoiled in the dumpster.  
**Scope:**
- `inventory_items`: `id`, `organization_id`, `name`, `sku`, `category` (Meat, Dairy, Produce, Dry Goods, Liquor, Packaging), `base_unit_id`, `storage_type` (`DRY`, `CHILLED`, `FROZEN`), `shelf_life_days`.
- `inventory_branch_balances`: `branch_id`, `inventory_item_id`, `current_stock_base_units`, `min_par_level`, `max_par_level`, `reorder_point`, `average_unit_cost_minor`.
**Deps:** T-0801, T-0204  
**Files Likely Affected:**
- `packages/database/src/schema/inventory.ts`
- `apps/api/src/modules/inventory/items.ts`
**AC:**
1. Balances strictly tracked in integer base units (e.g. grams, milliliters, piece counts).
2. Direct updates to `current_stock_base_units` outside of audited inventory transactions are strictly prohibited at database and API layers.

---

## T-0803 Audited Inventory Transactions & Wastage Loss Ledger

**Objective:** Immutable double-entry inventory ledger tracking every stock mutation with specific transaction types (`PURCHASE_RECEIPT`, `SALE_CONSUMPTION`, `WASTAGE_SPOILED`, `WASTAGE_EXPIRED`, `INTERNAL_TRANSFER`, `STOCKTAKE_ADJUSTMENT`, `RETURN_TO_VENDOR`).  
**Revenue Impact:** Puts an end to internal employee pilferage and identifies costly wastage patterns across prep stations.  
**Scope:**
- `inventory_transactions`: `id`, `branch_id`, `inventory_item_id`, `transaction_type`, `quantity_base_units` (positive for additions, negative for deductions), `unit_cost_minor`, `total_cost_minor`, `reference_id` (PO ID, Order ID, Wastage ID), `actor_id`, `reason_notes`, `created_at`.
- Atomic balance updater: mutates branch balance and creates ledger row inside the same database transaction.
**Deps:** T-0802  
**Files Likely Affected:**
- `packages/database/src/schema/inventory.ts`
- `apps/api/src/modules/inventory/transactions.ts`
**AC:**
1. Every stock change creates an immutable transaction row; audit trail cannot be deleted or modified.
2. Wastage transactions mandate selecting an approved loss reason code (`SPOILED_PREP`, `BURNT_COOK`, `EXPIRED`, `DROPPED_BY_STAFF`).

---

## T-0804 Verified Supplier Master & Purchase Price Catalog

**Objective:** Vendor relationship management including contacts, payment terms (Net 15, Net 30, COD), tax IDs, supply item catalogs, and contract price lists.  
**Revenue Impact:** Protects profit margins by ensuring supplier invoices are cross-checked against agreed contracted prices.  
**Scope:**
- `suppliers`: `id`, `organization_id`, `name`, `tax_id`, `contact_name`, `phone`, `email`, `payment_terms`, `currency`, `is_active`.
- `supplier_item_prices`: `supplier_id`, `inventory_item_id`, `purchase_unit_id`, `unit_price_minor`, `lead_time_days`, `is_primary`.
**Deps:** T-0201  
**Files Likely Affected:**
- `packages/database/src/schema/inventory.ts`
- `apps/api/src/modules/inventory/suppliers.ts`
**AC:**
1. Tenant-scoped supplier directory.
2. Price catalog flags if an incoming purchase invoice exceeds contracted rates by > 5%.

---

## T-0805 Purchase Order (PO) Lifecycle & Goods Received Note (GRN)

**Objective:** Complete procurement lifecycle: Draft PO → Manager Approval → Sent to Vendor → Goods Received Note (GRN) with batch lot numbers and temperature check records.  
**Revenue Impact:** Prevents over-billing by vendors and ensures received goods match ordered quantities before accounts payable disburses cash.  
**Scope:**
- `purchase_orders`: `id`, `branch_id`, `supplier_id`, `po_number`, `status` (`DRAFT`, `SUBMITTED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`), `total_minor`.
- `purchase_order_items`: line items, expected qty, received qty, unit price.
- Receiving GRN workflow: creates `PURCHASE_RECEIPT` transactions and automatically updates moving average unit costs.
**Deps:** T-0803, T-0804  
**Files Likely Affected:**
- `packages/database/src/schema/inventory.ts`
- `apps/api/src/modules/inventory/purchase-orders.ts`
**AC:**
1. Receiving items increments branch stock balances atomically inside a single database transaction.
2. Discrepancies between ordered and delivered quantities automatically generate a supplier credit memo request.

---

## T-0806 Automated Low Stock Alerts & 1-Click Smart Restock

**Objective:** Real-time monitoring of raw material levels against reorder thresholds, firing instant alerts and auto-generating supplier draft POs.  
**Revenue Impact:** Stops restaurants running out of bestseller menu items on busy Friday/Saturday night shifts.  
**Scope:**
- Scheduled and event-driven trigger checking stock after sales consumptions.
- Broadcasts notification to Manager Ops dashboard and emits `inventory.low_stock` event.
- Smart Auto-PO: calculates reorder quantity = `max_par_level - current_stock` and assigns to primary supplier.
**Deps:** T-0803, T-0009  
**Files Likely Affected:**
- `apps/worker/src/processors/inventory-alerts.ts`
- `apps/api/src/modules/inventory/reorder.ts`
**AC:**
1. Managers can convert a batch of low stock alerts into generated POs with a single click.
2. Rate-limited alert notifications prevent duplicate alert spam within the same 6-hour window.

---

## T-0807 Inter-Branch Stock Transfers & Commissary Dispatch

**Objective:** Centralized commissary or warehouse dispatch to satellite branches, and inter-branch stock transfers with in-transit tracking.  
**Revenue Impact:** Balances inventory across multiple locations, preventing stock spoilage at slow branches while feeding high-volume branches without outside vendor fees.  
**Scope:**
- `stock_transfers`: `id`, `source_branch_id`, `destination_branch_id`, `status` (`REQUESTED`, `DISPATCHED`, `RECEIVED`, `REJECTED`).
- Atomic accounting: deductions at source branch logged as `TRANSFER_OUT`; reception at destination branch logged as `TRANSFER_IN`.
**Deps:** T-0803  
**Files Likely Affected:**
- `packages/database/src/schema/inventory.ts`
- `apps/api/src/modules/inventory/transfers.ts`
**AC:**
1. Strictly limited to branches within the same tenant organization.
2. In-transit state ensures stock is accounted for and does not vanish between dispatch and receiving confirmation.

---

## T-0808 High-Speed Inventory Management & Stocktaking UI

**Objective:** Streamlined stocktake (physical audit) screen with barcode scanner support, sheet printouts, quick wastage logging, and variance calculation.  
**Revenue Impact:** Slashes weekly stocktaking time from 3 hours to 30 minutes, allowing staff to focus on guest service.  
**Scope:**
- Responsive mobile/tablet interface for chefs counting walk-in coolers and dry pantries.
- Side-by-side display of System Expected Stock vs. Physically Counted Stock with immediate variance highlighting.
**Deps:** T-0803, T-0302  
**Files Likely Affected:**
- `apps/web/app/dashboard/inventory/page.tsx`
- `packages/ui/src/components/stocktake-sheet.tsx`
**AC:**
1. Approving a stocktake automatically posts adjusting inventory transactions to true-up system balances with full audit attribution.
