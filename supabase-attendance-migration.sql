-- =============================================================
-- Attendance Data Table
-- Ultimate Coaching Suite
--
-- Run in Supabase SQL Editor (Dashboard > SQL Editor).
-- Requires is_org_member() function from supabase-rls-policies.sql.
-- Safe to re-run: DROP IF EXISTS guards all objects.
-- =============================================================

-- One row per roster — stores practice labels and all attendance records
CREATE TABLE IF NOT EXISTS attendance_data (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id       uuid        UNIQUE NOT NULL REFERENCES rosters(id)       ON DELETE CASCADE,
  organization_id uuid        NOT NULL     REFERENCES organizations(id)    ON DELETE CASCADE,
  practices       text[]      NOT NULL DEFAULT '{}',
  records         jsonb       NOT NULL DEFAULT '{}',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE attendance_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe re-run)
DROP POLICY IF EXISTS "members_read_attendance_data"   ON attendance_data;
DROP POLICY IF EXISTS "members_insert_attendance_data" ON attendance_data;
DROP POLICY IF EXISTS "members_update_attendance_data" ON attendance_data;
DROP POLICY IF EXISTS "members_delete_attendance_data" ON attendance_data;

-- All org members can read their roster's attendance
CREATE POLICY "members_read_attendance_data"
  ON attendance_data FOR SELECT
  USING (is_org_member(organization_id));

-- Org members can create a new attendance_data row for their roster
CREATE POLICY "members_insert_attendance_data"
  ON attendance_data FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- Org members can update attendance records for their roster
CREATE POLICY "members_update_attendance_data"
  ON attendance_data FOR UPDATE
  USING (is_org_member(organization_id));

-- Org members can delete attendance data for their roster
CREATE POLICY "members_delete_attendance_data"
  ON attendance_data FOR DELETE
  USING (is_org_member(organization_id));
