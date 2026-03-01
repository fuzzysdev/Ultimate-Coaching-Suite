-- =============================================================
-- Supabase Row Level Security (RLS) Policies
-- Ultimate Coaching Suite
--
-- Run these in the Supabase SQL Editor (Dashboard > SQL Editor).
-- Safe to re-run: all existing policies are dropped first for a
-- clean slate before the new ones are created.
-- =============================================================

-- =============================================================
-- STEP 1: Drop all existing policies (clean slate)
-- =============================================================

-- organizations
DROP POLICY IF EXISTS "members_can_read_org" ON organizations;

-- user_organizations
DROP POLICY IF EXISTS "users_see_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "users_join_via_invite_only" ON user_organizations;

-- org_invites
DROP POLICY IF EXISTS "members_can_create_invites" ON org_invites;
DROP POLICY IF EXISTS "authenticated_can_read_invites" ON org_invites;
DROP POLICY IF EXISTS "authenticated_can_use_invite" ON org_invites;

-- rosters
DROP POLICY IF EXISTS "members_read_rosters" ON rosters;
DROP POLICY IF EXISTS "members_insert_rosters" ON rosters;
DROP POLICY IF EXISTS "members_update_rosters" ON rosters;
DROP POLICY IF EXISTS "members_delete_rosters" ON rosters;

-- players
DROP POLICY IF EXISTS "members_read_players" ON players;
DROP POLICY IF EXISTS "members_insert_players" ON players;
DROP POLICY IF EXISTS "members_update_players" ON players;
DROP POLICY IF EXISTS "members_delete_players" ON players;

-- tryouts
DROP POLICY IF EXISTS "members_read_tryouts" ON tryouts;
DROP POLICY IF EXISTS "members_insert_tryouts" ON tryouts;
DROP POLICY IF EXISTS "members_update_tryouts" ON tryouts;
DROP POLICY IF EXISTS "members_delete_tryouts" ON tryouts;

-- tryout_players
DROP POLICY IF EXISTS "members_read_tryout_players" ON tryout_players;
DROP POLICY IF EXISTS "members_insert_tryout_players" ON tryout_players;
DROP POLICY IF EXISTS "members_update_tryout_players" ON tryout_players;
DROP POLICY IF EXISTS "members_delete_tryout_players" ON tryout_players;

-- =============================================================
-- STEP 2: Enable RLS on all tables
-- =============================================================
ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rosters            ENABLE ROW LEVEL SECURITY;
ALTER TABLE players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryouts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryout_players     ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- STEP 3: Helper function — is the current user an org member?
-- =============================================================
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
      AND organization_id = org_id
  );
$$;

-- =============================================================
-- STEP 4: Create policies
-- =============================================================

-- organizations
-- Members can read their own orgs only.
CREATE POLICY "members_can_read_org"
  ON organizations FOR SELECT
  USING (is_org_member(id));

-- user_organizations
CREATE POLICY "users_see_own_memberships"
  ON user_organizations FOR SELECT
  USING (user_id = auth.uid() OR is_org_member(organization_id));

CREATE POLICY "users_join_via_invite_only"
  ON user_organizations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- org_invites
-- Only org members can generate codes; any authenticated user can
-- look up a code to join; only the redeemer can mark it used.
CREATE POLICY "members_can_create_invites"
  ON org_invites FOR INSERT
  WITH CHECK (is_org_member(organization_id) AND created_by = auth.uid());

CREATE POLICY "authenticated_can_read_invites"
  ON org_invites FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_can_use_invite"
  ON org_invites FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (used_by = auth.uid());

-- rosters
CREATE POLICY "members_read_rosters"
  ON rosters FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert_rosters"
  ON rosters FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update_rosters"
  ON rosters FOR UPDATE
  USING (is_org_member(organization_id));

CREATE POLICY "members_delete_rosters"
  ON rosters FOR DELETE
  USING (is_org_member(organization_id));

-- players
CREATE POLICY "members_read_players"
  ON players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rosters
      WHERE rosters.id = players.roster_id
        AND is_org_member(rosters.organization_id)
    )
  );

CREATE POLICY "members_insert_players"
  ON players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rosters
      WHERE rosters.id = players.roster_id
        AND is_org_member(rosters.organization_id)
    )
  );

CREATE POLICY "members_update_players"
  ON players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rosters
      WHERE rosters.id = players.roster_id
        AND is_org_member(rosters.organization_id)
    )
  );

CREATE POLICY "members_delete_players"
  ON players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rosters
      WHERE rosters.id = players.roster_id
        AND is_org_member(rosters.organization_id)
    )
  );

-- tryouts
CREATE POLICY "members_read_tryouts"
  ON tryouts FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert_tryouts"
  ON tryouts FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update_tryouts"
  ON tryouts FOR UPDATE
  USING (is_org_member(organization_id));

CREATE POLICY "members_delete_tryouts"
  ON tryouts FOR DELETE
  USING (is_org_member(organization_id));

-- tryout_players
CREATE POLICY "members_read_tryout_players"
  ON tryout_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tryouts
      WHERE tryouts.id = tryout_players.tryout_id
        AND is_org_member(tryouts.organization_id)
    )
  );

CREATE POLICY "members_insert_tryout_players"
  ON tryout_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tryouts
      WHERE tryouts.id = tryout_players.tryout_id
        AND is_org_member(tryouts.organization_id)
    )
  );

CREATE POLICY "members_update_tryout_players"
  ON tryout_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tryouts
      WHERE tryouts.id = tryout_players.tryout_id
        AND is_org_member(tryouts.organization_id)
    )
  );

CREATE POLICY "members_delete_tryout_players"
  ON tryout_players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tryouts
      WHERE tryouts.id = tryout_players.tryout_id
        AND is_org_member(tryouts.organization_id)
    )
  );
