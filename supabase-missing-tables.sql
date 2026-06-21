-- ════════════════════════════════════════════════════════════
-- CourtCall — Missing Tables + Policy Fixes
-- Run AFTER supabase-full-setup.sql
-- Project: jfeegcocynozbjpzbjae
-- ════════════════════════════════════════════════════════════

-- ── 1. Tournaments ──────────────────────────────────────────

create table if not exists public.tournaments (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  format text default 'knockout',
  win_score int default 21,
  teams jsonb default '[]',
  fixtures jsonb default '[]',
  standings jsonb default '[]',
  completed boolean default false,
  winner text,
  settings jsonb default '{}',
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

alter table public.tournaments enable row level security;

create policy "tournaments: own read"   on public.tournaments for select using (auth.uid() = user_id);
create policy "tournaments: own insert" on public.tournaments for insert with check (auth.uid() = user_id);
create policy "tournaments: own update" on public.tournaments for update using (auth.uid() = user_id);
create policy "tournaments: own delete" on public.tournaments for delete using (auth.uid() = user_id);

create index if not exists idx_tournaments_user_id on public.tournaments(user_id);

-- ── 2. Community Players ────────────────────────────────────

create table if not exists public.community_players (
  id text primary key,
  community_id text references public.communities(id) on delete cascade,
  creator_id uuid references public.profiles(id) on delete set null,
  name text not null,
  nickname text,
  jersey_num text,
  photo_url text,
  position text,
  badges jsonb default '[]',
  games_played int default 0,
  wins int default 0,
  losses int default 0,
  points int default 0,
  mvp_count int default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

alter table public.community_players enable row level security;

create policy "players: member read" on public.community_players
  for select using (
    public.is_community_member(community_id, auth.uid())
    or exists (select 1 from public.communities c where c.id = community_id and c.visibility = 'public')
  );
create policy "players: member insert" on public.community_players
  for insert with check (
    public.is_community_member(community_id, auth.uid())
  );
create policy "players: member update" on public.community_players
  for update using (
    public.is_community_member(community_id, auth.uid())
  );
create policy "players: creator delete" on public.community_players
  for delete using (
    creator_id = auth.uid() or
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid())
  );

create index if not exists idx_comm_players_community_id on public.community_players(community_id);

-- ── 3. Community Ratings ────────────────────────────────────

create table if not exists public.community_ratings (
  id text primary key,
  player_id text references public.community_players(id) on delete cascade,
  community_id text references public.communities(id) on delete cascade,
  rater_id uuid references public.profiles(id) on delete set null,
  shooting int default 5,
  defense int default 5,
  passing int default 5,
  speed int default 5,
  teamwork int default 5,
  clutch int default 5,
  sportsmanship int default 5,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now()),
  unique(player_id, rater_id)
);

alter table public.community_ratings enable row level security;

create policy "ratings: member read" on public.community_ratings
  for select using (
    public.is_community_member(community_id, auth.uid())
    or exists (select 1 from public.communities c where c.id = community_id and c.visibility = 'public')
  );
create policy "ratings: member insert" on public.community_ratings
  for insert with check (auth.uid() = rater_id);
create policy "ratings: rater update" on public.community_ratings
  for update using (auth.uid() = rater_id);
create policy "ratings: rater delete" on public.community_ratings
  for delete using (auth.uid() = rater_id);

create index if not exists idx_comm_ratings_player_id    on public.community_ratings(player_id);
create index if not exists idx_comm_ratings_rater_id     on public.community_ratings(rater_id);
create index if not exists idx_comm_ratings_community_id on public.community_ratings(community_id);

-- ── 4. Community Gallery ────────────────────────────────────

create table if not exists public.community_gallery (
  id text primary key,
  community_id text references public.communities(id) on delete cascade,
  uploader_id uuid references public.profiles(id) on delete set null,
  uploader_name text,
  image_url text,
  caption text,
  album text default 'General',
  tagged_players jsonb default '[]',
  likes jsonb default '[]',
  comments jsonb default '[]',
  created_at timestamp with time zone default timezone('utc', now())
);

alter table public.community_gallery enable row level security;

create policy "gallery: member read" on public.community_gallery
  for select using (
    public.is_community_member(community_id, auth.uid())
    or exists (select 1 from public.communities c where c.id = community_id and c.visibility = 'public')
  );
create policy "gallery: member insert" on public.community_gallery
  for insert with check (
    auth.uid() = uploader_id and
    public.is_community_member(community_id, auth.uid())
  );
create policy "gallery: uploader update" on public.community_gallery
  for update using (auth.uid() = uploader_id);
create policy "gallery: uploader delete" on public.community_gallery
  for delete using (
    auth.uid() = uploader_id or
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid())
  );

create index if not exists idx_comm_gallery_community_id on public.community_gallery(community_id);

-- ── 5. Community Join Requests ──────────────────────────────

create table if not exists public.community_join_requests (
  id text primary key,
  community_id text references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  profile_name text,
  status text default 'pending',
  requested_at timestamp with time zone default timezone('utc', now()),
  reviewed_at timestamp with time zone
);

alter table public.community_join_requests enable row level security;

create policy "join_reqs: own read" on public.community_join_requests
  for select using (
    user_id = auth.uid() or
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid())
  );
create policy "join_reqs: own insert" on public.community_join_requests
  for insert with check (auth.uid() = user_id);
create policy "join_reqs: admin update" on public.community_join_requests
  for update using (
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid())
  );
create policy "join_reqs: self or admin delete" on public.community_join_requests
  for delete using (
    user_id = auth.uid() or
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid())
  );

create index if not exists idx_comm_join_reqs_user_id      on public.community_join_requests(user_id);
create index if not exists idx_comm_join_reqs_community_id  on public.community_join_requests(community_id, status);

-- ── 6. Policy Fixes (existing tables) ───────────────────────

-- community_events was missing an UPDATE policy (silent failures)
create policy "events: creator update" on public.community_events
  for update using (
    creator_id = auth.uid() or
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid())
  );

-- ── 7. Grants for additional tables ────────────────────────

grant select, insert, update, delete on public.tournaments              to anon, authenticated, service_role;
grant select, insert, update, delete on public.community_players        to anon, authenticated, service_role;
grant select, insert, update, delete on public.community_ratings        to anon, authenticated, service_role;
grant select, insert, update, delete on public.community_gallery        to anon, authenticated, service_role;
grant select, insert, update, delete on public.community_join_requests  to anon, authenticated, service_role;
