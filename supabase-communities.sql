-- Communities
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

-- Members
create table if not exists public.community_members (
  community_id text references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',
  profile_name text,
  joined_at timestamp with time zone default timezone('utc', now()),
  primary key (community_id, user_id)
);

-- Posts
create table if not exists public.community_posts (
  id text primary key,
  community_id text references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  author_name text,
  content text,
  type text default 'text',
  reactions jsonb default '{}',
  comments jsonb default '[]',
  created_at timestamp with time zone default timezone('utc', now())
);

-- Events
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

-- RLS
alter table public.communities       enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts   enable row level security;
alter table public.community_events  enable row level security;

-- Anyone can read public communities
create policy "communities: public read" on public.communities
  for select using (visibility = 'public' or creator_id = auth.uid() or
    exists (select 1 from public.community_members m where m.community_id = communities.id and m.user_id = auth.uid()));

-- Only authenticated users can create communities
create policy "communities: auth insert" on public.communities
  for insert with check (auth.uid() = creator_id);

-- Only creator/admin can update
create policy "communities: admin update" on public.communities
  for update using (auth.uid() = creator_id);

-- Only creator can delete
create policy "communities: creator delete" on public.communities
  for delete using (auth.uid() = creator_id);

-- Members: visible to other members of same community
create policy "members: community read" on public.community_members
  for select using (
    user_id = auth.uid() or
    exists (select 1 from public.community_members m2 where m2.community_id = community_members.community_id and m2.user_id = auth.uid())
  );

create policy "members: self insert" on public.community_members
  for insert with check (auth.uid() = user_id);

create policy "members: self delete" on public.community_members
  for delete using (auth.uid() = user_id or
    exists (select 1 from public.communities c where c.id = community_id and c.creator_id = auth.uid()));

-- Posts: members can read/write
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

-- Events: member read, admin write
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
