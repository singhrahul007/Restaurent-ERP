# Phase 5 — Menu Engineering & Revenue Optimization

A modern restaurant menu is not just a digital catalog—it is the restaurant's primary revenue engine. Phase 5 delivers dynamic menu structures, margin-aware modifier groups, smart upsell/cross-sell triggers, time-of-day dayparting, and multi-channel 86 availability broadcasts.

---

## T-0501 Tax Classes & Multi-Tier Fiscal Schema + API

**Objective:** Configure multi-tier tax structures (GST/VAT/Sales Tax, inclusive vs. exclusive pricing, alcohol vs. food tax brackets, takeaway packaging cess).  
**Revenue Impact:** Prevents fiscal penalties and ensures compliant margin calculations without eating into net profits.  
**Scope:**
- `tax_classes` table: `id`, `organization_id`, `name`, `code` (e.g., `FOOD_GST_5`, `LIQUOR_VAT_20`), `is_inclusive`, `is_active`.
- `tax_rates` table: `tax_class_id`, `name` (CGST, SGST, IGST, Surcharge), `rate_basis_points` (e.g. 250 = 2.5%, 1800 = 18%).
- Validation for basis points: must be non-negative integers; sum computed accurately.
**Deps:** T-0401  
**Files Likely Affected:**
- `packages/database/src/schema/menu.ts`
- `packages/validation/src/menu.ts`
- `apps/api/src/modules/menu/tax-classes.ts`
**AC:**
1. Rates stored strictly in integer basis points (`rate_basis_points`).
2. Unit tests verify tax computation across inclusive and exclusive modes without rounding leakage.
3. Multi-tax item assignments (e.g. food at 5% and alcohol at 20% in the same catalog) fully supported.

---

## T-0502 Category Hierarchy, Course Tags & Dayparting

**Objective:** Nested categories (Super-Category > Category > Sub-Category), Kitchen Course tags (Starter, Main, Dessert, Beverage), and daypart schedules (Breakfast, Lunch, Happy Hour, Dinner, Late Night).  
**Revenue Impact:** Daypart menus automate high-margin drink specials during happy hours and streamline breakfast-only options to cut prep errors.  
**Scope:**
- Hierarchy with `parent_id` foreign key and `display_order`.
- Schedule attributes: `available_days` (bitmap/array), `start_time` (HH:mm), `end_time` (HH:mm).
- Course tags for KDS routing (`course_type`: `BEVERAGE`, `APPETIZER`, `ENTREE`, `DESSERT`).
**Deps:** T-0204  
**Files Likely Affected:**
- `packages/database/src/schema/menu.ts`
- `apps/api/src/modules/menu/categories.ts`
**AC:**
1. Category tree respects tenant and branch scoping.
2. Time-gated querying: API endpoint filters active categories based on target branch time.
3. Reordering persists clean numerical positions (`display_order`).

---

## T-0503 High-Margin Menu Items Master & Cost Profiling

**Objective:** Core item schema supporting standard pricing, target food cost minor, dietary flags (Veg, Non-Veg, Vegan, Gluten-Free, Halal, Jain), preparation time estimates, and kitchen printer routing tags.  
**Revenue Impact:** Visual dietary badges drive customer confidence and boost ticket conversion; prep time estimates feed KDS queue optimization.  
**Scope:**
- `menu_items`: `id`, `organization_id`, `restaurant_id`, `category_id`, `tax_class_id`, `name`, `short_code` (for quick cashier lookup), `description`, `base_price_minor`, `cost_price_minor` (for real-time margin visibility), `food_type`, `prep_time_minutes`, `image_url`, `is_available`, `barcode`.
**Deps:** T-0501, T-0502  
**Files Likely Affected:**
- `packages/database/src/schema/menu.ts`
- `packages/validation/src/menu.ts`
- `apps/api/src/modules/menu/items.ts`
**AC:**
1. All currency fields are strictly integers in minor units (`base_price_minor`, `cost_price_minor`).
2. API validates short_code uniqueness within a restaurant.
3. Computed gross margin `(base_price_minor - cost_price_minor) / base_price_minor` available for analytics.

---

## T-0504 Portion Variants & Multi-Size Pricing

**Objective:** Manage item portion variations (e.g., Half / Full, Regular / Large, 250ml / 500ml / 750ml, Single / Double Patty) with individual SKU and cost tracking.  
**Revenue Impact:** Multi-sizing captures price-sensitive diners while maximizing Average Order Value (AOV) through upsold upgrades.  
**Scope:**
- `menu_item_variants`: `id`, `menu_item_id`, `name`, `sku`, `price_delta_minor`, `cost_delta_minor`, `is_default`, `display_order`.
**Deps:** T-0503  
**Files Likely Affected:**
- `packages/database/src/schema/menu.ts`
- `apps/api/src/modules/menu/variants.ts`
**AC:**
1. Exactly one variant can be marked `is_default: true` per item.
2. Base item price + `price_delta_minor` is calculated deterministically.
3. Zero floats allowed in delta calculations.

