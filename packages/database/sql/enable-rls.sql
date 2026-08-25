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
