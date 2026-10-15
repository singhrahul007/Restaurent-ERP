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
  ('tables.manage')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles" ("slug", "name", "is_system") VALUES
  ('SUPER_ADMIN', 'Super Admin', true),
  ('RESTAURANT_ADMIN', 'Restaurant Admin', true),
  ('RESTAURANT_SINGLE', 'Single Restaurant Operator', true),
  ('RESTAURANT_OWNER', 'Restaurant Owner', true),
  ('RESTAURANT_MANAGER', 'Restaurant Manager', true),
  ('RECEPTIONIST', 'Receptionist', true),
  ('CASHIER', 'Cashier', true),
  ('COOK', 'Cook', true),
  ('DELIVERY_AGENT', 'Delivery Agent', true)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code = 'platform.manage'
WHERE r.slug = 'SUPER_ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code <> 'platform.manage'
WHERE r.slug = 'RESTAURANT_OWNER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p
  ON p.code <> 'platform.manage'
 AND p.code <> 'settings.manage'
 AND p.code <> 'payments.refund'
WHERE r.slug = 'RESTAURANT_MANAGER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'menu.view',
  'orders.view',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'payments.view',
  'customers.view',
  'tables.view'
)
WHERE r.slug = 'RECEPTIONIST'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'menu.view',
  'orders.view',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'payments.view',
  'payments.create',
  'customers.view',
  'tables.view'
)
WHERE r.slug = 'CASHIER'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'kitchen.view',
  'kitchen.update',
  'orders.view'
)
WHERE r.slug = 'COOK'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.code IN (
  'delivery.self',
  'orders.view'
)
WHERE r.slug = 'DELIVERY_AGENT'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
