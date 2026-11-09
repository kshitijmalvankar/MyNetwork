-- Who knows whom: links between two of the user's contacts that the user (or,
-- once accepted, an AI suggestion) has stated. Connections that follow from
-- other data (same company, past jobs, events, city) are worked out when
-- needed rather than stored, so they can't go stale.
--
-- kind:
--   knows          they know each other; stored once, smaller id first
--   introduced_by  contact_id was introduced to the user by other_id
create table public.contact_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid not null,
  other_id uuid not null,
  kind text not null check (kind in ('knows', 'introduced_by')),
  -- Where it came from, and for AI suggestions the note that showed it.
  source text not null default 'user' check (source in ('user', 'ai')),
  note_id uuid,
  created_at timestamptz not null default now(),
  check (contact_id <> other_id),
  check (kind <> 'knows' or contact_id < other_id),
  unique (user_id, contact_id, other_id, kind),
  -- Both people and the note must belong to the same user as the link.
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete cascade,
  foreign key (other_id, user_id) references public.contacts (id, user_id) on delete cascade,
  foreign key (note_id, user_id) references public.notes (id, user_id) on delete set null (note_id)
);

create index contact_links_contact_idx on public.contact_links (contact_id);
create index contact_links_other_idx on public.contact_links (other_id);

alter table public.contact_links enable row level security;
revoke all on public.contact_links from anon, authenticated;
grant select, insert, delete on public.contact_links to authenticated;
create policy "contact_links: owner only" on public.contact_links
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "contact_links: second factor when enrolled" on public.contact_links
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
