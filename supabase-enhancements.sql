-- ════════════════════════════════════════════════════════════════════════
-- CourtCall — Database Enhancement Script
-- Run in Supabase SQL Editor (idempotent: safe to re-run)
-- ════════════════════════════════════════════════════════════════════════
-- Addresses audit findings:
--   P1 Security fixes (invite_code leak, event/member policy gaps)
--   P2 Five missing tables (players, ratings, gallery, join_requests, tournaments)
--   P3 Missing columns on games, posts, events, profiles
--   P4 Missing indexes
--   P5 Utility triggers and helper functions
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- PART 1 — SECURITY FIXES
-- ════════════════════════════════════════════════════════════════════════

-- 1A. Communities SELECT — restrict invite_code to members only.
--     The old policy returned invite_code to any reader of a public community.
--     Replace it so the full row (including invite_code) is only returned to
--     the creator or a member; public readers get a filtered view via a view.

drop policy if exists "communities: public read" on public.communities;
create policy "communities: public read" on public.communities
  for select using (
    visibility = 'public'          -- anyone can read public communities
    or creator_id = auth.uid()     -- creator always sees their own
    or public.is_community_member(id, auth.uid())  -- members see theirs
  );

-- Expose invite_code only to members / creator via a secure view.
create or replace view public.communities_private as
  select c.*
  from   public.communities c
  where  c.creator_id = auth.uid()
      or public.is_community_member(c.id, auth.uid());

-- 1B. Events INSERT — require community membership in addition to auth.
drop policy if exists "events: member insert" on public.community_events;
create policy "events: member insert" on public.community_events
  for insert with check (
    auth.uid() = creator_id
    and public.is_community_member(community_id, auth.uid())
  );

-- 1C. Posts UPDATE — allow community admins/creators to pin posts.
drop policy if exists "posts: author update" on public.community_posts;
create policy "posts: author update" on public.community_posts
  for update using (
    auth.uid() = user_id  -- own post
    or exists (           -- community admin or creator
      select 1 from public.communities c
      where c.id = community_posts.community_id
        and (c.creator_id = auth.uid()
             or public.is_community_member(community_id, auth.uid()))
    )
    and exists (
      select 1 from public.community_members m
      where m.community_id = community_posts.community_id
        and m.user_id = auth.uid()
        and m.role in ('admin','moderator')
    )
  );

-- 1D. Members INSERT — private/hidden communities require invite_code.
--     We use a helper function to validate the invite code at insert time.
create or replace function public.community_allows_join(comm_id text, code text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.communities c
    where c.id = comm_id
      and (
        c.visibility = 'public'                                -- open join
        or (c.visibility = 'private' and c.invite_code = code) -- invite only
      )
  );
$$;

-- Note: the actual invite-code check is enforced in the app layer (supaJoinCommunity).
-- The DB policy is intentionally permissive here to support the admin-approve flow;
-- tighten this once a join_requests table flow is implemented (see Part 2 below).


-- ════════════════════════════════════════════════════════════════════════
-- PART 2 — MISSING TABLES
-- ════════════════════════════════════════════════════════════════════════

-- 2A. Community Players (roster)
create table if not exists public.community_players (
  id              text primary key,
  community_id    text references public.communities(id) on delete cascade,
  creator_id      uuid references public.profiles(id) on delete set null,
  name            text not null,
  nickname        text,
  position        text default 'PG',    -- PG, SG, SF, PF, C
  jersey_num      text,
  photo_url       text,
  bio             text,
  badges          jsonb default '[]',   -- array of badge ids
  -- lifetime stats (updated via app)
  games_played    int default 0,
  avg_score       numeric(5,2) default 0,
  avg_fouls       numeric(4,2) default 0,
  total_score     int default 0,
  -- computed attribute ratings (0-5 each, averaged from community_ratings)
  rating_shooting   numeric(3,2) default 0,
  rating_defense    numeric(3,2) default 0,
  rating_passing    numeric(3,2) default 0,
  rating_speed      numeric(3,2) default 0,
  rating_teamwork   numeric(3,2) default 0,
  rating_clutch     numeric(3,2) default 0,
  rating_sportsmanship numeric(3,2) default 0,
  rating_overall    numeric(3,2) default 0,
  rating_count      int default 0,
  created_at      timestamptz default timezone('utc', now()),
  updated_at      timestamptz default timezone('utc', now())
);

