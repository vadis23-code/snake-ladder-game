-- ════════════════════════════════════════════════════════════
-- CourtCall — Fix Permissions & Missing Policies
-- Run in: SQL Editor → New query → paste ALL → Run
-- Project: jfeegcocynozbjpzbjae
--
-- Problem: Only profiles table was persisting data because
-- the handle_new_user trigger runs as SECURITY DEFINER
-- (bypasses RLS). All other writes from the authenticated
-- frontend client were blocked by missing GRANTs and/or
-- missing RLS policies.
--
-- This script:
--   1. Grants SELECT/INSERT/UPDATE/DELETE to authenticated & anon
--   2. Adds missing UPDATE/DELETE policies on games
--   3. Adds missing UPDATE policy on community_members
--   4. Safe to run multiple times (IF NOT EXISTS / OR REPLACE)
-- ════════════════════════════════════════════════════════════

-- ── 1. Explicit GRANTs ─────────────────────────────────────
-- Supabase should set default privileges, but if tables were
-- created before defaults or via migration, grants can be
-- missing. These are idempotent.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles              TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games                 TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities           TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members     TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts       TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_events      TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments           TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_players     TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_ratings     TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_gallery     TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_join_requests TO anon, authenticated, service_role;

-- Also grant sequence usage (needed for auto-incrementing columns)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Set defaults so future tables automatically get grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO anon, authenticated, service_role;

-- ── 2. Missing policies: games UPDATE & DELETE ─────────────
-- The games table only had SELECT and INSERT policies.
-- Without UPDATE, game stat updates fail silently.
-- Without DELETE, game deletion fails silently.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'games' AND policyname = 'games: own update'
  ) THEN
    CREATE POLICY "games: own update"
      ON public.games FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'games' AND policyname = 'games: own delete'
  ) THEN
    CREATE POLICY "games: own delete"
      ON public.games FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. Missing policy: community_members UPDATE ────────────
-- Member role changes (e.g., promoting to contributor/admin)
-- and profile name updates require an UPDATE policy.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'community_members' AND policyname = 'members: admin update'
  ) THEN
    CREATE POLICY "members: admin update"
      ON public.community_members FOR UPDATE
      USING (
        user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.communities c
          WHERE c.id = community_id AND c.creator_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 4. Grant EXECUTE on helper function ────────────────────
-- The is_community_member function is used in many policies.
-- Make sure all roles can execute it.

GRANT EXECUTE ON FUNCTION public.is_community_member(text, uuid) TO anon, authenticated, service_role;

-- ── 5. Verify: list all policies (for manual inspection) ───
-- Uncomment and run separately if you want to inspect:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;
