-- ════════════════════════════════════════════════════════════
-- CourtCall — Full Database Setup for NEW Supabase project
-- Run this ONCE in: SQL Editor → New query → paste ALL → Run
-- Project: jfeegcocynozbjpzbjae
-- ════════════════════════════════════════════════════════════

-- ── 1. Core tables ──────────────────────────────────────────

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  nickname text,
  games_played int default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Games
create table if not exists public.games (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  team_a_name text,
  team_b_name text,
  score_a int,
  score_b int,
  winner text,
  game_type text,
  win_score int,
  scoring_rule text,
  duration text,
  fouls_a int,
  fouls_b int,
  max_lead_a int,
  max_lead_b int,
  lead_changes int,
  biggest_run int,
  quarters_played int,
  tournament_id text,
  fixture_id text,
  players_a jsonb,
  players_b jsonb,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ── 2. Communities ──────────────────────────────────────────

create table if not exists public.communities (
  id text primary key,
  creator_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  type text default 'general',
  visibility text default 'public',
  logo text default '🏀',
  location text,
  invite_code text unique,
  read_only bool default false,
  comments_locked bool default false,
  ratings_disabled bool default false,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.community_members (
  community_id text references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',
  profile_name text,
  joined_at timestamp with time zone default timezone('utc', now()),
  primary key (community_id, user_id)
);

create table if not exists public.community_posts (
  id text primary key,
  community_id text references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  author_name text,
  title text,
  content text,
  image_url text,
  type text default 'text',
  reactions jsonb default '{}',
  comments jsonb default '[]',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.community_events (
  id text primary key,
  community_id text references public.communities(id) on delete cascade,
  creator_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  event_date text,
  location text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ── 3. Row Level Security ───────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.games             enable row level security;
alter table public.communities       enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts   enable row level security;
alter table public.community_events  enable row level security;

-- Profiles
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Games
create policy "games: own read"   on public.games for select using (auth.uid() = user_id);
create policy "games: own insert" on public.games for insert with check (auth.uid() = user_id);
create policy "games: own update" on public.games for update using (auth.uid() = user_id);
create policy "games: own delete" on public.games for delete using (auth.uid() = user_id);

-- SECURITY DEFINER helper: checks membership WITHOUT triggering the
-- community_members SELECT policy, avoiding infinite recursion.
create or replace function public.is_community_member(comm_id text, uid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
    where community_id = comm_id and user_id = uid
  );
$$;

-- Communities
create policy "communities: public read" on public.communities
  for select using (visibility = 'public' or creator_id = auth.uid() or
    exists (select 1 from public.community_members m where m.community_id = communities.id and m.user_id = auth.uid()));
create policy "communities: auth insert" on public.communities
  for insert with check (auth.uid() = creator_id);
create policy "communities: admin update" on public.communities
  for update using (auth.uid() = creator_id);
create policy "communities: creator delete" on public.communities
  for delete using (auth.uid() = creator_id);

-- Community Members
create policy "members: community read" on public.community_members
  for select using (
    user_id = auth.uid() or
    public.is_community_member(community_id, auth.uid())
  );
create policy "members: self insert" on public.community_members
  for insert with check (auth.uid() = user_id);
create policy "members: admin update" on public.community_members
  for update using (
    user_id = auth.uid() or
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid())
  );
create policy "members: self delete" on public.community_members
  for delete using (auth.uid() = user_id or
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid()));

-- Community Posts
create policy "posts: member read" on public.community_posts
  for select using (
    exists (select 1 from public.community_members m where m.community_id = community_posts.community_id and m.user_id = auth.uid())
    or exists (select 1 from public.communities c where c.id = community_posts.community_id and c.visibility = 'public')
  );
create policy "posts: member insert" on public.community_posts
  for insert with check (
    auth.uid() = user_id and
    exists (select 1 from public.community_members m where m.community_id = community_posts.community_id and m.user_id = auth.uid())
  );
create policy "posts: author update" on public.community_posts
  for update using (auth.uid() = user_id);
create policy "posts: author delete" on public.community_posts
  for delete using (auth.uid() = user_id or
    exists (select 1 from public.communities c where c.id = community_posts.community_id and c.creator_id = auth.uid()));

-- Community Events
create policy "events: member read" on public.community_events
  for select using (
    exists (select 1 from public.community_members m where m.community_id = community_events.community_id and m.user_id = auth.uid())
    or exists (select 1 from public.communities c where c.id = community_events.community_id and c.visibility = 'public')
  );
create policy "events: member insert" on public.community_events
  for insert with check (auth.uid() = creator_id);
create policy "events: creator delete" on public.community_events
  for delete using (auth.uid() = creator_id or
    exists (select 1 from public.communities c where c.id = community_events.community_id and c.creator_id = auth.uid()));

-- ── 4. Auto-create profile on signup ────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 5. Performance indexes ──────────────────────────────────

create index if not exists idx_games_user_id             on public.games(user_id);
create index if not exists idx_games_created_at          on public.games(created_at desc);
create index if not exists idx_communities_creator_id    on public.communities(creator_id);
create index if not exists idx_comm_members_user_id      on public.community_members(user_id);
create index if not exists idx_comm_posts_community_id   on public.community_posts(community_id, created_at desc);
create index if not exists idx_comm_events_community_id  on public.community_events(community_id);

-- ── 6. Grants ──────────────────────────────────────────────
-- Ensure authenticated & anon roles can access all tables.
-- Supabase sets default privileges, but explicit grants are
-- needed if tables were created before defaults were in place.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.profiles          to anon, authenticated, service_role;
grant select, insert, update, delete on public.games             to anon, authenticated, service_role;
grant select, insert, update, delete on public.communities       to anon, authenticated, service_role;
grant select, insert, update, delete on public.community_members to anon, authenticated, service_role;
grant select, insert, update, delete on public.community_posts   to anon, authenticated, service_role;
grant select, insert, update, delete on public.community_events  to anon, authenticated, service_role;

grant usage on all sequences in schema public to anon, authenticated, service_role;

grant execute on function public.is_community_member(text, uuid) to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
