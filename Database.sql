-- 1. Create the torrents table
create table public.torrents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hash text not null,
  size int8 not null,
  file_count int4 not null,
  files jsonb not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id)
);

-- 2. Enable Row-Level Security (RLS)
alter table public.torrents enable row level security;

-- 3. Create SELECT policy
create policy "Allow user to SELECT own torrents"
on public.torrents
for select
using (auth.uid() = user_id);

-- 4. Create INSERT policy
create policy "Allow user to INSERT own torrents"
on public.torrents
for insert
with check (auth.uid() = user_id);

-- 5. Create UPDATE policy
create policy "Allow user to UPDATE own torrents"
on public.torrents
for update
using (auth.uid() = user_id);

-- 6. Create DELETE policy
create policy "Allow user to DELETE own torrents"
on public.torrents
for delete
using (auth.uid() = user_id);
