-- "Ask my network": searchable knowledge (encrypted text + embeddings) and
-- saved, encrypted chat threads.

-- ---------------------------------------------------------------------------
-- Knowledge chunks: one per contact profile, note piece or event.
-- The text is AES-GCM encrypted; the embedding is plaintext (see SECURITY.md).
-- ---------------------------------------------------------------------------
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('contact', 'note', 'event')),
  source_id uuid not null,
  chunk_index smallint not null default 0 check (chunk_index >= 0),
  contact_id uuid references public.contacts (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  content_enc bytea not null,
  content_hash text not null,
  embedding extensions.vector(1536) not null,
  embedding_model text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, chunk_index)
);

-- Search is exact (no approximate index): it only ever scans one user's rows,
-- which stays fast at this scale and never loses results to a tenant filter.
create index knowledge_chunks_user_idx on public.knowledge_chunks (user_id, embedding_model);
create index knowledge_chunks_contact_idx on public.knowledge_chunks (contact_id);
create index knowledge_chunks_event_idx on public.knowledge_chunks (event_id);
create index knowledge_chunks_note_idx on public.knowledge_chunks (note_id);

alter table public.knowledge_chunks enable row level security;
revoke all on public.knowledge_chunks from anon, authenticated;
grant select on public.knowledge_chunks to authenticated;
-- Owners can read their chunks; only the server (service role) writes them.
create policy "knowledge_chunks: owner read" on public.knowledge_chunks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "knowledge_chunks: second factor when enrolled" on public.knowledge_chunks
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Null means "needs (re)indexing"; set by the app after a change, cleared by the indexer.
alter table public.contacts add column indexed_at timestamptz;
alter table public.events add column indexed_at timestamptz;
create index contacts_unindexed_idx on public.contacts (user_id) where indexed_at is null;
create index events_unindexed_idx on public.events (user_id) where indexed_at is null;

-- Nearest chunks to a query embedding, for the signed-in user only.
create function public.match_chunks(
  p_embedding extensions.vector(1536),
  p_model text,
  p_limit integer default 8,
  p_contact_id uuid default null
)
returns table (
  id uuid,
  source_type text,
  source_id uuid,
  contact_id uuid,
  event_id uuid,
  content_enc bytea,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select k.id, k.source_type, k.source_id, k.contact_id, k.event_id, k.content_enc,
         1 - (k.embedding operator(extensions.<=>) p_embedding) as similarity
  from public.knowledge_chunks k
  where k.user_id = (select auth.uid())
    and k.embedding_model = p_model
    and (p_contact_id is null or k.contact_id = p_contact_id)
  order by k.embedding operator(extensions.<=>) p_embedding
  limit least(greatest(p_limit, 1), 20);
$$;

grant execute on function public.match_chunks(extensions.vector, text, integer, uuid) to authenticated;
revoke execute on function public.match_chunks(extensions.vector, text, integer, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Chat threads and messages. Titles and message parts are encrypted.
-- ---------------------------------------------------------------------------
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title_enc bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  message_id text not null check (char_length(message_id) between 1 and 64),
  role text not null check (role in ('user', 'assistant')),
  parts_enc bytea not null,
  created_at timestamptz not null default now(),
  unique (thread_id, message_id)
);

create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at);

create trigger chat_threads_set_updated_at before update on public.chat_threads
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['chat_threads', 'chat_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || ': owner only', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t || ': second factor when enrolled', t);
  end loop;
end;
$$;
