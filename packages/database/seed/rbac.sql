-- Idempotent RBAC seed. Keep codes aligned with packages/auth/src/catalog.ts
INSERT INTO "permissions" ("code") VALUES
  ('platform.manage'),
  ('roles.view'),
  ('roles.manage'),
  ('restaurant.view'),
  ('restaurant.manage'),
  ('branch.view'),
  ('branch.manage'),
  ('branch.assign'),
  ('staff.view'),
  ('staff.manage'),
  ('menu.view'),
  ('menu.manage'),
  ('orders.view'),
  ('orders.create'),
  ('orders.update'),
  ('orders.cancel'),
  ('payments.view'),
  ('payments.create'),
  ('payments.refund'),
  ('inventory.view'),
  ('inventory.manage'),
  ('reports.view'),
  ('settings.view'),
  ('settings.manage'),
  ('customers.view'),
  ('customers.manage'),
  ('kitchen.view'),
  ('kitchen.update'),
  ('delivery.view'),
  ('delivery.manage'),
  ('delivery.self'),
  ('tables.view'),
  ('tables.manage'),
  ('reservations.view'),
  ('reservations.manage'),
  ('shifts.view'),
  ('shifts.manage'),
  ('tms.view'),
  ('tms.manage')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles" ("slug", "name", "is_system") VALUES
  ('SUPER_ADMIN', 'Super Admin', true),
  ('RESTAURANT_ADMIN', 'Restaurant Admin', true),
  ('RESTAURANT_SINGLE', 'Single Restaurant Operator', true),
  ('RESTAURANT_OWNER', 'Restaurant Owner', true),
  ('RESTAURANT_MANAGER', 'Restaurant Manager', true),
  ('BRANCH_MANAGER', 'Branch Manager', true),
  ('RECEPTIONIST', 'Receptionist', true),
  ('CASHIER', 'Cashier', true),
  ('WAITER', 'Waiter', true),
  ('COOK', 'Cook', true),
  ('DELIVERY_AGENT', 'Delivery Agent', true),
  ('INVENTORY_MANAGER', 'Inventory Manager', true),
  ('PURCHASE_MANAGER', 'Purchase Manager', true),
  ('ACCOUNTANT', 'Accountant', true)
ON CONFLICT ("slug") DO NOTHING;

-- SUPER_ADMIN
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN ('platform.manage', 'roles.view', 'roles.manage')
WHERE r.slug = 'SUPER_ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- RESTAURANT_OWNER
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code <> 'platform.manage' AND p.code <> 'roles.manage' AND p.code <> 'roles.view'
WHERE r.slug = 'RESTAURANT_OWNER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- RESTAURANT_ADMIN
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'restaurant.view', 'branch.view', 'branch.manage', 'branch.assign',
  'staff.view', 'staff.manage', 'menu.view', 'menu.manage',
  'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
  'payments.view', 'payments.create', 'payments.refund',
  'inventory.view', 'inventory.manage', 'reports.view',
  'customers.view', 'customers.manage', 'kitchen.view', 'kitchen.update',
  'delivery.view', 'delivery.manage', 'tables.view', 'tables.manage'
)
WHERE r.slug = 'RESTAURANT_ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- RESTAURANT_MANAGER
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p
  ON p.code <> 'platform.manage'
 AND p.code <> 'roles.manage'
 AND p.code <> 'roles.view'
 AND p.code <> 'settings.manage'
 AND p.code <> 'payments.refund'
WHERE r.slug = 'RESTAURANT_MANAGER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- BRANCH_MANAGER
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'restaurant.view', 'branch.view', 'staff.view', 'menu.view',
  'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
  'payments.view', 'payments.create', 'inventory.view', 'reports.view',
  'customers.view', 'kitchen.view', 'kitchen.update', 'delivery.view',
  'tables.view', 'tables.manage', 'reservations.view', 'reservations.manage',
  'shifts.view', 'shifts.manage'
)
WHERE r.slug = 'BRANCH_MANAGER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- RECEPTIONIST
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'menu.view', 'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
  'payments.view', 'customers.view', 'tables.view', 'reservations.view', 'reservations.manage'
)
WHERE r.slug = 'RECEPTIONIST'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- CASHIER
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'menu.view', 'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
  'payments.view', 'payments.create', 'customers.view', 'tables.view',
  'shifts.view', 'shifts.manage', 'tms.view', 'tms.manage'
)
WHERE r.slug = 'CASHIER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- WAITER
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'menu.view', 'orders.view', 'orders.create', 'orders.update',
  'tables.view', 'reservations.view'
)
WHERE r.slug = 'WAITER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- COOK
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'kitchen.view', 'kitchen.update', 'orders.view', 'tms.view', 'tms.manage'
)
WHERE r.slug = 'COOK'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- DELIVERY_AGENT
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'delivery.self', 'orders.view'
)
WHERE r.slug = 'DELIVERY_AGENT'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- INVENTORY_MANAGER
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'inventory.view', 'inventory.manage', 'reports.view', 'menu.view'
)
WHERE r.slug = 'INVENTORY_MANAGER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- PURCHASE_MANAGER
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'inventory.view', 'inventory.manage', 'reports.view', 'settings.view'
)
WHERE r.slug = 'PURCHASE_MANAGER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- ACCOUNTANT
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'reports.view', 'payments.view', 'payments.create', 'orders.view', 'settings.view'
)
WHERE r.slug = 'ACCOUNTANT'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
