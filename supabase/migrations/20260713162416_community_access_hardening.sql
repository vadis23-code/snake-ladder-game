-- CourtCall community access hardening
--
-- Assumptions retained for backwards compatibility:
--   * A `public` community accepts direct self-join requests.
--   * `private` and `hidden` communities never accept direct self-joins;
--     membership must be inserted by the creator or an existing admin/moderator.
--   * Existing admin/moderator assignments are trusted. This migration prevents
--     new self-escalation, but intentionally does not demote existing rows.
--
-- Deployment dependency:
--   This migration removes wildcard SELECT access to public.communities so the
--   invite_code column cannot leak. Browser clients must query
--   public.community_directory (discovery) or request explicit safe columns
--   from public.communities before this migration is applied remotely.

begin;

-- Keep RLS enabled even if an older setup script omitted it.
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.communities add column if not exists member_count integer not null default 0;

-- Visibility answers who can discover a community; join_policy separately
-- answers how an authenticated player may enter it. Existing rows are mapped
-- conservatively so private groups require approval and hidden groups remain
-- invite-only.
alter table public.communities add column if not exists join_policy text;
update public.communities
set join_policy = case
  when join_policy in ('open', 'approval', 'invite') then join_policy
  when visibility = 'hidden' then 'invite'
  when visibility = 'private' then 'approval'
  else 'open'
end;
alter table public.communities alter column join_policy set default 'open';
alter table public.communities alter column join_policy set not null;
do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.communities'::regclass
      and conname = 'communities_join_policy_check'
  ) then
    alter table public.communities
      add constraint communities_join_policy_check
      check (join_policy in ('open', 'approval', 'invite'));
  end if;
end
$constraint$;

-- Seed the denormalized count from authoritative membership rows. The trigger
-- installed below keeps it correct for future inserts/deletes, including the
-- SECURITY DEFINER invite-join path.
update public.communities as community
set member_count = (
  select count(*)::integer
  from public.community_members as member
  where member.community_id = community.id
)
where community.member_count is distinct from (
  select count(*)::integer
  from public.community_members as member
  where member.community_id = community.id
);

-- SECURITY DEFINER helpers live outside the exposed public schema. Every table
-- reference is schema-qualified and search_path is empty so an
-- attacker cannot shadow referenced objects. None of these helpers accepts a
-- caller-supplied user id; authorization always comes from auth.uid().
create schema if not exists courtcall_private;
revoke all on schema courtcall_private from public, anon, authenticated;
grant usage on schema courtcall_private to authenticated;

create or replace function courtcall_private.current_user_is_community_member(
  p_community_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.community_members as member
      where member.community_id = p_community_id
        and member.user_id = (select auth.uid())
    );
$function$;

create or replace function courtcall_private.current_user_can_manage_community(
  p_community_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.communities as community
        where community.id = p_community_id
          and community.creator_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.community_members as member
        where member.community_id = p_community_id
          and member.user_id = (select auth.uid())
          and member.role in ('admin', 'moderator')
      )
    );
$function$;

create or replace function courtcall_private.community_accepts_direct_join(
  p_community_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.communities as community
      where community.id = p_community_id
        and community.visibility = 'public'
        and community.join_policy = 'open'
    );
$function$;

-- PostgREST upserts include conflict-key columns in DO UPDATE. Keep those
-- upserts compatible while enforcing key immutability in a trigger, and keep
-- an ordinary member from changing their own role. A self-upsert that sends
-- role='member' for an existing contributor/admin preserves the existing role
-- instead of failing or silently demoting that account.
create or replace function courtcall_private.guard_community_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.community_id is distinct from old.community_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Community membership identity is immutable'
      using errcode = '42501';
  end if;

  -- Managers may change another member's role, but nobody may use a self
  -- update to promote their own membership (notably moderator -> admin).
  if new.role is distinct from old.role
     and (
       new.user_id = (select auth.uid())
       or not courtcall_private.current_user_can_manage_community(old.community_id)
     ) then
    new.role := old.role;
  end if;

  return new;