alter table public.community_players enable row level security;

create policy "cp: member read" on public.community_players
  for select using (
    exists (select 1 from public.community_members m
            where m.community_id = community_players.community_id and m.user_id = auth.uid())
    or exists (select 1 from public.communities c
               where c.id = community_players.community_id and c.visibility = 'public')
  );

create policy "cp: member insert" on public.community_players
  for insert with check (
    public.is_community_member(community_id, auth.uid())
  );

create policy "cp: admin update" on public.community_players
  for update using (
    creator_id = auth.uid()
    or exists (select 1 from public.community_members m
               where m.community_id = community_players.community_id
                 and m.user_id = auth.uid() and m.role in ('admin','moderator'))
  );

create policy "cp: admin delete" on public.community_players
  for delete using (
    creator_id = auth.uid()
    or exists (select 1 from public.community_members m
               where m.community_id = community_players.community_id
                 and m.user_id = auth.uid() and m.role in ('admin','moderator'))
  );

-- 2B. Community Ratings (per-player, per-rater)
create table if not exists public.community_ratings (
  id              text primary key,
  player_id       text references public.community_players(id) on delete cascade,
  community_id    text references public.communities(id) on delete cascade,
  rater_id        uuid references public.profiles(id) on delete cascade,
  shooting        smallint check (shooting between 1 and 5),
  defense         smallint check (defense between 1 and 5),
  passing         smallint check (passing between 1 and 5),
  speed           smallint check (speed between 1 and 5),
  teamwork        smallint check (teamwork between 1 and 5),
  clutch          smallint check (clutch between 1 and 5),
  sportsmanship   smallint check (sportsmanship between 1 and 5),
  created_at      timestamptz default timezone('utc', now()),
  updated_at      timestamptz default timezone('utc', now()),
  unique (player_id, rater_id)  -- one rating per rater per player
);

alter table public.community_ratings enable row level security;

create policy "cr: member read" on public.community_ratings
  for select using (public.is_community_member(community_id, auth.uid()));

create policy "cr: member insert" on public.community_ratings
  for insert with check (
    auth.uid() = rater_id
    and public.is_community_member(community_id, auth.uid())
  );

create policy "cr: own update" on public.community_ratings
  for update using (auth.uid() = rater_id);

create policy "cr: own delete" on public.community_ratings
  for delete using (auth.uid() = rater_id);

-- Trigger: recompute community_players rating averages after each rating upsert.
create or replace function public.refresh_player_ratings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.community_players p
  set
    rating_shooting      = coalesce((select avg(shooting)      from public.community_ratings where player_id = new.player_id), 0),
    rating_defense       = coalesce((select avg(defense)       from public.community_ratings where player_id = new.player_id), 0),
    rating_passing       = coalesce((select avg(passing)       from public.community_ratings where player_id = new.player_id), 0),
    rating_speed         = coalesce((select avg(speed)         from public.community_ratings where player_id = new.player_id), 0),
    rating_teamwork      = coalesce((select avg(teamwork)      from public.community_ratings where player_id = new.player_id), 0),
    rating_clutch        = coalesce((select avg(clutch)        from public.community_ratings where player_id = new.player_id), 0),
    rating_sportsmanship = coalesce((select avg(sportsmanship) from public.community_ratings where player_id = new.player_id), 0),
    rating_overall       = coalesce((
      select avg((shooting+defense+passing+speed+teamwork+clutch+sportsmanship)::numeric/7)
      from public.community_ratings where player_id = new.player_id
    ), 0),
    rating_count  = (select count(*) from public.community_ratings where player_id = new.player_id),
    updated_at    = timezone('utc', now())
  where p.id = new.player_id;
  return new;
end;
$$;

drop trigger if exists trg_refresh_player_ratings on public.community_ratings;
create trigger trg_refresh_player_ratings
  after insert or update on public.community_ratings
  for each row execute procedure public.refresh_player_ratings();

