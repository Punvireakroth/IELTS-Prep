-- Progress for the study page.
-- Run once in the Supabase SQL editor (Dashboard → SQL), then put the
-- project URL and publishable key in .env. Do not put the secret key in the app.

create table public.study_checks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key text not null,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key),
  constraint study_checks_item_key_len check (char_length(item_key) between 1 and 400)
);

create table public.study_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_key text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, note_key),
  constraint study_notes_note_key_len check (char_length(note_key) between 1 and 200),
  constraint study_notes_body_len check (char_length(body) <= 8000)
);

comment on table public.study_checks is 'Checkbox state for the IELTS prep study page.';
comment on table public.study_notes is 'Day notes and schedule settings for the IELTS prep study page.';

alter table public.study_checks enable row level security;
alter table public.study_notes enable row level security;

revoke all on table public.study_checks from anon;
revoke all on table public.study_notes from anon;

grant select, insert, update, delete on table public.study_checks to authenticated;
grant select, insert, update, delete on table public.study_notes to authenticated;

create policy "study_checks_select_own"
  on public.study_checks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "study_checks_insert_own"
  on public.study_checks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "study_checks_update_own"
  on public.study_checks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "study_checks_delete_own"
  on public.study_checks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "study_notes_select_own"
  on public.study_notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "study_notes_insert_own"
  on public.study_notes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "study_notes_update_own"
  on public.study_notes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "study_notes_delete_own"
  on public.study_notes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
