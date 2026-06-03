-- CourtCall database schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run

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
  created_at timestamp with time zone default timezone('utc', now())
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.games enable row level security;

-- RLS: users can only access their own data
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

create policy "games: own read"   on public.games for select using (auth.uid() = user_id);
create policy "games: own insert" on public.games for insert with check (auth.uid() = user_id);

-- Auto-create profile on signup
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

-- Performance indexes
create index if not exists idx_games_user_id    on public.games(user_id);
create index if not exists idx_games_created_at on public.games(created_at desc);

-- ── Migration: extended game stats columns (run once if upgrading) ───────
-- These were missing from the original schema, causing supaSaveGame to fail.
-- Safe to run multiple times (IF NOT EXISTS / IF column not already present).
alter table public.games add column if not exists duration        text; -- stores "0m 35s" formatted string
alter table public.games add column if not exists fouls_a         int;
alter table public.games add column if not exists fouls_b         int;
alter table public.games add column if not exists max_lead_a      int;
alter table public.games add column if not exists max_lead_b      int;
alter table public.games add column if not exists lead_changes    int;
alter table public.games add column if not exists biggest_run     int;
alter table public.games add column if not exists quarters_played int;
alter table public.games add column if not exists tournament_id   text;
alter table public.games add column if not exists fixture_id      text;
alter table public.games add column if not exists players_a       jsonb;
alter table public.games add column if not exists players_b       jsonb;
