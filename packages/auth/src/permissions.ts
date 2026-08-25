import type { PermissionCode } from "./catalog.js";

export function emptyPermissionSet(): Set<PermissionCode> {
  return new Set();
}

export function hasPermission(
  permissions: ReadonlySet<string>,
  code: PermissionCode,
): boolean {
  return permissions.has(code);
}
