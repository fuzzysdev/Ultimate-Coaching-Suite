-- =============================================================
-- Super Admin Extended Policies
-- Ultimate Coaching Suite
--
-- Adds super-admin bypass policies to tables created after the
-- initial supabase-super-admin.sql migration:
--   attendance_data, games, game_points, spirit_ratings,
--   tryout_players, players
--
-- Run in Supabase SQL Editor (Dashboard > SQL Editor).
-- Requires is_super_admin() from supabase-super-admin.sql.
-- Safe to re-run: DROP IF EXISTS guards all objects.
-- =============================================================

-- players
DROP POLICY IF EXISTS "super_admin_all_players" ON players;
CREATE POLICY "super_admin_all_players"
  ON players FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- tryout_players
DROP POLICY IF EXISTS "super_admin_all_tryout_players" ON tryout_players;
CREATE POLICY "super_admin_all_tryout_players"
  ON tryout_players FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- attendance_data
DROP POLICY IF EXISTS "super_admin_all_attendance_data" ON attendance_data;
CREATE POLICY "super_admin_all_attendance_data"
  ON attendance_data FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- games
DROP POLICY IF EXISTS "super_admin_all_games" ON games;
CREATE POLICY "super_admin_all_games"
  ON games FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- game_points
DROP POLICY IF EXISTS "super_admin_all_game_points" ON game_points;
CREATE POLICY "super_admin_all_game_points"
  ON game_points FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- spirit_ratings
DROP POLICY IF EXISTS "super_admin_all_spirit_ratings" ON spirit_ratings;
CREATE POLICY "super_admin_all_spirit_ratings"
  ON spirit_ratings FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =============================================================
-- RLS Audit Results (verified 2026-03-06)
-- =============================================================
-- All 12 tables confirmed to have RLS enabled and returning
-- empty results for unauthenticated (anon key) requests:
--   organizations, rosters, players, user_organizations,
--   org_invites, super_admins, attendance_data, games,
--   game_points, spirit_ratings, tryouts, tryout_players
--
-- Known design trade-off:
--   org_invites SELECT policy ("authenticated_can_read_invites")
--   allows any authenticated user to enumerate all invite codes.
--   Codes are single-use and time-limited (24h/7d) which limits
--   practical risk. A future improvement would be to scope SELECT
--   to is_org_member(organization_id) OR created_by = auth.uid(),
--   and move the join-lookup to a SECURITY DEFINER RPC function.
-- =============================================================
