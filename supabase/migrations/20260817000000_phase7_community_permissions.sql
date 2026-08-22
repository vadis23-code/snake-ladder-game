-- CourtCall Phase 7 community permission alignment.
-- Narrows the existing browser-visible policies to the four documented client
-- roles without renaming a table, column, key, or existing RPC.

begin;

create or replace function courtcall_private.current_user_can_contribute(
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
        select 1 from public.communities as community
        where community.id = p_community_id
          and community.creator_id = (select auth.uid())
      )
      or exists (
        select 1 from public.community_members as member
        where member.community_id = p_community_id
          and member.user_id = (select auth.uid())
          and member.role in ('admin', 'contributor', 'moderator')
      )
    );
$function$;

revoke all on function courtcall_private.current_user_can_contribute(text)
  from public, anon, authenticated;
grant execute on function courtcall_private.current_user_can_contribute(text)
  to authenticated;

-- The creator is the durable owner. Their membership row cannot be removed or
-- demoted by another admin, and an admin cannot remove their own admin role.
create or replace function courtcall_private.guard_community_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  community_owner uuid;
begin
  if new.community_id is distinct from old.community_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Community membership identity is immutable'
      using errcode = '42501';
  end if;

  select community.creator_id into community_owner
  from public.communities as community
  where community.id = old.community_id;

  if new.role is distinct from old.role then
    if old.user_id = community_owner then
      raise exception 'Community owner role is protected' using errcode = '42501';
    end if;
    if new.user_id = (select auth.uid())
       or not courtcall_private.current_user_can_manage_community(old.community_id) then
      raise exception 'Community role change is not allowed' using errcode = '42501';
    end if;
    if new.role not in ('admin', 'contributor', 'member') then
      raise exception 'Invalid CourtCall community role' using errcode = '22023';
    end if;
  end if;
  return new;
end
$function$;

create or replace function courtcall_private.guard_community_member_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  community_owner uuid;
begin
  select community.creator_id into community_owner
  from public.communities as community
  where community.id = old.community_id;
  if old.user_id = community_owner then
    raise exception 'Community owner membership is protected' using errcode = '42501';
  end if;
  if old.user_id = (select auth.uid()) and old.role in ('admin', 'moderator') then
    raise exception 'Admins must be reassigned before leaving' using errcode = '42501';
  end if;
  return old;
end
$function$;

revoke all on function courtcall_private.guard_community_member_update()
  from public, anon, authenticated;
revoke all on function courtcall_private.guard_community_member_delete()
  from public, anon, authenticated;

drop trigger if exists trg_community_member_delete_guard on public.community_members;
create trigger trg_community_member_delete_guard
  before delete on public.community_members
  for each row execute function courtcall_private.guard_community_member_delete();

drop policy if exists "members: self delete" on public.community_members;
drop policy if exists "members: manager delete hardened" on public.community_members;
drop policy if exists "members: self delete hardened" on public.community_members;
drop policy if exists "members: delete guard" on public.community_members;
create policy "members: manager delete hardened"
  on public.community_members as permissive for delete to authenticated
  using ((select courtcall_private.current_user_can_manage_community(community_id)));
create policy "members: self delete hardened"
  on public.community_members as permissive for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "members: delete guard"
  on public.community_members as restrictive for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role not in ('admin', 'moderator'))
    or (
      user_id <> (select auth.uid())
      and (select courtcall_private.current_user_can_manage_community(community_id))
      and not exists (
        select 1 from public.communities as community
        where community.id = community_members.community_id
          and community.creator_id = community_members.user_id
      )
    )
  );
grant delete on table public.community_members to authenticated;

-- Documented admins may edit settings. Permanent community deletion remains
-- governed by the existing creator-only DELETE policy.
drop policy if exists "communities: admin update" on public.communities;
drop policy if exists "communities: owner update guard" on public.communities;
drop policy if exists "communities: manager update hardened" on public.communities;
drop policy if exists "communities: manager update guard" on public.communities;
create policy "communities: manager update hardened"
  on public.communities as permissive for update to authenticated
  using ((select courtcall_private.current_user_can_manage_community(id)))
  with check ((select courtcall_private.current_user_can_manage_community(id)));
create policy "communities: manager update guard"
  on public.communities as restrictive for update to authenticated
  using ((select courtcall_private.current_user_can_manage_community(id)))
  with check ((select courtcall_private.current_user_can_manage_community(id)));
grant update (name, description, visibility, logo, location, join_policy,
  read_only, comments_locked, ratings_disabled)
  on table public.communities to authenticated;

