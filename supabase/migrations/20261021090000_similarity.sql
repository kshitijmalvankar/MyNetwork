-- "Similar background" for the knowledge graph: an embedding of each person's
-- role (title, kind of role, seniority, industry, past roles), deliberately
-- without company or events, which the graph already links directly. Each
-- person keeps their closest matches at other companies.

alter table public.contacts
  add column background_embedding extensions.vector(1536),
  add column background_model text,
  add column background_hash text;

create table public.contact_similarity (
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  similar_id uuid not null references public.contacts (id) on delete cascade,
  score real not null,
  primary key (contact_id, similar_id)
);

create index contact_similarity_user_idx on public.contact_similarity (user_id);
create index contact_similarity_similar_idx on public.contact_similarity (similar_id);

alter table public.contact_similarity enable row level security;
revoke all on public.contact_similarity from anon, authenticated;
grant select on public.contact_similarity to authenticated;
-- Owners read; only the server's refresh functions write.
create policy "contact_similarity: owner read" on public.contact_similarity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "contact_similarity: second factor when enrolled" on public.contact_similarity
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Recomputes one person's closest matches (exact search within their owner's network).
create function public.refresh_contact_similarity(p_contact_id uuid, p_limit integer default 5, p_min real default 0.55)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.contact_similarity where contact_id = p_contact_id;
  insert into public.contact_similarity (user_id, contact_id, similar_id, score)
  select c.user_id, c.id, o.id, o.score
  from public.contacts c
  cross join lateral (
    select x.id, (1 - (x.background_embedding operator(extensions.<=>) c.background_embedding))::real as score
    from public.contacts x
    where x.user_id = c.user_id
      and x.id <> c.id
      and x.background_embedding is not null
      and x.background_model = c.background_model
      and (c.company_id is null or x.company_id is distinct from c.company_id)
    order by x.background_embedding operator(extensions.<=>) c.background_embedding
    limit p_limit
  ) o
  where c.id = p_contact_id and c.background_embedding is not null and o.score >= p_min;
$$;

-- Recomputes everyone's matches for one user, or for all users (nightly).
create function public.refresh_user_similarity(p_user_id uuid default null, p_limit integer default 5, p_min real default 0.55)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.contact_similarity where p_user_id is null or user_id = p_user_id;
  insert into public.contact_similarity (user_id, contact_id, similar_id, score)
  select c.user_id, c.id, o.id, o.score
  from public.contacts c
  cross join lateral (
    select x.id, (1 - (x.background_embedding operator(extensions.<=>) c.background_embedding))::real as score
    from public.contacts x
    where x.user_id = c.user_id
      and x.id <> c.id
      and x.background_embedding is not null
      and x.background_model = c.background_model
      and (c.company_id is null or x.company_id is distinct from c.company_id)
    order by x.background_embedding operator(extensions.<=>) c.background_embedding
    limit p_limit
  ) o
  where (p_user_id is null or c.user_id = p_user_id)
    and c.background_embedding is not null
    and o.score >= p_min;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.refresh_contact_similarity(uuid, integer, real) from public, anon, authenticated;
revoke execute on function public.refresh_user_similarity(uuid, integer, real) from public, anon, authenticated;

-- Existing contacts get a background embedding on their next indexing pass.
-- Their search chunks are unchanged, so nothing else is re-embedded.
update public.contacts set index_requested_at = now();
