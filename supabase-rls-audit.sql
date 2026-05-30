-- CourtCall — Phase 0.6 RLS Audit & Hardening
-- Safe to run on an existing project. Run in Supabase: SQL Editor → New query.
-- Part 1 applies/repairs policies idempotently. Part 2 verifies the result.

-- ════════════════════════════════════════════════════════════
-- PART 1 — Apply / repair (idempotent)
-- ════════════════════════════════════════════════════════════

-- Ensure RLS is on for every table that holds user data.
alter table public.profiles            enable row level security;
alter table public.games               enable row level security;
alter table public.communities         enable row level security;
alter table public.community_members   enable row level security;
alter table public.community_posts     enable row level security;
alter table public.community_events    enable row level security;

-- Membership check that does NOT recurse on the community_members policy.
create or replace function public.is_community_member(comm_id text, uid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
    where community_id = comm_id and user_id = uid
  );
$$;

-- Repair the one policy that previously self-recursed.
drop policy if exists "members: community read" on public.community_members;
create policy "members: community read" on public.community_members
  for select using (
    user_id = auth.uid() or
    public.is_community_member(community_id, auth.uid())
  );

-- ════════════════════════════════════════════════════════════
-- PART 2 — Verify (read-only; inspect the output)
-- ════════════════════════════════════════════════════════════

-- 2a. RLS must be ENABLED (rowsecurity = true) on all six tables.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','games','communities',
                    'community_members','community_posts','community_events')
order by tablename;

-- 2b. List every policy so you can confirm scoping at a glance.
--     Expect: profiles/games scoped to auth.uid(); community tables
--     scoped to creator/member/public as documented.
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 2c. Sanity: no table above should have ZERO policies while RLS is on
--     (that would deny all access). Each should list at least one row in 2b.

-- Expected summary:
--   profiles            → own read/insert/update (auth.uid() = id)
--   games               → own read/insert (auth.uid() = user_id); no update/delete (denied)
--   communities         → public/creator/member read; creator insert/update/delete
--   community_members   → self or co-member read; self insert; self/creator delete
--   community_posts     → member/public read; member insert; author/creator update/delete
--   community_events    → member/public read; creator insert; creator delete
