-- 午夜时光的数据表。在 Supabase 后台的 SQL Editor 里整段粘贴，运行一次即可。

create table if not exists public.entries (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tmdb_id    bigint      not null,
  data       jsonb       not null,           -- 一条完整的片单记录，结构见 src/lib/types.ts 的 Entry
  updated_at timestamptz not null default now(),
  primary key (user_id, tmdb_id)
);

-- 行级安全：每个人只能读写自己的记录
alter table public.entries enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
