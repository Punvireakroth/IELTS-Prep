-- Profiles, progress, error logs, and score tracker for IELTS Prep
-- Run this once in the Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  test_label text not null default 'IELTS Academic (computer in Cambodia)',
  start_date date,
  target_window text not null default '28 October – 7 November 2026',
  current_level text not null default 'about band 5.5–6',
  goal text not null default 'overall 6.5+, with no skill below 6.0',
  daily_time text not null default '1.5–2 hours (90–120 minutes)',
  updated_at timestamptz not null default now()
);

create table if not exists public.task_checks (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date,
  skill text not null check (skill in ('L', 'R', 'W', 'S')),
  source text,
  raw_score text,
  band text,
  qtype text,
  why text,
  better text,
  word text,
  created_at timestamptz not null default now()
);

create table if not exists public.score_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  row_key text not null,
  l text,
  r text,
  w text,
  s text,
  overall text,
  worst_problem text,
  updated_at timestamptz not null default now(),
  primary key (user_id, row_key)
);

create index if not exists error_logs_user_created_idx
  on public.error_logs (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.task_checks enable row level security;
alter table public.error_logs enable row level security;
alter table public.score_entries enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "task_checks_select_own" on public.task_checks;
drop policy if exists "task_checks_insert_own" on public.task_checks;
drop policy if exists "task_checks_update_own" on public.task_checks;
drop policy if exists "task_checks_delete_own" on public.task_checks;

create policy "task_checks_select_own" on public.task_checks
  for select using (auth.uid() = user_id);
create policy "task_checks_insert_own" on public.task_checks
  for insert with check (auth.uid() = user_id);
create policy "task_checks_update_own" on public.task_checks
  for update using (auth.uid() = user_id);
create policy "task_checks_delete_own" on public.task_checks
  for delete using (auth.uid() = user_id);

drop policy if exists "error_logs_select_own" on public.error_logs;
drop policy if exists "error_logs_insert_own" on public.error_logs;
drop policy if exists "error_logs_update_own" on public.error_logs;
drop policy if exists "error_logs_delete_own" on public.error_logs;

create policy "error_logs_select_own" on public.error_logs
  for select using (auth.uid() = user_id);
create policy "error_logs_insert_own" on public.error_logs
  for insert with check (auth.uid() = user_id);
create policy "error_logs_update_own" on public.error_logs
  for update using (auth.uid() = user_id);
create policy "error_logs_delete_own" on public.error_logs
  for delete using (auth.uid() = user_id);

drop policy if exists "score_entries_select_own" on public.score_entries;
drop policy if exists "score_entries_insert_own" on public.score_entries;
drop policy if exists "score_entries_update_own" on public.score_entries;
drop policy if exists "score_entries_delete_own" on public.score_entries;

create policy "score_entries_select_own" on public.score_entries
  for select using (auth.uid() = user_id);
create policy "score_entries_insert_own" on public.score_entries
  for insert with check (auth.uid() = user_id);
create policy "score_entries_update_own" on public.score_entries
  for update using (auth.uid() = user_id);
create policy "score_entries_delete_own" on public.score_entries
  for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, start_date)
  values (new.id, date '2026-09-16')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();
