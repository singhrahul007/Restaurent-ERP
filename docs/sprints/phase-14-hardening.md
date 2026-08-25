# Phase 14 — Hardening

## T-1401 Security review checklist

**Objective:** Execute `docs/security-architecture.md` as a signed checklist in `docs/go-live.md`.  
**Deps:** Phase 6+  
**AC:** IDOR, RLS, cookie flags, rate limits verified.

## T-1402 Load test POS reads/writes

**Objective:** k6 or similar script against order create; document hardware.  
**Deps:** T-0603  
**AC:** Report stored in `docs/perf/`.

## T-1403 Backup and restore drill

**Objective:** Script dump/restore Postgres; document RPO/RTO targets.  
**Deps:** T-0004  
**AC:** Restore tested on compose.

## T-1404 Metrics and tracing

**Objective:** OpenTelemetry traces + Prometheus metrics or equivalent cloud-agnostic.  
**Deps:** T-0006  
**AC:** requestId → DB → job documented.

## T-1405 Failed job dashboard

**Objective:** BullMQ failed set exposed to platform UI.  
**Deps:** T-0009, T-1307  
**AC:** No payload secrets.

## T-1406 MFA enforce for privileged

**Objective:** Require TOTP for SUPER_ADMIN and owners.  
**Deps:** T-0112  
**AC:** Cannot skip in production env.

## T-1407 Penetration-style test notes

**Objective:** Internal test cases for CSRF, XSS on POS, mass assignment.  
**Deps:** T-1401  
**AC:** Findings filed; no exploit code in repo.

## T-1408 Production readiness doc

**Objective:** `docs/production-readiness.md` env, secrets rotation, CORS, TLS, migrations.  
**Deps:** T-1401–T-1405  
**AC:** Go/no-go list.
