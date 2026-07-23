-- Align the long-lived CourtCall tables with fields already read or written by
-- the browser client. Every addition is nullable/defaulted and therefore
-- backward compatible with existing rows and older app versions.

begin;

alter table if exists public.profiles
  add column if not exists avatar text,
  add column if not exists jersey_number text,
  add column if not exists position text,
  add column if not exists preferred_game_type text,
  add column if not exists skill_info text;

alter table if exists public.community_events
  add column if not exists event_type text default 'pickup',
  add column if not exists event_time text,
  add column if not exists max_attendees integer,
  add column if not exists creator_name text,
  add column if not exists rsvps jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz;

-- ADD COLUMN IF NOT EXISTS does not repair constraints/defaults on a column
-- created by an older enhancement script. Normalize that known legacy shape.
do $events_alignment$
begin
  if to_regclass('public.community_events') is not null then
    update public.community_events
    set rsvps = '[]'::jsonb
    where rsvps is null or jsonb_typeof(rsvps) <> 'array';
    alter table public.community_events
      alter column rsvps set default '[]'::jsonb,
      alter column rsvps set not null;
  end if;
end
$events_alignment$;

alter table if exists public.community_players
  add column if not exists jersey_num text,
  add column if not exists creator_id uuid references public.profiles(id) on delete set null,
  add column if not exists wins integer not null default 0,
  add column if not exists losses integer not null default 0,
  add column if not exists points integer not null default 0,
  add column if not exists mvp_count integer not null default 0;

alter table if exists public.tournaments
  add column if not exists win_score integer not null default 21,
  add column if not exists winner text,
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- Event identity/ownership must not be movable through a broad UPDATE. The
-- atomic RSVP RPC below is the write surface for ordinary members; event
-- creators and community managers retain normal edit access.
create or replace function courtcall_private.guard_community_event_identity_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.community_id is distinct from old.community_id
     or new.creator_id is distinct from old.creator_id then
    raise exception 'Event identity and ownership are immutable'
      using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function courtcall_private.guard_community_event_identity_update()
  from public, anon, authenticated;

do $event_policies$
begin
  if to_regclass('public.community_events') is not null then
    execute 'drop trigger if exists trg_community_event_identity_guard on public.community_events';
    execute 'create trigger trg_community_event_identity_guard before update on public.community_events for each row execute function courtcall_private.guard_community_event_identity_update()';

    execute 'drop policy if exists "events: member insert" on public.community_events';
    execute 'drop policy if exists "events: insert guard" on public.community_events';
    execute 'create policy "events: member insert" on public.community_events as permissive for insert to authenticated with check (creator_id = (select auth.uid()) and ((select courtcall_private.current_user_is_community_member(community_id)) or (select courtcall_private.current_user_can_manage_community(community_id))))';
    execute 'create policy "events: insert guard" on public.community_events as restrictive for insert to authenticated with check (creator_id = (select auth.uid()) and ((select courtcall_private.current_user_is_community_member(community_id)) or (select courtcall_private.current_user_can_manage_community(community_id))))';

    execute 'drop policy if exists "events: creator update" on public.community_events';
    execute 'drop policy if exists "events: owner update hardened" on public.community_events';
    execute 'drop policy if exists "events: update guard" on public.community_events';
    execute 'create policy "events: owner update hardened" on public.community_events as permissive for update to authenticated using (creator_id = (select auth.uid()) or (select courtcall_private.current_user_can_manage_community(community_id))) with check (creator_id = (select auth.uid()) or (select courtcall_private.current_user_can_manage_community(community_id)))';
    execute 'create policy "events: update guard" on public.community_events as restrictive for update to authenticated using (creator_id = (select auth.uid()) or (select courtcall_private.current_user_can_manage_community(community_id))) with check (creator_id = (select auth.uid()) or (select courtcall_private.current_user_can_manage_community(community_id)))';
  end if;
end
$event_policies$;

create or replace function public.set_community_event_rsvp(
  p_event_id text,
  p_status text default null,
  p_profile_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
  event_community_id text;
  event_max_attendees integer;
  event_rsvps jsonb;
  next_rsvps jsonb;
  going_count integer;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_status is not null
     and p_status not in ('going', 'maybe', 'not_going', 'need_team', 'running_late') then
    raise exception 'Invalid RSVP status' using errcode = '22023';
  end if;

  select event.community_id,
         event.max_attendees,
         case
           when jsonb_typeof(event.rsvps) = 'array' then event.rsvps
           else '[]'::jsonb
         end
  into event_community_id, event_max_attendees, event_rsvps
  from public.community_events as event
  where event.id = p_event_id
  for update;

  if not found then
    raise exception 'Event unavailable' using errcode = 'P0002';
  end if;
  if not (select courtcall_private.current_user_is_community_member(event_community_id))
     and not (select courtcall_private.current_user_can_manage_community(event_community_id)) then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item.value), '[]'::jsonb)
  into next_rsvps
  from jsonb_array_elements(event_rsvps) as item(value)
  where item.value ->> 'profileId' is distinct from current_user_id::text;

  if p_status = 'going' and coalesce(event_max_attendees, 0) > 0 then
    select count(*)::integer
    into going_count
    from jsonb_array_elements(next_rsvps) as item(value)
    where item.value ->> 'status' = 'going';
    if going_count >= event_max_attendees then
      raise exception 'Event is full' using errcode = '23514';
    end if;
  end if;

  -- NULL removes the caller's RSVP; every non-NULL status replaces only that
  -- caller's entry while the row lock prevents concurrent lost updates.
  if p_status is not null then
    next_rsvps := next_rsvps || jsonb_build_array(jsonb_build_object(
      'profileId', current_user_id::text,
      'profileName', left(coalesce(p_profile_name, ''), 120),
      'status', p_status,
      'updatedAt', clock_timestamp()
    ));
  end if;

  update public.community_events
  set rsvps = next_rsvps,
      updated_at = clock_timestamp()
  where id = p_event_id;

  return next_rsvps;
end
$function$;

revoke all on function public.set_community_event_rsvp(text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_community_event_rsvp(text, text, text)
  to authenticated;
comment on function public.set_community_event_rsvp(text, text, text) is
  'Atomically replaces or removes only the authenticated member''s RSVP entry.';

-- COMMENT ON has no IF EXISTS form. Keep the migration valid for minimal
-- installations where one of these optional feature tables is absent.
do $comments$
begin
  if to_regclass('public.profiles') is not null then
    comment on column public.profiles.skill_info is
      'Device-safe playing-style or skill summary migrated from a CourtCall local profile.';
  end if;
  if to_regclass('public.community_events') is not null then
    comment on column public.community_events.event_time is
      'Local wall-clock display value retained separately from the legacy text event_date column.';
  end if;
end
$comments$;

commit;