end
$function$;

create or replace function courtcall_private.refresh_community_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_community_id text;
begin
  target_community_id := case
    when tg_op = 'DELETE' then old.community_id
    else new.community_id
  end;

  update public.communities as community
  set member_count = (
    select count(*)::integer
    from public.community_members as member
    where member.community_id = target_community_id
  )
  where community.id = target_community_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

revoke all on function courtcall_private.current_user_is_community_member(text)
  from public, anon, authenticated;
revoke all on function courtcall_private.current_user_can_manage_community(text)
  from public, anon, authenticated;
revoke all on function courtcall_private.community_accepts_direct_join(text)
  from public, anon, authenticated;
revoke all on function courtcall_private.guard_community_member_update()
  from public, anon, authenticated;
revoke all on function courtcall_private.refresh_community_member_count()
  from public, anon, authenticated;
grant execute on function courtcall_private.current_user_is_community_member(text)
  to authenticated;
grant execute on function courtcall_private.current_user_can_manage_community(text)
  to authenticated;
grant execute on function courtcall_private.community_accepts_direct_join(text)
  to authenticated;

-- Preserve the signature used by older RLS policies, but never trust the
-- caller-supplied uid. The legacy implementation let RPC callers probe whether
-- any known UUID belonged to a community.
create or replace function public.is_community_member(comm_id text, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and uid = (select auth.uid())
    and exists (
      select 1
      from public.community_members as member
      where member.community_id = comm_id
        and member.user_id = (select auth.uid())
    );
$function$;
revoke all on function public.is_community_member(text, uuid)
  from public, anon, authenticated;
grant execute on function public.is_community_member(text, uuid)
  to anon, authenticated, service_role;

-- supabase-enhancements.sql shipped this code-check helper as a public
-- SECURITY DEFINER function. It is not used by current policies or clients and
-- otherwise acts as a low-cost invite-code brute-force oracle.
do $legacy_invite_helper$
begin
  if to_regprocedure('public.community_allows_join(text,text)') is not null then
    revoke all on function public.community_allows_join(text, text)
      from public, anon, authenticated;
  end if;
end
$legacy_invite_helper$;

comment on function courtcall_private.current_user_is_community_member(text) is
  'RLS helper: true when auth.uid() is a member of the supplied CourtCall community.';
comment on function courtcall_private.current_user_can_manage_community(text) is
  'RLS helper: true for the community creator or an existing admin/moderator.';
comment on function courtcall_private.community_accepts_direct_join(text) is
  'RLS helper: direct self-join is allowed only for public communities.';

drop trigger if exists trg_community_member_update_guard
  on public.community_members;
create trigger trg_community_member_update_guard
  before update on public.community_members
  for each row execute function courtcall_private.guard_community_member_update();

-- Replace the older increment/decrement trigger shipped by
-- supabase-enhancements.sql; recalculation is idempotent and cannot drift.
drop trigger if exists trg_member_change on public.community_members;
drop trigger if exists trg_community_member_count_refresh
  on public.community_members;
create trigger trg_community_member_count_refresh
  after insert or delete on public.community_members
  for each row execute function courtcall_private.refresh_community_member_count();

-- Replace recursive/overly broad community read rules. Restrictive guards keep
-- unknown permissive policies from widening public/private visibility.
drop policy if exists "communities: public read" on public.communities;
drop policy if exists "communities: public rows read hardened" on public.communities;
drop policy if exists "communities: member rows read hardened" on public.communities;
drop policy if exists "communities: anon visibility guard" on public.communities;
drop policy if exists "communities: authenticated visibility guard" on public.communities;

create policy "communities: public rows read hardened"
  on public.communities
  as permissive
  for select
  to anon, authenticated
  using (visibility = 'public');

create policy "communities: member rows read hardened"
  on public.communities
  as permissive
  for select
  to authenticated
  using (
    creator_id = (select auth.uid())
    or (select courtcall_private.current_user_is_community_member(id))
  );

create policy "communities: anon visibility guard"
  on public.communities
  as restrictive
  for select
  to anon
  using (visibility = 'public');

create policy "communities: authenticated visibility guard"
  on public.communities
  as restrictive
  for select
  to authenticated
  using (
    visibility = 'public'
    or creator_id = (select auth.uid())
    or (select courtcall_private.current_user_is_community_member(id))
  );

-- A SECURITY INVOKER view is the only wildcard-safe public directory surface.
-- invite_code and creator_id are intentionally excluded.
create or replace view public.community_directory
with (security_invoker = true, security_barrier = true)
as
select
  id,
  name,
  description,
  type,
  visibility,
  logo,
  location,
  join_policy,
  member_count,
  read_only,
  comments_locked,
  ratings_disabled,
  created_at
from public.communities
where visibility = 'public';

comment on view public.community_directory is
  'Public CourtCall community discovery data. Deliberately excludes invite_code and creator identity.';

-- RLS cannot hide individual columns. Remove the previous table-wide SELECT
-- grants, then restore only non-secret columns required by the app and invoker
-- view. service_role and the table owner retain their existing privileges.
revoke select on table public.communities from public, anon, authenticated;
-- Table- and column-level privileges are independent in PostgreSQL. Explicitly
-- remove a legacy column grant as well so invite_code cannot survive the
-- table-level REVOKE through an earlier hand-written GRANT.
revoke select (invite_code) on table public.communities
  from public, anon, authenticated;
grant select (
  id, name, description, type, visibility, logo, location,
  join_policy, member_count, read_only, comments_locked, ratings_disabled, created_at
) on table public.communities to anon;
grant select (
  id, creator_id, name, description, type, visibility, logo, location,
  join_policy, member_count, read_only, comments_locked, ratings_disabled, created_at
) on table public.communities to authenticated;

revoke all on table public.community_directory from public, anon, authenticated;
grant select on table public.community_directory to anon, authenticated;

-- A legacy SECURITY DEFINER view selected c.* (including invite_code and any
-- future secret columns). The bounded RPC below replaces that surface.
do $legacy_private_view$
begin
  if to_regclass('public.communities_private') is not null then
    revoke all on table public.communities_private
      from public, anon, authenticated;
  end if;
end
$legacy_private_view$;

-- Invite codes remain unavailable through table/view SELECT. An authenticated
-- creator or member can retrieve only codes for communities they already
-- belong to, in one bounded RPC call.
create or replace function public.get_my_community_invite_codes()
returns table (community_id text, invite_code text)
language sql
stable
security definer
set search_path = ''
as $function$
  select community.id, community.invite_code
  from public.communities as community
  where (select auth.uid()) is not null
    and community.invite_code is not null
    and (
      community.creator_id = (select auth.uid())
      or exists (
        select 1 from public.community_members as member
        where member.community_id = community.id
          and member.user_id = (select auth.uid())
      )
    );
$function$;

revoke all on function public.get_my_community_invite_codes()
  from public, anon, authenticated;
grant execute on function public.get_my_community_invite_codes()
  to authenticated;
comment on function public.get_my_community_invite_codes() is
  'Returns invite codes only for communities the current CourtCall user already manages or belongs to.';

-- Invite-only communities are not discoverable, so joining is performed by a
-- constrained server operation that never reveals whether arbitrary codes
-- exist beyond the single successful result.
create index if not exists idx_communities_invite_code_ci
  on public.communities (upper(invite_code))
  where invite_code is not null and join_policy = 'invite';

create or replace function public.join_community_by_invite(
  p_invite_code text,
  p_profile_name text default ''
)
returns table (community_id text, community_name text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_id text;
  target_name text;
  normalized_code text;
  target_matches integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Bound and normalize attacker-controlled input before touching the indexed
  -- communities table. Legacy CourtCall codes are 4-64 URL-safe characters.
  if p_invite_code is null or octet_length(p_invite_code) > 128 then
    raise exception 'Invalid or expired invite code' using errcode = 'P0002';
  end if;
  normalized_code := upper(btrim(p_invite_code));
  if length(normalized_code) not between 4 and 64
     or normalized_code !~ '^[A-Z0-9_-]+$' then
    raise exception 'Invalid or expired invite code' using errcode = 'P0002';
  end if;

  select min(community.id), min(community.name), count(*)::integer
  into target_id, target_name, target_matches
  from public.communities as community
  where community.join_policy = 'invite'
    and upper(community.invite_code) = normalized_code;

  -- Treat a legacy case-insensitive duplicate as invalid rather than choosing
  -- a community nondeterministically.
  if target_matches <> 1 or target_id is null then
    raise exception 'Invalid or expired invite code' using errcode = 'P0002';
  end if;

  insert into public.community_members (community_id, user_id, role, profile_name)
  values (target_id, (select auth.uid()), 'member', left(coalesce(p_profile_name, ''), 120))
  on conflict (community_id, user_id)
  do update set profile_name = excluded.profile_name;

  return query select target_id, target_name;
end
$function$;

revoke all on function public.join_community_by_invite(text, text)
  from public, anon, authenticated;
grant execute on function public.join_community_by_invite(text, text)
  to authenticated;
comment on function public.join_community_by_invite(text, text) is
  'Adds the current authenticated user to one invite-only community after a valid code match.';

-- Replace membership policies that previously allowed any authenticated user
-- to join a private community and allowed a member to promote their own role.
drop policy if exists "members: community read" on public.community_members;
drop policy if exists "members: self insert" on public.community_members;
drop policy if exists "members: admin insert" on public.community_members;
drop policy if exists "members: admin update" on public.community_members;
drop policy if exists "members: read hardened" on public.community_members;
drop policy if exists "members: read guard" on public.community_members;
drop policy if exists "members: public self join hardened" on public.community_members;
drop policy if exists "members: manager insert hardened" on public.community_members;
drop policy if exists "members: insert guard" on public.community_members;
drop policy if exists "members: manager update hardened" on public.community_members;
drop policy if exists "members: self profile update hardened" on public.community_members;
drop policy if exists "members: update guard" on public.community_members;

create policy "members: read hardened"
  on public.community_members
  as permissive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select courtcall_private.current_user_is_community_member(community_id))
  );

