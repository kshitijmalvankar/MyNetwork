-- Insights: network statistics in one call (plain SQL, no AI), plus a cached
-- weekly AI summary of them.

create function public.network_insights(p_time_zone text default 'UTC')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  tz as (select coalesce(nullif(p_time_zone, ''), 'UTC') as name),
  local_now as (select (now() at time zone (select name from tz)) as ts),
  month_start as (select date_trunc('month', (select ts from local_now)) as m),
  people as (
    select c.id, c.role_family, c.seniority, c.country, c.city, c.company_id, c.created_at,
           coalesce(c.industry_override, co.industry) as industry,
           coalesce(c.last_contacted_at, c.created_at) as last_touch
    from public.contacts c
    left join public.companies co on co.id = c.company_id
  ),
  top as (
    select 'roles' as facet, role_family as value, count(*) as n from people where role_family is not null group by 1, 2
    union all select 'industries', industry, count(*) from people where industry is not null group by 1, 2
    union all select 'countries', country, count(*) from people where country is not null group by 1, 2
    union all select 'cities', city, count(*) from people where city is not null group by 1, 2
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'people', (select count(*) from people),
      'companies', (select count(distinct company_id) from people where company_id is not null),
      'events', (select count(*) from public.events),
      'notes', (select count(*) from public.notes where kind in ('text', 'voice')),
      'voiceNotes', (select count(*) from public.notes where kind = 'voice'),
      'addedThisMonth', (select count(*) from people where (created_at at time zone (select name from tz)) >= (select m from month_start)),
      'addedLastMonth', (select count(*) from people
                          where (created_at at time zone (select name from tz)) >= (select m from month_start) - interval '1 month'
                            and (created_at at time zone (select name from tz)) < (select m from month_start)),
      'touchesThisMonth', (select count(*) from public.interactions
                            where (occurred_at at time zone (select name from tz)) >= (select m from month_start)),
      'touchesLastMonth', (select count(*) from public.interactions
                            where (occurred_at at time zone (select name from tz)) >= (select m from month_start) - interval '1 month'
                              and (occurred_at at time zone (select name from tz)) < (select m from month_start))
    ),
    'growth', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.month, 'YYYY-MM'), 'people', coalesce(a.n, 0)) order by m.month), '[]'::jsonb)
      from generate_series((select m from month_start) - interval '11 months', (select m from month_start), interval '1 month') as m(month)
      left join (
        select date_trunc('month', created_at at time zone (select name from tz)) as month, count(*) as n
        from people group by 1
      ) a on a.month = m.month
    ),
    'roles', (select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', n) order by n desc, value), '[]'::jsonb) from top where facet = 'roles'),
    'industries', (select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', n) order by n desc, value), '[]'::jsonb) from top where facet = 'industries'),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', n) order by n desc, value), '[]'::jsonb) from top where facet = 'countries'),
    'cities', (select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', n) order by n desc, value), '[]'::jsonb) from top where facet = 'cities'),
    'seniority', (
      select coalesce(jsonb_agg(jsonb_build_object('value', s.level, 'count', coalesce(p.n, 0)) order by s.ord), '[]'::jsonb)
      from unnest(array['Intern', 'Junior', 'Mid', 'Senior', 'Lead/Manager', 'Director', 'VP', 'C-level/Founder']) with ordinality as s(level, ord)
      left join (select seniority, count(*) as n from people group by 1) p on p.seniority = s.level
    ),
    'companies', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'count', x.n) order by x.n desc, x.name), '[]'::jsonb)
      from (select co.id, co.name, count(*) as n from people p join public.companies co on co.id = p.company_id
            group by co.id, co.name order by n desc, co.name limit 8) x
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'date', x.starts_on, 'count', x.n) order by x.n desc, x.name), '[]'::jsonb)
      from (select e.id, e.name, e.starts_on, count(distinct i.contact_id) as n from public.events e
            join public.interactions i on i.event_id = e.id
            group by e.id, e.name, e.starts_on order by n desc, e.name limit 8) x
    ),
    'lastTouch', jsonb_build_array(
      jsonb_build_object('bucket', 'Last 30 days', 'count', (select count(*) from people where last_touch >= now() - interval '30 days')),
      jsonb_build_object('bucket', '1–3 months', 'count', (select count(*) from people where last_touch < now() - interval '30 days' and last_touch >= now() - interval '90 days')),
      jsonb_build_object('bucket', '3–6 months', 'count', (select count(*) from people where last_touch < now() - interval '90 days' and last_touch >= now() - interval '180 days')),
      jsonb_build_object('bucket', 'Over 6 months', 'count', (select count(*) from people where last_touch < now() - interval '180 days'))
    ),
    'followUps', jsonb_build_object(
      'open', (select count(*) from public.reminders where done_at is null),
      'overdue', (select count(*) from public.reminders where done_at is null and due_at < now()),
      'doneThisMonth', (select count(*) from public.reminders
                         where done_at is not null and (done_at at time zone (select name from tz)) >= (select m from month_start))
    )
  );
$$;

grant execute on function public.network_insights(text) to authenticated;
revoke execute on function public.network_insights(text) from public, anon;

-- One cached AI summary per user, encrypted. Rebuilt weekly, or on request.
create table public.insight_summaries (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  input_hash text not null,
  payload_enc bytea not null,
  model text not null,
  created_at timestamptz not null default now()
);

alter table public.insight_summaries enable row level security;
revoke all on public.insight_summaries from anon, authenticated;
grant select, insert, update, delete on public.insight_summaries to authenticated;
create policy "insight_summaries: owner only" on public.insight_summaries
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "insight_summaries: second factor when enrolled" on public.insight_summaries
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
