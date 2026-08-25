# Phase 2 — Multi-tenancy

## T-0201 Organizations schema

**Objective:** `organizations`, RLS helper, `app.organization_id`.  
**Deps:** T-0101  
**AC:** Migration + documented SET LOCAL usage.

## T-0202 Memberships and roles assignment

**Objective:** `memberships`, `membership_roles`; unique user+org.  
**Deps:** T-0201, T-0102  
**AC:** FKs cascade rules documented (restrict delete org with data).

## T-0203 Create organization API

**Objective:** First org for user; grant OWNER role; set active org cookie/header.  
**Deps:** T-0202, T-0108  
**AC:** Second org allowed; isolation tests start.

## T-0204 Restaurants and branches schema + API

**Objective:** CRUD restaurants/branches with `restaurant.manage` / `branch.manage`.  
**Deps:** T-0203  
**AC:** Cross-org UUID returns NOT_FOUND.

## T-0205 Branch assignments

**Objective:** Assign membership to branches; context headers validated.  
**Deps:** T-0204  
**AC:** User without branch cannot access that branch’s future resources.

## T-0206 Permission loading

**Objective:** `/auth/me` returns union of permissions for active org; middleware enforces.  
**Deps:** T-0202, T-0109  
**AC:** Owner has catalog minus platform.

## T-0207 SUPER_ADMIN bootstrap

**Objective:** Env `PLATFORM_ADMIN_EMAIL` seed or CLI to grant platform role on users table flag `is_platform_admin`.  
**Deps:** T-0102  
**AC:** Non-admin cannot hit `/platform/*` (stub route).

## T-0208 Tenant isolation tests

**Objective:** Two orgs, two users, restaurant leak attempts.  
**Deps:** T-0204  
**AC:** All leak tests fail closed.

## T-0209 Platform org list stub

**Objective:** `GET /platform/organizations` with `platform.manage`.  
**Deps:** T-0207  
**AC:** 403 for owner.

## T-0210 Context documentation

**Objective:** Short `docs/tenancy-runtime.md` how handlers must use ctx (optional file). Prefer adding section to architecture if tiny.  
**Deps:** T-0208  
**AC:** Agent-readable rules listed.