create policy "members: read guard"
  on public.community_members
  as restrictive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select courtcall_private.current_user_is_community_member(community_id))
  );

create policy "members: public self join hardened"
  on public.community_members
  as permissive
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce(role, 'member') = 'member'
    and (select courtcall_private.community_accepts_direct_join(community_id))
  );

create policy "members: manager insert hardened"
  on public.community_members
  as permissive
  for insert
  to authenticated
  with check (
    (select courtcall_private.current_user_can_manage_community(community_id))
    and coalesce(role, 'member') in ('member', 'contributor', 'moderator', 'admin')
  );

-- This restrictive policy is deliberate defense in depth: even if a legacy or
-- project-specific permissive INSERT policy remains, it cannot admit a private
-- self-join or an admin-role self-insert.
create policy "members: insert guard"
  on public.community_members
  as restrictive
  for insert
  to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and coalesce(role, 'member') = 'member'
      and (select courtcall_private.community_accepts_direct_join(community_id))
    )
    or (
      (select courtcall_private.current_user_can_manage_community(community_id))
      and coalesce(role, 'member') in ('member', 'contributor', 'moderator', 'admin')
    )
  );

create policy "members: manager update hardened"
  on public.community_members
  as permissive
  for update
  to authenticated
  using ((select courtcall_private.current_user_can_manage_community(community_id)))
  with check (
    (select courtcall_private.current_user_can_manage_community(community_id))
    and coalesce(role, 'member') in ('member', 'contributor', 'moderator', 'admin')
  );

