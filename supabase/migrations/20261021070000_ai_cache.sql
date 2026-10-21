-- Cached AI output (currently meeting briefs), encrypted, one per contact.
-- A cached brief is reused only while its input hash matches: same facts,
-- same day, same request and same model.

create table public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('brief')),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  input_hash text not null,
  payload_enc bytea not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, contact_id)
);

create index ai_cache_contact_idx on public.ai_cache (contact_id);

alter table public.ai_cache enable row level security;
revoke all on public.ai_cache from anon, authenticated;
grant select, insert, update, delete on public.ai_cache to authenticated;
create policy "ai_cache: owner only" on public.ai_cache
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ai_cache: second factor when enrolled" on public.ai_cache
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