-- Existing setup scripts allowed any member to insert roster, gallery, and
-- event records. Restrictive policies keep those writes at contributor/admin.
do $phase7_optional_tables$
begin
  if to_regclass('public.community_players') is not null then
    execute 'drop policy if exists "cp: contributor insert guard" on public.community_players';
    execute 'drop policy if exists "cp: contributor update guard" on public.community_players';
    execute 'drop policy if exists "cp: contributor delete guard" on public.community_players';
    execute 'create policy "cp: contributor insert guard" on public.community_players as restrictive for insert to authenticated with check ((select courtcall_private.current_user_can_contribute(community_id)))';
    execute 'create policy "cp: contributor update guard" on public.community_players as restrictive for update to authenticated using ((select courtcall_private.current_user_can_manage_community(community_id)) or (creator_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id)))) with check ((select courtcall_private.current_user_can_manage_community(community_id)) or (creator_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id))))';
    execute 'create policy "cp: contributor delete guard" on public.community_players as restrictive for delete to authenticated using ((select courtcall_private.current_user_can_manage_community(community_id)) or (creator_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id))))';
  end if;

  if to_regclass('public.community_gallery') is not null then
    execute 'drop policy if exists "gal: contributor insert guard" on public.community_gallery';
    execute 'drop policy if exists "gal: contributor update guard" on public.community_gallery';
    execute 'drop policy if exists "gal: contributor delete guard" on public.community_gallery';
    execute 'create policy "gal: contributor insert guard" on public.community_gallery as restrictive for insert to authenticated with check (uploader_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id)))';
    execute 'create policy "gal: contributor update guard" on public.community_gallery as restrictive for update to authenticated using ((select courtcall_private.current_user_can_manage_community(community_id)) or (uploader_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id)))) with check ((select courtcall_private.current_user_can_manage_community(community_id)) or (uploader_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id))))';
    execute 'create policy "gal: contributor delete guard" on public.community_gallery as restrictive for delete to authenticated using ((select courtcall_private.current_user_can_manage_community(community_id)) or (uploader_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id))))';
  end if;

  if to_regclass('public.community_events') is not null then
    execute 'drop policy if exists "events: contributor insert guard" on public.community_events';
    execute 'drop policy if exists "events: contributor update guard" on public.community_events';
    execute 'drop policy if exists "events: contributor delete guard" on public.community_events';
    execute 'create policy "events: contributor insert guard" on public.community_events as restrictive for insert to authenticated with check (creator_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id)))';
    execute 'create policy "events: contributor update guard" on public.community_events as restrictive for update to authenticated using ((select courtcall_private.current_user_can_manage_community(community_id)) or (creator_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id)))) with check ((select courtcall_private.current_user_can_manage_community(community_id)) or (creator_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id))))';
    execute 'create policy "events: contributor delete guard" on public.community_events as restrictive for delete to authenticated using ((select courtcall_private.current_user_can_manage_community(community_id)) or (creator_id = (select auth.uid()) and (select courtcall_private.current_user_can_contribute(community_id))))';
  end if;

  if to_regclass('public.community_ratings') is not null then
    execute 'drop policy if exists "ratings: enabled insert guard" on public.community_ratings';
    execute 'drop policy if exists "ratings: enabled update guard" on public.community_ratings';
    execute 'create policy "ratings: enabled insert guard" on public.community_ratings as restrictive for insert to authenticated with check (rater_id = (select auth.uid()) and exists (select 1 from public.communities as community where community.id = community_ratings.community_id and not coalesce(community.ratings_disabled, false)))';
    execute 'create policy "ratings: enabled update guard" on public.community_ratings as restrictive for update to authenticated using (rater_id = (select auth.uid()) and exists (select 1 from public.communities as community where community.id = community_ratings.community_id and not coalesce(community.ratings_disabled, false))) with check (rater_id = (select auth.uid()) and exists (select 1 from public.communities as community where community.id = community_ratings.community_id and not coalesce(community.ratings_disabled, false)))';
  end if;
end
$phase7_optional_tables$;

-- Read-only mode is a server-side posting rule as well as a client affordance.
drop policy if exists "posts: read-only insert guard" on public.community_posts;
create policy "posts: read-only insert guard"
  on public.community_posts as restrictive for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select courtcall_private.current_user_is_community_member(community_posts.community_id))
    and exists (
      select 1 from public.communities as community
      where community.id = community_posts.community_id
        and (
          not coalesce(community.read_only, false)
          or (select courtcall_private.current_user_can_manage_community(community_posts.community_id))
        )
    )
  );