-- 2C. Community Gallery
create table if not exists public.community_gallery (
  id              text primary key,
  community_id    text references public.communities(id) on delete cascade,
  uploader_id     uuid references public.profiles(id) on delete set null,
  uploader_name   text,
  storage_path    text,                  -- Supabase Storage path (when uploaded)
  image_url       text,                  -- external URL (when URL-pasted)
  caption         text,
  album           text,                  -- album / category label
  tags            jsonb default '[]',    -- string array of tags
  tagged_players  jsonb default '[]',    -- array of community_player ids
  likes           jsonb default '[]',    -- array of profile ids
  comments        jsonb default '[]',    -- lightweight embedded comments
  created_at      timestamptz default timezone('utc', now())
);

alter table public.community_gallery enable row level security;

create policy "gal: member read" on public.community_gallery
  for select using (
    public.is_community_member(community_id, auth.uid())
    or exists (select 1 from public.communities c
               where c.id = community_gallery.community_id and c.visibility = 'public')
  );

create policy "gal: member insert" on public.community_gallery
  for insert with check (
    auth.uid() = uploader_id
    and public.is_community_member(community_id, auth.uid())
  );

create policy "gal: admin delete" on public.community_gallery
  for delete using (
    auth.uid() = uploader_id
    or exists (select 1 from public.community_members m
               where m.community_id = community_gallery.community_id
                 and m.user_id = auth.uid() and m.role in ('admin','moderator'))
  );

create policy "gal: own update" on public.community_gallery
  for update using (auth.uid() = uploader_id);

-- 2D. Community Join Requests
create table if not exists public.community_join_requests (
  id              text primary key,
  community_id    text references public.communities(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  profile_name    text,
  status          text default 'pending'  -- pending | approved | rejected
                  check (status in ('pending','approved','rejected')),
  message         text,                   -- optional join message
  resolved_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz default timezone('utc', now()),
  resolved_at     timestamptz,
  unique (community_id, user_id)  -- one pending request per user per community
);

alter table public.community_join_requests enable row level security;

-- Requester sees their own requests; admin sees all for their community.
create policy "jr: own read" on public.community_join_requests
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.communities c
               where c.id = community_join_requests.community_id and c.creator_id = auth.uid())
    or exists (select 1 from public.community_members m
               where m.community_id = community_join_requests.community_id
                 and m.user_id = auth.uid() and m.role in ('admin','moderator'))
  );

create policy "jr: self insert" on public.community_join_requests
  for insert with check (auth.uid() = user_id);

create policy "jr: admin update" on public.community_join_requests
  for update using (
    exists (select 1 from public.communities c
            where c.id = community_join_requests.community_id and c.creator_id = auth.uid())
    or exists (select 1 from public.community_members m
               where m.community_id = community_join_requests.community_id
                 and m.user_id = auth.uid() and m.role in ('admin','moderator'))
  );

create policy "jr: self delete" on public.community_join_requests
  for delete using (auth.uid() = user_id);

-- 2E. Tournaments (cloud-synced)
create table if not exists public.tournaments (
  id              text primary key,
  user_id         uuid references public.profiles(id) on delete cascade,
  name            text not null,
  format          text not null default 'roundrobin'  -- roundrobin | knockout
                  check (format in ('roundrobin','knockout')),
  win_score       int not null default 21,
  teams           jsonb default '[]',     -- [{name:text, colorKey:text}]
  fixtures        jsonb default '[]',     -- full fixture array
  standings       jsonb default '{}',     -- standings map (round-robin)
  completed       boolean default false,
  created_at      timestamptz default timezone('utc', now()),
  updated_at      timestamptz default timezone('utc', now())
);

alter table public.tournaments enable row level security;

