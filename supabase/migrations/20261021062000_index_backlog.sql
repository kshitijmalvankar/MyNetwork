-- A filterable "needs indexing" flag (PostgREST can't compare two columns),
-- used by the indexing sweeper and the Ask page's progress notice.

drop index public.contacts_unindexed_idx;
drop index public.events_unindexed_idx;

alter table public.contacts
  add column needs_index boolean generated always as (indexed_at is null or indexed_at < index_requested_at) stored;
alter table public.events
  add column needs_index boolean generated always as (indexed_at is null or indexed_at < index_requested_at) stored;

create index contacts_needs_index_idx on public.contacts (user_id, index_requested_at) where needs_index;
create index events_needs_index_idx on public.events (user_id, index_requested_at) where needs_index;
