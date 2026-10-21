-- Race-free "needs indexing" tracking. The app stamps index_requested_at on
-- every change; the indexer stamps indexed_at with the time it *started*. A
-- change that lands mid-run is newer than indexed_at, so the row stays stale
-- and is picked up again instead of being silently marked done.

drop index public.contacts_unindexed_idx;
drop index public.events_unindexed_idx;

alter table public.contacts add column index_requested_at timestamptz not null default now();
alter table public.events add column index_requested_at timestamptz not null default now();

create index contacts_unindexed_idx on public.contacts (user_id)
  where indexed_at is null or indexed_at < index_requested_at;
create index events_unindexed_idx on public.events (user_id)
  where indexed_at is null or indexed_at < index_requested_at;
