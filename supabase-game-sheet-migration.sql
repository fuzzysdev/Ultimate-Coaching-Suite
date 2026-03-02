-- =============================================================
-- Game Sheet Migration
-- Ultimate Coaching Suite
--
-- Run in Supabase SQL Editor (Dashboard > SQL Editor).
-- =============================================================

-- =============================================================
-- STEP 1: Add position column + enforce gender on players table
-- =============================================================
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS position text
  CHECK (position IN ('h', 'c', 'b', 'e'));

-- Constrain gender to Male / Female only.
-- If existing rows have other values, remove the constraint line
-- and clean up the data first.
ALTER TABLE players
  DROP CONSTRAINT IF EXISTS players_gender_check;
ALTER TABLE players
  ADD CONSTRAINT players_gender_check
  CHECK (gender IN ('Male', 'Female'));

-- =============================================================
-- STEP 2: Create games table
-- =============================================================
CREATE TABLE IF NOT EXISTS games (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  roster_id           uuid NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
  opponent            text NOT NULL,
  our_score           integer NOT NULL DEFAULT 0,
  their_score         integer NOT NULL DEFAULT 0,
  first_gender        text NOT NULL CHECK (first_gender IN ('m', 'f')),
  starting_action     text NOT NULL CHECK (starting_action IN ('pull', 'receive')),
  direction           text NOT NULL CHECK (direction IN ('left', 'right')),
  our_timeouts_used   integer NOT NULL DEFAULT 0,
  their_timeouts_used integer NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz
);

-- =============================================================
-- STEP 3: Create game_points table
-- =============================================================
CREATE TABLE IF NOT EXISTS game_points (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id             uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  point_number        integer NOT NULL,
  gender              text NOT NULL CHECK (gender IN ('m', 'f')),
  scored_by           text NOT NULL CHECK (scored_by IN ('us', 'them')),
  player_ids          uuid[] NOT NULL DEFAULT '{}',
  our_score_after     integer NOT NULL,
  their_score_after   integer NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- STEP 4: Create spirit_ratings table
-- =============================================================
CREATE TABLE IF NOT EXISTS spirit_ratings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  rules_knowledge  integer NOT NULL CHECK (rules_knowledge BETWEEN 0 AND 4),
  fouls_contact    integer NOT NULL CHECK (fouls_contact BETWEEN 0 AND 4),
  fair_mindedness  integer NOT NULL CHECK (fair_mindedness BETWEEN 0 AND 4),
  attitude         integer NOT NULL CHECK (attitude BETWEEN 0 AND 4),
  communication    integer NOT NULL CHECK (communication BETWEEN 0 AND 4),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- STEP 5: Enable RLS on new tables
-- =============================================================
ALTER TABLE games          ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_points    ENABLE ROW LEVEL SECURITY;
ALTER TABLE spirit_ratings ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- STEP 6: RLS Policies — games
-- =============================================================
DROP POLICY IF EXISTS "members_read_games"   ON games;
DROP POLICY IF EXISTS "members_insert_games" ON games;
DROP POLICY IF EXISTS "members_update_games" ON games;
DROP POLICY IF EXISTS "members_delete_games" ON games;

CREATE POLICY "members_read_games" ON games FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "members_insert_games" ON games FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "members_update_games" ON games FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "members_delete_games" ON games FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- =============================================================
-- STEP 7: RLS Policies — game_points
-- =============================================================
DROP POLICY IF EXISTS "members_read_game_points"   ON game_points;
DROP POLICY IF EXISTS "members_insert_game_points" ON game_points;
DROP POLICY IF EXISTS "members_delete_game_points" ON game_points;

CREATE POLICY "members_read_game_points" ON game_points FOR SELECT
  USING (
    game_id IN (
      SELECT id FROM games WHERE organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "members_insert_game_points" ON game_points FOR INSERT
  WITH CHECK (
    game_id IN (
      SELECT id FROM games WHERE organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "members_delete_game_points" ON game_points FOR DELETE
  USING (
    game_id IN (
      SELECT id FROM games WHERE organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );

-- =============================================================
-- STEP 8: RLS Policies — spirit_ratings
-- =============================================================
DROP POLICY IF EXISTS "members_read_spirit_ratings"   ON spirit_ratings;
DROP POLICY IF EXISTS "members_insert_spirit_ratings" ON spirit_ratings;

CREATE POLICY "members_read_spirit_ratings" ON spirit_ratings FOR SELECT
  USING (
    game_id IN (
      SELECT id FROM games WHERE organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "members_insert_spirit_ratings" ON spirit_ratings FOR INSERT
  WITH CHECK (
    game_id IN (
      SELECT id FROM games WHERE organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );
