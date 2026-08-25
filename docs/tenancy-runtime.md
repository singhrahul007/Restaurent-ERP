# Tenancy runtime

Handlers must never trust `organizationId`, `restaurantId`, or `branchId` from the JSON body as the tenant scope.

## Context

1. Authenticate from the access cookie (`requireAuth`).
2. Resolve **active organization** from `X-Organization-Id`, then cookie `niva_organization`, then the user’s only membership.
3. Reject a client-supplied org id that is not a membership (`TENANT_MISMATCH`).
4. Optional `X-Restaurant-Id` / `X-Branch-Id` must belong to that org. If the membership has **any** `branch_assignments`, the user is limited to those branches.
5. Load permissions as the **union** of roles on that membership. Owners (`is_owner` / `RESTAURANT_OWNER`) get the org catalog **minus** `platform.manage`. `users.is_platform_admin` adds `platform.manage`.
6. `requirePermission('…')` reads `request.permissions`. Missing permission → `403 FORBIDDEN`.
7. Start tenant transactions with `setLocalOrganizationId` / `withOrganizationScope` (`SET LOCAL app.organization_id`). Also filter `organization_id = ctx.organizationId` in SQL.
8. Cross-org UUID lookup → `404 NOT_FOUND` (do not leak with `FORBIDDEN`).
9. `/platform/*` requires `platform.manage`. Org owners without the platform flag get `403`.
10. Do not delete an organization while memberships or restaurants exist (`ON DELETE RESTRICT`).

## Request fields

| Source | Use |
| --- | --- |
| `request.authUser` | Global user id / email / `isPlatformAdmin` |
| `request.tenant.organizationId` | Only org id for queries |
| `request.tenant.allowedBranchIds` | `null` = restaurant-wide; otherwise allow-list |

## Cookies / headers

- `niva_access`, `niva_refresh` — session
- `niva_organization` — last active org (validated on every tenant request)
- `X-Organization-Id`, `X-Restaurant-Id`, `X-Branch-Id` — request context
