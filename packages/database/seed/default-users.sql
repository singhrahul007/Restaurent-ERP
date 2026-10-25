-- Seed default accounts with proper role-based scoping
DO $$
DECLARE
  v_org_id uuid;
  v_admin_id uuid;
  v_owner_id uuid;
  v_cook_id uuid;
  v_waiter_id uuid;
  v_cashier_id uuid;
  v_m_owner_id uuid;
  v_m_admin_id uuid;
  v_m_cook_id uuid;
  v_m_waiter_id uuid;
  v_m_cashier_id uuid;
  v_role_owner_id uuid;
  v_role_cook_id uuid;
  v_role_waiter_id uuid;
  v_role_cashier_id uuid;
BEGIN
  SELECT id INTO v_role_owner_id FROM roles WHERE slug = 'RESTAURANT_OWNER';
  SELECT id INTO v_role_cook_id FROM roles WHERE slug = 'COOK';
  SELECT id INTO v_role_waiter_id FROM roles WHERE slug = 'WAITER';
  SELECT id INTO v_role_cashier_id FROM roles WHERE slug = 'CASHIER';

  -- Select or insert default organization
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at DESC LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name) VALUES ('MR.Genious Restaurant') RETURNING id INTO v_org_id;
  END IF;

  -- 1. admin@restaurant.com (Platform / Master Admin)
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('admin@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$GiC9Cy1RHq3xAPKF/d6nFg$JHW1OTxnp8rSF842vZW3vbEQ/UUHgIiQQkLtEt6x3ho', 'ACTIVE', true)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE', is_platform_admin = true
  RETURNING id INTO v_admin_id;

  -- 2. owner@restaurant.com (Restaurant Owner)
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('owner@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$7olZRVc2EKtJBClbcWcYsg$WEboS/g2v7NVoq6HLUrFo+sWsNiIG1ABP+4xsBtk/i0', 'ACTIVE', false)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE', is_platform_admin = false
  RETURNING id INTO v_owner_id;

  -- 3. cook@restaurant.com (password: cook1234)
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('cook@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$6rvTdLPSXhUgbqztwrLy/w$3r6q5/hzkLY1XiWk+gGl8ivTBLJSjq4ZHO9mwj55Xmw', 'ACTIVE', false)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE', is_platform_admin = false
  RETURNING id INTO v_cook_id;

  -- 4. waiter@restaurant.com (password: waiter1234)
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('waiter@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$quyhp8EsHdj7YroV5p3xVQ$7QNWpo4Yv5Y7ZcKiXeGio3SiD1WPMZ+d+Dq9DSaRVy0', 'ACTIVE', false)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE', is_platform_admin = false
  RETURNING id INTO v_waiter_id;

  -- 5. cashier@restaurant.com (password: cashier1234)
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('cashier@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$quyhp8EsHdj7YroV5p3xVQ$7QNWpo4Yv5Y7ZcKiXeGio3SiD1WPMZ+d+Dq9DSaRVy0', 'ACTIVE', false)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE', is_platform_admin = false
  RETURNING id INTO v_cashier_id;

  -- Organization Memberships:
  -- Only owner@ and admin@ have is_owner = true
  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_admin_id, v_org_id, true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = true
  RETURNING id INTO v_m_admin_id;

  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_owner_id, v_org_id, true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = true
  RETURNING id INTO v_m_owner_id;

  -- Cook, Waiter, Cashier have is_owner = false so they are bounded by their RBAC roles!
  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_cook_id, v_org_id, false)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = false
  RETURNING id INTO v_m_cook_id;

  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_waiter_id, v_org_id, false)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = false
  RETURNING id INTO v_m_waiter_id;

  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_cashier_id, v_org_id, false)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = false
  RETURNING id INTO v_m_cashier_id;

  -- Attach roles
  IF v_role_owner_id IS NOT NULL THEN
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_owner_id, v_role_owner_id) ON CONFLICT DO NOTHING;
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_admin_id, v_role_owner_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_role_cook_id IS NOT NULL THEN
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_cook_id, v_role_cook_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_role_waiter_id IS NOT NULL THEN
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_waiter_id, v_role_waiter_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_role_cashier_id IS NOT NULL THEN
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_cashier_id, v_role_cashier_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;