---

## T-0505 Modifier Groups, Addons & Smart Upsell Recommendations

**Objective:** Mandatory modifier groups (e.g., choice of meat, cooking temperature) and high-margin optional addon groups (e.g., extra cheese, bacon strips, dips, premium side salad), plus algorithmic upsell pairing triggers.  
**Revenue Impact:** Automatic POS & QR ordering prompts for drink/side pairings increase Average Order Value (AOV) by 15-22%.  
**Scope:**
- `modifier_groups`: `id`, `name`, `min_selection` (e.g. 1 for mandatory), `max_selection` (e.g. 3), `is_multiple_allowed`.
- `modifiers`: `id`, `group_id`, `name`, `price_minor`, `cost_minor`, `is_preselected`.
- `item_modifier_groups`: Pivot attaching groups to items.
- `item_upsell_suggestions`: Explicit pairings (e.g. Burger suggests Truffle Fries + Craft Beer) for cashier one-click prompts.
**Deps:** T-0503  
**Files Likely Affected:**
- `packages/database/src/schema/menu.ts`
- `packages/validation/src/menu.ts`
- `apps/api/src/modules/menu/modifiers.ts`
**AC:**
1. Server-side validation rejects carts that violate `min_selection` or `max_selection`.
2. Upsell items endpoint returns paired high-margin addons with one-tap add semantics.

---

## T-0506 Realtime 86 (Out-of-Stock) & Branch Availability Matrix

**Objective:** Instantly mark items, variants, or modifiers as "86" (Out of Stock) across POS, KDS, QR ordering, and external food delivery aggregators with automated kitchen stock depletion warnings.  
**Revenue Impact:** Eliminates customer friction and order cancellation penalties caused by ordering items the kitchen cannot fulfill.  
**Scope:**
- `menu_availability_overrides`: `branch_id`, `item_id`, `variant_id`, `modifier_id`, `is_available`, `reason` (e.g. `RAW_MATERIAL_OUT`, `EQUIPMENT_BREAKDOWN`), `auto_resume_at`.
- Outbox event `menu.item_86_toggled` broadcasted via WebSocket to all connected terminals.
**Deps:** T-0503, T-0010  
**Files Likely Affected:**
- `packages/database/src/schema/menu.ts`
- `apps/api/src/modules/menu/availability.ts`
**AC:**
1. 86 toggle immediately updates branch overlay without mutating central menu catalog.
2. Active POS carts reject newly 86-ed items before checkout confirmation.
3. WebSocket event reaches POS terminals in < 200ms.

---

## T-0507 Rich Menu Engineering UI & Margin Analysis Dashboard

**Objective:** Modern menu builder with drag-and-drop category sorting, quick inline price and 86 editing, food-cost margin badges, and visual dietary tags.  
**Revenue Impact:** Empowers managers to identify low-margin dishes and instantly highlight "Stars" (high profit, high volume) on digital menus.  
**Scope:**
- Responsive desktop & tablet UI using Tailwind CSS + shadcn/ui.
- Visual badge per item displaying Gross Profit Margin % (`(Price - Cost) / Price`).
- Quick-search, bulk-price updater, and image uploader (S3/MinIO presigned URLs).
**Deps:** T-0505, T-0302  
**Files Likely Affected:**
- `apps/web/app/dashboard/menu/page.tsx`
- `packages/ui/src/components/menu-builder.tsx`
**AC:**
1. Handles empty, loading, error, and high-latency states gracefully.
2. Inline 86 toggle updates state without full page refresh.
3. Mobile touch-friendly for manager tablets on the restaurant floor.

---

## T-0508 Immutable Order Line Snapshot Helper

**Objective:** Cryptographically robust or immutable freeze function that captures item name, variant label, chosen modifiers, tax rates, unit base price, and discount snapshots onto order lines.  
**Revenue Impact:** Guarantees historical sales records, tax audits, and financial reporting remain 100% accurate even if menu prices change 5 minutes later.  
**Scope:**
- Pure snapshot service: takes `(itemId, variantId, modifierIds[], branchId)` and returns an immutable JSON order line payload.
**Deps:** T-0505, T-0501  
**Files Likely Affected:**
- `packages/types/src/orders.ts`
- `apps/api/src/modules/menu/snapshot-service.ts`
**AC:**
1. Unit tests confirm changing an item's catalog price or name does not retroactively mutate past order line snapshots.
2. Frozen payload includes all tax breakdown components (CGST, SGST, Cess) for exact receipt printing.
