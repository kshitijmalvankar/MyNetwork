-- AI and rule-based suggestions the user approves or dismisses: follow-ups
-- found in notes, and people it's been a while since you contacted.

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('follow_up', 'reconnect')),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  due_on date,
  text_enc bytea,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index ai_suggestions_inbox_idx on public.ai_suggestions (user_id, status, created_at desc);
create index ai_suggestions_contact_idx on public.ai_suggestions (contact_id);
create index ai_suggestions_note_idx on public.ai_suggestions (note_id);
-- At most one open reconnect suggestion per person.
create unique index ai_suggestions_one_reconnect_idx on public.ai_suggestions (contact_id)
  where kind = 'reconnect' and status = 'pending';

alter table public.ai_suggestions enable row level security;
revoke all on public.ai_suggestions from anon, authenticated;
grant select, insert, update, delete on public.ai_suggestions to authenticated;
create policy "ai_suggestions: owner only" on public.ai_suggestions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ai_suggestions: second factor when enrolled" on public.ai_suggestions
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Suggest reconnecting with people you haven't been in touch with for a while.
-- Plain SQL, no AI. Keeps at most p_max_pending open suggestions per user, skips
-- people with an open follow-up, and doesn't re-suggest someone for 120 days
-- after you acted on or dismissed it. Server-only.
create function public.suggest_reconnects(
  p_user_id uuid default null,
  p_after interval default '60 days',
  p_max_pending integer default 3
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.ai_suggestions (user_id, kind, contact_id)
  select ranked.user_id, 'reconnect', ranked.id
  from (
    select c.id, c.user_id,
           row_number() over (partition by c.user_id order by coalesce(c.last_contacted_at, c.created_at)) as rn,
           (select count(*) from public.ai_suggestions s
             where s.user_id = c.user_id and s.kind = 'reconnect' and s.status = 'pending') as pending
    from public.contacts c
    where (p_user_id is null or c.user_id = p_user_id)
      and coalesce(c.last_contacted_at, c.created_at) < now() - p_after
      and not exists (select 1 from public.reminders r where r.contact_id = c.id and r.done_at is null)
      and not exists (
        select 1 from public.ai_suggestions s
        where s.contact_id = c.id and s.kind = 'reconnect'
          and (s.status = 'pending' or s.decided_at > now() - interval '120 days'))
  ) ranked
  where ranked.rn <= greatest(p_max_pending - ranked.pending, 0)
  on conflict (contact_id) where kind = 'reconnect' and status = 'pending' do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.suggest_reconnects(uuid, interval, integer) from public, anon, authenticated;

-- Getting in touch with someone settles any open "reconnect" suggestion for them.
create function public.resolve_reconnect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.ai_suggestions
  set status = 'accepted', decided_at = now()
  where contact_id = new.contact_id and kind = 'reconnect' and status = 'pending';
  return new;
end;
$$;

create trigger interactions_resolve_reconnect
  after insert on public.interactions
  for each row execute function public.resolve_reconnect();
