# Phase 1 — Identity and access

## T-0101 Users and sessions schema

**Objective:** Drizzle tables `users`, `sessions`, indexes, timestamps.  
**Out of scope:** Orgs.  
**Deps:** T-0005  
**Files:** `packages/database`  
**AC:** Migration applies; FKs valid.

## T-0102 Permissions and roles schema

**Objective:** `permissions`, `roles`, `role_permissions`; seed SQL for catalog + system role names.  
**Out of scope:** Memberships.  
**Deps:** T-0101  
**Files:** `packages/database`, `packages/auth` catalog  
**AC:** Seed idempotent.

## T-0103 Password hashing module

**Objective:** Argon2id wrap in `packages/auth`.  
**Out of scope:** HTTP.  
**Deps:** T-0001  
**Files:** `packages/auth`  
**AC:** Unit test hash+verify; dummy hash not equal.

## T-0104 Register API

**Objective:** `POST /api/v1/auth/register` creating user (org bootstrap deferred or minimal personal org—**prefer wait**: register user only if T-0201 not done; if serial, create user with no org).  
**Decision:** Phase 1 register creates **user only**; org in T-0203.  
**Out of scope:** OAuth.  
**Deps:** T-0101, T-0103  
**Files:** `apps/api` auth module, `packages/validation`  
**AC:** Duplicate email 409; password never logged.

## T-0105 Login and cookies

**Objective:** `POST /auth/login`, set httpOnly cookies, create session, audit LOGIN.  
**Out of scope:** MFA.  
**Deps:** T-0104, T-0006  
**Files:** `apps/api`  
**AC:** Rate limited; wrong password same timing class as unknown email (generic error).

## T-0106 Refresh rotation

**Objective:** `POST /auth/refresh`; reuse detection revokes session family.  
**Deps:** T-0105  
**AC:** Unit/integration tests for rotation and reuse.

## T-0107 Logout and logout-all

**Objective:** Revoke session(s). Audit.  
**Deps:** T-0105  
**AC:** Refresh after logout fails.

## T-0108 Auth middleware and `/auth/me`

**Objective:** Resolve user from access cookie; 401 envelope.  
**Deps:** T-0105  
**AC:** Expired access rejected.

## T-0109 Authorization helper

**Objective:** `requirePermission` using in-memory permission set (empty until memberships—return deny except `/auth/*`). Stub loads no perms.  
**Deps:** T-0102, T-0108  
**Note:** Full grant in Phase 2.  
**AC:** Missing permission → 403 `FORBIDDEN`.

## T-0110 Audit log table + writer

**Objective:** `audit_logs` + `writeAudit` used by auth events.  
**Deps:** T-0101  
**AC:** LOGIN/LOGOUT rows; no password in metadata.

## T-0111 OTP/email verification tables

**Objective:** Schema + hashed OTP service, no provider send yet (log in dev).  
**Deps:** T-0101, T-0009  
**AC:** OTP not stored plaintext.

## T-0112 MFA schema only

**Objective:** Columns/tables for TOTP secret encrypted; no enforce.  
**Deps:** T-0101  
**AC:** Migration only.

## T-0113 Auth OpenAPI

**Objective:** Document auth routes in generated spec.  
**Deps:** T-0105–T-0108  
**AC:** `/api/v1/docs` lists auth.

## T-0114 Auth unit tests

**Objective:** Password, refresh reuse, validation schemas.  
**Deps:** T-0106  
**AC:** CI job green.
