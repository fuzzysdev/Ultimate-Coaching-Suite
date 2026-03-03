-- =============================================================
-- Super Admin Setup
-- Ultimate Coaching Suite
--
-- Run in Supabase SQL Editor (Dashboard > SQL Editor).
-- Safe to re-run: all objects are dropped / replaced first.
-- =============================================================

-- =============================================================
-- STEP 1: Create super_admins table
-- =============================================================
CREATE TABLE IF NOT EXISTS super_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Super admins can verify their own access (read own row only).
DROP POLICY IF EXISTS "super_admins_read_own" ON super_admins;
CREATE POLICY "super_admins_read_own"
  ON super_admins FOR SELECT
  USING (user_id = auth.uid());

-- =============================================================
-- STEP 2: is_super_admin() helper function
-- SECURITY DEFINER so it bypasses RLS on super_admins itself.
-- =============================================================
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid()
  );
$$;

-- =============================================================
-- STEP 3: Super-admin bypass policies on all tables
-- (These are OR-combined with the existing member policies.)
-- =============================================================

-- organizations
DROP POLICY IF EXISTS "super_admin_all_orgs" ON organizations;
CREATE POLICY "super_admin_all_orgs"
  ON organizations FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- user_organizations
DROP POLICY IF EXISTS "super_admin_all_memberships" ON user_organizations;
CREATE POLICY "super_admin_all_memberships"
  ON user_organizations FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- org_invites
DROP POLICY IF EXISTS "super_admin_all_invites" ON org_invites;
CREATE POLICY "super_admin_all_invites"
  ON org_invites FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- rosters
DROP POLICY IF EXISTS "super_admin_all_rosters" ON rosters;
CREATE POLICY "super_admin_all_rosters"
  ON rosters FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- tryouts
DROP POLICY IF EXISTS "super_admin_all_tryouts" ON tryouts;
CREATE POLICY "super_admin_all_tryouts"
  ON tryouts FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =============================================================
-- STEP 4: RPC function to get org members with email addresses
-- SECURITY DEFINER allows access to auth.users (private schema).
-- Only callable by super admins — returns empty set otherwise.
-- =============================================================
DROP FUNCTION IF EXISTS get_org_members(uuid);
CREATE OR REPLACE FUNCTION get_org_members(p_org_id uuid)
RETURNS TABLE(user_id uuid, email text, role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    uo.user_id,
    au.email::text,
    uo.role
  FROM user_organizations uo
  JOIN auth.users au ON au.id = uo.user_id
  WHERE uo.organization_id = p_org_id
    AND is_super_admin();
$$;

-- =============================================================
-- STEP 5: Grant super-admin access to a user
--
-- Replace the UUID below with the user's actual UUID.
-- Find it in Supabase Dashboard > Authentication > Users.
--
-- To add access:
--   INSERT INTO super_admins (user_id) VALUES ('<uuid-here>');
--
-- To remove access:
--   DELETE FROM super_admins WHERE user_id = '<uuid-here>';
-- =============================================================

-- Example (uncomment and replace UUID to grant access):
-- INSERT INTO super_admins (user_id) VALUES ('<your-uuid-here>');