create policy "members: self profile update hardened"
  on public.community_members
  as permissive
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "members: update guard"
  on public.community_members
  as restrictive
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select courtcall_private.current_user_can_manage_community(community_id))
  )
  with check (
    (
      user_id = (select auth.uid())
      or (select courtcall_private.current_user_can_manage_community(community_id))
    )
    and coalesce(role, 'member') in ('member', 'contributor', 'moderator', 'admin')
  );

-- Column privileges expose only the fields used by the browser upserts. The
-- trigger above makes community_id/user_id immutable because a policy alone
-- cannot compare OLD and NEW rows.
revoke select, insert, update on table public.community_members
  from public, anon, authenticated;
revoke insert (community_id, user_id, role, profile_name, joined_at)
  on table public.community_members from public, anon, authenticated;
revoke update (community_id, user_id, role, profile_name, joined_at)
  on table public.community_members from public, anon, authenticated;
grant select on table public.community_members to authenticated;
grant insert (community_id, user_id, role, profile_name)
  on table public.community_members to authenticated;
grant update (community_id, user_id, role, profile_name)
  on table public.community_members to authenticated;

-- Preserve ownership explicitly on update policies where the ownership model
-- is unambiguous. Optional feature tables are handled conditionally so this
-- migration remains compatible with both the minimal and enhanced schemas.
drop policy if exists "communities: admin update" on public.communities;
drop policy if exists "communities: owner update guard" on public.communities;
create policy "communities: admin update"
  on public.communities
  as permissive
  for update
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));
create policy "communities: owner update guard"
  on public.communities
  as restrictive
  for update
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

