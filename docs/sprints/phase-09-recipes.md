# Phase 9 — Recipes, Sub-Recipes & Automated Depletion

A restaurant recipe is the bridge connecting the guest's menu order to physical pantry ingredients. Phase 9 implements multi-level Bill of Materials (BOM), sub-recipe preparation (mother sauces, marinated meats, pizza dough), precise ingredient yield-loss factoring, and automated real-time depletion on order fulfillment.

---

## T-0901 Multi-Tier Recipe BOM & Sub-Recipe Production Schema

**Objective:** Database schema supporting multi-level Bill of Materials (BOM): Menu Item → Sub-Recipes (e.g. Tomato Marinara Base, Marinated Chicken Breast) → Raw Inventory Ingredients, factoring in prep yields and cook shrinkage.  
**Revenue Impact:** Captures true food costs down to the exact gram/milliliter, preventing menu items from silently losing money due to uncalculated sub-recipe prep costs.  
**Scope:**
- `recipes`: `id`, `menu_item_id` (null if sub-recipe), `variant_id`, `sub_recipe_name`, `is_sub_recipe`, `batch_yield_base_units`, `prep_instructions`.
- `recipe_ingredients`: `recipe_id`, `inventory_item_id` (or nested `sub_recipe_id`), `quantity_base_units`, `waste_percentage` (e.g., 10% trim loss on onion peeling or 15% moisture shrinkage on beef grilling).
- Cost calculator: dynamically sums current raw material moving averages to compute recipe cost per serving.
**Deps:** T-0503, T-0802  
**Files Likely Affected:**
- `packages/database/src/schema/recipes.ts`
- `apps/api/src/modules/recipes/cost-calculator.ts`
**AC:**
1. Unique recipe per item/variant; prevents conflicting BOM definitions.
2. Circular dependency detector: sub-recipe A cannot reference sub-recipe B if B references A.

---

## T-0902 Visual Recipe Management & Portion Costing UI

**Objective:** Intuitive recipe builder for executive chefs: visual ingredient search, automatic cost-per-plate calculation, gross margin preview against selling price, and step-by-step plating guide attachments.  
**Revenue Impact:** Instantly highlights if a price surge in an ingredient (e.g. butter or cheese) pushes dish food cost over the target 30% ceiling.  
**Scope:**
- Drag-and-drop ingredient adding with automatic unit conversion (e.g., input 250g, system converts to base unit).
- Live Margin Indicator: displays Real-Time Food Cost % (`Cost / Menu Price * 100`) with color coding (Green < 28%, Yellow 28-35%, Red > 35%).
- Upload plating photo guides for kitchen staff consistency.
**Deps:** T-0901  
**Files Likely Affected:**
- `apps/web/app/dashboard/recipes/page.tsx`
- `packages/ui/src/components/recipe-editor.tsx`
**AC:**
1. Updating ingredient prices automatically recalculates affected recipe dish costs across the restaurant catalog.
2. Accessible with `recipes.view` and `recipes.manage` permissions.

---

## T-0903 Realtime Order Depletion & Idempotent Stock Consumption

**Objective:** High-performance background depletion service: when an order reaches `READY` or `COMPLETED`, automatically breaks down ordered items into their underlying BOM ingredients and executes stock reductions.  
**Revenue Impact:** Provides up-to-the-minute stock visibility so the kitchen never discovers an empty walk-in cooler in the middle of dinner service.  
**Scope:**
- Event listener on `order.completed` or `order.ready` (configurable branch policy).
- `inventory_consumptions`: tracking table mapping `order_id` to generated `SALE_CONSUMPTION` inventory ledger rows.
- Idempotency guard: duplicate order completed events must be a no-op; uses database unique constraint on `(order_id, inventory_item_id)`.
- Row-level locking on `inventory_branch_balances` to guarantee concurrent checkout accuracy.
**Deps:** T-0901, T-0609, T-0803  
**Files Likely Affected:**
- `apps/api/src/modules/recipes/consumption-engine.ts`
- `apps/worker/src/processors/depletion.ts`
**AC:**
1. Second consumption attempt for the same order is an immediate idempotent no-op.
2. Custom modifier selections (e.g., "Add Extra Cheese" or "No Mayo") adjust ingredient consumption quantities accordingly.

---

## T-0904 Intelligent Reversal on Order Void or Kitchen Return

**Objective:** Policy-governed stock reversal engine when an order is cancelled or sent back: distinguishes between food that was returned to stock vs. food that was discarded as kitchen wastage.  
**Revenue Impact:** Ensures stock levels stay accurate when food is remade or cancelled, preventing hidden phantom inventory discrepancies.  
**Scope:**
- If order cancelled before cooking begins: creates `RETURN_TO_STOCK` reversing transactions.
- If order cancelled after preparation: logs ingredients to `WASTAGE_SPOILED` ledger rather than adding them back to available stock.
**Deps:** T-0903, T-0613  
**Files Likely Affected:**
- `apps/api/src/modules/recipes/reversal-engine.ts`
**AC:**
1. Reversal is strictly idempotent; cannot reverse an unconsumed or already reversed order.
2. Maintains complete linkage between original consumption and reversal audit rows.

---

## T-0905 Theoretical vs. Actual (TvA) Food Cost Variance Engine

**Objective:** Analytics computation comparing Theoretical Inventory Usage (calculated from POS sales and recipe BOMs) against Actual Usage (calculated from physical stock counts).  
**Revenue Impact:** Pinpoints the exact dollar value and weight of ingredients lost to portion over-sizing, theft, or untracked kitchen snacking.  
**Scope:**
- Formula: `Theoretical Usage = Sum(Sold Qty * Recipe BOM Qty)`.
- Formula: `Actual Usage = Starting Stock + Purchases - Ending Stock`.
- `Variance = Actual Usage - Theoretical Usage`.
- Generates ranking of highest loss items (e.g. "Missing 4.2 kg Beef Tenderloin = \$126 loss this week").
**Deps:** T-0903, T-0808, T-1101  
**Files Likely Affected:**
- `apps/api/src/modules/reports/variance-report.ts`
- `apps/web/app/dashboard/inventory/variance/page.tsx`
**AC:**
1. End-of-period report generates variance percentage and monetary impact for all key tracked ingredients.
2. Automated flag highlights variance exceeding +/- 3% tolerance.
