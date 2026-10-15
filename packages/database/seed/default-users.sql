-- Seed default accounts with full access
DO $$
DECLARE
  v_org_id uuid;
  v_admin_id uuid;
  v_owner_id uuid;
  v_cook_id uuid;
  v_waiter_id uuid;
  v_m_owner_id uuid;
  v_m_admin_id uuid;
  v_m_cook_id uuid;
  v_m_waiter_id uuid;
  v_role_owner_id uuid;
  v_role_cook_id uuid;
  v_role_receptionist_id uuid;
BEGIN
  SELECT id INTO v_role_owner_id FROM roles WHERE slug = 'RESTAURANT_OWNER';
  SELECT id INTO v_role_cook_id FROM roles WHERE slug = 'COOK';
  SELECT id INTO v_role_receptionist_id FROM roles WHERE slug = 'RECEPTIONIST';

  -- Select or insert default organization
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at DESC LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name) VALUES ('MR.Genious Restaurant') RETURNING id INTO v_org_id;
  END IF;

  -- 1. admin@restaurant.com
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('admin@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$GiC9Cy1RHq3xAPKF/d6nFg$JHW1OTxnp8rSF842vZW3vbEQ/UUHgIiQQkLtEt6x3ho', 'ACTIVE', true)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE', is_platform_admin = true
  RETURNING id INTO v_admin_id;

  -- 2. owner@restaurant.com
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('owner@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$7olZRVc2EKtJBClbcWcYsg$WEboS/g2v7NVoq6HLUrFo+sWsNiIG1ABP+4xsBtk/i0', 'ACTIVE', false)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'
  RETURNING id INTO v_owner_id;

  -- 3. cook@restaurant.com
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('cook@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$jh0WL/0etRMm/zbJrehjng$CfYuuveED0Klud6n+L9Cg5g7qD0OfvdMwJ+n2rgJC9w', 'ACTIVE', false)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'
  RETURNING id INTO v_cook_id;

  -- 4. waiter@restaurant.com
  INSERT INTO users (email, password_hash, status, is_platform_admin)
  VALUES ('waiter@restaurant.com', '$argon2id$v=19$m=19456,t=2,p=1$Jlr+283o5VNPGpehcriErQ$GvmNWl94pXDRdD47D0TNcFpXfNgGZk6754n5zGqD3Uo', 'ACTIVE', false)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'
  RETURNING id INTO v_waiter_id;

  -- Organization Memberships (is_owner = true gives full org permissions)
  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_admin_id, v_org_id, true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = true
  RETURNING id INTO v_m_admin_id;

  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_owner_id, v_org_id, true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = true
  RETURNING id INTO v_m_owner_id;

  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_cook_id, v_org_id, true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = true
  RETURNING id INTO v_m_cook_id;

  INSERT INTO memberships (user_id, organization_id, is_owner)
  VALUES (v_waiter_id, v_org_id, true)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET is_owner = true
  RETURNING id INTO v_m_waiter_id;

  -- Attach roles
  IF v_role_owner_id IS NOT NULL THEN
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_owner_id, v_role_owner_id) ON CONFLICT DO NOTHING;
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_admin_id, v_role_owner_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_role_cook_id IS NOT NULL THEN
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_cook_id, v_role_cook_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_role_receptionist_id IS NOT NULL THEN
    INSERT INTO membership_roles (membership_id, role_id) VALUES (v_m_waiter_id, v_role_receptionist_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;