do $migration$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "profiles: own update" on public.profiles';
    execute 'drop policy if exists "profiles: ownership update guard" on public.profiles';
    execute 'create policy "profiles: own update" on public.profiles as permissive for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()))';
    execute 'create policy "profiles: ownership update guard" on public.profiles as restrictive for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()))';
  end if;

  if to_regclass('public.games') is not null then
    execute 'drop policy if exists "games: own update" on public.games';
    execute 'drop policy if exists "games: ownership update guard" on public.games';
    execute 'create policy "games: own update" on public.games as permissive for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
    execute 'create policy "games: ownership update guard" on public.games as restrictive for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
  end if;

  if to_regclass('public.tournaments') is not null then
    execute 'drop policy if exists "tournaments: own update" on public.tournaments';
    execute 'drop policy if exists "tournaments: ownership update guard" on public.tournaments';
    execute 'create policy "tournaments: own update" on public.tournaments as permissive for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
    execute 'create policy "tournaments: ownership update guard" on public.tournaments as restrictive for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
  end if;

  if to_regclass('public.community_ratings') is not null then
    execute 'drop policy if exists "ratings: rater update" on public.community_ratings';
    execute 'drop policy if exists "cr: own update" on public.community_ratings';
    execute 'drop policy if exists "ratings: ownership update guard" on public.community_ratings';
    execute 'create policy "ratings: rater update" on public.community_ratings as permissive for update to authenticated using (rater_id = (select auth.uid())) with check (rater_id = (select auth.uid()))';
    execute 'create policy "ratings: ownership update guard" on public.community_ratings as restrictive for update to authenticated using (rater_id = (select auth.uid())) with check (rater_id = (select auth.uid()))';
  end if;

  if to_regclass('public.community_gallery') is not null then
    execute 'drop policy if exists "gallery: uploader update" on public.community_gallery';
    execute 'drop policy if exists "gal: own update" on public.community_gallery';
    execute 'drop policy if exists "gallery: ownership update guard" on public.community_gallery';
    execute 'create policy "gallery: uploader update" on public.community_gallery as permissive for update to authenticated using (uploader_id = (select auth.uid())) with check (uploader_id = (select auth.uid()))';
    execute 'create policy "gallery: ownership update guard" on public.community_gallery as restrictive for update to authenticated using (uploader_id = (select auth.uid())) with check (uploader_id = (select auth.uid()))';
  end if;
end
$migration$;

-- Post-apply verification suggestions (intentionally not executed here):
--   select policyname, permissive, cmd, roles, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('communities', 'community_members')
--   order by tablename, cmd, policyname;
--
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_schema = 'public'
--     and table_name in ('communities', 'community_members')
--   order by table_name, grantee, privilege_type, column_name;

commit;
