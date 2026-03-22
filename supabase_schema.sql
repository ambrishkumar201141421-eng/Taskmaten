-- ═══════════════════════════════════════════════════════
--  TaskMate — Supabase Database Schema
--  Run this entire file in: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════

-- 1. USERS TABLE
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique not null,
  password    text not null,
  campus      text not null,
  avatar      text default '',
  bio         text default '',
  skills      text[] default '{}',
  coins       integer default 50,
  rating      numeric(3,2) default 5.00,
  total_tasks integer default 0,
  created_at  timestamptz default now()
);

-- 2. TASKS TABLE
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  title       text not null,
  description text not null,
  category    text not null,
  offer_type  text[] not null,
  offer_note  text default '',
  urgency     text default 'flexible',
  status      text default 'open',  -- open | in_progress | completed | cancelled
  campus      text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 3. OFFERS TABLE
create table if not exists offers (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references tasks(id) on delete cascade,
  sender_id   uuid references users(id) on delete cascade,
  message     text not null,
  offer_value text not null,
  status      text default 'pending',  -- pending | accepted | rejected
  created_at  timestamptz default now()
);

-- 4. MESSAGES TABLE (Chat)
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,  -- format: "taskId_userId1_userId2"
  sender_id   uuid references users(id) on delete cascade,
  content     text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- 5. RATINGS TABLE
create table if not exists ratings (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references tasks(id) on delete cascade,
  rater_id    uuid references users(id) on delete cascade,
  rated_id    uuid references users(id) on delete cascade,
  score       integer check (score between 1 and 5),
  comment     text default '',
  created_at  timestamptz default now()
);

-- 6. NOTIFICATIONS TABLE
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  type        text not null,  -- offer | message | rating | system
  title       text not null,
  body        text not null,
  read        boolean default false,
  link        text default '',
  created_at  timestamptz default now()
);

-- ─── Indexes for performance ───────────────────────────
create index if not exists idx_tasks_campus   on tasks(campus);
create index if not exists idx_tasks_status   on tasks(status);
create index if not exists idx_tasks_user     on tasks(user_id);
create index if not exists idx_offers_task    on offers(task_id);
create index if not exists idx_messages_room  on messages(room_id);
create index if not exists idx_notifs_user    on notifications(user_id);

-- ─── Enable Row Level Security ─────────────────────────
alter table users         enable row level security;
alter table tasks         enable row level security;
alter table offers        enable row level security;
alter table messages      enable row level security;
alter table ratings       enable row level security;
alter table notifications enable row level security;

-- ─── RLS Policies (allow all for service role) ─────────
-- We use service role key in backend so all ops are allowed.
-- These policies allow the anon key to read public data:

create policy "Public read tasks"   on tasks   for select using (true);
create policy "Public read users"   on users   for select using (true);
create policy "Auth insert tasks"   on tasks   for insert with check (true);
create policy "Auth insert offers"  on offers  for insert with check (true);
create policy "Auth read offers"    on offers  for select using (true);
create policy "Auth read messages"  on messages for select using (true);
create policy "Auth insert messages" on messages for insert with check (true);
create policy "Auth read notifs"    on notifications for select using (true);
