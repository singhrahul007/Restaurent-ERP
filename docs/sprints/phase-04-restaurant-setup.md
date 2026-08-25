# Phase 4 — Restaurant setup

## T-0401 Restaurant settings schema

**Objective:** timezone, currency, tax inclusive, inventory policy enum.  
**Deps:** T-0204  
**AC:** Default INR, Asia/Kolkata unless decided otherwise.

## T-0402 Restaurant profile API + UI

**Objective:** Owner/manager edit name, address, settings.  
**Deps:** T-0401, T-0303  
**AC:** Permission `settings.manage` / `restaurant.manage`.

## T-0403 Branch management UI

**Objective:** List/create/edit branches.  
**Deps:** T-0204, T-0306  
**AC:** Empty/error/loading.

## T-0404 Tables schema + CRUD API

**Objective:** Dining tables per branch.  
**Deps:** T-0204  
**AC:** Unique table code per branch.

## T-0405 Table management UI

**Objective:** Floor list, add table.  
**Deps:** T-0404, T-0302  
**AC:** Not POS integration (that is T-0610).

## T-0406 Staff invite/list API

**Objective:** Invite by email, assign roles and branches.  
**Deps:** T-0205  
**AC:** Audit ROLE_CHANGED; cannot grant platform.manage.

## T-0407 Staff UI

**Objective:** Staff table + invite modal.  
**Deps:** T-0406  
**AC:** Owner/manager only.

## T-0408 Session lock setting (schema)

**Objective:** POS idle timeout minutes on branch settings.  
**Deps:** T-0401  
**AC:** Schema + API field; UI later optional.