drop policy if exists "posts: edit guard" on public.community_posts;
create policy "posts: edit guard"
  on public.community_posts as restrictive for update to authenticated
  using (
    (select courtcall_private.current_user_can_manage_community(community_posts.community_id))
    or (
      user_id = (select auth.uid())
      and (select courtcall_private.current_user_is_community_member(community_posts.community_id))
      and exists (
        select 1 from public.communities as community
        where community.id = community_posts.community_id
          and not coalesce(community.read_only, false)
      )
    )
  )
  with check (
    (select courtcall_private.current_user_can_manage_community(community_posts.community_id))
    or (
      user_id = (select auth.uid())
      and (select courtcall_private.current_user_is_community_member(community_posts.community_id))
      and exists (
        select 1 from public.communities as community
        where community.id = community_posts.community_id
          and not coalesce(community.read_only, false)
      )
    )
  );

drop policy if exists "posts: delete guard" on public.community_posts;
create policy "posts: delete guard"
  on public.community_posts as restrictive for delete to authenticated
  using (
    (select courtcall_private.current_user_can_manage_community(community_posts.community_id))
    or (
      user_id = (select auth.uid())
      and (select courtcall_private.current_user_is_community_member(community_posts.community_id))
    )
  );

-- Embedded reaction/comment JSON remains compatible, but mutations happen in
-- row-locked RPCs so members never need broad UPDATE access to another
-- member's post or gallery record.
create or replace function public.set_community_post_reaction(
  p_post_id text,
  p_reaction text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_community_id text;
  current_reactions jsonb;
  next_values jsonb;
begin
  if (select auth.uid()) is null or p_reaction not in ('like', 'fire', 'clap') then
    raise exception 'Reaction unavailable' using errcode = '42501';
  end if;
  select post.community_id, coalesce(post.reactions, '{}'::jsonb)
  into target_community_id, current_reactions
  from public.community_posts as post where post.id = p_post_id for update;
  if not found or not (select courtcall_private.current_user_is_community_member(target_community_id)) then
    raise exception 'Reaction unavailable' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(value), '[]'::jsonb) into next_values
  from jsonb_array_elements(case when jsonb_typeof(current_reactions -> p_reaction) = 'array' then current_reactions -> p_reaction else '[]'::jsonb end) as entry(value)
  where entry.value #>> '{}' is distinct from (select auth.uid())::text;
  if p_active then next_values := next_values || to_jsonb((select auth.uid())::text); end if;
  current_reactions := jsonb_set(current_reactions, array[p_reaction], next_values, true);
  update public.community_posts set reactions = current_reactions where id = p_post_id;
  return current_reactions;
end
$function$;

create or replace function public.add_community_post_comment(
  p_post_id text,
  p_comment_id text,
  p_body text,
  p_author_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_community_id text;
  current_comments jsonb;
  comments_locked boolean;
begin
  if (select auth.uid()) is null or length(btrim(coalesce(p_body, ''))) not between 1 and 200 then
    raise exception 'Comment unavailable' using errcode = '22023';
  end if;
  select post.community_id, case when jsonb_typeof(post.comments) = 'array' then post.comments else '[]'::jsonb end,
         coalesce(community.comments_locked, false)
  into target_community_id, current_comments, comments_locked
  from public.community_posts as post
  join public.communities as community on community.id = post.community_id
  where post.id = p_post_id for update of post;
  if not found or not (select courtcall_private.current_user_is_community_member(target_community_id))
     or (comments_locked and not (select courtcall_private.current_user_can_manage_community(target_community_id))) then
    raise exception 'Comment unavailable' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(entry.value), '[]'::jsonb) into current_comments
  from jsonb_array_elements(current_comments) as entry(value)
  where entry.value ->> 'id' is distinct from p_comment_id;
  current_comments := current_comments || jsonb_build_array(jsonb_build_object(
    'id', left(coalesce(p_comment_id, ''), 180), 'authorId', (select auth.uid())::text,
    'authorName', left(coalesce(p_author_name, ''), 120), 'body', left(btrim(p_body), 200),
    'createdAt', clock_timestamp()
  ));
  update public.community_posts set comments = current_comments where id = p_post_id;
  return current_comments;
end
$function$;

create or replace function public.delete_community_post_comment(
  p_post_id text,
  p_comment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_community_id text;
  current_comments jsonb;
  target_author text;
begin
  select post.community_id, case when jsonb_typeof(post.comments) = 'array' then post.comments else '[]'::jsonb end
  into target_community_id, current_comments
  from public.community_posts as post where post.id = p_post_id for update;
  select entry.value ->> 'authorId' into target_author
  from jsonb_array_elements(current_comments) as entry(value)
  where entry.value ->> 'id' = p_comment_id limit 1;
  if target_author is null or not (
    (select courtcall_private.current_user_can_manage_community(target_community_id))
    or (
      target_author = (select auth.uid())::text
      and (select courtcall_private.current_user_is_community_member(target_community_id))
    )
  ) then raise exception 'Comment unavailable' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(entry.value), '[]'::jsonb) into current_comments
  from jsonb_array_elements(current_comments) as entry(value)
  where entry.value ->> 'id' is distinct from p_comment_id;
  update public.community_posts set comments = current_comments where id = p_post_id;
  return current_comments;