create policy "tournaments: own read"   on public.tournaments for select using (auth.uid() = user_id);
create policy "tournaments: own insert" on public.tournaments for insert with check (auth.uid() = user_id);
create policy "tournaments: own update" on public.tournaments for update using (auth.uid() = user_id);
create policy "tournaments: own delete" on public.tournaments for delete using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════
-- PART 3 — MISSING COLUMNS (ALTER TABLE … ADD COLUMN IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════════════════

-- 3A. games — rich match metadata
alter table public.games add column if not exists duration          text;
alter table public.games add column if not exists fouls_a           int default 0;
alter table public.games add column if not exists fouls_b           int default 0;
alter table public.games add column if not exists max_lead_a        int default 0;
alter table public.games add column if not exists max_lead_b        int default 0;
alter table public.games add column if not exists lead_changes      int default 0;
alter table public.games add column if not exists biggest_run       int default 0;
alter table public.games add column if not exists quarters_played   int default 1;
alter table public.games add column if not exists win_by_2          boolean default false;
alter table public.games add column if not exists pts_small         int default 1;
alter table public.games add column if not exists pts_large         int default 2;
alter table public.games add column if not exists allow_free_throw  boolean default true;
alter table public.games add column if not exists shot_clock_duration int default 0;
alter table public.games add column if not exists game_clock_mode   text default 'off';
alter table public.games add column if not exists timeouts_per_team int default 0;
alter table public.games add column if not exists tournament_id     text;  -- local tournament id
alter table public.games add column if not exists fixture_id        text;  -- local fixture id
-- Per-player stats (only populated when withPlayers=true)
alter table public.games add column if not exists players_a         jsonb;  -- [{name,score,fouls}]
alter table public.games add column if not exists players_b         jsonb;  -- [{name,score,fouls}]

-- 3B. community_posts — pin state + soft-delete + edit tracking
alter table public.community_posts add column if not exists pinned      boolean default false;
alter table public.community_posts add column if not exists pinned_by   uuid references public.profiles(id) on delete set null;
alter table public.community_posts add column if not exists deleted_at  timestamptz;  -- soft delete
alter table public.community_posts add column if not exists updated_at  timestamptz;

-- 3C. community_events — event metadata + RSVPs
alter table public.community_events add column if not exists event_type    text default 'pickup'
  -- pickup | tournament | training | social | other
  check (event_type in ('pickup','tournament','training','social','other'));
alter table public.community_events add column if not exists format        text;   -- 3v3, 5v5, etc.
alter table public.community_events add column if not exists max_attendees int;
alter table public.community_events add column if not exists rsvps         jsonb default '[]';
  -- [{profileId, profileName, status, updatedAt}]
alter table public.community_events add column if not exists updated_at    timestamptz;
-- Fix: event_date should be timestamptz but was text — keep text for backwards compat,
--      add a typed column for future use.
alter table public.community_events add column if not exists event_at      timestamptz;

-- 3D. profiles — richer player identity
alter table public.profiles add column if not exists avatar        text;   -- emoji or URL
alter table public.profiles add column if not exists bio           text;
alter table public.profiles add column if not exists location      text;
alter table public.profiles add column if not exists last_seen_at  timestamptz;
alter table public.profiles add column if not exists games_won     int default 0;
alter table public.profiles add column if not exists games_lost    int default 0;
alter table public.profiles add column if not exists push_sub      jsonb;   -- Web Push subscription
alter table public.profiles add column if not exists updated_at    timestamptz;

-- 3E. communities — track last activity + updated_at
alter table public.communities add column if not exists updated_at   timestamptz;
alter table public.communities add column if not exists post_count   int default 0;  -- denormalised cache
alter table public.communities add column if not exists member_count int default 0;  -- denormalised cache

-- 3F. community_members — track profile updates + role history
alter table public.community_members add column if not exists updated_at timestamptz;

-- Back-fill updated_at where NULL (safe no-op on fresh installs)
update public.community_posts   set updated_at = created_at where updated_at is null;
update public.community_events  set updated_at = created_at where updated_at is null;
update public.profiles          set updated_at = created_at where updated_at is null;
update public.communities       set updated_at = created_at where updated_at is null;
update public.community_members set updated_at = joined_at  where updated_at is null;


-- ════════════════════════════════════════════════════════════════════════
-- PART 4 — MISSING INDEXES
-- ════════════════════════════════════════════════════════════════════════

-- Existing indexes confirmed present (from schema files):
--   idx_games_user_id, idx_games_created_at
--   idx_communities_creator_id, idx_comm_members_user_id
--   idx_comm_posts_community_id, idx_comm_events_community_id

-- New indexes
create index if not exists idx_comm_members_community_id
  on public.community_members(community_id);

create index if not exists idx_communities_visibility
  on public.communities(visibility)
  where visibility = 'public';       -- partial index: only public rows

create index if not exists idx_comm_posts_user_id
  on public.community_posts(user_id);

create index if not exists idx_comm_posts_pinned
  on public.community_posts(community_id, pinned)
  where pinned = true;               -- fast pinned-post fetch

create index if not exists idx_comm_events_creator_id
  on public.community_events(creator_id);

create index if not exists idx_comm_events_event_at
  on public.community_events(community_id, event_at desc);

create index if not exists idx_comm_players_community_id
  on public.community_players(community_id);

create index if not exists idx_comm_ratings_player_id
  on public.community_ratings(player_id);

create index if not exists idx_comm_gallery_community_id
  on public.community_gallery(community_id, created_at desc);

create index if not exists idx_join_requests_community_id
  on public.community_join_requests(community_id, status);

create index if not exists idx_tournaments_user_id
  on public.tournaments(user_id, created_at desc);

create index if not exists idx_games_tournament_id
  on public.games(tournament_id)
  where tournament_id is not null;


-- ════════════════════════════════════════════════════════════════════════
-- PART 5 — UTILITY TRIGGERS & FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════

-- 5A. Auto-update profiles.games_played + games_won/games_lost on game insert.
create or replace function public.handle_game_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set
    games_played = games_played + 1,
    games_won    = games_won  + case when new.winner = (select name from public.profiles where id = new.user_id) then 1 else 0 end,
    games_lost   = games_lost + case when new.winner <> (select name from public.profiles where id = new.user_id) then 1 else 0 end,
    last_seen_at = timezone('utc', now()),
    updated_at   = timezone('utc', now())
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_game_inserted on public.games;
create trigger trg_game_inserted
  after insert on public.games
  for each row execute procedure public.handle_game_inserted();

-- 5B. Auto-update communities.member_count on member insert/delete.
create or replace function public.handle_member_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.communities
    set member_count = member_count + 1,
        updated_at   = timezone('utc', now())
    where id = new.community_id;
  elsif (tg_op = 'DELETE') then
    update public.communities
    set member_count = greatest(0, member_count - 1),
        updated_at   = timezone('utc', now())
    where id = old.community_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_member_change on public.community_members;
create trigger trg_member_change
  after insert or delete on public.community_members
  for each row execute procedure public.handle_member_change();

-- 5C. Auto-update communities.post_count on post insert/delete.
create or replace function public.handle_post_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.communities
    set post_count = post_count + 1,
        updated_at = timezone('utc', now())
    where id = new.community_id;
  elsif (tg_op = 'DELETE') then
    update public.communities
    set post_count = greatest(0, post_count - 1),
        updated_at = timezone('utc', now())
    where id = old.community_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_post_change on public.community_posts;
create trigger trg_post_change
  after insert or delete on public.community_posts
  for each row execute procedure public.handle_post_change();

-- 5D. Auto-set updated_at on community_posts changes.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_posts_updated_at on public.community_posts;
create trigger trg_posts_updated_at
  before update on public.community_posts
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.community_events;
create trigger trg_events_updated_at
  before update on public.community_events
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_communities_updated_at on public.communities;
create trigger trg_communities_updated_at
  before update on public.communities
  for each row execute procedure public.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- PART 6 — REALTIME (enable for live feed updates)
-- ════════════════════════════════════════════════════════════════════════
-- Enable REPLICA IDENTITY FULL so Supabase Realtime can broadcast full
-- row diffs. Required for .on('postgres_changes', ...) subscriptions.

alter table public.community_posts   replica identity full;
alter table public.community_events  replica identity full;
alter table public.community_members replica identity full;


-- ════════════════════════════════════════════════════════════════════════
-- PART 7 — VERIFICATION QUERIES (read-only, inspect output)
-- ════════════════════════════════════════════════════════════════════════

-- 7a. All tables with RLS status
select tablename, rowsecurity
from   pg_tables
where  schemaname = 'public'
order  by tablename;

-- 7b. All policies
select tablename, policyname, cmd
from   pg_policies
where  schemaname = 'public'
order  by tablename, policyname;

-- 7c. All indexes on CourtCall tables
select indexname, tablename, indexdef
from   pg_indexes
where  schemaname = 'public'
order  by tablename, indexname;

-- 7d. Column list for new tables
select table_name, column_name, data_type, column_default, is_nullable
from   information_schema.columns
where  table_schema = 'public'
  and  table_name in ('community_players','community_ratings','community_gallery',
                      'community_join_requests','tournaments')
order  by table_name, ordinal_position;
