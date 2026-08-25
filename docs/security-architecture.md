# Security architecture

Defense in depth. Priority: **authn → tenant isolation → authz → input → secrets → audit**.

## Authentication

- Argon2id password hashes; constant-time compare via library
- Access token: 15 minutes, JWT or opaque; **not** readable by JS (httpOnly cookie)
- Refresh: 30 days, **hashed** in `sessions` (SHA-256 of random), rotation on every refresh, reuse detection **revokes family**
- Device list on `/auth/sessions`; logout-all
- Email verification before privileged org actions (Phase 1: flag; enforce before Phase 13 billing)
- MFA: TOTP architecture for `SUPER_ADMIN` and `RESTAURANT_OWNER` (Phase 14 can mandate; schema in Phase 1)
- Step-up auth (recent password or MFA) for: ownership transfer, subscription changes, permission grants, org/restaurant delete, data export

## Authorization and isolation

- Context from session only. Ignore client-supplied `organizationId` unless it matches a membership
- RLS + application filters
- Branch scope on POS/KDS/inventory
- IDOR tests: cross-tenant UUID access returns `NOT_FOUND` not `FORBIDDEN` (avoid org enumeration) except where product needs FORBIDDEN

## API

- Rate limits: login 5/min/IP; API 120/min/user (config)
- Payload limit e.g. 1 MB JSON
- Helmet-style headers; CORS allowlist of web origins
- CSRF: cookie auth + Origin check; mutating requests without valid Origin rejected
- Zod validation at boundary
- Drizzle parameterized queries only
- Generic 500 message; log internally with requestId
- File uploads: type/size allowlist, virus scan later; store in object storage not DB

## Secrets

- Env vars; never in git
- Integration credentials encrypted at rest (app-level AES-GCM with KEK from env)
- No tokens in logs; redact Authorization and cookies
- Separate DB roles: migrator vs app (DML only)

## Data

- TLS to Postgres in production
- Backups + restore drill in Phase 14
- PII minimization on kitchen/driver channels
- QR tokens hashed at rest

## Audit

Log: `LOGIN`, `LOGOUT`, `PASSWORD_CHANGED`, `ROLE_CHANGED`, `PERMISSION_CHANGED`, `ORDER_CANCELLED`, `REFUND_CREATED`, `INVENTORY_ADJUSTED`, `DATA_EXPORTED`, `INTEGRATION_CHANGED`, `SETTINGS_CHANGED`, `IMPERSONATION`.

Store actor_id, org_id, ip, user_agent, resource type/id, metadata without secrets.

## Threat notes

- POS on shared tablets: short idle lock + PIN optional (Phase 4 settings)
- Printers/KDS on LAN: do not expose API without auth
- Webhooks: signature verify, idempotency, no trust of source IPs alone