end
$function$;

create or replace function public.set_community_gallery_like(
  p_item_id text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_community_id text;
  next_likes jsonb;
begin
  select item.community_id,
         case when jsonb_typeof(item.likes) = 'array' then item.likes else '[]'::jsonb end
  into target_community_id, next_likes
  from public.community_gallery as item where item.id = p_item_id for update;
  if not found or not (select courtcall_private.current_user_is_community_member(target_community_id)) then
    raise exception 'Gallery reaction unavailable' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(entry.value), '[]'::jsonb) into next_likes
  from jsonb_array_elements(next_likes) as entry(value)
  where entry.value #>> '{}' is distinct from (select auth.uid())::text;
  if p_active then next_likes := next_likes || to_jsonb((select auth.uid())::text); end if;
  update public.community_gallery set likes = next_likes where id = p_item_id;
  return next_likes;
end
$function$;

create or replace function public.add_community_gallery_comment(
  p_item_id text,
  p_comment_id text,
  p_body text,
  p_author_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_community_id text;
  current_comments jsonb;
  comments_locked boolean;
begin
  if (select auth.uid()) is null or length(btrim(coalesce(p_body, ''))) not between 1 and 200 then
    raise exception 'Comment unavailable' using errcode = '22023';
  end if;
  select item.community_id, case when jsonb_typeof(item.comments) = 'array' then item.comments else '[]'::jsonb end,
         coalesce(community.comments_locked, false)
  into target_community_id, current_comments, comments_locked
  from public.community_gallery as item
  join public.communities as community on community.id = item.community_id
  where item.id = p_item_id for update of item;
  if not found or not (select courtcall_private.current_user_is_community_member(target_community_id))
     or (comments_locked and not (select courtcall_private.current_user_can_manage_community(target_community_id))) then
    raise exception 'Comment unavailable' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(entry.value), '[]'::jsonb) into current_comments
  from jsonb_array_elements(current_comments) as entry(value)
  where entry.value ->> 'id' is distinct from p_comment_id;
  current_comments := current_comments || jsonb_build_array(jsonb_build_object(
    'id', left(coalesce(p_comment_id, ''), 180), 'authorId', (select auth.uid())::text,
    'authorName', left(coalesce(p_author_name, ''), 120), 'text', left(btrim(p_body), 200),
    'createdAt', clock_timestamp()
  ));
  update public.community_gallery set comments = current_comments where id = p_item_id;
  return current_comments;
end
$function$;

create or replace function public.delete_community_gallery_comment(
  p_item_id text,
  p_comment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_community_id text;
  current_comments jsonb;
  target_author text;
begin
  select item.community_id, case when jsonb_typeof(item.comments) = 'array' then item.comments else '[]'::jsonb end
  into target_community_id, current_comments
  from public.community_gallery as item where item.id = p_item_id for update;
  select entry.value ->> 'authorId' into target_author
  from jsonb_array_elements(current_comments) as entry(value)
  where entry.value ->> 'id' = p_comment_id limit 1;
  if target_author is null or not (
    (select courtcall_private.current_user_can_manage_community(target_community_id))
    or (
      target_author = (select auth.uid())::text
      and (select courtcall_private.current_user_is_community_member(target_community_id))
    )
  ) then raise exception 'Comment unavailable' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(entry.value), '[]'::jsonb) into current_comments
  from jsonb_array_elements(current_comments) as entry(value)
  where entry.value ->> 'id' is distinct from p_comment_id;
  update public.community_gallery set comments = current_comments where id = p_item_id;
  return current_comments;
end
$function$;

revoke all on function public.set_community_post_reaction(text, text, boolean) from public, anon, authenticated;
revoke all on function public.add_community_post_comment(text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_community_post_comment(text, text) from public, anon, authenticated;
revoke all on function public.set_community_gallery_like(text, boolean) from public, anon, authenticated;
revoke all on function public.add_community_gallery_comment(text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_community_gallery_comment(text, text) from public, anon, authenticated;
grant execute on function public.set_community_post_reaction(text, text, boolean) to authenticated;
grant execute on function public.add_community_post_comment(text, text, text, text) to authenticated;
grant execute on function public.delete_community_post_comment(text, text) to authenticated;
grant execute on function public.set_community_gallery_like(text, boolean) to authenticated;
grant execute on function public.add_community_gallery_comment(text, text, text, text) to authenticated;
grant execute on function public.delete_community_gallery_comment(text, text) to authenticated;

commit;
