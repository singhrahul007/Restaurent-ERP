export const PERMISSION_CODES = [
  "platform.manage",
  "restaurant.view",
  "restaurant.manage",
  "branch.view",
  "branch.manage",
  "staff.view",
  "staff.manage",
  "menu.view",
  "menu.manage",
  "orders.view",
  "orders.create",
  "orders.update",
  "orders.cancel",
  "payments.view",
  "payments.create",
  "payments.refund",
  "inventory.view",
  "inventory.manage",
  "reports.view",
  "settings.view",
  "settings.manage",
  "customers.view",
  "customers.manage",
  "kitchen.view",
  "kitchen.update",
  "delivery.view",
  "delivery.manage",
  "delivery.self",
  "tables.view",
  "tables.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const SYSTEM_ROLE_SLUGS = [
  "SUPER_ADMIN",
  "RESTAURANT_OWNER",
  "RESTAURANT_MANAGER",
  "RECEPTIONIST",
  "CASHIER",
  "COOK",
  "DELIVERY_AGENT",
] as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLE_SLUGS)[number];

const ORG_PERMISSIONS = PERMISSION_CODES.filter(
  (code) => code !== "platform.manage",
);

export const ORG_PERMISSION_CODES: readonly PermissionCode[] = ORG_PERMISSIONS;

export const SYSTEM_ROLE_PERMISSIONS: Record<
  SystemRoleSlug,
  readonly PermissionCode[]
> = {
  SUPER_ADMIN: ["platform.manage"],
  RESTAURANT_OWNER: ORG_PERMISSIONS,
  RESTAURANT_MANAGER: ORG_PERMISSIONS.filter(
    (code) => code !== "settings.manage" && code !== "payments.refund",
  ),
  RECEPTIONIST: [
    "menu.view",
    "orders.view",
    "orders.create",
    "orders.update",
    "orders.cancel",
    "payments.view",
    "customers.view",
    "tables.view",
  ],
  CASHIER: [
    "menu.view",
    "orders.view",
    "orders.create",
    "orders.update",
    "orders.cancel",
    "payments.view",
    "payments.create",
    "customers.view",
    "tables.view",
  ],
  COOK: ["kitchen.view", "kitchen.update", "orders.view"],
  DELIVERY_AGENT: ["delivery.self", "orders.view"],
};

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}
