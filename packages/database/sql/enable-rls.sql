-- Tenant RLS. Application filters remain required; this is defense in depth.
-- SET LOCAL app.organization_id at transaction start (see packages/database/src/rls.ts).
-- Table owners bypass RLS unless FORCE is used. Production app DB role must not own tables.

CREATE OR REPLACE FUNCTION app_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

ALTER TABLE "restaurants" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restaurants_tenant_isolation" ON "restaurants";
CREATE POLICY "restaurants_tenant_isolation" ON "restaurants"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branches_tenant_isolation" ON "branches";
CREATE POLICY "branches_tenant_isolation" ON "branches"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "branch_assignments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branch_assignments_tenant_isolation" ON "branch_assignments";
CREATE POLICY "branch_assignments_tenant_isolation" ON "branch_assignments"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "restaurant_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restaurant_settings_tenant_isolation" ON "restaurant_settings";
CREATE POLICY "restaurant_settings_tenant_isolation" ON "restaurant_settings"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "dining_tables" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dining_tables_tenant_isolation" ON "dining_tables";
CREATE POLICY "dining_tables_tenant_isolation" ON "dining_tables"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "tax_classes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax_classes_tenant_isolation" ON "tax_classes";
CREATE POLICY "tax_classes_tenant_isolation" ON "tax_classes"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "tax_rates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax_rates_tenant_isolation" ON "tax_rates";
CREATE POLICY "tax_rates_tenant_isolation" ON "tax_rates"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "menu_categories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_categories_tenant_isolation" ON "menu_categories";
CREATE POLICY "menu_categories_tenant_isolation" ON "menu_categories"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_items_tenant_isolation" ON "menu_items";
CREATE POLICY "menu_items_tenant_isolation" ON "menu_items"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "menu_item_variants" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_item_variants_tenant_isolation" ON "menu_item_variants";
CREATE POLICY "menu_item_variants_tenant_isolation" ON "menu_item_variants"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "modifier_groups" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "modifier_groups_tenant_isolation" ON "modifier_groups";
CREATE POLICY "modifier_groups_tenant_isolation" ON "modifier_groups"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "modifiers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "modifiers_tenant_isolation" ON "modifiers";
CREATE POLICY "modifiers_tenant_isolation" ON "modifiers"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "menu_item_modifier_groups" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_item_modifier_groups_tenant_isolation" ON "menu_item_modifier_groups";
CREATE POLICY "menu_item_modifier_groups_tenant_isolation" ON "menu_item_modifier_groups"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "menu_availability_overrides" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_availability_overrides_tenant_isolation" ON "menu_availability_overrides";
CREATE POLICY "menu_availability_overrides_tenant_isolation" ON "menu_availability_overrides"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_tenant_isolation" ON "orders";
CREATE POLICY "orders_tenant_isolation" ON "orders"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_tenant_isolation" ON "order_items";
CREATE POLICY "order_items_tenant_isolation" ON "order_items"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "order_item_modifiers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_item_modifiers_tenant_isolation" ON "order_item_modifiers";
CREATE POLICY "order_item_modifiers_tenant_isolation" ON "order_item_modifiers"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "order_discounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_discounts_tenant_isolation" ON "order_discounts";
CREATE POLICY "order_discounts_tenant_isolation" ON "order_discounts"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_status_history_tenant_isolation" ON "order_status_history";
CREATE POLICY "order_status_history_tenant_isolation" ON "order_status_history"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupons_tenant_isolation" ON "coupons";
CREATE POLICY "coupons_tenant_isolation" ON "coupons"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupon_redemptions_tenant_isolation" ON "coupon_redemptions";
CREATE POLICY "coupon_redemptions_tenant_isolation" ON "coupon_redemptions"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outbox_tenant_isolation" ON "outbox";
CREATE POLICY "outbox_tenant_isolation" ON "outbox"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_tenant_isolation" ON "payments";
CREATE POLICY "payments_tenant_isolation" ON "payments"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "kitchen_tickets" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kitchen_tickets_tenant_isolation" ON "kitchen_tickets";
CREATE POLICY "kitchen_tickets_tenant_isolation" ON "kitchen_tickets"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "kitchen_ticket_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kitchen_ticket_items_tenant_isolation" ON "kitchen_ticket_items";
CREATE POLICY "kitchen_ticket_items_tenant_isolation" ON "kitchen_ticket_items"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refunds_tenant_isolation" ON "refunds";
CREATE POLICY "refunds_tenant_isolation" ON "refunds"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "units_tenant_isolation" ON "units";
CREATE POLICY "units_tenant_isolation" ON "units"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "unit_conversions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unit_conversions_tenant_isolation" ON "unit_conversions";
CREATE POLICY "unit_conversions_tenant_isolation" ON "unit_conversions"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_items_tenant_isolation" ON "inventory_items";
CREATE POLICY "inventory_items_tenant_isolation" ON "inventory_items"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "inventory_balances" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_balances_tenant_isolation" ON "inventory_balances";
CREATE POLICY "inventory_balances_tenant_isolation" ON "inventory_balances"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "inventory_transactions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_transactions_tenant_isolation" ON "inventory_transactions";
CREATE POLICY "inventory_transactions_tenant_isolation" ON "inventory_transactions"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "wastage_records" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wastage_records_tenant_isolation" ON "wastage_records";
CREATE POLICY "wastage_records_tenant_isolation" ON "wastage_records"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_tenant_isolation" ON "suppliers";
CREATE POLICY "suppliers_tenant_isolation" ON "suppliers"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_orders_tenant_isolation" ON "purchase_orders";
CREATE POLICY "purchase_orders_tenant_isolation" ON "purchase_orders"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "purchase_order_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_order_lines_tenant_isolation" ON "purchase_order_lines";
CREATE POLICY "purchase_order_lines_tenant_isolation" ON "purchase_order_lines"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipes_tenant_isolation" ON "recipes";
CREATE POLICY "recipes_tenant_isolation" ON "recipes"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "recipe_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipe_lines_tenant_isolation" ON "recipe_lines";
CREATE POLICY "recipe_lines_tenant_isolation" ON "recipe_lines"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

ALTER TABLE "inventory_consumptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_consumptions_tenant_isolation" ON "inventory_consumptions";
CREATE POLICY "inventory_consumptions_tenant_isolation" ON "inventory_consumptions"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
